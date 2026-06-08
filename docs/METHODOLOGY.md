# Measurement methodology

Rigor is the whole point — the numbers are only worth something if the conditions are
identical and the process is reproducible. This is what the runner enforces.

## Indicators (what we measure)

Core (v1):

1. **Throughput** — sustained req/s at fixed load.
2. **Latency** — p50 / p95 / **p99 / p99.9** at the same fixed load for every variant.
   The long tail (p99.9) is what separates paradigms and what hurts most in production.
3. **Error rate under load** — % failed/timed-out requests near saturation. Reveals who
   degrades gracefully and who collapses.
4. **Cold start** — `docker run` → health `200`. Where native should shine.
5. **Time-to-first-request** — start until the first *real* request succeeds (≠ health).
6. **Warm-up curve** — how long to reach stable performance. Visualizes JVM (JIT warm-up)
   vs native (no warm-up).
7. **Idle RSS** — resident memory after 30s with no load.
8. **Under-load RSS (peak)** — during the load test.
9. **CPU under load** — sustained %.
10. **Docker image size** — free to measure; native vs JVM differs drastically.
11. **Efficiency** — req/s per MB of RAM and req/s per %CPU. Performance normalized by
    cost — the metric that actually matters in the cloud.

Phase 2 (optional, lengthen each run — deferred): soak test, spike/recovery.

## Rules

- **Identical, hard resource limits** per container — `cpus: 2`, `mem_limit: 1g`,
  `cpuset: 0,1` — defined once via the compose `&res_limits` anchor and reused. **Without
  this the comparison is void.** Verify during the run with `docker stats`; the runner
  records the observed RSS against the limit.
- **Container-aware JVM**: JVM variants use `-XX:MaxRAMPercentage=75.0` (not a fixed `-Xmx`)
  so the heap scales with the container limit, **plus Generational ZGC (`-XX:+UseZGC`)** —
  measured to cut p99.9 tails 3–10× vs G1 (see [architecture/FINDINGS.md](architecture/FINDINGS.md)).
  Set explicitly so it is reproducible and defensible. Native variants (GraalVM CE) use Serial
  GC — documented as a caveat.
- **Offered load near the saturation knee.** Throughput is measured at a concurrency close to
  the measured break-point (~150 VUs for this DB-bound workload), not a low fixed load: a
  too-low closed-loop load measures latency, not capacity (see FINDINGS.md §2).
- **Mandatory warm-up** 30–60s before measuring, discarded — critical for JVM variants
  (JIT). Native variants do not warm up the same way; that difference *is* part of the finding.
- **≥3 runs** per variant; report **median + stddev**, never a single number.
- **One variant at a time.** Nothing concurrent sharing the host. The runner restarts the
  backend per run to measure cold start each time.
- **Document the exact environment** in the consolidated file and the README: CPU, cores,
  RAM, OS, Java/GraalVM version, Spring Boot / Quarkus versions, container limits.

## Ingestion modes (measure every variant in both)

Each variant is measured in two ingestion modes via `INGEST_MODE`:

- **`http`** — synchronous: the client sends the event and waits for the response.
- **`queue`** — asynchronous via Kafka: the backend accepts/enqueues and processes later.

> **Honest framing (goes in the article):** http and queue are **not functionally
> equivalent** — one is synchronous, the other asynchronous. Do not present it as "the
> queue is faster/slower" flatly, but as "two ingestion architectures with different
> trade-offs". The interesting question: *how much latency does a queue cost, and how much
> resilience under spikes does it buy?*

## Methodological honesty

- Do not assume a winner. Plausible hypotheses (to confirm/refute with data): native wins
  on startup and RSS; on sustained throughput, Virtual Threads and WebFlux may land very
  close, and a warm JVM may match native at peak. **Report whatever comes out, even if it
  contradicts the popular narrative.** That is the value.
- If a native variant does not compile, that is real data — document it (see
  [architecture/RISKS.md](architecture/RISKS.md)), do not hide it.
