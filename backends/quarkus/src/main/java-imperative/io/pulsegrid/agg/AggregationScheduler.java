package io.pulsegrid.agg;

import io.pulsegrid.domain.MetricAggregate;
import io.pulsegrid.persist.AggregateRepository;
import io.pulsegrid.stream.AggregateBroadcaster;
import io.quarkus.scheduler.Scheduled;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

import java.time.Instant;
import java.util.List;

/**
 * Closes elapsed windows every second, persists each aggregate (blocking,
 * @Transactional in the repo) and emits it over SSE. Runs on a scheduler thread.
 */
@ApplicationScoped
public class AggregationScheduler {

    @Inject
    Windower windower;

    @Inject
    AggregateRepository repository;

    @Inject
    AggregateBroadcaster broadcaster;

    @Scheduled(every = "1s")
    void flushClosedWindows() {
        List<MetricAggregate> closed = windower.closeElapsed(Instant.now());
        for (MetricAggregate aggregate : closed) {
            repository.upsert(aggregate);
            broadcaster.broadcast(aggregate);
        }
    }
}
