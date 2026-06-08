package io.pulsegrid.domain;

import java.time.Instant;

/**
 * Aggregate of one closed 10s window for a (metricType, region) pair. It is the
 * output of {@code GET /api/aggregates} and of the SSE stream, and the row stored
 * in {@code metric_aggregates}.
 */
public record MetricAggregate(
        MetricType metricType,
        String region,
        Instant windowStart,
        Instant windowEnd,
        long count,
        double min,
        double max,
        double avg,
        double p95
) {
}
