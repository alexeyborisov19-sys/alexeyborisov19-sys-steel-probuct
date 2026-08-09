import { NextRequest } from "next/server";
import { createAuthorityRequest, listAuthorityRequests } from "@/lib/pd-admin/authority-requests/repository";
import { pdStage4Get, pdStage4Mutation } from "@/lib/pd-admin/http/stage4-route";

export const runtime = "nodejs"; export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) { return pdStage4Get(request, "VIEW_AUTHORITY_REQUESTS", (context) => listAuthorityRequests(context, Number(request.nextUrl.searchParams.get("page") || 1))); }
export async function POST(request: NextRequest) { return pdStage4Mutation(request, "CREATE_AUTHORITY_REQUEST", createAuthorityRequest, 201); }
