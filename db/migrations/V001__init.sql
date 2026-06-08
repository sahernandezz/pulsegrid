-- =============================================================================
-- PulseGrid — database schema (SINGLE SOURCE OF TRUTH)
-- =============================================================================
-- This file is mounted into the postgres container under
--   /docker-entrypoint-initdb.d/
-- and runs ONCE when the data volume is initialized. It is identical for ALL
-- variants (Spring VT/WebFlux, Quarkus reactive/imperative), so the schema is
-- byte-for-byte the same on every run.
--
-- IMPORTANT: the applications do NOT create or mutate the schema. Each backend is
-- configured with DDL = none / validate (Hibernate) and never create-drop, so the
-- only table definition lives here. That keeps the comparison fair: same tables,
-- same indexes, same types for everyone.
--
-- Naming: snake_case columns; each backend's entities map these names to the domain
-- fields (value, timestamp) and to the API JSON. Reserved words (`value`, `timestamp`)
-- are avoided using metric_value / event_ts for maximum portability across JDBC,
-- R2DBC and the Vert.x PG client.
-- =============================================================================

-- pgcrypto provides gen_random_uuid(); usually bundled as 'pgcrypto' on PG 13+.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- --- Raw metric events ------------------------------------------------------
CREATE TABLE IF NOT EXISTS metric_events (
    id           UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id    VARCHAR(128)     NOT NULL,
    metric_type  VARCHAR(16)      NOT NULL
                 CONSTRAINT chk_metric_type
                 CHECK (metric_type IN ('CPU', 'MEMORY', 'TEMPERATURE', 'LATENCY')),
    metric_value DOUBLE PRECISION NOT NULL,
    event_ts     TIMESTAMPTZ      NOT NULL,
    region       VARCHAR(64)      NOT NULL,
    ingested_at  TIMESTAMPTZ      NOT NULL DEFAULT now()
);

-- Index for the aggregate query by (type, region) and time window.
CREATE INDEX IF NOT EXISTS idx_metric_events_type_region_ts
    ON metric_events (metric_type, region, event_ts);

-- --- 10s window aggregates (closed windows) ---------------------------------
CREATE TABLE IF NOT EXISTS metric_aggregates (
    id            UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
    metric_type   VARCHAR(16)      NOT NULL,
    region        VARCHAR(64)      NOT NULL,
    window_start  TIMESTAMPTZ      NOT NULL,
    window_end    TIMESTAMPTZ      NOT NULL,
    sample_count  BIGINT           NOT NULL,
    min_value     DOUBLE PRECISION NOT NULL,
    max_value     DOUBLE PRECISION NOT NULL,
    avg_value     DOUBLE PRECISION NOT NULL,
    p95_value     DOUBLE PRECISION NOT NULL,
    created_at    TIMESTAMPTZ      NOT NULL DEFAULT now(),
    -- A closed window is unique per (type, region, window start). Enables an
    -- idempotent UPSERT if two consumers close the same window.
    CONSTRAINT uq_aggregate_window UNIQUE (metric_type, region, window_start)
);

CREATE INDEX IF NOT EXISTS idx_metric_aggregates_type_region
    ON metric_aggregates (metric_type, region, window_start DESC);
