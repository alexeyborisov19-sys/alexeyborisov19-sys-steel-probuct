import { NextRequest } from "next/server";
import { parseProductionOrder } from "@/lib/production-order/parse-production-order";
import { pdStage4Mutation } from "@/lib/pd-admin/http/stage4-route";
import { PdStage4Error } from "@/lib/pd-admin/stage4/common";
import {
  createOrUpdateProductionOrderPackage,
  ProductionOrderPackageConflictError,
} from "@/lib/server/production-order/package-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  return pdStage4Mutation(request, "VIEW_DASHBOARD", async (_context, body) => {
    let order;
    try {
      order = parseProductionOrder(body.order);
    } catch {
      throw new PdStage4Error("VALIDATION_ERROR");
    }

    try {
      const result = await createOrUpdateProductionOrderPackage(order);
      return {
        orderId: order.orderId,
        created: result.created,
        changed: result.changed,
        folderPath: result.plan.orderDirectory,
        manifestPath: result.plan.manifestPath,
        quotePdfPath: result.plan.quotePdfPath,
        productionOrderPdfPath: result.plan.productionOrderPdfPath,
      };
    } catch (error) {
      if (error instanceof ProductionOrderPackageConflictError) throw new PdStage4Error("CONFLICT");
      if (error instanceof Error && /не настроен|not configured/i.test(error.message)) throw new PdStage4Error("BLOCKED");
      throw error;
    }
  });
}
