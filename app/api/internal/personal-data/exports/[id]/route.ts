import { NextRequest } from "next/server";
import { approveExport, buildExportArchive, createExportPreview, expireExportArchives, getExport, registerExportTransfer } from "@/lib/pd-admin/export/service";
import { pdStage4Get, pdStage4Mutation } from "@/lib/pd-admin/http/stage4-route";
import { PdStage4Error } from "@/lib/pd-admin/stage4/common";

export const runtime = "nodejs"; export const dynamic = "force-dynamic";
type Params = { params: Promise<{ id: string }> };
export async function GET(request: NextRequest, { params }: Params) { const { id } = await params; return pdStage4Get(request, "VIEW_EXPORTS", (context) => getExport(context, id)); }
export async function PATCH(request: NextRequest, { params }: Params) { const { id } = await params; return pdStage4Mutation(request, "VIEW_EXPORTS", (context, body) => {
  if (body.action === "preview") return createExportPreview(context, id, body.version);
  if (body.action === "approve") return approveExport(context, id, body.version);
  if (body.action === "build") return buildExportArchive(context, id, body.version);
  if (body.action === "transfer") return registerExportTransfer(context, id, body);
  if (body.action === "expire") return expireExportArchives(context);
  throw new PdStage4Error("VALIDATION_ERROR");
}); }
