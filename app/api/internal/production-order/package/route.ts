import { NextRequest } from "next/server";
import { parseProductionOrder } from "@/lib/production-order/parse-production-order";
import { pdStage4Mutation } from "@/lib/pd-admin/http/stage4-route";
import { PdStage4Error } from "@/lib/pd-admin/stage4/common";
import {
  createOrUpdateProductionOrderPackage,
  ProductionOrderPackageConflictError,
} from "@/lib/server/production-order/package-service";
import { appendProductionOrderJournal } from "@/lib/server/production-order/journal";
import {
  generateProductionOrderDocuments,
  PdfRendererUnavailableError,
} from "@/lib/server/production-order/pdf-documents";
import { resolveProductionOrderArtifactSources } from "@/lib/server/production-order/source-artifacts";
import { copyProductionOrderArtifacts } from "@/lib/server/production-order/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  return pdStage4Mutation(request, "VIEW_DASHBOARD", async (context, body) => {
    let order;
    try {
      order = parseProductionOrder(body.order);
    } catch {
      throw new PdStage4Error("VALIDATION_ERROR");
    }

    try {
      const result = await createOrUpdateProductionOrderPackage(order);
      const actor = {
        userId: context.user.id,
        displayName: context.user.displayName,
      };
      await appendProductionOrderJournal(result.plan, {
        event: result.created ? "package-created" : result.changed ? "package-updated" : "package-unchanged",
        orderId: order.orderId,
        revision: result.revision,
        actor,
        details: {
          folderPath: result.plan.orderDirectory,
          changed: result.changed,
        },
      });

      const warnings: string[] = [];
      let artifactStatus: "copied" | "not-requested" | "failed" = order.artifacts.length ? "failed" : "not-requested";
      let copiedArtifacts: Array<{ artifactId: string; destinationPath: string }> = [];
      if (order.artifacts.length) {
        try {
          const sources = await resolveProductionOrderArtifactSources(order);
          copiedArtifacts = await copyProductionOrderArtifacts(order, result.plan, sources);
          artifactStatus = "copied";
          await appendProductionOrderJournal(result.plan, {
            event: "artifacts-copied",
            orderId: order.orderId,
            revision: result.revision,
            actor,
            details: { count: copiedArtifacts.length },
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Не удалось скопировать исходные файлы.";
          warnings.push(message);
          await appendProductionOrderJournal(result.plan, {
            event: "artifacts-failed",
            orderId: order.orderId,
            revision: result.revision,
            actor,
            details: { message },
          });
        }
      }

      let documentStatus: "generated" | "unavailable" | "failed" = "failed";
      try {
        await generateProductionOrderDocuments({
          order,
          plan: result.plan,
          revision: result.revision,
        });
        documentStatus = "generated";
        await appendProductionOrderJournal(result.plan, {
          event: "documents-generated",
          orderId: order.orderId,
          revision: result.revision,
          actor,
          details: {
            quotePdfPath: result.plan.quotePdfPath,
            productionOrderPdfPath: result.plan.productionOrderPdfPath,
          },
        });
      } catch (error) {
        const unavailable = error instanceof PdfRendererUnavailableError;
        documentStatus = unavailable ? "unavailable" : "failed";
        const message = unavailable
          ? "Папка и исходные файлы сохранены, но для автоматического PDF нужен установленный Chrome, Edge или Chromium."
          : "Папка создана, но при формировании PDF произошла ошибка. Повторите создание пакета.";
        warnings.push(message);
        await appendProductionOrderJournal(result.plan, {
          event: unavailable ? "documents-unavailable" : "documents-failed",
          orderId: order.orderId,
          revision: result.revision,
          actor,
          details: { message },
        });
      }

      return {
        orderId: order.orderId,
        created: result.created,
        changed: result.changed,
        revision: result.revision,
        folderPath: result.plan.orderDirectory,
        manifestPath: result.plan.manifestPath,
        journalPath: result.plan.journalPath,
        revisionDirectory: result.revisionDirectory,
        quotePdfPath: result.plan.quotePdfPath,
        productionOrderPdfPath: result.plan.productionOrderPdfPath,
        documentStatus,
        artifactStatus,
        copiedArtifacts,
        warnings,
      };
    } catch (error) {
      if (error instanceof ProductionOrderPackageConflictError) throw new PdStage4Error("CONFLICT");
      if (error instanceof Error && /не настроен|not configured/i.test(error.message)) throw new PdStage4Error("BLOCKED");
      throw error;
    }
  });
}
