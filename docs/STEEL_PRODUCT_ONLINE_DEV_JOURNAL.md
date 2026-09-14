# Steel Product Online — постоянный журнал разработки

> **Назначение:** это основной recovery/checkpoint-файл проекта Steel Product Online. После любого обрыва соединения, новой сессии или потери контекста сначала читать этот файл, затем сверять его с актуальным HEAD/CI и только после этого продолжать разработку.

## 0. Обязательный протокол после сброса / новой сессии

1. Прочитать этот файл целиком.
2. Получить актуальный HEAD ветки `feat/steel-product-online-clean-alpha-sep14` и состояние Draft PR #90.
3. Сравнить актуальный HEAD с `Last implementation checkpoint` ниже.
4. Если после checkpoint есть commits — посмотреть их сообщения/изменённые файлы. Journal/AGENTS-only commits сами по себе не означают, что код нужно переписывать.
5. Проверить CI именно на актуальном HEAD/PR merge commit.
6. Если CI красный — сначала исправить текущую ошибку. Не добавлять новый слой поверх красной контрольной точки без крайней необходимости.
7. Продолжить только с пункта `NEXT ACTION`.
8. После каждого законченного смыслового блока обновить `Live checkpoint`, `DONE / IN PROGRESS / NEXT ACTION` и короткий changelog.
9. **Не переписывать уже завершённые модули заново**, если нет конкретного regression/CI evidence, что они сломаны.

---

## 1. Live checkpoint

**Обновлено:** 2026-09-14

- Репозиторий: `alexeyborisov19-sys/alexeyborisov19-sys-steel-probuct`
- Рабочая ветка: `feat/steel-product-online-clean-alpha-sep14`
- Draft PR: **#90 — `Steel Product Online: sanitized clean alpha snapshot`**
- Base: `main`
- Публикация: **ЗАПРЕЩЕНА до отдельного решения владельца**
- Merge в `main`: **НЕ ДЕЛАТЬ** без отдельного решения владельца
- Оплата / checkout: **НЕ РАЗРАБАТЫВАТЬ на текущем этапе**
- **Last implementation checkpoint:** `1068abbbd69c0cb3fd1cf13e4a2b2b01b5c23639`
- Последний implementation commit: `Fix confidential pierce-rate test lint`
- Предыдущий важный implementation commit: `4b8e11c7d3987fee04296128b940573f5131bcef` — `Inject authoritative STEP analyzer into calculation handler`.
- Причина RED CI на `4b8e11c7…`: ESLint warning в `tests/factual-calculation.test.ts` — `_pierceRubEach` был объявлен и не использовался; `--max-warnings=0` остановил workflow.
- Lint исправлен commit `1068abbb…` без изменения расчётной логики.
- **CI для `1068abbb…` / актуального PR HEAD ещё требуется проверить полностью. Не считать green до фактического результата обоих workflow.**

> Само обновление журнала создаёт metadata commit выше implementation checkpoint. При restart сначала смотреть commits после checkpoint и отличать journal/AGENTS metadata от реализации.

---

## 2. Жёсткие продуктовые решения владельца

### 2.1 Что строим

Клиентскую CAD-платформу Steel Product Online, встроенную в сайт `steelprodukt.ru`, по логике:

`CAD → геометрия → DFM → материал/толщина → операции → фактический производственный расчёт → клиентский результат`

Функциональный ориентир — workflow SendCutSend, но реализация clean-room, без копирования их кода/брендинга/закрытой логики.

### 2.2 Что сейчас НЕ строим

- оплату;
- checkout;
- платёжные интеграции;
- публичный production deploy;
- автоматический release в производство без внутренних gates.

### 2.3 Конфиденциальность — абсолютное правило

**Клиент НЕ должен получать:** закупочные цены металла, внутренние ставки операций, себестоимость, внутреннюю маржу/коэффициенты, нормы, производственную расшифровку длины реза/прожигов/массы/отхода, detailed internal DFM, internal report IDs/пути или закрытые production evidence.

