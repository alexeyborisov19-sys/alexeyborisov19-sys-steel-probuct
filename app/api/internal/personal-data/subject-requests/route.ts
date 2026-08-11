import { NextRequest } from "next/server";
import { createSubjectRequest, listSubjectRequests } from "@/lib/pd-admin/subject-requests/repository";
import { pdStage4Get, pdStage4Mutation } from "@/lib/pd-admin/http/stage4-route";

export const runtime = "nodejs"; export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) { return pdStage4Get(request, "VIEW_SUBJECT_REQUESTS", (context) => listSubjectRequests(context, Number(request.nextUrl.searchParams.get("page") || 1))); }
export async function POST(request: NextRequest) { return pdStage4Mutation(request, "CREATE_SUBJECT_REQUEST", createSubjectRequest, 201); }
