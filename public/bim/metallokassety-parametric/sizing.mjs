// Geometric coordination model, not a manufacturing or native BIM-family solver.
// Resize only globally straight mesh strips; all non-parallel faces are protected.
export const VERSION = 'sp-cassette-sizing-1';
const TOL = 1e-5;
const GUARD_MM = 0.25;
const round = n => Math.round(n * 1e6) / 1e6;
const norm = v => Math.hypot(...v);
const sub = (a, b) => a.map((v, i) => v - b[i]);
const cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export function meshStats(vertices, faces) {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (const p of vertices) {
    if (p.length !== 3 || p.some(v => !Number.isFinite(v))) throw new Error('Некорректные координаты.');
    p.forEach((v, i) => { min[i] = Math.min(min[i], v); max[i] = Math.max(max[i], v); });
  }
  const centre = min.map((v, i) => (v + max[i]) / 2);
  let area = 0, volume = 0;
  const normals = [];
  for (const face of faces) {
    if (face.length !== 3 || face.some(i => !Number.isInteger(i) || i < 0 || i >= vertices.length)) throw new Error('Некорректные индексы граней.');
    const [a, b, c] = face.map(i => vertices[i]);
    const n = cross(sub(b, a), sub(c, a)), size = norm(n);
    if (size < 1e-10) throw new Error('Вырожденный треугольник.');
    area += size / 2;
    volume += dot(sub(a, centre), cross(sub(b, centre), sub(c, centre))) / 6;
    normals.push(n.map(v => v / size));
  }
  if (!(volume > 0) || !Number.isFinite(volume)) throw new Error('Модель не имеет положительного объёма.');
  return { min, max, centre, size: max.map((v, i) => v - min[i]), area, volume, normals };
}

