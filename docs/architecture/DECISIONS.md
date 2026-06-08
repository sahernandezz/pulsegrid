# Architecture decisions (ADR log)

Lightweight records of the decisions the brief delegated to the implementer.

## ADR-001 — Dual ingestion (HTTP + Kafka), selected at runtime
**Decision:** support **both** ingestion modes via the `INGEST_MODE` env var (`http` |
`queue`) and measure every variant in both, rather than picking one.
**Why:** the queue path is more realistic for an ingestion service and aligns with the
domain, but it is asynchronous — not equivalent to synchronous HTTP. Measuring both turns
"which is faster" into the honest, interesting question: *what latency does a queue cost
and what resilience does it buy?* One artifact serves both modes; the Kafka consumer is
gated at startup so http mode never connects to Kafka.

## ADR-002 — DB schema is the single source of truth
**Decision:** the schema lives in `db/migrations/*.sql`, mounted into Postgres' initdb. The
apps run with DDL disabled (Hibernate `generation=none`; JdbcClient/R2DBC/Vert.x use the
existing tables).
**Why:** guarantees a byte-identical schema for every variant — a precondition for a fair
comparison — and avoids per-app migration drift.

## ADR-003 — One project per stack, parametrized by Maven profile + source set
**Decision:** Spring is one project (`-Pvt | -Pwebflux`); Quarkus is one project
(`-Preactive | -Pimperative`); packaging (JVM/native) is a Dockerfile/profile concern.
Shared, framework-agnostic code in `src/main/java`; paradigm code in
`src/main/java-<paradigm>` added via `build-helper-maven-plugin`.
**Why:** the JVM-vs-native axis must not duplicate code (brief requirement). Paradigms
genuinely differ in stack, so they get separate source sets — but only one is ever active
per build, so two mains never collide.

## ADR-004 — JDK per stack (documented confounder)
**Decision:** Spring Boot 4 on **Java 25** (showcases Virtual Threads / structured
concurrency); Quarkus on **Java 21 LTS** (its mature target for native/Mandrel).
**Why:** each framework on its recommended/most-defensible JDK. This is a deliberate,
documented confounder — recorded in the consolidated `environment` block so readers know.

## ADR-005 — Native build failures are findings, never fabrications
**Decision:** if a native variant cannot build/serve after reasonable effort, mark it
`"supported": false` with the reason; never invent numbers. See [RISKS.md](RISKS.md).

## ADR-006 — Reservoir-sampled p95 in the windowing engine
**Decision:** windows keep exact count/min/max/avg and a fixed-size (4096) reservoir for
p95.
**Why:** bounded memory under high ingest, and — crucially — it is the *same shared class*
for every variant, so any sampling bias is identical and cancels out in the comparison.

## ADR-007 — Runner restarts the backend per run; persists incrementally
**Decision:** the runner restarts the variant container on each of the ≥3 runs (cold start
measured every run) and writes the consolidated file after each variant.
**Why:** real per-run startup distribution (median + stddev) and no loss of measured data
if a later variant fails.
