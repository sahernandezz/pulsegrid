package io.pulsegrid.stream;

import io.pulsegrid.domain.MetricAggregate;
import io.pulsegrid.domain.MetricType;
import io.vertx.core.json.JsonObject;

import java.time.Instant;

/**
 * Converts {@link MetricAggregate} to/from {@link JsonObject} so it can travel over the
 * Vert.x EventBus (JsonObject has a built-in codec: no need to register one).
 */
public final class AggregateJson {

    private AggregateJson() {
    }

    public static JsonObject toJson(MetricAggregate a) {
        return new JsonObject()
                .put("metricType", a.metricType().name())
                .put("region", a.region())
                .put("windowStart", a.windowStart().toString())
                .put("windowEnd", a.windowEnd().toString())
                .put("count", a.count())
                .put("min", a.min())
                .put("max", a.max())
                .put("avg", a.avg())
                .put("p95", a.p95());
    }

    public static MetricAggregate fromJson(JsonObject j) {
        return new MetricAggregate(
                MetricType.valueOf(j.getString("metricType")),
                j.getString("region"),
                Instant.parse(j.getString("windowStart")),
                Instant.parse(j.getString("windowEnd")),
                j.getLong("count"),
                j.getDouble("min"),
                j.getDouble("max"),
                j.getDouble("avg"),
                j.getDouble("p95"));
    }
}
