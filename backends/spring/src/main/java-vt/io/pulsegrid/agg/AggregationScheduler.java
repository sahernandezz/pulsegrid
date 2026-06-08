package io.pulsegrid.agg;

import io.pulsegrid.domain.MetricAggregate;
import io.pulsegrid.persist.JdbcAggregateRepository;
import io.pulsegrid.stream.AggregateBroadcaster;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.List;

/**
 * Closes elapsed windows once per second, persists each aggregate and emits it over
 * SSE. A single scheduler thread is the consumer of the {@link Windower}.
 */
@Component
public class AggregationScheduler {

    private final Windower windower;
    private final JdbcAggregateRepository repository;
    private final AggregateBroadcaster broadcaster;

    public AggregationScheduler(Windower windower,
                                JdbcAggregateRepository repository,
                                AggregateBroadcaster broadcaster) {
        this.windower = windower;
        this.repository = repository;
        this.broadcaster = broadcaster;
    }

    @Scheduled(fixedDelay = 1000)
    public void flushClosedWindows() {
        List<MetricAggregate> closed = windower.closeElapsed(Instant.now());
        for (MetricAggregate aggregate : closed) {
            repository.upsert(aggregate);
            broadcaster.broadcast(aggregate);
        }
    }
}
