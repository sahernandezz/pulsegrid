#!/usr/bin/env python3
"""
PulseGrid · Benchmark Runner
============================

Orchestrates the load tests against each variant ONE AT A TIME (with dedicated,
identical resources), measures the indicators of interest, and persists a
consolidated file (`consolidated-results.json`) plus the raw k6 outputs as evidence.
It is a job: it runs, produces data, and exits. The frontend never touches Docker.

This is the ONLY piece that talks to Docker, k6 and runtime metrics.

Typical usage:
    python run_benchmarks.py --runs 3
    python run_benchmarks.py --only spring-vt-jvm,quarkus-reactive-jvm --modes http
    python run_benchmarks.py --skip-build           # reuse already-built images

Requirements: docker (compose v2), k6 on the PATH, Python 3.10+, deps from requirements.txt.
"""
from __future__ import annotations

import argparse
import json
import os
import platform
import re
import shutil
import statistics
import subprocess
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path

import yaml

# --- Paths -------------------------------------------------------------------
RUNNER_DIR = Path(__file__).resolve().parent
ROOT = RUNNER_DIR.parent
COMPOSE = ROOT / "docker-compose.yml"
RAW_DIR = ROOT / "benchmark" / "results" / "raw"
OUTPUT = ROOT / "consolidated-results.json"
K6_SCRIPT = RUNNER_DIR / "k6" / "ingest.js"

# --- Container limits (read from env so the resource-scaling sweep records the
#     actual envelope; defaults match the compose &res_limits anchor) ----------
def _limits_from_env() -> dict:
    raw = os.environ.get("PG_CPUS", "2")
    try:
        n = float(raw)
        cpus = int(n) if n.is_integer() else n
    except ValueError:
        cpus = raw
    return {
        "cpus": cpus,
        "memory": os.environ.get("PG_MEM", "1g"),
        "cpuset": os.environ.get("PG_CPUSET", "0,1"),
    }


CONTAINER_LIMITS = _limits_from_env()

TYPES = ["CPU", "MEMORY", "TEMPERATURE", "LATENCY"]
REGIONS = ["us-east", "us-west", "eu-central", "ap-south"]


# =============================================================================
# Shell / docker compose helpers
# =============================================================================
def sh(cmd: list[str], env: dict | None = None, capture: bool = True,
       check: bool = False, timeout: int | None = None) -> subprocess.CompletedProcess:
    full_env = {**os.environ, **(env or {})}
    return subprocess.run(cmd, env=full_env, text=True, timeout=timeout,
                          capture_output=capture, check=check)


def compose(profiles: list[str], args: list[str], env: dict | None = None,
            check: bool = False, timeout: int | None = None) -> subprocess.CompletedProcess:
    base = ["docker", "compose", "-f", str(COMPOSE)]
    for p in profiles:
        base += ["--profile", p]
    return sh(base + args, env=env, check=check, timeout=timeout)


def container_id(service: str, env: dict | None = None) -> str | None:
    # Filter by the compose service label — robust regardless of active profiles
    # or project name (compose `ps -q` hides services whose profile isn't enabled).
    res = sh(["docker", "ps", "-q", "--filter", f"label=com.docker.compose.service={service}"])
    lines = (res.stdout or "").strip().splitlines()
    return lines[0] if lines else None


# =============================================================================
# Measurements
# =============================================================================
def http_get(url: str, timeout: float = 2.0) -> tuple[int, float]:
    t0 = time.perf_counter()
    try:
        with urllib.request.urlopen(url, timeout=timeout) as r:
            r.read()
            return r.status, (time.perf_counter() - t0) * 1000
    except urllib.error.HTTPError as e:
        return e.code, (time.perf_counter() - t0) * 1000
    except Exception:
        return 0, (time.perf_counter() - t0) * 1000


