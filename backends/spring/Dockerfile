# syntax=docker/dockerfile:1.7
# =============================================================================
# PulseGrid · Spring Boot 4 · JVM packaging
# Parametrized by PARADIGM (virtual-threads | webflux) -> Maven profile vt|webflux.
# docker-compose passes build.args.PARADIGM and build.args.PACKAGING=jvm.
# =============================================================================
ARG PARADIGM=virtual-threads

# --- build stage -------------------------------------------------------------
FROM eclipse-temurin:25-jdk AS build
ARG PARADIGM
# Maven without depending on a specific tag: copied from the official image (it runs
# on this image's JDK 25; the mvn binary is just scripts + jars).
COPY --from=maven:3.9.9-eclipse-temurin-21 /usr/share/maven /usr/share/maven
RUN ln -sf /usr/share/maven/bin/mvn /usr/local/bin/mvn
WORKDIR /build
COPY pom.xml .
COPY src ./src
# Activating webflux deactivates the vt profile (activeByDefault) — Maven's rule.
RUN --mount=type=cache,target=/root/.m2 \
    PROFILE="$([ "$PARADIGM" = "webflux" ] && echo webflux || echo vt)"; \
    echo "Building Spring paradigm=$PARADIGM (profile=$PROFILE) packaging=jvm"; \
    mvn -B -ntp -P"$PROFILE" -DskipTests clean package

# --- runtime stage -----------------------------------------------------------
FROM eclipse-temurin:25-jre AS runtime
ARG PARADIGM
ENV PG_PARADIGM=${PARADIGM}
WORKDIR /app
# curl for the compose healthcheck (wget||curl http://localhost:8080/health)
RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*
COPY --from=build /build/target/pulsegrid-spring.jar /app/app.jar
EXPOSE 8080
# JAVA_OPTS comes from compose (-XX:MaxRAMPercentage=75.0, container-aware).
# The spring profile is derived from the paradigm (selects application-<profile>.yml).
ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -Dspring.profiles.active=$([ \"$PG_PARADIGM\" = webflux ] && echo webflux || echo vt) -jar /app/app.jar"]
