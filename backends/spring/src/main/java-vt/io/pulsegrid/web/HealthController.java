package io.pulsegrid.web;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * Trivial liveness at {@code /health} — used by the docker-compose healthcheck
 * ({@code wget http://localhost:8080/health}). Independent of Actuator's richer
 * health ({@code /actuator/health}). See docs/API.md.
 */
@RestController
public class HealthController {

    @GetMapping("/health")
    public Map<String, String> health() {
        return Map.of("status", "UP");
    }
}
