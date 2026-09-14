import type { ApprovedBendAllowanceTable } from "@/lib/instant-quote/bend-allowance";
import {
  buildBendBoundaryPreview2D,
  type BendBoundaryPreview2D,
} from "@/lib/instant-quote/bend-boundary-preview";
import {
  buildBendOrientationPreview,
  type BendOrientationPreview,
} from "@/lib/instant-quote/bend-orientation-preview";
import {
  applyBendAllowanceSpacingToBoundaryPreview,
  buildBendAllowanceSpacingPreview,
  type BendAllowanceSpacingPreview,
  type SpacedBendBoundaryPreview2D,
} from "@/lib/instant-quote/bend-spacing-preview";
import {
  buildBendStripRegionCandidate,
  type BendStripRegionCandidate,
} from "@/lib/instant-quote/bend-strip-region";
import {
  buildBendUnfoldPlanFromModel,
  type BendUnfoldPlan,
} from "@/lib/instant-quote/bend-unfold-plan";
import type { NormalizedCadModel } from "@/lib/instant-quote/cad-model";
import {
  auditSampledFlatPattern,
  type FlatPatternSampledAudit,
  type FlatPatternSampledAuditPolicy,
} from "@/lib/instant-quote/flat-pattern-audit";
import {
  buildSampledFlatPatternContourCandidate,
  type SampledFlatPatternContourCandidate,
} from "@/lib/instant-quote/flat-pattern-contour-candidate";
import {
  checkSampledFlatPatternMaterialCollisions,
  type FlatPatternMaterialCollisionCheck,
} from "@/lib/instant-quote/flat-pattern-material-collision";
import {
  buildFlatPatternRegionCandidate,
  type FlatPatternRegionCandidate,
} from "@/lib/instant-quote/flat-pattern-region";
import {
  verifySampledFlatPattern,
  type SampledFlatPatternVerification,
} from "@/lib/instant-quote/flat-pattern-verification";

export type BentStepUnfoldStage =
  | "plan"
  | "orientation"
  | "boundary"
  | "spacing"
  | "spaced-boundary"
  | "bend-strips"
  | "collisions"
  | "region"
  | "contour"
  | "audit"
  | "verification";

export type BentStepUnfoldPipeline = {
  source: "steel-product-bent-step-unfold-pipeline";
  displayOnly: true;
  productionAuthoritative: false;
  pricingEligible: false;
  camEligible: false;
  status: "verified-preview" | "blocked" | "failed";
  stoppedAt?: BentStepUnfoldStage;
  plan: BendUnfoldPlan;
  orientation?: BendOrientationPreview;
  boundary?: BendBoundaryPreview2D;
  spacing?: BendAllowanceSpacingPreview;
  spacedBoundary?: SpacedBendBoundaryPreview2D;
  strips?: BendStripRegionCandidate;
  collisions?: FlatPatternMaterialCollisionCheck;
  region?: FlatPatternRegionCandidate;
  contour?: SampledFlatPatternContourCandidate;
  audit?: FlatPatternSampledAudit;
  verification?: SampledFlatPatternVerification;
  findings: string[];
};

function base(plan: BendUnfoldPlan): Omit<BentStepUnfoldPipeline, "status" | "findings"> {
  return {
    source: "steel-product-bent-step-unfold-pipeline",
    displayOnly: true,
    productionAuthoritative: false,
    pricingEligible: false,
    camEligible: false,
    plan,
  };
}

function blocked(
  plan: BendUnfoldPlan,
  stoppedAt: BentStepUnfoldStage,
  findings: string[],
  stages: Partial<Omit<BentStepUnfoldPipeline, "source" | "displayOnly" | "productionAuthoritative" | "pricingEligible" | "camEligible" | "status" | "stoppedAt" | "plan" | "findings">> = {},
): BentStepUnfoldPipeline {
  return {
    ...base(plan),
    ...stages,
    status: "blocked",
    stoppedAt,
    findings: findings.length ? findings : [`Bent STEP unfold stopped at ${stoppedAt}.`],
  };
}

/**
 * One fail-closed orchestration path for the current bent-STEP engineering
 * preview. Every stage consumes only the validated output of the previous one.
 * Even the positive state is deliberately non-authoritative: exact analytic
 * contour reconstruction and a separate production release policy are still
 * required before pricing or CAM can ever be enabled.
 */
