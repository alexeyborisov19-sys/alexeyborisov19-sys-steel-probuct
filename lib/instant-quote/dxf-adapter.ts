import type { CadAnalysisAdapter, NormalizedCadModel } from "@/lib/instant-quote/cad-model";
import { parseAsciiDxf } from "@/lib/instant-quote/dxf";

function mmScaleForInsUnits(code: number | null) {
  if (code === 1) return 25.4;   // inches
  if (code === 2) return 304.8;  // feet
  if (code === 4) return 1;      // millimetres
  if (code === 5) return 10;     // centimetres
  if (code === 6) return 1000;   // metres
  return null;
}

export const dxfCadAdapter: CadAnalysisAdapter = {
  id: "steel-product-ascii-dxf-v1",
  formats: ["dxf"],

  async analyze(request): Promise<NormalizedCadModel> {
    if (request.format !== "dxf") throw new Error("DXF adapter received a non-DXF file.");
    const text = new TextDecoder("utf-8").decode(request.bytes);
    const parsed = parseAsciiDxf(text);
    const scale = mmScaleForInsUnits(parsed.unitsCode);

    if (scale == null) {
      throw new Error("В DXF не указаны поддерживаемые единицы измерения. Подтвердите единицы перед автоматическим расчётом.");
    }

    return {
      format: "dxf",
      units: "mm",
      geometry: {
        widthMm: parsed.width * scale,
        heightMm: parsed.height * scale,
        areaMm2: parsed.area == null ? undefined : parsed.area * scale * scale,
        cutLengthMm: parsed.cutLength * scale,
        contourCount: parsed.contours,
        pierceCount: parsed.pierces ?? undefined,
        holeCount: parsed.holeCount ?? undefined,
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
        ...(scale !== 1 ? [`Геометрия автоматически нормализована из «${parsed.units}» в миллиметры.`] : []),
        ...(parsed.areaStatus !== "exact" ? ["Площадь детали не подтверждена замкнутой топологией; металл пока считается консервативно по габариту."] : []),
        ...parsed.unsupportedEntities.map((entity) => `Неподдерживаемая DXF-геометрия: ${entity}`),
      ],
    };
  },
};
