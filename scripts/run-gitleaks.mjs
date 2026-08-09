import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const bundledBinary = join(repositoryRoot, ".tools", "gitleaks-8.29.0", "gitleaks");
const binary = process.env.GITLEAKS_BIN || (existsSync(bundledBinary) ? bundledBinary : "gitleaks");
const commonArguments = [
  "--config",
  join(repositoryRoot, ".gitleaks.toml"),
  "--gitleaks-ignore-path",
  join(repositoryRoot, ".gitleaksignore"),
  "--redact",
  "--no-banner",
  "--no-color",
];

function run(argumentsList, label) {
  const result = spawnSync(binary, argumentsList, {
    cwd: repositoryRoot,
    encoding: "utf8",
    stdio: "inherit",
  });
  if (result.error?.code === "ENOENT") {
    console.error("Gitleaks не найден. Установите версию 8.29.0 или задайте GITLEAKS_BIN.");
    process.exit(2);
  }
  if (result.error) {
    console.error(`Не удалось запустить Gitleaks (${label}).`);
    process.exit(2);
  }
  if (result.status !== 0) {
    console.error(`Проверка Gitleaks не пройдена (${label}).`);
    process.exit(result.status ?? 2);
  }
}

run(["version"], "version");
run(["git", ".", "--log-opts=--all", ...commonArguments], "history");
run(["dir", ".", ...commonArguments], "working-tree");

console.info("Gitleaks: история и рабочее дерево проверены, findings не обнаружены.");
