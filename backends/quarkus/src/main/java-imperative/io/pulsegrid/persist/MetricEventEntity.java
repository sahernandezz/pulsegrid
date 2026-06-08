package io.pulsegrid.persist;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

/**
 * JPA entity mapped to {@code metric_events} (db/migrations schema). Blocking Hibernate
 * ORM: the imperative counterpoint to the reactive variant (which uses the Vert.x PG
 * client with no entities). Panache active record for a readable insert.
 */
@Entity
@Table(name = "metric_events")
public class MetricEventEntity extends PanacheEntityBase {

    @Id
    public UUID id;

    @Column(name = "device_id", nullable = false)
    public String deviceId;

    @Column(name = "metric_type", nullable = false)
    public String metricType;

    @Column(name = "metric_value", nullable = false)
    public double value;

    @Column(name = "event_ts", nullable = false)
    public Instant timestamp;

    @Column(name = "region", nullable = false)
    public String region;

    @Column(name = "ingested_at", nullable = false)
    public Instant ingestedAt;
}
