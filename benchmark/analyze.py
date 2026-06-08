#!/usr/bin/env python3
"""
PulseGrid · analysis & evidence pack
====================================

Takes `consolidated-results.json` and produces everything needed for an AI (or the
author) to write the technical article without remembering numbers:

  1. Loads and validates the consolidated file (flags unsupported variants).
  2. Generates the charts (via benchmark/plots/generate_plots.py) into plots/output/.
  3. Computes automatic findings (winner per indicator, % differences, native-vs-JVM
     ratios, http-vs-queue deltas, anomalies).
  4. Assembles an "evidence pack" in article-kit/:
       findings.md · data-summary.json · captions.md · environment.md · prompt-template.md
       + the chart images.

This script does NOT write the article and does NOT call any API. It produces the
material; the author feeds it to the AI of their choice. No secrets, no credentials.

Usage:
    python analyze.py
    python analyze.py --consolidated ../consolidated-results.json --mode http
"""
from __future__ import annotations

import argparse
import json
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
DEFAULT_CONSOLIDATED = ROOT / "consolidated-results.json"
PLOTS_DIR = HERE / "plots"
PLOTS_OUT = PLOTS_DIR / "output"
KIT_DIR = HERE / "article-kit"
KIT_IMAGES = KIT_DIR / "images"

sys.path.insert(0, str(PLOTS_DIR))


# --- Loading / validation ----------------------------------------------------
def load_and_validate(path: Path) -> dict:
    data = json.loads(path.read_text())
    for key in ("generatedAt", "environment", "variants"):
        if key not in data:
            raise ValueError(f"consolidated file missing required key: {key}")
    supported = [v for v in data["variants"] if v.get("supported") and v.get("metrics")]
    unsupported = [v for v in data["variants"] if not v.get("supported")]
    if not supported:
        raise ValueError("no supported variants with metrics — nothing to analyze")
    return data


def supported(data: dict, mode: str) -> list[dict]:
    return [v for v in data["variants"]
            if v["ingestMode"] == mode and v.get("supported") and v.get("metrics")]


def unsupported(data: dict) -> list[dict]:
    return [v for v in data["variants"] if not v.get("supported")]


# --- Findings ----------------------------------------------------------------
def _best(variants, getter, prefer_max: bool):
    candidates = [(getter(v), v) for v in variants if getter(v) is not None]
    if not candidates:
        return None
    return (max if prefer_max else min)(candidates, key=lambda t: t[0])


def _g(v, *path):
    cur = v["metrics"]
    for p in path:
        if cur is None:
            return None
        cur = cur.get(p)
    return cur


def compute_findings(data: dict, mode: str) -> dict:
    vs = supported(data, mode)
    indicators = {
        "throughput (req/s)": _best(vs, lambda v: _g(v, "throughputRps", "median"), True),
        "cold start (ms)": _best(vs, lambda v: _g(v, "startupMs", "median"), False),
        "idle RSS (MB)": _best(vs, lambda v: _g(v, "idleRssMb", "median"), False),
        "p99 latency (ms)": _best(vs, lambda v: _g(v, "latencyMs", "p99"), False),
        "efficiency (req/s per MB)": _best(vs, lambda v: _g(v, "efficiency", "rpsPerMb"), True),
        "image size (MB)": _best(vs, lambda v: _g(v, "imageSizeMb", "value"), False),
    }
    winners = {name: ({"label": b[1]["label"], "id": b[1]["id"], "value": b[0]} if b else None)
               for name, b in indicators.items()}

    # native vs jvm pairs (same stack + paradigm)
    groups: dict = {}
    for v in vs:
        groups.setdefault((v["stack"], v["paradigm"]), {})[v["packaging"]] = v
    native_vs_jvm = []
    for (stack, paradigm), d in groups.items():
        if "jvm" in d and "native" in d:
            jvm, nat = d["jvm"], d["native"]
            s_jvm, s_nat = _g(jvm, "startupMs", "median"), _g(nat, "startupMs", "median")
            r_jvm, r_nat = _g(jvm, "idleRssMb", "median"), _g(nat, "idleRssMb", "median")
            t_jvm, t_nat = _g(jvm, "throughputRps", "median"), _g(nat, "throughputRps", "median")
            native_vs_jvm.append({
                "stack": stack, "paradigm": paradigm,
                "startupSpeedup": round(s_jvm / s_nat, 1) if s_jvm and s_nat else None,
                "startupJvmMs": s_jvm, "startupNativeMs": s_nat,
                "idleRssJvmMb": r_jvm, "idleRssNativeMb": r_nat,
                "rssReductionPct": round((1 - r_nat / r_jvm) * 100, 1) if r_jvm and r_nat else None,
                "throughputJvmRps": t_jvm, "throughputNativeRps": t_nat,
                "throughputDeltaPct": round((t_nat / t_jvm - 1) * 100, 1) if t_jvm and t_nat else None,
            })

    # http vs queue (same variant id)
    http = {v["id"]: v for v in supported(data, "http")}
    queue = {v["id"]: v for v in supported(data, "queue")}
    http_vs_queue = []
    for vid in http:
        if vid in queue:
            th, tq = _g(http[vid], "throughputRps", "median"), _g(queue[vid], "throughputRps", "median")
            ph, pq = _g(http[vid], "latencyMs", "p99"), _g(queue[vid], "latencyMs", "p99")
            http_vs_queue.append({
                "id": vid, "label": http[vid]["label"],
                "throughputDeltaPct": round((tq / th - 1) * 100, 1) if th and tq else None,
                "p99HttpMs": ph, "p99QueueMs": pq,
            })

    return {"mode": mode, "winners": winners,
            "nativeVsJvm": native_vs_jvm, "httpVsQueue": http_vs_queue,
            "unsupported": [{"id": v["id"], "label": v["label"], "ingestMode": v["ingestMode"],
                             "notes": v.get("notes", "")} for v in unsupported(data)]}


