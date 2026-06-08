package io.pulsegrid.domain;

import io.quarkus.runtime.annotations.RegisterForReflection;

import java.time.Instant;

/**
 * Response bodies for the ingestion API. The shape differs by MODE (http synchronous
 * vs queue asynchronous) on purpose; for a given mode, all variants respond
 * identically. See docs/API.md.
 *
 * <p><b>Native note:</b> these records are returned via {@code Response.entity(...)},
 * so the response type is erased to {@code jakarta.ws.rs.core.Response} and Quarkus'
 * build-time scan cannot see it — without explicit reflection registration the GraalVM
 * image has no metadata for the record accessors and Jackson fails at runtime
 * ({@code UnknownSerializer.failForEmpty}) → HTTP 500. {@code @RegisterForReflection}
 * restores the accessors so serialization works in native exactly as on the JVM.
 */
public final class Responses {

    private Responses() {
    }

    /** http mode · POST /api/events · 201: persisted resource. */
    @RegisterForReflection
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
    @RegisterForReflection
    public record AcceptedOne(boolean accepted, String id) {
        public AcceptedOne(String id) {
            this(true, id);
        }
    }

    /** http mode · POST /api/events/batch · 201. */
    @RegisterForReflection
    public record IngestedBatch(long ingested) {
    }

    /** queue mode · POST /api/events/batch · 202. */
    @RegisterForReflection
    public record AcceptedBatch(boolean accepted, long count) {
        public AcceptedBatch(long count) {
            this(true, count);
        }
    }
}