export function runBentStepUnfoldPreview(input: {
  model: NormalizedCadModel;
  allowanceTable: ApprovedBendAllowanceTable;
  auditPolicy: FlatPatternSampledAuditPolicy;
  materialId: string;
  confirmedThicknessMm: number;
}): BentStepUnfoldPipeline {
  const {
    model,
    allowanceTable,
    auditPolicy,
    materialId,
    confirmedThicknessMm,
  } = input;

  const plan = buildBendUnfoldPlanFromModel({
    model,
    table: allowanceTable,
    materialId,
    confirmedThicknessMm,
  });
  if (plan.status !== "ready") return blocked(plan, "plan", plan.errors);

  const evidence = model.unfoldGeometry;
  if (!evidence) return blocked(plan, "plan", ["Normalized STEP has no unfoldGeometry evidence despite a ready unfold plan."]);

  const orientation = buildBendOrientationPreview({ plan, panels: evidence.panels });
  if (orientation.status !== "ready") {
    return blocked(plan, "orientation", orientation.errors, { orientation });
  }

  const boundary = buildBendBoundaryPreview2D({ orientation, panels: evidence.panels });
  if (boundary.status !== "ready") {
    return blocked(plan, "boundary", boundary.errors, { orientation, boundary });
  }

  const spacing = buildBendAllowanceSpacingPreview({
    plan,
    orientation,
    bends: evidence.bends,
  });
  if (spacing.status !== "ready") {
    return blocked(plan, "spacing", spacing.errors, { orientation, boundary, spacing });
  }

  const spacedBoundary = applyBendAllowanceSpacingToBoundaryPreview({ boundary, spacing });
  if (spacedBoundary.status !== "ready") {
    return blocked(plan, "spaced-boundary", spacedBoundary.errors, {
      orientation,
      boundary,
      spacing,
      spacedBoundary,
    });
  }

  const strips = buildBendStripRegionCandidate(spacing);
  if (strips.status !== "ready") {
    return blocked(plan, "bend-strips", strips.errors, {
      orientation,
      boundary,
      spacing,
      spacedBoundary,
      strips,
    });
  }

  const collisions = checkSampledFlatPatternMaterialCollisions({
    boundary: spacedBoundary,
    strips,
  });
  if (collisions.status !== "clear") {
    const collisionFindings = collisions.collisions.map((collision) =>
      `${collision.reason}: ${collision.entityA.kind}:${collision.entityA.id} ↔ ${collision.entityB.kind}:${collision.entityB.id}`);
    return {
      ...base(plan),
      orientation,
      boundary,
      spacing,
      spacedBoundary,
      strips,
      collisions,
      status: collisions.status === "blocked" ? "blocked" : "failed",
      stoppedAt: "collisions",
      findings: [...collisions.errors, ...collisionFindings],
    };
  }

  const region = buildFlatPatternRegionCandidate({
    boundary: spacedBoundary,
    strips,
    collisions,
  });
  if (region.status !== "ready") {
    return blocked(plan, "region", region.errors, {
      orientation,
      boundary,
      spacing,
      spacedBoundary,
      strips,
      collisions,
      region,
    });
  }

  const contour = buildSampledFlatPatternContourCandidate({
    boundary: spacedBoundary,
    strips,
    collisions,
    region,
  });
  if (contour.status !== "ready") {
    return blocked(plan, "contour", contour.errors, {
      orientation,
      boundary,
      spacing,
      spacedBoundary,
      strips,
      collisions,
      region,
      contour,
    });
  }

  const audit = auditSampledFlatPattern({
    model,
    region,
    contour,
    strips,
    policy: auditPolicy,
  });
  if (audit.status !== "pass") {
    return {
      ...base(plan),
      orientation,
      boundary,
      spacing,
      spacedBoundary,
      strips,
      collisions,
      region,
      contour,
      audit,
      status: audit.status === "blocked" ? "blocked" : "failed",
      stoppedAt: "audit",
      findings: audit.findings,
    };
  }

  const verification = verifySampledFlatPattern({ region, collisions, contour, audit });
  const status: BentStepUnfoldPipeline["status"] = verification.status === "verified-preview"
    ? "verified-preview"
    : verification.status === "blocked"
      ? "blocked"
      : "failed";

  return {
    ...base(plan),
    orientation,
    boundary,
    spacing,
    spacedBoundary,
    strips,
    collisions,
    region,
    contour,
    audit,
    verification,
    status,
    stoppedAt: status === "verified-preview" ? undefined : "verification",
    findings: verification.findings,
  };
}
