import guide from "@/data/bim/cassette-joints.json";

export function CassetteJointGuide() {
  return <section id="bim-joints" aria-labelledby="bim-joints-title" className="mt-8 scroll-mt-28 rounded-xl border border-slate-300 bg-white p-5 sm:p-7">
    <p className="text-xs font-semibold uppercase tracking-wider text-orange-800">Для проектной проработки</p>
    <h2 id="bim-joints-title" className="mt-2 text-2xl font-semibold">Узлы и примыкания</h2>
    <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">Рядовой стык, окно, угол и край фасада требуют разных проверок. Для каждого участка ниже разделены открытый и закрытый типы. Это карта согласования, а не комплект утверждённых монтажных узлов.</p>
    <div className="mt-5 grid gap-3 sm:grid-cols-3">{[
      ["Лицевой шов", "Видимое расстояние между гранями облицовки."],
      ["Монтажный модуль", "Шаг расположения изделий в проектной сетке."],
      ["Зазор в соединении", "Свободное пространство внутри конкретного зацепа или примыкания."],
    ].map(([name, description]) => <div key={name} className="rounded-lg border border-slate-200 bg-slate-50 p-4"><h3 className="text-sm font-semibold">{name}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{description}</p></div>)}</div>
    <p className="mt-4 text-sm leading-6 text-slate-600">Эти величины не заменяются одним полем «шов». Отсутствие пересечения габаритных прямоугольников не подтверждает замок, крепёж, траекторию сборки или температурное перемещение.</p>
    <div className="mt-6 grid gap-3 lg:grid-cols-2">{guide.cases.map(item => <details key={item.id} id={`bim-${item.id}`} className="min-w-0 rounded-lg border border-slate-300 p-4">
      <summary className="min-h-11 cursor-pointer"><span className="block text-xs font-medium text-slate-500">{item.group}</span><span className="mt-1 block text-base font-semibold">{item.title}</span></summary>
      <div className="mt-4 space-y-3 text-sm leading-6"><p><strong>Открытый тип.</strong> {item.open}</p><p><strong>Закрытый тип.</strong> {item.closed}</p>
        <h3 className="pt-2 font-semibold">Что должно быть определено в проекте</h3><ul className="list-disc space-y-1 pl-5 text-slate-600">{item.required.map(value => <li key={value}>{value}</li>)}</ul>
        <p className="rounded-md bg-amber-50 p-3 text-amber-950">Рабочий узел, положение деталей и проверки собираемости ещё не утверждены. Готовый IFC-сборочный узел здесь не предлагается.</p>
        <p className="text-xs text-slate-500">Справочная основа: каталог примыканий «Сталь Продукт», рабочая редакция 01, страницы {item.ownCatalogPages.join(", ")}. Это не замена рабочей документации объекта.</p>
      </div>
    </details>)}</div>
    <details className="mt-6 border-t border-slate-200 pt-4"><summary className="min-h-11 cursor-pointer py-2 font-semibold">Источники и границы применения</summary><div className="mt-3 space-y-4 text-sm leading-6 text-slate-600"><p>Изучены публичные документы производителей, перечисленных ниже. Они используются для методики проверки и структуры библиотеки. Их размеры, крепёж, материалы, испытания и разрешения не присваиваются нашим изделиям. Подсистема выбирается проектом и не добавляется автоматически в номенклатуру «Сталь Продукт».</p>
      {guide.sources.map(source => <p key={source.id}><a href={source.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-orange-800 underline underline-offset-4">{source.manufacturer} — {source.title}</a><span className="block">{source.application}</span><span className="text-xs">{source.revision}. Проверено: {guide.checkedOn}.</span></p>)}
    </div></details>
  </section>;
}
