import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import test from "node:test";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));

test("IndexNow derives commercial URLs from sitemap priority instead of a hard-coded list", async () => {
  let submittedBody: { host: string; key: string; keyLocation: string; urlList: string[] } | undefined;

  const server = createServer(async (request, response) => {
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const baseUrl = `http://127.0.0.1:${address.port}`;

    if (request.method === "GET" && request.url === "/sitemap.xml") {
      response.writeHead(200, { "Content-Type": "application/xml; charset=utf-8" });
      response.end(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${baseUrl}/</loc><priority>1</priority></url>
  <url><loc>${baseUrl}/products/registry-product</loc><priority>0.85</priority></url>
  <url><loc>${baseUrl}/articles/low-priority</loc><priority>0.8</priority></url>
  <url><loc>https://example.com/not-our-host</loc><priority>1</priority></url>
</urlset>`);
      return;
    }

    if (request.method === "POST" && request.url === "/indexnow") {
      const chunks: Buffer[] = [];
      for await (const chunk of request) chunks.push(Buffer.from(chunk));
      submittedBody = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      response.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("accepted");
      return;
    }

    response.writeHead(404);
    response.end("not found");
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));

  try {
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const baseUrl = `http://127.0.0.1:${address.port}`;
    const child = spawn(process.execPath, ["scripts/submit-indexnow.mjs"], {
      cwd: repoRoot,
      env: {
        ...process.env,
        NEXT_PUBLIC_SITE_URL: baseUrl,
        INDEXNOW_ENDPOINT: `${baseUrl}/indexnow`,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stderr = "";
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => { stderr += chunk; });

    const [exitCode] = await once(child, "close");
    assert.equal(exitCode, 0, stderr);
    assert.ok(submittedBody, "IndexNow request was not submitted");

    assert.deepEqual(
      [...submittedBody.urlList].sort(),
      [
        `${baseUrl}/`,
        `${baseUrl}/products/registry-product`,
        `${baseUrl}/sitemap-images.xml`,
        `${baseUrl}/sitemap.xml`,
      ].sort(),
    );
    assert.equal(submittedBody.host, `127.0.0.1:${address.port}`);
    assert.equal(submittedBody.keyLocation, `${baseUrl}/indexnow-key.txt`);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
