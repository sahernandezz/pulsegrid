package io.pulsegrid.config;

import io.pulsegrid.agg.Windower;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Produces;
import jakarta.inject.Singleton;

/**
 * Exposes the {@link Windower} (a plain domain class with no CDI annotations) as an
 * injectable singleton. Shared between ingestion and the closing scheduler.
 */
@ApplicationScoped
public class AppProducers {

    @Produces
    @Singleton
    public Windower windower() {
        return new Windower();
    }
}
