import test from "node:test";
import assert from "node:assert/strict";
import { buildSync } from "esbuild";
import { createRequire } from "node:module";
import { type CassetteBimInput } from "../lib/bim/cassette";
import { cassetteGeometry, cassetteSource, type CassetteSolid, type Vec3 } from "../lib/bim/cassette-geometry";
import {
  canInspectCassetteNeighbours, cassetteInspectionBounds, cassetteInspectionColour,
  cassetteInspectionLight, cassetteInspectionSeam, createCassetteInspectionInstances,
  projectCassetteInspection,
} from "../lib/bim/cassette-inspection";

function input(profile: "open" | "closed" = "open", thicknessMm = .7): CassetteBimInput {
  const source = cassetteSource({ profile, thicknessMm } as CassetteBimInput);
  return { profile, thicknessMm, widthMm: source.width, heightMm: source.height, depthMm: source.depth,
    jointMm: 45, columns: 2, rows: 3, mark: "K1", finish: "По проекту" };
}
const close = (actual: number, expected: number, message?: string) => assert.ok(Math.abs(actual - expected) < 1e-7, message ?? `${actual} != ${expected}`);
const instance = (solid: CassetteSolid) => [{ id: "A" as const, solids: [solid], offset: [0, 0, 0] as Vec3 }];
const triangle: CassetteSolid = { vertices: [[0, 0, 0], [100, 0, 0], [0, 100, 0]], faces: [[0, 2, 1]] };

const output = buildSync({
  stdin: { contents: `
    import {createElement} from 'react';
    import {renderToStaticMarkup} from 'react-dom/server';
    import {CassetteInspectionView, CassetteBimShapePreview} from './components/CassetteBimShapePreview';
    export const view = props => renderToStaticMarkup(createElement(CassetteInspectionView, props));
    export const controls = props => renderToStaticMarkup(createElement(CassetteBimShapePreview, props));
  `, resolveDir: process.cwd(), loader: "ts" },
  bundle: true, platform: "node", format: "cjs", jsx: "automatic", write: false, logLevel: "silent",
});
const compiled = { exports: {} as { view: (props: unknown) => string; controls: (props: unknown) => string } };
new Function("module", "exports", "require", output.outputFiles[0].text)(compiled, compiled.exports, createRequire(`${process.cwd()}/package.json`));

test("inspection places whole immutable source solids by face pitch on both axes", () => {
  const p = input(), solids = cassetteGeometry(p), original = JSON.stringify({ p, solids });
  for (const axis of ["horizontal", "vertical"] as const) {
    for (const mode of ["single", "neighbours", "exploded"] as const) {
      const instances = createCassetteInspectionInstances(p, solids, mode, axis);
      assert.equal(instances.length, mode === "single" ? 1 : 2);
      assert.equal(instances[0].solids, solids);
      assert.deepEqual(instances[0].offset, [0, 0, 0]);
      if (instances[1]) {
        assert.equal(instances[1].solids, solids);
        assert.deepEqual(instances[1].offset.slice(0, 2), axis === "horizontal" ? [p.widthMm + p.jointMm, 0] : [0, p.heightMm + p.jointMm]);
        assert.equal(instances[1].offset[2] > 0, mode === "exploded");
      }
      const [start, end] = cassetteInspectionSeam(p, axis);
      close(Math.hypot(...end.map((value, index) => value - start[index])), p.jointMm);
      assert.equal(start[2], 0); assert.equal(end[2], 0);
      const scene = projectCassetteInspection(instances, 145, 20);
      assert.ok(scene.polygons.length > 0);
      for (const polygon of scene.polygons) for (const point of polygon.points) {
        assert.ok(point.every(Number.isFinite));
        assert.ok(point[0] >= 59.999 && point[0] <= 840.001);
        assert.ok(point[1] >= 54.999 && point[1] <= 475.001);
      }
    }
  }
  assert.equal(JSON.stringify({ p, solids }), original);
});

