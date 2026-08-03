import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  ProductionEnvironmentError,
  assertProductionEnvironment,
} from "../lib/config/production-env";

function loadProductionEnvFile() {
  const envPath = resolve(process.cwd(), ".env.production");
  if (!existsSync(envPath)) return;
  for (const rawLine of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator <= 0) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadProductionEnvFile();

try {
  assertProductionEnvironment(process.env, { force: true });
  console.info("Production environment check passed.");
} catch (error) {
  if (error instanceof ProductionEnvironmentError) {
    console.error(`Production environment check failed. Missing or invalid keys: ${error.issues.map((issue) => issue.key).join(", ")}`);
    process.exitCode = 1;
  } else {
    console.error("Production environment check failed with an unexpected validation error.");
    process.exitCode = 1;
  }
}
