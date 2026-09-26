import { NextRequest } from "next/server";
import { parseProductionOrder } from "@/lib/production-order/parse-production-order";
import { pdStage4Mutation } from "@/lib/pd-admin/http/stage4-route";
import { PdStage4Error } from "@/lib/pd-admin/stage4/common";
import {
  loadProductionOrderBitrixConfig,
  upsertProductionOrderDeal,
} from "@/lib/server/production-order/bitrix-deal";
import { appendProductionOrderJournal } from "@/lib/server/production-order/journal";
import { readAndRebuildProductionOrderForProject } from "@/lib/server/production-order/order-from-report";
import {
  createOrUpdateProductionOrderPackage,
  ProductionOrderPackageConflictError,
} from "@/lib/server/production-order/package-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  return pdStage4Mutation(request, "VIEW_DASHBOARD", async (context, body) => {
    let requestedOrder;
    try {
      requestedOrder = parseProductionOrder(body.order);
    } catch {
      throw new PdStage4Error("VALIDATION_ERROR");
    }

    let order;
    try {
      order = await readAndRebuildProductionOrderForProject(requestedOrder);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") throw new PdStage4Error("NOT_FOUND");
      throw new PdStage4Error("VALIDATION_ERROR");
    }

    const config = loadProductionOrderBitrixConfig();
    if (!config) throw new PdStage4Error("BLOCKED");

    try {
      const packageResult = await createOrUpdateProductionOrderPackage(order);
      const actor = {
        userId: context.user.id,
        displayName: context.user.displayName,
      };
      try {
        const deal = await upsertProductionOrderDeal(
          config,
          order,
          packageResult.plan.orderDirectory,
        );
        await appendProductionOrderJournal(packageResult.plan, {
          event: deal.created ? "bitrix-created" : "bitrix-updated",
          orderId: order.orderId,
          revision: packageResult.revision,
          actor,
          details: {
            dealId: deal.dealId,
            folderPath: packageResult.plan.orderDirectory,
          },
        });
        return {
          dealId: deal.dealId,
          created: deal.created,
          folderPath: packageResult.plan.orderDirectory,
          revision: packageResult.revision,
        };
      } catch (error) {
        await appendProductionOrderJournal(packageResult.plan, {
          event: "bitrix-failed",
          orderId: order.orderId,
          revision: packageResult.revision,
          actor,
          details: {
            message: error instanceof Error ? error.message.slice(0, 500) : "Bitrix24 request failed",
          },
        });
        throw error;
      }
    } catch (error) {
      if (error instanceof ProductionOrderPackageConflictError) throw new PdStage4Error("CONFLICT");
      if (error instanceof Error && /не настроен|not configured/i.test(error.message)) throw new PdStage4Error("BLOCKED");
      throw error;
    }
  });
}
