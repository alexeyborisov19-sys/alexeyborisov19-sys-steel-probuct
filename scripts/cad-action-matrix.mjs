/** Coverage inventory, not evidence. Browser execution alone may turn a pending cell into pass. */
export const CAD_ACTION_VIEWPORTS = Object.freeze([360, 1440]);
export const CAD_ACTION_REPLAYS = Object.freeze([1, 2]);
const rows = [
  ['manual-open-close', 'manual', 'Open/close/reopen manual entry, including the manual deep link'],
  ['manual-invalid-input', 'manual', 'Reject invalid name, dimensions, thickness and quantity without adding positions'],
  ['manual-fields', 'manual', 'Persist name, dimensions, material, thickness and quantity in generated manual source'],
  ['manual-holes', 'manual', 'Enable/disable holes and add/edit/remove groups; enforce the five-group bound'],
  ['manual-copy-add-remove', 'manual', 'Copy independently, add an inherited-material row, remove a row and submit the remaining batch'],
  ['manual-edit', 'manual', 'Edit an existing manual position, preserving its identity, operations and revised source'],
  ['upload-picker', 'upload', 'Use the actual filechooser buttons and verify selected CAD bytes reach synthetic analysis'],
  ['upload-drag-drop', 'upload', 'Drag enter/leave/drop files and verify overlay, position and analysis transitions'],
  ['position-select-remove', 'upload', 'Select distinct positions and delete the selected position without changing another'],
  ['position-limit', 'upload', 'Reach five positions, reject overflow and re-enable adding after removal'],
  ['upload-invalid-format', 'upload', 'Reject an unsupported extension without analysis or project mutation'],
  ['material-choices', 'configuration', 'Exercise each material, confirmation text and outgoing manifest'],
  ['thickness-choices', 'configuration', 'Exercise every offered thickness and outgoing manifest'],
  ['quantity-valid-invalid', 'configuration', 'Preserve invalid drafts and block quote/save; recover to valid bounds'],
  ['quantity-presets', 'configuration', 'Exercise all five presets with selected state and outgoing quantity'],
  ...['bending', 'welding', 'countersink', 'assembly', 'surface-preparation', 'powder-coating', 'packaging'].map(id => [`operation-${id}`, 'operations', `Enable/disable ${id}; assert operation and applicable input omission in manifest`]),
  ['operation-counts-unknown', 'operations', 'Change all four numeric operation inputs and clear each via unknown; assert outgoing inputs'],
  ['operation-sides-unknown', 'operations', 'Select both sides options and unknown for coating/preparation; assert outgoing inputs'],
  ['preview-2d-zoom-fit', 'preview2d', 'Assert zoom in/out viewBox geometry and exact fit restoration'],
  ['preview-view-switch', 'preview3d', 'Switch genuine synthetic-mesh 2D/3D DOM and selected state'],
  ['preview-3d-controls', 'preview3d', 'Assert rendered synthetic cube pixels change for wire, drag and touch pinch (mobile) or wheel (desktop), then return with fit'],
  ['calculate-success', 'calculation', 'Assert successful synthetic quote, all positions, exact total and request payload'],
  ['calculate-partial', 'calculation', 'Assert subtotal, unpriced-position warning and omission of complete printed total'],
  ['calculate-failed-retry', 'calculation', 'Assert failed response clears price/print and retry obtains a fresh result'],
  ['calculate-stale-response', 'calculation', 'Resolve an obsolete request after editing and assert it cannot replace the current result'],
  ['project-rename-save-export', 'persistence', 'Rename and download actual JSON; assert source declarations/digests and no CAD bytes or old prices'],
  ['project-print', 'persistence', 'Invoke print once, inspect print-media rows/notice/total and generate a real browser PDF; native OS dialog is outside automation'],
  ['project-import-invalid', 'persistence', 'Reject malformed, unsupported-version and oversized JSON without changing current project'],
  ['project-import-cancel', 'persistence', 'Cancel replacement and restore focus without losing current positions/draft'],
  ['project-import-restore', 'persistence', 'Confirm replacement, discard old quote, regenerate and reanalyse manual DXF, preserve saved configuration'],
  ['project-reattach-sha-mismatch', 'persistence', 'Reject same-name/same-size different bytes before any CAD reanalysis'],
  ['project-reattach-sha-match', 'persistence', 'Accept exact original bytes, reanalyse CAD, preserve saved configuration and unlock calculation'],
  ['contact-handoff', 'handoff', 'Navigate help and calculated project handoffs; verify attribution/context and no submitted lead'],
];
export const CAD_ACTIONS = Object.freeze(rows.map(([id, scenario, assertion]) => Object.freeze({ id, scenario, assertion, owner: 'audit-cad-actions-twice.mjs' })));
export const DELEGATED_CAD_COVERAGE = Object.freeze([
  { id: 'late-step-no-overwrite', owner: 'audit-cad-input-workflow.mjs', viewports: [360, 480, 1440], replays: [1, 2], assertion: 'Delayed STEP findings preserve thickness, bend count and customer toggle choices' },
  { id: 'byte-upload-budgets', owner: 'audit-cad-input-workflow.mjs', viewports: [360, 1440], replays: [1, 2], assertion: '50 MiB file and 100 MiB project rejection before network/state mutation' },
  { id: 'axe-layout-runtime', owner: 'audit-cad-input-workflow.mjs', viewports: [360, 480, 1440], replays: [1, 2], assertion: 'Axe, mobile parameter ordering, overflow and runtime error assertions' },
  { id: 'price-hidden-invalid-and-unpriced', owner: 'audit-cad-input-workflow.mjs', viewports: [360, 480, 1440], replays: [1, 2], assertion: 'Invalid quantity hides/restores matching quote, no stale quote, no invented unpriced amount' },
]);

