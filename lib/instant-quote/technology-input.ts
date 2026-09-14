export type PartTechnologyInput = {
  bendCount?: number;
  weldLengthM?: number;
  powderAreaM2?: number;
};

export type ProjectTechnologyInput = {
  schemaVersion: "1";
  projectId: string;
  updatedAt: string;
  updatedBy: string;
  parts: Record<string, PartTechnologyInput>;
};

function finiteNonNegative(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function finitePositive(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

export function validatePartTechnologyInput(value: unknown): PartTechnologyInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Technology input must be an object");
  }

  const row = value as Record<string, unknown>;
  const result: PartTechnologyInput = {};

  if (row.bendCount != null) {
    if (!finiteNonNegative(row.bendCount) || !Number.isInteger(row.bendCount)) {
      throw new Error("bendCount must be a non-negative integer");
    }
    result.bendCount = row.bendCount;
  }
  if (row.weldLengthM != null) {
    if (!finitePositive(row.weldLengthM)) throw new Error("weldLengthM must be finite and positive");
    result.weldLengthM = row.weldLengthM;
  }
  if (row.powderAreaM2 != null) {
    if (!finitePositive(row.powderAreaM2)) throw new Error("powderAreaM2 must be finite and positive");
    result.powderAreaM2 = row.powderAreaM2;
  }

  return result;
}

export function validateProjectTechnologyInput(value: unknown): ProjectTechnologyInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Project technology input must be an object");
  }
  const root = value as Record<string, unknown>;
  if (root.schemaVersion !== "1") throw new Error("Unsupported technology input schema");
  if (typeof root.projectId !== "string" || !root.projectId.trim()) throw new Error("projectId is required");
  if (typeof root.updatedBy !== "string" || !root.updatedBy.trim()) throw new Error("updatedBy is required");
  if (typeof root.updatedAt !== "string" || !Number.isFinite(Date.parse(root.updatedAt))) throw new Error("updatedAt is invalid");
  if (!root.parts || typeof root.parts !== "object" || Array.isArray(root.parts)) throw new Error("parts are required");

  const parts: Record<string, PartTechnologyInput> = {};
  for (const [partId, input] of Object.entries(root.parts as Record<string, unknown>)) {
    if (!partId.trim()) throw new Error("partId is invalid");
    parts[partId] = validatePartTechnologyInput(input);
  }

  return {
    schemaVersion: "1",
    projectId: root.projectId.trim(),
    updatedAt: root.updatedAt,
    updatedBy: root.updatedBy.trim(),
    parts,
  };
}
