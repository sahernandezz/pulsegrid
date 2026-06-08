package io.pulsegrid.persist;

import io.pulsegrid.agg.Windower;
import io.pulsegrid.domain.EventRequest;
import io.pulsegrid.domain.Responses;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Single point for persistence + feeding the aggregator. Used both by the controller
 * (http mode, synchronous) and by the Kafka consumer (queue mode), so the domain
 * logic is identical regardless of how the event arrived.
 */
@Service
public class EventStore {

    private final JdbcEventRepository events;
    private final Windower windower;

    public EventStore(JdbcEventRepository events, Windower windower) {
        this.events = events;
        this.windower = windower;
    }

    public Responses.StoredEvent persist(EventRequest e) {
        UUID id = UUID.randomUUID();
        Instant ingestedAt = Instant.now();
        events.insert(id, e, ingestedAt);
        windower.ingest(e.metricType(), e.region(), e.value(), e.timestamp());
        return new Responses.StoredEvent(
                id.toString(), e.deviceId(), e.metricType(),
                e.value(), e.timestamp(), e.region(), ingestedAt);
    }

    /** Used by the Kafka consumer: keeps the id generated at enqueue time. */
    public void persistWithId(UUID id, EventRequest e) {
        events.insert(id, e, Instant.now());
        windower.ingest(e.metricType(), e.region(), e.value(), e.timestamp());
    }

    public long persistBatch(List<EventRequest> batch) {
        long n = events.insertBatch(batch);
        for (EventRequest e : batch) {
            windower.ingest(e.metricType(), e.region(), e.value(), e.timestamp());
        }
        return n;
    }
}