**Клиент может получать:** свой CAD/preview, безопасные габариты из своего CAD, выбранные им материал/толщину/количество/операции, coarse status (`pending / needs-review / blocked / ready`), а в будущем — только отдельно утверждённую конечную продажную цену и срок.

Конфиденциальность обеспечивать разными server/client DTO и отсутствием внутренних полей в публичном API, а не скрытием UI.

### 2.4 Внутренние производственные данные

Полная расшифровка идёт в отдельный закрытый отчёт только для внутреннего admin/RBAC-контура: закупочный металл, заготовка/расход, масса, отход, рез, прожиги, гибы, сварка, окраска, ставки, подтверждённые статьи себестоимости, missing articles, detailed DFM, версия расчётной базы и audit/revision history.

Файлы: вне `public/`, каталог `0700`, отчёты `0600`.

### 2.5 Логика металла и лазера

- Лазер считать по **фактическому контуру детали**.
- Материал до настоящего nesting считать по **прямоугольной расчётной заготовке вокруг детали**, включая обрезки.
- Если есть authoritative allocated area от nesting — использовать её как более точный следующий уровень.
- Не подменять прямоугольную заготовку чистой площадью детали.

### 2.6 Фактический расчёт

`подтверждённый физический параметр + подтверждённая закрытая ставка = подтверждённая статья`

Если данных нет — `missing/partial`, а не `0` и не выдуманное значение. Реальные ставки и закупочные цены не хранить в публичном Git; подавать runtime-only из private calculation basis.

---

## 3. DONE — уже реализовано, не писать заново

### 3.1 Базовый CAD workspace
- `/online-order` в feature-ветке.
- client-safe workspace отдельно от internal production data.
- multi-file/project intake.
- DXF/STEP/STP/DWG intake.
- DXF preview.
- STEP 3D viewer.

### 3.2 DXF
- ASCII parser.
- LINE/LWPOLYLINE/CIRCLE/ARC базовая геометрия.
- bounds/cut length/contour evidence.
- SVG preview.
- server-side authoritative re-parse для public calculation.
- public request не принимает browser `cutLength/mass/cost` как authoritative.

Известные gaps: ARC bbox hardening, LWPOLYLINE bulge 42, POLYLINE/VERTEX, SPLINE, ELLIPSE, INSERT/BLOCK, HATCH и production contour/pierce semantics.

### 3.3 STEP / Sheet Metal Engine
Уже есть и не должны создаваться заново:
- OpenCascade STEP analysis;
- BRep planar/cylindrical evidence;
- thickness/bend candidates;
- paired panel regions;
- finite bend axes;
- topology graph;
- explicit approved bend allowance table contract;
- deterministic unfold plan;
- rigid orientation flattening;
- BRep boundaries + 2D preview;
- tangency evidence via BRep edge hashes;
- allowance spacing + multi-bend propagation;
- bend-strip regions;
- panel/strip collision gates;
- sampled flat-pattern region/contour candidate;
- BRep area audit + verification gate;
- sampled/unverified bent STEP pricing/CAM intentionally blocked;
- public calculation handler имеет injectable authoritative STEP analyzer.

### 3.4 Pricing / factual calculation
- factual calculation engine;
- private runtime rate-book;
- no real rates/supplier prices in public seed;
- project factual aggregation;
- physical production parameters;
- stock-aware price selection;
- exact-thickness requirement;
- stale snapshot handling;
- confidential laser batch tiers;
- confidential pierce line when approved rate exists;
- missing articles instead of invented defaults;
- no hidden public 5%/16.5%/setup assumptions.

### 3.5 Metal price feed
- Atlantik primary automatic source for validated sheet groups;
- official HTTPS PDF downloader;
- PDF signature/size/timeout checks;
- `pdftotext -layout`;
- parser + sanity checks;
- normalized SHA-256 fingerprint;
- dry-run and explicit commit mode;
- atomic private snapshot replacement;
- protected no-store refresh endpoint without price response;
- METALLSERVIS remains planned/secondary until stable official machine endpoint is confirmed;
- no third-party aggregator as authoritative source.

