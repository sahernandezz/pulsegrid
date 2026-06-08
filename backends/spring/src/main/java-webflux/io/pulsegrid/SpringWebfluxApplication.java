package io.pulsegrid;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * PulseGrid <b>WebFlux</b> variant (Spring Boot 4, Reactor on Netty).
 *
 * <p>Fully non-blocking: {@code Mono}/{@code Flux} end to end, R2DBC for data and
 * reactor-kafka for the queue. {@code .block()} and any synchronous JDBC are
 * FORBIDDEN on the reactive path — the event loop must never block. This is the
 * high-throughput counterpoint to Virtual Threads.
 */
@SpringBootApplication
@EnableScheduling
public class SpringWebfluxApplication {
    public static void main(String[] args) {
        SpringApplication.run(SpringWebfluxApplication.class, args);
    }
}
