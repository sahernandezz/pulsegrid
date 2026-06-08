package io.pulsegrid.config;

import io.pulsegrid.agg.Windower;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * The {@link Windower} (windowing engine) is a singleton shared between ingestion
 * (producers) and the closing scheduler (single consumer).
 */
@Configuration
public class BeansConfig {

    @Bean
    public Windower windower() {
        return new Windower();
    }
}
