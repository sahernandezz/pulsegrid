package io.pulsegrid.persist;

import io.pulsegrid.domain.EventRequest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import java.sql.Types;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;

/**
 * Blocking event persistence via JDBC. Under Virtual Threads, blocking on the
 * database does not monopolize a platform thread: the carrier is freed while the
 * virtual thread waits. Single insert with {@link JdbcClient}; batch with
 * {@link JdbcTemplate#batchUpdate} to amortize the round-trip.
 */
@Repository
public class JdbcEventRepository {

    private static final String INSERT = """
            INSERT INTO metric_events
                (id, device_id, metric_type, metric_value, event_ts, region, ingested_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """;

    private final JdbcClient jdbc;
    private final JdbcTemplate template;

    public JdbcEventRepository(JdbcClient jdbc, JdbcTemplate template) {
        this.jdbc = jdbc;
        this.template = template;
    }

    public void insert(UUID id, EventRequest e, Instant ingestedAt) {
        jdbc.sql(INSERT)
                .param(id)
                .param(e.deviceId())
                .param(e.metricType().name())
                .param(e.value())
                .param(odt(e.timestamp()))
                .param(e.region())
                .param(odt(ingestedAt))
                .update();
    }

    /** Inserts the batch generating an id per row; returns the row count. */
    public long insertBatch(List<EventRequest> events) {
        Instant ingestedAt = Instant.now();
        template.batchUpdate(INSERT, events, events.size(), (ps, e) -> {
            ps.setObject(1, UUID.randomUUID());
            ps.setString(2, e.deviceId());
            ps.setString(3, e.metricType().name());
            ps.setDouble(4, e.value());
            ps.setObject(5, odt(e.timestamp()), Types.TIMESTAMP_WITH_TIMEZONE);
            ps.setString(6, e.region());
            ps.setObject(7, odt(ingestedAt), Types.TIMESTAMP_WITH_TIMEZONE);
        });
        return events.size();
    }

    private static OffsetDateTime odt(Instant i) {
        return i.atOffset(ZoneOffset.UTC);
    }
}
