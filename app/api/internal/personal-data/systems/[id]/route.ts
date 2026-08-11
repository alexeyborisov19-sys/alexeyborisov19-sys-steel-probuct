import { NextRequest } from "next/server";
import { updateSystem } from "@/lib/pd-admin/registers/repository";
import { pdStage4Mutation } from "@/lib/pd-admin/http/stage4-route";

export const runtime = "nodejs"; export const dynamic = "force-dynamic";
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) { const { id } = await params; return pdStage4Mutation(request, "MANAGE_SYSTEMS_REGISTRY", (context, body) => updateSystem(context, id, body)); }
