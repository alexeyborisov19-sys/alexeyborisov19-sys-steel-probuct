import { CadReadError, type CadAnalysisAdapter, type NormalizedCadModel } from "@/lib/instant-quote/cad-model";
import { decodeDxfText, parseAsciiDxf } from "@/lib/instant-quote/dxf";

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
    const text = decodeDxfText(request.bytes);
    const parsed = parseAsciiDxf(text);
    const scale = mmScaleForInsUnits(parsed.unitsCode);

    if (scale == null) {
      throw new CadReadError(
        "В DXF не объявлены единицы измерения: нет ни $INSUNITS, ни $MEASUREMENT, поэтому габариты нельзя пересчитать в миллиметры. Сохраните чертёж из CAD с указанием единиц (обычно «Миллиметры») и загрузите снова.",
      );
    }

    const widthMm = parsed.width * scale;
    const heightMm = parsed.height * scale;
    const areaMm2 = parsed.area == null ? undefined : parsed.area * scale * scale;
    // Current commercial rule: material is billed by the rectangular blank
    // around the part. A future nesting engine can replace this with
    // nestedAllocatedAreaMm2.
    const blankAreaMm2 = widthMm * heightMm;
    const cutLengthMm = parsed.cutLength * scale;

    // Converting to millimetres multiplies, and the blank multiplies again, so
    // a drawing the parser could still measure can overflow here. Every number
    // below feeds the price, and the calculation is entitled to assume they are
    // numbers, so an overflow is refused with a sentence instead of being
    // handed on as Infinity.
    if (![widthMm, heightMm, blankAreaMm2, cutLengthMm, areaMm2 ?? 0].every(Number.isFinite)) {
      throw new CadReadError(
        "Габариты чертежа в миллиметрах выходят за пределы, в которых деталь можно посчитать. Проверьте единицы измерения и масштаб чертежа, затем сохраните файл заново.",
      );
    }

    return {
      format: "dxf",
      units: "mm",
      geometry: {
        widthMm,
        heightMm,
        areaMm2,
        blankAreaMm2,
        cutLengthMm,
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
        ...(parsed.unitsSource === "measurement"
          ? [`В чертеже не задан $INSUNITS. Единицы «${parsed.units}» определены по заголовку $MEASUREMENT — подтвердите масштаб детали перед запуском в производство.`]
          : []),
        ...(parsed.areaStatus !== "exact" ? ["Чистая площадь детали не подтверждена замкнутой топологией; это влияет на массу изделия, но металл всё равно считается по прямоугольной заготовке."] : []),
        ...parsed.unsupportedEntities.map((entity) => `Неподдерживаемая DXF-геометрия: ${entity}`),
      ],
    };
  },
};
