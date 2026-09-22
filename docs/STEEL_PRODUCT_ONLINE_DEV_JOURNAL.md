## Live checkpoint — утверждённые нормы, 22.09.2026

База main ad160573, PR #166 и deploy 35658195172 успешны. Владелец подтвердил: минимальное отверстие равно толщине металла; перемычка 3 мм; отдельного минимального размера нет. Рабочее поле сохраняется.
DONE: нормы подключены к серверному разбору DXF; равенства и нарушения проверены; 1240 тестов, lint, typecheck и build прошли. Автоматические измерения охватывают осевой прямоугольник с круглыми отверстиями. Непроверяемые контуры, STEP и зоны гиба сохраняют ручную проверку.
NEXT ACTION: CI точного SHA, публикация и установка отдельной сборки.

## Live checkpoint — полный рабочий выпуск калькуляторов

База main 1150337, PR #165 и deploy 35653375660 прошли; оригинальный логотип опубликован. Владелец повторно поручил завершить и публиковать весь согласованный объём: упрощённый навигационный инженер, клиентский CAD на сайте, самостоятельное производственное приложение. Платные сервисы запрещены; геометрия и производственные ставки не выдумываются. PR #163 не сливаем.

DONE: новые клиентский интерфейс и инженер; браузерные DXF/STEP на шести ширинах; 1230 тестов, lint, build; SEO 89 URL, 18 redirects, 7 gone без ошибок. Отдельное приложение: 19 тестов, реальные сохранение/восстановление CAD, копии, раскладка, экономика, документы и шесть ширин. Бесплатная локальная модель интегрирована в supervisor.

ОГРАНИЧЕНИЕ: финальная автоматическая цена удерживается старым feature-rules DFM-гейтом до появления утверждённых технологических норм. Владелец уведомлён; нормы запрошены. Не выдавать отсутствие норм за завершённую автоматизацию.
NEXT ACTION: интеграция, реальные CAD-сценарии/шесть ширин, проверки точного коммита, публикация клиентской части и отдельное обновление .app.

## Live checkpoint — оригинальный логотип калькуляторов, 21.09.2026

База main 37eeea1: клиентский PR #164 опубликован, deploy 35650219395 успешен. По прямому поручению владельца используется оригинальный public/logo/steel-product.png в клиентском CAD и обеих страницах калькулятора металлокассет. Формулы не менялись. Производственное приложение обновляется отдельной локальной поставкой.

DONE: единый компонент логотипа, lint и production build; браузерная проверка трёх маршрутов на ширине 390 px — изображения загружены, пропорции сохранены, горизонтального переполнения нет.
IN PROGRESS: выпуск логотипа.
NEXT ACTION: CI точного коммита, штатная публикация и проверка живых страниц. Глубокое исследование четырёх международных калькуляторов продолжается отдельно; этот выпуск не является завершением переработки производства.

## Live checkpoint — клиентский выпуск 21.09.2026

Владелец разрешил публикацию и уточнил: на сайте только клиентский калькулятор; производство — отдельное приложение на рабочем компьютере. Эта ветка создана от main 179d00e и содержит только клиентский CAD, проверку согласованности гибов и свежести прайса. Никакие новые production-access/production-calculator маршруты и серверный bootstrap в выпуск не входят. Автоцены обязательны в обеих версиях; существующий серверный таймер подтверждён run 35646144664. PR #163 остаётся draft и не сливается.

DONE: 1230 тестов, lint, production build; SEO 89 URL / 18 redirects / 7 gone без ошибок; реальный DXF + защита старого асинхронного результата + zoom/fit и шесть ширин экрана. Production entry 404. NEXT ACTION: отдельный PR, CI точного SHA и штатный deploy клиентского выпуска.

# Steel Product Online — постоянный журнал разработки

> Recovery/checkpoint-файл. После обрыва сначала сверить этот журнал с фактическими branch HEAD, Draft PR #90 и CI.

## Live checkpoint — 21.09.2026, выпуск ИИ-инженера

Этот блок новее исторического checkpoint от 14.09 ниже. Пользователь прямо поручил **доделать и публиковать**, затем уточнил **систему полностью с ИИ**. Оплата/checkout по-прежнему не включаются. Новые расходы требуют отдельного согласования.

- Текущий PR: **#152**, `fix/quote-engine-dialog-safety-20260921` → `main`; включает основание #151.
- Последняя подтверждённая база локального пакета: `e59cef680461c0edef0c35c68e5534383fd89458`.
- Предыдущий проверенный функциональный коммит: `52e1ff7`, GitHub Actions №723. Этот статус не переносится на новые изменения.
- Проверка production перед выпуском: run `35587857368`. В серверном окружении отсутствовали ключ, каталог и модель Yandex AI; ключи Search API; файл рыночного реестра; вебхук Битрикс24. Каталог закрытых производственных отчётов присутствовал. Значения ключей не читались в журнал.
- Публикация кода не включает платные сервисы. Пока ИИ выключен оператором, работает явно обозначенный расчёт по формулам. После включения ИИ в production его недоступность удерживает цену, если оператор явно не разрешил резервный режим.

