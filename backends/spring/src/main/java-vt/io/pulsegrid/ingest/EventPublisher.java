package io.pulsegrid.ingest;

import tools.jackson.databind.ObjectMapper;
import io.pulsegrid.domain.EventRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

/**
 * Kafka producer for the queue ingestion path. Generates the id, serializes the
 * event to JSON and publishes it; the {@link KafkaIngestConsumer} persists it later.
 * The standard Kafka client is blocking, which is perfectly valid under Virtual Threads.
 *
 * <p>Always a bean (no {@code @ConditionalOnProperty}) so it survives native AOT; it is
 * only invoked by the controller when {@code INGEST_MODE=queue}, and the underlying
 * {@link KafkaTemplate} opens no connection until the first send.
 */
@Service
public class EventPublisher {

    private final KafkaTemplate<String, String> kafka;
    private final ObjectMapper mapper;
    private final String topic;

    public EventPublisher(KafkaTemplate<String, String> kafka,
                          ObjectMapper mapper,
                          @Value("${pulsegrid.kafka.topic:metric-events}") String topic) {
        this.kafka = kafka;
        this.mapper = mapper;
        this.topic = topic;
    }

    public String publish(EventRequest event) {
        String id = UUID.randomUUID().toString();
        kafka.send(topic, event.deviceId(), serialize(new QueueMessage(id, event)));
        return id;
    }

    public long publishBatch(List<EventRequest> events) {
        for (EventRequest event : events) {
            publish(event);
        }
        return events.size();
    }

    private String serialize(QueueMessage msg) {
        try {
            return mapper.writeValueAsString(msg);
        } catch (Exception e) {
            throw new IllegalStateException("Could not serialize event for Kafka", e);
        }
    }
}
