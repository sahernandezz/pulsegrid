# PulseGrid — API contract (identical across ALL variants)

> This document is **normative**. All 8 variants (Spring VT/WebFlux × JVM/native,
> Quarkus reactive/imperative × JVM/native) must implement **byte-for-byte equivalent**
> request/response shapes so the same load script (k6) works for all of them. If you
> change something here, change it in all of them.

Internal port: **8080** (same for all). Content-Type: `application/json`.

## Domain

### `MetricEvent` (input)
```json
{
  "deviceId": "dev-0007",
  "metricType": "CPU",
  "value": 42.7,
  "timestamp": "2026-06-02T12:00:00Z",
  "region": "us-east"
}
```
`metricType` ∈ `CPU | MEMORY | TEMPERATURE | LATENCY`. `timestamp` ISO-8601 UTC.
`id` and `ingestedAt` are assigned by the server.

### `MetricAggregate` (output, 10s window)
```json
{
  "metricType": "CPU",
  "region": "us-east",
  "windowStart": "2026-06-02T12:00:00Z",
  "windowEnd":   "2026-06-02T12:00:10Z",
  "count": 1280,
  "min": 0.4,
  "max": 99.8,
  "avg": 51.2,
  "p95": 93.1
}
```

## Endpoints

| Method | Path | http mode | queue mode |
|--------|------|-----------|------------|
| `POST` | `/api/events` | `201` + persisted event (with `id`,`ingestedAt`) | `202` + `{"accepted":true,"id":"<uuid>"}` |
| `POST` | `/api/events/batch` | `201` + `{"ingested": N}` | `202` + `{"accepted":true,"count": N}` |
| `GET`  | `/api/aggregates?metricType=&region=` | `200` + `[MetricAggregate]` (both filters optional) | same |
| `GET`  | `/api/stream/aggregates` | `200` SSE, each `data:` is a `MetricAggregate` JSON | same |
| `GET`  | `/health` | `200` simple liveness (used by the compose healthcheck) | same |
| `GET`  | framework health | `/actuator/health` (Spring) · `/q/health` (Quarkus) | same |
| `GET`  | Prometheus metrics | `/actuator/prometheus` (Spring) · `/q/metrics` (Quarkus) | same |

### Contract notes
- **`/health`** is a trivial endpoint (text/JSON `{"status":"UP"}`) present in both stacks
  because the `docker-compose` healthcheck runs `wget http://localhost:8080/health`. It is
  independent of the framework's richer health.
- **Ingestion mode** (`INGEST_MODE`): in `http`, `POST /api/events` persists synchronously
  and returns the created resource; in `queue`, the backend publishes to Kafka
  (`KAFKA_TOPIC`) and returns immediately (`202`), and an internal consumer persists later.
  The **response differs by mode on purpose** (synchronous vs asynchronous); but for a
  given mode, all variants respond identically.
- **Aggregation**: each backend keeps 10s in-memory windows per `(metricType, region)`;
  when a window closes it computes `count/min/max/avg/p95`, persists it to
  `metric_aggregates` (idempotent UPSERT) and emits it on the SSE stream.
- **Errors**: `400` for invalid payloads (unknown `metricType`, missing fields),
  `200/201/202` on success. The under-load error rate is measured against this.
