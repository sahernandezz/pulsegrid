package io.pulsegrid.web;

import io.pulsegrid.domain.EventRequest;
import io.pulsegrid.domain.Responses;
import io.pulsegrid.ingest.EventStore;
import io.pulsegrid.ingest.KafkaIngest;
import io.smallrye.mutiny.Uni;
import jakarta.inject.Inject;
import jakarta.validation.Valid;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.config.inject.ConfigProperty;

import java.util.List;

/**
 * Reactive ingestion (Mutiny). Same contract as the other variants:
 * 201 (http, persisted) / 202 (queue, enqueued in Kafka).
 */
@Path("/api/events")
@Consumes(MediaType.APPLICATION_JSON)
@Produces(MediaType.APPLICATION_JSON)
public class EventResource {

    @Inject
    EventStore store;

    @Inject
    KafkaIngest kafka;

    @ConfigProperty(name = "pulsegrid.ingest-mode", defaultValue = "http")
    String ingestMode;

    private boolean queueMode() {
        return "queue".equalsIgnoreCase(ingestMode);
    }

    @POST
    public Uni<Response> ingest(@Valid EventRequest event) {
        if (queueMode()) {
            return kafka.publish(event)
                    .map(id -> Response.accepted(new Responses.AcceptedOne(id)).build());
        }
        return store.persist(event)
                .map(stored -> Response.status(Response.Status.CREATED).entity(stored).build());
    }

    @POST
    @Path("/batch")
    public Uni<Response> ingestBatch(@Valid List<EventRequest> events) {
        if (queueMode()) {
            return kafka.publishBatch(events)
                    .map(n -> Response.accepted(new Responses.AcceptedBatch(n)).build());
        }
        return store.persistBatch(events)
                .map(n -> Response.status(Response.Status.CREATED).entity(new Responses.IngestedBatch(n)).build());
    }
}
