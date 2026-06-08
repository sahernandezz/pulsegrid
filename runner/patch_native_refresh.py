#!/usr/bin/env python3
"""Patch the official consolidated file with re-measured native results.

The native http (and queue) numbers in consolidated-results.json were invalid:
the native images returned HTTP 500 on every persist (response DTOs weren't
registered for reflection), but the old 99% error threshold let them through, so
the recorded "throughput" was really the 500-rate. After the serialization fix
(@RegisterForReflection / @RegisterReflectionForBinding) the natives were
re-measured at the official 2cpu/1g envelope; this script swaps those entries in.

Usage: python runner/patch_native_refresh.py [refresh.json] [consolidated.json]
"""
from __future__ import annotations

import json
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REFRESH = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "benchmark/results/native-refresh.json"
CONSOLIDATED = Path(sys.argv[2]) if len(sys.argv) > 2 else ROOT / "consolidated-results.json"
PUBLIC = ROOT / "frontend/public/consolidated-results.json"

NOTE = ("Re-measured at 2 CPU / 1 GB after the native response-serialization fix "
        "(@RegisterForReflection / @RegisterReflectionForBinding). Earlier native http/queue "
        "numbers were the HTTP-500 rate, masked by a 99% error threshold.")

QUEUE_NOTE = ("Native queue unsupported (Spring AOT limitation): the queue beans "
              "(EventPublisher, Kafka consumer, KafkaSupportConfig) are @ConditionalOnProperty, "
              "and Spring AOT freezes conditions at build time — the http-compiled native image "
              "prunes them, so the single binary cannot serve a mode it wasn't built for. "
              "Quarkus native switches modes at runtime; Spring native would need a separate "
              "queue-compiled image. (JVM is unaffected — it evaluates conditions at runtime.)")


def rps(v):
    return ((v.get("metrics") or {}).get("throughputRps") or {}).get("median")


def main() -> int:
    ref = json.loads(REFRESH.read_text())
    con = json.loads(CONSOLIDATED.read_text())

    idx = {(v["id"], v["ingestMode"]): i for i, v in enumerate(con["variants"])}
    changed = []
    for nv in ref["variants"]:
        key = (nv["id"], nv["ingestMode"])
        if nv.get("supported") and nv.get("metrics"):
            nv = {**nv, "notes": NOTE}
        elif nv["ingestMode"] == "queue":
            nv = {**nv, "notes": QUEUE_NOTE}
        if key in idx:
            old = rps(con["variants"][idx[key]])
            con["variants"][idx[key]] = nv
            changed.append(f"  {key[0]:26} {key[1]:5}  {old} -> {rps(nv)}  supported={nv['supported']}")
        else:
            con["variants"].append(nv)
            changed.append(f"  {key[0]:26} {key[1]:5}  (added)  rps={rps(nv)}")

    CONSOLIDATED.write_text(json.dumps(con, indent=2, ensure_ascii=False))
    shutil.copy(CONSOLIDATED, PUBLIC)

    print("Patched native entries (throughput median):")
    print("\n".join(changed))
    print(f"\n✓ {CONSOLIDATED.name} updated and copied to frontend/public/")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
