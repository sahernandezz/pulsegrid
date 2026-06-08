# PulseGrid

> ### 🔗 Live showcase → **[pulsegrid.web.app](https://pulsegrid.web.app)**
> Interactive consolidated results — the refined dark dashboard that reads `consolidated-results.json` (filterable matrix, scaling curves, per-variant detail · EN/ES).

**Today, with Spring Boot 4 / Java 25, Virtual Threads and GraalVM native compilation
all available — which concurrency paradigm is the right choice for a high-concurrency
ingestion service, and why?** PulseGrid answers that with **real, reproducible
measurements**, not opinion.

Same domain, same API, same load, same resource limits — varying only the
**concurrency strategy** (Virtual Threads · WebFlux · Mutiny reactive · imperative) and
the **packaging** (JVM · GraalVM native).

---

## Architecture (3 decoupled layers)

```
Backends (Docker, parametrized)  →  Benchmark Runner (offline)  →  consolidated-results.json  →  React frontend (showcase)
       [evidence in the repo]            [generates data]               [real data]                  [presentation]
```

1. **Backends under test** — 8 variants of the *same* service, each in its own container
   with **identical CPU/RAM limits**. The only difference is concurrency/packaging. The
   code stays in the repo as **auditable evidence**.
2. **Benchmark Runner** (`runner/`) — runs the load tests against **one variant at a time**
   (dedicated resources, no interference), measures the indicators and persists a
   **consolidated file** (`consolidated-results.json`). It is a job, not a live service.
3. **React frontend** (`frontend/`) — **only reads** the consolidated file and presents it.
   It runs no tests and queries no live Prometheus. It is the showcase.

**Why decoupled:** separating "generate trustworthy data" from "present it" makes the
measurement more valid (each variant with dedicated resources) and more honest (the
consolidated file is auditable against the code).

## The 8 variants (v1)

| # | Stack | Concurrency | Packaging | Compose profile |
|---|-------|-------------|-----------|-----------------|
| 1 | Spring Boot 4 | Virtual Threads (Java 25) | JVM    | `spring-vt-jvm` |
| 2 | Spring Boot 4 | Virtual Threads (Java 25) | Native | `spring-vt-native` |
| 3 | Spring Boot 4 | WebFlux (Reactor)         | JVM    | `spring-webflux-jvm` |
| 4 | Spring Boot 4 | WebFlux (Reactor)         | Native | `spring-webflux-native` ⚠️ |
| 5 | Quarkus       | Reactive (Mutiny/Vert.x)  | JVM    | `quarkus-reactive-jvm` |
| 6 | Quarkus       | Imperative (blocking)     | JVM    | `quarkus-imperative-jvm` |
| 7 | Quarkus       | Reactive (Mutiny/Vert.x)  | Native | `quarkus-reactive-native` |
| 8 | Quarkus       | Imperative (blocking)     | Native | `quarkus-imperative-native` |

⚠️ #4 (WebFlux + native) is the highest build risk (Reactor AOT hints). If it does not
build after reasonable effort it is documented as a finding and marked
`"supported": false` — the data is not fabricated. See [docs/architecture/RISKS.md](docs/architecture/RISKS.md).

Each variant is also tested in **two ingestion modes** (`INGEST_MODE`): `http`
(synchronous) and `queue` (asynchronous via Kafka) → **16 profiles**.

## Repository layout

```
pulsegrid/
├── README.md                     · this file
├── consolidated-results.json     · file consumed by the frontend (produced by the runner)
├── docker-compose.yml            · brings up ONE variant + infra in isolation
├── backends/
│   ├── spring/                   · Spring Boot 4, parametrized VT/WebFlux × JVM/native
│   └── quarkus/                  · Quarkus, parametrized reactive/imperative × JVM/native
├── runner/                       · Benchmark Runner (Python) + k6 + prometheus.yml
├── benchmark/
│   ├── analyze.py                · generates charts + the "evidence pack" (article-kit/)
│   ├── plots/                    · generate_plots.py + output/
│   └── results/raw/              · raw k6 outputs (evidence)
├── frontend/                     · React app (Vite+Tailwind+Recharts) — static site
├── db/migrations/                · SQL schema identical for every variant
└── docs/                         · API.md, schema, architecture diagrams
```

## Quickstart

### Bring up one variant by hand
```bash
cp .env.example .env
# infra + one variant (http mode by default):
docker compose --profile infra --profile spring-vt-jvm up -d --build
curl -s localhost:8080/health
curl -s -XPOST localhost:8080/api/events -H 'content-type: application/json' \
  -d '{"deviceId":"dev-1","metricType":"CPU","value":42.7,"timestamp":"2026-06-02T12:00:00Z","region":"us-east"}'
curl -s 'localhost:8080/api/aggregates?metricType=CPU'
docker compose --profile spring-vt-jvm --profile infra down
```

### Queue mode (Kafka)
```bash
INGEST_MODE=queue docker compose --profile infra --profile queue --profile quarkus-reactive-jvm up -d --build
```

### Run the full benchmark (produces the consolidated file)
```bash
cd runner && pip install -r requirements.txt
python run_benchmarks.py --variants variants.yaml --runs 3
# -> writes ../consolidated-results.json and ../benchmark/results/raw/
```

