package io.pulsegrid.ingest;

import tools.jackson.databind.ObjectMapper;
import io.pulsegrid.persist.EventStore;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

import java.util.UUID;

/**
 * Kafka consumer for the queue ingestion path. Deserializes the message and persists
 * through the same {@link EventStore} the HTTP path uses — same domain logic, different
 * entry path.
 *
 * <p>Always a bean (no {@code @ConditionalOnProperty}) so it survives native AOT. The
 * http/queue switch is deferred to runtime through the listener's {@code autoStartup}:
 * the SpEL expression resolves {@code pulsegrid.ingest-mode} when the context starts, so
 * the container only connects to the broker in queue mode. In http mode the bean exists
 * but the container never starts — no broker contact. One binary, both modes.
 */
@Component
public class KafkaIngestConsumer {

    private final EventStore store;
    private final ObjectMapper mapper;

    public KafkaIngestConsumer(EventStore store, ObjectMapper mapper) {
        this.store = store;
        this.mapper = mapper;
    }

    @KafkaListener(topics = "${pulsegrid.kafka.topic:metric-events}",
            groupId = "pulsegrid-spring-vt",
            autoStartup = "#{'${pulsegrid.ingest-mode:http}'.equalsIgnoreCase('queue')}")
    public void onMessage(String payload) throws Exception {
        QueueMessage msg = mapper.readValue(payload, QueueMessage.class);
        store.persistWithId(UUID.fromString(msg.id()), msg.event());
    }
}
