
'use strict';
const models=JSON.parse(document.getElementById('models').textContent);
const $=id=>document.getElementById(id), sel=$('model'),canvas=$('canvas');
const uprightClosed=new Set(['SP-CAS-01','SP-CAS-03','SP-CAS-05']);
const series=new Map([
 ['SP-CAS-01','Премиум'],['SP-CAS-03','Премиум'],['SP-CAS-05','Премиум'],
 ['SP-CAS-02','Стандарт'],['SP-CAS-04','Стандарт'],['SP-CAS-06','Стандарт'],
]);
const displayName=m=>(series.has(m.id)?'«'+series.get(m.id)+'» · ':'')+m.name;
for(const [i,m] of models.entries()){const o=document.createElement('option');o.value=i;o.textContent=m.id+' — '+displayName(m);sel.append(o)}
let current=0,yaw=-1.10,pitch=.47,zoom=1,drag=null,gl=null,program=null,meshBuffer=null,lineBuffer=null,locations={},ctx2d=null,softMesh=null,softLines=null;
const fmt=x=>Number(x).toLocaleString('ru-RU',{maximumFractionDigits:3});
function decode(s){const str=atob(s),b=new Uint8Array(str.length);for(let i=0;i<str.length;i++)b[i]=str.charCodeAt(i);return b}
function download(variant){
 const m=models[current],a=document.createElement('a');
 const root=uprightClosed.has(m.id)?'../metallokassety-oriented/':'';
 a.href=root+(variant==='exact'?'IFC4_exact_geometry/':'IFC4_coordination/')+m.id+'.ifc';
 a.download=m.id+(uprightClosed.has(m.id)?'_UPRIGHT':'')+(variant==='exact'?'_Exact':'_BIM')+'.ifc';
 a.click();
}
function displayArrays(m){
 if(m._displayArrays)return m._displayArrays;
 const mesh=new Float32Array(decode(m.vertices).buffer),lines=new Float32Array(decode(m.lines).buffer);
 if(uprightClosed.has(m.id)){
  // Rigid 180-degree turn about Y: x'=maxX-x, z'=maxZ-z.
  // Normals use the same rotation (no translation), all triangles unchanged.
  // The read-only source preview assets are preserved.
  let maxX=-Infinity,maxZ=-Infinity;
  for(let i=0;i<mesh.length;i+=6){maxX=Math.max(maxX,mesh[i]);maxZ=Math.max(maxZ,mesh[i+2]);}
  for(let i=0;i<mesh.length;i+=6){mesh[i]=maxX-mesh[i];mesh[i+2]=maxZ-mesh[i+2];mesh[i+3]=-mesh[i+3];mesh[i+5]=-mesh[i+5];}
  for(let i=0;i<lines.length;i+=3){lines[i]=maxX-lines[i];lines[i+2]=maxZ-lines[i+2];}
 }
 m._displayArrays={mesh,lines};
 return m._displayArrays;
}
const pendingModels=new Map();
function ensureModel(index){
 if(pendingModels.has(index))return;
 const model=models[index];
 const task=fetch('preview/'+model.id+'.json').then(response=>{if(!response.ok)throw new Error('HTTP '+response.status);return response.json()}).then(data=>{
  if(data.id!==model.id||typeof data.vertices!=='string'||typeof data.lines!=='string'||data.vertexCount!==model.vertexCount||data.lineCount!==model.lineCount)throw new Error('Файл модели не соответствует каталогу');
  Object.assign(model,data);if(current===index){$('alert').style.display='none';change(index)}
 }).catch(()=>{if(current===index){$('alert').textContent='Не удалось загрузить 3D-модель. Обновите страницу или скачайте IFC кнопками ниже.';$('alert').style.display='block'}}).finally(()=>pendingModels.delete(index));
 pendingModels.set(index,task);
}