def http_post_event(base_url: str, timeout: float = 5.0) -> tuple[int, float]:
    import random
    payload = json.dumps({
        "deviceId": f"dev-{random.randint(0, 9999)}",
        "metricType": random.choice(TYPES),
        "value": random.random() * 100,
        "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "region": random.choice(REGIONS),
    }).encode()
    req = urllib.request.Request(f"{base_url}/api/events", data=payload,
                                 headers={"Content-Type": "application/json"}, method="POST")
    t0 = time.perf_counter()
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            r.read()
            return r.status, (time.perf_counter() - t0) * 1000
    except urllib.error.HTTPError as e:
        return e.code, (time.perf_counter() - t0) * 1000
    except Exception:
        return 0, (time.perf_counter() - t0) * 1000


def wait_for_health(base_url: str, health_path: str, t0: float, timeout: float = 120) -> float | None:
    """Returns ms from t0 to the first /health 200, or None on timeout."""
    url = base_url + health_path
    deadline = time.time() + timeout
    while time.time() < deadline:
        status, _ = http_get(url, timeout=2.0)
        if status == 200:
            return (time.perf_counter() - t0) * 1000
        time.sleep(0.05)
    return None


def measure_time_to_first_request(base_url: str, t0: float, timeout: float = 20) -> float | None:
    """ms from t0 to the first successful (2xx) POST /api/events."""
    deadline = time.time() + timeout
    while time.time() < deadline:
        status, _ = http_post_event(base_url)
        if 200 <= status < 300:
            return (time.perf_counter() - t0) * 1000
        time.sleep(0.1)
    return None


def measure_warmup_to_stable(base_url: str, max_seconds: int = 60) -> float:
    """
    Warm-up heuristic: sends concurrent bursts in 1s windows and measures throughput
    per window; declares 'stable' when two consecutive windows vary by <8%. On the JVM
    this takes a while (the JIT warms up); on native it is almost immediate — that
    contrast is exactly part of the finding. Returns ms to stabilize.
    """
    t0 = time.perf_counter()
    prev = None
    stable_streak = 0
    workers = 20
    with ThreadPoolExecutor(max_workers=workers) as pool:
        for _ in range(max_seconds):
            win_start = time.perf_counter()
            count = 0
            futures = []
            while time.perf_counter() - win_start < 1.0:
                futures.append(pool.submit(http_post_event, base_url))
                if len(futures) >= 500:
                    break
            for f in futures:
                status, _ = f.result()
                if 200 <= status < 300:
                    count += 1
            if prev is not None and prev > 0:
                change = abs(count - prev) / prev
                stable_streak = stable_streak + 1 if change < 0.08 else 0
                if stable_streak >= 2:
                    return (time.perf_counter() - t0) * 1000
            prev = count
    return (time.perf_counter() - t0) * 1000


def _mem_to_mb(token: str) -> float:
    m = re.match(r"([0-9.]+)\s*([KMGT]?i?B)", token.strip())
    if not m:
        return 0.0
    val, unit = float(m.group(1)), m.group(2)
    factor = {"B": 1, "KiB": 1024, "MiB": 1024 ** 2, "GiB": 1024 ** 3, "TiB": 1024 ** 4,
              "KB": 1e3, "MB": 1e6, "GB": 1e9}.get(unit, 1)
    return val * factor / 1e6


def docker_stats(cid: str) -> tuple[float, float]:
    """Instant (mem_mb, cpu_pct) for the container."""
    res = sh(["docker", "stats", "--no-stream", "--format", "{{.MemUsage}}|{{.CPUPerc}}", cid])
    line = (res.stdout or "").strip()
    if "|" not in line:
        return 0.0, 0.0
    mem_part, cpu_part = line.split("|", 1)
    mem_mb = _mem_to_mb(mem_part.split("/")[0])
    cpu_pct = float(cpu_part.replace("%", "").strip() or 0)
    return mem_mb, cpu_pct


def image_size_mb(image: str) -> float | None:
    res = sh(["docker", "image", "inspect", "-f", "{{.Size}}", image])
    out = (res.stdout or "").strip()
    return round(int(out) / 1e6, 1) if out.isdigit() else None


