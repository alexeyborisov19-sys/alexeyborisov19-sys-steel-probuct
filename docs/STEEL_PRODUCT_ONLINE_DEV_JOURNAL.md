# Steel Product Online — постоянный журнал разработки

> Recovery/checkpoint-файл проекта. После обрыва или новой сессии сначала читать этот файл, затем сверять его с фактическим HEAD/CI и только после этого продолжать.

## 0. Протокол восстановления

1. Прочитать журнал целиком.
2. Проверить HEAD `feat/steel-product-online-clean-alpha-sep14` и Draft PR #90.
3. Сравнить HEAD с `Last GREEN verified tree` и `Last functional implementation SHA`.
4. Journal-only commits не считать новой функциональностью, но CI green относится только к точному SHA, который реально проверялся.
5. Если CI RED — исправлять текущий failure до любого нового functional layer.
6. Продолжать с `NEXT ACTION`.
7. После каждого meaningful block записывать WIP/RED/fix/GREEN и SHA.

---

## 1. Live checkpoint

**Обновлено:** 2026-09-14

- Репозиторий: `alexeyborisov19-sys/alexeyborisov19-sys-steel-probuct`
- Ветка: `feat/steel-product-online-clean-alpha-sep14`
- Draft PR: **#90 — `Steel Product Online: sanitized clean alpha snapshot`**
- Base: `main`
- Публикация: **НЕ ДЕЛАТЬ**
- Merge в `main`: **НЕ ДЕЛАТЬ**
- Оплата / checkout: **НЕ РАЗРАБАТЫВАТЬ**
- PR остаётся `open`, `draft`, `merged=false`.

### Последняя полностью проверенная точка

- **Last functional implementation SHA:** `fb54a1e0d140662608a85e92b8b3bf92c898f965`
- Functional block: strict exact-safe linear planar DXF SPLINE subset + regressions.
- **Last GREEN verified tree HEAD:** `961c43c0bacbbb93f2e35a8fcc6641ca8aa87b72`
- CI на `961c43c…` полностью GREEN:
  - `Steel Product Online Alpha CI`: TypeScript ✅, Unit tests ✅, Next.js build ✅
  - `Verify project package`: Lint ✅, Typecheck ✅, Tests ✅, Build ✅, SEO audit ✅
- SEO gate больше не зависит от доступности third-party image origin: first-party assets проверяются детерминированно, remote Next Image optimizer dependency не используется как availability oracle.

### Текущий WIP — pre-release stabilization

Цель текущего блока: не добавлять feature creep, а довести ветку до версии, готовой к проверке владельцем перед публикацией.

Открытый regression-only gap:
- malformed legacy `POLYLINE/VERTEX/SEQEND` sequences: missing `SEQEND`, unexpected nested entity, invalid/missing vertex coordinates, too few valid vertices;
- тесты должны подтверждать fail-closed и точные issue codes, не менять production geometry semantics.

После этого — только предрелизные gates: confidentiality boundary, candidate-build/rollback regressions, supported/fail-closed CAD matrix, full CI и Draft PR state.

### История RED / fixes текущего геометрического блока

- Journal tree `eb50b7a0437e18b41e647536324639b622da8d77`:
  - `Steel Product Online Alpha CI`: полностью GREEN.
  - `Verify project package`: Lint ✅, Typecheck ✅, **557 tests ✅**, Build ✅, SEO audit ❌.
