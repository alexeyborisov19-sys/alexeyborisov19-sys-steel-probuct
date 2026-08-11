import { NextRequest } from "next/server";
import { createIncident, listIncidents } from "@/lib/pd-admin/incidents/repository";
import { pdStage4Get, pdStage4Mutation } from "@/lib/pd-admin/http/stage4-route";

export const runtime = "nodejs"; export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) { return pdStage4Get(request, "VIEW_INCIDENTS", (context) => listIncidents(context, Number(request.nextUrl.searchParams.get("page") || 1))); }
export async function POST(request: NextRequest) { return pdStage4Mutation(request, "CREATE_INCIDENT", createIncident, 201); }
