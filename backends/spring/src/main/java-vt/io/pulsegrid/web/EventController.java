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

import java.util.List;

/**
 * Event ingestion. The response depends on INGEST_MODE:
 *   http  -> persists synchronously and returns 201 with the resource.
 *   queue -> publishes to Kafka and returns 202 (a consumer persists later).
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
    public ResponseEntity<?> ingest(@Valid @RequestBody EventRequest event) {
        if (queueMode) {
            String id = publisher.getObject().publish(event);
            return ResponseEntity.accepted().body(new Responses.AcceptedOne(id));
        }
        Responses.StoredEvent stored = store.persist(event);
        return ResponseEntity.status(HttpStatus.CREATED).body(stored);
    }

    @PostMapping("/batch")
    public ResponseEntity<?> ingestBatch(@RequestBody List<@Valid EventRequest> events) {
        if (queueMode) {
            long n = publisher.getObject().publishBatch(events);
            return ResponseEntity.accepted().body(new Responses.AcceptedBatch(n));
        }
        long n = store.persistBatch(events);
        return ResponseEntity.status(HttpStatus.CREATED).body(new Responses.IngestedBatch(n));
    }
}
