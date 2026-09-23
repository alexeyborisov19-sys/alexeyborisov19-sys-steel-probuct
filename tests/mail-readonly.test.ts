import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import test from "node:test";

const scriptUrl = new URL("../scripts/mail-readonly.py", import.meta.url);

test("mail operator is hard-wired to read-only IMAP access", async () => {
  const source = await readFile(scriptUrl, "utf8");

  assert.match(source, /readonly=True/);
  assert.match(source, /BODY\.PEEK\[/);
  assert.match(source, /IMAP_READ_ONLY/);

  const forbidden = [
    ".store(",
    ".expunge(",
    ".append(",
    ".delete(",
    ".rename(",
    ".copy(",
    " MOVE ",
    " UID MOVE ",
  ];

  for (const token of forbidden) {
    assert.equal(source.includes(token), false, `read-only mail utility must not contain mutating command: ${token}`);
  }
});

test("mail operator never prints credentials", async () => {
  const source = await readFile(scriptUrl, "utf8");

  assert.doesNotMatch(source, /print\([^\n]*(?:password|IMAP_PASSWORD|SMTP_PASSWORD)/i);
  assert.match(source, /pass(word)?\s*=\s*values\.get\("IMAP_PASSWORD"/i);
});

test("mail operator keeps message reads non-destructive", async () => {
  const source = await readFile(scriptUrl, "utf8");

  assert.match(source, /uid\("fetch", uid, "\(BODY\.PEEK\[\] RFC822\.SIZE\)"\)/);
  assert.match(source, /select\(self\.config\.mailbox, readonly=True\)/);
});


test("mail operator compiles with the production Python runtime", () => {
  const result = spawnSync("python3", ["-m", "py_compile", new URL("../scripts/mail-readonly.py", import.meta.url).pathname], {
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr || result.stdout || "python3 py_compile failed");
});
