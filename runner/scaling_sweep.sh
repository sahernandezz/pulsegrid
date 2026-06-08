#!/usr/bin/env bash
# =============================================================================
# scaling_sweep.sh [http|queue] — Resource-envelope scaling dimension.
#
# Re-runs the ingestion benchmark across three CPU/memory envelopes to chart how
# each paradigm scales with resources (and which survive a 512 MB floor).
# Container limits are injected via PG_CPUS / PG_MEM / PG_CPUSET, which the
# compose &res_limits anchor and the runner's CONTAINER_LIMITS both read.
#
#   ./scaling_sweep.sh        # http (default) -> scaling-results.json
#   ./scaling_sweep.sh queue  # queue          -> scaling-queue-results.json
#
# Output: one consolidated file per envelope under benchmark/results/scaling/
# (suffixed -queue for queue), then scaling_report.py merges them.
#
# Ceiling is 4 CPU / 2 GB on purpose: the host has 8 cores, so an 8-CPU envelope
# would pin the backend to *all* cores and let Postgres + k6 + the OS contend on
# the same ones — contaminated measurement rather than clean scaling headroom.
# =============================================================================
set -uo pipefail
cd "$(dirname "$0")/.."

MODE="${1:-http}"
SUFFIX=""
[ "$MODE" = "queue" ] && SUFFIX="-queue"

# http sweeps every variant (webflux-native excluded — unsupported); queue sweeps
# only the queue-capable set (vt-native + webflux-native queue are unsupported and
# are merged back from the baseline run by the frontend).
if [ "$MODE" = "queue" ]; then
  VARIANTS="spring-vt-jvm,spring-webflux-jvm,quarkus-reactive-jvm,quarkus-imperative-jvm,quarkus-reactive-native,quarkus-imperative-native"
else
  VARIANTS="spring-vt-jvm,spring-vt-native,spring-webflux-jvm,quarkus-reactive-jvm,quarkus-reactive-native,quarkus-imperative-jvm,quarkus-imperative-native"
fi
OUTDIR="benchmark/results/scaling"
mkdir -p "$OUTDIR"

run_env () {
  local label="$1" cpus="$2" mem="$3" cpuset="$4"
  echo ""
  echo "############################################################"
  echo "# ENVELOPE $label ($MODE)  ->  ${cpus} CPU / ${mem} / cpuset ${cpuset}"
  echo "# $(date '+%H:%M:%S')"
  echo "############################################################"
  PG_CPUS="$cpus" PG_MEM="$mem" PG_CPUSET="$cpuset" \
    python3 runner/run_benchmarks.py \
      --variants runner/variants.full.yaml \
      --only "$VARIANTS" \
      --modes "$MODE" \
      --runs 1 \
      --skip-build \
      --output "$OUTDIR/$label$SUFFIX.json"
  echo "# ENVELOPE $label ($MODE) done -> $OUTDIR/$label$SUFFIX.json ($(date '+%H:%M:%S'))"
}

START=$(date +%s)
run_env "1cpu-512m" 1 512m 0
run_env "2cpu-1g"   2 1g   0,1
run_env "4cpu-2g"   4 2g   0,1,2,3
END=$(date +%s)

echo ""
echo "=== SWEEP ($MODE) DONE in $(( (END-START)/60 ))m $(( (END-START)%60 ))s ==="
python3 runner/scaling_report.py "$OUTDIR" "$MODE" && echo "=== REPORT WRITTEN ==="
