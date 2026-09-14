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

    const widthMm = parsed.width * scale;
    const heightMm = parsed.height * scale;

    return {
      format: "dxf",
      units: "mm",
      geometry: {
        widthMm,
        heightMm,
        areaMm2: parsed.area == null ? undefined : parsed.area * scale * scale,
        // Current commercial rule: material is billed by the rectangular blank around the part.
        // A future nesting engine can replace this with nestedAllocatedAreaMm2.
        blankAreaMm2: widthMm * heightMm,
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
        ...(parsed.areaStatus !== "exact" ? ["Чистая площадь детали не подтверждена замкнутой топологией; это влияет на массу изделия, но металл всё равно считается по прямоугольной заготовке."] : []),
        ...parsed.unsupportedEntities.map((entity) => `Неподдерживаемая DXF-геометрия: ${entity}`),
      ],
    };
  },
};
