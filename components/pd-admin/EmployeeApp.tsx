'use client';
import {useEffect,useState} from 'react';
type License={id:string;label:string;device_limit:number;disabled:number};
type Device={id:string;license_id:string;disabled:number;last_seen:string};
export function EmployeeApp({csrfToken}:{csrfToken:string}){
 const [licenses,setLicenses]=useState<License[]>([]),[devices,setDevices]=useState<Device[]>([]),[message,setMessage]=useState(''),[code,setCode]=useState(''),[busy,setBusy]=useState(false);
 async function refresh(){try{const r=await fetch('/api/internal/personal-data/employee-app',{cache:'no-store'});if(!r.ok)throw Error();const d=await r.json();setLicenses(d.licenses);setDevices(d.devices)}catch{setMessage('Реестр недоступен. Проверьте включение сервиса активации.')}}
 useEffect(()=>{void refresh()},[]);
 async function action(body:unknown){setBusy(true);setMessage('');try{const r=await fetch('/api/internal/personal-data/employee-app',{method:'POST',headers:{'Content-Type':'application/json','X-Steelprodukt-CSRF':csrfToken},body:JSON.stringify(body)});if(!r.ok){setMessage(r.status===403?'Подтвердите пароль администратора перед изменением доступа.':'Не удалось сохранить изменение.');return}const d=await r.json();if(d.code)setCode(d.code);await refresh()}catch{setMessage('Нет связи с сервером. Изменение не подтверждено.')}finally{setBusy(false)}}
 return <div className="space-y-6">
 <p>Это доступ только к приложению сотрудников. Ваше локальное приложение владельца здесь не регистрируется и не отключается.</p>
 <form className="flex flex-wrap gap-4" onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);void action({action:'create',label:String(f.get('label')),limit:Number(f.get('limit'))})}}>
 <label>Обозначение сотрудника<input className="block border p-2 text-black" name="label" required maxLength={80} placeholder="Технолог 1"/></label>
 <label>Компьютеров<input className="block border p-2 text-black" name="limit" type="number" min={1} max={20} defaultValue={1} required/></label>
 <button disabled={busy} className="border px-4 py-2">Выдать код</button></form>
 {code&&<div className="border p-4"><p>Код показан один раз. Передайте его сотруднику лично.</p><code className="break-all select-all">{code}</code><button className="ml-4 border p-2" onClick={()=>setCode('')}>Скрыть</button></div>}
 <p role="status">{message}</p>
 {licenses.map(l=><section className="border p-4 space-y-3" key={l.id}><h2>{l.label} · лимит {l.device_limit} · {l.disabled?'доступ отключён':'активен'}</h2>
 {!l.disabled&&<button disabled={busy} className="border p-2" onClick={()=>{if(confirm('Отключить все компьютеры этого сотрудника?'))void action({action:'revoke',kind:'license',id:l.id})}}>Отключить сотрудника</button>}
 {devices.filter(d=>d.license_id===l.id).map(d=><div className="flex flex-wrap gap-3" key={d.id}><span>Компьютер {d.id.slice(0,8)} · {d.disabled?'отключён':new Date(d.last_seen).toLocaleString('ru-RU')}</span>{!d.disabled&&<button disabled={busy} className="border px-2" onClick={()=>{if(confirm('Отключить этот компьютер?'))void action({action:'revoke',kind:'device',id:d.id})}}>Отключить компьютер</button>}</div>)}</section>)}
 </div>
}
