import { NextRequest } from "next/server";
import { closeIncident, getIncident, updateIncident } from "@/lib/pd-admin/incidents/repository";
import { pdStage4Get, pdStage4Mutation } from "@/lib/pd-admin/http/stage4-route";
import { PdStage4Error } from "@/lib/pd-admin/stage4/common";

export const runtime = "nodejs"; export const dynamic = "force-dynamic";
type Params = { params: Promise<{ id: string }> };
export async function GET(request: NextRequest, { params }: Params) { const { id } = await params; return pdStage4Get(request, "VIEW_INCIDENTS", (context) => getIncident(context, id)); }
export async function PATCH(request: NextRequest, { params }: Params) { const { id } = await params; return pdStage4Mutation(request, "VIEW_INCIDENTS", (context, body) => {
  if (body.action === "update") return updateIncident(context, id, body);
  if (body.action === "close") return closeIncident(context, id, body);
  throw new PdStage4Error("VALIDATION_ERROR");
}); }
