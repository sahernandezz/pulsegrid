package io.pulsegrid.agg;

import io.pulsegrid.domain.MetricAggregate;
import io.pulsegrid.persist.R2dbcAggregateRepository;
import io.pulsegrid.stream.AggregateSink;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Flux;

import java.time.Instant;
import java.util.List;

/**
 * Closes elapsed windows once per second and, reactively, persists each aggregate
 * and emits it to the SSE sink. The flush is a background job (not on the request
 * path); it is subscribed explicitly.
 */
@Component
public class AggregationScheduler {

    private final Windower windower;
    private final R2dbcAggregateRepository repository;
    private final AggregateSink sink;

    public AggregationScheduler(Windower windower,
                                R2dbcAggregateRepository repository,
                                AggregateSink sink) {
        this.windower = windower;
        this.repository = repository;
        this.sink = sink;
    }

    @Scheduled(fixedDelay = 1000)
    public void flushClosedWindows() {
        List<MetricAggregate> closed = windower.closeElapsed(Instant.now());
        if (closed.isEmpty()) {
            return;
        }
        Flux.fromIterable(closed)
                .concatMap(aggregate -> repository.upsert(aggregate).thenReturn(aggregate))
                .doOnNext(sink::emit)
                .subscribe();
    }
}
