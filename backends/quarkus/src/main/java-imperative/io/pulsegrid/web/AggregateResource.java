package io.pulsegrid.web;

import io.pulsegrid.domain.MetricAggregate;
import io.pulsegrid.domain.MetricType;
import io.pulsegrid.persist.AggregateRepository;
import io.smallrye.common.annotation.Blocking;
import jakarta.inject.Inject;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;

import java.util.List;

@Path("/api/aggregates")
@Produces(MediaType.APPLICATION_JSON)
public class AggregateResource {

    @Inject
    AggregateRepository aggregates;

    @GET
    @Blocking
    public List<MetricAggregate> query(@QueryParam("metricType") MetricType metricType,
                                       @QueryParam("region") String region) {
        return aggregates.query(metricType, region);
    }
}
