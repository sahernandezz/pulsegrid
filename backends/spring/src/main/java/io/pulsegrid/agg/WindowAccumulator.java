package io.pulsegrid.agg;

import java.util.Arrays;
import java.util.concurrent.ThreadLocalRandom;

/**
 * Thread-safe accumulator for one window. count/min/max/sum are exact; p95 is
 * estimated with a fixed-size reservoir sample (Algorithm R) so we don't keep
 * millions of values under high load. Under benchmark this yields a stable,
 * memory-bounded p95 — the reservoir bias is negligible against measurement noise
 * and is identical for every variant (same shared class).
 */
public final class WindowAccumulator {

    private static final int RESERVOIR_CAP = 4096;

    private final double[] reservoir = new double[RESERVOIR_CAP];
    private long count;
    private int filled;
    private double min = Double.POSITIVE_INFINITY;
    private double max = Double.NEGATIVE_INFINITY;
    private double sum;

    public synchronized void add(double value) {
        count++;
        if (value < min) min = value;
        if (value > max) max = value;
        sum += value;

        if (filled < RESERVOIR_CAP) {
            reservoir[filled++] = value;
        } else {
            long r = ThreadLocalRandom.current().nextLong(count);
            if (r < RESERVOIR_CAP) {
                reservoir[(int) r] = value;
            }
        }
    }

    public synchronized long count() {
        return count;
    }

    public synchronized double min() {
        return count == 0 ? 0.0 : min;
    }

    public synchronized double max() {
        return count == 0 ? 0.0 : max;
    }

    public synchronized double avg() {
        return count == 0 ? 0.0 : sum / count;
    }

    /** p95 estimated over the reservoir sample. */
    public synchronized double p95() {
        if (filled == 0) {
            return 0.0;
        }
        double[] sorted = Arrays.copyOf(reservoir, filled);
        Arrays.sort(sorted);
        int idx = (int) Math.ceil(0.95 * sorted.length) - 1;
        if (idx < 0) idx = 0;
        if (idx >= sorted.length) idx = sorted.length - 1;
        return sorted[idx];
    }
}
