package io.pulsegrid.agg;

import io.pulsegrid.domain.MetricAggregate;
import io.pulsegrid.domain.MetricType;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 10s sliding-window engine, SHARED by both Spring variants. It is pure (no framework
 * dependencies): the variant decides HOW to persist and emit aggregates; this class
 * only accumulates events and closes windows.
 *
 * <p>Thread-safe: {@link #ingest} is called from many threads (virtual in VT, the
 * event loop in WebFlux); {@link #closeElapsed} is called from a single scheduler.
 */
public final class Windower {

    /** Window size (brief §3): 10 seconds. */
    public static final long WINDOW_MS = 10_000L;

    private final ConcurrentHashMap<WindowKey, WindowAccumulator> windows = new ConcurrentHashMap<>();

    public void ingest(MetricType type, String region, double value, Instant timestamp) {
        Instant windowStart = floorToWindow(timestamp);
        WindowKey key = new WindowKey(type, region, windowStart);
        windows.computeIfAbsent(key, k -> new WindowAccumulator()).add(value);
    }

    /**
     * Closes and removes every window whose end ({@code windowStart + WINDOW_MS}) is
     * already in the past relative to {@code now}, returning their aggregates. The
     * caller persists them and emits them over SSE.
     */
    public List<MetricAggregate> closeElapsed(Instant now) {
        List<MetricAggregate> closed = new ArrayList<>();
        for (Iterator<Map.Entry<WindowKey, WindowAccumulator>> it = windows.entrySet().iterator(); it.hasNext(); ) {
            Map.Entry<WindowKey, WindowAccumulator> e = it.next();
            WindowKey key = e.getKey();
            Instant windowEnd = key.windowStart().plusMillis(WINDOW_MS);
            if (!windowEnd.isAfter(now)) {
                it.remove();
                WindowAccumulator acc = e.getValue();
                closed.add(new MetricAggregate(
                        key.metricType(), key.region(),
                        key.windowStart(), windowEnd,
                        acc.count(), acc.min(), acc.max(), acc.avg(), acc.p95()));
            }
        }
        return closed;
    }

    public int openWindows() {
        return windows.size();
    }

    static Instant floorToWindow(Instant ts) {
        long ms = ts.toEpochMilli();
        return Instant.ofEpochMilli(ms - Math.floorMod(ms, WINDOW_MS));
    }
}
