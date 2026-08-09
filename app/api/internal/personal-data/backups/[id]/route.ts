import { NextRequest } from "next/server";
import { registerRestoreTest } from "@/lib/pd-admin/registers/repository";
import { pdStage4Mutation } from "@/lib/pd-admin/http/stage4-route";

export const runtime = "nodejs"; export const dynamic = "force-dynamic";
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) { const { id } = await params; return pdStage4Mutation(request, "REGISTER_RESTORE_TEST", (context, body) => registerRestoreTest(context, id, body)); }
