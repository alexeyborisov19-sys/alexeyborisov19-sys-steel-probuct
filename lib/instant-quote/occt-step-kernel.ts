import type { CadMeshPrimitive } from "@/lib/instant-quote/cad-model";
import type { StepKernelPort, StepKernelResult } from "@/lib/instant-quote/step-adapter";

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

      const primitive: CadMeshPrimitive = {
        id: "step-model",
        name: "STEP model",
        positions: Array.from(mesh.positions),
        normals: mesh.normals.length ? Array.from(mesh.normals) : undefined,
        indices: Array.from(mesh.indices),
      };

      const warnings: string[] = [];
      if (!volumeMm3) warnings.push("STEP не содержит подтверждённого замкнутого объёма; масса и толщина требуют дополнительного анализа.");
      if (solidCount === 0) warnings.push("OpenCascade не обнаружил отдельные solid-тела; модель доступна для просмотра, но требует технологической проверки.");

      return {
        meshes: [primitive],
        volumeMm3,
        bodyCount: solidCount || undefined,
        root: null,
        features: [],
        warnings,
        parserVersion: "5.0.0",
      };
    } finally {
      kernel.release(shape);
    }
  }
}

export const occtStepKernel = new OcctStepKernel();
