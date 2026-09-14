import type { BendStripRegionCandidate } from "@/lib/instant-quote/bend-strip-region";
import type { NormalizedCadModel } from "@/lib/instant-quote/cad-model";
import type { SampledFlatPatternContourCandidate } from "@/lib/instant-quote/flat-pattern-contour-candidate";
import type { FlatPatternRegionCandidate } from "@/lib/instant-quote/flat-pattern-region";

export type FlatPatternSampledAuditPolicy = {
  id: string;
  approvedBy: string;
  approvedAt: string;
  source: string;
  maxPanelAreaRelativeError: number;
  maxTotalAreaRelativeError: number;
};

export type FlatPatternSampledAuditMetrics = {
  brepPanelAreaMm2: number;
  sampledPanelAreaMm2: number;
  panelAreaRelativeError: number;
  approvedBendStripAreaMm2: number;
  expectedMaterialAreaMm2: number;
  sampledContourAreaMm2: number;
  totalAreaRelativeError: number;
  sourcePanelCount: number;
  sourceBendCount: number;
  contourCount: number;
};

export type FlatPatternSampledAudit = {
  source: "brep-vs-sampled-flat-pattern-audit";
  displayOnly: true;
  productionAuthoritative: false;
  status: "pass" | "fail" | "blocked";
  policyId?: string;
  metrics?: FlatPatternSampledAuditMetrics;
  findings: string[];
};

function relativeError(actual: number, expected: number) {
  return Math.abs(actual - expected) / Math.max(Math.abs(expected), 1e-12);
}

function validPolicy(policy: FlatPatternSampledAuditPolicy) {
  return Boolean(
    policy.id
    && policy.approvedBy
    && policy.source
    && !Number.isNaN(Date.parse(policy.approvedAt))
    && Number.isFinite(policy.maxPanelAreaRelativeError)
    && policy.maxPanelAreaRelativeError >= 0
    && policy.maxPanelAreaRelativeError <= 1
    && Number.isFinite(policy.maxTotalAreaRelativeError)
    && policy.maxTotalAreaRelativeError >= 0
    && policy.maxTotalAreaRelativeError <= 1,
  );
}

function sameIds(left: string[], right: string[]) {
  if (left.length !== right.length) return false;
  const rightSet = new Set(right);
  return left.every((id) => rightSet.has(id));
}

/**
 * Independent sampled-flat-pattern audit against exact BRep planar panel areas.
 * Bend-strip area comes from the explicitly approved allowance table path. The
 * thresholds are supplied by an approved policy rather than hardcoded here.
 * Passing this audit still does not make sampled geometry production-authoritative.
 */
