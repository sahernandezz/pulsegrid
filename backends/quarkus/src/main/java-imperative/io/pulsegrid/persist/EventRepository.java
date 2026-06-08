package io.pulsegrid.persist;

import io.pulsegrid.domain.EventRequest;
import jakarta.enterprise.context.ApplicationScoped;

import java.time.Instant;
import java.util.UUID;

/**
 * Blocking event insertion via Hibernate ORM (Panache). The caller provides the
 * transactional context (@Transactional on {@link io.pulsegrid.ingest.EventStore}).
 */
@ApplicationScoped
public class EventRepository {

    public void insert(UUID id, EventRequest e, Instant ingestedAt) {
        MetricEventEntity m = new MetricEventEntity();
        m.id = id;
        m.deviceId = e.deviceId();
        m.metricType = e.metricType().name();
        m.value = e.value();
        m.timestamp = e.timestamp();
        m.region = e.region();
        m.ingestedAt = ingestedAt;
        m.persist();
    }
}
