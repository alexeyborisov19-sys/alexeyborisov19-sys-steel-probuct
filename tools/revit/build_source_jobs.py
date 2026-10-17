#!/usr/bin/env python3
"""Prepare reproducible Revit-family source jobs from the verified IFC library.

This is a preflight / source manifest, NOT a converter to native .rfa.
No files in public/, site components, or production are modified.
"""
from __future__ import annotations
import argparse
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MODELS = ROOT / "public/bim/metallokassety-parametric/models.json"
SOURCE = ROOT / "public/bim"
TARGET = {"SP-CAS-01", "SP-CAS-03", "SP-CAS-05"}


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def create_jobs():
    models = json.loads(MODELS.read_text(encoding="utf-8"))
    assert len(models) == 15 and len({m["id"] for m in models}) == 15
    jobs = []
    for m in models:
        code = m["id"]
        oriented = code in TARGET
        base = "metallokassety-oriented" if oriented else "metallokassety"
        paths = {}
        for variant in ("IFC4_coordination", "IFC4_exact_geometry"):
            p = SOURCE / base / variant / (code + ".ifc")
            assert p.is_file(), f"Missing source: {p}"
            blob = p.read_bytes()
            assert blob.startswith(b"ISO-10303-21;")
            assert b"END-ISO-10303-21;" in blob[-100:]
            paths[variant] = {"path": p.relative_to(ROOT).as_posix(), "sha256": sha256(p)}
        declared = m.get("orientedCoordSha256") if oriented else m["ifcSha256"]
        assert paths["IFC4_coordination"]["sha256"] == declared, f"Source changed: {code}"
        jobs.append({
            "model_id": code,
            "source_name": m["name"],
            "category": m["category"],
            "fixing_type": m["fixing_type"],
            "measured_sample_thickness_mm": m["measured_thickness_mm"],
            "upper_lock_positive_z": oriented,
            "source_ifc": paths,
            "native_family_status": "NOT_GENERATED",
            "revit_geometry_and_constraints_verified": False,
            "approved_joint": False,
        })
    return {"schema": "steelprodukt-revit-source-jobs-v1",
            "count": len(jobs), "jobs": jobs,
            "notice": "IFC files are fixed shape sources; no RFA or native editability is claimed."}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", type=Path, help="write deterministic JSON jobs to this path")
    args = parser.parse_args()
    result = create_jobs()
    serialized = json.dumps(result, ensure_ascii=False, indent=2) + "\n"
    if args.out:
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(serialized, encoding="utf-8")
    else:
        print(serialized, end="")


if __name__ == "__main__":
    main()
