"""CI-only independent IFC4 parser/EXPRESS/fixture checks; synthetic local files only."""
import csv
import json
import math
import re
import sys
from collections import Counter
from pathlib import Path

import ifcopenshell
import ifcopenshell.util.element
import ifcopenshell.util.placement
import ifcopenshell.util.unit
import ifcopenshell.validate

root = Path(sys.argv[1] if len(sys.argv) > 1 else "output/ifc-validation").resolve()
manifest = json.loads((root / "manifest.json").read_text())
assert manifest["synthetic"] is True and manifest["schemaVersion"] == 1
assert manifest["emptyExportRejected"] is True
assert ifcopenshell.version == manifest["ifcopenshellVersion"], "Unexpected validator version"
results = []
identities = {}


def close(actual, expected, message):
    assert math.isclose(float(actual), float(expected), rel_tol=1e-8, abs_tol=1e-4), f"{message}: {actual} != {expected}"


def single_coordlist_argument(text):
    for args in re.findall(r"=IFCCARTESIANPOINTLIST3D\((.*)\);", text):
        depth = 0
        for char in args:
            if char == "(":
                depth += 1
            elif char == ")":
                depth -= 1
            elif char == "," and depth == 0:
                raise AssertionError("IFC4 IfcCartesianPointList3D has only CoordList; extra argument found")
        assert depth == 0


def panel_area(plate):
    values = []
    for relation in plate.IsDefinedBy:
        definition = relation.RelatingPropertyDefinition
        if definition.is_a("IfcElementQuantity"):
            values.extend(q.AreaValue for q in definition.Quantities if q.is_a("IfcQuantityArea") and q.Name == "FaceArea")
    assert len(values) == 1, "Exactly one declared panel face area is required"
    return values[0]


