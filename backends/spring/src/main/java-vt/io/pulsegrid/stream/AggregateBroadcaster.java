package io.pulsegrid.stream;

import io.pulsegrid.domain.MetricAggregate;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * SSE broadcaster: keeps emitters open and pushes each closed aggregate. With
 * Virtual Threads, holding many SSE connections is cheap (one virtual thread per
 * request, without exhausting the platform-thread pool).
 */
@Component
public class AggregateBroadcaster {

    private final List<SseEmitter> emitters = new CopyOnWriteArrayList<>();

    public SseEmitter subscribe() {
        SseEmitter emitter = new SseEmitter(0L); // no timeout: long-lived stream
        emitter.onCompletion(() -> emitters.remove(emitter));
        emitter.onTimeout(() -> emitters.remove(emitter));
        emitter.onError(t -> emitters.remove(emitter));
        emitters.add(emitter);
        return emitter;
    }

    public void broadcast(MetricAggregate aggregate) {
        for (SseEmitter emitter : emitters) {
            try {
                emitter.send(SseEmitter.event().name("aggregate").data(aggregate));
            } catch (IOException | IllegalStateException ex) {
                emitters.remove(emitter);
            }
        }
    }
}
