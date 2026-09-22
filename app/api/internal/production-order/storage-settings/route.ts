import { NextRequest } from "next/server";
import { pdStage4Get, pdStage4Mutation } from "@/lib/pd-admin/http/stage4-route";
import { PdStage4Error } from "@/lib/pd-admin/stage4/common";
import {
  readProductionOrderStorageSettings,
  saveProductionOrderStorageSettings,
} from "@/lib/server/production-order/storage-settings";
import { nativeFolderPickerSupported } from "@/lib/server/production-order/native-folder-picker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return pdStage4Get(request, "VIEW_DASHBOARD", async () => ({
    settings: await readProductionOrderStorageSettings(),
    nativePickerSupported: nativeFolderPickerSupported(),
  }));
}

export async function POST(request: NextRequest) {
  return pdStage4Mutation(request, "VIEW_DASHBOARD", async (context, body) => {
    if (typeof body.ordersRoot !== "string") throw new PdStage4Error("VALIDATION_ERROR");
    try {
      const settings = await saveProductionOrderStorageSettings({
        ordersRoot: body.ordersRoot,
        actor: {
          userId: context.user.id,
          displayName: context.user.displayName,
        },
      });
      return { settings };
    } catch (error) {
      if (error instanceof Error) throw new PdStage4Error("VALIDATION_ERROR");
      throw error;
    }
  });
}
