package io.pulsegrid.persist;

import io.pulsegrid.domain.MetricAggregate;
import io.pulsegrid.domain.MetricType;
import org.springframework.r2dbc.core.DatabaseClient;
import org.springframework.stereotype.Repository;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.UUID;

/**
 * Reactive persistence and querying of windowed aggregates. Idempotent UPSERT on
 * (metric_type, region, window_start), same contract as the VT variant.
 */
@Repository
public class R2dbcAggregateRepository {

    private static final String UPSERT = """
            INSERT INTO metric_aggregates
                (id, metric_type, region, window_start, window_end,
                 sample_count, min_value, max_value, avg_value, p95_value)
            VALUES (:id, :type, :region, :wstart, :wend, :count, :min, :max, :avg, :p95)
            ON CONFLICT (metric_type, region, window_start) DO UPDATE SET
                window_end   = EXCLUDED.window_end,
                sample_count = EXCLUDED.sample_count,
                min_value    = EXCLUDED.min_value,
                max_value    = EXCLUDED.max_value,
                avg_value    = EXCLUDED.avg_value,
                p95_value    = EXCLUDED.p95_value
            """;

    private final DatabaseClient db;

    public R2dbcAggregateRepository(DatabaseClient db) {
        this.db = db;
    }

    public Mono<Long> upsert(MetricAggregate a) {
        return db.sql(UPSERT)
                .bind("id", UUID.randomUUID())
                .bind("type", a.metricType().name())
                .bind("region", a.region())
                .bind("wstart", a.windowStart().atOffset(ZoneOffset.UTC))
                .bind("wend", a.windowEnd().atOffset(ZoneOffset.UTC))
                .bind("count", a.count())
                .bind("min", a.min())
                .bind("max", a.max())
                .bind("avg", a.avg())
                .bind("p95", a.p95())
                .fetch()
                .rowsUpdated();
    }

    public Flux<MetricAggregate> query(MetricType type, String region) {
        // Build the WHERE dynamically to avoid binding NULLs (cleaner in R2DBC).
        StringBuilder sql = new StringBuilder("""
                SELECT metric_type, region, window_start, window_end,
                       sample_count, min_value, max_value, avg_value, p95_value
                FROM metric_aggregates WHERE 1 = 1
                """);
        if (type != null) sql.append(" AND metric_type = :type");
        if (region != null) sql.append(" AND region = :region");
        sql.append(" ORDER BY window_start DESC LIMIT 500");

        DatabaseClient.GenericExecuteSpec spec = db.sql(sql.toString());
        if (type != null) spec = spec.bind("type", type.name());
        if (region != null) spec = spec.bind("region", region);

        return spec.map((row, meta) -> new MetricAggregate(
                MetricType.valueOf(row.get("metric_type", String.class)),
                row.get("region", String.class),
                row.get("window_start", OffsetDateTime.class).toInstant(),
                row.get("window_end", OffsetDateTime.class).toInstant(),
                row.get("sample_count", Long.class),
                row.get("min_value", Double.class),
                row.get("max_value", Double.class),
                row.get("avg_value", Double.class),
                row.get("p95_value", Double.class))).all();
    }
}
