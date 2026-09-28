/** Architectural coordination geometry, not a manufacturing unfolding or certified facade system. */
export type CassetteBimInput = {
  widthMm: number; heightMm: number; depthMm: number; thicknessMm: number;
  jointMm: number; columns: number; rows: number; mark: string; finish: string;
};
export const bimScope = "Координационная модель. Прямые борта упрощены; крепёж, замки, радиусы гиба и подсистема не моделируются. Не для изготовления или расчёта нагрузок.";
export function validateCassetteBim(p: CassetteBimInput): string[] {
  const errors: string[] = [];
  for (const [key, label] of [["widthMm", "Ширина"], ["heightMm", "Высота"], ["depthMm", "Глубина"]] as const)
    if (!Number.isFinite(p[key]) || p[key] <= 0 || p[key] > 10000) errors.push(`${label}: укажите размер от 0 до 10 000 мм, не включая ноль.`);
  if (![0.7, 1, 1.2, 1.5].includes(p.thicknessMm)) errors.push("Выберите толщину из списка.");
  if (Math.min(p.widthMm, p.heightMm, p.depthMm) <= 2 * p.thicknessMm) errors.push("Габариты должны быть больше двух толщин металла.");
  if (!Number.isFinite(p.jointMm) || p.jointMm < 0 || p.jointMm > 1000) errors.push("Шов: от 0 до 1 000 мм.");
  for (const key of ["columns", "rows"] as const) if (!Number.isInteger(p[key]) || p[key] < 1 || p[key] > 20) errors.push("Число рядов и колонок: целое от 1 до 20.");
  if (!p.mark.trim() || p.mark.length > 80) errors.push("Марка: от 1 до 80 символов.");
  if (p.finish.length > 120) errors.push("Описание покрытия: не более 120 символов.");
  return errors;
}
export function cassetteBimSummary(p: CassetteBimInput) {
  return { quantity: p.columns * p.rows, faceAreaM2: p.widthMm * p.heightMm * p.columns * p.rows / 1e6,
    overallWidthMm: p.columns * p.widthMm + (p.columns - 1) * p.jointMm,
    overallHeightMm: p.rows * p.heightMm + (p.rows - 1) * p.jointMm };
}
// UTF-16 STEP escapes also keep user text from introducing entities or breaking the file.
function str(value: string) {
  return "'" + value.split("").map(c => {
    const n = c.charCodeAt(0);
    return n >= 32 && n <= 126 && c !== "\\" ? c.replaceAll("'", "''") : `\\X2\\${n.toString(16).padStart(4, "0").toUpperCase()}\\X0\\`;
  }).join("") + "'";
}
function guid() {
  const alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$";
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let n = BigInt("0x" + [...bytes].map(b => b.toString(16).padStart(2, "0")).join(""));
  let result = "";
  for (let i = 0; i < 22; i++) { result = alphabet[Number(n & BigInt(63))] + result; n >>= BigInt(6); }
  return str(result);
}
const num = (v: number) => Number.isInteger(v) ? `${v}.` : String(Number(v.toFixed(8)));
export function createCassetteIfc(p: CassetteBimInput): string {
  const errors = validateCassetteBim(p); if (errors.length) throw new Error(errors.join(" "));
  const lines: string[] = [];
  const add = (s: string) => { const id = `#${lines.length + 1}`; lines.push(`${id}=${s};`); return id; };
  const point = (x: number, y: number, z: number) => add(`IFCCARTESIANPOINT((${num(x)},${num(y)},${num(z)}))`);
  const origin = point(0, 0, 0);
  const z = add("IFCDIRECTION((0.,0.,1.))"), x = add("IFCDIRECTION((1.,0.,0.))");
  const axis = add(`IFCAXIS2PLACEMENT3D(${origin},${z},${x})`);
  const placement = add(`IFCLOCALPLACEMENT($,${axis})`);
  const context = add(`IFCGEOMETRICREPRESENTATIONCONTEXT($,'Model',3,0.00001,${axis},$)`);
  const units = add(`IFCUNITASSIGNMENT((${add("IFCSIUNIT(*,.LENGTHUNIT.,.MILLI.,.METRE.)")},${add("IFCSIUNIT(*,.AREAUNIT.,$,.SQUARE_METRE.)")}))`);
  const project = add(`IFCPROJECT(${guid()},$,${str("Сталь Продукт — металлокассеты")},${str(bimScope)},$,$,$,(${context}),${units})`);
  const building = add(`IFCBUILDING(${guid()},$,${str("Координационная модель")},$,$,${placement},$,$,.ELEMENT.,$,$,$)`);
  const storey = add(`IFCBUILDINGSTOREY(${guid()},$,${str("Фасадный фрагмент")},$,$,${placement},$,$,.ELEMENT.,0.)`);
  add(`IFCRELAGGREGATES(${guid()},$,$,$,${project},(${building}))`);
  add(`IFCRELAGGREGATES(${guid()},$,$,$,${building},(${storey}))`);
  const w = p.widthMm, h = p.heightMm, d = p.depthMm, t = p.thicknessMm;
  function box(a: number, b: number, c: number, px: number, py: number, pz: number) {
    const profile = add(`IFCRECTANGLEPROFILEDEF(.AREA.,$,$,${num(a)},${num(b)})`);
    const pos = add(`IFCAXIS2PLACEMENT3D(${point(px+a/2, py+b/2, pz)},${z},${x})`);
    return add(`IFCEXTRUDEDAREASOLID(${profile},${pos},${z},${num(c)})`);
  }
  // Five non-overlapping prisms: face plus four simplified straight returns.
  const solids = [box(w,h,t,0,0,0), box(t,h,d-t,0,0,t), box(t,h,d-t,w-t,0,t), box(w-2*t,t,d-t,t,0,t), box(w-2*t,t,d-t,t,h-t,t)];
  const representation = add(`IFCSHAPEREPRESENTATION(${context},'Body','SweptSolid',(${solids.join(",")}))`);
  const shape = add(`IFCPRODUCTDEFINITIONSHAPE($,$,(${representation}))`);
  const properties: string[] = [];
  function property(name: string, value: string, type = "IFCLABEL") { properties.push(add(`IFCPROPERTYSINGLEVALUE(${str(name)},$,${type}(${type === "IFCLENGTHMEASURE" ? value : str(value)}),$)`)); }
  property("Manufacturer", "Сталь Продукт"); property("ModelScope", bimScope, "IFCTEXT");
  property("Width", num(w), "IFCLENGTHMEASURE"); property("Height", num(h), "IFCLENGTHMEASURE");
  property("Depth", num(d), "IFCLENGTHMEASURE"); property("Thickness", num(t), "IFCLENGTHMEASURE");
  property("Joint", num(p.jointMm), "IFCLENGTHMEASURE"); property("Mark", p.mark);
  property("Finish", p.finish || "По проекту"); property("Source", "https://www.steelprodukt.ru/products/metallokassety/bim"); property("Revision", "1.0");
  const pset = add(`IFCPROPERTYSET(${guid()},$,'SP_CassetteCoordination',$,(${properties.join(",")}))`);
  const type = add(`IFCPLATETYPE(${guid()},$,${str(p.mark)},${str(bimScope)},$,(${pset}),$,$,$,.CURTAIN_PANEL.)`);
  const material = add(`IFCMATERIAL(${str("Оцинкованная сталь")},$,${str("Сталь")})`);
  const outward = add("IFCDIRECTION((0.,-1.,0.))");
  const panels: string[] = [];
  for (let row=0; row<p.rows; row++) for (let col=0; col<p.columns; col++) {
    const pa = add(`IFCAXIS2PLACEMENT3D(${point(col*(w+p.jointMm),0,row*(h+p.jointMm))},${outward},${x})`);
    const pl = add(`IFCLOCALPLACEMENT(${placement},${pa})`);
    const tag = `${p.mark}-${String(panels.length+1).padStart(3,"0")}`;
    const panel = add(`IFCPLATE(${guid()},$,${str(tag)},${str(bimScope)},$,${pl},${shape},${str(tag)},.CURTAIN_PANEL.)`);
    panels.push(panel);
    const area = add(`IFCQUANTITYAREA('FaceArea',${str("Площадь лицевой поверхности без швов")},$,${num(w*h/1e6)},$)`);
    const quantities = add(`IFCELEMENTQUANTITY(${guid()},$,'SP_CassetteQuantities',$,$,(${area}))`);
    add(`IFCRELDEFINESBYPROPERTIES(${guid()},$,$,$,(${panel}),${quantities})`);
  }
  add(`IFCRELCONTAINEDINSPATIALSTRUCTURE(${guid()},$,$,$,(${panels.join(",")}),${storey})`);
  add(`IFCRELDEFINESBYTYPE(${guid()},$,$,$,(${panels.join(",")}),${type})`);
  add(`IFCRELASSOCIATESMATERIAL(${guid()},$,$,$,(${panels.join(",")}),${material})`);
  return `ISO-10303-21;\nHEADER;\nFILE_DESCRIPTION(('Architectural coordination geometry'),'2;1');\nFILE_NAME('steelprodukt-cassettes.ifc','${new Date().toISOString()}',('Steel Produkt'),('Steel Produkt'),'Steel Produkt BIM 1.0','Steel Produkt','');\nFILE_SCHEMA(('IFC4'));\nENDSEC;\nDATA;\n${lines.join("\n")}\nENDSEC;\nEND-ISO-10303-21;\n`;
}
export function createCassetteCsv(p: CassetteBimInput) {
  const errors = validateCassetteBim(p); if (errors.length) throw new Error(errors.join(" "));
  const safe = (s: string) => `"${(/^[\s]*[=+\-@]|^[\t\r\n]/.test(s) ? "'"+s : s).replaceAll('"','""')}"`;
  const rows = [["Марка","Ширина, мм","Высота, мм","Глубина, мм","Толщина, мм","Покрытие","Количество","Площадь лица всего, м²","Статус"], [p.mark,String(p.widthMm),String(p.heightMm),String(p.depthMm),String(p.thicknessMm),p.finish||"По проекту",String(p.columns*p.rows),String(cassetteBimSummary(p).faceAreaM2),bimScope]];
  return "\uFEFF"+rows.map(row=>row.map(safe).join(";")).join("\r\n");
}
