package io.pulsegrid.ingest;

import org.apache.kafka.clients.consumer.ConsumerConfig;
import org.apache.kafka.clients.producer.ProducerConfig;
import org.apache.kafka.common.serialization.StringDeserializer;
import org.apache.kafka.common.serialization.StringSerializer;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import reactor.kafka.receiver.ReceiverOptions;
import reactor.kafka.sender.KafkaSender;
import reactor.kafka.sender.SenderOptions;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * reactor-kafka configuration for the queue ingestion path. Non-blocking producer
 * and consumer — consistent with the reactive path (never the classic blocking Kafka
 * client on the event loop).
 *
 * <p>No {@code @ConditionalOnProperty(ingest-mode=queue)}: Spring AOT freezes conditions
 * at build time, so an http-built native image would prune these beans and the single
 * binary could never serve queue mode. The beans are always declared but lazy — the
 * {@link KafkaSender} opens no producer until the first send is subscribed, and the
 * {@link io.pulsegrid.ingest.KafkaIngestConsumer} only subscribes the receiver in queue
 * mode — so http mode never touches the broker.
 */
@Configuration
public class KafkaConfig {

    @Bean
    public KafkaSender<String, String> kafkaSender(
            @Value("${pulsegrid.kafka.bootstrap:localhost:9092}") String bootstrap) {
        Map<String, Object> props = new HashMap<>();
        props.put(ProducerConfig.BOOTSTRAP_SERVERS_CONFIG, bootstrap);
        props.put(ProducerConfig.KEY_SERIALIZER_CLASS_CONFIG, StringSerializer.class);
        props.put(ProducerConfig.VALUE_SERIALIZER_CLASS_CONFIG, StringSerializer.class);
        props.put(ProducerConfig.ACKS_CONFIG, "1");
        return KafkaSender.create(SenderOptions.create(props));
    }

    @Bean
    public ReceiverOptions<String, String> receiverOptions(
            @Value("${pulsegrid.kafka.bootstrap:localhost:9092}") String bootstrap,
            @Value("${pulsegrid.kafka.topic:metric-events}") String topic) {
        Map<String, Object> props = new HashMap<>();
        props.put(ConsumerConfig.BOOTSTRAP_SERVERS_CONFIG, bootstrap);
        props.put(ConsumerConfig.GROUP_ID_CONFIG, "pulsegrid-spring-webflux");
        props.put(ConsumerConfig.KEY_DESERIALIZER_CLASS_CONFIG, StringDeserializer.class);
        props.put(ConsumerConfig.VALUE_DESERIALIZER_CLASS_CONFIG, StringDeserializer.class);
        props.put(ConsumerConfig.AUTO_OFFSET_RESET_CONFIG, "earliest");
        return ReceiverOptions.<String, String>create(props).subscription(List.of(topic));
    }
}
