package io.pulsegrid.domain;

import java.time.Instant;

/**
 * Response bodies for the ingestion API. The shape differs by MODE (http synchronous
 * vs queue asynchronous) on purpose; for a given mode, all variants respond
 * identically. See docs/API.md.
 */
public final class Responses {

    private Responses() {
    }

    /** http mode · POST /api/events · 201: persisted resource. */
    public record StoredEvent(
            String id,
            String deviceId,
            MetricType metricType,
            double value,
            Instant timestamp,
            String region,
            Instant ingestedAt
    ) {
    }

    /** queue mode · POST /api/events · 202: enqueued. */
    public record AcceptedOne(boolean accepted, String id) {
        public AcceptedOne(String id) {
            this(true, id);
        }
    }

    /** http mode · POST /api/events/batch · 201. */
    public record IngestedBatch(long ingested) {
    }

    /** queue mode · POST /api/events/batch · 202. */
    public record AcceptedBatch(boolean accepted, long count) {
        public AcceptedBatch(long count) {
            this(true, count);
        }
    }
}
