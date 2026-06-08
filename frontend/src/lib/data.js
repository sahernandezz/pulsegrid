import { useEffect, useState } from 'react';

// Where the variant source lives on GitHub (used by the per-variant code links).
// Change this to the published repo URL.
export const REPO_URL = 'https://github.com/sahernandezz/pulsegrid';

// Project author / creator — links the showcase back to its author.
export const AUTHOR = {
  name: 'Sergio Hernández',
  fullName: 'Sergio Alejandro Hernández Zambrano',
  role: 'Backend Software Engineer',
  portfolio: 'https://sahernandezz.web.app',
  linkedin: 'https://www.linkedin.com/in/sergio-alejandro-hernandez-zambrano',
  github: 'https://github.com/sahernandezz',
};

// --- Metadata for badges / colors -------------------------------------------
export const PARADIGM_META = {
  'virtual-threads': { short: 'VT', label: 'Virtual Threads', tone: 'pulse' },
  webflux: { short: 'WebFlux', label: 'WebFlux (Reactor)', tone: 'signal' },
  reactive: { short: 'Mutiny', label: 'Reactive (Mutiny)', tone: 'signal' },
  imperative: { short: 'Blocking', label: 'Imperative', tone: 'warn' },
};

export const PACKAGING_META = {
  jvm: { label: 'JVM', tone: 'signal' },
  native: { label: 'Native', tone: 'pulse' },
};

export const STACK_META = {
  'spring-boot-4': { label: 'Spring Boot 4' },
  quarkus: { label: 'Quarkus' },
};

// --- Source links ------------------------------------------------------------
export function codeLink(v) {
  if (v.stack === 'spring-boot-4') {
    const set = v.paradigm === 'webflux' ? 'java-webflux' : 'java-vt';
    return `${REPO_URL}/tree/main/backends/spring/src/main/${set}`;
  }
  const set = v.paradigm === 'imperative' ? 'java-imperative' : 'java-reactive';
  return `${REPO_URL}/tree/main/backends/quarkus/src/main/${set}`;
}

// --- Table columns (the comparison matrix) ----------------------------------
export const COLUMNS = [
  { key: 'throughput', label: 'Throughput', unit: 'req/s', better: 'max',
    get: (v) => v.metrics?.throughputRps?.median, fmt: fmtInt },
  { key: 'p99', label: 'p99', unit: 'ms', better: 'min',
    get: (v) => v.metrics?.latencyMs?.p99, fmt: fmtMs },
  { key: 'startup', label: 'Cold start', unit: '', better: 'min',
    get: (v) => v.metrics?.startupMs?.median, fmt: fmtDuration },
  { key: 'idleRss', label: 'Idle RSS', unit: 'MB', better: 'min',
    get: (v) => v.metrics?.idleRssMb?.median, fmt: fmtMb },
  { key: 'image', label: 'Image', unit: 'MB', better: 'min',
    get: (v) => v.metrics?.imageSizeMb?.value, fmt: fmtMb },
  { key: 'efficiency', label: 'Efficiency', unit: 'req/s·MB', better: 'max',
    get: (v) => v.metrics?.efficiency?.rpsPerMb, fmt: fmtDec },
];

// For each column, the id of the best supported variant (for highlighting).
export function bestPerColumn(variants) {
  const best = {};
  for (const col of COLUMNS) {
    let winner = null;
    let winVal = null;
    for (const v of variants) {
      if (!v.supported) continue;
      const val = col.get(v);
      if (val == null) continue;
      if (winVal == null || (col.better === 'max' ? val > winVal : val < winVal)) {
        winVal = val;
        winner = v.id;
      }
    }
    best[col.key] = winner;
  }
  return best;
}

// --- Filtering ---------------------------------------------------------------
export function filterVariants(variants, { mode, stacks, paradigms, packagings }) {
  return variants.filter((v) => {
    if (v.ingestMode !== mode) return false;
    if (stacks.length && !stacks.includes(v.stack)) return false;
    if (paradigms.length && !paradigms.includes(v.paradigm)) return false;
    if (packagings.length && !packagings.includes(v.packaging)) return false;
    return true;
  });
}

// --- Formatting --------------------------------------------------------------
export function fmtInt(v) {
  if (v == null) return '—';
  return Math.round(v).toLocaleString('en-US');
}
export function fmtMs(v) {
  if (v == null) return '—';
  return `${v.toFixed(1)} ms`;
}
export function fmtDuration(v) {
  if (v == null) return '—';
  return v >= 1000 ? `${(v / 1000).toFixed(2)} s` : `${Math.round(v)} ms`;
}
export function fmtMb(v) {
  if (v == null) return '—';
  return `${Math.round(v)} MB`;
}
export function fmtDec(v) {
  if (v == null) return '—';
  return v.toFixed(1);
}
export function fmtPct(v) {
  if (v == null) return '—';
  return `${v.toFixed(2)}%`;
}

