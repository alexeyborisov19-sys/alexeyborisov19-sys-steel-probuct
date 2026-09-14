import type { FlatPatternSampledAudit } from "@/lib/instant-quote/flat-pattern-audit";
import type { SampledFlatPatternContourCandidate } from "@/lib/instant-quote/flat-pattern-contour-candidate";
import type { FlatPatternMaterialCollisionCheck } from "@/lib/instant-quote/flat-pattern-material-collision";
import type { FlatPatternRegionCandidate } from "@/lib/instant-quote/flat-pattern-region";

export type SampledFlatPatternVerification = {
  source: "sampled-flat-pattern-verification-gate";
  displayOnly: true;
  productionAuthoritative: false;
  status: "verified-preview" | "failed" | "blocked";
  pricingEligible: false;
  camEligible: false;
  checks: {
    regionReady: boolean;
    collisionClear: boolean;
    contourReady: boolean;
    auditPassed: boolean;
  };
  findings: string[];
};

/**
 * Final gate for the current sampled unfold pipeline. It intentionally cannot
 * authorize pricing or CAM. Its only positive state means all current preview /
 * evidence layers agree and are suitable for engineering review. Production
 * authority requires a later exact/analytic flat-pattern pipeline and explicit
 * release policy.
 */
export function verifySampledFlatPattern(input: {
  region: FlatPatternRegionCandidate;
  collisions: FlatPatternMaterialCollisionCheck;
  contour: SampledFlatPatternContourCandidate;
  audit: FlatPatternSampledAudit;
}): SampledFlatPatternVerification {
  const { region, collisions, contour, audit } = input;
  const checks = {
    regionReady: region.status === "ready",
    collisionClear: collisions.status === "clear",
    contourReady: contour.status === "ready",
    auditPassed: audit.status === "pass",
  };

  const findings: string[] = [];
  if (!checks.regionReady) findings.push(...(region.errors.length ? region.errors : ["Flat-pattern region candidate is not ready."]));
  if (!checks.collisionClear) {
    findings.push(...(collisions.errors.length ? collisions.errors : [`Flat-pattern material collision gate is ${collisions.status}.`]));
    for (const collision of collisions.collisions) {
      findings.push(`${collision.reason}: ${collision.entityA.kind}:${collision.entityA.id} ↔ ${collision.entityB.kind}:${collision.entityB.id}`);
    }
  }
  if (!checks.contourReady) findings.push(...(contour.errors.length ? contour.errors : ["Sampled whole-part contour is not ready."]));
  if (!checks.auditPassed) findings.push(...(audit.findings.length ? audit.findings : [`BRep audit status is ${audit.status}.`]));

  const hasBlockedInput = region.status === "blocked"
    || collisions.status === "blocked"
    || contour.status === "blocked"
    || audit.status === "blocked";
  const status: SampledFlatPatternVerification["status"] = Object.values(checks).every(Boolean)
    ? "verified-preview"
    : hasBlockedInput
      ? "blocked"
      : "failed";

  return {
    source: "sampled-flat-pattern-verification-gate",
    displayOnly: true,
    productionAuthoritative: false,
    status,
    pricingEligible: false,
    camEligible: false,
    checks,
    findings,
  };
}
