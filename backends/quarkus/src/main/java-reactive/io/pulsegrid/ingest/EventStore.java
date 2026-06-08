package io.pulsegrid.ingest;

import io.pulsegrid.agg.Windower;
import io.pulsegrid.domain.EventRequest;
import io.pulsegrid.domain.Responses;
import io.pulsegrid.persist.PgEventRepository;
import io.smallrye.mutiny.Uni;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Persistence + feeding the aggregator, reactive (Mutiny). Used by the HTTP resource
 * and the Kafka consumer — same domain logic. The {@code windower.ingest} is cheap CPU
 * and runs in {@code invoke} after the insert, without blocking the event loop.
 */
@ApplicationScoped
public class EventStore {

    @Inject
    PgEventRepository events;

    @Inject
    Windower windower;

    public Uni<Responses.StoredEvent> persist(EventRequest e) {
        UUID id = UUID.randomUUID();
        Instant ingestedAt = Instant.now();
        return events.insert(id, e, ingestedAt)
                .invoke(() -> windower.ingest(e.metricType(), e.region(), e.value(), e.timestamp()))
                .map(ignored -> new Responses.StoredEvent(
                        id.toString(), e.deviceId(), e.metricType(),
                        e.value(), e.timestamp(), e.region(), ingestedAt));
    }

    /** Used by the Kafka consumer: keeps the id generated at enqueue time. */
    public Uni<Void> persistWithId(UUID id, EventRequest e) {
        return events.insert(id, e, Instant.now())
                .invoke(() -> windower.ingest(e.metricType(), e.region(), e.value(), e.timestamp()));
    }

    public Uni<Long> persistBatch(List<EventRequest> batch) {
        List<Uni<Void>> inserts = new ArrayList<>(batch.size());
        for (EventRequest e : batch) {
            UUID id = UUID.randomUUID();
            inserts.add(events.insert(id, e, Instant.now())
                    .invoke(() -> windower.ingest(e.metricType(), e.region(), e.value(), e.timestamp())));
        }
        return Uni.join().all(inserts).andCollectFailures().replaceWith((long) batch.size());
    }
}
