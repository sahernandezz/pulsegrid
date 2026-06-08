package io.pulsegrid.web;

import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;

import java.util.Map;

/**
 * Trivial liveness at {@code /health} (used by the compose healthcheck).
 * Quarkus' rich health lives at {@code /q/health}.
 */
@Path("/health")
public class HealthResource {

    @GET
    @Produces(MediaType.APPLICATION_JSON)
    public Map<String, String> health() {
        return Map.of("status", "UP");
    }
}