export function auditSampledFlatPattern(input: {
  model: NormalizedCadModel;
  region: FlatPatternRegionCandidate;
  contour: SampledFlatPatternContourCandidate;
  strips: BendStripRegionCandidate;
  policy: FlatPatternSampledAuditPolicy;
}): FlatPatternSampledAudit {
  const { model, region, contour, strips, policy } = input;
  const blockedFindings: string[] = [];

  if (model.format !== "step" && model.format !== "stp") blockedFindings.push("Flat-pattern BRep audit requires STEP/STP source geometry.");
  if (!model.unfoldGeometry) blockedFindings.push("Flat-pattern BRep audit requires unfoldGeometry evidence from STEP.");
  if (region.status !== "ready") blockedFindings.push(...(region.errors.length ? region.errors : ["Flat-pattern region candidate is not ready."]));
  if (contour.status !== "ready") blockedFindings.push(...(contour.errors.length ? contour.errors : ["Sampled flat-pattern contour candidate is not ready."]));
  if (strips.status !== "ready") blockedFindings.push(...(strips.errors.length ? strips.errors : ["Approved bend-strip evidence is not ready."]));
  if (!validPolicy(policy)) blockedFindings.push("Flat-pattern sampled audit policy is missing required approval metadata or valid error thresholds.");
  if (model.unfoldGeometry?.issues.length) blockedFindings.push(...model.unfoldGeometry.issues.map((issue) => `BRep unfold issue: ${issue}`));
  if (blockedFindings.length) {
    return {
      source: "brep-vs-sampled-flat-pattern-audit",
      displayOnly: true,
      productionAuthoritative: false,
      status: "blocked",
      policyId: policy.id || undefined,
      findings: blockedFindings,
    };
  }

  const evidence = model.unfoldGeometry!;
  const sourcePanelIds = evidence.panels.map((panel) => panel.id);
  const sourceBendIds = evidence.bends.map((bend) => bend.bendId);
  const structuralFindings: string[] = [];
  if (!sameIds(sourcePanelIds, region.panelIds)) structuralFindings.push("Region panel ids do not exactly match STEP BRep unfold panel ids.");
  if (!sameIds(sourceBendIds, region.bendIds)) structuralFindings.push("Region bend ids do not exactly match STEP BRep unfold bend ids.");
  if (!sameIds(sourceBendIds, strips.strips.map((strip) => strip.bendId))) structuralFindings.push("Approved bend-strip ids do not exactly match STEP BRep unfold bend ids.");
  if (structuralFindings.length) {
    return {
      source: "brep-vs-sampled-flat-pattern-audit",
      displayOnly: true,
      productionAuthoritative: false,
      status: "blocked",
      policyId: policy.id,
      findings: structuralFindings,
    };
  }

  const brepPanelAreaMm2 = evidence.panels.reduce((sum, panel) => sum + panel.areaMm2, 0);
  const sampledPanelAreaMm2 = region.sampledPanelNetAreaMm2!;
  const approvedBendStripAreaMm2 = strips.strips.reduce((sum, strip) => sum + strip.areaMm2, 0);
  const expectedMaterialAreaMm2 = brepPanelAreaMm2 + approvedBendStripAreaMm2;
  const sampledContourAreaMm2 = contour.sampledMaterialAreaMm2!;
  if (![brepPanelAreaMm2, sampledPanelAreaMm2, approvedBendStripAreaMm2, expectedMaterialAreaMm2, sampledContourAreaMm2].every(Number.isFinite)
    || !(brepPanelAreaMm2 > 0)
    || !(sampledPanelAreaMm2 > 0)
    || !(expectedMaterialAreaMm2 > 0)
    || !(sampledContourAreaMm2 > 0)) {
    return {
      source: "brep-vs-sampled-flat-pattern-audit",
      displayOnly: true,
      productionAuthoritative: false,
      status: "blocked",
      policyId: policy.id,
      findings: ["Flat-pattern audit received missing, non-finite or non-positive area evidence."],
    };
  }

  const panelAreaRelativeError = relativeError(sampledPanelAreaMm2, brepPanelAreaMm2);
  const totalAreaRelativeError = relativeError(sampledContourAreaMm2, expectedMaterialAreaMm2);
  const metrics: FlatPatternSampledAuditMetrics = {
    brepPanelAreaMm2,
    sampledPanelAreaMm2,
    panelAreaRelativeError,
    approvedBendStripAreaMm2,
    expectedMaterialAreaMm2,
    sampledContourAreaMm2,
    totalAreaRelativeError,
    sourcePanelCount: evidence.panels.length,
    sourceBendCount: evidence.bends.length,
    contourCount: contour.contourCount!,
  };

  const findings: string[] = [];
  if (panelAreaRelativeError > policy.maxPanelAreaRelativeError) {
    findings.push(`Sampled panel area relative error ${panelAreaRelativeError} exceeds approved policy limit ${policy.maxPanelAreaRelativeError}.`);
  }
  if (totalAreaRelativeError > policy.maxTotalAreaRelativeError) {
    findings.push(`Sampled total material area relative error ${totalAreaRelativeError} exceeds approved policy limit ${policy.maxTotalAreaRelativeError}.`);
  }

  return {
    source: "brep-vs-sampled-flat-pattern-audit",
    displayOnly: true,
    productionAuthoritative: false,
    status: findings.length ? "fail" : "pass",
    policyId: policy.id,
    metrics,
    findings,
  };
}
