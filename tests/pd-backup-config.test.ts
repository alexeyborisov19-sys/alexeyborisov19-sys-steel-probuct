import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

const repositoryRoot = process.cwd();

test("personal-data backup includes the current public legal document tree", async () => {
  const script = await readFile(join(repositoryRoot, "deploy/backup-personal-data.sh"), "utf8");
  const readme = await readFile(join(repositoryRoot, "README.md"), "utf8");

  await access(join(repositoryRoot, "app/(public)/legal"));
  assert.match(script, /LEGAL_DOCUMENTS_RELATIVE='var\/www\/html\/app\/\(public\)\/legal'/);
  assert.doesNotMatch(script, /var\/www\/html\/app\/legal/);
  assert.match(readme, /`app\/\(public\)\/legal\/`/);
});

test("personal-data backup validates every required source before archiving", async () => {
  const script = await readFile(join(repositoryRoot, "deploy/backup-personal-data.sh"), "utf8");

  assert.match(script, /for item in "\$\{ITEMS\[@\]\}"/);
  assert.match(script, /\[\[ -L "\/\$item" \|\| ! -e "\/\$item" \]\]/);
  assert.match(script, /exit 2/);
});

test("production preparation installs the reviewed backup script used by the timer", async () => {
  const script = await readFile(join(repositoryRoot, "deploy/prepare-production.sh"), "utf8");

  assert.match(script, /deploy\/backup-personal-data\.sh/);
  assert.match(script, /\/usr\/local\/sbin\/steelprodukt-pd-backup/);
  assert.match(script, /install -m 0750 -o root -g root/);
});
