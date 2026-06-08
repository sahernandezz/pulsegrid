package io.pulsegrid.ingest;

import io.pulsegrid.domain.EventRequest;

/**
 * Kafka message (queue mode). Carries the id generated at enqueue time so the
 * consumer persists with that same id (the one already returned to the client in the 202).
 */
public record QueueMessage(String id, EventRequest event) {
}