def verify_limits(cid: str) -> dict:
    res = sh(["docker", "inspect", "-f",
              "{{.HostConfig.NanoCpus}}|{{.HostConfig.Memory}}|{{.HostConfig.CpusetCpus}}", cid])
    parts = (res.stdout or "").strip().split("|")
    if len(parts) == 3:
        nanocpus, mem, cpuset = parts
        return {"cpus": (int(nanocpus) / 1e9 if nanocpus.isdigit() else None),
                "memoryMb": (int(mem) / 1e6 if mem.isdigit() else None),
                "cpuset": cpuset}
    return {}


# =============================================================================
# k6
# =============================================================================
def run_k6(base_url: str, mode: str, vus: int, duration_s: int, raw_path: Path) -> dict | None:
    summary = raw_path.with_suffix(".summary.json")
    env = {
        "BASE_URL": base_url, "MODE": mode, "VUS": str(vus),
        "DURATION": str(duration_s), "SUMMARY_PATH": str(summary),
    }
    cmd = ["k6", "run", str(K6_SCRIPT)]
    # Pin the load generator to its own cores (Linux multi-core host) so it never
    # steals CPU from the app under test or Postgres. No-op on macOS / when unset.
    k6_cpuset = os.environ.get("K6_CPUSET")
    if k6_cpuset and shutil.which("taskset"):
        cmd = ["taskset", "-c", k6_cpuset] + cmd
    with raw_path.open("w") as log:
        proc = subprocess.run(cmd, env={**os.environ, **env},
                              stdout=log, stderr=subprocess.STDOUT, text=True)
    if proc.returncode != 0 or not summary.exists():
        return None
    return json.loads(summary.read_text())


# =============================================================================
# Statistics
# =============================================================================
def stat_runs(values: list[float]) -> dict:
    vals = [round(v, 2) for v in values if v is not None]
    if not vals:
        return {"median": None, "stddev": None, "runs": []}
    return {
        "median": round(statistics.median(vals), 2),
        "stddev": round(statistics.pstdev(vals), 2) if len(vals) > 1 else 0.0,
        "runs": vals,
    }


def median_of(values: list[float]) -> float | None:
    vals = [v for v in values if v is not None]
    return round(statistics.median(vals), 2) if vals else None


# =============================================================================
# Variant model
# =============================================================================
@dataclass
class RunResult:
    throughput: float | None = None
    p50: float | None = None
    p95: float | None = None
    p99: float | None = None
    p999: float | None = None
    error_pct: float | None = None
    startup_ms: float | None = None
    idle_rss: float | None = None
    under_rss: float | None = None
    cpu_pct: float | None = None
    ttfr_ms: float | None = None
    warmup_ms: float | None = None


@dataclass
class VariantOutcome:
    supported: bool = True
    notes: str = ""
    runs: list[RunResult] = field(default_factory=list)
    image_size: float | None = None


# =============================================================================
# Orchestration per variant × mode
# =============================================================================
def build_image(variant: dict, mode: str, env: dict) -> tuple[bool, str]:
    print(f"  [build] {variant['composeProfile']} ...", flush=True)
    res = compose(["infra", variant["composeProfile"]] + (["queue"] if mode == "queue" else []),
                  ["build", variant["composeProfile"]], env=env, timeout=3600)
    if res.returncode != 0:
        return False, (res.stderr or res.stdout or "build failed")[-1500:]
    return True, ""


