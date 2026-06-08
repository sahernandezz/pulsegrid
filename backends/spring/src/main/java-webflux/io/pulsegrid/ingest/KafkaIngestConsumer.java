package io.pulsegrid.ingest;

import tools.jackson.databind.ObjectMapper;
import io.pulsegrid.persist.EventStore;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import reactor.core.Disposable;
import reactor.kafka.receiver.KafkaReceiver;
import reactor.kafka.receiver.ReceiverOptions;

import java.util.UUID;

/**
 * reactor-kafka consumer for the queue ingestion path. Persists each message through the
 * same reactive {@link EventStore} the HTTP path uses. Acknowledges the offset after
 * persisting.
 *
 * <p>Always a bean (no {@code @ConditionalOnProperty}) so it survives native AOT. The
 * http/queue switch is deferred to runtime inside {@link #start()}: it only subscribes
 * the receiver — and therefore only contacts the broker — when {@code INGEST_MODE=queue}.
 * This mirrors how the Quarkus variant gates its consumer on a {@code StartupEvent}, and
 * lets the single native binary serve both modes.
 */
@Component
public class KafkaIngestConsumer {

    private final KafkaReceiver<String, String> receiver;
    private final EventStore store;
    private final ObjectMapper mapper;
    private final boolean queueMode;
    private Disposable subscription;

    public KafkaIngestConsumer(ReceiverOptions<String, String> receiverOptions,
                               EventStore store,
                               ObjectMapper mapper,
                               @Value("${pulsegrid.ingest-mode:http}") String ingestMode) {
        this.receiver = KafkaReceiver.create(receiverOptions);
        this.store = store;
        this.mapper = mapper;
        this.queueMode = "queue".equalsIgnoreCase(ingestMode);
    }

    @PostConstruct
    void start() {
        if (!queueMode) {
            return; // http mode: never subscribe, never contact the broker
        }
        subscription = receiver.receive()
                .concatMap(record -> {
                    QueueMessage msg = parse(record.value());
                    return store.persistWithId(UUID.fromString(msg.id()), msg.event())
                            .doFinally(signal -> record.receiverOffset().acknowledge());
                })
                .subscribe();
    }

    @PreDestroy
    void stop() {
        if (subscription != null) {
            subscription.dispose();
        }
    }

    private QueueMessage parse(String payload) {
        try {
            return mapper.readValue(payload, QueueMessage.class);
        } catch (Exception e) {
            throw new IllegalStateException("Invalid Kafka message", e);
        }
    }
}
