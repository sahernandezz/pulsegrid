package io.pulsegrid.persist;

import io.pulsegrid.agg.Windower;
import io.pulsegrid.domain.EventRequest;
import io.pulsegrid.domain.Responses;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.time.Instant;
import java.util.UUID;

/**
 * Persistence + feeding the aggregator, reactive. Used by the controller (http mode)
 * and by the reactor-kafka consumer (queue mode) — same domain logic. The
 * {@code windower.ingest} is pure, cheap CPU; it runs in {@code doOnSuccess} after
 * the insert, without blocking the event loop.
 */
@Service
public class EventStore {

    private final R2dbcEventRepository events;
    private final Windower windower;

    public EventStore(R2dbcEventRepository events, Windower windower) {
        this.events = events;
        this.windower = windower;
    }

    public Mono<Responses.StoredEvent> persist(EventRequest e) {
        UUID id = UUID.randomUUID();
        Instant ingestedAt = Instant.now();
        return events.insert(id, e, ingestedAt)
                .doOnSuccess(rows -> windower.ingest(e.metricType(), e.region(), e.value(), e.timestamp()))
                .thenReturn(new Responses.StoredEvent(
                        id.toString(), e.deviceId(), e.metricType(),
                        e.value(), e.timestamp(), e.region(), ingestedAt));
    }

    /** Used by the Kafka consumer: keeps the id generated at enqueue time. */
    public Mono<Void> persistWithId(UUID id, EventRequest e) {
        return events.insert(id, e, Instant.now())
                .doOnSuccess(rows -> windower.ingest(e.metricType(), e.region(), e.value(), e.timestamp()))
                .then();
    }

    public Mono<Long> persistBatch(Flux<EventRequest> batch) {
        return batch.flatMap(e -> events.insert(UUID.randomUUID(), e, Instant.now())
                        .doOnSuccess(rows -> windower.ingest(e.metricType(), e.region(), e.value(), e.timestamp())))
                .count();
    }
}
