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
- **Last implementation checkpoint:** `5fab1567b8586a30bd99dda18b7a3a1e96a2534e`
- Implementation commit: `Test private STEP physical evidence boundary`
- **CI на `5fab1567…`: GREEN в обоих workflow.**
  - `Steel Product Online Alpha CI`: TypeScript ✅, Unit tests ✅, Next.js build ✅
  - `Verify project package`: Lint ✅, Typecheck ✅, Tests ✅, Build ✅, SEO audit ✅
- Последующий journal-only checkpoint `605bf1b1…` также прошёл оба workflow полностью GREEN.
- **Current WIP implementation HEAD before regression gate:** `673d74efd3ad51fe440bc53d0f938e480f6e048c`.
- WIP не считать новым implementation checkpoint до regression tests + полного green CI.
- Текущий WIP block:
  - `PartFactualInputs` проводит `assemblyMinutes` и `surfacePreparationAreaM2` в project factual engine;
  - internal revision parser/API принимает только эти физические параметры вместе с уже существующими bend/weld/powder inputs;
  - immutable confidential recalculation сохраняет/очищает эти inputs в snapshot;
  - production parameters получают assembly/surface-preparation/packaging semantics;
  - readiness показывает сборку, подготовку поверхности и упаковку отдельными internal checkpoints;
  - internal revision form/report UI показывает эти значения только в закрытом RBAC-контуре;
  - публичный client DTO/API этим блоком не расширялся.

> Обновление этого журнала создаёт metadata commit выше implementation checkpoint. При restart сравнивать изменения, а не считать journal-only SHA новой функциональностью.

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

Клиент НЕ получает: закупочные цены, внутренние ставки, себестоимость, коэффициенты/маржу, нормы, внутреннюю расшифровку реза/прожигов/массы/отхода, detailed internal DFM, report IDs/paths, production evidence.

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
- DXF ASCII parser, базовые LINE/LWPOLYLINE/CIRCLE/ARC, bounds/cut length/preview.
- public calculation server заново разбирает CAD; browser production metrics не authoritative.
- Известные DXF gaps: ARC bbox hardening, bulge 42, POLYLINE/VERTEX, SPLINE, ELLIPSE, INSERT/BLOCK, HATCH, production contour/pierce semantics.

### STEP / Sheet Metal Engine
Уже есть:
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
- calculation handler имеет injectable authoritative STEP analyzer;
- exact STEP BRep boundary surface area для factual coating извлекается только в server-only production evidence;
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
- assembly / surface preparation / packaging low-level physical-input semantics;
- missing physical input отдельно от missing rate;
- no hidden public 5%/16.5%/setup assumptions;
- provenance-aware physical input resolution: explicit technologist > server-authoritative CAD evidence > explicit coating-side derivation;
- DXF coating area не выводится без явного выбора сторон;
- production parameters используют effective factual inputs, а не только manual input.

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
- regression подтверждает отсутствие `powderAreaM2`, authoritative factual evidence, BRep/DFM/cost fields в public calculation response.

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
- manual technologist override остаётся выше automatic CAD evidence.

### Continuity
- этот journal создан;
- `AGENTS.md` требует journal-first recovery;
- green CI привязывается к конкретному implementation SHA.

---

## 4. IN PROGRESS

1. **Assembly / surface-preparation revision path реализован, но ещё не закрыт regression gate.**
2. WIP implementation HEAD до journal commit: `673d74efd3ad51fe440bc53d0f938e480f6e048c`.
3. Уже проведены только внутренние физические значения `assemblyMinutes` и `surfacePreparationAreaM2` через project calculation, confidential snapshot, immutable revisions, production parameters, completeness и internal form/report UI.
4. Никакие ставки, supplier prices, cost totals или производственные параметры в client DTO/API не добавлялись.
5. До нового checkpoint обязательны regression tests и полный CI.

---

## 5. NEXT ACTION — начинать отсюда

**NEXT ACTION #1:** добавить regression tests для `assemblyMinutes` / `surfacePreparationAreaM2`: parser accept/reject, project-level `partial → complete`, explicit clear, persistence в immutable snapshot/revision.

**NEXT ACTION #2:** проверить readiness/completeness для assembly, surface preparation и packaging, включая отсутствие физического input отдельно от отсутствующей confidential rate.

**NEXT ACTION #3:** усилить confidentiality regression: новые internal physical fields не должны появляться в public calculation response/client DTO.

**NEXT ACTION #4:** полный CI на итоговом implementation HEAD. Если RED — сначала исправить failure. Если GREEN — обновить `Last implementation checkpoint` и только потом брать следующий factual gap.

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
- неизвестная операция как нулевая стоимость.

---

## 7. CI policy

Green относится только к SHA, который реально прошёл gate. Минимум: lint, TypeScript, unit tests, Next.js build, SEO audit там, где предусмотрен. Между RED/PENDING и GREEN не добавлять новый functional layer.

---

## 8. Changelog checkpoints

### 2026-09-14 — journal/recovery introduced
- Clean branch / PR #90 закреплены как основной рабочий контур.
- `AGENTS.md` требует journal-first restart protocol.

### 2026-09-14 — factual CI restored
- `4b8e11c7…`: authoritative STEP analyzer injection уже присутствует.
- `1068abbb…`: исправлен lint pierce-rate fixture.
- `1e0e41e8…`: completeness fixtures догнали новые production parameters.
- `3ffe7029…`: missing-operation test согласован с factual semantics.
- На `3ffe7029…` оба workflow полностью GREEN.

### 2026-09-14 — private STEP coating evidence
- `9bcb19ce…`: regression suite изолирован от production quote rate-limit state; production limits не менялись.
- `2cd3b218…` + `b2290e5a…`: exact OpenCascade STEP boundary surface area вынесена в server-only production evidence и передаётся только в confidential calculation.
- `8db1c04d…` + `7b13d786…`: server-authoritative factual provenance сохраняется в закрытом snapshot/revisions, manual technologist value имеет приоритет.
- `5fab1567…`: regression подтверждает promotion только для production-ready STEP и отсутствие private physical evidence в client response.
- На `5fab1567…` оба workflow полностью GREEN.

### 2026-09-14 — WIP internal assembly / surface preparation revision path
- `75308022…`: project factual inputs проводят `assemblyMinutes` и `surfacePreparationAreaM2` в existing low-level factual engine.
- `b32df14d…` + `0b08d861…`: internal parser/API принимает только новые физические inputs; rates/cost/total по-прежнему не являются revision input.
- `03c78609…` + `bf554e14…`: immutable recalculation/confidential production parameters сохраняют assembly/surface-preparation; packaging state также передаётся в internal parameters.
- `6bdc9ffa…` + `aacc629b…` + `673d74ef…`: internal completeness/form/report UI дополнены для сборки/подготовки поверхности/упаковки.
- Этот блок **ещё WIP** до regression tests + полного green CI; `673d74ef…` не считать implementation checkpoint.

---

## 9. Как обновлять журнал

После meaningful block:
1. `Last implementation checkpoint` = свежий implementation SHA;
2. честный CI status;
3. DONE / IN PROGRESS / NEXT ACTION;
4. 2–5 строк changelog;
5. не менять жёсткие продуктовые решения без явного решения владельца.