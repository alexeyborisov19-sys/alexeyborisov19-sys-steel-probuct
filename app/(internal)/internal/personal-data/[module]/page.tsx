import { notFound } from "next/navigation";
import { InternalPageHeader, InternalShell } from "@/components/pd-admin/InternalShell";
import { Panel, StatusPill } from "@/components/pd-admin/Ui";
import { requirePdPageContext } from "@/lib/pd-admin/auth/page-context";

export const dynamic = "force-dynamic";

const futureModules: Record<string, string> = {
  "subject-requests": "Обращения субъектов",
  exports: "Официальные выгрузки",
  deletions: "Удаление",
  incidents: "Инциденты",
  backups: "Резервные копии",
  systems: "Реестр систем",
  "legal-documents": "Юридические документы",
};

export default async function FutureModulePage({ params }: { params: Promise<{ module: string }> }) {
  const slug = (await params).module; const title = futureModules[slug]; if (!title) notFound();
  const context = await requirePdPageContext("VIEW_DASHBOARD"); const shell = { user: context.user, session: context.session, csrfToken: context.csrfToken }; context.close();
  return <InternalShell {...shell}><InternalPageHeader eyebrow="Следующий этап" title={title} description="Раздел пока не выполняет никаких операций и не создаёт фиктивных журналов." /><Panel><div className="flex items-center gap-3"><StatusPill status="disabled" label="не реализовано" /><p className="text-sm text-white/55">Будет реализовано на следующем этапе.</p></div></Panel></InternalShell>;
}
