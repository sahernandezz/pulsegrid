package io.pulsegrid.persist;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

/** JPA entity mapped to {@code metric_aggregates}. */
@Entity
@Table(name = "metric_aggregates")
public class MetricAggregateEntity extends PanacheEntityBase {

    @Id
    public UUID id;

    @Column(name = "metric_type", nullable = false)
    public String metricType;

    @Column(name = "region", nullable = false)
    public String region;

    @Column(name = "window_start", nullable = false)
    public Instant windowStart;

    @Column(name = "window_end", nullable = false)
    public Instant windowEnd;

    @Column(name = "sample_count", nullable = false)
    public long sampleCount;

    @Column(name = "min_value", nullable = false)
    public double minValue;

    @Column(name = "max_value", nullable = false)
    public double maxValue;

    @Column(name = "avg_value", nullable = false)
    public double avgValue;

    @Column(name = "p95_value", nullable = false)
    public double p95Value;
}
