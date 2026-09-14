# Steel Product Online — постоянный журнал разработки

> Основной recovery/checkpoint-файл проекта. После любого обрыва соединения, новой сессии или потери контекста сначала читать этот файл, затем сверять его с реальным HEAD/CI и только после этого продолжать разработку.

## 0. Обязательный протокол после сброса

1. Прочитать этот файл целиком.
2. Получить актуальный HEAD ветки `feat/steel-product-online-clean-alpha-sep14` и состояние Draft PR #90.
3. Сравнить актуальный HEAD с `Last implementation checkpoint`.
4. Посмотреть commits после checkpoint. Journal/AGENTS-only commits не считать новой бизнес-реализацией.
5. Проверить CI именно на актуальном implementation SHA/PR run.
6. Если CI красный — сначала исправить текущий failure. Не добавлять новые слои поверх красной контрольной точки.
7. Продолжать только с `NEXT ACTION`.
8. После meaningful block обновлять checkpoint, DONE / IN PROGRESS / NEXT ACTION и changelog.
9. Не переписывать модули из DONE без конкретного regression/CI evidence.

---

## 1. Live checkpoint

**Обновлено:** 2026-09-14

- Репозиторий: `alexeyborisov19-sys/alexeyborisov19-sys-steel-probuct`
- Рабочая ветка: `feat/steel-product-online-clean-alpha-sep14`
- Draft PR: **#90 — `Steel Product Online: sanitized clean alpha snapshot`**
- Base: `main`
- Публикация: **НЕ ДЕЛАТЬ** без отдельного решения владельца
- Merge в `main`: **НЕ ДЕЛАТЬ** без отдельного решения владельца
- Оплата / checkout: **НЕ РАЗРАБАТЫВАТЬ на текущем этапе**
- **Last GREEN implementation checkpoint:** `ae09b1e5b8f04db893eef174455f5af2e2d0991f`
- Implementation commit: `Guard new internal physical inputs from public client boundary`
- **CI на `ae09b1e…`: GREEN в обоих workflow.**
  - `Steel Product Online Alpha CI`: success — TypeScript, Unit tests, Next.js build.
  - `Verify project package`: success — Lint, Typecheck, Tests, Build, SEO audit.
- PR #90 остаётся `open`, `draft`, `merged=false`; base остаётся `main`.
- **Current WIP implementation HEAD:** `9e16324077c8c55b85263802a17b45795b4977dd`.
- WIP status: DXF LWPOLYLINE bulge geometry implemented + regression tests added; CI при первой проверке ещё не был создан. Не считать новый checkpoint до полного GREEN.

> Journal commits выше implementation SHA являются recovery metadata. Новый implementation checkpoint фиксируется только после regression + CI gate.

---

## 2. Жёсткие продуктовые решения владельца

### 2.1 Что строим

`CAD → геометрия → DFM → материал/толщина → операции → фактический производственный расчёт → безопасный клиентский результат`

Функциональный ориентир — SendCutSend workflow, реализация clean-room.

### 2.2 Сейчас НЕ строим

- оплату;
- checkout;
- платёжные интеграции;
- публичный production deploy;
- автоматический release в производство без внутренних gates.

### 2.3 Конфиденциальность

Клиент НЕ получает: закупочные цены, внутренние ставки, себестоимость, коэффициенты/маржу, нормы, внутреннюю расшифровку реза/прожигов/массы/отхода, detailed internal DFM, report IDs/paths, production evidence, factual assembly/surface-preparation parameters.

Клиент может получать: свой CAD/preview, безопасные габариты, выбранные материал/толщину/количество/операции, coarse status и в будущем отдельно утверждённую конечную продажную цену/срок.

Разделение обеспечивать DTO/API boundary, а не скрытым UI.

### 2.4 Внутренние отчёты

В закрытом admin/RBAC контуре: закупочный металл, заготовка/расход, масса, отход, рез, прожиги, гибы, сварка, окраска, сборка, подготовка поверхности, упаковка, внутренние ставки, подтверждённая себестоимость, missing articles, detailed DFM, версия basis, audit/revision history.

Хранение: вне `public/`, каталог `0700`, отчёты `0600`.

### 2.5 Логика металла и лазера

- Лазер — по **фактическому контуру детали**.
- Металл до настоящего nesting — по **прямоугольной заготовке вокруг детали**, включая обрезки.
- Authoritative nesting allocation позже может уточнить расход.
- Чистая площадь детали не заменяет площадь закупочной прямоугольной заготовки.