function change(index){current=Number(index);sel.value=current;const m=models[current];$('name').textContent=displayName(m);$('category').textContent=m.category;$('fixing').textContent=m.fixing_type==='Не указан в имени исходного файла'?'Тип крепления не указан в имени исходника':m.fixing_type;$('overlayId').textContent=m.id;$('overlayText').textContent='Геометрия прочитана из готового IFC';$('counter').textContent=(current+1)+' / '+models.length;
$('properties').replaceChildren();const rows=[['Габарит X',fmt(m.bbox_mm[0])+' мм'],['Габарит Y',fmt(m.bbox_mm[1])+' мм'],['Габарит Z',fmt(m.bbox_mm[2])+' мм'],['Измеренная толщина',fmt(m.measured_thickness_mm)+' мм'],['Элемент IFC',m.category==='Металлокассета'?'IfcCovering / CLADDING':'IfcBuildingElementProxy'],['Геометрия просмотра',m.mesh_triangles.toLocaleString('ru-RU')+' треугольников']];for(const [k,v]of rows){const row=document.createElement('div');row.className='row';const label=document.createElement('span'),value=document.createElement('strong');label.textContent=k;value.textContent=v;row.append(label,value);$('properties').append(row)}$('source').textContent='Исходник: '+m.source_file+(uprightClosed.has(m.id)?' · верхний угловой замок ориентирован вверх (+Z)':'');zoom=1;yaw=-1.10;pitch=.47;if(!m.vertices){$('overlayText').textContent='Загрузка 3D-модели…';document.body.dataset.rendered='loading';if(ctx2d){softMesh=null;softLines=null;ctx2d.clearRect(0,0,canvas.width,canvas.height)}if(gl)gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);ensureModel(current);return}const display=displayArrays(m);
if(ctx2d){softMesh=display.mesh;softLines=display.lines;render()}
if(gl){gl.bindBuffer(gl.ARRAY_BUFFER,meshBuffer);gl.bufferData(gl.ARRAY_BUFFER,display.mesh,gl.STATIC_DRAW);gl.bindBuffer(gl.ARRAY_BUFFER,lineBuffer);gl.bufferData(gl.ARRAY_BUFFER,display.lines,gl.STATIC_DRAW);render()}}
function normalize(v){const n=Math.hypot(...v);return v.map(x=>x/n)}function cross(a,b){return[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]}
function multiply(a,b){const out=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++)for(let k=0;k<4;k++)out[c*4+r]+=a[k*4+r]*b[c*4+k];return out}
function matrices(aspect){const back=[Math.cos(pitch)*Math.cos(yaw),Math.cos(pitch)*Math.sin(yaw),Math.sin(pitch)],right=normalize(cross([0,0,1],back)),up=cross(back,right);const view=new Float32Array([right[0],up[0],back[0],0,right[1],up[1],back[1],0,right[2],up[2],back[2],0,0,0,-3,1]);const h=1.17/zoom,w=h*aspect;const projection=new Float32Array([1/w,0,0,0,0,1/h,0,0,0,0,-.1,0,0,0,0,1]);return multiply(projection,view)}
function shader(kind,source){const s=gl.createShader(kind);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s}
function init(){gl=canvas.getContext('webgl',{antialias:true,preserveDrawingBuffer:true});if(!gl){ctx2d=canvas.getContext('2d',{alpha:false});if(!ctx2d){$('alert').style.display='block';return}change(0);new ResizeObserver(render).observe(canvas);return}const vs=shader(gl.VERTEX_SHADER,'attribute vec3 aPos;attribute vec3 aNormal;uniform mat4 uMVP;varying vec3 vNormal;void main(){gl_Position=uMVP*vec4(aPos,1.0);vNormal=aNormal;}');const fs=shader(gl.FRAGMENT_SHADER,'precision mediump float;uniform bool uLine;varying vec3 vNormal;void main(){if(uLine){gl_FragColor=vec4(.23,.28,.31,1.0);}else{vec3 n=normalize(vNormal);float l=.55+.32*abs(dot(n,normalize(vec3(.35,-.55,.75))))+.10*abs(dot(n,normalize(vec3(-.6,-.2,.5))));gl_FragColor=vec4(vec3(.69,.75,.79)*l,1.0);}}');program=gl.createProgram();gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program));gl.useProgram(program);locations={pos:gl.getAttribLocation(program,'aPos'),normal:gl.getAttribLocation(program,'aNormal'),mvp:gl.getUniformLocation(program,'uMVP'),line:gl.getUniformLocation(program,'uLine')};meshBuffer=gl.createBuffer();lineBuffer=gl.createBuffer();gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.disable(gl.CULL_FACE);gl.clearColor(.956,.965,.971,1);change(0);new ResizeObserver(render).observe(canvas)}
function render(){if(!models[current].vertices)return;if(ctx2d){softwareRender();return}if(!gl)return;const dpr=Math.min(window.devicePixelRatio||1,2),width=Math.max(1,Math.round(canvas.clientWidth*dpr)),height=Math.max(1,Math.round(canvas.clientHeight*dpr));if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height}gl.viewport(0,0,width,height);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.uniformMatrix4fv(locations.mvp,false,matrices(width/height));gl.uniform1i(locations.line,0);gl.bindBuffer(gl.ARRAY_BUFFER,meshBuffer);gl.enableVertexAttribArray(locations.pos);gl.enableVertexAttribArray(locations.normal);gl.vertexAttribPointer(locations.pos,3,gl.FLOAT,false,24,0);gl.vertexAttribPointer(locations.normal,3,gl.FLOAT,false,24,12);gl.enable(gl.POLYGON_OFFSET_FILL);gl.polygonOffset(1,1);gl.drawArrays(gl.TRIANGLES,0,models[current].vertexCount);gl.disable(gl.POLYGON_OFFSET_FILL);if($('edges').checked){gl.uniform1i(locations.line,1);gl.bindBuffer(gl.ARRAY_BUFFER,lineBuffer);gl.vertexAttribPointer(locations.pos,3,gl.FLOAT,false,12,0);gl.disableVertexAttribArray(locations.normal);gl.vertexAttrib3f(locations.normal,0,0,1);gl.drawArrays(gl.LINES,0,models[current].lineCount)}document.body.dataset.rendered=String(current);window.viewerStatus={model:models[current].id,vertices:models[current].vertexCount,webglError:gl.getError(),oriented:uprightClosed.has(models[current].id)}}

