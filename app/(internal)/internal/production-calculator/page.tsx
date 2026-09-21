import type { Metadata } from 'next';
import { MaterialPriceStatus } from '@/components/cad/production/MaterialPriceStatus';
import { ProductionApplication } from '@/components/cad/production/ProductionApplication';
import { ProductionAudit } from '@/components/cad/production/ProductionAudit';
import { requireProductionPageContext } from '@/lib/server/production-access/page-context';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {title:'Производственный калькулятор — Сталь Продукт',robots:{index:false,follow:false}};

export default async function InternalProductionCalculatorPage({ searchParams }: { searchParams: Promise<{calculationId?:string}> }) {
  const context = await requireProductionPageContext('VIEW_DASHBOARD');
  const operator = context.user.displayName;
  const csrfToken = context.csrfToken;
  context.close();
  const query = await searchParams;
  const calculationId = typeof query.calculationId==='string' && /^calc-[a-zA-Z0-9-]{1,80}$/.test(query.calculationId) ? query.calculationId : undefined;
  return <ProductionApplication csrfToken={csrfToken} auditCalculationId={calculationId} operator={operator} materials={<MaterialPriceStatus />} audit={<ProductionAudit calculationId={calculationId} />} />;
}