// --- Resource-scaling dimension ---------------------------------------------
// Metrics charted across resource envelopes (1cpu/512m → 4cpu/2g).
export const SCALING_METRICS = [
  { key: 'throughputRps', label: 'Throughput', unit: 'req/s', better: 'max', fmt: fmtInt },
  { key: 'p99Ms', label: 'p99 latency', unit: 'ms', better: 'min', fmt: (v) => (v == null ? '—' : Math.round(v).toLocaleString('en-US')) },
  { key: 'idleRssMb', label: 'Idle RSS', unit: 'MB', better: 'min', fmt: (v) => (v == null ? '—' : Math.round(v).toLocaleString('en-US')) },
];

// Group the scaling variants into native↔JVM pairs by (stack, paradigm) so each
// panel can show the crossover. Pairs first, webflux (jvm-only) last.
export function scalingGroups(scaling) {
  if (!scaling) return [];
  const by = new Map();
  for (const v of scaling.variants) {
    const key = `${v.stack}|${v.paradigm}`;
    if (!by.has(key)) by.set(key, { key, stack: v.stack, paradigm: v.paradigm, jvm: null, native: null });
    by.get(key)[v.packaging] = v;
  }
  const order = ['quarkus|reactive', 'spring-boot-4|virtual-threads', 'quarkus|imperative', 'spring-boot-4|webflux'];
  return [...by.values()].sort(
    (a, b) => (order.indexOf(a.key) + 1 || 99) - (order.indexOf(b.key) + 1 || 99),
  );
}

// Shared [0, niceCeil] domain for a metric across every variant/envelope, so the
// small-multiple panels are visually comparable.
export function scalingDomain(scaling, metricKey) {
  if (!scaling) return [0, 1];
  let max = 0;
  for (const v of scaling.variants) {
    for (const p of Object.values(v.points)) {
      if (p.supported && p[metricKey] != null) max = Math.max(max, p[metricKey]);
    }
  }
  const step = max > 5000 ? 2000 : max > 500 ? 100 : 50;
  return [0, Math.ceil(max / step) * step];
}

// Map scaling points to the consolidated metric shape so the comparison matrix
// and the "at a glance" charts can render ANY envelope, not just the baseline.
// http has all 4 envelopes (from the sweep); queue was only measured at the
// baseline, so it falls back to the canonical consolidated run.
export function buildLimitVariants(scalingHttp, scalingQueue, consolidated, mode, limitLabel) {
  const scaling = mode === 'queue' ? scalingQueue : scalingHttp;
  if (!scaling) {
    // no per-limit data for this mode yet → fall back to the baseline run
    return (consolidated?.variants || []).filter((v) => v.ingestMode === mode);
  }
  const rows = scaling.variants.map((sv) => {
    const p = sv.points[limitLabel] || {};
    const ok = !!p.supported;
    const rps = ok ? p.throughputRps : null;
    const rss = ok ? p.idleRssMb : null;
    return {
      id: sv.id,
      label: sv.label,
      stack: sv.stack,
      paradigm: sv.paradigm,
      packaging: sv.packaging,
      ingestMode: mode,
      supported: ok,
      notes: ok ? '' : p.note || 'Not supported at this envelope.',
      metrics: ok
        ? {
            throughputRps: { median: rps },
            latencyMs: { p50: p.p50Ms, p95: p.p95Ms, p99: p.p99Ms, p999: p.p999Ms },
            startupMs: { median: p.startupMs },
            idleRssMb: { median: rss },
            imageSizeMb: { value: p.imageSizeMb },
            efficiency: { rpsPerMb: p.efficiencyRpsPerMb ?? (rps != null && rss ? rps / rss : null) },
          }
        : null,
    };
  });
  // merge in any baseline variants for this mode the sweep didn't cover (e.g. the
  // unsupported natives) so the matrix still lists them with their documented note
  const have = new Set(rows.map((r) => r.id));
  for (const cv of consolidated?.variants || []) {
    if (cv.ingestMode === mode && !have.has(cv.id)) rows.push(cv);
  }
  return rows;
}

// "1–8 CPU · 512m–4g" — the swept range, for honest hero / environment labels.
export function limitsRange(scaling) {
  const env = scaling?.envelopes || [];
  if (!env.length) return null;
  const cpus = env.map((e) => e.cpus);
  return {
    count: env.length,
    label: `${Math.min(...cpus)}–${Math.max(...cpus)} CPU · ${env[0].memory}–${env[env.length - 1].memory}`,
  };
}

export function useScaling() {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  useEffect(() => {
    const url = `${import.meta.env.BASE_URL}scaling-results.json`;
    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status} loading ${url}`);
        return r.json();
      })
      .then((data) => setState({ data, loading: false, error: null }))
      .catch((error) => setState({ data: null, loading: false, error: error.message }));
  }, []);
  return state;
}

// Per-limit queue data (scaling-queue-results.json). Tolerates a missing file
// (returns null) so the UI falls back to the baseline before the queue sweep ran.
export function useScalingQueue() {
  const [data, setData] = useState(null);
  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}scaling-queue-results.json`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setData(d))
      .catch(() => setData(null));
  }, []);
  return { data };
}

// --- Data hook ---------------------------------------------------------------
export function useConsolidated() {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  useEffect(() => {
    const url = `${import.meta.env.BASE_URL}consolidated-results.json`;
    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status} loading ${url}`);
        return r.json();
      })
      .then((data) => setState({ data, loading: false, error: null }))
      .catch((error) => setState({ data: null, loading: false, error: error.message }));
  }, []);
  return state;
}
