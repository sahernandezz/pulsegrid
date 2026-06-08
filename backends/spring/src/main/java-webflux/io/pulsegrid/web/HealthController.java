package io.pulsegrid.web;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Mono;

import java.util.Map;

/**
 * Trivial liveness at {@code /health} (used by the compose healthcheck).
 * Reactive like everything else in this variant.
 */
@RestController
public class HealthController {

    @GetMapping("/health")
    public Mono<Map<String, String>> health() {
        return Mono.just(Map.of("status", "UP"));
    }
}
