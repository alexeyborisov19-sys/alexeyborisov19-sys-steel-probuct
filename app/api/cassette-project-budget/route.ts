import { handleCassetteProjectBudget } from '@/lib/server/instant-quote/cassette-project-budget-handler';
export const runtime = 'nodejs';
export async function POST(request: Request) { return handleCassetteProjectBudget(request); }
