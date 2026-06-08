package io.pulsegrid.persist;

import io.pulsegrid.domain.EventRequest;
import io.smallrye.mutiny.Uni;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Tuple;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

import java.time.Instant;
import java.time.ZoneOffset;
import java.util.UUID;

/**
 * Reactive event persistence with the Vert.x PG client (Mutiny). Non-blocking: each
 * insert is a {@code Uni}. PG positional placeholders {@code $n}.
 */
@ApplicationScoped
public class PgEventRepository {

    private static final String INSERT = """
            INSERT INTO metric_events
                (id, device_id, metric_type, metric_value, event_ts, region, ingested_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            """;

    @Inject
    Pool client;

    public Uni<Void> insert(UUID id, EventRequest e, Instant ingestedAt) {
        // Vert.x Tuple.of() supports up to 6 args; chain addValue() for the rest.
        return client.preparedQuery(INSERT)
                .execute(Tuple.of(
                                id,
                                e.deviceId(),
                                e.metricType().name(),
                                e.value(),
                                e.timestamp().atOffset(ZoneOffset.UTC),
                                e.region())
                        .addValue(ingestedAt.atOffset(ZoneOffset.UTC)))
                .replaceWithVoid();
    }
}
