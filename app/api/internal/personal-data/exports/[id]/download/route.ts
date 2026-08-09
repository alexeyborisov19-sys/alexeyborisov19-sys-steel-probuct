import { Readable } from "node:stream";
import { NextRequest } from "next/server";
import { openExportDownload } from "@/lib/pd-admin/export/service";
import { pdRouteError, requirePdApiContext } from "@/lib/pd-admin/http/route-context";
import { pdPrivateHeaders } from "@/lib/pd-admin/http/safe-response";

export const runtime = "nodejs"; export const dynamic = "force-dynamic";
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let context;
  try {
    context = requirePdApiContext(request, "DOWNLOAD_EXPORT"); const { id } = await params; const file = await openExportDownload(context, id);
    const stream = Readable.toWeb(file.handle.createReadStream({ autoClose: true })) as ReadableStream;
    return new Response(stream, { headers: pdPrivateHeaders({ "Content-Type": "application/zip", "Content-Length": String(file.size), "Content-Disposition": `attachment; filename="${file.fileName}"` }) });
  } catch (error) { return pdRouteError(error); } finally { context?.close(); }
}
