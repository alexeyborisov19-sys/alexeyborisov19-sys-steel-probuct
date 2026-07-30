export class PayloadTooLargeError extends Error {
  constructor() {
    super("Request payload is too large");
    this.name = "PayloadTooLargeError";
  }
}

export async function readRequestBytes(request: Request, maximumBytes: number) {
  const declaredLength = Number(request.headers.get("content-length") || "0");
  if (Number.isFinite(declaredLength) && declaredLength > maximumBytes) {
    throw new PayloadTooLargeError();
  }

  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > maximumBytes) {
      await reader.cancel();
      throw new PayloadTooLargeError();
    }
    chunks.push(value);
  }

  const result = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}

export async function readJsonBody<T>(request: Request, maximumBytes: number): Promise<T> {
  const bytes = await readRequestBytes(request, maximumBytes);
  if (!bytes.length) throw new SyntaxError("Empty JSON body");
  return JSON.parse(new TextDecoder().decode(bytes)) as T;
}

export async function readMultipartForm(request: Request, maximumBytes: number) {
  const bytes = await readRequestBytes(request, maximumBytes);
  const clone = new Request(request.url, {
    method: "POST",
    headers: request.headers,
    body: bytes,
  });
  return clone.formData();
}
