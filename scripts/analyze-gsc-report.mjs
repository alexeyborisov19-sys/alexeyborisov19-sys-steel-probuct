import { readFileSync } from "node:fs";
import { analyzeGscReport } from "./lib/gsc-report-analysis.mjs";

// Offline only: no credentials, network requests, submissions or file writes.
const [reportPath, evidencePath, ...extra] = process.argv.slice(2);
if (!reportPath || extra.length) {
  console.error("Usage: node scripts/analyze-gsc-report.mjs report.json [live-evidence.json]");
  process.exitCode = 1;
} else {
  try {
    const report = JSON.parse(readFileSync(reportPath, "utf8"));
    const evidence = evidencePath ? JSON.parse(readFileSync(evidencePath, "utf8")) : undefined;
    console.log(JSON.stringify(analyzeGscReport(report, evidence), null, 2));
  } catch (error) {
    console.error(`Could not analyze GSC report: ${error.message}`);
    process.exitCode = 1;
  }
}
