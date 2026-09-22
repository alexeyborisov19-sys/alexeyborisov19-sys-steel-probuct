import { ProductionOrderStorageSettings } from "@/components/production-order/ProductionOrderStorageSettings";
import { InternalPageHeader, InternalShell } from "@/components/pd-admin/InternalShell";
import { Panel } from "@/components/pd-admin/Ui";
import { requirePdPageContext } from "@/lib/pd-admin/auth/page-context";
import { nativeFolderPickerSupported } from "@/lib/server/production-order/native-folder-picker";
import { readProductionOrderStorageSettings } from "@/lib/server/production-order/storage-settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function ProductionOrderSettingsPage() {
  const context = await requirePdPageContext("VIEW_DASHBOARD");
  const shell = { user: context.user, session: context.session, csrfToken: context.csrfToken };
  const settings = await readProductionOrderStorageSettings();
  const pickerSupported = nativeFolderPickerSupported();
  context.close();

  return <InternalShell {...shell}>
    <InternalPageHeader
      eyebrow="Модуль производственных заказов"
      title="Папка для КП и производственных заявок"
      description="Выберите или укажите корневую папку. Система проверит права на запись и сохранит путь для следующих запусков."
    />
    <Panel title="Хранилище заказов">
      <ProductionOrderStorageSettings
        csrfToken={shell.csrfToken}
        initialSettings={settings}
        nativePickerSupported={pickerSupported}
      />
    </Panel>
  </InternalShell>;
}
