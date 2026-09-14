import type { CadMeshPrimitive } from "@/lib/instant-quote/cad-model";
import {
  analyzeSheetMetalTopology,
  type CylinderFaceObservation,
  type PlaneFaceObservation,
  type SheetMetalAnalysis,
} from "@/lib/instant-quote/sheet-metal";
import type { StepKernelPort, StepKernelResult } from "@/lib/instant-quote/step-adapter";

type OcctKernelInstance = import("occt-wasm").OcctKernel;
type OcctShapeHandle = import("occt-wasm").ShapeHandle;

const HASH_UPPER_BOUND = 0x7fffffff;

function finiteVec3(vector: { x: number; y: number; z: number }) {
  return Number.isFinite(vector.x) && Number.isFinite(vector.y) && Number.isFinite(vector.z);
}

function collectSheetMetalAnalysis(kernel: OcctKernelInstance, shape: OcctShapeHandle): SheetMetalAnalysis {
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

        planarFaces.push({
          id: faceId,
          areaMm2,
          centerMm: [center.x, center.y, center.z],
          normal: [normal.x, normal.y, normal.z],
          edgeHashes,
        });
        continue;
      }

      if (surfaceType === "cylinder") {
        const cylinder = kernel.getFaceCylinderData(face);
        const bounds = kernel.uvBounds(face);
        const angleSpanRad = Math.abs(bounds.uMax - bounds.uMin);
        if (
          cylinder &&
          Number.isFinite(cylinder.radius) &&
          cylinder.radius > 0 &&
          cylinder.origin.every(Number.isFinite) &&
          cylinder.direction.every(Number.isFinite) &&
          Number.isFinite(angleSpanRad)
        ) {
          cylindricalFaces.push({
            id: faceId,
            areaMm2,
            radiusMm: cylinder.radius,
            originMm: [cylinder.origin[0], cylinder.origin[1], cylinder.origin[2]],
            axis: [cylinder.direction[0], cylinder.direction[1], cylinder.direction[2]],
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

  return analyzeSheetMetalTopology({ planarFaces, cylindricalFaces, otherFaceCount });
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
        sheetMetal = collectSheetMetalAnalysis(kernel, shape);
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
