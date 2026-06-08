package io.pulsegrid.agg;

import io.pulsegrid.domain.MetricType;

import java.time.Instant;

/** Aggregation window key: (type, region, window start aligned to 10s). */
public record WindowKey(MetricType metricType, String region, Instant windowStart) {
}
