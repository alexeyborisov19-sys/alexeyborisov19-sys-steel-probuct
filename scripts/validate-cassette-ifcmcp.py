#!/usr/bin/env python3
"""Read-only IFC schema/EXPRESS validation with official IfcMCP + geometry readback.

Run only against repository assets and test exports. No MCP listener is started;
no model is saved or edited. This does not certify an MVD or authoring application.
"""
from __future__ import annotations
import argparse
import hashlib
import importlib.metadata
import json
from pathlib import Path

from ifcmcp.core import IfcSession
import ifcopenshell.geom
import ifcopenshell.util.element
import ifcopenshell.util.unit

ROOT = Path(__file__).resolve().parents[1]


def validate_one(path: Path, exported: bool) -> dict:
    before = hashlib.sha256(path.read_bytes()).hexdigest()
    session = IfcSession()
    session.ifc_load(str(path))
    result = session.ifc_validate(express_rules=True)
    record = {"file": path.name, "sha256": before, "schema": session.model.schema,
              "validation": result, "web_export": exported}
    if result.get("valid") is not True:
        return record
    assert session.model.schema == "IFC4", path.name
    elements = session.model.by_type("IfcElement")
    record["element_count"] = len(elements)
    assert len(elements) == (1 if exported or path.name.startswith("SP-") else 15), path.name
    roots = session.model.by_type("IfcRoot")
    guids = [root.GlobalId for root in roots]
    assert len(guids) == len(set(guids)), f"Duplicate GUID: {path.name}"
    if exported:
        element = elements[0]
        assert element.is_a() in ("IfcCovering", "IfcBuildingElementProxy")
        psets = ifcopenshell.util.element.get_psets(element)
        assert psets["SP_Source"]["ManufacturingApproved"] is False
        assert psets["SP_Source"]["NativeParametricEditing"] is False
        assert len(element.ContainedInStructure) == 1
        assert len(element.IsTypedBy) == 1
        shape = ifcopenshell.geom.create_shape(ifcopenshell.geom.settings(), element)
        vertices = shape.geometry.verts
        assert len(vertices) >= 12 and len(shape.geometry.faces) >= 12
        # IfcOpenShell geometry is in SI metres; our explicit IFC length unit is mm.
        factor = ifcopenshell.util.unit.calculate_unit_scale(session.model)
        actual = [(max(vertices[i::3]) - min(vertices[i::3])) / factor for i in range(3)]
        expected = [psets["SP_Dimensions"]["BoundingSize" + axis] for axis in "XYZ"]
        assert all(abs(a - b) < 0.002 for a, b in zip(actual, expected)), (path.name, actual, expected)
        record["geometry_bbox_mm"] = actual
        record["declared_bbox_mm"] = expected
    assert hashlib.sha256(path.read_bytes()).hexdigest() == before, "Read-only validation changed an input"
    session.ifc_reset()
    return record


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--exports", type=Path, required=True)
    parser.add_argument("--report", type=Path, required=True)
    args = parser.parse_args()
    sources = sorted((ROOT / "public/bim/metallokassety").rglob("*.ifc"))
    exports = sorted(args.exports.glob("*.ifc"))
    assert len(sources) == 32, f"Expected 32 source IFCs, found {len(sources)}"
    assert len(exports) >= 45, f"Expected at least 45 web exports, found {len(exports)}"
    rows = []
    for path, exported in [(p, False) for p in sources] + [(p, True) for p in exports]:
        try:
            row = validate_one(path, exported)
        except Exception as exc:
            row = {"file": path.name, "web_export": exported, "validation": {"valid": False},
                   "error": f"{type(exc).__name__}: {exc}"}
        rows.append(row)
        print(path.name, "PASS" if row["validation"].get("valid") is True else "FAIL", flush=True)
    failed = [row for row in rows if row["validation"].get("valid") is not True]
    versions = {name: importlib.metadata.version(name) for name in ["ifcopenshell-mcp", "ifcopenshell", "ifcquery", "ifcedit"]}
    report = {"tool": "IfcMCP IfcSession.ifc_validate(express_rules=True)", "versions": versions,
              "read_only": True, "MVD_certified": False, "Revit_Archicad_import_tested": False,
              "files": len(rows), "failed": len(failed), "results": rows}
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    if failed:
        print(json.dumps(failed, ensure_ascii=False, indent=2), flush=True)
        raise SystemExit(1)
    print(f"PASS: {len(rows)} IFCs; schema + EXPRESS; web geometry independently reopened.")


if __name__ == "__main__":
    main()
