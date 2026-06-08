# PulseGrid · Spring Boot 4 backend

A **single** Maven project that produces 4 variants by combining:

| Axis | Values | How it is selected |
|------|--------|--------------------|
| Paradigm | `virtual-threads` · `webflux` | Maven profile `-Pvt` / `-Pwebflux` (build-arg `PARADIGM`) |
| Packaging | `jvm` · `native` | Dockerfile (`Dockerfile` vs `Dockerfile.native`); native adds `-Pnative` |

## How it is parametrized (no duplicated code between JVM/native)

- **Shared code** in `src/main/java` (domain + windowing math). It imports nothing from
  web/jdbc/r2dbc/kafka, so it compiles under any paradigm.
- **Per-paradigm code** in separate source sets, added by its profile via
  `build-helper-maven-plugin`:
  - `src/main/java-vt` → MVC (Tomcat) + JDBC, `spring.threads.virtual.enabled=true`.
  - `src/main/java-webflux` → Netty + R2DBC + reactor-kafka, 100% non-blocking.
- Activating `-Pwebflux` deactivates `vt` (which is `activeByDefault`) — Maven's rule —
  so two `main` classes / duplicate classes **never** coexist.
- The runtime spring profile (`vt`/`webflux`) is derived from the paradigm by the
  `ENTRYPOINT`, selecting `application-vt.yml` or `application-webflux.yml`.

## Manual build (no Docker)

```bash
# JVM, Virtual Threads
mvn -Pvt -DskipTests clean package && java -jar target/pulsegrid-spring.jar

# JVM, WebFlux
mvn -Pwebflux -DskipTests clean package

# Native (requires GraalVM 25 with native-image on the PATH)
mvn -Pvt,native      -DskipTests clean package   # -> target/pulsegrid-spring (binary)
mvn -Pwebflux,native -DskipTests clean package
```

## Build via Docker (what the runner does)

```bash
docker build -t pulsegrid/spring-vt-jvm        --build-arg PARADIGM=virtual-threads .
docker build -t pulsegrid/spring-webflux-jvm   --build-arg PARADIGM=webflux .
docker build -f Dockerfile.native -t pulsegrid/spring-vt-native      --build-arg PARADIGM=virtual-threads .
docker build -f Dockerfile.native -t pulsegrid/spring-webflux-native --build-arg PARADIGM=webflux .
```

## Rules for the reactive variant (WebFlux)

- Zero `.block()`, zero synchronous JDBC. Data over R2DBC, queue over reactor-kafka.
- The windowing (`io.pulsegrid.agg.Windower`) is pure, cheap CPU; it runs in
  `doOnSuccess` after the insert without blocking the event loop.

API and domain contract: see [../../docs/API.md](../../docs/API.md).
