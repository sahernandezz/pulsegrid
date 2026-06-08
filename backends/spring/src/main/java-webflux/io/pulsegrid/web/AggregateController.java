package io.pulsegrid.web;

import io.pulsegrid.domain.MetricAggregate;
import io.pulsegrid.domain.MetricType;
import io.pulsegrid.persist.R2dbcAggregateRepository;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Flux;

@RestController
public class AggregateController {

    private final R2dbcAggregateRepository aggregates;

    public AggregateController(R2dbcAggregateRepository aggregates) {
        this.aggregates = aggregates;
    }

    @GetMapping("/api/aggregates")
    public Flux<MetricAggregate> query(@RequestParam(required = false) MetricType metricType,
                                       @RequestParam(required = false) String region) {
        return aggregates.query(metricType, region);
    }
}
