# Steel Product Online — постоянный журнал разработки

> **Назначение:** это основной recovery/checkpoint-файл проекта Steel Product Online. После любого обрыва соединения, новой сессии или потери контекста сначала читать этот файл, затем сверять его с актуальным HEAD/CI и только после этого продолжать разработку.

## 0. Обязательный протокол после сброса / новой сессии

1. Прочитать этот файл целиком.
2. Получить актуальный HEAD ветки `feat/steel-product-online-clean-alpha-sep14` и состояние Draft PR #90.
3. Если HEAD отличается от `Live checkpoint` ниже — посмотреть commits между записанным и актуальным HEAD и **обновить журнал до начала новой разработки**.
4. Проверить CI именно на актуальном HEAD.
5. Если CI красный — сначала исправить текущую ошибку. Не добавлять новый слой поверх красной контрольной точки без крайней необходимости.
6. Продолжить только с пункта `NEXT ACTION`.
7. После каждого законченного смыслового блока обновить:
   - `Live checkpoint`;
   - `DONE`;
   - `IN PROGRESS`;
   - `NEXT ACTION`;
   - краткий changelog внизу.
8. **Не переписывать уже завершённые модули заново**, если нет конкретного regression/CI evidence, что они сломаны.

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
- Актуальный HEAD на момент записи: `4b8e11c7d3987fee04296128b940573f5131bcef`
- Последний commit: `Inject authoritative STEP analyzer into calculation handler`
- Текущий CI этого HEAD: **RED** — `Verify project package` остановился на `Lint`; typecheck/tests/build/SEO на этом run не выполнялись. Alpha CI нужно сверять отдельно.
- Следующее действие до любых новых функций: **найти и исправить lint-error на `4b8e11c7…`, затем прогнать оба workflow до зелёного состояния.**

> Этот SHA — checkpoint, а не вечная истина. При следующем запуске обязательно сравнить его с реальным HEAD ветки.

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

**Клиент НЕ должен получать:**

- закупочные цены металла;
- внутренние ставки операций;
- себестоимость;
- внутреннюю маржу/коэффициенты;
- внутренние нормы;
- длину реза/прожиги/массу/отход как внутреннюю производственную расшифровку;
- подробные internal DFM причины;
- внутренние report IDs/пути;
- закрытые производственные ограничения и evidence.

**Клиент может получать:**

- свой CAD/preview;
- габариты, безопасно полученные из его CAD;
- выбранные им материал/толщину/количество/операции;
- coarse status (`pending / needs-review / blocked / ready`);
- в будущем — только отдельно утверждённую конечную продажную цену и срок.

Конфиденциальность должна обеспечиваться не CSS/скрытым блоком, а **разными server/client DTO и отсутствием внутренних полей в публичном API**.

### 2.4 Внутренние производственные данные

Полная производственная расшифровка идёт в отдельный закрытый отчёт, доступный только внутреннему admin/RBAC-контуру:

- закупочный металл;
- заготовка и расход;
- масса нетто/закупочная;
- отход;
- длина реза;
- прожиги;
- гибы;
- сварка;
- окраска;
- внутренние ставки;
- подтверждённые статьи себестоимости;
- missing articles;
- detailed DFM;
- версия закрытой расчётной базы;
- audit/revision history.

Файлы отчётов: вне `public/`, каталог `0700`, файлы `0600`.

### 2.5 Логика металла и лазера

- Лазер считать по **фактическому контуру детали**.
- Материал до настоящего nesting считать по **прямоугольной расчётной заготовке вокруг детали**, включая обрезки.
- Если есть authoritative allocated area от nesting — использовать её отдельно как более точный следующий уровень.
- Нельзя подменять прямоугольную заготовку чистой площадью детали.

### 2.6 Фактический расчёт

Нельзя выдавать красивый итог из неподтверждённых ставок.

Правило:

`подтверждённый физический параметр + подтверждённая закрытая ставка = подтверждённая статья`

Если чего-то нет — статья `missing/partial`, а не `0` и не выдуманное значение.

