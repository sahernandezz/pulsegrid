package io.pulsegrid.domain;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.Instant;

/**
 * Ingestion payload (POST /api/events). The JSON shape is byte-for-byte identical
 * across all variants — see docs/API.md.
 *
 * <p>An immutable record with no web/persistence framework dependencies, so it can
 * serve both the MVC+JDBC (Virtual Threads) and the reactive (WebFlux) variants.
 */
public record EventRequest(
        @NotBlank String deviceId,
        @NotNull MetricType metricType,
        @NotNull Double value,
        @NotNull Instant timestamp,
        @NotBlank String region
) {
}