### DONE в новом пакете
- Восемь этапов проверки доступны диалогу, CAD и отдельному расчёту кассет по площади/стене.
- Рыночное правило одинаково: `max(расчётная коммерческая цена, проверенное арифметическое среднее)`.
- CAD сравнивается только с тем же SHA-256 загруженного файла и подписью производственных параметров; нельзя подставить цену другого изделия по совпадению габаритов. Порошковая окраска без заданного цвета не считается рыночно сопоставимой.
- Для расчёта кассет по площади отдельно задаётся налоговая/технологическая база `priceBasis["facade-area"]`, диапазон площади и ставка за м². Приблизительное число кассет не подменяет оплачиваемую площадь.
- Поставщики могут автоматически обновляться через зарегистрированные структурированные JSON-первоисточники. Защита DNS/HTTPS, ограничение размера и времени, снимок исходной строки, свежесть и сопоставимость обязательны. Незарегистрированные поисковые ссылки остаются кандидатами, а не проверенными ценами.
- Последний полный расчёт с внутренними подробностями сохраняется вместе с согласованной заявкой; новое неполное уточнение удаляет старый снимок. Публичный ответ не содержит себестоимость и тарифы.
- Опциональная отправка в российский портал Битрикс24 происходит только после сохранения заявки, аудита согласия, проверки файлов и двух операторских флагов. Идентичность — номер заявки, не общий телефон; другой заказ не перезаписывается. Ошибка помечается `needs-retry`, а не «доставлено».
- Кнопка проверки кассет не запускает модель на каждом вводимом символе. При изменении параметров старая сумма скрывается сразу, устаревший запрос отменяется.
- Внутренние производственные ставки исключены из дерева выпуска. Удаление файла из Git-истории не заявляется.

### IN PROGRESS / NEXT ACTION
- Перенести протестированный пакет в PR, выполнить CI на новом SHA и проверить браузер.
- Выполнить разрешённую публикацию штатным deploy с сохранением обновлений `main`, подтвердить активный BUILD_COMMIT и публичные маршруты.
- Активация живого ИИ/поиска требует реальных серверных настроек и согласованного расхода. Не выдавать mock-тесты за live-вызовы и не включать расход автоматически.
- Нужны реальные сопоставимые предложения/адаптеры первоисточников; универсальный разбор произвольной HTML-страницы не реализован. В отсутствие источников цена честно остаётся расчётной.
- Для CRM нужен разрешённый вебхук и согласование передачи данных; автоматический фоновый retry-демон не запущен.

---

## 0. Протокол восстановления

1. Проверить `feat/steel-product-online-clean-alpha-sep14` и Draft PR #90.
2. Сравнить HEAD с `Last GREEN verified tree` и `Last functional implementation SHA`.
3. Journal-only commits не считать новой функциональностью; GREEN относится только к точному проверенному SHA.
4. Любой RED исправлять до нового functional layer.
5. Не переписывать DONE-блоки без конкретного regression/CI evidence.

---

## 1. FINAL REVIEW CHECKPOINT

**Обновлено:** 2026-09-14

- Репозиторий: `alexeyborisov19-sys/alexeyborisov19-sys-steel-probuct`
- Ветка: `feat/steel-product-online-clean-alpha-sep14`
- Draft PR: **#90 — `Steel Product Online: sanitized clean alpha snapshot`**
- Base: `main`
- PR должен оставаться: `open`, `draft`, `merged=false`
- Публикация/deploy: **НЕ ДЕЛАТЬ**
- Merge в `main`: **НЕ ДЕЛАТЬ**
- Payment/checkout: **НЕ РАЗРАБАТЫВАТЬ**

### READY FOR REVIEW BEFORE PUBLICATION

Feature development для текущей pre-release версии остановлен. Новые geometry features до проверки владельцем не добавлять.

- **Last functional implementation SHA:** `fb54a1e0d140662608a85e92b8b3bf92c898f965`
- Functional block: strict exact-safe linear planar DXF SPLINE subset + regressions.
- **Latest stabilization SHA:** `c912cafba2d2857c66bd25bc9854b6125201841c`
- Stabilization block: regression-only malformed legacy POLYLINE matrix; production parser не менялся.
- **FINAL REVIEW CANDIDATE HEAD:** `a47dccda70d2666d3cc78136b3d7f8deae87fa0a`
- **Last GREEN verified tree HEAD:** `a47dccda70d2666d3cc78136b3d7f8deae87fa0a`
- CI на `a47dccda…` полностью GREEN:
  - `Steel Product Online Alpha CI`: TypeScript ✅, Unit tests ✅, Next.js build ✅
  - `Verify project package`: Lint ✅, Typecheck ✅, Tests ✅, Build ✅, SEO audit ✅
