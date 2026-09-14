export type InternalPartRevisionRequest = {
  bendCount?: number | null;
  weldLengthM?: number | null;
  powderAreaM2?: number | null;
  powderSides?: 1 | 2 | null;
  assemblyMinutes?: number | null;
  surfacePreparationAreaM2?: number | null;
};

export type InternalCalculationRevisionRequest = {
  reason: string;
  internalNote?: string;
  parts: Record<string, InternalPartRevisionRequest>;
};

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`);
  return value as Record<string, unknown>;
}

function optionalNumber(
  value: unknown,
  label: string,
  options: { min: number; max: number; integer?: boolean },
): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number) || number < options.min || number > options.max) throw new Error(`${label} is invalid`);
  if (options.integer && !Number.isInteger(number)) throw new Error(`${label} must be an integer`);
  return number;
}

function partId(value: string) {
  const normalized = value.trim();
  if (!normalized || normalized.length > 128 || /[\u0000-\u001f]/.test(normalized)) throw new Error("Invalid part id");
  return normalized;
}

export function parseInternalCalculationRevisionRequest(value: unknown): InternalCalculationRevisionRequest {
  const root = object(value, "revision");
  const reason = typeof root.reason === "string" ? root.reason.trim() : "";
  if (reason.length < 3 || reason.length > 500) throw new Error("Revision reason must be 3-500 characters");

  const internalNote = root.internalNote == null ? undefined : String(root.internalNote).trim();
  if (internalNote && internalNote.length > 1000) throw new Error("Internal note is too long");

  const rawParts = object(root.parts ?? {}, "parts");
  const entries = Object.entries(rawParts);
  if (entries.length === 0) throw new Error("At least one part revision is required");
  if (entries.length > 200) throw new Error("Too many part revisions");

  const parts: Record<string, InternalPartRevisionRequest> = {};
  for (const [rawPartId, rawPatch] of entries) {
    const id = partId(rawPartId);
    const patch = object(rawPatch, `parts.${id}`);
    const bendCount = optionalNumber(patch.bendCount, `${id}.bendCount`, { min: 0, max: 10000, integer: true });
    const weldLengthM = optionalNumber(patch.weldLengthM, `${id}.weldLengthM`, { min: 0.001, max: 100000 });
    const powderAreaM2 = optionalNumber(patch.powderAreaM2, `${id}.powderAreaM2`, { min: 0.000001, max: 1_000_000 });
    const assemblyMinutes = optionalNumber(patch.assemblyMinutes, `${id}.assemblyMinutes`, { min: 0.001, max: 1_000_000 });
    const surfacePreparationAreaM2 = optionalNumber(
      patch.surfacePreparationAreaM2,
      `${id}.surfacePreparationAreaM2`,
      { min: 0.000001, max: 1_000_000 },
    );

    let powderSides: 1 | 2 | null | undefined;
    if (patch.powderSides === undefined) powderSides = undefined;
    else if (patch.powderSides === null || patch.powderSides === "") powderSides = null;
    else {
      const value = Number(patch.powderSides);
      if (value !== 1 && value !== 2) throw new Error(`${id}.powderSides is invalid`);
      powderSides = value;
    }

    const clean: InternalPartRevisionRequest = {};
    if (bendCount !== undefined) clean.bendCount = bendCount;
    if (weldLengthM !== undefined) clean.weldLengthM = weldLengthM;
    if (powderAreaM2 !== undefined) clean.powderAreaM2 = powderAreaM2;
    if (powderSides !== undefined) clean.powderSides = powderSides;
    if (assemblyMinutes !== undefined) clean.assemblyMinutes = assemblyMinutes;
    if (surfacePreparationAreaM2 !== undefined) clean.surfacePreparationAreaM2 = surfacePreparationAreaM2;
    if (Object.keys(clean).length === 0) throw new Error(`No revision values supplied for ${id}`);
    parts[id] = clean;
  }

  return { reason, internalNote: internalNote || undefined, parts };
}