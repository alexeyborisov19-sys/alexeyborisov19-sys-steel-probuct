import { normalizeCassetteProject, type CassetteProject } from './model';

/** Customer-visible quote only. No tariff, policy, cost basis or per-operation rows. */
export type PublicCassetteBudget = {
  projectId: string; revision: number; currency: 'RUB'; totalRub: number;
  faceAreaM2: number; quantity: number; reviewQuantity: number; assumptions: string;
};
export type CassetteBudgetSnapshot = { projectKey: string; value: PublicCassetteBudget };
const keys = ['projectId','revision','currency','totalRub','faceAreaM2','quantity','reviewQuantity','assumptions'];
export function parsePublicCassetteBudget(value: unknown): PublicCassetteBudget {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Стоимость пока недоступна.');
  const v = value as Record<string, unknown>;
  if (Object.keys(v).length !== keys.length || keys.some(key => !(key in v))
    || typeof v.projectId !== 'string' || !v.projectId || v.currency !== 'RUB'
    || typeof v.assumptions !== 'string' || v.assumptions.length > 2000
    || ['revision','quantity','reviewQuantity'].some(key => !Number.isSafeInteger(v[key]) || Number(v[key]) < 0)
    || ['totalRub','faceAreaM2'].some(key => typeof v[key] !== 'number' || !Number.isFinite(v[key]) || Number(v[key]) < 0)) throw Error('Стоимость пока недоступна.');
  return v as PublicCassetteBudget;
}
export function cassetteBudgetProjectKey(project: CassetteProject): string {
  return JSON.stringify(normalizeCassetteProject(project));
}
export function currentCassetteBudget(project: CassetteProject, snapshot: CassetteBudgetSnapshot | null | undefined) {
  if (!snapshot || snapshot.projectKey !== cassetteBudgetProjectKey(project)) return null;
  const value = parsePublicCassetteBudget(snapshot.value);
  return value.projectId === project.id && value.revision === project.revision ? value : null;
}
/** Cancellation invalidates even a transport that ignores AbortSignal. */
export function createCassetteBudgetLoader(fetcher: typeof fetch = fetch) {
  let epoch = 0, controller: AbortController | null = null;
  const cancel = () => { epoch++; controller?.abort(); controller = null; };
  return { cancel, async load(project: CassetteProject): Promise<CassetteBudgetSnapshot | null> {
    cancel(); const ownEpoch = epoch, projectKey = cassetteBudgetProjectKey(project);
    controller = new AbortController();
    try {
      const response = await fetcher('/api/cassette-project-budget', { method:'POST', headers:{'Content-Type':'application/json'}, body:projectKey, signal:controller.signal });
      if (!response.ok) throw Error('Не удалось получить стоимость. Попробуйте позже или передайте проект специалисту.');
      const value = parsePublicCassetteBudget(await response.json());
      if (ownEpoch !== epoch) return null;
      const snapshot = { projectKey, value };
      if (!currentCassetteBudget(project, snapshot)) throw Error('Ответ относится к другой редакции проекта.');
      return snapshot;
    } catch (error) { if (ownEpoch !== epoch) return null; throw error; }
  } };
}