test("all four outward-wound STEP variants omit backfaces at front, back and oblique cameras", () => {
  for (const profile of ["open", "closed"] as const) for (const thickness of [.7, 1]) {
    const p = input(profile, thickness), solids = cassetteGeometry(p);
    for (const [yaw, pitch] of [[0, 0], [180, 0], [90, 0], [145, 20], [275, -65]]) {
      const scene = projectCassetteInspection(createCassetteInspectionInstances(p, solids, "single", "horizontal"), yaw, pitch);
      assert.ok(scene.polygons.length > 0);
      for (const polygon of scene.polygons) {
        // Screen Y is downward: a visible outward face has positive projected area.
        const area = polygon.points.reduce((sum, point, index, points) => {
          const next = points[(index + 1) % points.length];
          return sum + point[0] * next[1] - next[0] * point[1];
        }, 0);
        assert.ok(area > -1e-7, `${profile}/${thickness}, camera ${yaw}/${pitch}: a backface survived`);
      }
    }
  }
});

test("signed lighting distinguishes opposite normals; coplanar triangles have no crease diagonal", () => {
  assert.ok(cassetteInspectionLight([0, 0, -1]) > cassetteInspectionLight([0, 0, 1]) + .4);
  const square: CassetteSolid = { vertices: [[0, 0, 0], [100, 0, 0], [100, 100, 0], [0, 100, 0]], faces: [[0, 3, 2], [0, 2, 1]] };
  const scene = projectCassetteInspection(instance(square), 0, 0);
  assert.equal(scene.polygons.length, 2);
  close(scene.polygons[0].light, scene.polygons[1].light);
  const edges = scene.polygons.flatMap(p => p.edges);
  assert.equal(edges.length, 4, "Only the square boundary is an edge; its mesh diagonal is not a fold");
  assert.ok(edges.every(edge => edge.silhouette));
  const folded: CassetteSolid = { vertices: [[0, 0, 0], [100, 0, 0], [0, 100, 0], [0, 0, 100]], faces: [[0, 2, 1], [0, 1, 3]] };
  const fold = projectCassetteInspection(instance(folded), 0, 20);
  assert.equal(fold.polygons.length, 2);
  assert.equal(fold.polygons.flatMap(p => p.edges).filter(edge => !edge.silhouette).length, 2, "Both adjacent visible faces retain the actual 90-degree crease");
  assert.equal(cassetteInspectionColour("invalid", NaN), "rgb(168,181,185)");
  assert.equal(cassetteInspectionColour("#ffffff", 20), "rgb(255,255,255)");
});

test("resizing the face translates edge zones without scaling native folds, holes or thickness", () => {
  for (const profile of ["open", "closed"] as const) for (const thickness of [.7, 1]) {
    const p = input(profile, thickness), source = cassetteSource(p);
    const original = cassetteGeometry(p)[0], resized = cassetteGeometry({ ...p, widthMm: p.widthMm + 230, heightMm: p.heightMm + 170 })[0];
    assert.equal(original.faces, source.mesh.faces); assert.equal(resized.faces, source.mesh.faces);
    assert.equal(original.vertices.length, resized.vertices.length);
    for (let index = 0; index < original.vertices.length; index++) {
      const native = source.mesh.vertices[index], before = original.vertices[index], after = resized.vertices[index];
      for (let axis = 0; axis < 3; axis++) close(before[axis], native[axis]);
      close(after[2], before[2]);
      if (before[0] < 50) close(after[0], before[0]);
      if (before[0] > p.widthMm - 50) close(after[0] - before[0], 230);
      if (before[1] < 50) close(after[1], before[1]);
      if (before[1] > p.heightMm - 50) close(after[1] - before[1], 170);
    }
  }
});

