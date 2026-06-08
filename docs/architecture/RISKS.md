# Known risks & how they are handled

## R1 — Spring WebFlux + GraalVM native (the highest-risk variant)

Native compilation of a reactive Spring/WebFlux app is the hardest build in the matrix.
Reactor's heavy use of reflection and the AOT processing of reactive pipelines can require
extra hints that are not always inferred:

- `@RegisterReflectionForBinding` for DTOs (de)serialized reactively,
- a `RuntimeHintsRegistrar` for reflection / resources / proxies,
- occasionally `--initialize-at-build-time` / `--initialize-at-run-time` tuning.

**Mitigations already applied** (see `backends/spring/pom.xml`, the `native` profile):
`--no-fallback`, `-H:+ReportExceptionStackTraces`, and the GraalVM
`add-reachability-metadata` goal so published reachability metadata is picked up.

**What actually happened (measured).** The native image **builds fine**. Two runtime issues
surfaced, only one fatal:

1. **AOT is profile-sensitive** — building with the default profile left the `webflux` config
   out, so it failed at startup with *"Failed to determine a suitable R2DBC Connection URL"*.
   **Fixed** by processing AOT with the active profile
   (`<profiles>${pulsegrid.activeProfile}</profiles>` on the `process-aot` execution). It now
   **starts** (health 200).
2. **R2DBC inserts failed at runtime (HTTP 500)** on the native image — a reflection/codec
   gap in the `r2dbc-postgresql` native path not covered by the published reachability
   metadata. The read path the load test exercises binds no parameters, so it worked; every
   INSERT/UPSERT binds a value per column and hit the gap.
   **Fix applied:** a dedicated `RuntimeHintsRegistrar`
   ([`R2dbcNativeHints`](../../backends/spring/src/main/java-webflux/io/pulsegrid/config/R2dbcNativeHints.java))
   registers reflection for the bound JDK types (`UUID`, `OffsetDateTime`, `Instant`,
   numerics, `String`) and the `r2dbc-postgresql` scalar codec classes, closing the
   bind/encode surface. *Status: implemented and JVM-verified; the `supported` flag stays
   `false` until the native benchmark is re-run on a GraalVM host — we do not flip it without
   a real measurement.*

So the honest finding is narrower and more useful than "WebFlux native is broken": *it builds
and boots; the remaining gap was native R2DBC reflection hints, now registered.* We never
fabricate the data — the flag flips only when a re-run measures success. (Full analysis in
[FINDINGS.md](FINDINGS.md).)

## R1b — Spring native queue mode (single binary, both ingest modes)

Spring AOT evaluates `@Conditional` at **build** time. The queue beans (`EventPublisher`,
the Kafka consumer, `KafkaSupportConfig`/`KafkaConfig`) were gated by
`@ConditionalOnProperty(pulsegrid.ingest-mode=queue)`, so an http-built native image pruned
them and the binary could never serve queue mode — whereas Quarkus switches at runtime from
one binary.

**Fix applied:** the conditions were removed; the beans are now always present (and lazy — no
broker connection until used), and the http/queue decision is deferred to **runtime**:

- the producer is only invoked by the controller in queue mode,
- the VT consumer's `@KafkaListener` gets `autoStartup` from a SpEL read of
  `pulsegrid.ingest-mode` (container starts only in queue mode),
- the WebFlux consumer subscribes the receiver only in queue mode (mirrors how Quarkus gates
  its consumer on `StartupEvent`).

One binary now serves both modes, JVM and native alike, with no broker contact in http mode.
*Status: implemented and JVM-verified; `supported` for `spring-*-native` queue rows flips only
after a native re-run.*

## R2 — Native builds in general

Native images can fail or misbehave at runtime (not just build time) due to reflection,
dynamic proxies, resource loading, or build-time class initialization. Same posture: the
runner's health-check gate catches a variant that builds but never serves `200`, and marks
it unsupported with the reason rather than reporting empty/zero metrics.

## R3 — Quarkus native toolchain

Quarkus native is generally robust (it is AOT-first by design), but the build needs
GraalVM/**Mandrel** matching the JDK. The provided `Dockerfile.native` uses a GraalVM
community image; for production-grade Quarkus native, Mandrel is the recommended builder
(`-Dquarkus.native.builder-image=mandrel`). Both reactive and imperative variants are
expected to build; if a toolchain mismatch breaks one, it is marked unsupported like any other.

## R4 — Image tags / toolchain drift

The Dockerfiles pin base images (`eclipse-temurin:25-*`, `ghcr.io/graalvm/native-image-community:25`,
`maven:3.9.9-eclipse-temurin-21`). If a tag is not published for the exact JDK in use, swap
the one line and rebuild — the architecture does not depend on a specific tag. Noted inline
in each Dockerfile.

## R5 — Measurement validity

The single biggest risk to credibility is unequal conditions. Guarded by: identical
`&res_limits` for every variant, container-aware JVM heap, warm-up discarded, ≥3 runs,
one-variant-at-a-time, and `docker stats` verification of the limits during the run. See
[../METHODOLOGY.md](../METHODOLOGY.md).
