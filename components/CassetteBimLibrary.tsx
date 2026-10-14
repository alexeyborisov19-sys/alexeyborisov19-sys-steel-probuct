import models from "@/data/bim/cassette-library.json";

const base = "/bim/metallokassety";
const format = (value: number) => value.toLocaleString("ru-RU", { maximumFractionDigits: 3 });

export function CassetteBimLibrary() {
  return (
    <section id="bim-library" aria-labelledby="bim-library-title" className="mt-8 scroll-mt-28 rounded-xl border border-slate-300 bg-white p-5 sm:p-7">
      <h2 id="bim-library-title" className="text-xl font-semibold">Библиотека готовых моделей IFC</h2>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
        15 образцов из исходных STEP: 9 металлокассет и 6 доборных элементов. Здесь сохраняются размеры конкретных деталей. Для настройки фасадного фрагмента используйте генератор выше.
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
        <a href={`${base}/index.html`} className="rounded-lg bg-slate-900 px-5 py-3 text-sm font-semibold text-white">Открыть 3D-каталог</a>
        <a href={`${base}/SteelProdukt_BIM_IFC_Public.zip`} download className="rounded-lg border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-900">Скачать все IFC — ZIP</a>
        <a href={`${base}/SteelProdukt_Catalog_IFC4.ifc`} download className="rounded-lg border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-900">Общий IFC-каталог</a>
      </div>
      <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-600">
        IFC для координации содержит замкнутую треугольную сетку. Точный IFC сохраняет аналитические и сплайновые поверхности. Это два представления одного изделия: не вставляйте оба как разные детали. Расстановка в общем каталоге демонстрационная, не монтажная.
      </p>
      <details className="mt-5 border-t border-slate-200 pt-4">
        <summary className="cursor-pointer font-semibold">Все 15 образцов и отдельные файлы</summary>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[660px] text-left text-sm">
            <caption className="sr-only">Исходные образцы металлокассет и доборных элементов</caption>
            <thead><tr className="border-b border-slate-300"><th scope="col" className="p-3">Образец</th><th scope="col" className="p-3">Габариты X × Y × Z, мм</th><th scope="col" className="p-3">Толщина, мм</th><th scope="col" className="p-3">Скачать IFC</th></tr></thead>
            <tbody>{models.map(model => (
              <tr key={model.id} className="border-b border-slate-200 align-top">
                <th scope="row" className="p-3 font-medium">{model.name}<span className="mt-1 block text-xs font-normal text-slate-500">{model.id}</span></th>
                <td className="whitespace-nowrap p-3 text-slate-600">{model.bboxMm.map(format).join(" × ")}</td>
                <td className="p-3 text-slate-600">{format(model.thicknessMm)}</td>
                <td className="p-3"><div className="flex flex-wrap gap-3 font-semibold text-orange-800"><a href={`${base}/IFC4_coordination/${model.id}.ifc`} download aria-label={`IFC для координации: ${model.name}`} className="underline underline-offset-4">Координационный</a><a href={`${base}/IFC4_exact_geometry/${model.id}.ifc`} download aria-label={`Точный IFC: ${model.name}`} className="underline underline-offset-4">Точный</a></div></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </details>
      <div className="mt-5 rounded-lg bg-amber-50 p-4 text-sm leading-6 text-slate-700">
        <p><strong>Фиксированные образцы, не параметрические семейства.</strong> Изменение свойств не перестраивает геометрию. Габариты X/Y/Z — не лицевые размеры кассеты; толщина измерена по исходной модели. Материал, покрытие, RAL и масса не назначены.</p>
        <p className="mt-2">Полная EXPRESS/MVD-валидация и импорт в Revit/Archicad не подтверждены. Модели не утверждены для производства; перед применением проверьте импорт, единицы и положение в своей программе.</p>
        <a href={`${base}/QA_REPORT_RU.md`} download className="mt-3 inline-block font-semibold text-orange-800 underline underline-offset-4">Отчёт о выполненных проверках</a>
      </div>
    </section>
  );
}
