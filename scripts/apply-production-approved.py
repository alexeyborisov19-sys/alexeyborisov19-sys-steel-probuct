from pathlib import Path

page_path = Path('app/(public)/production/page.tsx')
text = page_path.read_text()

text = text.replace('  productionLeadTimeSummary,\n  productionOrderConditions,\n', '  productionLeadTimeSummary,\n')

old_metadata = '''  title: "Производство изделий из листового металла",\n  description:\n    `Производство изделий по КД: лазерная резка чёрной стали ${laserCuttingCapabilities.thicknessRange} на столе ${laserCuttingCapabilities.tableWorkingArea}, гибка, сварка и окраска.`,'''
new_metadata = '''  title: "Производство полного цикла изделий из листового металла",\n  description:\n    `Инженерно-конструкторский центр и собственная производственная база: ${productionEquipment.laserComplexes} лазерных комплекса, ${productionEquipment.pressBrakes} листогибочных комплекса, панельгиб, ${productionEquipment.weldingStations} сварочных поста и ${productionEquipment.powderCoatingBooths} камеры порошковой окраски. От КД до готовой партии.`,'''
if old_metadata not in text:
    raise SystemExit('metadata block not found')
text = text.replace(old_metadata, new_metadata)

old_stages = '''const stages = [
  ["Проектирование", "/images/real-production/engineering-department.jpg", "Проверяем технологичность, сопряжения и развёртки.", "/production/proektirovanie-metalloizdeliy"],
  ["Раскрой", "/images/real-production/laser-cutting-action.jpg", "Оптимизируем размещение деталей и контролируем геометрию.", "/production/lazernaya-rezka-metalla"],
  ["Гибка", "/images/real-production/press-brake-durma.jpg", "Контролируем углы, размеры и повторяемость партии.", "/production/gibka-listovogo-metalla"],
  ["Сварка", "/images/real-production/welding-station.jpg", "Проверяем сборку, швы и геометрию изделия.", "/production/svarka-i-sborka-metalloizdeliy"],
  ["Покраска", "/images/web/cycle-powder-coating.jpg", "Контролируем подготовку поверхности и качество покрытия.", "/production/poroshkovaya-okraska-metalla"],
  ["Отгрузка", "/images/web/cycle-quality-control.jpg", "Проверяем комплектность, маркировку и упаковку.", "/production/kontrol-kachestva-i-upakovka"],
] as const;'''
new_stages = '''const stages = [
  ["Инженерно-конструкторский центр", "/images/real-production/engineering-department.jpg", "КД, технологическая подготовка, опытный образец и подготовка изделия к серийному выпуску.", "/production/proektirovanie-metalloizdeliy"],
  ["Лазерный раскрой", "/images/real-production/laser-cutting-action.jpg", "Раскрой деталей на собственных лазерных комплексах и подготовка партии к следующим операциям.", "/production/lazernaya-rezka-metalla"],
  ["Гибочное производство", "/images/real-production/press-brake-durma.jpg", "Листогибочные комплексы и панельгиб для формирования геометрии и повторяемости деталей.", "/production/gibka-listovogo-metalla"],
  ["Сварочно-сборочное направление", "/images/real-production/welding-station.jpg", "Слесарно-доводочные операции, сварка и сборка деталей и узлов в одном производственном контуре.", "/production/svarka-i-sborka-metalloizdeliy"],
  ["Подготовка поверхности и порошковая окраска", "/images/web/cycle-powder-coating.jpg", "Дробеструйная и лазерная очистка по согласованной технологии, затем порошковая окраска.", "/production/poroshkovaya-okraska-metalla"],
  ["Контроль, комплектация и упаковка", "/images/web/cycle-quality-control.jpg", "Финальный контроль, маркировка, комплектация, упаковка и подготовка партии к отгрузке.", "/production/kontrol-kachestva-i-upakovka"],
] as const;'''
if old_stages not in text:
    raise SystemExit('stage block not found')
text = text.replace(old_stages, new_stages)

