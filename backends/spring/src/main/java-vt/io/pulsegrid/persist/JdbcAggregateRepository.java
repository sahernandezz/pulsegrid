package io.pulsegrid.persist;

import io.pulsegrid.domain.MetricAggregate;
import io.pulsegrid.domain.MetricType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;

/**
 * Persistence and querying of windowed aggregates. The UPSERT on
 * (metric_type, region, window_start) is idempotent: if the same window is closed
 * twice (e.g. scheduler re-entry) it does not duplicate rows.
 */
@Repository
public class JdbcAggregateRepository {

    private static final String UPSERT = """
            INSERT INTO metric_aggregates
                (id, metric_type, region, window_start, window_end,
                 sample_count, min_value, max_value, avg_value, p95_value)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
            WHERE (CAST(:type AS varchar)   IS NULL OR metric_type = :type)
              AND (CAST(:region AS varchar) IS NULL OR region = :region)
            ORDER BY window_start DESC
            LIMIT 500
            """;

    private final JdbcClient jdbc;

    public JdbcAggregateRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public void upsert(MetricAggregate a) {
        jdbc.sql(UPSERT)
                .param(UUID.randomUUID())
                .param(a.metricType().name())
                .param(a.region())
                .param(a.windowStart().atOffset(ZoneOffset.UTC))
                .param(a.windowEnd().atOffset(ZoneOffset.UTC))
                .param(a.count())
                .param(a.min())
                .param(a.max())
                .param(a.avg())
                .param(a.p95())
                .update();
    }

    public List<MetricAggregate> query(MetricType type, String region) {
        return jdbc.sql(QUERY)
                .param("type", type == null ? null : type.name())
                .param("region", region)
                .query((rs, n) -> new MetricAggregate(
                        MetricType.valueOf(rs.getString("metric_type")),
                        rs.getString("region"),
                        rs.getObject("window_start", OffsetDateTime.class).toInstant(),
                        rs.getObject("window_end", OffsetDateTime.class).toInstant(),
                        rs.getLong("sample_count"),
                        rs.getDouble("min_value"),
                        rs.getDouble("max_value"),
                        rs.getDouble("avg_value"),
                        rs.getDouble("p95_value")))
                .list();
    }
}
