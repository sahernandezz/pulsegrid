package io.pulsegrid.web;

import io.pulsegrid.domain.EventRequest;
import io.pulsegrid.domain.Responses;
import io.pulsegrid.ingest.EventPublisher;
import io.pulsegrid.persist.EventStore;
import jakarta.validation.Valid;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

/**
 * Reactive ingestion. Same contract as the VT variant: 201 (http) / 202 (queue).
 */
@RestController
@RequestMapping("/api/events")
public class EventController {

    private final EventStore store;
    private final ObjectProvider<EventPublisher> publisher;
    private final boolean queueMode;

    public EventController(EventStore store,
                           ObjectProvider<EventPublisher> publisher,
                           @Value("${pulsegrid.ingest-mode:http}") String ingestMode) {
        this.store = store;
        this.publisher = publisher;
        this.queueMode = "queue".equalsIgnoreCase(ingestMode);
    }

    @PostMapping
    public Mono<ResponseEntity<Object>> ingest(@Valid @RequestBody EventRequest event) {
        if (queueMode) {
            return publisher.getObject().publish(event)
                    .map(id -> ResponseEntity.accepted().body((Object) new Responses.AcceptedOne(id)));
        }
        return store.persist(event)
                .map(stored -> ResponseEntity.status(HttpStatus.CREATED).body((Object) stored));
    }

    @PostMapping("/batch")
    public Mono<ResponseEntity<Object>> ingestBatch(@RequestBody Flux<EventRequest> events) {
        if (queueMode) {
            return publisher.getObject().publishBatch(events)
                    .map(n -> ResponseEntity.accepted().body((Object) new Responses.AcceptedBatch(n)));
        }
        return store.persistBatch(events)
                .map(n -> ResponseEntity.status(HttpStatus.CREATED).body((Object) new Responses.IngestedBatch(n)));
    }
}
