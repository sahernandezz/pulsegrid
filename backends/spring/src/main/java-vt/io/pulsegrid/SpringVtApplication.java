package io.pulsegrid;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * PulseGrid <b>Virtual Threads</b> variant (Spring Boot 4, Java 25).
 *
 * <p>Plain imperative/blocking model: the code is sequential and readable (MVC + JDBC),
 * but with {@code spring.threads.virtual.enabled=true} each request runs on a virtual
 * thread, so blocking on I/O (the database) is cheap. That is exactly the point of the
 * experiment: high concurrency without reactive code.
 */
@SpringBootApplication
@EnableScheduling
public class SpringVtApplication {
    public static void main(String[] args) {
        SpringApplication.run(SpringVtApplication.class, args);
    }
}