def bring_up_infra(mode: str, env: dict) -> None:
    services = ["postgres"] + (["kafka"] if mode == "queue" else [])
    profiles = ["infra"] + (["queue"] if mode == "queue" else [])
    compose(profiles, ["up", "-d", "--wait"] + services, env=env, timeout=300)
    # Optional: pin Postgres/Kafka to dedicated cores (PG_DB_CPUSET) so the DB and
    # broker never contend with the app-under-test or k6. Set this on a multi-core
    # host (e.g. a 16-vCPU VM) for clean, isolated scaling numbers. No-op when unset.
    cpuset = os.environ.get("PG_DB_CPUSET")
    if cpuset:
        for svc in services:
            res = sh(["docker", "ps", "-q", "--filter", f"label=com.docker.compose.service={svc}"])
            cids = (res.stdout or "").strip().splitlines()
            if cids:
                sh(["docker", "update", f"--cpuset-cpus={cpuset}", cids[0]])
                print(f"  [pin] {svc} -> cores {cpuset}", flush=True)


def teardown(mode: str, env: dict, keep_infra: bool) -> None:
    if keep_infra:
        return
    profiles = ["infra", "queue"]
    compose(profiles + [p for p in env.get("_PROFILES", "").split(",") if p],
            ["down", "-v"], env=env, timeout=300)


def measure_variant(variant: dict, mode: str, cfg: dict) -> VariantOutcome:
    base_url = "http://localhost:8080"
    health = variant.get("healthPath", "/health")
    profile = variant["composeProfile"]
    env = {"INGEST_MODE": mode, "_PROFILES": profile}
    outcome = VariantOutcome()

    if not cfg["skip_build"]:
        ok, err = build_image(variant, mode, env)
        if not ok:
            print(f"  [SKIP] {variant['id']} ({mode}) failed to build -> supported:false", flush=True)
            outcome.supported = False
            outcome.notes = f"Build failed: {err.strip()[:600]}"
            return outcome

    outcome.image_size = image_size_mb(variant["image"])
    if cfg["skip_build"] and outcome.image_size is None:
        outcome.supported = False
        outcome.notes = ("Image not built (build skipped and image absent) — the native build "
                         "likely failed; see docs/architecture/RISKS.md.")
        return outcome
    bring_up_infra(mode, env)

    backend_profiles = ["infra", profile] + (["queue"] if mode == "queue" else [])
    try:
        for run_idx in range(cfg["runs"]):
            print(f"  [run {run_idx + 1}/{cfg['runs']}] {variant['id']} ({mode})", flush=True)
            # Remove any existing backend container BEFORE t0 so cold start is fresh.
            old = container_id(profile)
            if old:
                sh(["docker", "rm", "-f", old])
            t0 = time.perf_counter()
            compose(backend_profiles, ["up", "-d", "--no-deps", "--force-recreate", profile],
                    env=env, timeout=120)
            startup = wait_for_health(base_url, health, t0, timeout=cfg["startup_timeout"])
            if startup is None:
                raise RuntimeError("health did not return 200 within the timeout")
            cid = container_id(profile, env)
            limits = verify_limits(cid) if cid else {}
            print(f"      cold start={startup:.0f}ms  limits={limits}", flush=True)

            ttfr = measure_time_to_first_request(base_url, t0)
            warmup = measure_warmup_to_stable(base_url, max_seconds=cfg["warmup_seconds"])

            # Idle RSS after settling.
            time.sleep(cfg["idle_settle"])
            idle_rss, _ = docker_stats(cid) if cid else (None, None)

            # Measured load with parallel RSS/CPU sampling.
            raw = RAW_DIR / f"{variant['id']}_{mode}_run{run_idx + 1}.log"
            samples: list[tuple[float, float]] = []
            stop = {"flag": False}

            def sampler():
                while not stop["flag"] and cid:
                    samples.append(docker_stats(cid))
                    time.sleep(1.0)

            with ThreadPoolExecutor(max_workers=1) as pool:
                fut = pool.submit(sampler)
                summary = run_k6(base_url, mode, cfg["vus"], cfg["duration"], raw)
                stop["flag"] = True
                fut.result()

            rr = RunResult(startup_ms=startup, idle_rss=idle_rss, ttfr_ms=ttfr, warmup_ms=warmup)
            if samples:
                rr.under_rss = round(max(s[0] for s in samples), 1)
                rr.cpu_pct = round(statistics.mean(s[1] for s in samples), 1)
            if summary:
                rr.throughput = round(summary.get("throughputRps", 0), 1)
                lat = summary.get("latencyMs", {})
                rr.p50, rr.p95 = lat.get("p50"), lat.get("p95")
                rr.p99, rr.p999 = lat.get("p99"), lat.get("p999")
                rr.error_pct = round(summary.get("errorRatePct", 0), 3)
            else:
                rr.error_pct = 100.0
            outcome.runs.append(rr)
    finally:
        last = container_id(profile)
        if last:
            sh(["docker", "rm", "-f", last])
        teardown(mode, env, cfg["keep_infra"])

    # A variant that starts (health 200) but errors on most requests is not
    # functionally supported (e.g. webflux-native: R2DBC INSERTs 500 on native, so
    # only the ~5% read mix passes -> ~95% error). Threshold well above a healthy
    # variant's near-0% and well below a broken one's ~95-100%.
    errs = [r.error_pct for r in outcome.runs if r.error_pct is not None]
    if outcome.runs and errs and statistics.median(errs) >= 50.0:
        outcome.supported = False
        outcome.notes = outcome.notes or (
            f"Starts (health 200) but ingestion fails (~{statistics.median(errs):.0f}% errors) "
            "— not functionally supported.")
    return outcome


