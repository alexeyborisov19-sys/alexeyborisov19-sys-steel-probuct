import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductionOrderDraftEditor } from "@/components/production-order/ProductionOrderDraftEditor";
import { InternalPageHeader, InternalShell } from "@/components/pd-admin/InternalShell";
import { Panel } from "@/components/pd-admin/Ui";
import { requirePdPageContext } from "@/lib/pd-admin/auth/page-context";
import { readInternalProductionReport } from "@/lib/server/instant-quote/private-production-report";
import {
  productionOrderArtifactsFromReport,
  productionOrderCommercialByPartId,
} from "@/lib/server/production-order/calculation-adapter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function ProductionOrderFromCalculationPage({
  params,
}: {
  params: Promise<{ fileName: string }>;
}) {
  const context = await requirePdPageContext("VIEW_DASHBOARD");
  const shell = { user: context.user, session: context.session, csrfToken: context.csrfToken };
  const { fileName } = await params;
  const decodedFileName = decodeURIComponent(fileName);

  let report;
  try {
    report = await readInternalProductionReport(decodedFileName);
  } catch {
    context.close();
    notFound();
  }

  const snapshot = report.calculationInputSnapshot;
  const responsible = context.user.displayName;
  const artifacts = productionOrderArtifactsFromReport(report);
  const commercialByPartId = productionOrderCommercialByPartId(report);
  context.close();

  return <InternalShell {...shell}>
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <Link href={`/internal/production-calculations/${encodeURIComponent(decodedFileName)}`} className="text-sm text-steel-orange hover:underline">← Вернуться к расчёту</Link>
      <Link href="/internal/production-order/settings" className="text-sm text-white/55 hover:text-white">Настройка папки заказов</Link>
    </div>

    <InternalPageHeader
      eyebrow="КП → производственная заявка → папка заказа"
      title="Подготовка документов заказа"
      description={`Исходный расчёт: ${report.projectId} · сформирован ${new Date(report.generatedAt).toLocaleString("ru-RU")}`}
    />

    {snapshot ? <Panel title="Данные КП и производственной заявки">
      <ProductionOrderDraftEditor
        csrfToken={shell.csrfToken}
        calculationFileName={decodedFileName}
        project={snapshot.project}
        productionParametersByPartId={report.productionParametersByPartId}
        initialCreatedAt={new Date().toISOString()}
        initialResponsible={responsible}
        initialArtifacts={artifacts}
        commercialByPartId={commercialByPartId}
      />
    </Panel> : <Panel title="Исходные данные недоступны">
      <div className="border border-amber-400/20 bg-amber-400/[.04] p-4 text-sm leading-relaxed text-amber-100/80">
        Этот отчёт создан до введения полного снимка входных данных. Для автоматического формирования КП и заявки нужно повторно создать расчёт из исходных CAD-файлов.
      </div>
    </Panel>}
  </InternalShell>;
}
