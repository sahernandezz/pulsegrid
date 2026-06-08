#!/usr/bin/env python3
"""
PulseGrid · chart generation
=============================

Renders the comparative charts (diagrams 1-4 + efficiency / image size / ingest-mode)
from `consolidated-results.json`. Reproducible: run it and you get the same images.

Standalone:
    python generate_plots.py                      # -> ./output/*.png
    python generate_plots.py --consolidated ../../consolidated-results.json --out output

Importable (used by benchmark/analyze.py):
    from generate_plots import generate_all
    captions = generate_all(consolidated_dict, out_dir)
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import matplotlib

matplotlib.use("Agg")  # headless backend, no display needed
import matplotlib.pyplot as plt  # noqa: E402

# Dark, portfolio-style theme.
PG_BG = "#0b0f17"
PG_FG = "#e6edf3"
PG_GRID = "#1f2733"
COLOR_JVM = "#7c9cff"      # JVM variants
COLOR_NATIVE = "#3ddc97"   # native variants
COLOR_ACCENT = "#ff7e6b"

HERE = Path(__file__).resolve().parent
DEFAULT_CONSOLIDATED = HERE.parent.parent / "consolidated-results.json"
DEFAULT_OUT = HERE / "output"


def _style(ax, title: str, ylabel: str):
    ax.set_title(title, color=PG_FG, fontsize=13, fontweight="bold", pad=12)
    ax.set_ylabel(ylabel, color=PG_FG, fontsize=10)
    ax.tick_params(colors=PG_FG, labelsize=8)
    ax.set_facecolor(PG_BG)
    for spine in ax.spines.values():
        spine.set_color(PG_GRID)
    ax.grid(axis="y", color=PG_GRID, linewidth=0.6, alpha=0.7)
    ax.set_axisbelow(True)


def _new_fig():
    fig, ax = plt.subplots(figsize=(10, 5.2))
    fig.patch.set_facecolor(PG_BG)
    return fig, ax


def _short(vid: str) -> str:
    return (vid.replace("spring-", "s-").replace("quarkus-", "q-")
            .replace("virtual-threads", "vt").replace("webflux", "wf")
            .replace("reactive", "rx").replace("imperative", "imp")
            .replace("-native", "-nat"))


def _bar_color(v: dict) -> str:
    return COLOR_NATIVE if v["packaging"] == "native" else COLOR_JVM


def _supported(data: dict, mode: str) -> list[dict]:
    return [v for v in data["variants"]
            if v["ingestMode"] == mode and v.get("supported") and v.get("metrics")]


def _save(fig, out_dir: Path, name: str) -> str:
    out_dir.mkdir(parents=True, exist_ok=True)
    path = out_dir / name
    fig.tight_layout()
    fig.savefig(path, dpi=130, facecolor=fig.get_facecolor())
    plt.close(fig)
    return name


def _legend(ax):
    handles = [plt.Rectangle((0, 0), 1, 1, color=COLOR_JVM),
               plt.Rectangle((0, 0), 1, 1, color=COLOR_NATIVE)]
    leg = ax.legend(handles, ["JVM", "Native"], facecolor=PG_BG, edgecolor=PG_GRID,
                    labelcolor=PG_FG, fontsize=8, loc="upper right")
    return leg


# --- Individual charts -------------------------------------------------------
def chart_startup(data, out_dir, mode="http"):
    vs = _supported(data, mode)
    if not vs:
        return None
    fig, ax = _new_fig()
    xs = [_short(v["id"]) for v in vs]
    ys = [v["metrics"]["startupMs"]["median"] for v in vs]
    ax.bar(xs, ys, color=[_bar_color(v) for v in vs])
    ax.set_yscale("log")
    _style(ax, f"Cold start (ms, log scale) — {mode}", "ms (log)")
    _legend(ax)
    plt.setp(ax.get_xticklabels(), rotation=35, ha="right")
    return _save(fig, out_dir, "chart_startup.png")


def chart_idle_rss(data, out_dir, mode="http"):
    vs = _supported(data, mode)
    if not vs:
        return None
    fig, ax = _new_fig()
    xs = [_short(v["id"]) for v in vs]
    ys = [v["metrics"]["idleRssMb"]["median"] for v in vs]
    ax.bar(xs, ys, color=[_bar_color(v) for v in vs])
    _style(ax, f"Idle RSS (MB, after 30s) — {mode}", "MB")
    _legend(ax)
    plt.setp(ax.get_xticklabels(), rotation=35, ha="right")
    return _save(fig, out_dir, "chart_idle_rss.png")


def chart_throughput(data, out_dir, mode="http"):
    vs = _supported(data, mode)
    if not vs:
        return None
    fig, ax = _new_fig()
    xs = [_short(v["id"]) for v in vs]
    ys = [v["metrics"]["throughputRps"]["median"] for v in vs]
    ax.bar(xs, ys, color=[_bar_color(v) for v in vs])
    _style(ax, f"Throughput (req/s, higher is better) — {mode}", "req/s")
    _legend(ax)
    plt.setp(ax.get_xticklabels(), rotation=35, ha="right")
    return _save(fig, out_dir, "chart_throughput.png")


def chart_latency(data, out_dir, mode="http"):
    vs = _supported(data, mode)
    if not vs:
        return None
    import numpy as np
    fig, ax = _new_fig()
    labels = [_short(v["id"]) for v in vs]
    keys = ["p50", "p95", "p99", "p999"]
    colors = ["#3ddc97", "#7c9cff", "#ffd166", "#ff7e6b"]
    x = np.arange(len(vs))
    w = 0.2
    for i, k in enumerate(keys):
        ys = [(v["metrics"]["latencyMs"].get(k) or 0) for v in vs]
        ax.bar(x + (i - 1.5) * w, ys, w, label=k, color=colors[i])
    _style(ax, f"Latency distribution (ms, lower is better) — {mode}", "ms")
    ax.set_xticks(x)
    ax.set_xticklabels(labels, rotation=35, ha="right")
    ax.legend(facecolor=PG_BG, edgecolor=PG_GRID, labelcolor=PG_FG, fontsize=8)
    return _save(fig, out_dir, "chart_latency.png")


def chart_efficiency(data, out_dir, mode="http"):
    vs = _supported(data, mode)
    if not vs:
        return None
    fig, ax = _new_fig()
    xs = [_short(v["id"]) for v in vs]
    ys = [(v["metrics"]["efficiency"].get("rpsPerMb") or 0) for v in vs]
    ax.bar(xs, ys, color=[_bar_color(v) for v in vs])
    _style(ax, f"Efficiency (req/s per MB of RSS, higher is better) — {mode}", "req/s per MB")
    _legend(ax)
    plt.setp(ax.get_xticklabels(), rotation=35, ha="right")
    return _save(fig, out_dir, "chart_efficiency.png")


def chart_image_size(data, out_dir, mode="http"):
    vs = _supported(data, mode)
    if not vs:
        return None
    fig, ax = _new_fig()
    xs = [_short(v["id"]) for v in vs]
    ys = [(v["metrics"]["imageSizeMb"].get("value") or 0) for v in vs]
    ax.bar(xs, ys, color=[_bar_color(v) for v in vs])
    _style(ax, "Docker image size (MB)", "MB")
    _legend(ax)
    plt.setp(ax.get_xticklabels(), rotation=35, ha="right")
    return _save(fig, out_dir, "chart_image_size.png")


def chart_http_vs_queue(data, out_dir):
    import numpy as np
    http = {v["id"]: v for v in _supported(data, "http")}
    queue = {v["id"]: v for v in _supported(data, "queue")}
    ids = [i for i in http if i in queue]
    if not ids:
        return None
    fig, ax = _new_fig()
    labels = [_short(i) for i in ids]
    x = np.arange(len(ids))
    w = 0.4
    ax.bar(x - w / 2, [http[i]["metrics"]["throughputRps"]["median"] for i in ids], w,
           label="http", color=COLOR_JVM)
    ax.bar(x + w / 2, [queue[i]["metrics"]["throughputRps"]["median"] for i in ids], w,
           label="queue", color=COLOR_ACCENT)
    _style(ax, "Throughput: http vs queue ingestion", "req/s")
    ax.set_xticks(x)
    ax.set_xticklabels(labels, rotation=35, ha="right")
    ax.legend(facecolor=PG_BG, edgecolor=PG_GRID, labelcolor=PG_FG, fontsize=8)
    return _save(fig, out_dir, "chart_http_vs_queue.png")


# --- Orchestration -----------------------------------------------------------
# (filename, human caption) — the caption goes into article-kit/captions.md.
CAPTIONS = {
    "chart_startup.png": "Cold start per variant (ms, log scale). Native variants should "
                         "stand out; the JVM pays class loading + JIT bootstrap.",
    "chart_idle_rss.png": "Resident memory at idle (MB) after 30s with no load. Native "
                          "and reactive footprints are typically the smallest.",
    "chart_throughput.png": "Sustained throughput (req/s) at fixed load. Higher is better.",
    "chart_latency.png": "Latency distribution (p50/p95/p99/p99.9) at fixed load. The long "
                         "tail (p99.9) is what separates paradigms the most.",
    "chart_efficiency.png": "Efficiency: req/s per MB of RSS — performance normalized by cost.",
    "chart_image_size.png": "Docker image size (MB): native vs JVM differs drastically.",
    "chart_http_vs_queue.png": "Throughput under http (synchronous) vs queue (asynchronous) "
                               "ingestion — two architectures with different trade-offs.",
}


def generate_all(data: dict, out_dir: Path) -> list[tuple[str, str]]:
    produced = []
    for fn in (chart_startup, chart_idle_rss, chart_throughput, chart_latency,
               chart_efficiency, chart_image_size):
        name = fn(data, out_dir)
        if name:
            produced.append((name, CAPTIONS.get(name, "")))
    name = chart_http_vs_queue(data, out_dir)
    if name:
        produced.append((name, CAPTIONS.get(name, "")))
    return produced


def main() -> int:
    ap = argparse.ArgumentParser(description="Generate PulseGrid comparison charts")
    ap.add_argument("--consolidated", default=str(DEFAULT_CONSOLIDATED))
    ap.add_argument("--out", default=str(DEFAULT_OUT))
    args = ap.parse_args()
    data = json.loads(Path(args.consolidated).read_text())
    produced = generate_all(data, Path(args.out))
    print(f"Generated {len(produced)} chart(s) in {args.out}:")
    for name, _ in produced:
        print(f"  - {name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
