import type { ProductionOrder } from "@/lib/production-order/domain";
import { rebuildProductionOrderFromReport } from "@/lib/production-order/rebuild-production-order";
import {
  listInternalProductionReports,
  readInternalProductionReport,
} from "@/lib/server/instant-quote/private-production-report";

function notFoundError(projectId: string) {
  const error = new Error(`Производственный расчёт ${projectId} не найден.`) as NodeJS.ErrnoException;
  error.code = "ENOENT";
  return error;
}

/** Uses the latest stored report for the immutable project id. */
export async function readAndRebuildProductionOrderForProject(
  requestedOrder: ProductionOrder,
) {
  const rows = await listInternalProductionReports(1_000);
  const row = rows.find((item) => item.projectId === requestedOrder.projectId);
  if (!row) throw notFoundError(requestedOrder.projectId);
  const report = await readInternalProductionReport(row.fileName);
  return rebuildProductionOrderFromReport(report, requestedOrder);
}
