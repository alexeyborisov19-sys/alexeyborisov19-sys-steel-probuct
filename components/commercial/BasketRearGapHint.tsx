"use client";
/** A model-specific starting point, never an automatically approved clearance. */
export function BasketRearGapHint({ onApply }: { onApply: (mm: number) => void }) {
  return <details className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-700">
    <summary className="cursor-pointer text-xs font-medium leading-5">Не знаете задний зазор? Посмотреть ориентир</summary>
    <p className="mt-2 text-xs leading-5">Для предварительной оценки можно подставить 100 мм. Такой задний зазор указан для Mitsubishi Electric MUY-GK18VA при соблюдении условий свободного пространства с других сторон. Для вашей модели и корзины требования могут отличаться.</p>
    <button type="button" onClick={() => onApply(100)} className="mt-2 min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold">Взять ориентир 100 мм</button>
    <p className="mt-2 text-xs leading-5">Перед изготовлением обязательно сверьте зазор с инструкцией своего кондиционера и конструкцией экрана. <a className="underline underline-offset-2" href="https://www.mitsubishielectric.com.hk/uploads/download/430/MSY-GK18VA_GF24VA.pdf" target="_blank" rel="noopener noreferrer">Пример инструкции производителя, стр. 2 PDF</a>.</p>
  </details>;
}
