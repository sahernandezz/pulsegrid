# PulseGrid · Quarkus backend

A **single** Quarkus project that produces 4 variants:

| Paradigm | Packaging | Stack | Selector |
|----------|-----------|-------|----------|
| `reactive`   | JVM / native | quarkus-rest + Mutiny (Uni/Multi) + Vert.x reactive PG client + Vert.x EventBus | `-Preactive`  + (`-Dnative`) |
| `imperative` | JVM / native | quarkus-rest `@Blocking` + Hibernate ORM (Panache) blocking | `-Pimperative` + (`-Dnative`) |

## Parametrization

- **Shared** code in `src/main/java` (domain + windowing), with no JAX-RS/persistence.
- **Per-paradigm** code in source sets, added by its Maven profile (build-helper):
  - `src/main/java-reactive`  → Mutiny + `io.vertx.mutiny.sqlclient.Pool` + `EventBus`.
    The SSE stream consumes a **Vert.x EventBus** address where the scheduler publishes
    closed windows (the design's direct Vert.x touch point).
  - `src/main/java-imperative` → Hibernate ORM (Panache) + `@Blocking` endpoints +
    classic JAX-RS SSE (`SseBroadcaster`).
- `quarkus.profile` (reactive/imperative) selects the runtime datasource (reactive vs
  JDBC) via the `%reactive.` / `%imperative.` prefixes in `application.properties`.
  It is set by the `ENTRYPOINT` from `PARADIGM`.
- **Dual ingestion** (`INGEST_MODE`): the queue path uses the standard Kafka client
  **gated at startup** (`@Observes StartupEvent`), so the same artifact serves http and
  queue without the consumer trying to connect to Kafka when it shouldn't.

## Build

```bash
# JVM
mvn -Preactive   -DskipTests clean package && java -jar target/quarkus-app/quarkus-run.jar
mvn -Pimperative -DskipTests clean package

# Native (needs GraalVM/Mandrel with native-image; produces target/pulsegrid-quarkus-runner)
mvn -Preactive   -Dnative -DskipTests package
mvn -Pimperative -Dnative -DskipTests package

# Docker (what the runner does)
docker build -f src/main/docker/Dockerfile.jvm    -t pulsegrid/quarkus-reactive-jvm      --build-arg PARADIGM=reactive .
docker build -f src/main/docker/Dockerfile.jvm    -t pulsegrid/quarkus-imperative-jvm    --build-arg PARADIGM=imperative .
docker build -f src/main/docker/Dockerfile.native -t pulsegrid/quarkus-reactive-native   --build-arg PARADIGM=reactive .
docker build -f src/main/docker/Dockerfile.native -t pulsegrid/quarkus-imperative-native --build-arg PARADIGM=imperative .
```

API and domain contract: see [../../docs/API.md](../../docs/API.md).
