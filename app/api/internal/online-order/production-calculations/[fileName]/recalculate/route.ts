import { productionAccessEnvironment } from "@/lib/server/production-access/environment";
import { NextRequest } from "next/server";
import { summarizeProjectCalculationCompleteness } from "@/lib/instant-quote/calculation-completeness";
import { parseInternalCalculationRevisionRequest } from "@/lib/instant-quote/internal-revision-request";
import { pdStage4Mutation } from "@/lib/pd-admin/http/stage4-route";
import {
  recalculateInternalProductionReport,
  type PartFactualRevisionPatch,
} from "@/lib/server/instant-quote/recalculate-production-report";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ fileName: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const { fileName } = await params;
  return pdStage4Mutation(request, "VIEW_DASHBOARD", async (context, body) => {
    const parsed = parseInternalCalculationRevisionRequest(body);
    const factualByPartId: Record<string, PartFactualRevisionPatch> = {};
    const powderSidesByPartId: Record<string, 1 | 2 | null> = {};

    for (const [partId, patch] of Object.entries(parsed.parts)) {
      const factual: PartFactualRevisionPatch = {};
      if (Object.prototype.hasOwnProperty.call(patch, "bendCount")) factual.bendCount = patch.bendCount;
      if (Object.prototype.hasOwnProperty.call(patch, "weldLengthM")) factual.weldLengthM = patch.weldLengthM;
      if (Object.prototype.hasOwnProperty.call(patch, "powderAreaM2")) factual.powderAreaM2 = patch.powderAreaM2;
      if (Object.prototype.hasOwnProperty.call(patch, "assemblyMinutes")) factual.assemblyMinutes = patch.assemblyMinutes;
      if (Object.prototype.hasOwnProperty.call(patch, "surfacePreparationAreaM2")) factual.surfacePreparationAreaM2 = patch.surfacePreparationAreaM2;
      if (Object.keys(factual).length) factualByPartId[partId] = factual;
      if (Object.prototype.hasOwnProperty.call(patch, "powderSides")) powderSidesByPartId[partId] = patch.powderSides ?? null;
    }

    const result = await recalculateInternalProductionReport(
      decodeURIComponent(fileName),
      {
        reason: parsed.reason,
        internalNote: parsed.internalNote,
        factualByPartId,
        powderSidesByPartId,
        changedByUserId: context.user.id,
        changedByDisplayName: context.user.displayName,
      },
    );
    const readiness = summarizeProjectCalculationCompleteness(
      result.report.calculation,
      result.report.productionParametersByPartId,
    );

    return {
      fileName: result.fileName,
      reportId: result.report.reportId,
      projectId: result.report.projectId,
      readiness: {
        scorePct: readiness.scorePct,
        status: readiness.status,
        readyParts: readiness.readyParts,
        reviewParts: readiness.reviewParts,
        blockedParts: readiness.blockedParts,
      },
    };
  }, 200, productionAccessEnvironment());
}