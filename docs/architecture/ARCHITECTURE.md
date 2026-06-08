# Architecture

## 1. System — three decoupled layers

Generating trustworthy data is separated from presenting it. Each variant runs in
isolation with dedicated resources; the runner produces an auditable consolidated file;
the frontend only reads it.

```mermaid
flowchart LR
    subgraph BE["Backends under test (Docker, parametrized)"]
        direction TB
        S["Spring Boot 4<br/>VT · WebFlux<br/>JVM · native"]
        Q["Quarkus<br/>reactive · imperative<br/>JVM · native"]
    end
    INFRA[("PostgreSQL<br/>+ Kafka (queue mode)")]
    R["Benchmark Runner<br/>(Python + k6)<br/>one variant at a time"]
    C["consolidated-results.json<br/>(median + stddev, env, raw k6)"]
    F["React frontend<br/>(static showcase)"]

    BE <--> INFRA
    R -- "compose up --profile X<br/>(identical res_limits)" --> BE
    R -- "k6 load · docker stats · cold start" --> BE
    R --> C
    C --> F

    classDef ev fill:#0e1521,stroke:#3ddc97,color:#e8eef6;
    classDef da fill:#0e1521,stroke:#7aa2ff,color:#e8eef6;
    class BE,R ev;
    class C,F,INFRA da;
```

- **Evidence** lives in the repo: every variant's source is auditable against the numbers.
- The runner is the **only** piece that touches Docker, k6 and runtime metrics.
- The frontend runs no tests and makes no live calls — it is a vitrine over the JSON.

## 2. Inside a variant — reactive vs imperative

Same API, same domain, same DB. The difference is how a request is carried.

```mermaid
flowchart TB
    subgraph IMP["Imperative · Virtual Threads (Spring VT) / @Blocking (Quarkus)"]
        direction LR
        i1["HTTP request"] --> i2["Controller<br/>(sequential, readable)"]
        i2 --> i3["JDBC / Hibernate<br/>BLOCKING call"]
        i3 --> i4[("PostgreSQL")]
        i2 -. "runs on a virtual / worker thread<br/>blocking is cheap" .- i2
    end

    subgraph RX["Reactive · WebFlux (Reactor) / Mutiny (Vert.x)"]
        direction LR
        r1["HTTP request"] --> r2["Handler<br/>Mono / Uni pipeline"]
        r2 --> r3["R2DBC / Vert.x PG<br/>NON-blocking"]
        r3 --> r4[("PostgreSQL")]
        r2 -. "event loop never blocks<br/>high throughput, more complex code" .- r2
    end

    classDef im fill:#0e1521,stroke:#4ff3b0,color:#e8eef6;
    classDef rx fill:#0e1521,stroke:#7aa2ff,color:#e8eef6;
    class i1,i2,i3,i4 im;
    class r1,r2,r3,r4 rx;
```

Aggregation is shared, framework-agnostic logic (`io.pulsegrid.agg.Windower`): 10s windows
per `(metricType, region)`, closed by a 1s scheduler, persisted (idempotent UPSERT) and
streamed over SSE. In the Quarkus reactive variant, closed windows are distributed to SSE
subscribers over the **Vert.x EventBus**.

## 3. The design space — concurrency × packaging

```mermaid
quadrantChart
    title Paradigm × packaging
    x-axis "Slow start, warms up (JVM)" --> "Fast start, no warm-up (native)"
    y-axis "Imperative / readable" --> "Reactive / high-throughput"
    quadrant-1 "Reactive native"
    quadrant-2 "Reactive JVM"
    quadrant-3 "Imperative JVM"
    quadrant-4 "Imperative native"
    "Spring VT · JVM": [0.22, 0.28]
    "Spring VT · native": [0.78, 0.28]
    "Spring WebFlux · JVM": [0.25, 0.80]
    "Spring WebFlux · native": [0.80, 0.80]
    "Quarkus reactive · JVM": [0.40, 0.74]
    "Quarkus reactive · native": [0.85, 0.74]
    "Quarkus imperative · JVM": [0.38, 0.34]
    "Quarkus imperative · native": [0.84, 0.34]
```

The fall-back reading if the quadrant chart does not render:

| | JVM | Native |
|---|-----|--------|
| **Virtual Threads** | Spring VT · JVM | Spring VT · native |
| **WebFlux (Reactor)** | Spring WebFlux · JVM | Spring WebFlux · native ⚠️ |
| **Reactive (Mutiny)** | Quarkus reactive · JVM | Quarkus reactive · native |
| **Imperative (blocking)** | Quarkus imperative · JVM | Quarkus imperative · native |

See [DECISIONS.md](DECISIONS.md) for the design decisions and [RISKS.md](RISKS.md) for the
known native-build risk.
