import { ClientManufacturingWorkspace } from "@/components/ClientManufacturingWorkspace";
import { InternalPageHeader, InternalShell } from "@/components/pd-admin/InternalShell";
import { requirePdPageContext } from "@/lib/pd-admin/auth/page-context";

export const dynamic = "force-dynamic";

export default async function InternalProductionCalculatorPage() {
  const context = await requirePdPageContext("VIEW_DASHBOARD");
  const shell = { user: context.user, session: context.session, csrfToken: context.csrfToken };
  context.close();

  return (
    <InternalShell {...shell}>
      <InternalPageHeader
        eyebrow="Производственный калькулятор"
        title="Новый производственный расчёт"
        description="Загрузите CAD, проверьте геометрию, задайте материал, количество и полный техпроцесс. После расчёта откройте производственный отчёт для себестоимости, DFM и технологической ревизии."
      />
      <ClientManufacturingWorkspace mode="production" />
    </InternalShell>
  );
}
