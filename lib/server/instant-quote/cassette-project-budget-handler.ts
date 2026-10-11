import 'server-only';
import { estimateCassetteProjectBudget } from '@/lib/cassette-project/budget';
import { CASSETTE_PROJECT_LIMITS, normalizeCassetteProject } from '@/lib/cassette-project/model';
import type { PublicCassetteBudget } from '@/lib/cassette-project/public-budget';
import { clientKey } from '@/lib/security/client-ip';
import { consumeRules } from '@/lib/security/rate-limit';
import { assertSameOriginRequest, CrossSiteRequestError } from '@/lib/security/same-origin';
import { readJsonBody, PayloadTooLargeError } from '@/lib/security/request-body';
const reply = (body: unknown, status = 200, headers = {}) => Response.json(body, { status, headers:{'Cache-Control':'no-store',...headers} });
export async function handleCassetteProjectBudget(request: Request, dependencies = { key:clientKey, limit:consumeRules }) {
  try {
    assertSameOriginRequest(request);
    const limited = dependencies.limit(dependencies.key(request), [{id:'cassette-project-budget-minute',limit:60,windowMs:60_000},{id:'cassette-project-budget-day',limit:1000,windowMs:86_400_000}]);
    if (limited) return reply({error:'Слишком много расчётов. Повторите позже.'},429,{'Retry-After':String(limited.retryAfterSeconds)});
    const project = normalizeCassetteProject(await readJsonBody<unknown>(request,CASSETTE_PROJECT_LIMITS.fileBytes));
    const calculated = estimateCassetteProjectBudget(project);
    const result: PublicCassetteBudget = {projectId:calculated.projectId,revision:calculated.revision,currency:calculated.currency,totalRub:calculated.totalRub,faceAreaM2:calculated.faceAreaM2,quantity:calculated.quantity,reviewQuantity:calculated.reviewQuantity,assumptions:calculated.assumptions};
    return reply(result);
  } catch (error) {
    if (error instanceof CrossSiteRequestError) return reply({error:'Запрос отклонён.'},403);
    if (error instanceof PayloadTooLargeError) return reply({error:'Файл проекта превышает 1 МБ.'},413);
    return reply({error:'Проверьте параметры проекта. Стоимость пока недоступна.'},400);
  }
}
