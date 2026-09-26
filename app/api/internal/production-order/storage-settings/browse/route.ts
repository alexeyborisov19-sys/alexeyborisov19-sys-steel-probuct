import { NextRequest } from "next/server";
import { pdStage4Mutation } from "@/lib/pd-admin/http/stage4-route";
import { PdStage4Error } from "@/lib/pd-admin/stage4/common";
import {
  chooseProductionOrderStorageFolder,
  NativeFolderPickerUnavailableError,
} from "@/lib/server/production-order/native-folder-picker";
import { normalizeProductionOrderRoot } from "@/lib/server/production-order/storage-settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isLoopbackHost(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1" || hostname === "[::1]";
}

export async function POST(request: NextRequest) {
  return pdStage4Mutation(request, "VIEW_DASHBOARD", async () => {
    const allowRemote = process.env.STEEL_PRODUCT_NATIVE_FOLDER_PICKER_ALLOW_REMOTE === "true";
    if (!allowRemote && !isLoopbackHost(request.nextUrl.hostname)) {
      throw new PdStage4Error("BLOCKED");
    }

    try {
      const result = await chooseProductionOrderStorageFolder();
      if (result.status === "cancelled") return result;
      return { status: "selected" as const, path: normalizeProductionOrderRoot(result.path) };
    } catch (error) {
      if (error instanceof NativeFolderPickerUnavailableError) throw new PdStage4Error("BLOCKED");
      throw error;
    }
  });
}
