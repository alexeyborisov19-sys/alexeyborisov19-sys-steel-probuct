import { Readable } from "node:stream";
import { NextRequest } from "next/server";
import { attachmentForDownload } from "@/lib/pd-admin/leads/repository";
import { pdRouteError, requirePdApiContext } from "@/lib/pd-admin/http/route-context";
import { pdPrivateHeaders, pdSafeError } from "@/lib/pd-admin/http/safe-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ requestId: string; storageId: string }> },
) {
  let context;
  try {
    context = requirePdApiContext(request, "DOWNLOAD_ATTACHMENT");
    const { requestId, storageId } = await params;
    const file = await attachmentForDownload(context, requestId, storageId);
    if (!file) return pdSafeError("NOT_FOUND", 404);
    const stream = file.handle.createReadStream({ autoClose: true });
    const headers = pdPrivateHeaders({
      "Content-Type": "application/octet-stream",
      "Content-Length": String(file.size),
      "Content-Disposition": `attachment; filename="attachment"; filename*=UTF-8''${encodeURIComponent(file.downloadName)}`,
      "X-Antivirus-Status": file.antivirus,
    });
    return new Response(Readable.toWeb(stream) as ReadableStream, { status: 200, headers });
  } catch (error) {
    if (error instanceof Error && error.message === "STEP_UP_REQUIRED") return pdSafeError("STEP_UP_REQUIRED", 403);
    if (error instanceof Error && error.message === "MANAGER_NOT_ASSIGNED") return pdSafeError("PERMISSION_DENIED", 403);
    return pdRouteError(error);
  } finally {
    context?.close();
  }
}
