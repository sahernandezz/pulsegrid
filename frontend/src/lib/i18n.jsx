import { createContext, useContext, useEffect, useState } from 'react';

// -----------------------------------------------------------------------------
// Lightweight, dependency-free i18n.
//
// Strategy: default to the language configured on the user's device
// (navigator.languages / navigator.language). A manual choice is remembered in
// localStorage and wins over detection. Only 'en' and 'es' are supported; any
// other device locale falls back to English.
//
// Translation values are plain strings with optional {placeholders}. Rich text
// that needs coloured <span>s is composed in the component from these fragments
// (so the dictionary stays pure data). Technical proper nouns (Spring Boot,
// Quarkus, WebFlux, Mutiny, Virtual Threads, JVM, Native, GraalVM), units
// (req/s, ms, MB, CPU, GB) and code identifiers are intentionally left untranslated.
// -----------------------------------------------------------------------------

export const LANGS = ['en', 'es'];
const STORAGE_KEY = 'pg-lang';

const DICT = {
  en: {
    // top bar / nav
    'nav.offlineMeasured': 'offline-measured',
    'nav.source': 'Source',
    'nav.langLabel': 'Language',

    // hero
    'hero.eyebrow': 'Spring Boot 4 vs Quarkus · JVM vs GraalVM native',
    'hero.titleA': 'Which concurrency paradigm holds',
    'hero.titleB': 'when it matters most.',
    'hero.subtitle':
      'Virtual Threads, WebFlux, Mutiny and blocking — across JVM and GraalVM native, under real high-concurrency ingestion.',
    'hero.subtitleStrong': 'Every number reproducible from the code.',
    'hero.profilesSupported': '/ {total} profiles supported',
    'hero.host': 'host',
    'hero.cores': 'cores',

    // hero KPI cards
    'kpi.peakHttp': 'peak · http',
    'kpi.peakQueue': 'peak · queue',
    'kpi.nativeIdle': 'native idle',
    'kpi.nativeColdStart': 'native cold start',
    'kpi.reqs': 'req/s',
    'kpi.mbRam': 'MB ram',
    'kpi.dockerTo200': 'docker → 200',

    // sample banner
    'sample.title': 'Sample data',
    'sample.body1': ' — illustrative, not real measurements. Run ',
    'sample.body2': ' to replace it with measured results.',

    // filters
    'filters.ingest': 'ingest',
    'filters.stack': 'stack',
    'filters.paradigm': 'paradigm',
    'filters.packaging': 'packaging',

    // app sections
    'section.comparison': 'comparison',
    'section.variantMatrix': 'Variant matrix',
    'section.diagrams': 'diagrams',
    'section.atGlance': 'At a glance',
    'section.resourceScaling': 'resource scaling',
    'section.underPressure': 'Under pressure',
    'section.methodology': 'methodology',
    'section.whereItRan': 'Where it ran',
    'aside.shown': '{n} shown · {limit} · {mode}',
    'aside.limitMode': '{limit} · {mode}',
    'aside.envelopes': '{n} envelopes · ingest http',

    // matrix limit selector + description
    'matrix.limit': 'limit',
    'matrix.queueBaselineOnly': 'queue measured at baseline only',
    'matrix.queue.lead': 'queue',
    'matrix.queue.mid': '· async ',
    'matrix.queue.accept': 'accept / enqueue',
    'matrix.queue.measuredAt': ' (202 Accepted), measured at ',
    'matrix.queue.ranked': '. Ranked ',
    'matrix.queue.withinOnly': 'within queue only',
    'matrix.queue.tail': ' — not comparable to http (different unit of work).',
    'matrix.http.lead': 'http',
    'matrix.http.mid': ' · full synchronous persist per request, measured at ',
    'matrix.http.switch': '. Switch the ',
    'matrix.http.limitWord': 'limit',
    'matrix.http.rerank': ' to re-rank the matrix at another envelope; the trend across all four is in ',
    'matrix.http.section': '§03 Under pressure',
    'matrix.http.tail': '.',

    // loading / error
    'app.loading': 'loading signal…',
    'app.loadError': 'could not load consolidated-results.json — {error}',

    // comparison table
    'table.variant': 'Variant',
    'table.notSupported': 'not supported',
    'table.noMatch': 'No variants match the current filters.',
    'table.legend': 'Teal = best in column · click a row for detail + source',
    'col.throughput': 'Throughput',
    'col.p99': 'p99',
    'col.startup': 'Cold start',
    'col.idleRss': 'Idle RSS',
    'col.image': 'Image',
    'col.efficiency': 'Efficiency',

    // charts
    'charts.throughput.title': 'Throughput',
    'charts.throughput.sub': 'req/s at fixed load · higher is better',
    'charts.coldStart.title': 'Cold start',
    'charts.coldStart.sub': 'docker run → health 200 · ms (log scale)',
    'charts.idleRss.title': 'Idle RSS',
    'charts.idleRss.sub': 'resident memory after 30s idle · MB',
    'charts.latency.title': 'Latency distribution',
    'charts.latency.sub': 'p50 / p95 / p99 / p99.9 · ms · the tail separates paradigms',

    // scaling section
    'scaling.limit': 'limit',
    'scaling.trend': 'Trend',
    'scaling.dbCeiling': 'DB-bound ceiling',
    'scaling.leadsThrough4.suffix': ' leads through 4 CPU',
    'scaling.tightMid': ' leads tight → ',
    'scaling.roomyTail': ' leads roomy',
    'scaling.nativeExcluded': 'native excluded — R2DBC native unsupported',
    'scaling.bestWorst': '{metric} · best → worst',
    'scaling.tableVariant': 'variant',
    'smetric.throughputRps': 'Throughput',
    'smetric.p99Ms': 'p99 latency',
    'smetric.idleRssMb': 'Idle RSS',
    'scaling.narr.1': 'Same workload, three resource envelopes. ',
    'scaling.narr.native': 'Native',
    'scaling.narr.2': ' starts ahead in the tight box (least memory, no JIT warmup) — up to ',
    'scaling.narr.mult': '2.1×',
    'scaling.narr.3': ' for imperative at 1 CPU / 512 MB. The ',
    'scaling.narr.jvm': 'JVM',
    'scaling.narr.4': ' scales harder as cores arrive (JIT pays off) and crosses over; by ',
    'scaling.narr.converge': '4 CPU / 2 GB everything converges near the DB-bound ceiling',
    'scaling.narr.5': ' — the extra cores buy little because Postgres, not the app, is the limit. http ingestion only.',

    // variant drawer
    'drawer.ingest': 'ingest: {mode}',
    'drawer.viewSource': "View this variant's source on GitHub",
    'drawer.notSupportedTitle': 'Not supported — documented finding',
    'drawer.noMetrics': 'No metrics for this variant.',
    'drawer.closePanel': 'Close panel',
    'drawer.sec.throughputLatency': 'Throughput & latency',
    'drawer.sec.startup': 'Startup',
    'drawer.sec.memoryCpu': 'Memory & CPU',
    'drawer.sec.footprint': 'Footprint & efficiency',
    'drawer.f.throughput': 'Throughput (req/s)',
    'drawer.f.errorRate': 'Error rate',
    'drawer.f.coldStart': 'Cold start',
    'drawer.f.timeToFirst': 'Time to first request',
    'drawer.f.warmup': 'Warm-up to stable',
    'drawer.f.idleRss': 'Idle RSS',
    'drawer.f.underLoadRss': 'Under-load RSS (peak)',
    'drawer.f.underLoadCpu': 'Under-load CPU',
    'drawer.f.imageSize': 'Image size',
    'drawer.f.rpsPerMb': 'req/s per MB',
    'drawer.f.rpsPerCpu': 'req/s per %CPU',

    // environment panel
    'env.intro1':
      'Identical for every variant — the precondition for a fair comparison. Verified during the run with ',
    'env.intro2': '.',
    'env.measured': 'measured · {date}',
    'env.k.cpu': 'CPU',
    'env.k.cores': 'Cores',
    'env.k.ram': 'RAM',
    'env.k.os': 'OS',
    'env.k.java': 'Java',
    'env.k.graalvm': 'GraalVM',
    'env.k.springBoot': 'Spring Boot',
    'env.k.quarkus': 'Quarkus',
    'env.k.resourceLimits': 'Resource limits',
    'env.k.sweepBaseline': 'Sweep / baseline',
    'env.v.swept': 'swept {range}',
    'env.v.envelopes': '{count} envelopes · matrix at {baseline}',

    // footer
    'footer.text1': 'PulseGrid — every number auditable against the code. Charts and findings regenerate from ',
    'footer.text2': '.',
    'footer.source': 'Source on GitHub',
  },

  es: {
    // top bar / nav
    'nav.offlineMeasured': 'medido offline',
    'nav.source': 'Código',
    'nav.langLabel': 'Idioma',

    // hero
    'hero.eyebrow': 'Spring Boot 4 vs Quarkus · JVM vs GraalVM native',
    'hero.titleA': 'Qué paradigma de concurrencia aguanta',
    'hero.titleB': 'cuando más importa.',
    'hero.subtitle':
      'Virtual Threads, WebFlux, Mutiny y blocking — en JVM y GraalVM native, bajo ingesta real de alta concurrencia.',
    'hero.subtitleStrong': 'Cada número reproducible desde el código.',
    'hero.profilesSupported': '/ {total} perfiles soportados',
    'hero.host': 'host',
    'hero.cores': 'núcleos',

    // hero KPI cards
    'kpi.peakHttp': 'pico · http',
    'kpi.peakQueue': 'pico · queue',
    'kpi.nativeIdle': 'idle nativo',
    'kpi.nativeColdStart': 'arranque frío nativo',
    'kpi.reqs': 'req/s',
    'kpi.mbRam': 'MB ram',
    'kpi.dockerTo200': 'docker → 200',

    // sample banner
    'sample.title': 'Datos de muestra',
    'sample.body1': ' — ilustrativos, no son mediciones reales. Ejecuta ',
    'sample.body2': ' para reemplazarlos con resultados medidos.',

    // filters
    'filters.ingest': 'ingesta',
    'filters.stack': 'stack',
    'filters.paradigm': 'paradigma',
    'filters.packaging': 'empaquetado',

    // app sections
    'section.comparison': 'comparación',
    'section.variantMatrix': 'Matriz de variantes',
    'section.diagrams': 'diagramas',
    'section.atGlance': 'De un vistazo',
    'section.resourceScaling': 'escalado de recursos',
    'section.underPressure': 'Bajo presión',
    'section.methodology': 'metodología',
    'section.whereItRan': 'Dónde se ejecutó',
    'aside.shown': '{n} mostradas · {limit} · {mode}',
    'aside.limitMode': '{limit} · {mode}',
    'aside.envelopes': '{n} envelopes · ingesta http',

    // matrix limit selector + description
    'matrix.limit': 'límite',
    'matrix.queueBaselineOnly': 'queue medido solo en baseline',
    'matrix.queue.lead': 'queue',
    'matrix.queue.mid': ' · ',
    'matrix.queue.accept': 'aceptar / encolar',
    'matrix.queue.measuredAt': ' asíncrono (202 Accepted), medido en ',
    'matrix.queue.ranked': '. Ordenado ',
    'matrix.queue.withinOnly': 'solo dentro de queue',
    'matrix.queue.tail': ' — no comparable con http (distinta unidad de trabajo).',
    'matrix.http.lead': 'http',
    'matrix.http.mid': ' · persistencia síncrona completa por request, medido en ',
    'matrix.http.switch': '. Cambia el ',
    'matrix.http.limitWord': 'límite',
    'matrix.http.rerank': ' para re-ordenar la matriz en otro envelope; la tendencia en los cuatro está en ',
    'matrix.http.section': '§03 Bajo presión',
    'matrix.http.tail': '.',

    // loading / error
    'app.loading': 'cargando señal…',
    'app.loadError': 'no se pudo cargar consolidated-results.json — {error}',

    // comparison table
    'table.variant': 'Variante',
    'table.notSupported': 'no soportado',
    'table.noMatch': 'Ninguna variante coincide con los filtros actuales.',
    'table.legend': 'Verde azulado = mejor en la columna · clic en una fila para detalle + código',
    'col.throughput': 'Rendimiento',
    'col.p99': 'p99',
    'col.startup': 'Arranque frío',
    'col.idleRss': 'RSS inactivo',
    'col.image': 'Imagen',
    'col.efficiency': 'Eficiencia',

    // charts
    'charts.throughput.title': 'Rendimiento',
    'charts.throughput.sub': 'req/s a carga fija · más alto es mejor',
    'charts.coldStart.title': 'Arranque en frío',
    'charts.coldStart.sub': 'docker run → health 200 · ms (escala log)',
    'charts.idleRss.title': 'RSS inactivo',
    'charts.idleRss.sub': 'memoria residente tras 30s inactivo · MB',
    'charts.latency.title': 'Distribución de latencia',
    'charts.latency.sub': 'p50 / p95 / p99 / p99.9 · ms · la cola separa los paradigmas',

    // scaling section
    'scaling.limit': 'límite',
    'scaling.trend': 'Tendencia',
    'scaling.dbCeiling': 'techo por BD',
    'scaling.leadsThrough4.suffix': ' lidera hasta 4 CPU',
    'scaling.tightMid': ' lidera ajustado → ',
    'scaling.roomyTail': ' lidera holgado',
    'scaling.nativeExcluded': 'native excluido — R2DBC native no soportado',
    'scaling.bestWorst': '{metric} · mejor → peor',
    'scaling.tableVariant': 'variante',
    'smetric.throughputRps': 'Rendimiento',
    'smetric.p99Ms': 'latencia p99',
    'smetric.idleRssMb': 'RSS inactivo',
    'scaling.narr.1': 'Mismo workload, tres envelopes de recursos. ',
    'scaling.narr.native': 'Native',
    'scaling.narr.2': ' arranca por delante en la caja ajustada (menos memoria, sin warmup de JIT) — hasta ',
    'scaling.narr.mult': '2.1×',
    'scaling.narr.3': ' para imperative en 1 CPU / 512 MB. La ',
    'scaling.narr.jvm': 'JVM',
    'scaling.narr.4': ' escala más fuerte conforme llegan núcleos (el JIT rinde) y lo cruza; para ',
    'scaling.narr.converge': '4 CPU / 2 GB todo converge cerca del techo por BD',
    'scaling.narr.5':
      ' — los núcleos extra aportan poco porque el límite es Postgres, no la app. Solo ingesta http.',

    // variant drawer
    'drawer.ingest': 'ingesta: {mode}',
    'drawer.viewSource': 'Ver el código de esta variante en GitHub',
    'drawer.notSupportedTitle': 'No soportado — hallazgo documentado',
    'drawer.noMetrics': 'Sin métricas para esta variante.',
    'drawer.closePanel': 'Cerrar panel',
    'drawer.sec.throughputLatency': 'Rendimiento y latencia',
    'drawer.sec.startup': 'Arranque',
    'drawer.sec.memoryCpu': 'Memoria y CPU',
    'drawer.sec.footprint': 'Huella y eficiencia',
    'drawer.f.throughput': 'Rendimiento (req/s)',
    'drawer.f.errorRate': 'Tasa de error',
    'drawer.f.coldStart': 'Arranque en frío',
    'drawer.f.timeToFirst': 'Tiempo al primer request',
    'drawer.f.warmup': 'Calentamiento a estable',
    'drawer.f.idleRss': 'RSS inactivo',
    'drawer.f.underLoadRss': 'RSS bajo carga (pico)',
    'drawer.f.underLoadCpu': 'CPU bajo carga',
    'drawer.f.imageSize': 'Tamaño de imagen',
    'drawer.f.rpsPerMb': 'req/s por MB',
    'drawer.f.rpsPerCpu': 'req/s por %CPU',

    // environment panel
    'env.intro1':
      'Idénticos para cada variante — la precondición para una comparación justa. Verificado durante la corrida con ',
    'env.intro2': '.',
    'env.measured': 'medido · {date}',
    'env.k.cpu': 'CPU',
    'env.k.cores': 'Núcleos',
    'env.k.ram': 'RAM',
    'env.k.os': 'SO',
    'env.k.java': 'Java',
    'env.k.graalvm': 'GraalVM',
    'env.k.springBoot': 'Spring Boot',
    'env.k.quarkus': 'Quarkus',
    'env.k.resourceLimits': 'Límites de recursos',
    'env.k.sweepBaseline': 'Barrido / baseline',
    'env.v.swept': 'barrido {range}',
    'env.v.envelopes': '{count} envelopes · matriz en {baseline}',

    // footer
    'footer.text1':
      'PulseGrid — cada número auditable contra el código. Las gráficas y los hallazgos se regeneran desde ',
    'footer.text2': '.',
    'footer.source': 'Código en GitHub',

    // metadata labels — only descriptive English terms are translated; product /
    // feature names (Spring Boot 4, Virtual Threads, WebFlux, Mutiny, Quarkus, JVM)
    // are proper nouns and intentionally kept.
    'meta.Native': 'Nativo',
    'meta.Imperative': 'Imperativo',
    'meta.Blocking': 'Bloqueante',
    'meta.Reactive (Mutiny)': 'Reactivo (Mutiny)',

    // variant notes (prose authored in English in the data file; Spanish here)
    'note.envelopeUnsupported': 'No soportado en este envelope.',
    'note.spring-vt-native.queue':
      'El modo queue en native ya está soportado en el código. Los beans de queue eran @ConditionalOnProperty, que Spring AOT congela en build time — la imagen native compilada para http los podaba. Ahora siempre están presentes y son lazy, y el @KafkaListener del consumer solo auto-arranca cuando ingest-mode=queue (SpEL, resuelto en runtime), así que un único binario sirve ambos modos como Quarkus. Verificado en JVM; este flag sigue en false hasta re-medir en un host con GraalVM (sin throughput fabricado). Ver docs/architecture/RISKS.md (R1b).',
    'note.spring-webflux-native.http':
      'Compila y arranca (health 200). Los INSERT de R2DBC fallaban antes en la imagen native (~95% de error; las lecturas que pasaban no ligan parámetros). Causa raíz: un hueco de reflexión/codec en el path de bind/encode escalar de r2dbc-postgresql. Fix aplicado: R2dbcNativeHints registra reflexión para los tipos JDK ligados y las clases codec del driver. Verificado en JVM; este flag sigue en false hasta re-correr el benchmark native (sin throughput fabricado). Ver docs/architecture/RISKS.md (R1).',
    'note.spring-webflux-native.queue':
      'Compila y arranca (health 200). Los INSERT de R2DBC fallaban antes en la imagen native (~95% de error; las lecturas que pasaban no ligan parámetros). Causa raíz: un hueco de reflexión/codec en el path de bind/encode escalar de r2dbc-postgresql. Fix aplicado: R2dbcNativeHints registra reflexión para los tipos JDK ligados y las clases codec del driver. Verificado en JVM; este flag sigue en false hasta re-correr el benchmark native (sin throughput fabricado). Ver docs/architecture/RISKS.md (R1).',
  },
};