### Generate charts + evidence pack for the article
```bash
cd benchmark && pip install -r ../runner/requirements.txt
python analyze.py            # -> plots/output/*.png + article-kit/*
```

### Frontend (showcase)

Deployed live at **https://pulsegrid.web.app** (Firebase Hosting). To run it locally:

```bash
cd frontend && npm install && npm run dev      # reads ../consolidated-results.json
npm run build                                  # static site in dist/
```

## Measurement protocol (summary)

- **Identical, hard resource limits** per container: `cpus: 2`, `mem_limit: 1g`,
  `cpuset: 0,1` — defined once via a YAML anchor. **Without this the comparison is void.**
- **Container-aware JVM**: `-XX:MaxRAMPercentage=75.0` (not a fixed `-Xmx`) so the heap
  scales with the container limit. Documented and verified with `docker stats`.
- **Warm-up** 30–60s discarded (critical for the JVM due to the JIT).
- **≥3 runs** per variant; report **median + stddev**.
- **One variant at a time.** Nothing concurrent sharing the host.

Core indicators: throughput, latency (p50/p95/p99/p999), error rate, cold start,
time-to-first-request, warm-up curve, idle/under-load RSS, CPU, image size, and
**efficiency** (req/s per MB and per %CPU). Detail in [docs/METHODOLOGY.md](docs/METHODOLOGY.md).

## Documentation

- **API contract** — [docs/API.md](docs/API.md)
- **Methodology** — [docs/METHODOLOGY.md](docs/METHODOLOGY.md)
- **Architecture & diagrams** — [docs/architecture/ARCHITECTURE.md](docs/architecture/ARCHITECTURE.md)
- **Decisions (ADRs)** — [docs/architecture/DECISIONS.md](docs/architecture/DECISIONS.md)
- **Known risks** — [docs/architecture/RISKS.md](docs/architecture/RISKS.md)
- **Tuning findings (GC · backpressure · VT)** — [docs/architecture/FINDINGS.md](docs/architecture/FINDINGS.md)

## What the measurements show — and when to choose each

**Measured** (Apple M3, 2 CPU / 1 GB, durable Postgres, Generational ZGC on the JVM, ~150 VUs
near the saturation knee). Full analysis + the tuning experiments:
[docs/architecture/FINDINGS.md](docs/architecture/FINDINGS.md).

- **Quarkus reactive (Mutiny) wins peak throughput** — ~12.7k req/s http, ~22.7k queue, top
  efficiency. Clear #1 in both modes.
- **Virtual Threads are competitive, not slow.** With ZGC + adequate load, `spring-vt-jvm`
  reaches ~8.5k req/s http (above Spring WebFlux) and ~11.4k queue. The first pass made VT look
  slow — that was a measurement artifact (40 VUs + G1), not a VT limitation. Pinning is moot on
  Java 25 ([JEP 491](https://openjdk.org/jeps/491)); VT's limiter is the connection pool / DB.
- **Native trades peak throughput for footprint + efficiency.** Cold start ~0.3–0.5 s, idle RSS
  60–130 MB, images 61–85 MB, best req/s·MB — but lower peak throughput than a warm JVM, partly
  GraalVM CE's single-threaded **Serial GC**. `spring-vt-native` is the weak spot (VT + Serial
  GC = a ~1 s p99.9 tail).
- **Generational ZGC is a free win** on the JVM: cut p99.9 tails 3–10× and lifted reactive
  throughput +28% vs G1. Now the default.
- **Under overload, reactive degrades gracefully; VT collapses.** Reactive applies backpressure
  (bounded latency, 0% errors, stable RSS up to ~3× capacity); VT has none → unbounded threads →
  OOM. This resilience gap is reactive's strongest argument; VT needs explicit admission control.
- **http vs queue** is a trade-off, not a race — measured and ranked **separately**, never pooled.
- **`spring-webflux-native`** builds and boots, but R2DBC *inserts* fail on native (writes 500,
  reads work) → kept **unsupported**. An honest finding, not hidden.

**When to choose each:** peak throughput on long-lived services → **Quarkus reactive + ZGC (JVM)**.
Edge / serverless / scale-to-zero → **Quarkus native** (fast start, tiny footprint). Readable code
+ high concurrency without a reactive rewrite → **Virtual Threads + ZGC** (add admission control
for overload). Every number stays auditable against the code that produced it.

## Status

🚧 Under construction. See `consolidated-results.json` — it currently contains
**illustrative sample data** (`"sample": true`); the frontend renders it with a warning
banner. It is replaced by real measurements when the runner is run.

## Author

**Sergio Alejandro Hernández Zambrano** — *Sergio Hernández* · Backend Software Engineer (Bogotá, Colombia).

- 🌐 Portfolio — [sahernandezz.web.app](https://sahernandezz.web.app)
- 💼 LinkedIn — [in/sergio-alejandro-hernandez-zambrano](https://www.linkedin.com/in/sergio-alejandro-hernandez-zambrano)
- 🐙 GitHub — [@sahernandezz](https://github.com/sahernandezz)

## License

MIT © Sergio Alejandro Hernández Zambrano — see [LICENSE](LICENSE).
