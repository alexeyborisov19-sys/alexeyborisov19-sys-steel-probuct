import {readMesh,prepareMesh,resize,createIfc,makeProject,readProject} from './sizing.mjs';
import {GeometryViewer} from './renderer.mjs';
const $=id=>document.getElementById(id),fmt=value=>Number(value).toLocaleString('ru-RU',{maximumFractionDigits:3});
const disabledIds=['apply','reset','download','save-project'];
let importEpoch=0;
let models=[],selected=null,mesh=null,geometry=null,viewer=null,epoch=0,pending=null,dirty=false;
const cache=new Map();
function error(message=''){$('error').textContent=message;$('error').hidden=!message;}
function busy(value){for(const id of disabledIds)$(id).disabled=value;$('model').disabled=models.length===0;}
function invalidate(){dirty=true;$('download').disabled=true;$('save-project').disabled=true;$('preview-state').textContent='Размеры ещё не применены';$('status').textContent='Нажмите «Применить размеры» перед скачиванием.';error();}
function currentDimensions(){return [0,1,2].map(i=>{const input=$('dim-'+i);return input.value.trim()===''?NaN:Number(input.value.replace(',','.'));});}
function updatePreview(){
  viewer.setGeometry(geometry);$('preview-size').textContent=geometry.stats.size.map(fmt).join(' × ')+' мм';$('preview-state').textContent='Показана геометрия скачиваемого IFC';$('model-code').textContent=selected.id;
  $('status').textContent='Размеры применены. IFC и настройки готовы к скачиванию.';dirty=false;error();busy(false);document.body.dataset.model=selected.id;document.body.dataset.ready='true';
}
function apply(){if(!mesh)return;try{const next=resize(mesh,currentDimensions());const mark=$('mark').value;if(mark.length>80||/[\x00-\x1f]/.test(mark))throw new Error('Проверьте марку.');geometry=next;updatePreview();}catch(e){dirty=true;$('download').disabled=true;$('save-project').disabled=true;error(e.message);$('preview-state').textContent='Размеры не применены';}}
async function sourceMesh(model){
  if(cache.has(model.id)){const value=cache.get(model.id);cache.delete(model.id);cache.set(model.id,value);return value;}
  const oriented=Boolean(model.orientedCoordSha256);
  const response=await fetch('../'+(oriented?'metallokassety-oriented':'metallokassety')+'/IFC4_coordination/'+model.id+'.ifc',{credentials:'omit'});
  if(!response.ok)throw new Error('Исходный IFC недоступен: HTTP '+response.status);
  const text=await response.text();if(text.length>3000000)throw new Error('Исходный IFC слишком велик.');
  const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));const hex=[...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,'0')).join('');
  if(hex!==(model.orientedCoordSha256 || model.ifcSha256))throw new Error('Контрольная сумма IFC не совпала. Скачивание заблокировано.');
  const prepared=prepareMesh(readMesh(text));cache.set(model.id,prepared);while(cache.size>2)cache.delete(cache.keys().next().value);return prepared;
}
function fields(){
  $('dimensions').replaceChildren();const order=[0,2,1];
  for(const i of order){const a=mesh.axes[i],label=document.createElement('label'),input=document.createElement('input'),hint=document.createElement('small');label.className='field';label.append('Габарит '+'XYZ'[i]+', мм');input.id='dim-'+i;input.type='number';input.step='any';input.inputMode='decimal';input.value=String(Math.round(a.original*1000)/1000);input.readOnly=!a.editable;input.setAttribute('aria-describedby','dim-help-'+i);if(a.editable){input.min=a.min;input.max=a.max;hint.textContent=fmt(a.min)+'–'+fmt(a.max)+' мм';}else hint.textContent='Фиксированный профиль';hint.id='dim-help-'+i;input.addEventListener('input',invalidate);label.append(input,hint);$('dimensions').append(label);}
  $('source-details').textContent=selected.category+' · толщина исходника '+fmt(selected.measured_thickness_mm)+' мм'+(selected.orientedCoordSha256?' · верхний угловой отгиб ориентирован вверх (+Z)':'');
  const base=selected.orientedCoordSha256?'metallokassety-oriented':'metallokassety';
  $('source-mesh').href='../'+base+'/IFC4_coordination/'+selected.id+'.ifc';$('source-exact').href='../'+base+'/IFC4_exact_geometry/'+selected.id+'.ifc';
  $('source-mesh').textContent=selected.orientedCoordSha256?'Координационный IFC · замок сверху':'Исходный координационный IFC';
  $('source-exact').textContent=selected.orientedCoordSha256?'Точный IFC · замок сверху':'Исходный точный IFC';
  for(const id of ['source-mesh','source-exact'])$(id).removeAttribute('aria-disabled');
}
function clearSourceLinks(){for(const id of ['source-mesh','source-exact']){$(id).removeAttribute('href');$(id).setAttribute('aria-disabled','true');}}
async function selectModel(id,settings=null){
  const request=++epoch,model=models.find(m=>m.id===id);if(!model)return;
  clearSourceLinks();
  busy(true);dirty=true;document.body.dataset.ready='false';$('status').textContent='Проверка исходника и подготовка геометрии…';$('preview-state').textContent='Загрузка новой модели…';error();
  try{const next=await sourceMesh(model);if(request!==epoch)return;selected=model;mesh=next;$('model').value=id;fields();$('mark').value=settings?.mark||'';if(settings)settings.dimensions.forEach((n,i)=>{$('dim-'+i).value=String(n);});geometry=resize(mesh,currentDimensions());viewer.zoom=1;updatePreview();}
  catch(e){if(request!==epoch)return;clearSourceLinks();mesh=null;geometry=null;error(e.message);$('status').textContent='Модель не готова. Выберите другой образец или повторите загрузку.';$('preview-state').textContent='Модель не готова';busy(true);}
}
function save(content,filename,type){const url=URL.createObjectURL(new Blob([content],{type})),a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
$('apply').addEventListener('click',apply);$('mark').addEventListener('input',invalidate);$('reset').addEventListener('click',()=>{if(!mesh)return;mesh.axes.forEach((a,i)=>{$('dim-'+i).value=String(Math.round(a.original*1000)/1000);});apply();});
$('model').addEventListener('change',()=>{importEpoch++;pending=null;$('pending').hidden=true;selectModel($('model').value);});
$('download').addEventListener('click',()=>{if(dirty||!geometry)return;try{const dims=geometry.stats.size.map(n=>fmt(n).replaceAll(/\s/g,'').replace(',','.')).join('x');save(createIfc(selected,geometry,$('mark').value),`${selected.id}_${dims}.ifc`,'application/octet-stream');$('status').textContent='IFC подготовлен с применёнными габаритами.';}catch(e){error(e.message);}});
$('save-project').addEventListener('click',()=>{if(!dirty&&geometry)save(makeProject(selected,geometry,$('mark').value),selected.id+'-settings.json','application/json');});
$('load-project').addEventListener('change',async e=>{const ticket=++importEpoch,file=e.target.files[0];e.target.value='';pending=null;$('pending').hidden=true;if(!file)return;try{if(file.size>32768)throw new Error('Файл настроек превышает 32 КБ.');const value=readProject(await file.text(),models);if(ticket!==importEpoch)return;pending=value;$('pending-text').textContent=`Загружены ${value.model.id}: ${value.dimensions.map(fmt).join(' × ')} мм. Заменить текущие настройки?`;$('pending').hidden=false;error();}catch(err){if(ticket===importEpoch)error(err.message);}});
$('confirm-import').addEventListener('click',()=>{if(!pending)return;const value=pending;pending=null;$('pending').hidden=true;selectModel(value.model.id,value);});$('cancel-import').addEventListener('click',()=>{importEpoch++;pending=null;$('pending').hidden=true;});
$('fit').addEventListener('click',()=>{if(viewer){viewer.zoom=1;viewer.render();}});$('zoom-in').addEventListener('click',()=>viewer?.setZoom(1.25));$('zoom-out').addEventListener('click',()=>viewer?.setZoom(.8));$('edges').addEventListener('change',()=>{if(viewer){viewer.edges=$('edges').checked;viewer.render();}});document.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',()=>viewer?.view(button.dataset.view)));
async function init(){
  try{
    viewer=new GeometryViewer($('canvas'),mode=>{if(mode==='Canvas2D'){$('edges').checked=false;$('edges').disabled=true;$('render-note').textContent='Облегчённый 3D-просмотр без контуров. Перетаскивание вращает модель; масштаб не меняет размеры IFC.';}});
    const response=await fetch('models.json',{credentials:'omit'});if(!response.ok)throw new Error('Каталог недоступен.');const data=await response.json();
    if(!Array.isArray(data)||data.length!==15||new Set(data.map(m=>m.id)).size!==15||data.some(m=>!/^SP-(CAS|TRIM)-\d{2}$/.test(m.id)||!/^[a-f0-9]{64}$/.test(m.ifcSha256)))throw new Error('Каталог моделей не прошёл проверку.');models=data;
    for(const category of ['Металлокассета','Доборный элемент']){const group=document.createElement('optgroup');group.label=category;for(const m of models.filter(m=>m.category===category)){const option=document.createElement('option');option.value=m.id;option.textContent=m.name+' — '+m.id;group.append(option);}$('model').append(group);}
    $('model').disabled=false;const requested=new URLSearchParams(location.search).get('model');await selectModel(models.some(m=>m.id===requested)?requested:'SP-CAS-02');
  }catch(e){error(e.message);$('status').textContent='Конфигуратор не готов. Исходные модели доступны в BIM-библиотеке.';busy(true);}
}
init();
