import { NextRequest } from "next/server";
import { closeAuthorityRequest, extendAuthorityDeadline, getAuthorityRequest, updateAuthorityRequest, verifyAuthorityRequest } from "@/lib/pd-admin/authority-requests/repository";
import { pdStage4Get, pdStage4Mutation } from "@/lib/pd-admin/http/stage4-route";
import { PdStage4Error } from "@/lib/pd-admin/stage4/common";

export const runtime = "nodejs"; export const dynamic = "force-dynamic";
type Params = { params: Promise<{ id: string }> };
export async function GET(request: NextRequest, { params }: Params) { const { id } = await params; return pdStage4Get(request, "VIEW_AUTHORITY_REQUESTS", (context) => getAuthorityRequest(context, id)); }
export async function PATCH(request: NextRequest, { params }: Params) { const { id } = await params; return pdStage4Mutation(request, "VIEW_AUTHORITY_REQUESTS", (context, body) => {
  if (body.action === "update") return updateAuthorityRequest(context, id, body);
  if (body.action === "verify") return verifyAuthorityRequest(context, id, body);
  if (body.action === "extend") return extendAuthorityDeadline(context, id, body);
  if (body.action === "close") return closeAuthorityRequest(context, id, body);
  throw new PdStage4Error("VALIDATION_ERROR");
}); }
