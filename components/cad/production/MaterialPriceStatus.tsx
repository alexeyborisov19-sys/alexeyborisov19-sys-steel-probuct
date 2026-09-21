import { loadPrivateCalculationBasis } from '@/lib/server/instant-quote/private-calculation-basis';
import { snapshotAgeHours, TRUSTED_METAL_PRICE_SOURCES } from '@/lib/instant-quote/material-price-feed';

/** Rendered only after the enclosing internal page has authenticated the viewer. */
export async function MaterialPriceStatus() {
  const basis = await loadPrivateCalculationBasis().catch(() => null);
  const now = new Date();
  return <section aria-labelledby="material-price-status" className="mb-6 border border-white/20 bg-[#101416] p-5">
    <h2 id="material-price-status" className="text-lg font-semibold">Цены металлопроката</h2>
    <p className="mt-2 text-sm text-white/75">Автозагрузка официального PDF «Атлантик»: г/к, х/к и оцинкованный лист. Плановое обновление — дважды в сутки. Состояние таймера проверяется на сервере; время снимка само по себе не подтверждает его работу.</p>
    {!basis ? <p role="status" className="mt-4 text-amber-300">Ценовая база недоступна. Полная стоимость требует подтверждённых ставок и прайса.</p> : <>
      <p className="mt-3 break-all text-sm text-white/70">Версия базы: {basis.version}</p>
      <div className="mt-4 grid gap-3 md:grid-cols-2">{basis.materialPriceSnapshots.map((snapshot, index) => {
        const age = snapshotAgeHours(snapshot, now);
        const fresh = snapshot.status === 'ok' && age <= 72;
        const source = TRUSTED_METAL_PRICE_SOURCES.find((item) => item.id === snapshot.sourceId);
        return <article key={`${snapshot.sourceId}-${index}`} className="min-w-0 border border-white/15 p-4">
          <h3 className="break-words font-semibold">{source?.label ?? snapshot.sourceId}</h3>
          <p className={`mt-2 text-sm ${fresh ? 'text-emerald-300' : 'text-amber-300'}`}>{fresh ? 'Снимок актуален' : 'Нужны актуальные цены — автоматическая цена ограничена'}</p>
          <dl className="mt-3 space-y-2 text-sm text-white/75">
            <div><dt>Последняя загрузка</dt><dd>{new Date(snapshot.fetchedAt).toLocaleString('ru-RU')}</dd></div>
            <div><dt>Дата источника</dt><dd>{snapshot.sourceDate}</dd></div>
            <div><dt>Позиции прайса</dt><dd>{snapshot.rows.length}</dd></div>
          </dl>
          {source && <a href={source.url} className="mt-3 inline-block text-sm text-steel-orange underline underline-offset-4">Официальный прайс</a>}
        </article>;
      })}</div>
    </>}
    <p className="mt-4 text-sm text-white/70">Цена проката — закупочная составляющая. Она не является рыночной ценой готового изделия. Отсутствующие данные не заменяются нулём.</p>
  </section>;
}
