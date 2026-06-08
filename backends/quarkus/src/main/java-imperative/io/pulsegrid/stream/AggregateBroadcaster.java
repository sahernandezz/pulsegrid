package io.pulsegrid.stream;

import io.pulsegrid.domain.MetricAggregate;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.sse.OutboundSseEvent;
import jakarta.ws.rs.sse.Sse;
import jakarta.ws.rs.sse.SseBroadcaster;
import jakarta.ws.rs.sse.SseEventSink;

/**
 * Classic JAX-RS SSE broadcaster (Sse + SseBroadcaster). The closing scheduler pushes
 * each aggregate to every registered sink.
 */
@ApplicationScoped
public class AggregateBroadcaster {

    private volatile Sse sse;
    private volatile SseBroadcaster broadcaster;

    public synchronized void register(Sse sse, SseEventSink sink) {
        if (broadcaster == null) {
            this.sse = sse;
            this.broadcaster = sse.newBroadcaster();
        }
        broadcaster.register(sink);
    }

    public void broadcast(MetricAggregate aggregate) {
        SseBroadcaster b = broadcaster;
        Sse s = sse;
        if (b == null || s == null) {
            return;
        }
        OutboundSseEvent event = s.newEventBuilder()
                .name("aggregate")
                .mediaType(MediaType.APPLICATION_JSON_TYPE)
                .data(MetricAggregate.class, aggregate)
                .build();
        b.broadcast(event);
    }
}