Старые Alpha коэффициенты/реальные ставки не должны жить в публичном репозитории. Закрытые ставки подаются runtime-only из private calculation basis.

---

## 3. DONE — уже реализовано, не писать заново

### 3.1 Базовый CAD workspace

- `/online-order` существует в feature-ветке.
- Клиентский UI разделён с внутренней производственной информацией.
- Drag/drop CAD.
- DXF/STEP/STP/DWG intake.
- DXF локальный preview.
- STEP 3D viewer через OpenCascade/mesh path.
- Проект может содержать несколько деталей.

### 3.2 DXF

- ASCII DXF parsing.
- LINE/LWPOLYLINE/CIRCLE/ARC базовая геометрия.
- bounds, cut length, contour/object evidence.
- real SVG preview.
- server-side authoritative re-parse для public calculation request.
- public request не принимает от браузера `cutLength/mass/cost` как authoritative данные.

Известные DXF ограничения, не забывать:
- ARC bbox требует/может требовать дальнейшего hardening;
- LWPOLYLINE bulge 42;
- POLYLINE/VERTEX, SPLINE, ELLIPSE, INSERT/BLOCK, HATCH и др.;
- contour/pierce semantics ещё требуют production hardening.

### 3.3 STEP / Sheet Metal Engine

Уже есть отдельные слои, не создавать их заново:

- OpenCascade STEP analysis;
- BRep planar/cylindrical face evidence;
- thickness candidate;
- bend candidates;
- paired physical panel regions;
- finite bend axes;
- topology graph;
- explicit approved bend allowance table contract;
- deterministic unfold plan;
- rigid orientation flattening;
- BRep panel boundaries;
- 2D display preview;
- tangency evidence via shared BRep edge hashes;
- allowance spacing;
- multi-bend spacing propagation;
- bend-strip regions;
- panel/strip collision gates;
- sampled flat-pattern region/contour candidate;
- BRep area audit + verification gate;
- pricing/CAM для непроверенной sampled bent-развёртки намеренно заблокированы.

**Последний важный шаг:** на HEAD `4b8e11c7…` server calculation handler получил injectable authoritative STEP analyzer. То есть работу продолжать от server-authoritative STEP path, а не возвращаться к старому «STEP только manual review» без проверки текущего кода.

### 3.4 Pricing / factual calculation

Уже реализовано:

- отдельный factual calculation engine;
- private runtime rate-book;
- отсутствие реальных ставок в публичном seed;
- отсутствие закупочных supplier prices в публичном seed;
- project factual aggregation;
- physical production parameters;
- stock-aware supplier price selection;
- exact-thickness requirement;
- stale snapshot handling;
- missing articles вместо invented defaults;
- no hidden public 5%/16.5%/setup assumptions.

### 3.5 Metal price feed

- Atlantik — primary confirmed automatic source для тех листовых групп, которые реально парсятся и валидируются.
- Official PDF downloader with HTTPS allowlist.
- PDF signature/size/timeout checks.
- `pdftotext -layout` extraction.
- parser + sanity checks.
- normalized SHA-256 fingerprint.
- dry-run режим.
- explicit commit mode.
- atomic private-basis snapshot replacement.
- refresh endpoint protected long bearer token, `no-store`, без возврата цен.
- METALLSERVIS — planned/secondary only; не включать автоматически, пока не подтверждён стабильный официальный machine-readable endpoint.
- third-party aggregators не использовать как authoritative commercial source.

### 3.6 Privacy boundary / public API

- `ClientProjectCalculationView` — safe DTO.
- public workspace не импортирует internal pricing/DFM economics.
- public supplier seed пустой.
- detailed internal data не сериализуется клиенту.
- public calculation manifest принимает только выбор клиента, а не производственные цифры.
- CAD uploads проходят existing security/quarantine path.
- public calculation handler server-reparses authoritative geometry.
- private calculation orchestrator lazy-loaded server-side.
- confidentiality regression tests есть.

### 3.7 Internal production reports