- Draft PR #90 на момент проверки: `open`, `draft`, `merged=false`, mergeable=true.
- Этот checkpoint — окончательная версия текущего pre-release scope для ручной проверки владельцем перед решением о публикации.

---

## 2. Жёсткие решения владельца

### Продукт
`CAD → геометрия → DFM → материал/толщина → операции → фактический производственный расчёт → безопасный клиентский результат`.

### Конфиденциальность
Клиенту не показывать:
- supplier prices и private rates;
- direct cost, margin/coefficients;
- manufacturing norms;
- внутренние mass/waste/cut/pierce breakdown;
- detailed internal DFM и production evidence;
- report IDs/paths/storage evidence;
- `powderAreaM2`, `assemblyMinutes`, `surfacePreparationAreaM2`, authoritative factual provenance.

Public/client boundary содержит только безопасный CAD/preview, безопасные размеры, выбранные material/thickness/quantity/operations, coarse status и в будущем отдельно утверждённую sales price/delivery.

### Расчёт
- Laser = фактический контур.
- Material до реального nesting = bounding rectangle вокруг детали, включая scrap.
- Missing physical input/rate = `missing/partial`, не ноль.
- Реальные rates/supplier prices = private runtime basis, не Git/client bundle.
- Аппроксимацию нельзя выдавать за factual production value.
- Unverified/bent STEP остаётся fail-closed для pricing/CAM.

---

## 3. DONE — pre-release scope

### Public/client safety
- client-safe `/online-order` workspace и safe calculation DTO;
- server повторно анализирует CAD перед confidential calculation;
- private economics/DFM/report modules не входят в client boundary;
- `tests/online-order-confidentiality.test.ts` запрещает private economics/production evidence в public workspace/DTO;
- public supplier seed не содержит supplier prices;
- публичный supplier-pricing API/client price service отсутствует.

### Candidate/release safety
- `tests/deploy-candidate-build.test.ts` входит в общий `tests/*.test.ts` GREEN suite;
- candidate build проверяется до замены active build;
- build commit identity проверяется;
- rollback build сохраняется до production redirect audit;
- interrupted promotion имеет service-restore guard;
- **этим checkpoint никакой deploy/publish не выполнялся**.

### STEP
- OpenCascade/BRep analysis;
- planar/cylindrical evidence;
- topology/unfold/flat-pattern verification gates;
- verified planar STEP path;
- server-only exact STEP boundary surface area для internal coating evidence;
- authoritative factual evidence остаётся только в confidential snapshots/revisions;
- unverified/bent STEP не promoted в pricing/CAM.

### Internal factual calculation
- private runtime rate book + supplier snapshot basis;
- bending/welding/powder/assembly/surface-preparation/packaging;
- internal immutable revisions, RBAC/CSRF/report lineage;
- manual technologist override выше automatic evidence;
- missing rate/input остаётся partial/missing.

### Supplier feed
- protected Atlantik refresh/parser/snapshot flow;
- HTTPS allowlist, PDF validation, SHA-256, dry-run/persist, atomic private replacement;
- METALLSERVIS не authoritative до стабильного official machine endpoint.

### DXF — supported factual subset
- `LINE`;
- `CIRCLE`;
- `ARC` — analytic bounds/length;
- `LWPOLYLINE`;
- simple planar legacy `POLYLINE → VERTEX* → SEQEND`;
- straight closed-polyline exact area/hole topology;
- polyline bulge exact bounds + cut length + curved preview;
- `ELLIPSE` full/partial с analytic bounds и controlled numerical length; full ellipse имеет exact area/containment/hole topology;
- strict linear planar `SPLINE`: degree 1, open, non-periodic, non-rational, planar+linear flags, Z=0, +Z/default normal, valid counts, valid open-clamped knot vector, weights absent/all 1; normalizes to exact open straight polyline.

### Regression-only malformed legacy POLYLINE
`c912cafb…` подтверждает fail-closed без parser changes для:
- missing `SEQEND`;
- unexpected nested entity;
- missing X/Y vertex coordinate;
- fewer than two valid vertices.