photo_replacements = {
    'title: "Инженерная подготовка",': 'title: "Инженерно-конструкторский центр",',
    'description: "Проработка конструкции и производственной документации.",': 'description: "Разработка и проверка КД, технологическая подготовка и сопровождение изделия до запуска в производство.",',
    'description: "Сварка и сборка металлоизделий на производственном участке.",': 'description: "Сварка и сборка металлоизделий на одном из четырёх сварочных постов.",',
    'title: "Работа производственного участка",': 'title: "Производственная команда",',
}
for old, new in photo_replacements.items():
    if old not in text:
        raise SystemExit(f'photo copy fragment not found: {old}')
    text = text.replace(old, new)

text = text.replace(
    '["Дробеструйная очистка", "Подготавливаем поверхность металла по согласованной технологии перед дальнейшими операциями и нанесением покрытия."],\n  ["Лазерная очистка", "Удаляем локальные загрязнения, окислы и покрытия в рамках согласованной технологической подготовки поверхности."],',
    '[`${productionEquipment.shotBlastingChambers} дробеструйная камера`, "Дробеструйная очистка: подготавливаем поверхность металла по согласованной технологии перед дальнейшими операциями и нанесением покрытия."],\n  [`${productionEquipment.laserCleaningSystems} система лазерной очистки`, "Лазерная очистка: удаляем локальные загрязнения, окислы и покрытия в рамках согласованной технологической подготовки поверхности."],',
)

old_hero = '      description="Инженерно-конструкторская подготовка, лазерный раскрой, гибка, сварка, сборка, подготовка поверхности, окраска, контроль, комплектация и упаковка в одном согласованном маршруте."'
new_hero = '      description="От инженерно-конструкторской подготовки до готовой партии: раскрой, гибка, сварка, сборка, подготовка поверхности, порошковая окраска, контроль, комплектация и упаковка."'
if old_hero not in text:
    raise SystemExit('hero description not found')
text = text.replace(old_hero, new_hero)

old_stats = '''          {[
            [laserCuttingCapabilities.thicknessRange, "чёрная сталь"],
            [laserCuttingCapabilities.tableWorkingArea, "рабочее поле стола"],
            [productionOrderConditions.typicalLeadTime, "средний срок изготовления"],
            ["По КД / ТЗ", "от единичной детали до серии"],
          ].map(([value, label]) => ('''
new_stats = '''          {[
            [laserCuttingCapabilities.thicknessRange, "Лазерная резка чёрной стали"],
            [laserCuttingCapabilities.tableWorkingArea, "Формат обрабатываемого листа"],
            ["От 1 детали до серии", "Изготовление по КД и ТЗ заказчика"],
            ["Полный производственный цикл", "От инженерной подготовки до готовой партии"],
          ].map(([value, label]) => ('''
if old_stats not in text:
    raise SystemExit('KPI block not found')
text = text.replace(old_stats, new_stats)

start = text.index('      <section className="border-b border-white/10 bg-[#0c1013] py-12 sm:py-16">')
end = text.index('      <ProductionShowreel />', start)
proof_block = '''      <section className="border-b border-white/10 bg-[#0c1013] py-12 sm:py-16">
        <div className="container grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            ["Производство полного цикла", "От инженерно-конструкторской подготовки до готовой партии: раскрой, гибка, сварка, сборка, подготовка поверхности, порошковая окраска, контроль, комплектация и упаковка."],
            ["От задачи до серийного выпуска", "Работаем по КД, техническому заданию или образцу. Прорабатываем технологию, изготавливаем опытный образец и переводим согласованное изделие в повторяемую серию."],
            ["Собственная производственная база", `${productionEquipment.laserComplexes} лазерных комплекса, ${productionEquipment.pressBrakes} листогибочных комплекса, панельгиб, ${productionEquipment.weldingStations} сварочных поста, дробеструйная и лазерная очистка, ${productionEquipment.powderCoatingBooths} камеры порошковой окраски, сборка и упаковка.`],
            ["Инженерия + производство в одном контуре", "Инженерно-конструкторский центр работает вместе с производством: конструкция сразу прорабатывается с учётом технологии изготовления, сборки и дальнейшего серийного выпуска."],
          ].map(([title, text], index) => <article key={title} className="border border-white/12 bg-[#111519] p-5"><span className="font-mono text-sm font-bold text-steel-orange">{String(index + 1).padStart(2, "0")}</span><h2 className="mt-5 text-base font-semibold uppercase">{title}</h2><p className="mt-3 text-sm leading-6 text-white/58">{text}</p></article>)}
        </div>
      </section>
'''
text = text[:start] + proof_block + text[end:]