- private report storage outside public tree;
- internal list page `/internal/production-calculations`;
- internal detail page;
- existing internal RBAC reused;
- readiness/completeness score;
- per-part checkpoints;
- revision model;
- revision parser принимает только физические технологические inputs, не rates/cost/total;
- revision API использует existing internal session + CSRF;
- immutable revision: старый отчёт не изменяется, новый пересчитывается по current private basis;
- revision lineage (`supersedes`, actor, reason) предусмотрен;
- internal revision form добавлен.

### 3.8 Clean branch / history

Основная рабочая ветка теперь:

`feat/steel-product-online-clean-alpha-sep14`

Draft PR #90.

Использовать её, а не старую длинную development-ветку #89. Не возвращать реальные производственные ставки в Git history.

---

## 4. IN PROGRESS — текущая работа

1. **Вернуть current HEAD в green CI.** Сейчас `Verify project package` падает на lint на `4b8e11c7…`.
2. Проверить второй workflow (`Steel Product Online Alpha CI`) на том же HEAD.
3. После green checkpoint проверить server-authoritative STEP flow end-to-end:
   - planar high-confidence STEP может дать factual geometry;
   - bent/sampled/unverified STEP не получает production pricing/CAM;
   - клиент по-прежнему не получает internal evidence.
4. Проверить internal revision form/API после последних изменений на реальном typecheck/tests/build.

---

## 5. NEXT ACTION — начинать отсюда

**NEXT ACTION #1:** получить точный lint log для HEAD `4b8e11c7d3987fee04296128b940573f5131bcef` и исправить lint без ослабления правил.

**NEXT ACTION #2:** прогнать оба workflow до полного green.

**NEXT ACTION #3:** добавить/проверить regression tests на injectable authoritative STEP analyzer в calculation handler, чтобы:

- сервер сам анализировал STEP/STP;
- только high-confidence production-ready planar STEP передавал geometry в factual calculation;
- bent/unverified STEP оставался internal-review;
- browser-provided geometry не становилась authoritative.

**NEXT ACTION #4:** после green — перейти к следующему фактическому gap, который реально уменьшает `partial` в internal completeness, а не к оплате/UI polish.

---

## 6. Что нельзя делать без нового решения владельца

- merge в `main`;
- deploy/publish;
- checkout/payment;
- показывать клиенту себестоимость или производственную расшифровку;
- хранить реальные ставки/закупочные цены в публичном Git;
- возвращать клиенту internal report locator;
- включать METALLSERVIS scraping на ненадёжном endpoint;
- придумывать K-factor/bend allowance/rates/tolerances;
- считать unverified bent STEP production-authoritative;
- считать выбранную операцию нулевой стоимостью, если её фактический параметр/ставка неизвестны.

---

## 7. CI policy

Зелёной контрольной точкой считать HEAD только если проверен соответствующий актуальный commit.

Не говорить «CI зелёный» на основании старого SHA.

Минимальный gate:

- lint;
- TypeScript;
- unit tests;
- Next.js build;
- SEO audit в workflow, где он предусмотрен.

После каждого нового commit предыдущий green относится только к старому SHA.

---

## 8. Краткий changelog checkpoints

### 2026-09-14 — recovery journal created

- Зафиксирован current clean branch / PR #90.
- Актуальный HEAD при создании: `4b8e11c7…`.
- HEAD добавляет injectable authoritative STEP analyzer в public calculation handler.
- Current Verify CI красный на lint; это первое действие после journal creation.
- Введён обязательный restart protocol, чтобы после обрыва не повторять уже сделанную работу.

---

## 9. Как обновлять этот файл

Не превращать журнал в подробный commit log на тысячи строк. После каждого смыслового блока:

1. изменить `Live checkpoint` на свежий SHA + честный CI status;
2. перенести завершённый пункт из `IN PROGRESS` в `DONE`;
3. оставить **один конкретный** `NEXT ACTION #1`;
4. добавить 2–5 строк в changelog;
5. сохранить жёсткие продуктовые решения без переформулировок, которые меняют смысл.
