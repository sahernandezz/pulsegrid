package io.pulsegrid.config;

import io.pulsegrid.domain.EventRequest;
import io.pulsegrid.domain.MetricAggregate;
import io.pulsegrid.domain.Responses;
import io.pulsegrid.ingest.QueueMessage;
import org.springframework.aot.hint.annotation.RegisterReflectionForBinding;
import org.springframework.context.annotation.Configuration;

/**
 * GraalVM native reflection hints for the API response bodies.
 *
 * <p>The ingestion endpoints return {@code ResponseEntity<?>} with
 * {@code body((Object) stored)}, which erases the concrete response type. Spring AOT
 * therefore cannot infer that these records must be reflectively serialized by Jackson,
 * so the native image ships without their metadata and serialization fails at runtime
 * with HTTP 500 (the JVM build is unaffected because it discovers the accessors
 * reflectively at runtime). Registering the types explicitly restores native
 * serialization to byte-for-byte match the JVM responses.
 *
 * <p>Shared source set, so both the Virtual-Threads and WebFlux variants pick it up.
 */
@Configuration(proxyBeanMethods = false)
@RegisterReflectionForBinding({
        Responses.StoredEvent.class,
        Responses.AcceptedOne.class,
        Responses.IngestedBatch.class,
        Responses.AcceptedBatch.class,
        MetricAggregate.class,
        EventRequest.class,
        QueueMessage.class,
})
public class NativeHints {
}
