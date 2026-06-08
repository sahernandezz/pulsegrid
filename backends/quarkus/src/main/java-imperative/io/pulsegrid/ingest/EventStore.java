package io.pulsegrid.ingest;

import io.pulsegrid.agg.Windower;
import io.pulsegrid.domain.EventRequest;
import io.pulsegrid.domain.Responses;
import io.pulsegrid.persist.EventRepository;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Persistence + feeding the aggregator, blocking (@Transactional). Used by the HTTP
 * resource and the Kafka consumer — same domain logic.
 */
@ApplicationScoped
public class EventStore {

    @Inject
    EventRepository events;

    @Inject
    Windower windower;

    @Transactional
    public Responses.StoredEvent persist(EventRequest e) {
        UUID id = UUID.randomUUID();
        Instant ingestedAt = Instant.now();
        events.insert(id, e, ingestedAt);
        windower.ingest(e.metricType(), e.region(), e.value(), e.timestamp());
        return new Responses.StoredEvent(
                id.toString(), e.deviceId(), e.metricType(),
                e.value(), e.timestamp(), e.region(), ingestedAt);
    }

    @Transactional
    public void persistWithId(UUID id, EventRequest e) {
        events.insert(id, e, Instant.now());
        windower.ingest(e.metricType(), e.region(), e.value(), e.timestamp());
    }

    @Transactional
    public long persistBatch(List<EventRequest> batch) {
        for (EventRequest e : batch) {
            events.insert(UUID.randomUUID(), e, Instant.now());
            windower.ingest(e.metricType(), e.region(), e.value(), e.timestamp());
        }
        return batch.size();
    }
}