test("corner remains isolated even when a caller requests neighbor or exploded inspection", () => {
  const p: CassetteBimInput = { ...input(), profile: "corner", widthMm: 290, heightMm: 380, depthMm: 20, thicknessMm: 1, returnWidthMm: 330, columns: 1 };
  assert.equal(canInspectCassetteNeighbours(p), false);
  for (const mode of ["single", "neighbours", "exploded"] as const) {
    assert.equal(createCassetteInspectionInstances(p, cassetteGeometry(p), mode, "vertical").length, 1);
    const html = compiled.exports.view({ input: p, mode });
    assert.match(html, /data-inspection-mode="single"/);
    assert.match(html, /data-solid-instances="1"/);
    assert.match(html, /Показана одна угловая кассета/);
    assert.match(html, /Узел её примыкания не подтверждён/);
  }
  const controls = compiled.exports.controls({ input: p });
  assert.doesNotMatch(controls, /aria-label="Режим осмотра кассет"/);
});

test("invalid geometry, indices, camera and excessive meshes fail before preview output", () => {
  for (const bad of [
    { ...triangle, vertices: [[NaN, 0, 0], [1, 0, 0], [0, 1, 0]] },
    { ...triangle, faces: [[0, 1, 3]] }, { ...triangle, faces: [[0, 1, 1.5]] },
    { ...triangle, faces: [[0, 1]] }, { vertices: [[0, 0, 0]], faces: [[0, 0, 0]] },
    { vertices: Array.from({ length: 30_001 }, () => [0, 0, 0]), faces: [[0, 1, 2]] },
    { ...triangle, faces: Array.from({ length: 12_001 }, () => [0, 2, 1]) },
  ]) assert.throws(() => projectCassetteInspection(instance(bad as CassetteSolid), 0, 0));
  assert.throws(() => cassetteInspectionBounds([{ ...instance(triangle)[0], offset: [Infinity, 0, 0] }]));
  assert.throws(() => projectCassetteInspection(instance(triangle), NaN, 0));
  assert.throws(() => projectCassetteInspection(instance(triangle), 0, Infinity));
  assert.throws(() => createCassetteInspectionInstances({ ...input(), jointMm: -1 }, [triangle], "neighbours", "horizontal"));
  for (const p of [{ ...input(), widthMm: NaN }, { ...input(), jointMm: -1 }, { ...input(), profile: "unsupported" }, { ...input(), mark: null }]) {
    const html = compiled.exports.view({ input: p });
    assert.match(html, /role="alert"/); assert.doesNotMatch(html, /<svg/);
  }
  assert.match(compiled.exports.view({ input: input(), yaw: NaN }), /role="alert"/);
});

test("actual inspection SVG has accessible source descriptions and explicit unconfirmed placement notices", () => {
  for (const mode of ["single", "neighbours", "exploded"] as const) {
    const html = compiled.exports.view({ input: input(), mode, axis: "vertical" });
    assert.match(html, /<svg[^>]*role="img"[^>]*aria-labelledby="[^"]+"[^>]*aria-describedby="[^"]+"/);
    assert.match(html, /<title[^>]*>[^<]+<\/title>/);
    assert.match(html, /<desc[^>]*>[^<]+<\/desc>/);
    assert.doesNotMatch(html, /NaN|Infinity/);
    assert.match(html, /из исходной STEP-модели/);
    assert.match(html, /Геометрия деталей совпадает с IFC/);
    assert.match(html, /Упрощённый показ поверхностей/);
    assert.match(html, /data-depth-renderer="unavailable"/);
    assert.match(html, new RegExp(`data-solid-instances="${mode === "single" ? 1 : 2}"`));
    if (mode !== "single") {
      assert.match(html, /Два экземпляра по вертикали/);
      assert.match(html, /Предварительная координационная компоновка/);
      assert.match(html, /Узел зацепления и крепёж не подтверждены исходными моделями/);
    }
    if (mode === "exploded") assert.match(html, /Визуальное расстояние условное и не является монтажным зазором/);
  }
});

