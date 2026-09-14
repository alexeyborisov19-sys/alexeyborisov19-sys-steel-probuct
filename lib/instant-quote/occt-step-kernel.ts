import type { CadMeshPrimitive } from "@/lib/instant-quote/cad-model";
import {
  analyzeSheetMetalTopology,
  type CylinderFaceObservation,
  type PlaneFaceObservation,
  type SheetMetalAnalysis,
  type SheetMetalBoundaryEdgePreview,
  type SheetMetalBoundaryPreview,
  type SheetMetalBoundaryWirePreview,
  type Vector3,
} from "@/lib/instant-quote/sheet-metal";
import type { StepKernelPort, StepKernelResult } from "@/lib/instant-quote/step-adapter";

type OcctKernelInstance = import("occt-wasm").OcctKernel;
type OcctShapeHandle = import("occt-wasm").ShapeHandle;

const HASH_UPPER_BOUND = 0x7fffffff;

function finiteVec3(vector: { x: number; y: number; z: number }) {
  return Number.isFinite(vector.x) && Number.isFinite(vector.y) && Number.isFinite(vector.z);
}

function normalizeVector(vector: Vector3): Vector3 | null {
  const magnitude = Math.hypot(vector[0], vector[1], vector[2]);
  if (!(magnitude > 1e-9) || !Number.isFinite(magnitude)) return null;
  return [vector[0] / magnitude, vector[1] / magnitude, vector[2] / magnitude];
}

function deriveCylinderAxis(
  kernel: OcctKernelInstance,
  face: OcctShapeHandle,
  bounds: { uMin: number; uMax: number; vMin: number; vMax: number },
  radiusMm: number,
) {
  const uMid = (bounds.uMin + bounds.uMax) / 2;
  const vMid = (bounds.vMin + bounds.vMax) / 2;
  const vSpan = Math.abs(bounds.vMax - bounds.vMin);
  if (!(vSpan > 1e-8)) return null;

  const point = kernel.pointOnSurface(face, uMid, vMid);
  const normal = kernel.surfaceNormal(face, uMid, vMid);
  const lower = kernel.pointOnSurface(face, uMid, vMid - vSpan * 0.25);
  const upper = kernel.pointOnSurface(face, uMid, vMid + vSpan * 0.25);
  if (![point, normal, lower, upper].every(finiteVec3)) return null;

  const radial = normalizeVector([normal.x, normal.y, normal.z]);
  const axis = normalizeVector([upper.x - lower.x, upper.y - lower.y, upper.z - lower.z]);
  if (!radial || !axis) return null;

  return {
    axis,
    originMm: [
      point.x - radial[0] * radiusMm,
      point.y - radial[1] * radiusMm,
      point.z - radial[2] * radiusMm,
    ] as Vector3,
  };
}

function measureFaceBoundary(kernel: OcctKernelInstance, face: OcctShapeHandle) {
  const edges = kernel.getSubShapes(face, "edge");
  let boundaryLengthMm = 0;
  try {
    for (const edge of edges) {
      const edgeLength = kernel.getLength(edge);
      if (!Number.isFinite(edgeLength) || edgeLength <= 0) return null;
      boundaryLengthMm += edgeLength;
    }
  } finally {
    edges.forEach((edge) => kernel.release(edge));
  }

  const wireCount = kernel.subShapeCount(face, "wire");
  if (!(boundaryLengthMm > 0) || !Number.isInteger(wireCount) || wireCount < 1) return null;
  return { boundaryLengthMm, wireCount };
}

function displaySampleCount(curveKind: string, lengthMm: number) {
  if (curveKind === "line") return 1;
  const minimum = curveKind === "circle" || curveKind === "ellipse" ? 16 : 8;
  return Math.max(minimum, Math.min(96, Math.ceil(lengthMm / 4)));
}

