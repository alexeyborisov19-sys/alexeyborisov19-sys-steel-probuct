import Link from "next/link";
import { InternalPageHeader, InternalShell } from "@/components/pd-admin/InternalShell";
import { Panel, StatusPill } from "@/components/pd-admin/Ui";
import { requirePdPageContext } from "@/lib/pd-admin/auth/page-context";
import { getMailboxMessage } from "@/lib/pd-admin/mail/service";

export const dynamic = "force-dynamic";

function displayDate(value: string) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toLocaleString("ru-RU") : value || "Без даты";
}

export default async function MailMessagePage({
  params,
}: {
  params: Promise<{ uid: string }>;
}) {
  const { uid } = await params;
  const context = await requirePdPageContext("VIEW_FULL_LEAD");
  const data = await getMailboxMessage(context, uid);
  const shell = { user: context.user, session: context.session, csrfToken: context.csrfToken };
  context.close();

  const { message, thread, analysis } = data;

  return <InternalShell {...shell}>
    <div className="mb-4">
      <Link prefetch={false} href="/internal/personal-data/mail" className="text-xs font-semibold text-[#ea5b0c] hover:underline">
        ← Входящие
      </Link>
    </div>
    <InternalPageHeader
      eyebrow="Письмо"
      title={message.subject || "(без темы)"}
      description="Письмо открыто через read-only IMAP. Просмотр не меняет состояние ящика."
    />

    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,.75fr)]">
      <div className="space-y-6">
        <Panel title="Сообщение">
          <dl className="grid gap-3 text-sm sm:grid-cols-[130px_1fr]">
            <dt className="text-white/40">Дата</dt><dd>{displayDate(message.date)}</dd>
            <dt className="text-white/40">От</dt><dd className="break-words">{message.from || "Не указан"}</dd>
            <dt className="text-white/40">Кому</dt><dd className="break-words">{message.to || "Не указан"}</dd>
            {message.cc ? <><dt className="text-white/40">Копия</dt><dd className="break-words">{message.cc}</dd></> : null}
            <dt className="text-white/40">Message-ID</dt><dd className="break-all text-xs text-white/55">{message.messageId || "—"}</dd>
            <dt className="text-white/40">Режим</dt><dd><StatusPill status="ready" label="read-only" /></dd>
          </dl>
          <div className="mt-5 border-t border-white/10 pt-5">
            <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-6 text-white/80">{message.text || "Текстовая часть письма отсутствует."}</pre>
          </div>
        </Panel>

        <Panel title={"Вложения · " + message.attachments.length}>
          {message.attachments.length ? <div className="space-y-4">
            {message.attachments.map((item) => <div key={item.index} className="border border-white/10 bg-black/20 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">{item.filename}</div>
                  <div className="mt-1 text-xs text-white/40">{item.contentType} · {Math.max(1, Math.ceil(item.size / 1024))} КБ</div>
                </div>
                <StatusPill status={item.textPreview ? "ready" : "unknown"} label={item.textPreview ? "текст извлечён" : "без текстового превью"} />
              </div>
              {item.textPreview ? <pre className="mt-4 max-h-[420px] overflow-auto whitespace-pre-wrap break-words border-t border-white/10 pt-4 font-sans text-xs leading-5 text-white/65">{item.textPreview}</pre> : null}
            </div>)}
          </div> : <p className="text-sm text-white/45">Вложений нет.</p>}
          <p className="mt-4 text-xs leading-5 text-white/40">
            Текстовое превью извлекается локально для текстовых файлов и небольших PDF. Файлы не отправляются во внешние AI-сервисы.
          </p>
        </Panel>

        <Panel title={"Цепочка · " + thread.length}>
          <div className="space-y-3">
            {thread.map((item) => <Link
              key={item.uid}
              prefetch={false}
              href={"/internal/personal-data/mail/" + item.uid}
              className={"block border px-4 py-3 transition hover:border-[#ea5b0c] " + (item.uid === message.uid ? "border-[#ea5b0c]/50 bg-[#ea5b0c]/5" : "border-white/10 bg-black/15")}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-semibold text-white/80">{item.from || "Не указан"}</span>
                <span className="text-white/40">{displayDate(item.date)}</span>
              </div>
              <div className="mt-1 text-xs text-white/55">{item.subject || "(без темы)"}</div>
            </Link>)}
          </div>
        </Panel>
      </div>

      <div className="space-y-6">
        <Panel title="Локальный разбор">
          <div className="text-sm font-semibold text-white">{analysis.category}</div>
          <ul className="mt-4 space-y-2 text-xs leading-5 text-white/60">
            {analysis.signals.map((item) => <li key={item} className="border-l border-white/15 pl-3">{item}</li>)}
          </ul>
          <p className="mt-4 text-xs leading-5 text-white/40">
            Разбор выполняется локальными правилами на сервере. Содержимое письма не передаётся внешней модели.
          </p>
        </Panel>

        <Panel title="Черновик ответа">
          <pre className="whitespace-pre-wrap break-words border border-white/10 bg-black/20 p-4 font-sans text-sm leading-6 text-white/80">{analysis.draft}</pre>
          <p className="mt-3 text-xs leading-5 text-amber-200/70">Черновик не отправляется автоматически и не сохраняется в почтовом ящике.</p>
        </Panel>
      </div>
    </div>
  </InternalShell>;
}
