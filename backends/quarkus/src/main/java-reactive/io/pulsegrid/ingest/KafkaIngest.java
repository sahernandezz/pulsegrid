package io.pulsegrid.ingest;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.pulsegrid.domain.EventRequest;
import io.quarkus.runtime.ShutdownEvent;
import io.quarkus.runtime.StartupEvent;
import io.smallrye.mutiny.Uni;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Observes;
import jakarta.inject.Inject;
import org.apache.kafka.clients.consumer.ConsumerConfig;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.apache.kafka.clients.consumer.ConsumerRecords;
import org.apache.kafka.clients.consumer.KafkaConsumer;
import org.apache.kafka.clients.producer.KafkaProducer;
import org.apache.kafka.clients.producer.ProducerConfig;
import org.apache.kafka.clients.producer.ProducerRecord;
import org.apache.kafka.common.serialization.StringDeserializer;
import org.apache.kafka.common.serialization.StringSerializer;
import org.eclipse.microprofile.config.inject.ConfigProperty;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Properties;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Queue ingestion (only INGEST_MODE=queue), with the standard Kafka client gated at
 * startup by config — so the SAME artifact serves http and queue without the consumer
 * trying to connect to Kafka when it shouldn't. The producer exposes a {@code Uni}; the
 * consumer runs on a dedicated thread (not the event loop) and persists via the reactive
 * {@link EventStore}.
 */
@ApplicationScoped
public class KafkaIngest {

    @ConfigProperty(name = "pulsegrid.ingest-mode", defaultValue = "http")
    String mode;

    @ConfigProperty(name = "pulsegrid.kafka.bootstrap", defaultValue = "localhost:9092")
    String bootstrap;

    @ConfigProperty(name = "pulsegrid.kafka.topic", defaultValue = "metric-events")
    String topic;

    @Inject
    EventStore store;

    @Inject
    ObjectMapper mapper;

    private KafkaProducer<String, String> producer;
    private ExecutorService consumerExecutor;
    private volatile boolean running;

    void onStart(@Observes StartupEvent ev) {
        if (!"queue".equalsIgnoreCase(mode)) {
            return;
        }
        producer = new KafkaProducer<>(producerProps());
        running = true;
        consumerExecutor = Executors.newSingleThreadExecutor(r -> {
            Thread t = new Thread(r, "pulsegrid-kafka-consumer");
            t.setDaemon(true);
            return t;
        });
        consumerExecutor.submit(this::consumeLoop);
    }

    void onStop(@Observes ShutdownEvent ev) {
        running = false;
        if (producer != null) {
            producer.close();
        }
        if (consumerExecutor != null) {
            consumerExecutor.shutdownNow();
        }
    }

    public Uni<String> publish(EventRequest event) {
        String id = UUID.randomUUID().toString();
        String payload = serialize(new QueueMessage(id, event));
        return Uni.createFrom().<String>emitter(em ->
                producer.send(new ProducerRecord<>(topic, event.deviceId(), payload), (meta, ex) -> {
                    if (ex != null) {
                        em.fail(ex);
                    } else {
                        em.complete(id);
                    }
                }));
    }

    public Uni<Long> publishBatch(List<EventRequest> events) {
        List<Uni<String>> sends = new ArrayList<>(events.size());
        for (EventRequest e : events) {
            sends.add(publish(e));
        }
        return Uni.join().all(sends).andCollectFailures().replaceWith((long) events.size());
    }

    private void consumeLoop() {
        try (KafkaConsumer<String, String> consumer = new KafkaConsumer<>(consumerProps())) {
            consumer.subscribe(List.of(topic));
            while (running) {
                ConsumerRecords<String, String> records = consumer.poll(Duration.ofMillis(200));
                for (ConsumerRecord<String, String> rec : records) {
                    QueueMessage msg = deserialize(rec.value());
                    // Dedicated thread (not the event loop): blocking here is valid.
                    store.persistWithId(UUID.fromString(msg.id()), msg.event()).await().indefinitely();
                }
                if (!records.isEmpty()) {
                    consumer.commitSync();
                }
            }
        }
    }

    private Properties producerProps() {
        Properties p = new Properties();
        p.put(ProducerConfig.BOOTSTRAP_SERVERS_CONFIG, bootstrap);
        p.put(ProducerConfig.KEY_SERIALIZER_CLASS_CONFIG, StringSerializer.class.getName());
        p.put(ProducerConfig.VALUE_SERIALIZER_CLASS_CONFIG, StringSerializer.class.getName());
        p.put(ProducerConfig.ACKS_CONFIG, "1");
        return p;
    }

    private Properties consumerProps() {
        Properties p = new Properties();
        p.put(ConsumerConfig.BOOTSTRAP_SERVERS_CONFIG, bootstrap);
        p.put(ConsumerConfig.GROUP_ID_CONFIG, "pulsegrid-quarkus-reactive");
        p.put(ConsumerConfig.KEY_DESERIALIZER_CLASS_CONFIG, StringDeserializer.class.getName());
        p.put(ConsumerConfig.VALUE_DESERIALIZER_CLASS_CONFIG, StringDeserializer.class.getName());
        p.put(ConsumerConfig.AUTO_OFFSET_RESET_CONFIG, "earliest");
        p.put(ConsumerConfig.ENABLE_AUTO_COMMIT_CONFIG, "false");
        return p;
    }

    private String serialize(QueueMessage msg) {
        try {
            return mapper.writeValueAsString(msg);
        } catch (Exception e) {
            throw new IllegalStateException("Could not serialize event for Kafka", e);
        }
    }

    private QueueMessage deserialize(String payload) {
        try {
            return mapper.readValue(payload, QueueMessage.class);
        } catch (Exception e) {
            throw new IllegalStateException("Invalid Kafka message", e);
        }
    }
}