function sampleEdgeInFaceUv(
  kernel: OcctKernelInstance,
  face: OcctShapeHandle,
  edge: OcctShapeHandle,
  bounds: { uMin: number; uMax: number; vMin: number; vMax: number },
  wireIndex: number,
  edgeIndex: number,
): SheetMetalBoundaryEdgePreview | null {
  const curveKind = kernel.curveType(edge);
  const parameters = kernel.curveParameters(edge);
  const lengthMm = kernel.curveLength(edge);
  if (![parameters.first, parameters.last, lengthMm].every(Number.isFinite) || !(lengthMm > 0)) return null;

  const segmentCount = displaySampleCount(curveKind, lengthMm);
  const pointsMm: Array<[number, number]> = [];
  for (let sampleIndex = 0; sampleIndex <= segmentCount; sampleIndex += 1) {
    const ratio = sampleIndex / segmentCount;
    const parameter = parameters.first + (parameters.last - parameters.first) * ratio;
    const point = kernel.curvePointAtParam(edge, parameter);
    if (!finiteVec3(point)) return null;
    const uv = kernel.uvFromPoint(face, point);
    const u = uv.u - bounds.uMin;
    const v = uv.v - bounds.vMin;
    if (!Number.isFinite(u) || !Number.isFinite(v)) return null;
    pointsMm.push([u, v]);
  }

  if (pointsMm.length < 2) return null;
  return {
    id: `wire-${wireIndex}-edge-${edgeIndex}-${kernel.hashCode(edge, HASH_UPPER_BOUND)}`,
    curveKind,
    pointsMm,
  };
}

/**
 * Display-only approximation of exact BRep edges in the planar face's own UV
 * coordinate system. Exact commercial cut length still comes from BRep length;
 * sampled points can never affect pricing.
 */
function collectBoundaryPreview(
  kernel: OcctKernelInstance,
  face: OcctShapeHandle,
  bounds: { uMin: number; uMax: number; vMin: number; vMax: number },
): SheetMetalBoundaryPreview | undefined {
  const wires = kernel.getSubShapes(face, "wire");
  const previewWires: SheetMetalBoundaryWirePreview[] = [];

  try {
    for (let wireIndex = 0; wireIndex < wires.length; wireIndex += 1) {
      const wire = wires[wireIndex];
      const edges = kernel.getSubShapes(wire, "edge");
      const previewEdges: SheetMetalBoundaryEdgePreview[] = [];
      try {
        for (let edgeIndex = 0; edgeIndex < edges.length; edgeIndex += 1) {
          const preview = sampleEdgeInFaceUv(kernel, face, edges[edgeIndex], bounds, wireIndex, edgeIndex);
          if (!preview) return undefined;
          previewEdges.push(preview);
        }
      } finally {
        edges.forEach((edge) => kernel.release(edge));
      }

      if (!previewEdges.length) return undefined;
      previewWires.push({ id: `wire-${wireIndex}`, edges: previewEdges });
    }
  } finally {
    wires.forEach((wire) => kernel.release(wire));
  }

  if (!previewWires.length) return undefined;
  return { source: "brep-edge-sampling", displayOnly: true, wires: previewWires };
}

function collectSheetMetalAnalysis(
  kernel: OcctKernelInstance,
  shape: OcctShapeHandle,
  volumeMm3?: number,
): SheetMetalAnalysis {
  const faces = kernel.getSubShapes(shape, "face");
  const planarFaces: PlaneFaceObservation[] = [];
  const cylindricalFaces: CylinderFaceObservation[] = [];
  let otherFaceCount = 0;

  for (let index = 0; index < faces.length; index += 1) {
    const face = faces[index];
    try {
      const areaMm2 = kernel.getSurfaceArea(face);
      if (!Number.isFinite(areaMm2) || areaMm2 <= 0) {
        otherFaceCount += 1;
        continue;
      }

      const faceHash = kernel.hashCode(face, HASH_UPPER_BOUND);
      const faceId = `face-${index}-${faceHash}`;
      const edgeHashes = kernel.subShapeHashes(face, "edge", HASH_UPPER_BOUND);
      const surfaceType = kernel.surfaceType(face);

      if (surfaceType === "plane") {
        const center = kernel.getSurfaceCenterOfMass(face);
        const bounds = kernel.uvBounds(face);
        const uvIsFinite = [bounds.uMin, bounds.uMax, bounds.vMin, bounds.vMax].every(Number.isFinite);
        if (!finiteVec3(center) || !uvIsFinite) {
          otherFaceCount += 1;
          continue;
        }

        const normal = kernel.surfaceNormal(
          face,
          (bounds.uMin + bounds.uMax) / 2,
          (bounds.vMin + bounds.vMax) / 2,
        );
        if (!finiteVec3(normal)) {
          otherFaceCount += 1;
          continue;
        }

        const boundary = measureFaceBoundary(kernel, face);
        let boundaryPreview: SheetMetalBoundaryPreview | undefined;
        try {
          boundaryPreview = collectBoundaryPreview(kernel, face, bounds);
        } catch {
          // Preview sampling is non-authoritative. Exact BRep measurements remain usable.
        }

        planarFaces.push({
          id: faceId,
          areaMm2,
          centerMm: [center.x, center.y, center.z],
          normal: [normal.x, normal.y, normal.z],
          edgeHashes,
          uvSizeMm: [Math.abs(bounds.uMax - bounds.uMin), Math.abs(bounds.vMax - bounds.vMin)],
          boundaryLengthMm: boundary?.boundaryLengthMm,
          wireCount: boundary?.wireCount,
          boundaryPreview,
        });
        continue;
      }

      if (surfaceType === "cylinder") {
        const cylinder = kernel.getFaceCylinderData(face);
        const bounds = kernel.uvBounds(face);
        const angleSpanRad = Math.abs(bounds.uMax - bounds.uMin);
        if (cylinder && Number.isFinite(cylinder.radius) && cylinder.radius > 0 && Number.isFinite(angleSpanRad)) {
          const axisData = deriveCylinderAxis(kernel, face, bounds, cylinder.radius);
          cylindricalFaces.push({
            id: faceId,
            areaMm2,
            radiusMm: cylinder.radius,
            originMm: axisData?.originMm,
            axis: axisData?.axis,
            angleSpanRad,
            edgeHashes,
          });
        } else {
          otherFaceCount += 1;
        }
        continue;
      }

      otherFaceCount += 1;
    } catch {
      // A single unusual face must not make an otherwise inspectable STEP fail.
      otherFaceCount += 1;
    } finally {
      kernel.release(face);
    }
  }

  return analyzeSheetMetalTopology(
    { planarFaces, cylindricalFaces, otherFaceCount },
    { volumeMm3 },
  );
}