export function localCandidateOrigin(value = 'http://localhost:3106') {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    || url.username || url.password || url.search || url.hash || (url.pathname !== '/' && url.pathname !== '')) {
    throw new Error('Use a loopback-only local candidate origin without credentials, path, query or fragment.');
  }
  return url.origin;
}

export function createPendingCadActionMatrix() {
  return {
    schemaVersion: 1,
    scope: 'Synthetic local candidate UI replay only. No browser evidence exists until a cell has executed its assertions.',
    limitations: ['Synthetic quotes do not validate server pricing or manufacturing feasibility.', 'Synthetic CAD responses do not validate the real CAD parser.', 'Browser-generated PDF is exercised; native OS PDF dialogs and physical printing are not.'],
    actions: CAD_ACTIONS.map(action => ({ ...action, runs: CAD_ACTION_VIEWPORTS.flatMap(width => CAD_ACTION_REPLAYS.map(replay => ({ width, replay, status: 'pending', evidence: null }))) })),
    delegated: DELEGATED_CAD_COVERAGE.map(action => ({ ...action, runs: action.viewports.flatMap(width => action.replays.map(replay => ({ width, replay, status: 'pending', evidence: null }))) })),
  };
}

export function recordCadAction(matrix, id, width, replay, status, evidence) {
  if (!['pass', 'fail', 'unavailable'].includes(status)) throw new Error('Only executed results may be recorded.');
  const run = matrix.actions.find(action => action.id === id)?.runs.find(run => run.width === width && run.replay === replay);
  if (!run || run.status !== 'pending') throw new Error(`Unknown or already recorded CAD action: ${id}/${width}/${replay}`);
  if (!evidence || typeof evidence !== 'object' || !evidence.finishedAt || !evidence.detail) throw new Error('Execution evidence is required.');
  Object.assign(run, { status, evidence });
}

export function cadActionSummary(matrix) {
  const runs = matrix.actions.flatMap(action => action.runs);
  return Object.fromEntries(['pending', 'pass', 'fail', 'unavailable'].map(status => [status, runs.filter(run => run.status === status).length]));
}

/** Admit only a freshly grouped, exact-candidate core run. Never infer results from source or old artifacts. */
export function applyDelegatedCoreEvidence(matrix, report, { executionGroup, candidate, now = new Date().toISOString() }) {
  const refuse = reason => ({ accepted: false, reason });
  if (typeof executionGroup !== 'string' || !executionGroup.trim() || report?.executionGroup !== executionGroup) return refuse('Missing or mismatched execution group.');
  if (report?.kind !== 'cad-core-evidence') return refuse('Unrecognized core evidence format.');
  for (const key of ['gitHead', 'githubSha', 'sourceFingerprint']) if (report.candidate?.[key] !== candidate?.[key]) return refuse(`Candidate ${key} mismatch.`);
  if (!/^[a-f0-9]{40,64}$/.test(candidate?.gitHead || '') || !/^[a-f0-9]{64}$/.test(candidate?.sourceFingerprint || '')) return refuse('Candidate identity is incomplete.');
  const started = Date.parse(report.startedAt), finished = Date.parse(report.finishedAt), current = Date.parse(now);
  if (![started, finished, current].every(Number.isFinite) || finished < started || finished > current) return refuse('Invalid or future core execution timestamps.');
  const expected = [360, 480, 1440].flatMap(width => [1, 2].map(pass => `${width}/${pass}`));
  if (!Array.isArray(report.results) || report.results.length !== expected.length) return refuse('Core report is incomplete.');
  const seen = new Set();
  for (const row of report.results) {
    const key = `${row.width}/${row.pass}`;
    if (!expected.includes(key) || seen.has(key) || row.passed !== true || row.syntheticOnly !== true || !Array.isArray(row.actions)) return refuse('Core rows must be unique, successful, synthetic and complete.');
    seen.add(key);
    for (const entry of DELEGATED_CAD_COVERAGE.filter(entry => entry.viewports.includes(row.width))) {
      if (!row.actions.includes(entry.id)) return refuse(`Core row lacks asserted action ${entry.id}.`);
    }
  }
  // No mutations before the entire evidence envelope and all required action cells validate.
  for (const action of matrix.delegated) for (const cell of action.runs) {
    if (cell.status !== 'pending') return refuse('Delegated evidence was already recorded.');
  }
  for (const action of matrix.delegated) for (const cell of action.runs) {
    cell.status = 'pass';
    cell.evidence = { executionGroup, startedAt: report.startedAt, finishedAt: report.finishedAt, detail: action.assertion,
      sourceFingerprint: candidate.sourceFingerprint, owner: action.owner, width: cell.width, pass: cell.replay };
  }
  return { accepted: true, reason: 'Exact-candidate core assertions matched every delegated cell.' };
}
