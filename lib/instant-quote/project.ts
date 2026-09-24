import {
  createEmptyProject,
  normalizeCadFormat,
  type InstantQuoteProject,
  type ManufacturingOperation,
  type OperationInputs,
  type PartGeometrySummary,
  type ProjectPart,
  type QuoteState,
} from "@/lib/instant-quote/domain";

export function addPartToProject(
  project: InstantQuoteProject,
  input: { fileName: string; fileSizeBytes: number },
  now = new Date(),
): InstantQuoteProject {
  const format = normalizeCadFormat(input.fileName);
  if (!format) throw new Error("Неподдерживаемый CAD-формат");

  const iso = now.toISOString();
  const part: ProjectPart = {
    id: `part-${now.getTime()}-${project.parts.length + 1}`,
    fileName: input.fileName,
    fileSizeBytes: input.fileSizeBytes,
    format,
    createdAt: iso,
    state: "queued",
    geometry: null,
    configuration: {
      materialId: "hot",
      thicknessMm: 1,
      quantity: 1,
      operations: ["laser-cutting"],
      operationInputs: {},
    },
    quote: { kind: "not-requested" },
  };

  return {
    ...project,
    updatedAt: iso,
    activePartId: part.id,
    parts: [...project.parts, part],
  };
}

export function updatePartGeometry(
  project: InstantQuoteProject,
  partId: string,
  geometry: PartGeometrySummary,
  now = new Date(),
): InstantQuoteProject {
  const iso = now.toISOString();
  return {
    ...project,
    updatedAt: iso,
    parts: project.parts.map((part) =>
      part.id === partId
        ? { ...part, geometry, state: "dfm-review" as const, quote: { kind: "not-requested" as const } }
        : part,
    ),
  };
}

export function setPartOperationInputs(
  project: InstantQuoteProject,
  partId: string,
  operationInputs: OperationInputs,
  now = new Date(),
): InstantQuoteProject {
  return {
    ...project,
    updatedAt: now.toISOString(),
    parts: project.parts.map((part) =>
      part.id === partId
        ? {
            ...part,
            configuration: { ...part.configuration, operationInputs: { ...(part.configuration.operationInputs ?? {}), ...operationInputs } },
            quote: { kind: "not-requested" as const },
          }
        : part,
    ),
  };
}

export function setPartState(
  project: InstantQuoteProject,
  partId: string,
  state: ProjectPart["state"],
  now = new Date(),
): InstantQuoteProject {
  const iso = now.toISOString();
  return {
    ...project,
    updatedAt: iso,
    parts: project.parts.map((part) => (part.id === partId ? { ...part, state } : part)),
  };
}

export function setActivePart(project: InstantQuoteProject, partId: string): InstantQuoteProject {
  if (!project.parts.some((part) => part.id === partId)) return project;
  return { ...project, activePartId: partId };
}

export function setPartQuantity(
  project: InstantQuoteProject,
  partId: string,
  quantity: number,
  now = new Date(),
): InstantQuoteProject {
  const safeQuantity = Math.min(100_000, Math.max(1, Math.floor(Number.isFinite(quantity) ? quantity : 1)));
  const iso = now.toISOString();
  return {
    ...project,
    updatedAt: iso,
    parts: project.parts.map((part) =>
      part.id === partId
        ? {
            ...part,
            configuration: { ...part.configuration, quantity: safeQuantity },
            quote: { kind: "not-requested" as const },
          }
        : part,
    ),
  };
}

export function setPartMaterial(
  project: InstantQuoteProject,
  partId: string,
  materialId: string,
  now = new Date(),
): InstantQuoteProject {
  const iso = now.toISOString();
  return {
    ...project,
    updatedAt: iso,
    parts: project.parts.map((part) =>
      part.id === partId
        ? {
            ...part,
            configuration: { ...part.configuration, materialId },
            quote: { kind: "not-requested" as const },
          }
        : part,
    ),
  };
}

export function setPartThickness(
  project: InstantQuoteProject,
  partId: string,
  thicknessMm: number,
  now = new Date(),
): InstantQuoteProject {
  const safeThickness = Number.isFinite(thicknessMm) && thicknessMm > 0 ? thicknessMm : null;
  const iso = now.toISOString();
  return {
    ...project,
    updatedAt: iso,
    parts: project.parts.map((part) =>
      part.id === partId
        ? {
            ...part,
            configuration: { ...part.configuration, thicknessMm: safeThickness },
            quote: { kind: "not-requested" as const },
          }
        : part,
    ),
  };
}

export function setPartQuote(
  project: InstantQuoteProject,
  partId: string,
  quote: QuoteState,
  now = new Date(),
): InstantQuoteProject {
  const iso = now.toISOString();
  return {
    ...project,
    updatedAt: iso,
    parts: project.parts.map((part) => (part.id === partId ? { ...part, quote } : part)),
  };
}

export function togglePartOperation(
  project: InstantQuoteProject,
  partId: string,
  operation: ManufacturingOperation,
  enabled: boolean,
  now = new Date(),
): InstantQuoteProject {
  const iso = now.toISOString();
  return {
    ...project,
    updatedAt: iso,
    parts: project.parts.map((part) => {
      if (part.id !== partId) return part;
      const operations = enabled
        ? Array.from(new Set([...part.configuration.operations, operation]))
        : part.configuration.operations.filter((item) => item !== operation);
      return {
        ...part,
        configuration: { ...part.configuration, operations },
        quote: { kind: "not-requested" as const },
      };
    }),
  };
}

export function removePartFromProject(
  project: InstantQuoteProject,
  partId: string,
  now = new Date(),
): InstantQuoteProject {
  const parts = project.parts.filter((part) => part.id !== partId);
  const activePartId = project.activePartId === partId ? parts[0]?.id ?? null : project.activePartId;
  return { ...project, parts, activePartId, updatedAt: now.toISOString() };
}

export function createDemoProject(now = new Date()) {
  return createEmptyProject(now);
}
