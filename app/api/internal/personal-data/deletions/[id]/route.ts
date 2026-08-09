import { NextRequest } from "next/server";
import { approveDeletion, executeDeletion, getDeletionJob, verifyDeletion } from "@/lib/pd-admin/retention/service";
import { pdStage4Get, pdStage4Mutation } from "@/lib/pd-admin/http/stage4-route";
import { PdStage4Error } from "@/lib/pd-admin/stage4/common";

export const runtime = "nodejs"; export const dynamic = "force-dynamic";
type Params = { params: Promise<{ id: string }> };
export async function GET(request: NextRequest, { params }: Params) { const { id } = await params; return pdStage4Get(request, "VIEW_RETENTION", (context) => getDeletionJob(context, id)); }
export async function PATCH(request: NextRequest, { params }: Params) { const { id } = await params; return pdStage4Mutation(request, "VIEW_RETENTION", (context, body) => {
  if (body.action === "approve") return approveDeletion(context, id, body);
  if (body.action === "execute") return executeDeletion(context, id, body.version);
  if (body.action === "verify") return verifyDeletion(context, id, body.version);
  throw new PdStage4Error("VALIDATION_ERROR");
}); }
