package io.pulsegrid.config;

import org.apache.kafka.clients.consumer.ConsumerConfig;
import org.apache.kafka.clients.producer.ProducerConfig;
import org.apache.kafka.common.serialization.StringDeserializer;
import org.apache.kafka.common.serialization.StringSerializer;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.annotation.EnableKafka;
import org.springframework.kafka.config.ConcurrentKafkaListenerContainerFactory;
import org.springframework.kafka.core.ConsumerFactory;
import org.springframework.kafka.core.DefaultKafkaConsumerFactory;
import org.springframework.kafka.core.DefaultKafkaProducerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.core.ProducerFactory;

import java.util.HashMap;
import java.util.Map;

/**
 * Explicit Kafka wiring for the queue ingestion path.
 *
 * <p>Spring Boot 4 modularized its auto-configurations, so adding {@code spring-kafka}
 * alone no longer auto-configures a {@link KafkaTemplate} nor the {@code @KafkaListener}
 * container factory. We declare them explicitly here. Every bean is
 * {@code @ConditionalOnMissingBean}, so if a future Boot version (or AOT) does provide
 * them, these defer rather than clash.
 *
 * <p><b>Why no {@code @ConditionalOnProperty(ingest-mode=queue)} on this class:</b>
 * Spring AOT evaluates {@code @Conditional} at <i>build</i> time, so an http-built
 * native image would prune every queue bean and the single binary could never serve
 * queue mode (unlike Quarkus, which decides at runtime). The beans are therefore always
 * present — they are lazy (no broker connection until first use), and the actual
 * http/queue switch happens at runtime: the producer is only invoked by the controller
 * in queue mode, and the consumer container only auto-starts in queue mode (see
 * {@link io.pulsegrid.ingest.KafkaIngestConsumer}). One binary now serves both modes,
 * JVM and native alike.
 */
@Configuration
@EnableKafka
public class KafkaSupportConfig {

    @Value("${pulsegrid.kafka.bootstrap:localhost:9092}")
    String bootstrap;

    @Bean
    @ConditionalOnMissingBean
    public ProducerFactory<String, String> producerFactory() {
        Map<String, Object> props = new HashMap<>();
        props.put(ProducerConfig.BOOTSTRAP_SERVERS_CONFIG, bootstrap);
        props.put(ProducerConfig.KEY_SERIALIZER_CLASS_CONFIG, StringSerializer.class);
        props.put(ProducerConfig.VALUE_SERIALIZER_CLASS_CONFIG, StringSerializer.class);
        props.put(ProducerConfig.ACKS_CONFIG, "1");
        return new DefaultKafkaProducerFactory<>(props);
    }

    @Bean
    @ConditionalOnMissingBean
    public KafkaTemplate<String, String> kafkaTemplate(ProducerFactory<String, String> pf) {
        return new KafkaTemplate<>(pf);
    }

    @Bean
    @ConditionalOnMissingBean
    public ConsumerFactory<String, String> consumerFactory() {
        Map<String, Object> props = new HashMap<>();
        props.put(ConsumerConfig.BOOTSTRAP_SERVERS_CONFIG, bootstrap);
        props.put(ConsumerConfig.GROUP_ID_CONFIG, "pulsegrid-spring-vt");
        props.put(ConsumerConfig.KEY_DESERIALIZER_CLASS_CONFIG, StringDeserializer.class);
        props.put(ConsumerConfig.VALUE_DESERIALIZER_CLASS_CONFIG, StringDeserializer.class);
        props.put(ConsumerConfig.AUTO_OFFSET_RESET_CONFIG, "earliest");
        return new DefaultKafkaConsumerFactory<>(props);
    }

    @Bean
    @ConditionalOnMissingBean(name = "kafkaListenerContainerFactory")
    public ConcurrentKafkaListenerContainerFactory<String, String> kafkaListenerContainerFactory(
            ConsumerFactory<String, String> cf) {
        ConcurrentKafkaListenerContainerFactory<String, String> factory =
                new ConcurrentKafkaListenerContainerFactory<>();
        factory.setConsumerFactory(cf);
        return factory;
    }
}