/**
 * Browser-side OpenCascade STEP bridge.
 *
 * occt-wasm is intentionally loaded lazily so Next.js never initializes the
 * WASM kernel during SSR. The kernel instance is reused across imported parts;
 * individual ShapeHandles are released immediately after extraction.
 */
class OcctStepKernel implements StepKernelPort {
  readonly id = "occt-wasm-5";

  private kernelPromise: Promise<import("occt-wasm").OcctKernel> | null = null;

  private async kernel() {
    if (!this.kernelPromise) {
      this.kernelPromise = import("occt-wasm").then(({ OcctKernel }) => OcctKernel.init());
    }
    return this.kernelPromise;
  }

  async readStep(bytes: Uint8Array): Promise<StepKernelResult> {
    if (!bytes.byteLength) throw new Error("STEP-файл пустой.");

    const kernel = await this.kernel();
    const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    const shape = kernel.importStep(arrayBuffer);

    try {
      const mesh = kernel.tessellate(shape);
      if (!mesh.indices.length || !mesh.positions.length) {
        throw new Error("OpenCascade импортировал STEP, но не смог построить отображаемую сетку.");
      }

      let volumeMm3: number | undefined;
      try {
        const volume = kernel.getVolume(shape);
        if (Number.isFinite(volume) && volume > 0) volumeMm3 = volume;
      } catch {
        // Open or surface-only STEP files may not have a meaningful solid volume.
      }

      let solidCount = 0;
      try {
        solidCount = kernel.subShapeCount(shape, "solid");
      } catch {
        // Tessellated surface models can still be shown even when no solids are reported.
      }

      let sheetMetal: SheetMetalAnalysis | undefined;
      const warnings: string[] = [];
      try {
        sheetMetal = collectSheetMetalAnalysis(kernel, shape, volumeMm3);
      } catch {
        warnings.push("BRep-анализ листовой геометрии не завершён; STEP остаётся доступен для 3D-просмотра и ручной технологической проверки.");
      }

      const primitive: CadMeshPrimitive = {
        id: "step-model",
        name: "STEP model",
        positions: Array.from(mesh.positions),
        normals: mesh.normals.length ? Array.from(mesh.normals) : undefined,
        indices: Array.from(mesh.indices),
      };

      if (!volumeMm3) warnings.push("STEP не содержит подтверждённого замкнутого объёма; масса и толщина требуют дополнительного анализа.");
      if (solidCount === 0) warnings.push("OpenCascade не обнаружил отдельные solid-тела; модель доступна для просмотра, но требует технологической проверки.");

      return {
        meshes: [primitive],
        volumeMm3,
        bodyCount: solidCount || undefined,
        root: null,
        features: [],
        sheetMetal,
        warnings,
        parserVersion: "5.0.0",
      };
    } finally {
      kernel.release(shape);
    }
  }
}

export const occtStepKernel = new OcctStepKernel();