### Intentionally fail-closed
- bulged closed polyline exact area/pierces пока unavailable;
- legacy 3D/polyface/mesh/complex POLYLINE;
- nonlinear, rational, periodic, closed, 3D или malformed SPLINE;
- non-planar/invalid ELLIPSE;
- unverified/bent STEP pricing/CAM;
- DXF powder coating area без explicit sides.

---

## 4. Последние CI incidents — закрыты

### External image availability
Tree `eb50b7a…`: application tests/build GREEN, SEO audit получил 504 от third-party `static.mk.ru` через Next optimizer.

Fix:
- `f508be1fa2791113acaa3d0bac525af513b3602f`: deterministic first-party image availability audit; remote optimizer availability не считается доступностью нашего сайта.
- third-party media policy/config остаётся под отдельными regressions.

### Regression test contract
Tree `e6b3e30…`: новый SEO-boundary regression упал до build/SEO; production audit/SPLINE не менялись.

Fixes:
- `eee04cb9541fdf2e54e79d230a973c43e8350d57`: test-only stabilization через `process.cwd()`/`node:path`;
- `0c6e10bbc996978016a0dd2e3a671cc987d29839`: collector-contract correction;
- `961c43c0…`: оба workflow GREEN, включая реальный SEO audit.

---

## 5. Manual review checklist

Перед любым решением о публикации владельцу проверить:
1. `/online-order`: upload DXF/STEP, preview, безопасные dimensions/material/thickness/quantity/operations/status.
2. Supported DXF fixtures: line/polyline/bulge/ellipse/strict linear spline.
3. Fail-closed UX для unsupported curved/3D/nonlinear CAD.
4. Internal production report/revision flow отдельно от client UI.
5. Client network/UI не раскрывает rates, supplier prices, costs, DFM/evidence или factual internal inputs.
6. Candidate-build/rollback pipeline запускать только после отдельного решения на deploy.

---

## 6. NEXT ACTION

**Текущий pre-release scope завершён. Feature development остановить до ручного review.**

1. Считать `a47dccda70d2666d3cc78136b3d7f8deae87fa0a` последним подтверждённым FINAL REVIEW CANDIDATE после GREEN обоих workflow.
2. Текущий journal-only commit должен пройти оба workflow; если GREEN — он становится новым metadata-only review checkpoint, функциональный candidate остаётся `a47dccda…`.
3. Отдать владельцу на ручную проверку `/online-order` и внутреннего review flow перед публикацией.
4. Не deploy/publish/merge до отдельного прямого указания владельца.
5. Defects из ручного review исправлять regression-first отдельным блоком с новым CI gate.

---

## 7. Запрещено без нового прямого решения владельца

- merge `main`;
- deploy/publish;
- payment/checkout;
- release/prerelease publication;
- public internal economics/DFM/evidence;
- реальные private rates/prices в Git/client;
- approximate/unsupported geometry как production-authoritative.

---

## 8. Key changelog

- private STEP surface evidence + confidential provenance;
- internal assembly/surface-preparation revision path;
- DXF bulge analytic bounds/length/preview;
- legacy planar POLYLINE safe parser;
- analytic/controlled DXF ELLIPSE;
- strict exact degree-1 planar SPLINE;
- deterministic first-party SEO image availability audit;
- malformed legacy POLYLINE regression-only hardening;
- confidentiality and candidate-build regressions included in full GREEN suite;
- `a47dccda…` = fully verified FINAL REVIEW CANDIDATE before this metadata-only journal checkpoint.
- явная наценка владельца на металл в фактическом расчёте (`STEEL_PRODUCT_METAL_UPLIFT_PCT`, по умолчанию 5 %), значение только на сервере;
- systemd-таймер обновления прайса поставщика `deploy/systemd/steelprodukt-metal-prices.*` (дважды в сутки, внутри 72-часового окна свежести). Перед установкой администратор обязан проверить фактические пути `npm`, права пользователя `nodejs` и выполнить `npm run prices:refresh -- --dry-run`; до этого автообновление цен нельзя считать включённым на production.
- оговорка о предварительности расчёта вынесена в общую константу `CALCULATION_DISCLAIMER` и показывается рядом с ценой, в статусе позиции, в мобильной панели и в печатном КП, со ссылкой на `/legal/terms`;
- «Подготовка поверхности» не могла посчитаться: ей нужна площадь, которой нет в CAD. Число сторон теперь задаётся так же, как у окраски, и все шесть операций конфигуратора действительно рассчитываются — это зафиксировано в `tests/calculator-operation-coverage.test.ts`;
- ВАЖНО про валидацию окружения: `lib/quote/handler.ts` возвращает 503 на форме заявки при ЛЮБОЙ проблеме из `validateProductionEnvironment`. Поэтому переменные, нужные только таймеру прайсов или наценке на металл, обязательными делать нельзя — проверяется только формат, когда значение задано.
