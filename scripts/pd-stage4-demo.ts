import { spawnSync } from "node:child_process";

const test = spawnSync(process.execPath, ["--import", "tsx", "--test", "tests/pd-admin-stage4.test.ts"], {
  cwd: process.cwd(),
  env: { ...process.env, NODE_ENV: "test" },
  stdio: "inherit",
  shell: false,
});

if (test.status !== 0) process.exit(test.status ?? 1);

const demonstrated = [
  "subject request: create, identity, link, deadline history",
  "authority request: create, human verification, bounded deadline",
  "legal hold: block, step-up release, multiple-basis safety",
  "export: draft, preview, approval, frozen scope, ZIP, XLSX, CSV, JSON",
  "export: manifest, SHA-256, protected download, manual transfer, TTL expiry",
  "retention: dry-run scan and blocked candidate",
  "deletion: approval, fixture-only physical delete, verify and DOCX act",
  "deletion: symlink preflight and partial outcome",
  "incident: create, assessment and close without automatic notification decision",
  "governance: systems registry and legal document version",
  "backup: local run, isolated restore test and PARTIAL_READINESS status",
];

process.stdout.write(`${JSON.stringify({
  stage: 4,
  fixtureOnly: true,
  productionChanged: false,
  demonstrated,
}, null, 2)}\n`);