### 2.6 Фактический расчёт

`подтверждённый физический параметр + подтверждённая закрытая ставка = подтверждённая статья`

Если данных не хватает — `missing/partial`, а не ноль и не выдуманное значение. Реальные ставки/закупочные цены — только private runtime basis, не Git/client bundle.

---

## 3. DONE — не создавать заново

### CAD workspace / DXF
- `/online-order` client-safe workspace.
- multi-part project.
- DXF/STEP/STP/DWG intake.
- DXF ASCII parser: LINE/LWPOLYLINE/CIRCLE/ARC, bounds/cut length/preview.
- ARC уже использует точные cardinal bounds и фактическую длину дуги; не переписывать без regression evidence.
- public calculation server заново разбирает CAD; browser production metrics не authoritative.
- Известные DXF gaps после текущего WIP: legacy POLYLINE/VERTEX, SPLINE, ELLIPSE, INSERT/BLOCK, HATCH, arc-aware exact closed-contour topology для bulged LWPOLYLINE, более строгая production contour/pierce topology.

### STEP / Sheet Metal Engine
- OpenCascade STEP analysis;
- BRep planar/cylindrical evidence;
- thickness/bend candidates;
- paired physical panels;
- finite bend axes;
- topology graph;
- explicit approved bend allowance contract;
- unfold plan;
- rigid flatten orientation;
- BRep boundaries + 2D preview;
- tangency via edge hashes;
- allowance spacing + multi-bend propagation;
- bend strips;
- panel/strip collision gates;
- sampled flat-pattern region/contour;
- BRep area audit + verification gate;
- sampled/unverified bent STEP pricing/CAM intentionally blocked;
- injectable authoritative STEP analyzer;
- exact STEP BRep boundary surface area для factual coating только в server-only production evidence;
- browser CAD model/client DTO не расширены производственной площадью поверхности;
- private STEP physical evidence продвигается только для production-ready high-confidence planar STEP.

### Factual calculation
- private runtime rate-book;
- no real public rates/supplier prices;
- project factual aggregation;
- production parameters;
- stock-aware supplier selection;
- exact thickness / stale price handling;
- confidential laser batch tiers;
- confidential pierce line when rate exists;
- bending/welding/powder;
- assembly / surface preparation / packaging semantics;
- `assemblyMinutes` + `surfacePreparationAreaM2` проходят project/internal immutable revision path;
- missing physical input отдельно от missing rate;
- no hidden public 5%/16.5%/setup assumptions;
- provenance-aware physical input resolution: explicit technologist > server-authoritative CAD evidence > explicit coating-side derivation;
- DXF coating area не выводится без явного выбора сторон;
- production parameters используют effective factual inputs.

### Supplier feed
- Atlantik primary automatic source for validated sheet groups;
- HTTPS allowlist, PDF signature/size/timeouts;
- `pdftotext -layout` parser + sanity checks;
- SHA-256 fingerprint;
- dry-run + explicit persist;
- atomic private snapshot replacement;
- protected no-store refresh endpoint без возврата цен;
- METALLSERVIS remains planned until stable official machine endpoint confirmed;
- no third-party aggregator as authoritative source.

### Privacy / public API
- safe client DTO;
- public workspace does not import internal economics;
- public supplier seed empty;
- public manifest accepts only customer choices;
- security/quarantine upload path;
- private orchestrator server-only/lazy;
- confidentiality regression tests;
- regression запрещает internal cost/rate/supplier/report/DFM evidence, `powderAreaM2`, `assemblyMinutes`, `surfacePreparationAreaM2`, `authoritativeFactualByPartId` в client workspace/client DTO.

### Internal reports
- private storage/list/detail pages;
- existing RBAC;
- readiness/completeness score;
- per-part checkpoints;
- immutable revision model;
- revision input accepts only physical parameters, never rates/cost/total;
- internal session + CSRF;
- lineage (`supersedes`, actor, reason);
- revision form;
- server-authoritative factual inputs сохраняются в confidential snapshot и переживают immutable recalculation revisions;
- manual technologist override остаётся выше automatic CAD evidence;
- assembly/surface-preparation physical values поддерживают accept/reject/clear и readiness regression coverage.

### Continuity
- этот journal создан;
- `AGENTS.md` требует journal-first recovery;
- green CI привязывается к конкретному implementation SHA.

---

## 4. IN PROGRESS

### DXF LWPOLYLINE bulge (`group 42`)

