import Link from 'next/link';
import type { CadQuoteControl } from '@/lib/server/quote-engine/cad-stage-review';
import { listInternalProductionReports, readInternalProductionReport } from '@/lib/server/instant-quote/private-production-report';

const stages: Record<string,string> = { classification:'Тип изделия',inputs:'Исходные данные',geometry:'Геометрия',operations:'Технологический маршрут',calculation:'Арифметика и полнота',market:'Сопоставимость рынка',pricing:'Итоговая цена',disclaimer:'Условия расчёта' };
const reasons: Record<string,string> = { 'missing-input':'Недостающие исходные данные','unsupported-operation':'Операция не подтверждена','inconsistent-geometry':'Противоречие в геометрии','incomplete-calculation':'Расчёт неполный','market-not-comparable':'Предложения несопоставимы','price-below-floor':'Цена ниже допустимого расчётного уровня','unsupported-client-claim':'Неподтверждённое утверждение','source-required':'Нужен источник данных' };

/** Internal-only, immutable report evidence; no model call is made while viewing. */
export async function ProductionAudit({ calculationId }: { calculationId?: string }) {
  if (!calculationId) return <p className="border border-white/20 p-5 text-white/70">Сначала выполните расчёт. Здесь появятся результаты программных проверок и отдельно — фактический статус ИИ-контроля.</p>;
  const reports = await listInternalProductionReports(250).catch(()=>[]);
  const item = reports.find(report=>report.projectId===calculationId);
  if (!item) return <p role="status" className="border border-amber-400/40 p-5 text-amber-200">Отчёт этого расчёта пока недоступен. Проверка не считается выполненной.</p>;
  const report = await readInternalProductionReport(item.fileName);
  const control = (report as typeof report & {quoteControl?:CadQuoteControl}).quoteControl;
  return <div className="space-y-4">
    <div className="border border-white/20 bg-[#111921] p-5"><p className="break-all text-sm text-white/70">Расчёт {report.projectId} · отчёт {report.reportId}</p><p className="mt-2 text-sm text-white/70">{new Date(report.generatedAt).toLocaleString('ru-RU')} · база {report.basisVersion}</p><p className="mt-4 text-xl font-semibold">Подтверждённые прямые затраты: {report.calculation.confirmedDirectCostRub?.toLocaleString('ru-RU')} ₽</p><p className="mt-2 text-sm text-white/70">При незакрытых статьях это не полная себестоимость.</p><Link href={`/internal/production-calculations/${encodeURIComponent(item.fileName)}`} className="mt-4 inline-block text-orange-300 underline underline-offset-4">Полная калькуляция, DFM и технологическая ревизия →</Link></div>
    {!control ? <p className="border border-white/20 p-5">В этом отчёте нет сохранённого ИИ-аудита.</p> : control.audits.map(audit=><section key={audit.partId} className="border border-white/20 bg-[#111921] p-5">
      <h3 className="font-semibold">{report.calculationInputSnapshot?.project.parts.find(part=>part.id===audit.partId)?.fileName??audit.partId}</h3>
      <p className="mt-3 text-sm text-orange-300">{audit.review.origin==='ai' ? (audit.review.status==='passed'?'ИИ-проверка выполнена':'ИИ обнаружил замечания') : 'ИИ-проверка не выполнена'}</p>
      <p className="mt-2 text-sm text-white/70">{audit.review.origin==='deterministic'?'Обнаружены проблемы программной проверкой. ИИ не может отменить эту блокировку.':audit.review.status==='not-configured'?'Модель не настроена. Доступен программный контроль.':audit.review.status==='unavailable'?'Ответ модели не получен или не прошёл проверку формата.':'Результат относится только к указанному отчёту.'}</p>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">{Object.entries(stages).map(([id,label])=>{const stage=audit.review.stages.find(row=>row.stage===id);return <div key={id} className="border border-white/10 p-3"><p className="text-sm font-medium">{label}</p><p className="mt-1 text-sm text-white/70">{!stage?'Нет результата':stage.status==='pass'?'Проверено':stage.status==='not-applicable'?'Не применимо':'Требует проверки'}</p>{stage?.codes.map(code=><p key={code} className="mt-2 text-sm text-amber-200">{reasons[code]??code}</p>)}</div>;})}</div>
    </section>)}
  </div>;
}
