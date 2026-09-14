import "server-only";

import { randomUUID } from "node:crypto";
import { chmod, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  validateProjectTechnologyInput,
  type PartTechnologyInput,
  type ProjectTechnologyInput,
} from "@/lib/instant-quote/technology-input";

function privateTechnologyInputRoot() {
  const configured = process.env.STEEL_PRODUCT_PRIVATE_TECHNOLOGY_INPUT_ROOT?.trim();
  if (!configured) throw new Error("STEEL_PRODUCT_PRIVATE_TECHNOLOGY_INPUT_ROOT is not configured");
  const resolved = path.resolve(configured);
  const publicRoot = path.resolve(process.cwd(), "public");
  if (resolved === publicRoot || resolved.startsWith(`${publicRoot}${path.sep}`)) {
    throw new Error("Private technology inputs must not be stored under public/");
  }
  return resolved;
}

function projectFileName(projectId: string) {
  const token = projectId.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-").slice(0, 120);
  if (!token) throw new Error("Invalid project id");
  return `${token}.json`;
}

export async function readPrivateTechnologyInput(projectId: string): Promise<ProjectTechnologyInput | null> {
  const filePath = path.join(privateTechnologyInputRoot(), projectFileName(projectId));
  try {
    const raw = await readFile(filePath, "utf8");
    const parsed = validateProjectTechnologyInput(JSON.parse(raw) as unknown);
    if (parsed.projectId !== projectId) throw new Error("Technology input project id mismatch");
    return parsed;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException | undefined)?.code;
    if (code === "ENOENT") return null;
    throw error;
  }
}

export async function writePrivateTechnologyInput(input: ProjectTechnologyInput) {
  const validated = validateProjectTechnologyInput(input);
  const root = privateTechnologyInputRoot();
  await mkdir(root, { recursive: true, mode: 0o700 });
  await chmod(root, 0o700);

  const finalPath = path.join(root, projectFileName(validated.projectId));
  const tempPath = `${finalPath}.${randomUUID()}.tmp`;
  await writeFile(tempPath, `${JSON.stringify(validated, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
    flag: "wx",
  });
  await chmod(tempPath, 0o600);
  await rename(tempPath, finalPath);
  await chmod(finalPath, 0o600);
  return validated;
}

export async function updatePrivateTechnologyPart(input: {
  projectId: string;
  partId: string;
  values: PartTechnologyInput;
  updatedBy: string;
  now?: Date;
}) {
  const current = await readPrivateTechnologyInput(input.projectId);
  const next = validateProjectTechnologyInput({
    schemaVersion: "1",
    projectId: input.projectId,
    updatedAt: (input.now ?? new Date()).toISOString(),
    updatedBy: input.updatedBy,
    parts: {
      ...(current?.parts ?? {}),
      [input.partId]: input.values,
    },
  });
  return writePrivateTechnologyInput(next);
}