function softwareRender(){
 const dpr=Math.min(window.devicePixelRatio||1,1.5),width=Math.max(1,Math.round(canvas.clientWidth*dpr)),height=Math.max(1,Math.round(canvas.clientHeight*dpr));
 if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height}const c=ctx2d;c.fillStyle='#f4f6f7';c.fillRect(0,0,width,height);if(!softMesh)return;
 const back=[Math.cos(pitch)*Math.cos(yaw),Math.cos(pitch)*Math.sin(yaw),Math.sin(pitch)],right=normalize(cross([0,0,1],back)),up=cross(back,right),scale=height*zoom/2.34;
 const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
 const project=(x,y,z)=>[(x*right[0]+y*right[1]+z*right[2])*scale+width/2,height/2-(x*up[0]+y*up[1]+z*up[2])*scale,x*back[0]+y*back[1]+z*back[2]];
 const triangles=[],light1=normalize([.35,-.55,.75]),light2=normalize([-.6,-.2,.5]);
 for(let i=0;i<softMesh.length;i+=18){const n=[softMesh[i+3],softMesh[i+4],softMesh[i+5]];if(dot(n,back)<-1e-6)continue;const a=project(softMesh[i],softMesh[i+1],softMesh[i+2]),b=project(softMesh[i+6],softMesh[i+7],softMesh[i+8]),d=project(softMesh[i+12],softMesh[i+13],softMesh[i+14]);const den=(b[1]-d[1])*(a[0]-d[0])+(d[0]-b[0])*(a[1]-d[1]);if(Math.abs(den)<1e-8)continue;const light=.55+.32*Math.abs(dot(n,light1))+.10*Math.abs(dot(n,light2));triangles.push({a,b,d,den,depth:(a[2]+b[2]+d[2])/3,maxz:Math.max(a[2],b[2],d[2]),minx:Math.min(a[0],b[0],d[0]),maxx:Math.max(a[0],b[0],d[0]),miny:Math.min(a[1],b[1],d[1]),maxy:Math.max(a[1],b[1],d[1]),shade:'rgb('+[.69,.75,.79].map(x=>Math.round(x*light*255)).join(',')+')'})}
 triangles.sort((a,b)=>a.depth-b.depth);
 for(const t of triangles){c.beginPath();c.moveTo(t.a[0],t.a[1]);c.lineTo(t.b[0],t.b[1]);c.lineTo(t.d[0],t.d[1]);c.closePath();c.fillStyle=t.shade;c.fill();c.lineWidth=.45*dpr;c.strokeStyle=t.shade;c.stroke()}
 if($('edges').checked){const visible=p=>{for(let j=triangles.length-1;j>=0;j--){const t=triangles[j];if(t.maxz<=p[2]+1e-5||p[0]<t.minx-.1||p[0]>t.maxx+.1||p[1]<t.miny-.1||p[1]>t.maxy+.1)continue;const wa=((t.b[1]-t.d[1])*(p[0]-t.d[0])+(t.d[0]-t.b[0])*(p[1]-t.d[1]))/t.den,wb=((t.d[1]-t.a[1])*(p[0]-t.d[0])+(t.a[0]-t.d[0])*(p[1]-t.d[1]))/t.den,wc=1-wa-wb;if(wa>=-1e-5&&wb>=-1e-5&&wc>=-1e-5&&wa*t.a[2]+wb*t.b[2]+wc*t.d[2]>p[2]+1e-5)return false}return true};c.strokeStyle='#48565f';c.lineWidth=.75*dpr;c.beginPath();for(let i=0;i<softLines.length;i+=6){const a=project(softLines[i],softLines[i+1],softLines[i+2]),b=project(softLines[i+3],softLines[i+4],softLines[i+5]);for(let k=0;k<3;k++){const t=(k+.5)/3,mid=a.map((v,j)=>v+(b[j]-v)*t);if(visible(mid)){c.moveTo(a[0]+(b[0]-a[0])*k/3,a[1]+(b[1]-a[1])*k/3);c.lineTo(a[0]+(b[0]-a[0])*(k+1)/3,a[1]+(b[1]-a[1])*(k+1)/3)}}}c.stroke()}
 document.body.dataset.rendered=String(current);window.viewerStatus={model:models[current].id,vertices:models[current].vertexCount,webglError:0,oriented:uprightClosed.has(models[current].id),renderer:'Canvas2D software projection'};
}

