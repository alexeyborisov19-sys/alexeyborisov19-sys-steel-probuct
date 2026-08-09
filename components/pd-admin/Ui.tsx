import Link from "next/link";

export function Panel({ title, children, className = "" }: { title?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`border border-white/10 bg-[#111519] p-5 ${className}`}>
      {title ? <h2 className="mb-4 text-sm font-semibold">{title}</h2> : null}
      {children}
    </section>
  );
}

export function StatusPill({ status, label }: { status: "ready" | "warning" | "critical" | "unknown" | "disabled"; label?: string }) {
  const styles = {
    ready: "border-emerald-500/35 bg-emerald-500/10 text-emerald-200",
    warning: "border-amber-500/35 bg-amber-500/10 text-amber-200",
    critical: "border-red-500/35 bg-red-500/10 text-red-200",
    unknown: "border-slate-400/25 bg-slate-400/10 text-slate-300",
    disabled: "border-white/15 bg-white/5 text-white/45",
  } as const;
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase ${styles[status]}`}>{label ?? status}</span>;
}

export function MetricCard({ label, value, tone = "default" }: { label: string; value: React.ReactNode; tone?: "default" | "warning" | "critical" }) {
  const toneClass = tone === "critical" ? "text-red-300" : tone === "warning" ? "text-amber-300" : "text-white";
  return (
    <div className="border border-white/10 bg-black/20 p-4">
      <div className={`text-2xl font-semibold tabular-nums ${toneClass}`}>{value}</div>
      <div className="mt-1 text-[10px] font-semibold uppercase tracking-[.08em] text-white/45">{label}</div>
    </div>
  );
}

export function Pager({ basePath, page, pageSize, total }: { basePath: string; page: number; pageSize: number; total: number }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="mt-5 flex items-center justify-between text-xs text-white/55">
      <span>Страница {page} из {pages} · записей: {total}</span>
      <div className="flex gap-2">
        {page > 1 ? <Link prefetch={false} className="border border-white/15 px-3 py-2 hover:border-[#ea5b0c]" href={`${basePath}?page=${page - 1}`}>Назад</Link> : null}
        {page < pages ? <Link prefetch={false} className="border border-white/15 px-3 py-2 hover:border-[#ea5b0c]" href={`${basePath}?page=${page + 1}`}>Далее</Link> : null}
      </div>
    </div>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return <div className="border border-dashed border-white/15 p-8 text-center text-sm text-white/45">{children}</div>;
}
