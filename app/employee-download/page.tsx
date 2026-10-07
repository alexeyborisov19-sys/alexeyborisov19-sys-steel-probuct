import type {Metadata} from 'next';
export const dynamic='force-dynamic';
export const metadata:Metadata={title:'Калькулятор сотрудников — Сталь Продукт',robots:{index:false,follow:false}};
export default async function Download({searchParams}:{searchParams:Promise<{error?:string}>}){
 const {error}=await searchParams;
 return <main className="mx-auto min-h-[60vh] max-w-lg px-6 py-16"><h1 className="text-3xl font-semibold">Калькулятор сотрудников</h1><p className="mt-4 text-white/70">Приложение для Windows. Введите код, полученный от администратора. Скачивание не занимает установку; этот же код потребуется для активации программы.</p><form method="post" action="/api/employee-app/installer" className="mt-8 space-y-4"><label htmlFor="employee-code" className="block">Код сотрудника</label><input id="employee-code" name="code" type="password" required minLength={32} maxLength={32} autoComplete="off" className="w-full border border-white/30 bg-black/20 p-3"/><button className="w-full bg-orange-600 px-5 py-3 font-semibold text-white">Скачать для Windows</button></form>{error&&<p role="alert" className="mt-4 text-amber-300">Скачивание недоступно. Проверьте код или обратитесь к администратору. При повторных попытках подождите минуту.</p>}</main>;
}
