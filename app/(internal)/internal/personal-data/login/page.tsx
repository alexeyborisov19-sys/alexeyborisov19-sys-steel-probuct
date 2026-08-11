import { LoginForm } from "@/components/pd-admin/LoginForm";
import { requirePdAdminEnabled } from "@/lib/pd-admin/auth/page-context";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  requirePdAdminEnabled();
  return <main className="grid min-h-screen place-items-center bg-[#090b0d] px-5 text-white">
    <section className="w-full max-w-md border border-white/10 bg-[#111519] p-7 shadow-2xl">
      <p className="text-[10px] font-bold uppercase tracking-[.22em] text-[#ea5b0c]">Сталь Продукт</p>
      <h1 className="mt-3 text-2xl font-semibold">Закрытая система управления ПДн</h1>
      <p className="mb-7 mt-3 text-sm leading-relaxed text-white/50">Доступ разрешён только уполномоченным сотрудникам с личной учётной записью.</p>
      <LoginForm />
    </section>
  </main>;
}
