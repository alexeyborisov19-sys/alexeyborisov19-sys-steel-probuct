import type { CadAnalysisAdapter, NormalizedCadModel } from "@/lib/instant-quote/cad-model";
import { parseAsciiDxf } from "@/lib/instant-quote/dxf";

export const dxfCadAdapter: CadAnalysisAdapter = {
  id: "steel-product-ascii-dxf-v1",
  formats: ["dxf"],

  async analyze(request): Promise<NormalizedCadModel> {
    if (request.format !== "dxf") throw new Error("DXF adapter received a non-DXF file.");
    const text = new TextDecoder("utf-8").decode(request.bytes);
    const parsed = parseAsciiDxf(text);

    return {
      format: "dxf",
      units: "mm",
      geometry: {
        widthMm: parsed.width,
        heightMm: parsed.height,
        cutLengthMm: parsed.cutLength,
        contourCount: parsed.contours,
      },
      meshes: [],
      root: null,
      features: [],
      metadata: {
        sourceFileName: request.fileName,
        sourceBytes: request.bytes.byteLength,
        parser: "steel-product-ascii-dxf-v1",
        analyzedAt: new Date().toISOString(),
      },
      warnings: [
        ...(parsed.units !== "мм" ? [`Исходные единицы DXF: ${parsed.units}. Нужна нормализация/подтверждение.`] : []),
        ...parsed.unsupportedEntities.map((entity) => `Неподдерживаемая DXF-геометрия: ${entity}`),
      ],
    };
  },
};
