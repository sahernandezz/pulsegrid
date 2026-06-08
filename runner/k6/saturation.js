// =============================================================================
// PulseGrid · k6 saturation / backpressure probe (OPEN model)
// =============================================================================
// Unlike ingest.js (closed-loop constant-vus, which self-throttles), this uses
// constant-arrival-rate: k6 fires RATE req/s regardless of how the server copes.
// That's what reveals the break-point and the *degradation mode*:
//   - graceful  -> achieved≈offered, errors stay ~0, p99 rises moderately
//   - saturated -> achieved < offered (dropped iterations), p99 explodes, errors climb
//   - collapse  -> timeouts / 5xx / the container OOMs
//
// The runner sweeps RATE upward; the knee is where achieved stops tracking offered.
//
// Env: BASE_URL, MODE (http|queue), RATE (req/s offered), DURATION (s),
//      PREALLOC (pre-allocated VUs), MAXVUS, SUMMARY_PATH.
// =============================================================================
import http from 'k6/http';
import { check } from 'k6';

const BASE = __ENV.BASE_URL || 'http://localhost:8080';
const MODE = __ENV.MODE || 'http';
const RATE = parseInt(__ENV.RATE || '2000', 10);
const DURATION = (__ENV.DURATION || '20') + 's';
const PREALLOC = parseInt(__ENV.PREALLOC || '300', 10);
const MAXVUS = parseInt(__ENV.MAXVUS || '3000', 10);
const SUMMARY_PATH = __ENV.SUMMARY_PATH || 'saturation.json';

const EXPECT_STATUS = MODE === 'queue' ? 202 : 201;

export const options = {
  scenarios: {
    open: {
      executor: 'constant-arrival-rate',
      rate: RATE,
      timeUnit: '1s',
      duration: DURATION,
      preAllocatedVUs: PREALLOC,
      maxVUs: MAXVUS,
    },
  },
  summaryTrendStats: ['avg', 'med', 'p(95)', 'p(99)', 'p(99.9)', 'max'],
  discardResponseBodies: true,
};

const TYPES = ['CPU', 'MEMORY', 'TEMPERATURE', 'LATENCY'];
const REGIONS = ['us-east', 'us-west', 'eu-central', 'ap-south'];
const pick = (a) => a[Math.floor(Math.random() * a.length)];

export default function () {
  const payload = JSON.stringify({
    deviceId: 'dev-' + Math.floor(Math.random() * 10000),
    metricType: pick(TYPES),
    value: Math.random() * 100,
    timestamp: new Date().toISOString(),
    region: pick(REGIONS),
  });
  const res = http.post(`${BASE}/api/events`, payload, {
    headers: { 'Content-Type': 'application/json' },
    timeout: '10s',
  });
  check(res, { ok: (r) => r.status === EXPECT_STATUS });
}

export function handleSummary(data) {
  const m = data.metrics;
  const durMs = (data.state && data.state.testRunDurationMs) || 1;
  const httpReqs = (m.http_reqs && m.http_reqs.values.count) || 0;
  const dur = m.http_req_duration ? m.http_req_duration.values : {};
  const failed = m.http_req_failed ? m.http_req_failed.values.rate : 0;
  // dropped_iterations = requests k6 could NOT start at the target rate (saturation signal).
  const dropped = (m.dropped_iterations && m.dropped_iterations.values.count) || 0;

  const out = {
    mode: MODE,
    offeredRate: RATE,
    achievedRps: httpReqs / (durMs / 1000),
    droppedIterations: dropped,
    errorRatePct: failed * 100,
    p95: dur['p(95)'],
    p99: dur['p(99)'],
    p999: dur['p(99.9)'],
    max: dur['max'],
  };
  const line = `[saturation ${MODE}] offered=${RATE} achieved=${out.achievedRps.toFixed(0)} ` +
    `dropped=${dropped} p99=${(out.p99 || 0).toFixed(0)}ms err=${out.errorRatePct.toFixed(1)}%\n`;
  const r = { stdout: line };
  r[SUMMARY_PATH] = JSON.stringify(out, null, 2);
  return r;
}