- Первый RED не связан со SPLINE/business logic. SEO audit дважды принудительно вызывал `/_next/image` для внешних `static.mk.ru` URL; third-party origin ответил 504/non-image Content-Type.
- `f508be1fa2791113acaa3d0bac525af513b3602f`: SEO image availability audit теперь детерминированно проверяет first-party/local source assets; локальные Next Image URL разворачиваются к исходному `/...`, remote optimizer dependency не вызывается.
- `2071ce5fa61c8a21f8850dc762d4b36ec4934d5b`: добавлен regression для remote optimizer skip/local source unwrap.
- Journal tree `e6b3e30a1d945a7fa48cde1e9ab33dbe3237b0a9`: lint/typecheck прошли, но новый regression упал на unit-test stage до build/SEO; production audit и SPLINE не менялись.
- `eee04cb9541fdf2e54e79d230a973c43e8350d57`: test-only stabilization regression contract; production audit не изменён.
- `0c6e10bbc996978016a0dd2e3a671cc987d29839`: дополнительный test-contract fix для фактической collector-логики `sourcePath`.
- `961c43c0bacbbb93f2e35a8fcc6641ca8aa87b72`: оба workflow полностью GREEN, включая фактический SEO audit. SPLINE block закрыт.

---

## 2. Жёсткие решения владельца

### Продукт
`CAD → геометрия → DFM → материал/толщина → операции → фактический производственный расчёт → безопасный клиентский результат`.

### Не делать сейчас
- checkout/payment;
- production deploy/publish;
- merge в `main`;
- автоматический release без внутренних gates.

### Конфиденциальность
Клиенту не показывать: закупочные цены, ставки, себестоимость, нормы, внутреннюю массу/отход/рез/прожиги, detailed internal DFM, production evidence, report IDs/paths, factual assembly/surface-preparation inputs.

Клиентский boundary содержит только безопасный CAD/preview, безопасные габариты, выбранную конфигурацию, coarse status и в будущем отдельно утверждённую продажную цену/срок.

### Расчёт
- Лазер — фактический контур.
- Металл до настоящего nesting — прямоугольная заготовка вокруг детали, включая обрезки.
- Неизвестный physical input/rate = `missing/partial`, не ноль.
- Реальные rates/supplier prices — только private runtime basis.
- Аппроксимацию нельзя выдавать за factual production value.

---

## 3. DONE — не создавать заново

### Public/client safety
- client-safe `/online-order` workspace и DTO;
- public calculation server повторно анализирует CAD;
- private economics/DFM/report evidence не импортируются в client boundary;
- confidentiality regression закрывает internal physical/economic fields.

### STEP
- OpenCascade analysis;
- BRep planar/cylindrical evidence;
- topology/unfold/flat-pattern verification gates;
- unverified bent STEP fail-closed для pricing/CAM;
- server-only exact STEP surface area для internal factual coating;
- server-authoritative factual evidence только в confidential snapshot/revisions.

### Factual/internal
- private runtime rate book + supplier snapshot basis;
- factual project aggregation;
- bending/welding/powder/assembly/surface-preparation/packaging;
- internal immutable revisions, RBAC/CSRF/report lineage;
- manual technologist override выше automatic evidence.

### Supplier feed
- Atlantik protected refresh/parser/snapshot flow;
- HTTPS allowlist, PDF validation, SHA-256, dry-run/persist, atomic private replacement;
- METALLSERVIS не authoritative до стабильного official machine endpoint.

### DXF
- LINE, CIRCLE, ARC, LWPOLYLINE;
- legacy simple 2D POLYLINE/VERTEX/SEQEND;
- exact straight closed-polyline area/hole topology;
- exact ARC bbox/length;
- exact polyline bulge bbox/length + curved preview;
- safe ELLIPSE full/partial geometry with analytic bounds and controlled length;
- exact full-ellipse area/containment/hole topology;
- strict open non-periodic non-rational planar+linear degree-1 SPLINE subset normalized to exact straight polyline;
- malformed/nonlinear/closed/periodic/rational/3D SPLINE остаётся fail-closed;
- bulged closed area/pierce остаётся fail-closed;
- 3D/polyface/mesh legacy POLYLINE остаётся fail-closed.

---

## 4. IN PROGRESS

### Pre-release stabilization

Никаких новых рискованных geometry features до test-ready checkpoint.

