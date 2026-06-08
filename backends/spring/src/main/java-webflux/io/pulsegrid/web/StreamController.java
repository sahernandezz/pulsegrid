package io.pulsegrid.web;

import io.pulsegrid.domain.MetricAggregate;
import io.pulsegrid.stream.AggregateSink;
import org.springframework.http.MediaType;
import org.springframework.http.codec.ServerSentEvent;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Flux;

/**
 * SSE stream of closed aggregations, fed by the {@link AggregateSink}. Idiomatic in
 * WebFlux: a hot {@code Flux} multiplexed to each subscriber.
 */
@RestController
public class StreamController {

    private final AggregateSink sink;

    public StreamController(AggregateSink sink) {
        this.sink = sink;
    }

    @GetMapping(value = "/api/stream/aggregates", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public Flux<ServerSentEvent<MetricAggregate>> stream() {
        return sink.asFlux()
                .map(aggregate -> ServerSentEvent.builder(aggregate).event("aggregate").build());
    }
}
