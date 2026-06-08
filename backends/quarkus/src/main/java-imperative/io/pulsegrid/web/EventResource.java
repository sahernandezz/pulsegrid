package io.pulsegrid.web;

import io.pulsegrid.domain.EventRequest;
import io.pulsegrid.domain.Responses;
import io.pulsegrid.ingest.EventStore;
import io.pulsegrid.ingest.KafkaIngest;
import io.smallrye.common.annotation.Blocking;
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
 * Imperative/blocking ingestion (@Blocking -> worker thread). Same contract:
 * 201 (http) / 202 (queue). Counterpoint to the same framework's reactive variant.
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
    @Blocking
    public Response ingest(@Valid EventRequest event) {
        if (queueMode()) {
            String id = kafka.publish(event);
            return Response.accepted(new Responses.AcceptedOne(id)).build();
        }
        Responses.StoredEvent stored = store.persist(event);
        return Response.status(Response.Status.CREATED).entity(stored).build();
    }

    @POST
    @Path("/batch")
    @Blocking
    public Response ingestBatch(@Valid List<EventRequest> events) {
        if (queueMode()) {
            long n = kafka.publishBatch(events);
            return Response.accepted(new Responses.AcceptedBatch(n)).build();
        }
        long n = store.persistBatch(events);
        return Response.status(Response.Status.CREATED).entity(new Responses.IngestedBatch(n)).build();
    }
}
