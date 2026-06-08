package io.pulsegrid.config;

import io.pulsegrid.agg.Windower;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class BeansConfig {

    /** Windowing engine shared between ingestion (event loop) and flush (scheduler). */
    @Bean
    public Windower windower() {
        return new Windower();
    }
}