sel.addEventListener('change',()=>change(sel.value));$('meshDownload').onclick=()=>download('mesh');$('exactDownload').onclick=()=>download('exact');$('edges').onchange=render;$('fit').onclick=()=>{zoom=1;render()};$('zoomIn').onclick=()=>{zoom=Math.min(20,zoom*1.25);render()};$('zoomOut').onclick=()=>{zoom=Math.max(.35,zoom/1.25);render()};document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{const v=b.dataset.view;yaw=v==='front'?Math.PI/2:v==='rear'?-Math.PI/2:-1.10;pitch=v==='iso'?.47:0;render()});canvas.onpointerdown=e=>{drag={x:e.clientX,y:e.clientY,id:e.pointerId};canvas.setPointerCapture(e.pointerId)};canvas.onpointermove=e=>{if(!drag||drag.id!==e.pointerId)return;yaw-=(e.clientX-drag.x)*.008;pitch=Math.max(-1.5,Math.min(1.5,pitch+(e.clientY-drag.y)*.008));drag.x=e.clientX;drag.y=e.clientY;render()};canvas.onpointerup=canvas.onpointercancel=()=>{drag=null};canvas.addEventListener('wheel',e=>{e.preventDefault();zoom=Math.max(.35,Math.min(20,zoom*Math.exp(-e.deltaY*.001)));render()},{passive:false});try{init()}catch(e){$('alert').textContent='Не удалось запустить 3D-просмотр: '+e.message;$('alert').style.display='block';console.error(e)}if(!gl)change(0);
