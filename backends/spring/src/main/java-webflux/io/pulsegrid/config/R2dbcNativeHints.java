package io.pulsegrid.config;

import org.springframework.aot.hint.MemberCategory;
import org.springframework.aot.hint.RuntimeHints;
import org.springframework.aot.hint.RuntimeHintsRegistrar;
import org.springframework.aot.hint.TypeReference;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.ImportRuntimeHints;

import java.math.BigDecimal;
import java.math.BigInteger;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/**
 * GraalVM native reflection hints for the reactive R2DBC <b>write</b> path.
 *
 * <p>Background: on native, reads worked but ~95% of INSERTs failed. The read path the
 * benchmark exercises issues no bound parameters, whereas every INSERT/UPSERT binds a
 * value per column ({@code UUID}, {@code OffsetDateTime}, {@code Double}, {@code Long},
 * {@code String}). r2dbc-postgresql resolves a codec per bound value and encodes it
 * through reflection-sensitive paths; the metadata shipped in the driver jar
 * ({@code META-INF/native-image/.../reflect-config.json}) only covers the <i>array</i>
 * codec allocations, not the scalar bind/codec surface the writes hit. This registrar
 * closes that gap so the native image can encode parameters the same way the JVM does.
 *
 * <p>WebFlux-only source set (R2DBC is not on the Virtual-Threads/JDBC classpath), so it
 * is registered solely for the reactive variant. Internal driver classes are referenced
 * by name via {@link TypeReference} to avoid compile-time coupling to driver internals.
 */
@Configuration(proxyBeanMethods = false)
@ImportRuntimeHints(R2dbcNativeHints.Registrar.class)
public class R2dbcNativeHints {

    static final class Registrar implements RuntimeHintsRegistrar {

        /** Java types bound as INSERT/UPSERT parameters by the R2DBC repositories. */
        private static final List<Class<?>> BOUND_TYPES = List.of(
                UUID.class,
                OffsetDateTime.class,
                Instant.class,
                BigDecimal.class,
                BigInteger.class,
                Double.class,
                Float.class,
                Long.class,
                Integer.class,
                Short.class,
                Boolean.class,
                String.class
        );

        /**
         * Concrete r2dbc-postgresql codecs (and their abstract bases) on the scalar
         * bind/encode path. Registered by name so we don't compile against driver internals.
         */
        private static final List<String> CODEC_TYPES = List.of(
                "io.r2dbc.postgresql.codec.DefaultCodecs",
                "io.r2dbc.postgresql.codec.AbstractCodec",
                "io.r2dbc.postgresql.codec.AbstractNumericCodec",
                "io.r2dbc.postgresql.codec.AbstractTemporalCodec",
                "io.r2dbc.postgresql.codec.UuidCodec",
                "io.r2dbc.postgresql.codec.OffsetDateTimeCodec",
                "io.r2dbc.postgresql.codec.InstantCodec",
                "io.r2dbc.postgresql.codec.LocalDateTimeCodec",
                "io.r2dbc.postgresql.codec.DoubleCodec",
                "io.r2dbc.postgresql.codec.FloatCodec",
                "io.r2dbc.postgresql.codec.LongCodec",
                "io.r2dbc.postgresql.codec.IntegerCodec",
                "io.r2dbc.postgresql.codec.ShortCodec",
                "io.r2dbc.postgresql.codec.BigDecimalCodec",
                "io.r2dbc.postgresql.codec.BigIntegerCodec",
                "io.r2dbc.postgresql.codec.BooleanCodec",
                "io.r2dbc.postgresql.codec.StringCodec",
                "io.r2dbc.postgresql.codec.ArrayCodec",
                "io.r2dbc.postgresql.codec.EnumCodec"
        );

        private static final MemberCategory[] FULL_REFLECTION = {
                MemberCategory.INVOKE_PUBLIC_CONSTRUCTORS,
                MemberCategory.INVOKE_DECLARED_CONSTRUCTORS,
                MemberCategory.INVOKE_PUBLIC_METHODS,
                MemberCategory.INVOKE_DECLARED_METHODS,
        };

        @Override
        public void registerHints(RuntimeHints hints, ClassLoader classLoader) {
            for (Class<?> type : BOUND_TYPES) {
                hints.reflection().registerType(type, FULL_REFLECTION);
            }
            for (String codec : CODEC_TYPES) {
                hints.reflection().registerType(TypeReference.of(codec), FULL_REFLECTION);
            }
        }
    }
}