# =============================================================================
# Consolidated assembly
# =============================================================================
def build_metrics(outcome: VariantOutcome) -> dict | None:
    if not outcome.supported or not outcome.runs:
        return None
    r = outcome.runs
    throughput = stat_runs([x.throughput for x in r])
    under_rss = median_of([x.under_rss for x in r])
    cpu = median_of([x.cpu_pct for x in r])
    rps = throughput["median"] or 0
    eff = {
        "rpsPerMb": round(rps / under_rss, 2) if under_rss else None,
        "rpsPerCpuPct": round(rps / cpu, 2) if cpu else None,
    }
    return {
        "throughputRps": throughput,
        "latencyMs": {
            "p50": median_of([x.p50 for x in r]), "p95": median_of([x.p95 for x in r]),
            "p99": median_of([x.p99 for x in r]), "p999": median_of([x.p999 for x in r]),
        },
        "errorRatePct": {"median": median_of([x.error_pct for x in r])},
        "startupMs": stat_runs([x.startup_ms for x in r]),
        "timeToFirstReqMs": {"median": median_of([x.ttfr_ms for x in r])},
        "warmupToStableMs": {"median": median_of([x.warmup_ms for x in r])},
        "idleRssMb": stat_runs([x.idle_rss for x in r]),
        "underLoadRssMb": {"median": under_rss},
        "underLoadCpuPct": {"median": cpu},
        "imageSizeMb": {"value": outcome.image_size},
        "efficiency": eff,
    }


def detect_environment() -> dict:
    def first_line(cmd):
        try:
            r = sh(cmd)
            out = ((r.stdout or "") + (r.stderr or "")).strip()  # java -version writes to stderr
            return out.splitlines()[0] if out else ""
        except Exception:
            return ""

    def cpu_name():
        for cmd in (["sysctl", "-n", "machdep.cpu.brand_string"],):  # macOS
            try:
                s = (sh(cmd).stdout or "").strip()
                if s:
                    return s
            except Exception:
                pass
        return platform.processor() or platform.machine()

    def pom_version(path: Path, artifact: str) -> str:
        try:
            text = path.read_text()
            m = re.search(rf"<{artifact}>([^<]+)</{artifact}>", text)
            return m.group(1) if m else ""
        except Exception:
            return ""

    def os_name():
        # platform.release() on macOS returns the Darwin KERNEL version (e.g. 25.5.0),
        # not the marketing version (macOS 26.5). Prefer sw_vers on Darwin.
        try:
            if platform.system() == "Darwin":
                name = (sh(["sw_vers", "-productName"]).stdout or "").strip()
                ver = (sh(["sw_vers", "-productVersion"]).stdout or "").strip()
                if name and ver:
                    return f"{name} {ver}"
        except Exception:
            pass
        return f"{platform.system()} {platform.release()}"

    try:
        ram_gb = round(os.sysconf("SC_PAGE_SIZE") * os.sysconf("SC_PHYS_PAGES") / 1e9, 1)
    except (ValueError, OSError):
        ram_gb = None
    return {
        "cpu": cpu_name(),
        "cores": os.cpu_count(),
        "ramGb": ram_gb,
        "os": os_name(),
        "java": first_line(["java", "-version"]).replace('"', ""),
        "graalvm": first_line(["native-image", "--version"]),
        "springBoot": pom_version(ROOT / "backends/spring/pom.xml", "version") or "4.0.0",
        "quarkus": pom_version(ROOT / "backends/quarkus/pom.xml", "quarkus.platform.version"),
        "containerLimits": CONTAINER_LIMITS,
    }


