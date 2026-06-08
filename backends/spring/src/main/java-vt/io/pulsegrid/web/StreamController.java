package io.pulsegrid.web;

import io.pulsegrid.stream.AggregateBroadcaster;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/**
 * SSE stream of closed aggregations. Each virtual thread holds an open emitter
 * with no platform-thread cost — a natural fit for the VT model.
 */
@RestController
public class StreamController {

    private final AggregateBroadcaster broadcaster;

    public StreamController(AggregateBroadcaster broadcaster) {
        this.broadcaster = broadcaster;
    }

    @GetMapping(value = "/api/stream/aggregates", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter stream() {
        return broadcaster.subscribe();
    }
}
