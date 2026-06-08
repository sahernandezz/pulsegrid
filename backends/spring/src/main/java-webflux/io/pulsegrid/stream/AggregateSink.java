package io.pulsegrid.stream;

import io.pulsegrid.domain.MetricAggregate;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Sinks;

/**
 * Multicast sink of closed aggregates. The SSE stream exposes {@link #asFlux()};
 * the closing scheduler publishes via {@link #emit}. A natural fit for WebFlux:
 * a single hot {@code Flux} multiplexed to every SSE subscriber.
 */
@Component
public class AggregateSink {

    private final Sinks.Many<MetricAggregate> sink =
            Sinks.many().multicast().onBackpressureBuffer();

    public Flux<MetricAggregate> asFlux() {
        return sink.asFlux();
    }

    public void emit(MetricAggregate aggregate) {
        sink.tryEmitNext(aggregate);
    }
}