Проверить и закрыть:
- malformed legacy POLYLINE regression-only matrix;
- client confidentiality boundary на `/online-order` и public calculation DTO;
- candidate-build/rollback gate;
- supported/fail-closed CAD matrix;
- полный lint/typecheck/tests/build/SEO на финальном stabilization HEAD;
- Draft PR #90 остаётся open + draft + unmerged.

---

## 5. NEXT ACTION

1. Добавить regression-only tests для malformed legacy POLYLINE: missing `SEQEND`, unexpected entity, invalid/missing X/Y vertex, too few valid vertices; использовать отдельный valid LINE, чтобы inspect `unsupportedEntities`, а не получать generic no-shapes throw.
2. Не менять parser, если существующая fail-closed логика уже проходит эти regressions; production code менять только при фактическом тестовом доказательстве дефекта.
3. Записать WIP и прогнать полный CI.
4. После GREEN пройти pre-release stabilization checklist: confidentiality, candidate build/rollback, supported/fail-closed CAD matrix, PR state.
5. Сделать финальный journal checkpoint и ещё один полный CI на точном pre-release HEAD.
6. Не deploy/publish и не merge — результатом должна быть версия **готова к проверке перед публикацией**.

---

## 6. Запрещено без нового решения владельца

- merge `main`;
- deploy/publish;
- payment/checkout;
- public internal economics/DFM/evidence;
- реальные private rates/prices в Git/client;
- unverified bent STEP как production-authoritative;
- unknown operation как zero cost;
- 3D/polyface DXF трактовать как 2D contour;
- nonlinear/rational spline аппроксимировать и выдавать как factual production contour;
- approximate curved area/pierces/cut length выдавать как exact factual values.

---

## 7. CI policy

Green относится к конкретному проверенному SHA. Минимум: lint, TypeScript, unit tests, Next.js build, SEO audit там, где предусмотрен. Новый functional layer только после green предыдущего дерева.

---

## 8. Changelog

### 2026-09-14 — recovery journal
- Clean branch и Draft PR #90 закреплены как рабочий контур.
- `AGENTS.md` требует journal-first recovery.

### 2026-09-14 — private STEP/factual safety
- private STEP surface evidence + confidential provenance;
- assembly/surface-preparation internal revision path;
- `ae09b1e5…` — historical green functional checkpoint.

### 2026-09-14 — DXF LWPOLYLINE bulge
- analytic bulge geometry/preview/regressions;
- snapshot fixture-only CI fix;
- `155c19c…` verified GREEN tree.

### 2026-09-14 — legacy POLYLINE/VERTEX
- `1f8b1202…` safe simple 2D parser;
- `72cc5ecc…` regression;
- `5e38668…` verified GREEN tree.

### 2026-09-14 — DXF ELLIPSE
- `671ad842…` analytic geometry/topology + controlled length integration;
- `95ffc444…` separate preview;
- `c16e0162…` base regression suite;
- `aa6bee60…` hard fail-closed integration tolerance;
- `f0436d73…` edge-case regressions;
- `b984da3e…` both workflows fully GREEN.

### 2026-09-14 — strict linear SPLINE
- `d8e9ad7b…` exact-safe degree-1 planar parser normalized to open polyline;
- `fb54a1e0…` supported/fail-closed regression suite;
- `eb50b7a…`: Alpha CI GREEN; Verify RED only on SEO audit after 557 tests and build succeeded;
- cause: flaky third-party `static.mk.ru` via Next optimizer, not SPLINE/business logic;
- `f508be1f…`: deterministic first-party-only image availability audit;
- `2071ce5f…`, `eee04cb9…`, `0c6e10b…`: regression/test-contract hardening without weakening production checks;
- `961c43c…`: both workflows fully GREEN including SEO — SPLINE DONE and current verified checkpoint.

---

## 9. Правило обновления журнала

После meaningful block записывать:
1. functional SHA;
2. verified GREEN tree SHA;
3. RED/fix, если был;
4. что DONE, что fail-closed;
5. следующий конкретный action.