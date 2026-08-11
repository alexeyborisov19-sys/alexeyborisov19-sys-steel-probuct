import Link from "next/link";
import { notFound } from "next/navigation";
import { EditableComment, LeadRevealPanel, LeadWorkflowPanel } from "@/components/pd-admin/ActionControls";
import { InternalPageHeader, InternalShell } from "@/components/pd-admin/InternalShell";
import { EmptyState, Panel, StatusPill } from "@/components/pd-admin/Ui";
import { requirePdPageContext } from "@/lib/pd-admin/auth/page-context";
import { hasPdPermission } from "@/lib/pd-admin/auth/permissions";
import { activeManagers, getMaskedLead } from "@/lib/pd-admin/leads/repository";

export const dynamic = "force-dynamic";

export default async function LeadPage({ params }: { params: Promise<{ requestId: string }> }) {
  const { requestId } = await params;
  const context = await requirePdPageContext("VIEW_MASKED_LEADS");
  const lead = await getMaskedLead(context, requestId).catch(() => null);
  if (!lead) { context.close(); notFound(); }
  const shell = { user: context.user, session: context.session, csrfToken: context.csrfToken };
  const managers = hasPdPermission(context.user.role, "ASSIGN_LEAD") ? activeManagers(context.database) : [];
  const canWorkflow = hasPdPermission(context.user.role, "CHANGE_WORKFLOW");
  const canAssign = hasPdPermission(context.user.role, "ASSIGN_LEAD");
  const canComment = hasPdPermission(context.user.role, "ADD_COMMENT");
  const canEditOwnComment = hasPdPermission(context.user.role, "EDIT_OWN_COMMENT");
  const canRetention = hasPdPermission(context.user.role, "CHANGE_RETENTION");
  context.close();
  return <InternalShell {...shell}>
    <InternalPageHeader eyebrow="Карточка заявки" title="Заявка" description="Технический идентификатор отображается только внутри закрытой системы." />
    <Panel><div className="flex flex-wrap items-center justify-between gap-3"><b className="text-[#ea5b0c]">{lead.summary.requestId}</b><div className="flex gap-2"><StatusPill status="unknown" label={lead.summary.internalStatus} /><StatusPill status={lead.summary.integrityStatus === "OK" ? "ready" : "warning"} label={lead.summary.integrityStatus} /></div></div></Panel>
    <div className="mt-4 grid gap-4 xl:grid-cols-2">
      <Panel title="Маскированные данные"><dl className="grid gap-3 text-sm sm:grid-cols-2">{Object.entries(lead.masked).map(([key, value]) => <div key={key} className="border border-white/10 p-3"><dt className="text-[10px] uppercase text-white/40">{key}</dt><dd className="mt-1">{value}</dd></div>)}</dl></Panel>
      <Panel title="Служебные сведения"><dl className="space-y-2 text-sm"><div className="flex justify-between"><dt className="text-white/40">Создана</dt><dd>{new Date(lead.summary.createdAt).toLocaleString("ru-RU")}</dd></div><div className="flex justify-between"><dt className="text-white/40">Источник</dt><dd>{lead.summary.source}</dd></div><div className="flex justify-between"><dt className="text-white/40">Ответственный</dt><dd>{lead.summary.assignedDisplayName || "Не назначен"}</dd></div><div className="flex justify-between"><dt className="text-white/40">Срок хранения до</dt><dd>{new Date(lead.summary.expiresAt).toLocaleDateString("ru-RU")}</dd></div><div className="flex justify-between"><dt className="text-white/40">Продление до</dt><dd>{lead.summary.retentionOverrideUntil ? new Date(lead.summary.retentionOverrideUntil).toLocaleDateString("ru-RU") : "Нет"}</dd></div><div className="flex justify-between"><dt className="text-white/40">Legal hold</dt><dd>{lead.summary.legalHoldActive ? "Да" : "Нет"}</dd></div></dl></Panel>
    </div>
    {lead.canReveal ? <Panel title="Раскрытие данных" className="mt-4"><LeadRevealPanel csrfToken={shell.csrfToken} requestId={requestId} /></Panel> : null}
    {canWorkflow || canAssign || canComment || canRetention ? <Panel title="Работа с заявкой" className="mt-4"><LeadWorkflowPanel csrfToken={shell.csrfToken} requestId={requestId} currentStatus={lead.summary.internalStatus} managers={managers} canAssign={canAssign} canComment={canComment} canRetention={canRetention} retentionOverrideUntil={lead.summary.retentionOverrideUntil} /></Panel> : null}
    <Panel title="Служебные комментарии" className="mt-4">{lead.comments.length ? <div className="space-y-3">{lead.comments.map((comment) => canEditOwnComment && comment.author_user_id === shell.user.id ? <EditableComment key={comment.id} csrfToken={shell.csrfToken} requestId={requestId} commentId={comment.id} author={comment.author_name} createdAt={comment.created_at} body={comment.body} /> : <article key={comment.id} className="border border-white/10 p-3"><div className="text-[10px] text-white/40">{comment.author_name} · {new Date(comment.created_at).toLocaleString("ru-RU")}</div><p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{comment.body}</p></article>)}</div> : <EmptyState>Комментариев нет.</EmptyState>}</Panel>
    <Panel title="Вложения" className="mt-4">{lead.attachments.length ? <div className="space-y-2">{lead.attachments.map((file) => <div key={file.storageId} className="grid gap-2 border border-white/10 p-3 text-xs sm:grid-cols-[1fr_auto_auto_auto]"><span>{file.safeName}</span><span>{Math.ceil(file.size / 1024)} КБ</span><StatusPill status={file.antivirus === "clean" ? "ready" : file.antivirus === "blocked" ? "critical" : "warning"} label={file.antivirus} /><Link prefetch={false} href={`/api/internal/personal-data/leads/${requestId}/attachments/${file.storageId}`} className="text-[#ea5b0c]">Скачать</Link></div>)}</div> : <EmptyState>{lead.canViewAttachments ? "Вложений нет." : "Просмотр вложений недоступен для этой роли."}</EmptyState>}</Panel>
  </InternalShell>;
}
