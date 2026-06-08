package io.pulsegrid.ingest;

import tools.jackson.databind.ObjectMapper;
import io.pulsegrid.domain.EventRequest;
import org.apache.kafka.clients.producer.ProducerRecord;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import reactor.kafka.sender.KafkaSender;
import reactor.kafka.sender.SenderRecord;

import java.util.UUID;

/**
 * reactor-kafka producer for the queue ingestion path. Publishes without blocking and
 * returns the id in a {@code Mono}.
 *
 * <p>Always a bean (no {@code @ConditionalOnProperty}) so it survives native AOT; it is
 * only invoked by the controller when {@code INGEST_MODE=queue}, and the {@link KafkaSender}
 * opens no producer until that first send is subscribed.
 */
@Service
public class EventPublisher {

    private final KafkaSender<String, String> sender;
    private final ObjectMapper mapper;
    private final String topic;

    public EventPublisher(KafkaSender<String, String> sender,
                          ObjectMapper mapper,
                          @Value("${pulsegrid.kafka.topic:metric-events}") String topic) {
        this.sender = sender;
        this.mapper = mapper;
        this.topic = topic;
    }

    public Mono<String> publish(EventRequest event) {
        String id = UUID.randomUUID().toString();
        String payload = serialize(new QueueMessage(id, event));
        SenderRecord<String, String, String> record =
                SenderRecord.create(new ProducerRecord<>(topic, event.deviceId(), payload), id);
        return sender.send(Mono.just(record)).then(Mono.just(id));
    }

    public Mono<Long> publishBatch(Flux<EventRequest> events) {
        return events.flatMap(this::publish).count();
    }

    private String serialize(QueueMessage msg) {
        try {
            return mapper.writeValueAsString(msg);
        } catch (Exception e) {
            throw new IllegalStateException("Could not serialize event for Kafka", e);
        }
    }
}
