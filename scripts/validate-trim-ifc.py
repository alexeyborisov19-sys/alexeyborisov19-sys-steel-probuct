"""Independent IFC4 schema, units, metadata, mesh and stable-identity validation.
Run in the repository's pinned IfcOpenShell 0.8.5 + pytest 8.4.2 CI environment.
No production/customer inputs, rendering, credentials or remote uploads.
"""
import csv
import json
import math
import sys
from collections import defaultdict
from pathlib import Path
import ifcopenshell
import ifcopenshell.util.element
import ifcopenshell.util.unit
import ifcopenshell.validate

root = Path(sys.argv[1] if len(sys.argv) > 1 else "output/trim-ifc-validation").resolve()
manifest = json.loads((root / "manifest.json").read_text())
assert manifest["synthetic"] is True and manifest["schemaVersion"] == 1
assert ifcopenshell.version == manifest["ifcopenshellVersion"]
identities = {}
results = []

def close(actual, expected, message):
    assert math.isclose(actual, expected, rel_tol=1e-8, abs_tol=1e-18), f"{message}: {actual} != {expected}"

for fixture in manifest["fixtures"]:
    path = root / fixture["file"]
    assert path.parent == root and path.suffix == ".ifc"
    logger = ifcopenshell.validate.json_logger()
    ifcopenshell.validate.validate(str(path), logger, express_rules=True)
    errors = [entry for entry in logger.statements if entry.get("level", "error") in ("error", "critical")]
    assert not errors, json.dumps(errors[:5], ensure_ascii=False, default=str)
    model = ifcopenshell.open(str(path))
    assert model.schema == "IFC4"
    assert len(model.by_type("IfcProject")) == 1
    close(ifcopenshell.util.unit.calculate_unit_scale(model), .001, "Millimetre unit scale")
    roots = model.by_type("IfcRoot")
    assert len({item.GlobalId for item in roots}) == len(roots)
    elements = model.by_type("IfcBuildingElementProxy")
    assert len(elements) == 1
    element, project, expected = elements[0], fixture["project"], fixture["expected"]
    assert element.Name == (project["mark"].strip() or "Элемент 1") and element.Tag == project["elementId"]
    assert element.PredefinedType == "USERDEFINED" and element.ObjectType
    assert len(element.ContainedInStructure) == 1
    props = ifcopenshell.util.element.get_psets(element)["SP_TrimShape"]
    assert props["Notice"] == manifest["notice"] and props["GeometryScope"] == manifest["geometryScope"]
    assert props["SourceImage"] == expected["source"] and props["Template"] == expected["template"]
    assert props["ProjectId"] == project["id"] and props["ProjectRevision"] == str(project["revision"])
    assert props["ElementId"] == project["elementId"]
    dimensions = project["dimensionsMm"]
    for key in ["A", "B", "H", "T"]:
        close(props[key], dimensions[key], "Source-letter dimension")
    assert props["C"] == "90 deg; catalogue section angle"
    meshes = model.by_type("IfcTriangulatedFaceSet")
    assert len(meshes) == 1
    mesh = meshes[0]
    assert mesh.Closed is True
    points, triangles = mesh.Coordinates.CoordList, mesh.CoordIndex
    assert len(points) == expected["vertices"] and len(triangles) == expected["triangles"]
    assert all(math.isfinite(v) for point in points for v in point)
    close(max(p[2] for p in points), dimensions["H"], "Extrusion length")
    assert min(p[2] for p in points) == 0
    for axis, label in [(0, "B"), (1, "A"), (2, "H")]:
        assert min(point[axis] for point in points) == 0
        close(max(point[axis] for point in points), dimensions[label], "Outside dimension")
    precision = model.by_type("IfcGeometricRepresentationContext")[0].Precision
    distances = [math.dist(a,b) for i,a in enumerate(points) for b in points[i+1:]]
    assert 0 < precision < min(distances), "Declared precision must preserve distinct vertices"
    close(precision, .00001, "Fixed IFC coordinate tolerance")
    volume = 0
    edges = defaultdict(list)
    for triangle in triangles:
        assert len(set(triangle)) == 3 and all(1 <= i <= len(points) for i in triangle)
        a, b, c = (points[i-1] for i in triangle)
        normal = ((b[1]-a[1])*(c[2]-a[2])-(b[2]-a[2])*(c[1]-a[1]), (b[2]-a[2])*(c[0]-a[0])-(b[0]-a[0])*(c[2]-a[2]), (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]))
        assert sum(n*n for n in normal) > 0
        volume += (a[0]*(b[1]*c[2]-b[2]*c[1])+a[1]*(b[2]*c[0]-b[0]*c[2])+a[2]*(b[0]*c[1]-b[1]*c[0]))/6
        for i in range(3):
            u, v = triangle[i], triangle[(i+1)%3]
            edges[tuple(sorted((u, v)))].append(1 if u < v else -1)
    assert all(len(directions) == 2 and sum(directions) == 0 for directions in edges.values())
    close(volume, expected["volumeMm3"], "Positive oriented solid volume")
    group = fixture["identityGroup"]
    if group in identities:
        assert identities[group] == element.GlobalId
    else:
        identities[group] = element.GlobalId
    csv_path = root / fixture["csv"]
    assert csv_path.parent == root
    rows = list(csv.DictReader(csv_path.open(encoding="utf-8-sig"), delimiter=";"))
    assert len(rows) == 1 and rows[0]["Notice"] == manifest["notice"]
    assert rows[0]["SourceImage"] == expected["source"]
    for key in ["A", "B", "H", "T"]:
        close(float(rows[0][f"{key}_mm"]), dimensions[key], "CSV dimension")
    assert rows[0]["Mark"] == (project["mark"].strip() or "Элемент 1")
    results.append({"fixture": fixture["name"], "schema": model.schema, "vertices": len(points), "triangles": len(triangles), "volumeMm3": volume})
assert len(set(identities.values())) == len(identities)
print(json.dumps({"validated": len(results), "results": results}, ensure_ascii=False, indent=2))