function interpolate(str, vars) {
  if (!vars) return str;
  return str.replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? String(vars[k]) : `{${k}}`));
}

export function detectLang() {
  if (typeof navigator === 'undefined') return 'en';
  const list = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language];
  for (const l of list) {
    if (l && l.toLowerCase().startsWith('es')) return 'es';
    if (l && l.toLowerCase().startsWith('en')) return 'en';
  }
  return 'en';
}

function initialLang() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'en' || stored === 'es') return stored;
  } catch {
    /* localStorage unavailable (private mode) — fall through to detection */
  }
  return detectLang();
}

const I18nContext = createContext({
  lang: 'en',
  setLang: () => {},
  t: (k) => k,
  tn: (_k, fallback) => fallback,
  tMeta: (label) => label,
  localizedNote: (v) => v?.notes || '',
});

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(initialLang);

  useEffect(() => {
    if (typeof document !== 'undefined') document.documentElement.lang = lang;
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      /* ignore persistence failures */
    }
  }, [lang]);

  const setLang = (l) => LANGS.includes(l) && setLangState(l);
  const t = (key, vars) => {
    const table = DICT[lang] || DICT.en;
    const value = table[key] ?? DICT.en[key] ?? key;
    return interpolate(value, vars);
  };

  // Translate-or-fallback: returns the current-language value only if the key
  // exists for this language, otherwise the supplied fallback (NOT the key string).
  const tn = (key, fallback, vars) => {
    const value = (DICT[lang] || {})[key];
    return value != null ? interpolate(value, vars) : fallback;
  };

  // Localize a metadata label (paradigm/packaging) keyed by its English value.
  // Proper nouns with no 'meta.*' entry fall through unchanged.
  const tMeta = (label) => (label == null ? label : tn(`meta.${label}`, label));

  // Localize a variant's "notes" prose. English is sourced from the data file
  // (single source of truth); Spanish comes from the dictionary keyed by id+mode,
  // falling back to the raw note (and a translated generic for envelope drops).
  const localizedNote = (variant) => {
    if (!variant) return '';
    const table = DICT[lang] || {};
    const key = `note.${variant.id}.${variant.ingestMode}`;
    if (table[key]) return table[key];
    if (variant.notes === 'Not supported at this envelope.' && table['note.envelopeUnsupported']) {
      return table['note.envelopeUnsupported'];
    }
    return variant.notes || '';
  };

  return (
    <I18nContext.Provider value={{ lang, setLang, t, tn, tMeta, localizedNote }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