Уже сделано в WIP:
- `e2d3bb9c…`: `DxfShape.polyline` хранит `bulges[]`, где bulge вершины относится к исходящему сегменту;
- реализовано аналитическое `bulge → circular arc` через DXF `tan(includedAngle/4)`;
- positive/negative signed sweep поддерживаются;
- bbox учитывает реальные cardinal extrema дуги;
- cut length считается по `r × |sweep|`, а не по хорде;
- последний bulge закрытого LWPOLYLINE применяется к closing segment;
- `LWPOLYLINE_BULGE` больше не считается unsupported только из-за наличия кривого сегмента;
- `2a0a6089…`: preview строит кривые segment points; preview sampling не используется для production length/bounds;
- exact area/pierce topology для bulged closed contour намеренно fail-closed (`areaStatus=unavailable`) до arc-aware topology proof;
- `9e163240…`: regression tests: positive/negative semicircle, signed quarter arc, closing bulge, zero-bulge compatibility, fail-closed area topology.

Текущий gate: CI PENDING / not yet observed at first check.

---

## 5. NEXT ACTION — начинать отсюда

**NEXT ACTION #1:** проверить оба CI workflow на implementation tree с `9e163240…`. Если RED — исправить только текущие failures, не добавляя следующий функциональный слой.

**NEXT ACTION #2:** если GREEN — обновить `Last GREEN implementation checkpoint` на проверенный SHA/tree и перенести bulge bounds/length/preview в DONE.

**NEXT ACTION #3:** после GREEN оценить следующий DXF gap. Приоритет: либо exact arc-aware area/topology для bulged closed contour, либо legacy `POLYLINE/VERTEX`; выбрать меньший доказуемый блок с regression fixtures.

**NEXT ACTION #4:** сохранять fail-closed semantics: никакую аппроксимированную площадь/число прожигов не выдавать как factual production value.

---

## 6. Запрещено без нового решения владельца

- merge в `main`;
- deploy/publish;
- checkout/payment;
- показывать клиенту себестоимость/внутреннюю технологию;
- реальные ставки/закупочные цены в публичном Git;
- internal report locator клиенту;
- ненадёжный METALLSERVIS scraping;
- придуманные K-factor/bend allowance/rates/tolerances;
- unverified bent STEP как production-authoritative;
- неизвестная операция как нулевая стоимость;
- аппроксимированную DXF площадь выдавать как exact production fact.

---

## 7. CI policy

Green относится только к SHA, который реально прошёл gate. Минимум: lint, TypeScript, unit tests, Next.js build, SEO audit там, где предусмотрен. Между RED/PENDING и GREEN не добавлять новый functional layer.

---

## 8. Changelog checkpoints

### 2026-09-14 — journal/recovery introduced
- Clean branch / PR #90 закреплены как основной рабочий контур.
- `AGENTS.md` требует journal-first restart protocol.

### 2026-09-14 — factual CI restored
- `3ffe7029…`: factual regression chain полностью GREEN.

### 2026-09-14 — private STEP coating evidence
- exact OpenCascade STEP boundary surface area вынесена в server-only production evidence;
- server-authoritative factual provenance сохраняется только в confidential snapshot/revisions;
- `5fab1567…` — GREEN implementation checkpoint.

### 2026-09-14 — internal assembly / surface preparation revision path
- `75308022…` → `673d74ef…`: project/internal path, revisions, production parameters, completeness и internal UI;
- `7201aa40…` и последующие regression commits закрыли parser/project/readiness/confidentiality checks;
- `ae09b1e5…`: client boundary regression дополнительно запрещает новые internal physical fields;
- на `ae09b1e5…` оба workflow GREEN — предыдущий implementation checkpoint.

### 2026-09-14 — WIP DXF LWPOLYLINE bulge
- `e2d3bb9c…`: аналитические bulge arc bounds/cut length + segment metadata;
- `2a0a6089…`: curved preview;
- `9e163240…`: bulge regression suite;
- area/pierce topology для curved closed contours остаётся fail-closed до отдельного доказанного блока;
- CI ещё не подтверждён на момент этой записи.

---

## 9. Как обновлять журнал

После meaningful block:
1. `Last GREEN implementation checkpoint` = свежий проверенный implementation SHA;
2. честный CI status;
3. DONE / IN PROGRESS / NEXT ACTION;
4. changelog с SHA и fail-closed ограничениями;
5. не менять жёсткие продуктовые решения без явного решения владельца.