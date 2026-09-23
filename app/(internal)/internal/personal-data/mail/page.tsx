import Link from "next/link";
import { InternalPageHeader, InternalShell } from "@/components/pd-admin/InternalShell";
import { EmptyState, Panel, StatusPill } from "@/components/pd-admin/Ui";
import { requirePdPageContext } from "@/lib/pd-admin/auth/page-context";
import { listMailbox } from "@/lib/pd-admin/mail/service";

export const dynamic = "force-dynamic";

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function displayDate(value: string) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toLocaleString("ru-RU") : value || "Без даты";
}

export default async function MailPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await requirePdPageContext("VIEW_FULL_LEAD");
  const query = await searchParams;
  const q = (first(query.q) || "").trim().slice(0, 300);
  const unseen = first(query.unseen) === "1";
  const data = await listMailbox(context, { query: q, unseen, limit: 30 });
  const shell = { user: context.user, session: context.session, csrfToken: context.csrfToken };
  context.close();

  return <InternalShell {...shell}>
    <InternalPageHeader
      eyebrow="Почта"
      title="Входящие info@steelprodukt.ru"
      description="Только чтение: модуль использует IMAP EXAMINE и BODY.PEEK. Он не помечает письма прочитанными, не перемещает, не удаляет и не отправляет сообщения."
    />

    <Panel title="Поиск по последней переписке">
      <form method="get" className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
        <input
          name="q"
          defaultValue={q}
          placeholder="Тема, отправитель, адрес или Message-ID"
          className="border border-white/15 bg-black/25 px-3 py-3 text-sm"
        />
        <label className="flex items-center gap-2 border border-white/10 px-4 py-3 text-xs text-white/65">
          <input name="unseen" value="1" type="checkbox" defaultChecked={unseen} className="accent-[#ea5b0c]" />
          Только непрочитанные
        </label>
        <button className="border border-[#ea5b0c] px-4 py-3 text-xs font-bold uppercase text-[#ea5b0c]">Показать</button>
      </form>
      <p className="mt-3 text-xs text-white/40">
        Поиск выполняется локально по заголовкам последних писем. Содержимое писем открывается только на странице конкретного сообщения.
      </p>
    </Panel>

    <Panel className="mt-4">
      {data.messages.length ? <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] border-collapse text-left text-xs">
          <thead className="text-white/40">
            <tr>
              {["Дата", "Отправитель", "Тема", "Размер", "Режим"].map((head) => (
                <th key={head} className="border-b border-white/10 px-3 py-3 font-semibold">{head}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.messages.map((item) => <tr key={item.uid} className="border-b border-white/5 hover:bg-white/[.025]">
              <td className="whitespace-nowrap px-3 py-3">{displayDate(item.date)}</td>
              <td className="max-w-[280px] truncate px-3 py-3" title={item.from}>{item.from || "Не указан"}</td>
              <td className="max-w-[440px] px-3 py-3">
                <Link
                  prefetch={false}
                  href={"/internal/personal-data/mail/" + item.uid}
                  className="font-semibold text-[#ea5b0c] hover:underline"
                >
                  {item.subject || "(без темы)"}
                </Link>
              </td>
              <td className="whitespace-nowrap px-3 py-3">{item.size ? Math.ceil(item.size / 1024) + " КБ" : "—"}</td>
              <td className="px-3 py-3"><StatusPill status="ready" label="read-only" /></td>
            </tr>)}
          </tbody>
        </table>
      </div> : <EmptyState>Письма по текущему фильтру не найдены.</EmptyState>}
    </Panel>
  </InternalShell>;
}