export function readMesh(text) {
  if (typeof text !== 'string' || text.length > 12000000 || !text.startsWith('ISO-10303-21;') || !text.includes("FILE_SCHEMA(('IFC4'));") || !text.trimEnd().endsWith('END-ISO-10303-21;')) throw new Error('Некорректный исходный IFC4.');
  const records = [...text.matchAll(/^#(\d+)=(IFCCARTESIANPOINTLIST3D|IFCTRIANGULATEDFACESET)\((.*)\);$/gm)];
  const points = records.filter(r => r[2] === 'IFCCARTESIANPOINTLIST3D');
  const sets = records.filter(r => r[2] === 'IFCTRIANGULATEDFACESET');
  if (points.length !== 1 || sets.length !== 1 || !sets[0][3].startsWith(`#${points[0][1]},$,.T.,`)) throw new Error('Ожидалось одно замкнутое сеточное тело.');
  const tuples = value => [...value.matchAll(/\(([^()]+)\)/g)].map(m => m[1].split(',').map(Number));
  const vertices = tuples(points[0][3]);
  const faces = tuples(sets[0][3]).map(f => f.map(i => i - 1));
  if (vertices.length < 4 || vertices.length > 70000 || faces.length > 120000) throw new Error('Недопустимый размер сетки.');
  const stats = meshStats(vertices, faces), edges = new Map();
  for (const f of faces) for (let i = 0; i < 3; i++) {
    const a = f[i], b = f[(i+1)%3], key = a < b ? `${a}:${b}` : `${b}:${a}`;
    const edge = edges.get(key) || { count: 0, direction: 0 };
    edge.count++; edge.direction += a < b ? 1 : -1; edges.set(key, edge);
  }
  if ([...edges.values()].some(e => e.count !== 2 || e.direction !== 0)) throw new Error('Сетка не замкнута или ориентация граней нарушена.');
  // Connectedness is checked independently from the edge counts.
  const adjacency = Array.from({length: vertices.length}, () => []);
  for (const [key] of edges) { const [a,b] = key.split(':').map(Number); adjacency[a].push(b); adjacency[b].push(a); }
  const visited = new Set([0]), stack = [0];
  while (stack.length) for (const v of adjacency[stack.pop()]) if (!visited.has(v)) { visited.add(v); stack.push(v); }
  if (visited.size !== vertices.length) throw new Error('Ожидалось одно связное тело.');
  const mesh = { vertices, faces, stats };
  mesh.axes = axisLimits(mesh);
  return mesh;
}

export function axisLimits(mesh) {
  return [0,1,2].map(axis => {
    const intervals = [];
    mesh.faces.forEach((f, i) => {
      if (Math.abs(mesh.stats.normals[i][axis]) > TOL) {
        const values = f.map(j => mesh.vertices[j][axis]);
        intervals.push([Math.min(...values)-GUARD_MM, Math.max(...values)+GUARD_MM]);
      }
    });
    intervals.sort((a,b) => a[0]-b[0]);
    const bands = [], start = mesh.stats.min[axis], end = mesh.stats.max[axis];
    let cursor = start;
    for (const [a,b] of intervals) { if (a > cursor+1) bands.push([cursor,a]); cursor = Math.max(cursor,b); }
    if (cursor < end-1) bands.push([cursor,end]);
    const free = bands.reduce((s,[a,b]) => s+b-a,0), size = end-start;
    const editable = free > 1;
    // Conservative numerical range only: these are NOT manufacturing limits.
    const min = editable ? Math.ceil((size-free*0.75)*1000)/1000 : size;
    const max = editable ? Math.floor(Math.min(6000,size+free*3)*1000)/1000 : size;
    return { axis, bands, free, editable, min, max, original: size };
  });
}

// Split all triangles at the piecewise-transform break planes. Without this,
// moving only the old vertices can invert a long diagonal on a planar panel.
export function prepareMesh(mesh) {
  let vertices=mesh.vertices.map(p=>[...p]),faces=mesh.faces.map(f=>[...f]);
  for(const axis of mesh.axes) for(const plane of axis.bands.flat()) {
    const i=axis.axis, cache=new Map(), next=[];
    const distance=index=>{const d=vertices[index][i]-plane;return Math.abs(d)<1e-8?0:d;};
    const intersection=(a,b)=>{
      const lo=Math.min(a,b),hi=Math.max(a,b),key=`${lo}:${hi}`;
      if(cache.has(key))return cache.get(key);
      if(distance(lo)===0)return lo;if(distance(hi)===0)return hi;
      const p=vertices[lo],q=vertices[hi],t=(plane-p[i])/(q[i]-p[i]);
      const v=p.map((x,j)=>j===i?plane:x+(q[j]-x)*t),id=vertices.length;
      vertices.push(v);cache.set(key,id);return id;
    };
    for(const face of faces) {
      const distances=face.map(distance);
      if(!distances.some(d=>d<0)||!distances.some(d=>d>0)){next.push(face);continue;}
      for(const sign of [-1,1]) {
        const polygon=[];
        for(let j=0;j<face.length;j++){
          const a=face[j],b=face[(j+1)%face.length],da=distance(a)*sign,db=distance(b)*sign;
          if(da>=0)polygon.push(a);
          if((da<0&&db>0)||(da>0&&db<0))polygon.push(intersection(a,b));
        }
        if(polygon.length>=3)next.push(polygon);
      }
    }
    faces=next;
    if(faces.length>120000)throw new Error('Перестройка слишком сложна для браузера.');
  }
  const triangles=[];for(const polygon of faces)for(let j=1;j+1<polygon.length;j++)triangles.push([polygon[0],polygon[j],polygon[j+1]]);
  return {vertices,faces:triangles,stats:meshStats(vertices,triangles),axes:mesh.axes};
}

export function resize(mesh, dimensions) {
  if (!Array.isArray(dimensions) || dimensions.length !== 3 || dimensions.some(n => typeof n !== 'number' || !Number.isFinite(n))) throw new Error('Введите три числовых габарита.');
  mesh.axes.forEach((a,i) => {
    if (!a.editable && Math.abs(dimensions[i]-a.original) > 0.001) throw new Error(`Ось ${'XYZ'[i]} фиксирована: нет прямого участка для изменения размера.`);
    if (a.editable && (dimensions[i] < a.min-1e-6 || dimensions[i] > a.max+1e-6)) throw new Error(`Габарит ${'XYZ'[i]}: допустимый диапазон ${a.min}–${a.max} мм.`);
  });
  const targets = dimensions.map((d,i) => mesh.axes[i].editable ? d : mesh.axes[i].original);
  const vertices = mesh.vertices.map(p => p.map((v,i) => {
    const a = mesh.axes[i], delta = targets[i]-a.original;
    if (!a.editable || Math.abs(delta) < 1e-10) return v;
    const accumulated = a.bands.reduce((s,[lo,hi]) => s + clamp(v-lo,0,hi-lo),0);
    return v + delta*accumulated/a.free - delta/2;
  }));
  const stats = meshStats(vertices,mesh.faces);
  if (stats.size.some((d,i) => Math.abs(d-targets[i]) > 1e-5)) throw new Error('Габариты результата не совпали с заданными.');
  // Any changed facet orientation would mean a hole, bend, or slope was deformed.
  if (stats.normals.some((n,i) => dot(n,mesh.stats.normals[i]) < 1-1e-6)) throw new Error('Перестройка изменила форму участка. Скачивание заблокировано.');
  return { vertices, faces: mesh.faces, stats, dimensions: targets };
}

const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$';
function guid() {
  const bytes = new Uint8Array(16); globalThis.crypto.getRandomValues(bytes);
  let value = 0n; for (const byte of bytes) value = (value << 8n) | BigInt(byte);
  let result = ''; for (let i=0;i<22;i++) { result = alphabet[Number(value & 63n)] + result; value >>= 6n; }
  return result;
}
function quoted(value) {
  const string = String(value);
  if (string.length > 512) throw new Error('Слишком длинное текстовое свойство.');
  if (/[^\x20-\x7e]|\\/.test(string)) {
    let hex=''; for (let i=0;i<string.length;i++) hex += string.charCodeAt(i).toString(16).padStart(4,'0').toUpperCase();
    return `'\\X2\\${hex}\\X0\\'`;
  }
  return `'${string.replaceAll("'","''")}'`;
}
function real(value) { if(!Number.isFinite(value))throw new Error('Некорректное число IFC.'); const s=value.toFixed(9).replace(/0+$/,''); return s.endsWith('.') ? s : (s.includes('.')?s:s+'.'); }

export function createIfc(model, geometry, mark = '') {
  if (!model || !/^SP-(?:CAS|TRIM)-\d{2}$/.test(model.id) || !/^[a-f0-9]{64}$/.test(model.ifcSha256)) throw new Error('Модель не из проверенной библиотеки.');
  if (typeof mark !== 'string' || mark.length > 80 || /[\x00-\x1f]/.test(mark)) throw new Error('Некорректная марка.');
  const lines=[], add=(name,...args)=>{const id=`#${lines.length+1}`;lines.push(`${id}=${name}(${args.join(',')});`);return id;};
  const list=items=>`(${items.join(',')})`, id=()=>quoted(guid());
  const origin=add('IFCCARTESIANPOINT','(0.,0.,0.)'), axis=add('IFCAXIS2PLACEMENT3D',origin,'$','$');
  const context=add('IFCGEOMETRICREPRESENTATIONCONTEXT','$',quoted('Model'),'3','1.E-5',axis,'$');
  const body=add('IFCGEOMETRICREPRESENTATIONSUBCONTEXT',quoted('Body'),quoted('Model'),'*','*','*','*',context,'$','.MODEL_VIEW.','$');
  const units=add('IFCUNITASSIGNMENT',list([add('IFCSIUNIT','*','.LENGTHUNIT.','.MILLI.','.METRE.'),add('IFCSIUNIT','*','.AREAUNIT.','$','.SQUARE_METRE.'),add('IFCSIUNIT','*','.VOLUMEUNIT.','$','.CUBIC_METRE.')]));
  const project=add('IFCPROJECT',id(),'$',quoted('Сталь Продукт — модель по размерам'),quoted('Координационная геометрия. Не выпуск в производство.'),'$','$','$',list([context]),units);
  const sitePlacement=add('IFCLOCALPLACEMENT','$',axis),site=add('IFCSITE',id(),'$',quoted('Библиотека изделий'),'$','$',sitePlacement,'$','$','.ELEMENT.','$','$','$','$','$');
  const buildingPlacement=add('IFCLOCALPLACEMENT',sitePlacement,axis),building=add('IFCBUILDING',id(),'$',quoted('Координационная модель'),'$','$',buildingPlacement,'$','$','.ELEMENT.','$','$','$');
  const storeyPlacement=add('IFCLOCALPLACEMENT',buildingPlacement,axis),storey=add('IFCBUILDINGSTOREY',id(),'$',quoted('Изделие'),'$','$',storeyPlacement,'$','$','.ELEMENT.','0.');
  for(const [parent,child] of [[project,site],[site,building],[building,storey]])add('IFCRELAGGREGATES',id(),'$','$','$',parent,list([child]));
  const property=(name,type,value)=>add('IFCPROPERTYSINGLEVALUE',quoted(name),'$',`${type}(${typeof value==='number'?real(value):typeof value==='boolean'?(value?'.T.':'.F.'):quoted(value)})`,'$');
  const pset=(name,properties)=>add('IFCPROPERTYSET',id(),'$',quoted(name),'$',list(properties));
  const source=pset('SP_Source',[
    property('SourceModelId','IFCIDENTIFIER',model.id),property('SourceFile','IFCLABEL',model.source_file),
    property('CoordinationSourceSHA256','IFCIDENTIFIER',model.ifcSha256),property('WebGeometryVersion','IFCLABEL',VERSION),
    property('GeometryEditMethod','IFCLABEL','Изменение прямых участков сетки; защитные зоны гибов и отверстий'),
    property('NativeParametricEditing','IFCBOOLEAN',false),property('ManufacturingApproved','IFCBOOLEAN',false)
  ]);
  const sizes=pset('SP_Dimensions',[
    ...geometry.stats.size.map((n,i)=>property('BoundingSize'+'XYZ'[i],'IFCLENGTHMEASURE',n)),
    property('SourceMeasuredSheetThickness','IFCLENGTHMEASURE',model.measured_thickness_mm),
    property('DimensionMeaning','IFCLABEL','Габариты X/Y/Z исходных осей; не лицевые размеры и не развёртка'),
    property('Mark','IFCLABEL',mark || model.id)
  ]);
  const coord=add('IFCCARTESIANPOINTLIST3D',list(geometry.vertices.map(p=>list(p.map(real)))));
  const faceSet=add('IFCTRIANGULATEDFACESET',coord,'$','.T.',list(geometry.faces.map(f=>list(f.map(i=>String(i+1))))),'$');
  const representation=add('IFCSHAPEREPRESENTATION',body,quoted('Body'),quoted('Tessellation'),list([faceSet]));
  const representationMap=add('IFCREPRESENTATIONMAP',axis,representation);
  const cassette=model.id.startsWith('SP-CAS-'), cls=cassette?'IFCCOVERING':'IFCBUILDINGELEMENTPROXY', predefined=cassette?'.CLADDING.':'.USERDEFINED.';
  const name=`${mark || model.id} — ${model.name}`;
  const type=add(cls+'TYPE',id(),'$',quoted(name),quoted('Типоразмер, сформированный веб-конфигуратором'),'$',list([source,sizes]),list([representationMap]),quoted(model.id),quoted(model.name),predefined);
  const transform=add('IFCCARTESIANTRANSFORMATIONOPERATOR3D','$','$',origin,'1.','$');
  const mapped=add('IFCMAPPEDITEM',representationMap,transform);
  const mappedRepresentation=add('IFCSHAPEREPRESENTATION',body,quoted('Body'),quoted('MappedRepresentation'),list([mapped]));
  const shape=add('IFCPRODUCTDEFINITIONSHAPE','$','$',list([mappedRepresentation]));
  const placement=add('IFCLOCALPLACEMENT',storeyPlacement,axis);
  const product=add(cls,id(),'$',quoted(name),quoted('Координационная сетка по заданным габаритам; не параметрическое семейство.'),quoted(model.name),placement,shape,quoted(mark || model.id),predefined);
  add('IFCRELDEFINESBYTYPE',id(),'$','$','$',list([product]),type);
  const quantities=geometry.stats.size.map((n,i)=>add('IFCQUANTITYLENGTH',quoted('BoundingSize'+'XYZ'[i]),'$','$',real(n),'$'));
  quantities.push(add('IFCQUANTITYVOLUME',quoted('MeshSolidVolume'),'$','$',real(geometry.stats.volume/1e9),'$'));
  quantities.push(add('IFCQUANTITYAREA',quoted('MeshSurfaceArea'),quoted('Полная поверхность сетки; не площадь развёртки или окраски'),'$',real(geometry.stats.area/1e6),'$'));
  const qto=add('IFCELEMENTQUANTITY',id(),'$',quoted('SP_GeometricQuantities'),'$',quoted('Computed from the exported triangle mesh'),list(quantities));
  add('IFCRELDEFINESBYPROPERTIES',id(),'$','$','$',list([product]),qto);
  add('IFCRELCONTAINEDINSPATIALSTRUCTURE',id(),'$','$','$',list([product]),storey);
  const header=`ISO-10303-21;\nHEADER;\nFILE_DESCRIPTION(('IFC4 coordination mesh; web size adaptation; not a certified MVD'),'2;1');\nFILE_NAME(${quoted(model.id+'-custom.ifc')},${quoted(new Date().toISOString())},('Steel Produkt'),('Steel Produkt'),'SP web sizing','${VERSION}','');\nFILE_SCHEMA(('IFC4'));\nENDSEC;\nDATA;\n`;
  return header+lines.join('\n')+'\nENDSEC;\nEND-ISO-10303-21;\n';
}

export function makeProject(model,geometry,mark='') {
  return JSON.stringify({version:VERSION,modelId:model.id,sourceSha256:model.ifcSha256,dimensions:geometry.dimensions.map(round),mark},null,2);
}
export function readProject(text, models) {
  if(typeof text !== 'string'||text.length>32768)throw new Error('Файл настроек должен быть не больше 32 КБ.');
  const value=JSON.parse(text);
  if(!value||Array.isArray(value)||value.version!==VERSION)throw new Error('Неизвестная версия настроек.');
  const model=models.find(m=>m.id===value.modelId);
  if(!model||value.sourceSha256!==model.ifcSha256)throw new Error('Настройки относятся к другой версии исходной модели.');
  if(!Array.isArray(value.dimensions)||value.dimensions.length!==3||value.dimensions.some(v=>typeof v!=='number'||!Number.isFinite(v)||v<=0||v>6000))throw new Error('Некорректные габариты в настройках.');
  if(typeof value.mark!=='string'||value.mark.length>80||/[\x00-\x1f]/.test(value.mark))throw new Error('Некорректная марка в настройках.');
  return {model,dimensions:value.dimensions,mark:value.mark};
}
