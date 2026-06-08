# Tuning findings (measured)

Beyond the headline matrix, a set of controlled experiments (one variable at a time,
identical limits, Apple M3, 2 CPU / 1 GB) produced findings that **changed the
conclusions**. All numbers below are real measurements, reproducible with the runner.

---

## 1. Garbage collector: G1 vs Generational ZGC (Java 25)

Same variant, same load (http, 100 VUs), only `JAVA_OPTS` GC flag changes:

| Variant / GC | req/s | p50 | p95 | p99 | **p99.9** |
|---|--:|--:|--:|--:|--:|
| spring-vt-jvm · G1 | 9,643 | 9.0 | 18.4 | 28.6 | **207.1 ms** |
| spring-vt-jvm · **ZGC** | 9,365 | 9.2 | 19.9 | 34.1 | **64.9 ms** |
| quarkus-reactive-jvm · G1 | 11,564 | 7.6 | 15.0 | 20.2 | **207.2 ms** |
| quarkus-reactive-jvm · **ZGC** | **14,846** | 6.2 | 11.1 | 14.6 | **20.6 ms** |

**Finding:** the ~207 ms tails under G1 were **GC pauses**. Generational ZGC (concurrent,
sub-millisecond pauses) cuts p99.9 **3× on VT and 10× on reactive**, and lifts reactive
throughput **+28%** (G1 pauses were stalling the event loop). **Root cause:** G1 is a
pause-based collector; under high allocation its STW pauses land in the tail. ZGC collects
concurrently. **Decision:** JVM variants now default to `-XX:+UseZGC` (see the compose
`JAVA_OPTS`). The first measurement pass used G1 and *undersold every JVM variant's tail*.

---

## 2. Virtual Threads were under-measured, not slow

The first pass showed spring-vt-jvm at ~3,871 req/s (http) — surprisingly low. It was a
**measurement artifact**, not a VT limitation:

- **Offered load too low.** The first pass used 40 VUs in a *closed loop* (each VU waits for
  the response), so throughput ≈ VUs ÷ latency ≈ 40 ÷ 3.9 ms ≈ 10k — capped by the client,
  not the server.
- **G1 tail** (see §1).
- **Connection-pool contention** at small pools.

Pool sweep (spring-vt-jvm, ZGC, 150 VUs, http):

| Hikari pool | req/s | p99 | p99.9 |
|---|--:|--:|--:|
| 16 | 10,221 | 38.3 | 58.0 ms |
| 64 | 12,465 | 35.0 | 132.3 ms |
| 90 | 12,241 | 32.9 | 210.8 ms |

**Finding:** pool 16→64 lifts throughput +22% (real contention at small pools), but 64→90 is
flat with a *worse* tail — past 64 the bottleneck is PostgreSQL, and extra connections only
add DB-side contention. **With ZGC + adequate load + pool ≥ 64, VT reaches ~12.5k req/s** —
competitive with reactive (~14.8k), a ~18% gap, **not the 2.6× the first pass implied.**

**Pinning is a non-issue on Java 25.** [JEP 491](https://openjdk.org/jeps/491) (JDK 24)
removed carrier-thread pinning on `synchronized`, so the classic "JDBC driver pins the
virtual thread" concern does not apply here. VT's limiter is the connection pool / DB, not pinning.

---

## 3. Backpressure under overload: reactive degrades gracefully, VT collapses

Open-model saturation sweep (constant **arrival rate**, so the client does *not* self-throttle),
ZGC, http:

| Offered req/s | VT-jvm achieved | VT err / RSS | Reactive achieved | Reactive err / RSS |
|--:|--:|--|--:|--|
| 5,000 | 4,965 | 0% / 975 MiB | 5,000 | 0% / 986 MiB |
| 10,000 | **874** | **19% / OOM** | 9,790 | 0% / 992 MiB |
| 15,000 | — | **100% / dead** | 8,770 | 0% / 931 MiB |
| 30,000 | — | **100% / dead** | 9,271 | **0% / 948 MiB** |

**Finding — arguably the most important one:**
- **Reactive (Mutiny) has built-in backpressure.** Past capacity (~9k) it *caps* achieved
  throughput, keeps p99 bounded (~400 ms), holds **0% errors up to 30k offered**, and keeps
  **RSS stable** (~950 MiB). It sheds excess load instead of accepting it.
- **Virtual Threads have no backpressure.** They accept everything → spawn unbounded virtual
  threads → **RSS blows past the 1 GB limit → OOM/crash → 100% errors, no recovery.**

**This reframes "reactive vs VT":** on *throughput at moderate load* they are close (§2); under
*overload* reactive wins decisively because it degrades gracefully while VT collapses.
**Caveat:** VT *can* be made resilient by adding explicit admission control (a bounded
semaphore/queue in front of the handler); reactive gets it for free.

---

## 4. The workload is DB-bound; spare CPU is efficiency, not waste

A common question: with 2 CPU / 1 GB, why doesn't the backend peg 200% CPU? Because each
request does a **durable PostgreSQL INSERT** and waits on the commit (`fsync`) — the CPU is
blocked on I/O, not idle-by-waste.

quarkus-reactive-jvm, 150 VUs, http:

| Postgres | req/s | backend CPU |
|---|--:|--:|
| durable (`synchronous_commit=on`, default) | 7,596 | ~120% / 200% |
| fast (`synchronous_commit=off`) | **20,111** | ~120% / 200% |

**Finding:** dropping the fsync wait **tripled throughput (×2.6) with the same backend CPU** —
proof the bottleneck was DB durability, not the app, and that the reactive backend has real
CPU headroom (20k req/s on ~1.2 cores). The container limit is a **fair ceiling**, not a
target: doing more work per core (efficiency, req/s·MB) is the goal, not burning CPU. The
official run keeps Postgres **durable** for all variants (same ceiling for everyone → ranking
stays fair).

---

## What changed in the project as a result
- JVM variants default to **Generational ZGC** (`JAVA_OPTS` in compose / `.env.example`).
- The full run uses **~150 VUs** (near the measured saturation knee) instead of a low fixed load.
- The runner marks a variant **unsupported** if it starts but errors on ~every request
  (see `spring-webflux-native` — it starts now but R2DBC inserts 500 on native; see [RISKS.md](RISKS.md)).
- New k6 scripts: `runner/k6/saturation.js` (open-model backpressure probe).

See [METHODOLOGY.md](../METHODOLOGY.md) for the protocol and [RISKS.md](RISKS.md) for caveats.
