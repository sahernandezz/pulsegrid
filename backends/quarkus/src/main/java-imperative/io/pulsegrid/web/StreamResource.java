package io.pulsegrid.web;

import io.pulsegrid.stream.AggregateBroadcaster;
import jakarta.inject.Inject;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.sse.Sse;
import jakarta.ws.rs.sse.SseEventSink;

/**
 * SSE stream of closed aggregations (classic JAX-RS SSE). Each request registers its
 * {@link SseEventSink} with the broadcaster; the scheduler does the push.
 */
@Path("/api/stream/aggregates")
public class StreamResource {

    @Inject
    AggregateBroadcaster broadcaster;

    @GET
    @Produces(MediaType.SERVER_SENT_EVENTS)
    public void stream(@Context Sse sse, @Context SseEventSink sink) {
        broadcaster.register(sse, sink);
    }
}
