// =============================================================================
// PulseGrid · k6 load script (ingestion + light read mix)
// =============================================================================
// Drives the SAME load against every variant (the request/response shape is
// byte-identical across variants — see docs/API.md), so results are comparable.
//
// Env (set by runner/run_benchmarks.py):
//   BASE_URL      target base url (default http://localhost:8080)
//   MODE          http | queue   (affects the expected success status: 201 vs 202)
//   VUS           number of virtual users (constant)
//   DURATION      measured load duration in seconds
//   READ_RATIO    fraction of iterations that GET /api/aggregates (default 0.05)
//   SUMMARY_PATH  where handleSummary writes the parsed metrics JSON
// =============================================================================
import http from 'k6/http';
import { check } from 'k6';

const BASE = __ENV.BASE_URL || 'http://localhost:8080';
const MODE = __ENV.MODE || 'http';
const VUS = parseInt(__ENV.VUS || '50', 10);
const DURATION = (__ENV.DURATION || '60') + 's';
const READ_RATIO = parseFloat(__ENV.READ_RATIO || '0.05');
const SUMMARY_PATH = __ENV.SUMMARY_PATH || 'summary.json';

// http  -> synchronous persist -> 201 Created
// queue -> async enqueue       -> 202 Accepted
const EXPECT_STATUS = MODE === 'queue' ? 202 : 201;

export const options = {
  scenarios: {
    steady: { executor: 'constant-vus', vus: VUS, duration: DURATION },
  },
  // p99 / p99.9 only appear in the summary if we ask for them here.
  summaryTrendStats: ['avg', 'min', 'med', 'p(50)', 'p(90)', 'p(95)', 'p(99)', 'p(99.9)', 'max'],
  discardResponseBodies: true,
};

const TYPES = ['CPU', 'MEMORY', 'TEMPERATURE', 'LATENCY'];
const REGIONS = ['us-east', 'us-west', 'eu-central', 'ap-south'];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export default function () {
  // A small fraction of reads to exercise the query path under load.
  if (Math.random() < READ_RATIO) {
    http.get(`${BASE}/api/aggregates?metricType=${pick(TYPES)}`);
    return;
  }
  const payload = JSON.stringify({
    deviceId: 'dev-' + Math.floor(Math.random() * 10000),
    metricType: pick(TYPES),
    value: Math.random() * 100,
    timestamp: new Date().toISOString(),
    region: pick(REGIONS),
  });
  const res = http.post(`${BASE}/api/events`, payload, {
    headers: { 'Content-Type': 'application/json' },
  });
  check(res, { 'status ok': (r) => r.status === EXPECT_STATUS });
}

// Emit a compact, runner-friendly metrics JSON (and a one-line stdout summary).
export function handleSummary(data) {
  const m = data.metrics;
  const durMs = (data.state && data.state.testRunDurationMs) || 1;
  const httpReqs = (m.http_reqs && m.http_reqs.values.count) || 0;
  const dur = m.http_req_duration ? m.http_req_duration.values : {};
  const failed = m.http_req_failed ? m.http_req_failed.values.rate : 0;

  const out = {
    mode: MODE,
    vus: VUS,
    durationSec: durMs / 1000,
    throughputRps: httpReqs / (durMs / 1000),
    httpReqs: httpReqs,
    errorRatePct: failed * 100,
    latencyMs: {
      p50: dur['p(50)'],
      p95: dur['p(95)'],
      p99: dur['p(99)'],
      p999: dur['p(99.9)'],
      avg: dur['avg'],
      max: dur['max'],
    },
  };

  const line = `PulseGrid k6 [${MODE}] vus=${VUS} rps=${out.throughputRps.toFixed(0)} ` +
    `p99=${(out.latencyMs.p99 || 0).toFixed(1)}ms err=${out.errorRatePct.toFixed(2)}%\n`;

  const result = { stdout: line };
  result[SUMMARY_PATH] = JSON.stringify(out, null, 2);
  return result;
}
