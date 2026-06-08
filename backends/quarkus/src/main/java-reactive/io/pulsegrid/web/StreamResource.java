package io.pulsegrid.web;

import io.pulsegrid.agg.AggregationScheduler;
import io.pulsegrid.domain.MetricAggregate;
import io.pulsegrid.stream.AggregateJson;
import io.smallrye.mutiny.Multi;
import io.vertx.core.json.JsonObject;
import io.vertx.mutiny.core.eventbus.EventBus;
import jakarta.inject.Inject;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import org.jboss.resteasy.reactive.RestStreamElementType;

/**
 * SSE stream of closed aggregations, consuming the Vert.x EventBus. Each SSE subscriber
 * registers a consumer on the address; the scheduler calls {@code publish} and all of
 * them receive it (natural fan-out).
 */
@Path("/api/stream/aggregates")
public class StreamResource {

    @Inject
    EventBus eventBus;

    @GET
    @Produces(MediaType.SERVER_SENT_EVENTS)
    @RestStreamElementType(MediaType.APPLICATION_JSON)
    public Multi<MetricAggregate> stream() {
        return eventBus.<JsonObject>consumer(AggregationScheduler.ADDRESS)
                .toMulti()
                .map(message -> AggregateJson.fromJson(message.body()));
    }
}
