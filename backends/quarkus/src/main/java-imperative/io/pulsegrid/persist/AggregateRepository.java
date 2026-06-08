package io.pulsegrid.persist;

import io.pulsegrid.domain.MetricAggregate;
import io.pulsegrid.domain.MetricType;
import io.quarkus.panache.common.Sort;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.transaction.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Persistence and querying of aggregates with Hibernate ORM. The UPSERT is done in ORM
 * style (find-or-create); since only the scheduler (single thread) writes aggregates,
 * there is no race. Idempotent equivalent of the reactive variants' ON CONFLICT.
 */
@ApplicationScoped
public class AggregateRepository {

    @Transactional
    public void upsert(MetricAggregate a) {
        MetricAggregateEntity e = MetricAggregateEntity
                .find("metricType = ?1 and region = ?2 and windowStart = ?3",
                        a.metricType().name(), a.region(), a.windowStart())
                .firstResult();
        if (e == null) {
            e = new MetricAggregateEntity();
            e.id = UUID.randomUUID();
            e.metricType = a.metricType().name();
            e.region = a.region();
            e.windowStart = a.windowStart();
        }
        e.windowEnd = a.windowEnd();
        e.sampleCount = a.count();
        e.minValue = a.min();
        e.maxValue = a.max();
        e.avgValue = a.avg();
        e.p95Value = a.p95();
        e.persist();
    }

    public List<MetricAggregate> query(MetricType type, String region) {
        StringBuilder q = new StringBuilder("1 = 1");
        Map<String, Object> params = new HashMap<>();
        if (type != null) {
            q.append(" and metricType = :type");
            params.put("type", type.name());
        }
        if (region != null) {
            q.append(" and region = :region");
            params.put("region", region);
        }
        List<MetricAggregateEntity> rows = MetricAggregateEntity
                .find(q.toString(), Sort.by("windowStart").descending(), params)
                .range(0, 499)
                .list();
        return rows.stream().map(AggregateRepository::toDto).toList();
    }

    private static MetricAggregate toDto(MetricAggregateEntity e) {
        return new MetricAggregate(
                MetricType.valueOf(e.metricType), e.region,
                e.windowStart, e.windowEnd, e.sampleCount,
                e.minValue, e.maxValue, e.avgValue, e.p95Value);
    }
}
