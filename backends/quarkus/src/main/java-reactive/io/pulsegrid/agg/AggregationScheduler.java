package io.pulsegrid.agg;

import io.pulsegrid.domain.MetricAggregate;
import io.pulsegrid.persist.PgAggregateRepository;
import io.pulsegrid.stream.AggregateJson;
import io.quarkus.scheduler.Scheduled;
import io.smallrye.mutiny.Uni;
import io.vertx.mutiny.core.eventbus.EventBus;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

import java.time.Instant;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Closes elapsed windows every second; persists each aggregate (reactive) and publishes
 * it to the Vert.x EventBus. The SSE stream consumes that address — so subscriber
 * distribution goes through the EventBus (the design's direct Vert.x touch point).
 */
@ApplicationScoped
public class AggregationScheduler {

    /** EventBus address where closed windows are published. */
    public static final String ADDRESS = "pulsegrid.aggregate.closed";

    @Inject
    Windower windower;

    @Inject
    PgAggregateRepository repository;

    @Inject
    EventBus eventBus;

    @Scheduled(every = "1s")
    public Uni<Void> flushClosedWindows() {
        List<MetricAggregate> closed = windower.closeElapsed(Instant.now());
        if (closed.isEmpty()) {
            return Uni.createFrom().voidItem();
        }
        List<Uni<Void>> writes = closed.stream()
                .map(a -> repository.upsert(a)
                        .invoke(() -> eventBus.publish(ADDRESS, AggregateJson.toJson(a))))
                .collect(Collectors.toList());
        return Uni.join().all(writes).andCollectFailures().replaceWithVoid();
    }
}
