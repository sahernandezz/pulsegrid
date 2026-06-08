package io.pulsegrid.web;

import io.pulsegrid.domain.MetricAggregate;
import io.pulsegrid.domain.MetricType;
import io.pulsegrid.persist.JdbcAggregateRepository;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Query closed aggregations, with optional metricType / region filters.
 */
@RestController
public class AggregateController {

    private final JdbcAggregateRepository aggregates;

    public AggregateController(JdbcAggregateRepository aggregates) {
        this.aggregates = aggregates;
    }

    @GetMapping("/api/aggregates")
    public List<MetricAggregate> query(@RequestParam(required = false) MetricType metricType,
                                       @RequestParam(required = false) String region) {
        return aggregates.query(metricType, region);
    }
}
