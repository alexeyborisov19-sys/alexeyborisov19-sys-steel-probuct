from pathlib import Path

page_path = Path('app/(public)/production/page.tsx')
test_path = Path('tests/production-page-positioning.test.ts')
text = page_path.read_text()

replacements = {
    'title: "Инженерная подготовка",': 'title: "Инженерно-конструкторский центр",',
    'description: "Проработка конструкции и производственной документации.",': 'description: "Разработка и проверка КД, технологическая подготовка и сопровождение изделия до запуска в производство.",',
    'description: "Сварка и сборка металлоизделий на производственном участке.",': 'description: "Сварка и сборка металлоизделий на одном из четырёх сварочных постов.",',
    'title: "Работа производственного участка",': 'title: "Производственная команда",',
    'Оборудование и участки — без рендеров': 'Реальное производство — без рендеров',
    'Фотографии действующего производства «Сталь Продукт»: инженерная подготовка,\n              лазерная резка, гибка, сварка и работа специалистов в цехе.': 'Фотографии действующего производства «Сталь Продукт»: инженерно-конструкторский центр,\n              лазерные комплексы, гибочное производство, сварочно-сборочное направление и работа специалистов в цехе.',
}

for old, new in replacements.items():
    if old not in text:
        raise SystemExit(f'copy fragment not found: {old}')
    text = text.replace(old, new)

page_path.write_text(text)

test = test_path.read_text()
if 'Реальное производство — без рендеров' not in test:
    test = test.replace('  "Реальное производство",\n', '  "Реальное производство",\n  "Реальное производство — без рендеров",\n')
if 'assert.doesNotMatch(page, /Оборудование и участки/' not in test:
    test = test.replace('  assert.match(page, /реальное производство «Сталь Продукт»/i);', '  assert.match(page, /реальное производство «Сталь Продукт»/i);\n  assert.doesNotMatch(page, /Оборудование и участки/);')
test_path.write_text(test)
