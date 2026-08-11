export class PdBodyError extends Error {
  readonly code = "PD_BODY_INVALID";
}

export async function readPdJsonBody<T>(request: Request, maximumBytes = 64 * 1024) {
  const length = Number(request.headers.get("content-length") || "0");
  if (Number.isFinite(length) && length > maximumBytes) throw new PdBodyError();
  const content = await request.text();
  if (Buffer.byteLength(content, "utf8") > maximumBytes) throw new PdBodyError();
  try {
    const parsed = JSON.parse(content) as T;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new PdBodyError();
    return parsed;
  } catch (error) {
    if (error instanceof PdBodyError) throw error;
    throw new PdBodyError();
  }
}
