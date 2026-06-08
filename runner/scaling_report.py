#!/usr/bin/env python3
"""Merge per-envelope consolidated files into one scaling matrix + print tables.

Reads benchmark/results/scaling/<label>.json (one per resource envelope, http
mode) and emits scaling-results.json plus human-readable throughput / RSS / p99
tables so the CPU-scaling curve and the 512 MB memory floor are obvious.
"""
from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

# Envelope order + human metadata (label -> spec). cores == cpuset width.
ENVELOPES = [
    {"label": "1cpu-512m", "cpus": 1, "memory": "512m", "cores": 1},
    {"label": "2cpu-1g", "cpus": 2, "memory": "1g", "cores": 2},
    {"label": "4cpu-2g", "cpus": 4, "memory": "2g", "cores": 4},
]


def metric(entry: dict, *path):
    cur = entry
    for p in path:
        if not isinstance(cur, dict):
            return None
        cur = cur.get(p)
    return cur


def point(entry: dict) -> dict:
    """Extract the four headline metrics for one (variant, envelope)."""
    if not entry or not entry.get("supported") or not entry.get("metrics"):
        return {"supported": False, "note": (entry or {}).get("notes", "")}
    m = entry["metrics"]
    return {
        "supported": True,
        "throughputRps": metric(m, "throughputRps", "median"),
        "p50Ms": metric(m, "latencyMs", "p50"),
        "p95Ms": metric(m, "latencyMs", "p95"),
        "p99Ms": metric(m, "latencyMs", "p99"),
        "p999Ms": metric(m, "latencyMs", "p999"),
        "startupMs": metric(m, "startupMs", "median"),
        "idleRssMb": metric(m, "idleRssMb", "median"),
        "imageSizeMb": metric(m, "imageSizeMb", "value"),
        "efficiencyRpsPerMb": metric(m, "efficiency", "rpsPerMb"),
        "errorPct": metric(m, "errorRatePct", "median"),
    }


def fmt(v, kind: str) -> str:
    if v is None:
        return "—"
    if kind == "rps":
        return f"{v:,.0f}"
    if kind == "ms":
        return f"{v:,.1f}"
    if kind == "mb":
        return f"{v:,.0f}"
    return str(v)


def table(title: str, variants: list, key: str, kind: str) -> str:
    labels = [e["label"] for e in ENVELOPES]
    w_id = max(len(v["id"]) for v in variants) + 1
    head = "  ".join(f"{l:>11}" for l in labels)
    out = [f"\n{title}", f"{'variant':<{w_id}}  {head}", "-" * (w_id + 2 + len(head))]
    for v in variants:
        cells = []
        for lab in labels:
            p = v["points"].get(lab, {})
            cells.append(f"{(fmt(p.get(key), kind) if p.get('supported') else 'OOM/—'):>11}")
        out.append(f"{v['id']:<{w_id}}  {'  '.join(cells)}")
    return "\n".join(out)


def main() -> int:
    outdir = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("benchmark/results/scaling")
    mode = sys.argv[2] if len(sys.argv) > 2 else "http"
    suffix = "-queue" if mode == "queue" else ""

    # variant id -> merged record
    merged: dict[str, dict] = {}
    present_envelopes = []
    for env in ENVELOPES:
        f = outdir / f"{env['label']}{suffix}.json"
        if not f.exists():
            print(f"[skip] {f} not found", file=sys.stderr)
            continue
        present_envelopes.append(env)
        data = json.loads(f.read_text())
        for entry in data.get("variants", []):
            if entry.get("ingestMode") != mode:
                continue
            vid = entry["id"]
            rec = merged.setdefault(vid, {
                "id": vid, "label": entry["label"], "stack": entry["stack"],
                "paradigm": entry["paradigm"], "packaging": entry["packaging"],
                "points": {},
            })
            rec["points"][env["label"]] = point(entry)

    if not merged:
        print("No per-envelope files found — run scaling_sweep.sh first.", file=sys.stderr)
        return 1

    # stable order: throughput at the richest available envelope, desc
    rank_env = present_envelopes[-1]["label"]
    variants = sorted(
        merged.values(),
        key=lambda v: (v["points"].get(rank_env, {}).get("throughputRps") or -1),
        reverse=True,
    )

    scaling = {
        "generatedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "ingestMode": mode,
        "envelopes": present_envelopes,
        "variants": variants,
    }
    out_file = Path("scaling-results.json" if mode == "http" else "scaling-queue-results.json")
    out_file.write_text(json.dumps(scaling, indent=2, ensure_ascii=False))

    # --- human-readable tables ---
    print(table("THROUGHPUT (req/s · higher = better)", variants, "throughputRps", "rps"))
    print(table("p99 LATENCY (ms · lower = better)", variants, "p99Ms", "ms"))
    print(table("IDLE RSS (MB · lower = better)", variants, "idleRssMb", "mb"))

    # CPU scaling factor (richest / leanest, where both supported)
    lean = present_envelopes[0]["label"]
    rich = present_envelopes[-1]["label"]
    print(f"\nCPU SCALING  {lean} -> {rich}  (throughput ×)")
    for v in variants:
        a = v["points"].get(lean, {}).get("throughputRps")
        b = v["points"].get(rich, {}).get("throughputRps")
        factor = f"{b / a:.2f}×" if (a and b) else "—"
        print(f"  {v['id']:<26} {fmt(a,'rps'):>8}  ->  {fmt(b,'rps'):>8}   {factor:>7}")

    # memory floor
    floor = present_envelopes[0]
    dead = [v["id"] for v in variants if not v["points"].get(floor["label"], {}).get("supported")]
    print(f"\nMEMORY FLOOR @ {floor['label']} ({floor['memory']}):")
    print(f"  survived: {[v['id'] for v in variants if v['points'].get(floor['label'],{}).get('supported')]}")
    print(f"  failed  : {dead or '(none)'}")

    print(f"\n✓ scaling-results.json written ({len(variants)} variants × {len(present_envelopes)} envelopes)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
