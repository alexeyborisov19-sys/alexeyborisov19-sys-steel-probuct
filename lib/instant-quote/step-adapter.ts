import type {
  CadAnalysisAdapter,
  CadAssemblyNode,
  CadMeshPrimitive,
  NormalizedCadModel,
  SheetMetalFeature,
} from "@/lib/instant-quote/cad-model";
import { calculateMeshBounds } from "@/lib/instant-quote/mesh";

export type StepKernelResult = {
  meshes: CadMeshPrimitive[];
  volumeMm3?: number;
  root?: CadAssemblyNode | null;
  features?: SheetMetalFeature[];
  warnings?: string[];
  parserVersion?: string;
};

/**
 * Narrow boundary between Steel Product and the concrete OpenCascade runtime.
 * A browser/worker implementation may use occt-wasm, while tests can inject a deterministic fake.
 */
export interface StepKernelPort {
  readonly id: string;
  readStep(bytes: Uint8Array): Promise<StepKernelResult>;
}

export function createStepCadAdapter(kernel: StepKernelPort): CadAnalysisAdapter {
  return {
    id: `steel-product-step:${kernel.id}`,
    formats: ["step", "stp"],

    async analyze(request): Promise<NormalizedCadModel> {
      if (request.format !== "step" && request.format !== "stp") {
        throw new Error("STEP adapter received a non-STEP file.");
      }
      if (!request.bytes.byteLength) throw new Error("STEP-файл пустой.");

      const result = await kernel.readStep(request.bytes);
      if (!result.meshes.length) throw new Error("OpenCascade не вернул 3D-геометрию STEP-файла.");

      const bounds = calculateMeshBounds(result.meshes);
      if (!bounds) throw new Error("Не удалось определить габариты STEP-модели.");

      return {
        format: request.format,
        units: "mm",
        geometry: {
          widthMm: bounds.size[0],
          heightMm: bounds.size[1],
          depthMm: bounds.size[2],
          bodyCount: result.meshes.length,
          volumeMm3: result.volumeMm3,
        },
        meshes: result.meshes,
        root: result.root ?? null,
        features: result.features ?? [],
        metadata: {
          sourceFileName: request.fileName,
          sourceBytes: request.bytes.byteLength,
          parser: kernel.id,
          parserVersion: result.parserVersion,
          analyzedAt: new Date().toISOString(),
        },
        warnings: result.warnings ?? [],
      };
    },
  };
}
