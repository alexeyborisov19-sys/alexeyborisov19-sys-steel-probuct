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

/** Parse through a byte-counting stream instead of making an extra full-body
 * buffer. FormData still materializes files; existing upload inspection and
 * file limits remain responsible for checking the parsed entries. */
export async function readMultipartForm(request: Request, maximumBytes: number) {
  const declaredLength = Number(request.headers.get("content-length") || "0");
  if (Number.isFinite(declaredLength) && declaredLength > maximumBytes) {
    throw new PayloadTooLargeError();
  }

  let receivedBytes = 0;
  let sizeError: PayloadTooLargeError | undefined;
  const limitedBody = request.body?.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      receivedBytes += chunk.byteLength;
      if (receivedBytes > maximumBytes) {
        sizeError = new PayloadTooLargeError();
        controller.error(sizeError);
        return;
      }
      controller.enqueue(chunk);
    },
  }));

  const init: RequestInit & { duplex: "half" } = {
    method: "POST",
    headers: request.headers,
    body: limitedBody,
    duplex: "half",
  };
  let parserRequest: Request | undefined;
  try {
    parserRequest = new Request(request.url, init);
    return await parserRequest.formData();
  } catch (error) {
    // Keep the existing 413 classification even if a parser wraps a stream error.
    if (sizeError) throw sizeError;
    throw error;
  } finally {
    // A parser may reject Content-Type before consuming the stream. Stop the
    // upstream request in that case; do not leave it locked and waiting.
    const remainingBody = parserRequest?.body ?? limitedBody;
    if (remainingBody && !remainingBody.locked) {
      await remainingBody.cancel().catch(() => undefined);
    }
  }
}
