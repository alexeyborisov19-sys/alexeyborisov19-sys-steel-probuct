import { PRODUCT_CALCULATION_NOTICE } from "../product-calculation-notice";
import { stableIfcGuid } from "./ifc-identity";
import { cassetteGeometry, cassetteMinimumJoint, cassetteFaceWidth, cassetteProfiles, cassetteSource, type CassetteProfile } from "./cassette-geometry";
/** Architectural coordination geometry, not a manufacturing unfolding or certified facade system. */
export type CassetteBimInput = {
  profile?: CassetteProfile; returnWidthMm?: number;
  /** Saved project scope for stable cross-export panel identity. */
  projectId?: string;
  widthMm: number; heightMm: number; depthMm: number; thicknessMm: number;
  jointMm: number; columns: number; rows: number; mark: string; finish: string;
  /** Stable row:column keys (zero based). */
  panelColours?: Record<string, { ral: string; hex: string }>;
};
export const bimScope = PRODUCT_CALCULATION_NOTICE + ". " + "Координационная модель. ОТ и ЗТ — геометрия из STEP, угловая — упрощённая по чертежу. Изменение ширины и высоты адаптирует центральную часть; борта и толщина сохраняются. Крепёж и подсистема не входят; узел стыковки требует согласования. Не для изготовления или расчёта нагрузок.";
export function validateCassetteBim(p: CassetteBimInput): string[] {
  const errors: string[] = [];
  if (p.projectId !== undefined && !/^[A-Za-z0-9_-]{1,80}$/.test(p.projectId)) errors.push("Некорректный идентификатор проекта.");
  for (const [key, label] of [["widthMm", "Ширина"], ["heightMm", "Высота"], ["depthMm", "Глубина"]] as const)
    if (!Number.isFinite(p[key]) || p[key] <= 0 || p[key] > 10000) errors.push(`${label}: укажите размер от 0 до 10 000 мм, не включая ноль.`);
  if (![0.7, 1, 1.2, 1.5].includes(p.thicknessMm)) errors.push("Выберите толщину из списка.");
  if (Math.min(p.widthMm, p.heightMm, p.depthMm) <= 2 * p.thicknessMm) errors.push("Габариты должны быть больше двух толщин металла.");
  if (!Number.isFinite(p.jointMm) || p.jointMm < 0 || p.jointMm > 1000) errors.push("Шов: от 0 до 1 000 мм.");
  for (const key of ["columns", "rows"] as const) if (!Number.isInteger(p[key]) || p[key] < 1 || p[key] > 20) errors.push("Число рядов и колонок: целое от 1 до 20.");
  if (!p.mark.trim() || p.mark.length > 80) errors.push("Марка: от 1 до 80 символов.");
  if (p.finish.length > 120) errors.push("Описание покрытия: не более 120 символов.");
  for (const colour of Object.values(p.panelColours || {})) {
    if (!/^RAL [0-9]{4}$/.test(colour.ral) || !/^#[0-9a-f]{6}$/i.test(colour.hex)) errors.push("Укажите RAL в формате RAL 7016 и экранный цвет.");
  }
  if (p.profile && !(Object.hasOwn(cassetteProfiles, p.profile))) errors.push("Выберите исполнение кассеты.");
  if (p.profile && (p.widthMm < 120 || p.heightMm < 120)) errors.push("Для сохранения бортов ширина и высота должны быть не меньше 120 мм.");
  if ((p.profile === "open" || p.profile === "closed") && (![.7,1].includes(p.thicknessMm) || p.depthMm !== cassetteSource(p).depth)) errors.push("Используйте толщину 0,7 или 1 мм и глубину исходной STEP-модели.");
  if (p.profile && p.jointMm < cassetteMinimumJoint(p)) errors.push(`Шов: не меньше ${cassetteMinimumJoint(p)} мм для размещения полных бортов без пересечений. Меньший шов требует проверенного узла стыковки.`);
  if (p.profile === "corner" && (p.depthMm !== 20 || p.thicknessMm !== 1)) errors.push("Угловой профиль проверен для борта 20 мм и толщины 1 мм.");
  if (p.profile === "corner" && (p.columns !== 1 || !Number.isFinite(p.returnWidthMm) || p.returnWidthMm! <= p.depthMm+2*p.thicknessMm || p.returnWidthMm! > 10000 || p.widthMm <= p.depthMm+2*p.thicknessMm)) errors.push("Угловые кассеты располагаются в одну колонку; оба крыла должны быть больше глубины борта и двух толщин.");
  return errors;
}
export function cassetteBimSummary(p: CassetteBimInput) {
  return { quantity: p.columns * p.rows, faceAreaM2: cassetteFaceWidth(p) * p.heightMm * p.columns * p.rows / 1e6,
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
  let identitySequence = 0;
  const identity = (key?: string) => p.projectId ? str(stableIfcGuid(`${p.projectId}/${key ?? `entity-${identitySequence++}`}`)) : guid();
  const lines: string[] = [];
  const add = (s: string) => { const id = `#${lines.length + 1}`; lines.push(`${id}=${s};`); return id; };
  const point = (x: number, y: number, z: number) => add(`IFCCARTESIANPOINT((${num(x)},${num(y)},${num(z)}))`);
  const origin = point(0, 0, 0);
  const z = add("IFCDIRECTION((0.,0.,1.))"), x = add("IFCDIRECTION((1.,0.,0.))");
  const axis = add(`IFCAXIS2PLACEMENT3D(${origin},${z},${x})`);
  const placement = add(`IFCLOCALPLACEMENT($,${axis})`);
  const context = add(`IFCGEOMETRICREPRESENTATIONCONTEXT($,'Model',3,0.00001,${axis},$)`);
  const units = add(`IFCUNITASSIGNMENT((${add("IFCSIUNIT(*,.LENGTHUNIT.,.MILLI.,.METRE.)")},${add("IFCSIUNIT(*,.AREAUNIT.,$,.SQUARE_METRE.)")}))`);
  const project = add(`IFCPROJECT(${identity()},$,${str("Сталь Продукт — металлокассеты")},${str(bimScope)},$,$,$,(${context}),${units})`);
  const building = add(`IFCBUILDING(${identity()},$,${str("Координационная модель")},$,$,${placement},$,$,.ELEMENT.,$,$,$)`);
  const storey = add(`IFCBUILDINGSTOREY(${identity()},$,${str("Фасадный фрагмент")},$,$,${placement},$,$,.ELEMENT.,0.)`);
  add(`IFCRELAGGREGATES(${identity()},$,$,$,${project},(${building}))`);
  add(`IFCRELAGGREGATES(${identity()},$,$,$,${building},(${storey}))`);
  const w = p.widthMm, h = p.heightMm, d = p.depthMm, t = p.thicknessMm;
  function makeShape(hex?: string) {
  const solids = cassetteGeometry(p).map(solid => {
    const coords=add(`IFCCARTESIANPOINTLIST3D((${solid.vertices.map(v=>`(${v.map(num).join(",")})`).join(",")}))`);
    const triangles=solid.faces.flatMap(face=>Array.from({length:face.length-2},(_,i)=>[face[0]+1,face[i+1]+1,face[i+2]+1]));
    return add(`IFCTRIANGULATEDFACESET(${coords},$,.T.,(${triangles.map(t=>`(${t.join(",")})`).join(",")}),$)`);
  });
  if (hex) {
    const rgb = [1,3,5].map(i => num(parseInt(hex.slice(i,i+2),16)/255));
    const colour = add(`IFCCOLOURRGB($,${rgb.join(",")})`);
    const shading = add(`IFCSURFACESTYLESHADING(${colour},0.)`);
    const style = add(`IFCSURFACESTYLE($,.BOTH.,(${shading}))`);
    for (const solid of solids) add(`IFCSTYLEDITEM(${solid},(${style}),$)`);
  }
  const representation = add(`IFCSHAPEREPRESENTATION(${context},'Body','Tessellation',(${solids.join(",")}))`);
  return add(`IFCPRODUCTDEFINITIONSHAPE($,$,(${representation}))`);
  }
  const shapes = new Map<string,string>();
  function shapeFor(hex?: string) {
    const key = hex || "default";
    if (!shapes.has(key)) shapes.set(key,makeShape(hex));
    return shapes.get(key)!;
  }
  const properties: string[] = [];
  function property(name: string, value: string, type = "IFCLABEL") { properties.push(add(`IFCPROPERTYSINGLEVALUE(${str(name)},$,${type}(${type === "IFCLENGTHMEASURE" ? value : str(value)}),$)`)); }
  property("Manufacturer", "Сталь Продукт"); property("ModelScope", bimScope, "IFCTEXT");
  property("Width", num(w), "IFCLENGTHMEASURE"); property("Height", num(h), "IFCLENGTHMEASURE");
  property("Depth", num(d), "IFCLENGTHMEASURE"); property("Thickness", num(t), "IFCLENGTHMEASURE");
  property("Joint", num(p.jointMm), "IFCLENGTHMEASURE"); property("Mark", p.mark);
  property("DefaultFinish", p.finish || "По проекту"); property("Source", "https://www.steelprodukt.ru/products/metallokassety/bim"); property("Revision", "2.0");
  property("Profile", p.profile ? cassetteProfiles[p.profile].label : "Прямые борта");
  if(p.profile === "corner") property("ReturnWidth", num(p.returnWidthMm!), "IFCLENGTHMEASURE");
  const pset = add(`IFCPROPERTYSET(${identity()},$,'SP_CassetteCoordination',$,(${properties.join(",")}))`);
  const type = add(`IFCPLATETYPE(${identity()},$,${str(p.mark)},${str(bimScope)},$,(${pset}),$,$,$,.CURTAIN_PANEL.)`);
  const material = add(`IFCMATERIAL(${str("Оцинкованная сталь")},$,${str("Сталь")})`);
  const outward = add("IFCDIRECTION((0.,-1.,0.))");
  const panels: string[] = [];
  for (let row=0; row<p.rows; row++) for (let col=0; col<p.columns; col++) {
    const pa = add(`IFCAXIS2PLACEMENT3D(${point(col*(w+p.jointMm),0,row*(h+p.jointMm))},${outward},${x})`);
    const pl = add(`IFCLOCALPLACEMENT(${placement},${pa})`);
    const tag = `${p.mark}-${String(panels.length+1).padStart(3,"0")}`;
    const colour = p.panelColours?.[`${row}:${col}`];
    const shape = shapeFor(colour?.hex);
    const panel = add(`IFCPLATE(${identity(`panel-${row}:${col}`)},$,${str(tag)},${str(bimScope)},$,${pl},${shape},${str(tag)},.CURTAIN_PANEL.)`);
    panels.push(panel);
    {
      const finish = add(`IFCPROPERTYSINGLEVALUE('Finish',$,IFCLABEL(${str(colour?.ral || p.finish || "По проекту")}),$)`);
      const swatch = add(`IFCPROPERTYSINGLEVALUE('PreviewColour',$,IFCLABEL(${str(colour?.hex || "Not assigned")}),$)`);
      const colourSet = add(`IFCPROPERTYSET(${identity()},$,'SP_CassetteFinish',$,(${finish},${swatch}))`);
      add(`IFCRELDEFINESBYPROPERTIES(${identity()},$,$,$,(${panel}),${colourSet})`);
    }
    const area = add(`IFCQUANTITYAREA('FaceArea',${str("Площадь лицевой поверхности без швов")},$,${num(cassetteFaceWidth(p)*h/1e6)},$)`);
    const quantities = add(`IFCELEMENTQUANTITY(${identity()},$,'SP_CassetteQuantities',$,$,(${area}))`);
    add(`IFCRELDEFINESBYPROPERTIES(${identity()},$,$,$,(${panel}),${quantities})`);
  }
  add(`IFCRELCONTAINEDINSPATIALSTRUCTURE(${identity()},$,$,$,(${panels.join(",")}),${storey})`);
  add(`IFCRELDEFINESBYTYPE(${identity()},$,$,$,(${panels.join(",")}),${type})`);
  add(`IFCRELASSOCIATESMATERIAL(${identity()},$,$,$,(${panels.join(",")}),${material})`);
  return `ISO-10303-21;\nHEADER;\nFILE_DESCRIPTION(('Architectural coordination geometry'),'2;1');\nFILE_NAME('steelprodukt-cassettes.ifc','${new Date().toISOString()}',('Steel Produkt'),('Steel Produkt'),'Steel Produkt BIM 2.0','Steel Produkt','');\nFILE_SCHEMA(('IFC4'));\nENDSEC;\nDATA;\n${lines.join("\n")}\nENDSEC;\nEND-ISO-10303-21;\n`;
}
export function createCassetteCsv(p: CassetteBimInput) {
  const errors = validateCassetteBim(p); if (errors.length) throw new Error(errors.join(" "));
  const safe = (s: string) => `"${(/^[\s]*[=+\-@]|^[\t\r\n]/.test(s) ? "'"+s : s).replaceAll('"','""')}"`;
  const rows = [["Марка","Ширина, мм","Высота, мм","Глубина, мм","Толщина, мм","Покрытие","Количество","Площадь лица всего, м²","Статус","Исполнение","Второе крыло, мм","Идентификатор панели"]];
  for (let row=0; row<p.rows; row++) for (let col=0; col<p.columns; col++) {
    const tag = `${p.mark}-${String(row*p.columns+col+1).padStart(3,"0")}`;
    rows.push([tag,String(p.widthMm),String(p.heightMm),String(p.depthMm),String(p.thicknessMm),p.panelColours?.[`${row}:${col}`]?.ral || p.finish || "По проекту","1",String(cassetteFaceWidth(p)*p.heightMm/1e6),bimScope,p.profile ? cassetteProfiles[p.profile].label : "Прямые борта",p.profile === "corner" ? String(p.returnWidthMm) : "",p.projectId ? `${p.projectId}/${row}:${col}` : ""]);
  }
  return "\uFEFF"+rows.map(row=>row.map(safe).join(";")).join("\r\n");
}