# --- Evidence pack writers ---------------------------------------------------
def write_environment_md(data: dict):
    env = data["environment"]
    lines = ["# Environment", "",
             "The exact environment the benchmark ran on (for the methodology section).", "",
             "| Field | Value |", "|-------|-------|"]
    for k, v in env.items():
        if k == "containerLimits":
            v = ", ".join(f"{kk}={vv}" for kk, vv in v.items())
        lines.append(f"| {k} | {v} |")
    lines += ["", f"_generatedAt: {data['generatedAt']}_", ""]
    (KIT_DIR / "environment.md").write_text("\n".join(lines))


def write_findings_md(data: dict, findings: dict, charts: list[tuple[str, str]]):
    f = findings
    mode = f["mode"]
    L = [f"# PulseGrid — automatic findings ({mode} mode)", "",
         "_Generated by `benchmark/analyze.py`. Do not edit by hand — re-run to regenerate._", "",
         "## Experiment context", "",
         f"- Variants measured: {len(data['variants'])} profiles "
         f"({len([v for v in data['variants'] if v.get('supported')])} supported).",
         "- Identical hard container limits for every variant: "
         f"{data['environment'].get('containerLimits')}.",
         "- Methodology: warm-up discarded, ≥3 runs, median + stddev, one variant at a time.", ""]
    if data.get("sample"):
        L += ["> ⚠️ This consolidated file is **sample data** (`sample: true`). Re-run the "
              "runner to replace it with real measurements before publishing.", ""]

    L += ["## Per-indicator winners", ""]
    for name, w in f["winners"].items():
        if w:
            L.append(f"- **{name}**: {w['label']} (`{w['id']}`) — {w['value']}")
    L.append("")

    L += ["## Native vs JVM (same stack + paradigm)", ""]
    for p in f["nativeVsJvm"]:
        bits = [f"**{p['stack']} · {p['paradigm']}**:"]
        if p["startupSpeedup"]:
            bits.append(f"native started ~{p['startupSpeedup']}× faster "
                        f"({p['startupNativeMs']} ms vs {p['startupJvmMs']} ms);")
        if p["rssReductionPct"] is not None:
            bits.append(f"idle RSS {p['rssReductionPct']}% lower "
                        f"({p['idleRssNativeMb']} vs {p['idleRssJvmMb']} MB);")
        if p["throughputDeltaPct"] is not None:
            sign = "+" if p["throughputDeltaPct"] >= 0 else ""
            bits.append(f"throughput {sign}{p['throughputDeltaPct']}% on native.")
        L.append("- " + " ".join(bits))
    L.append("")

    L += ["## http vs queue ingestion", "",
          "_Not functionally equivalent (synchronous vs asynchronous) — framed as two "
          "ingestion architectures with different trade-offs._", ""]
    for p in f["httpVsQueue"]:
        if p["throughputDeltaPct"] is not None:
            sign = "+" if p["throughputDeltaPct"] >= 0 else ""
            L.append(f"- **{p['label']}**: queue admitted {sign}{p['throughputDeltaPct']}% "
                     f"throughput; p99 {p['p99HttpMs']} ms (http) → {p['p99QueueMs']} ms (queue).")
    L.append("")

    if f["unsupported"]:
        L += ["## Unsupported variants (documented findings, not failures to hide)", ""]
        for u in f["unsupported"]:
            L.append(f"- **{u['label']}** ({u['ingestMode']}): {u['notes']}")
        L.append("")

    L += ["## Numbers table (" + mode + ")", "",
          "| variant | req/s | p99 ms | startup ms | idle MB | image MB | req/s·MB |",
          "|---------|------:|-------:|-----------:|--------:|---------:|--------:|"]
    for v in supported(data, mode):
        L.append(f"| {v['id']} | {_g(v,'throughputRps','median')} | {_g(v,'latencyMs','p99')} | "
                 f"{_g(v,'startupMs','median')} | {_g(v,'idleRssMb','median')} | "
                 f"{_g(v,'imageSizeMb','value')} | {_g(v,'efficiency','rpsPerMb')} |")
    L += ["", "## Charts", ""]
    for name, caption in charts:
        L.append(f"- `images/{name}` — {caption}")
    L.append("")
    (KIT_DIR / "findings.md").write_text("\n".join(L))


