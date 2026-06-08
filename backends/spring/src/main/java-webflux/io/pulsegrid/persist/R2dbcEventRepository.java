package io.pulsegrid.persist;

import io.pulsegrid.domain.EventRequest;
import org.springframework.r2dbc.core.DatabaseClient;
import org.springframework.stereotype.Repository;
import reactor.core.publisher.Mono;

import java.time.Instant;
import java.time.ZoneOffset;
import java.util.UUID;

/**
 * Reactive event persistence via R2DBC (non-blocking PG driver). Each insert
 * returns a {@code Mono} — the event loop is never blocked.
 */
@Repository
public class R2dbcEventRepository {

    private static final String INSERT = """
            INSERT INTO metric_events
                (id, device_id, metric_type, metric_value, event_ts, region, ingested_at)
            VALUES (:id, :deviceId, :metricType, :value, :ts, :region, :ingestedAt)
            """;

    private final DatabaseClient db;

    public R2dbcEventRepository(DatabaseClient db) {
        this.db = db;
    }

    public Mono<Long> insert(UUID id, EventRequest e, Instant ingestedAt) {
        return db.sql(INSERT)
                .bind("id", id)
                .bind("deviceId", e.deviceId())
                .bind("metricType", e.metricType().name())
                .bind("value", e.value())
                .bind("ts", e.timestamp().atOffset(ZoneOffset.UTC))
                .bind("region", e.region())
                .bind("ingestedAt", ingestedAt.atOffset(ZoneOffset.UTC))
                .fetch()
                .rowsUpdated();
    }
}
