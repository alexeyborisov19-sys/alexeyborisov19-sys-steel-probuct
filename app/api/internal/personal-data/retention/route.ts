import { NextRequest } from "next/server";
import { retentionDashboard } from "@/lib/pd-admin/retention/service";
import { pdStage4Get } from "@/lib/pd-admin/http/stage4-route";

export const runtime = "nodejs"; export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) { return pdStage4Get(request, "VIEW_RETENTION", retentionDashboard); }
