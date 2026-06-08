package io.pulsegrid.domain;

/**
 * Type of ingested metric. Identical across all variants and aligned with the
 * CHECK constraint on the {@code metric_events} table (see db/migrations).
 */
public enum MetricType {
    CPU,
    MEMORY,
    TEMPERATURE,
    LATENCY
}
