package io.pulsegrid.ingest;

import io.pulsegrid.domain.EventRequest;
import io.quarkus.runtime.annotations.RegisterForReflection;

/**
 * Kafka message (queue mode): id generated at enqueue time + event.
 *
 * <p>Registered for reflection so Jackson can serialize it to / deserialize it from the
 * Kafka topic in the GraalVM native image. It is never a REST method parameter, so
 * Quarkus' build-time scan would otherwise miss it and the producer fails at runtime
 * ({@code UnknownSerializer}) → HTTP 500 — the same bug class as the http response path.
 */
@RegisterForReflection
public record QueueMessage(String id, EventRequest event) {
}
