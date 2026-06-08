#!/usr/bin/env bash
# =============================================================================
# cloud_run.sh — run the FULL PulseGrid suite on a dedicated multi-core host.
#
# Pins the app-under-test, Postgres/Kafka, and the k6 load generator to DISJOINT
# cores so nothing contends — which is exactly what the laptop couldn't do (8
# shared cores → the 8-CPU collapse + "DB tuning doesn't help"). Regenerates the
# three JSON files the frontend reads.
#
#   bash bench/cloud_run.sh
#
# Requires: Docker + compose, k6, python3 (+ pyyaml), repo checked out.
# Recommended host: >= 16 vCPU (e.g. AWS c7i.4xlarge, Hetzner CCX33). Minimum 8.
# Run it on a throwaway VM: provision -> run -> copy the JSON out -> destroy.
# =============================================================================
set -euo pipefail
cd "$(dirname "$0")/.."

N="$(nproc)"
if [ "$N" -lt 8 ]; then
  echo "ERROR: need >= 8 vCPU for clean separation (this host has $N)."; exit 1
fi
[ "$N" -lt 16 ] && echo "WARN: $N vCPU — 16+ recommended so each component gets real headroom."

# Core map. The app-under-test is pinned to cores 0-3 by the sweep (PG_CPUSET).
# Give Postgres/Kafka the next half of the remaining cores, and k6 the rest, so
# none of the three ever share a core.
DB_END=$(( 4 + (N - 4) / 2 - 1 ))
export PG_DB_CPUSET="4-${DB_END}"
export K6_CPUSET="$(( DB_END + 1 ))-$(( N - 1 ))"
# Keep the app/DB config identical to the laptop so this run isolates ONE change:
# dedicated cores. To then test DB knobs on the clean setup, re-run with e.g.
#   PG_POOL=128 PG_MAXCONN=300 PG_SYNC=off bash bench/cloud_run.sh

echo "================================================================"
echo " host vCPU : $N"
echo " app       : cores 0-3        (set per envelope by the sweep)"
echo " postgres  : cores $PG_DB_CPUSET   (pinned to its own cores)"
echo " k6        : cores $K6_CPUSET   (pinned)"
echo "================================================================"

VFULL="runner/variants.full.yaml"
RUNS="${RUNS:-1}"   # bump to 3 for a lower-noise final run

echo "=== [1/4] build all images (native builds are slow, ~30-40 min) ==="
for p in spring-vt-jvm spring-vt-native spring-webflux-jvm spring-webflux-native \
         quarkus-reactive-jvm quarkus-reactive-native quarkus-imperative-jvm quarkus-imperative-native; do
  echo "--- build $p ---"
  docker compose --profile infra --profile "$p" build "$p"
done

echo "=== [2/4] baseline run — 2 CPU / 1g, http+queue, all variants -> consolidated-results.json ==="
python3 runner/run_benchmarks.py --variants "$VFULL" --runs "$RUNS" --skip-build \
  --output consolidated-results.json

echo "=== [3/4] http scaling sweep (1/2/4 CPU) -> scaling-results.json ==="
bash runner/scaling_sweep.sh

echo "=== [4/4] queue scaling sweep (1/2/4 CPU) -> scaling-queue-results.json ==="
bash runner/scaling_sweep.sh queue

echo "=== publishing JSON to frontend/public/ ==="
cp consolidated-results.json scaling-results.json scaling-queue-results.json frontend/public/

echo ""
echo "DONE. Result files (repo root + frontend/public/):"
echo "  consolidated-results.json  scaling-results.json  scaling-queue-results.json"
echo "Copy them back (scp) or commit from here, then rebuild the front (npm --prefix frontend run build)."
echo "Now DESTROY this VM — you only needed it for the run."