### 3.6 Privacy boundary / public API
- `ClientProjectCalculationView` safe DTO;
- public workspace does not import internal pricing economics;
- public supplier seed empty;
- public manifest accepts customer choices, not production figures;
- uploads use security/quarantine path;
- server derives authoritative geometry;
- private orchestrator lazy-loaded server-side;
- confidentiality regression tests.

### 3.7 Internal production reports
- private storage outside public tree;
- internal list/detail pages;
- existing RBAC reused;
- readiness/completeness score + per-part checkpoints;
- immutable revision model;
- revision parser accepts physical parameters, not rates/cost/total;
- revision API uses internal session + CSRF;
- revision lineage (`supersedes`, actor, reason);
- internal revision form.

### 3.8 Clean branch / history
Основная ветка: `feat/steel-product-online-clean-alpha-sep14`, Draft PR #90. Не возвращаться к старой длинной development-ветке #89 для новой работы.

### 3.9 Continuity / recovery
- этот journal создан;
- `AGENTS.md` требует читать journal до Steel Product Online edits;
- журнал обновлять после meaningful block;
- green CI всегда связывать с конкретным SHA.

---

## 4. IN PROGRESS

1. Проверить оба CI после lint fix `1068abbb…` и journal metadata commit.
2. Если есть новый failure — исправить его до green.
3. После green проверить server-authoritative STEP end-to-end:
   - planar high-confidence STEP может дать factual geometry;
   - bent/sampled/unverified STEP не получает production pricing/CAM;
   - client response не получает internal evidence.
4. Проверить internal revision form/API на полном typecheck/tests/build.

---

## 5. NEXT ACTION — начинать отсюда

**NEXT ACTION #1:** получить актуальный PR #90 HEAD после journal commit и проверить оба workflow.

**NEXT ACTION #2:** если CI green — добавить/проверить regression tests на injectable authoritative STEP analyzer в calculation handler: server analysis only, high-confidence planar allow, bent/unverified review-only, browser geometry never authoritative.

**NEXT ACTION #3:** после STEP regression перейти к следующему factual gap, который уменьшает `partial` в internal completeness. Не идти в оплату/UI polish.

---

## 6. Что нельзя делать без нового решения владельца

- merge в `main`;
- deploy/publish;
- checkout/payment;
- показывать клиенту себестоимость/производственную расшифровку;
- хранить реальные ставки/закупочные цены в публичном Git;
- возвращать клиенту internal report locator;
- включать METALLSERVIS scraping на ненадёжном endpoint;
- придумывать K-factor/bend allowance/rates/tolerances;
- считать unverified bent STEP production-authoritative;
- считать неизвестную операцию нулевой стоимостью.

---

## 7. CI policy

Green относится только к SHA, который реально прошёл проверки. Минимальный gate: lint, TypeScript, unit tests, Next.js build и SEO audit там, где он предусмотрен. Journal-only commits могут перезапустить CI, но не меняют business logic.

---

## 8. Краткий changelog checkpoints

### 2026-09-14 — recovery journal created
- Зафиксирован clean branch / PR #90.
- Initial implementation checkpoint: `4b8e11c7…` — authoritative STEP analyzer injection.
- Найден lint failure: unused `_pierceRubEach` в factual calculation test.
- Исправлен implementation commit `1068abbb…` без изменения расчётной логики.
- `AGENTS.md` требует journal-first recovery protocol.

---

## 9. Как обновлять этот файл

После meaningful block:
1. обновить `Last implementation checkpoint`;
2. записать честный CI status;
3. DONE/IN PROGRESS/NEXT ACTION;
4. 2–5 строк changelog;
5. не менять жёсткие продуктовые решения без нового явного решения владельца.
