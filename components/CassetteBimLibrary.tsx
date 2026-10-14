import models from "@/data/bim/cassette-library.json";

const base = "/bim/metallokassety";
const sizing = "/bim/metallokassety-parametric/index.html";
const format = (value: number) => value.toLocaleString("ru-RU", { maximumFractionDigits: 3 });

export function CassetteBimLibrary() {
  return (
    <section id="bim-library" aria-labelledby="bim-library-title" className="mt-8 scroll-mt-28 rounded-xl border border-slate-300 bg-white p-5 sm:p-7">
      <h2 id="bim-library-title" className="text-xl font-semibold">Библиотека готовых моделей IFC</h2>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
        15 исходных образцов: 9 металлокассет и 6 доборных элементов. Выберите деталь, измените доступные габариты и скачайте перестроенный IFC. Для раскладки фасадного фрагмента используйте генератор выше.
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
        <a href={sizing} className="rounded-lg bg-orange-800 px-5 py-3 text-sm font-semibold text-white">Выбрать модель и изменить размеры</a>
        <a href={`${base}/index.html`} className="rounded-lg border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-900">3D-каталог исходных образцов</a>
        <a href={`${base}/SteelProdukt_BIM_IFC_Public.zip`} download className="rounded-lg border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-900">Скачать исходные IFC — ZIP</a>
        <a href={`${base}/SteelProdukt_Catalog_IFC4.ifc`} download className="rounded-lg border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-900">Общий IFC-каталог</a>
      </div>
      <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-600">
        В конфигураторе изменяется геометрия прямых участков, а не только подписи размеров. Форма гибов и отверстий защищена; по осям без прямых участков размер фиксирован. Габариты X/Y/Z не являются лицевыми размерами или развёрткой. Диапазоны перестройки не заменяют ограничения производства.
      </p>
      <details className="mt-5 border-t border-slate-200 pt-4">
        <summary className="cursor-pointer font-semibold">Все 15 образцов и отдельные файлы</summary>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[660px] text-left text-sm">
            <caption className="sr-only">Исходные образцы металлокассет и доборных элементов</caption>
            <thead><tr className="border-b border-slate-300"><th scope="col" className="p-3">Образец</th><th scope="col" className="p-3">Исходные габариты X × Y × Z, мм</th><th scope="col" className="p-3">Толщина, мм</th><th scope="col" className="p-3">Модель и IFC</th></tr></thead>
            <tbody>{models.map(model => (
              <tr key={model.id} className="border-b border-slate-200 align-top">
                <th scope="row" className="p-3 font-medium">{model.name}<span className="mt-1 block text-xs font-normal text-slate-500">{model.id}</span></th>
                <td className="whitespace-nowrap p-3 text-slate-600">{model.bboxMm.map(format).join(" × ")}</td>
                <td className="p-3 text-slate-600">{format(model.thicknessMm)}</td>
                <td className="p-3"><div className="flex flex-wrap gap-3 font-semibold text-orange-800"><a href={`${sizing}?model=${model.id}`} aria-label={`Изменить размеры: ${model.name}`} className="underline underline-offset-4">Изменить размеры</a><a href={`${base}/IFC4_coordination/${model.id}.ifc`} download aria-label={`IFC для координации: ${model.name}`} className="underline underline-offset-4">Исходный координационный</a><a href={`${base}/IFC4_exact_geometry/${model.id}.ifc`} download aria-label={`Точный IFC: ${model.name}`} className="underline underline-offset-4">Исходный точный</a></div></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </details>
      <div className="mt-5 rounded-lg bg-amber-50 p-4 text-sm leading-6 text-slate-700">
        <p><strong>Изменяемые размеры в веб-конфигураторе — не параметрические семейства RFA.</strong> Скачанный IFC содержит выбранную геометрию. Для повторной перестройки сохраните настройки JSON и откройте их в конфигураторе. Материал, покрытие, RAL и масса автоматически не назначаются.</p>
        <p className="mt-2">Исходные IFC остаются фиксированными образцами: координационная сетка и точная геометрия представляют одно изделие, а не две разные детали. Расстановка общего каталога демонстрационная. Импорт в Revit/Archicad и инженерное утверждение конкретного изделия отдельно не подтверждены.</p>
        <a href={`${base}/QA_REPORT_RU.md`} download className="mt-3 inline-block font-semibold text-orange-800 underline underline-offset-4">Отчёт о проверках исходной библиотеки</a>
      </div>
    </section>
  );
}