def check_fixture(fixture):
    path = root / fixture["file"]
    assert path.parent == root and path.suffix == ".ifc"
    logger = ifcopenshell.validate.json_logger()
    ifcopenshell.validate.validate(str(path), logger, express_rules=True)
    errors = [entry for entry in logger.statements if entry.get("level", "error") in ("error", "critical")]
    assert not errors, "Schema/parser/EXPRESS: " + json.dumps(errors[:5], ensure_ascii=False, default=str)
    single_coordlist_argument(path.read_text())
    model = ifcopenshell.open(str(path))
    assert model.schema == "IFC4", model.schema
    projects = model.by_type("IfcProject")
    assert len(projects) == 1
    units = {u.UnitType: u for u in projects[0].UnitsInContext.Units}
    assert units["LENGTHUNIT"].Name == "METRE" and units["LENGTHUNIT"].Prefix == "MILLI"
    assert units["AREAUNIT"].Name == "SQUARE_METRE" and units["AREAUNIT"].Prefix is None
    close(ifcopenshell.util.unit.calculate_unit_scale(model), .001, "Length SI scale")
    roots = model.by_type("IfcRoot")
    assert len({entity.GlobalId for entity in roots}) == len(roots), "Duplicate IFC GUIDs"
    expected = fixture["expected"]
    plates = model.by_type("IfcPlate")
    assert len(plates) == len(expected["panels"])
    by_tag = {plate.Tag: plate for plate in plates}
    assert len(by_tag) == len(plates)
    assert set(by_tag) == {panel["tag"] for panel in expected["panels"]}
    assert {storey.Name for storey in model.by_type("IfcBuildingStorey")} == set(expected["storeys"])
    area = 0
    for panel in expected["panels"]:
        plate = by_tag[panel["tag"]]
        assert plate.Name == panel["name"]
        assert len(plate.ContainedInStructure) == 1
        assert plate.ContainedInStructure[0].RelatingStructure.Name == panel["storey"]
        matrix = ifcopenshell.util.placement.get_local_placement(plate.ObjectPlacement)
        for axis in range(3):
            close(matrix[axis, 3], panel["positionMm"][axis], "Panel origin")
        basis = [[1, 0, 0], [0, 0, -1], [0, 1, 0]] if fixture["kind"] == "detailed" else [[1, 0, 0], [0, 1, 0], [0, 0, 1]]
        for row in range(3):
            for col in range(3):
                close(matrix[row, col], basis[row][col], "Panel orientation")
        meshes = [item for representation in plate.Representation.Representations for item in representation.Items]
        assert len(meshes) == expected["partsPerPanel"]
        points = []
        for mesh in meshes:
            assert mesh.is_a("IfcTriangulatedFaceSet") and mesh.Closed is True
            vertices = mesh.Coordinates.CoordList
            triangles = mesh.CoordIndex
            assert len(vertices) == expected["verticesPerPart"]
            assert len(triangles) == expected["trianglesPerPart"]
            points.extend(vertices)
            edges = Counter()
            for triangle in triangles:
                assert len(triangle) == 3 and len(set(triangle)) == 3
                assert all(1 <= index <= len(vertices) for index in triangle)
                for i in range(3):
                    edges[tuple(sorted((triangle[i], triangle[(i + 1) % 3])))] += 1
            assert all(count == 2 for count in edges.values()), "Mesh is not closed"
        for axis in range(3):
            close(min(point[axis] for point in points), panel["localBoundsMm"][0][axis], "Local minimum")
            close(max(point[axis] for point in points), panel["localBoundsMm"][1][axis], "Local maximum")
        psets = ifcopenshell.util.element.get_psets(plate)
        if fixture["kind"] == "detailed":
            assert psets["SP_CassetteFinish"]["Finish"] == panel["finish"]
            assert psets["SP_CassetteCoordination"]["Manufacturer"] == expected["manufacturer"]
            assert psets["SP_CassetteCoordination"]["Profile"] == expected["profileLabel"]
            material = ifcopenshell.util.element.get_material(plate)
            assert material is not None and material.Name == expected["material"]
        else:
            props = psets["SP_CassetteLayout"]
            assert props["PanelId"] == panel["tag"] and props["Finish"] == panel["finish"]
            assert props["ReviewStatus"] == panel["status"]
            assert props["Geometry"] == "Rectangular face envelope only"
        value = panel_area(plate)
        close(value, panel["faceAreaM2"], "Panel face area")
        area += value
    close(area, expected["faceAreaM2"], "Total exported face area")
    ids = {tag: plate.GlobalId for tag, plate in by_tag.items()}
    group = fixture["identityGroup"]
    if group in identities:
        assert identities[group] == ids, "Panel identity changed on repeat/revision export"
    else:
        identities[group] = ids
    with (root / fixture["csv"]).open(encoding="utf-8-sig", newline="") as stream:
        rows = list(csv.DictReader(stream, delimiter=";"))
    if fixture["kind"] == "detailed":
        assert len(rows) == len(plates)
        assert {row["Марка"] for row in rows} == set(by_tag)
        close(sum(float(row["Площадь лица всего, м²"]) for row in rows), area, "CSV versus IFC area")
    else:
        assert len(rows) == len(expected["cells"])
        csv_by_id = {row["ID панели"]: row for row in rows}
        assert set(csv_by_id) == {cell["id"] for cell in expected["cells"]}
        for cell in expected["cells"]:
            row = csv_by_id[cell["id"]]
            assert int(row["Количество позиций"]) == (0 if cell["status"] == "opening-removed" else 1)
            close(row["Остаток лица, м²"], cell["area"], "Full schedule face area")
            assert (cell["id"] in by_tag) == (cell["rect"] is not None)
        close(sum(float(row["Остаток лица, м²"]) for row in rows), expected["scheduleFaceAreaM2"], "Schedule includes omitted panels")
        summary = json.loads((root / expected["summaryFile"]).read_text())
        assert summary["exportedPanels"] == len(plates)
        assert summary["omittedPanelIds"] == expected["omittedPanelIds"]
        assert summary["omittedPanels"] == len(expected["omittedPanelIds"])
        assert summary["removedPanels"] == len(expected["removedPanelIds"])
        assert not (set(expected["omittedPanelIds"] + expected["removedPanelIds"]) & set(by_tag))
        close(summary["exportedFaceAreaM2"], area, "Summary versus IFC area")
    return {"name": fixture["name"], "passed": True, "schema": model.schema, "panels": len(plates), "faceAreaM2": area, "schemaMessages": len(logger.statements)}


for fixture in manifest["fixtures"]:
    try:
        result = check_fixture(fixture)
    except Exception as error:
        result = {"name": fixture["name"], "passed": False, "error": f"{type(error).__name__}: {error}"}
    results.append(result)
    print(json.dumps(result, ensure_ascii=False), flush=True)
report = {"validator": "IfcOpenShell", "version": ifcopenshell.version, "schema": "IFC4", "expressRules": True, "synthetic": True, "passed": all(result["passed"] for result in results), "fixtures": results}
(root / "validation-results.json").write_text(json.dumps(report, ensure_ascii=False, indent=2, default=str))
sys.exit(0 if report["passed"] else 1)