def write_data_summary(data: dict):
    compact = {"generatedAt": data["generatedAt"], "sample": data.get("sample", False),
               "environment": data["environment"], "variants": []}
    for v in data["variants"]:
        entry = {k: v[k] for k in ("id", "label", "stack", "paradigm", "packaging",
                                   "ingestMode", "supported")}
        m = v.get("metrics")
        if m:
            entry["metrics"] = {
                "throughputRps": _g(v, "throughputRps", "median"),
                "p50": _g(v, "latencyMs", "p50"), "p95": _g(v, "latencyMs", "p95"),
                "p99": _g(v, "latencyMs", "p99"), "p999": _g(v, "latencyMs", "p999"),
                "errorRatePct": _g(v, "errorRatePct", "median"),
                "startupMs": _g(v, "startupMs", "median"),
                "idleRssMb": _g(v, "idleRssMb", "median"),
                "underLoadRssMb": _g(v, "underLoadRssMb", "median"),
                "underLoadCpuPct": _g(v, "underLoadCpuPct", "median"),
                "imageSizeMb": _g(v, "imageSizeMb", "value"),
                "rpsPerMb": _g(v, "efficiency", "rpsPerMb"),
            }
        else:
            entry["notes"] = v.get("notes", "")
        compact["variants"].append(entry)
    (KIT_DIR / "data-summary.json").write_text(json.dumps(compact, indent=2, ensure_ascii=False))


def write_captions_md(charts: list[tuple[str, str]]):
    L = ["# Chart captions", "",
         "What each chart shows (so the AI can reference them by name in the text).", ""]
    for name, caption in charts:
        L.append(f"## `images/{name}`\n{caption}\n")
    (KIT_DIR / "captions.md").write_text("\n".join(L))


def write_prompt_template(data: dict, findings: dict, charts: list[tuple[str, str]]):
    chart_list = "\n".join(f"  - images/{n}: {c}" for n, c in charts)
    sample_warn = ("\nNOTE: the current data is SAMPLE data — say so, or replace it with real "
                   "measurements first.\n" if data.get("sample") else "")
    prompt = f"""# Article prompt (pre-filled — paste into the AI of your choice)

You are writing a technical engineering article based on the PulseGrid benchmark.
Use ONLY the data in `findings.md` and `data-summary.json` (attached). Do not invent numbers.
{sample_warn}
## Required tone & rules
- Measured engineering tone, NOT a tutorial. The reader is a senior backend engineer.
- Use root-cause language: explain WHY each number happens (AOT moves work to compile
  time and native does not warm up the JIT; Virtual Threads give readable imperative code
  with cheap blocking; WebFlux/Mutiny squeeze throughput via an event loop at the cost of
  code complexity).
- Be honest about which stack wins on which dimension. Do not assume a winner; report what
  the data says even if it contradicts the popular narrative.
- Frame http vs queue as two ingestion architectures with different trade-offs (synchronous
  vs asynchronous), never as a naive "faster/slower".
- Reference the charts by name where relevant:
{chart_list}
- Close with a clear "when to choose each one" section.

## Structure
1. The question (Virtual Threads + native available — are reactive frameworks still worth it?).
2. Methodology (identical resource limits, warm-up, ≥3 runs, environment — see environment.md).
3. Results per indicator (startup, RSS, throughput, latency tail, efficiency, image size).
4. Native vs JVM, and http vs queue.
5. Honest conclusion + when to choose each variant.

## Key findings to anchor the article ({findings['mode']} mode)
{json.dumps(findings['winners'], indent=2, ensure_ascii=False)}
"""
    (KIT_DIR / "prompt-template.md").write_text(prompt)


def copy_charts(charts: list[tuple[str, str]]):
    KIT_IMAGES.mkdir(parents=True, exist_ok=True)
    for name, _ in charts:
        src = PLOTS_OUT / name
        if src.exists():
            shutil.copy2(src, KIT_IMAGES / name)


def main() -> int:
    ap = argparse.ArgumentParser(description="PulseGrid analysis & evidence pack")
    ap.add_argument("--consolidated", default=str(DEFAULT_CONSOLIDATED))
    ap.add_argument("--mode", default="http", choices=["http", "queue"],
                    help="primary ingest mode for the findings narrative")
    args = ap.parse_args()

    data = load_and_validate(Path(args.consolidated))

    # 2. charts
    from generate_plots import generate_all
    charts = generate_all(data, PLOTS_OUT)

    # 3. findings
    findings = compute_findings(data, args.mode)

    # 4. evidence pack
    KIT_DIR.mkdir(parents=True, exist_ok=True)
    write_environment_md(data)
    write_findings_md(data, findings, charts)
    write_data_summary(data)
    write_captions_md(charts)
    write_prompt_template(data, findings, charts)
    copy_charts(charts)

    print(f"✓ Evidence pack written to {KIT_DIR}")
    print(f"  - findings.md, data-summary.json, captions.md, environment.md, prompt-template.md")
    print(f"  - {len(charts)} chart(s) in plots/output/ and article-kit/images/")
    if data.get("sample"):
        print("  ⚠️  Based on SAMPLE data (sample=true). Re-run the runner for real numbers.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
