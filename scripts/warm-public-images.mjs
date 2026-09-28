// Warm only public first-screen images on the private candidate server.
// Sequential requests avoid competing with the live worker for encoder memory.
const base = process.env.IMAGE_WARMUP_BASE_URL;
if (!base || !/^http:\/\/127\.0\.0\.1:\d+$/.test(base)) {
  throw new Error("IMAGE_WARMUP_BASE_URL must name the private loopback candidate");
}
const started = Date.now();
let failures = 0;
for (const accept of ["image/avif", "image/webp"]) {
  for (const width of [640, 750, 828, 1080, 1200, 1920]) {
    if (Date.now() - started > 90000) {
      console.warn("Image warmup budget exhausted; remaining images will load on demand.");
      process.exitCode = 1;
      break;
    }
    const path = `/_next/image?url=%2Fimages%2Fweb%2Fhero-main.webp&w=${width}&q=75`;
    const requestStarted = Date.now();
    try {
      const response = await fetch(`${base}${path}`, {
        headers: { Accept: accept }, signal: AbortSignal.timeout(12000), redirect: "error",
      });
      if (!response.ok || !response.headers.get("content-type")?.startsWith("image/")) {
        await response.body?.cancel();
        throw new Error(`Unexpected image response: ${response.status}`);
      }
      const bytes = (await response.arrayBuffer()).byteLength;
      console.log(JSON.stringify({ width, accept, bytes, cache: response.headers.get("x-nextjs-cache"), ms: Date.now() - requestStarted }));
    } catch (error) {
      failures++;
      console.warn(`Image warmup failed (${width}, ${accept}): ${error.message}`);
    }
  }
}
if (failures) process.exitCode = 1;
