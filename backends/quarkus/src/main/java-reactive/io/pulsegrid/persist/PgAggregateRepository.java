package io.pulsegrid.persist;

import io.pulsegrid.domain.MetricAggregate;
import io.pulsegrid.domain.MetricType;
import io.smallrye.mutiny.Uni;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Row;
import io.vertx.mutiny.sqlclient.Tuple;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Reactive persistence and querying of windowed aggregates (Vert.x PG, Mutiny).
 * Idempotent UPSERT on (metric_type, region, window_start).
 */
@ApplicationScoped
public class PgAggregateRepository {

    private static final String UPSERT = """
            INSERT INTO metric_aggregates
                (id, metric_type, region, window_start, window_end,
                 sample_count, min_value, max_value, avg_value, p95_value)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            ON CONFLICT (metric_type, region, window_start) DO UPDATE SET
                window_end   = EXCLUDED.window_end,
                sample_count = EXCLUDED.sample_count,
                min_value    = EXCLUDED.min_value,
                max_value    = EXCLUDED.max_value,
                avg_value    = EXCLUDED.avg_value,
                p95_value    = EXCLUDED.p95_value
            """;

    private static final String QUERY = """
            SELECT metric_type, region, window_start, window_end,
                   sample_count, min_value, max_value, avg_value, p95_value
            FROM metric_aggregates
            WHERE ($1::varchar IS NULL OR metric_type = $1)
              AND ($2::varchar IS NULL OR region = $2)
            ORDER BY window_start DESC
            LIMIT 500
            """;

    @Inject
    Pool client;

    public Uni<Void> upsert(MetricAggregate a) {
        // Vert.x Tuple.of() supports up to 6 args; chain addValue() for the rest.
        return client.preparedQuery(UPSERT)
                .execute(Tuple.of(
                                UUID.randomUUID(),
                                a.metricType().name(),
                                a.region(),
                                a.windowStart().atOffset(ZoneOffset.UTC),
                                a.windowEnd().atOffset(ZoneOffset.UTC),
                                a.count())
                        .addValue(a.min())
                        .addValue(a.max())
                        .addValue(a.avg())
                        .addValue(a.p95()))
                .replaceWithVoid();
    }

    public Uni<List<MetricAggregate>> query(MetricType type, String region) {
        return client.preparedQuery(QUERY)
                .execute(Tuple.of(type == null ? null : type.name(), region))
                .map(rows -> {
                    List<MetricAggregate> result = new ArrayList<>();
                    for (Row r : rows) {
                        result.add(map(r));
                    }
                    return result;
                });
    }

    private static MetricAggregate map(Row r) {
        return new MetricAggregate(
                MetricType.valueOf(r.getString("metric_type")),
                r.getString("region"),
                r.getOffsetDateTime("window_start").toInstant(),
                r.getOffsetDateTime("window_end").toInstant(),
                r.getLong("sample_count"),
                r.getDouble("min_value"),
                r.getDouble("max_value"),
                r.getDouble("avg_value"),
                r.getDouble("p95_value"));
    }
}