text = text.replace('<h2 className="text-3xl font-semibold">Производственный цикл</h2>', '<p className="eyebrow">Инженерия + производство в одном контуре</p>\n          <h2 className="mt-3 text-3xl font-semibold">Производственный маршрут от задачи до готовой партии</h2>')
text = text.replace('Оборудование и участки — без рендеров', 'Реальное производство — без рендеров')
text = text.replace(
    'Фотографии действующего производства «Сталь Продукт»: инженерная подготовка,\n              лазерная резка, гибка, сварка и работа специалистов в цехе.',
    'Фотографии действующего производства «Сталь Продукт»: инженерно-конструкторский центр,\n              лазерные комплексы, гибочное производство, сварочно-сборочное направление и работа специалистов в цехе.',
)
text = text.replace('<h2 className="text-3xl font-semibold">Наши возможности</h2>', '<p className="eyebrow">Собственная производственная база</p>\n          <h2 className="mt-3 text-3xl font-semibold">Мощности полного производственного цикла</h2>')

page_path.write_text(text)

test_path = Path('tests/production-page-positioning.test.ts')
test_path.write_text('''import assert from "node:assert/strict";\nimport { readFile } from "node:fs/promises";\nimport test from "node:test";\n\nconst productionPagePath = new URL("../app/(public)/production/page.tsx", import.meta.url);\n\nconst requiredPhrases = [\n  "Производство полного цикла",\n  "Лазерная резка чёрной стали",\n  "Формат обрабатываемого листа",\n  "От 1 детали до серии",\n  "Изготовление по КД и ТЗ заказчика",\n  "От инженерной подготовки до готовой партии",\n  "От задачи до серийного выпуска",\n  "Собственная производственная база",\n  "Инженерия + производство в одном контуре",\n  "Инженерно-конструкторский центр",\n  "Гибочное производство",\n  "Слесарно-доводочные операции",\n  "Сварочно-сборочное направление",\n  "Сборочное производство",\n  "Подготовка поверхности",\n  "Дробеструйная очистка",\n  "Лазерная очистка",\n  "Порошковая окраска",\n  "Контроль качества, комплектация и упаковка",\n  "Реальное производство — без рендеров",\n];\n\ntest("production page keeps the approved full-cycle positioning and terminology", async () => {\n  const page = await readFile(productionPagePath, "utf8");\n\n  for (const phrase of requiredPhrases) {\n    assert.ok(page.includes(phrase), `production page must keep: ${phrase}`);\n  }\n\n  assert.match(page, /productionEquipment\\.laserComplexes/);\n  assert.match(page, /productionEquipment\\.pressBrakes/);\n  assert.match(page, /productionEquipment\\.panelBenders/);\n  assert.match(page, /productionEquipment\\.weldingStations/);\n  assert.match(page, /productionEquipment\\.powderCoatingBooths/);\n  assert.match(page, /productionEquipment\\.shotBlastingChambers/);\n  assert.match(page, /productionEquipment\\.laserCleaningSystems/);\n  assert.match(page, /реальное производство «Сталь Продукт»/i);\n  assert.doesNotMatch(page, /Оборудование и участки/);\n});\n''')

for phrase in [
    '0,5–40 мм',
    '1500 × 3000 мм',
    'От 1 детали до серии',
    'Производство полного цикла',
    'От задачи до серийного выпуска',
    'Собственная производственная база',
    'Инженерия + производство в одном контуре',
]:
    if phrase not in text:
        raise SystemExit(f'missing approved phrase: {phrase}')
