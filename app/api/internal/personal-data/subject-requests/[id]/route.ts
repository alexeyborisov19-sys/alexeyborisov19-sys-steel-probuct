import { NextRequest } from "next/server";
import { closeSubjectRequest, extendSubjectDeadline, getSubjectRequest, updateSubjectRequest, verifySubjectIdentity } from "@/lib/pd-admin/subject-requests/repository";
import { pdStage4Get, pdStage4Mutation } from "@/lib/pd-admin/http/stage4-route";
import { PdStage4Error } from "@/lib/pd-admin/stage4/common";

export const runtime = "nodejs"; export const dynamic = "force-dynamic";
type Params = { params: Promise<{ id: string }> };
export async function GET(request: NextRequest, { params }: Params) { const { id } = await params; return pdStage4Get(request, "VIEW_SUBJECT_REQUESTS", (context) => getSubjectRequest(context, id)); }
export async function PATCH(request: NextRequest, { params }: Params) { const { id } = await params; return pdStage4Mutation(request, "VIEW_SUBJECT_REQUESTS", (context, body) => {
  if (body.action === "update") return updateSubjectRequest(context, id, body);
  if (body.action === "verifyIdentity") return verifySubjectIdentity(context, id, body);
  if (body.action === "extend") return extendSubjectDeadline(context, id, body);
  if (body.action === "close") return closeSubjectRequest(context, id, body);
  throw new PdStage4Error("VALIDATION_ERROR");
}); }