def main() -> int:
    ap = argparse.ArgumentParser(description="PulseGrid benchmark runner")
    ap.add_argument("--variants", default=str(RUNNER_DIR / "variants.yaml"))
    ap.add_argument("--only", default="", help="comma-separated ids")
    ap.add_argument("--modes", default="", help="http,queue (default: from variants.yaml)")
    ap.add_argument("--runs", type=int, default=None)
    ap.add_argument("--duration", type=int, default=None, help="load phase seconds")
    ap.add_argument("--vus", type=int, default=None)
    ap.add_argument("--skip-build", action="store_true")
    ap.add_argument("--keep-infra", action="store_true")
    ap.add_argument("--output", default=str(OUTPUT))
    args = ap.parse_args()

    spec = yaml.safe_load(Path(args.variants).read_text())
    defaults = spec.get("defaults", {})
    variants = spec["variants"]
    if args.only:
        wanted = set(args.only.split(","))
        variants = [v for v in variants if v["id"] in wanted]

    cfg = {
        "runs": args.runs or defaults.get("runs", 3),
        "duration": args.duration or defaults.get("loadDurationSeconds", 60),
        "vus": args.vus or defaults.get("vus", 50),
        "warmup_seconds": defaults.get("warmupSeconds", 30),
        "idle_settle": defaults.get("idleSettleSeconds", 30),
        "startup_timeout": 180,
        "skip_build": args.skip_build,
        "keep_infra": args.keep_infra,
    }
    modes_override = args.modes.split(",") if args.modes else None

    RAW_DIR.mkdir(parents=True, exist_ok=True)
    print(f"PulseGrid runner · {len(variants)} variant(s) · cfg={cfg}", flush=True)

    consolidated = {
        "generatedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "sample": False,
        "environment": detect_environment(),
        "variants": [],
    }

    for variant in variants:
        modes = modes_override or variant.get("ingestModes", defaults.get("ingestModes", ["http"]))
        for mode in modes:
            print(f"\n=== {variant['id']} · mode {mode} ===", flush=True)
            try:
                outcome = measure_variant(variant, mode, cfg)
            except Exception as e:  # one failing variant must not bring down the run
                print(f"  [ERROR] {variant['id']} ({mode}): {e}", flush=True)
                outcome = VariantOutcome(supported=False, notes=f"Measurement error: {e}")
            consolidated["variants"].append({
                "id": variant["id"], "label": variant["label"], "stack": variant["stack"],
                "paradigm": variant["paradigm"], "packaging": variant["packaging"],
                "ingestMode": mode, "supported": outcome.supported, "notes": outcome.notes,
                "metrics": build_metrics(outcome),
            })
            # Persist incrementally: if something fails later, measured data is not lost.
            Path(args.output).write_text(json.dumps(consolidated, indent=2, ensure_ascii=False))

    print(f"\n✓ Consolidated written to {args.output}", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
