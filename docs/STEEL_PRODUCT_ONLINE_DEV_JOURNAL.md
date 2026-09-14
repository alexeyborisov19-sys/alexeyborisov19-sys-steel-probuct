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

- **Last functional implementation SHA:** `f0436d73f43bd2a9d0b303aeedf26b25b7e381bf`
- Functional commit: `Test fail-closed DXF ellipse length convergence and parameter sweep`
- **Last GREEN verified tree HEAD:** `b984da3e54c624b5b5fca0fcf094723c495f7de6`
- CI на `b984da3e…` полностью GREEN:
  - `Steel Product Online Alpha CI`: TypeScript ✅, Unit tests ✅, Next.js build ✅
  - `Verify project package`: Lint ✅, Typecheck ✅, Tests ✅, Build ✅, SEO audit ✅

### Текущий WIP — strict linear planar DXF SPLINE + CI tooling fix

- Autodesk DXF SPLINE contract подтверждён: flags `70`, degree `71`, knot count `72`, control-point count `73`, knots `40`, optional weights `41`, control points `10/20/30`, normal `210/220/230`.
- `d8e9ad7b423154db609365d3800a2d988dcbf6ab`: parser поддерживает только exact-safe subset: open, non-periodic, non-rational, planar+linear flags, degree 1, control-point Z=0, normal +Z/default, корректные declared counts и open-clamped degree-1 knot vector.
- Supported spline нормализуется в open straight polyline по control points; bounds/length/preview переиспользуют уже проверенную exact polyline логику.
- Fit points не используются для реконструкции; nonlinear/closed/periodic/rational/3D/malformed spline не дискретизируется приблизительно.
- Internal fail-closed codes: `SPLINE_UNSUPPORTED`, `SPLINE_NONPLANAR`, `SPLINE_INVALID`, `SPLINE_KNOTS`.
- `fb54a1e0d140662608a85e92b8b3bf92c898f965`: regression suite: valid control polygon, unit weights, knot-count mismatch, duplicate/interior knot order, degree>1, closed/periodic/rational flags, non-unit weights, non-zero Z, non-+Z normal, malformed/mismatched control points.
- **Current WIP functional HEAD:** `fb54a1e0d140662608a85e92b8b3bf92c898f965`.

### CI RED / fixes

- Journal tree `eb50b7a0437e18b41e647536324639b622da8d77`:
  - `Steel Product Online Alpha CI`: полностью GREEN.
  - `Verify project package`: Lint ✅, Typecheck ✅, **557 tests ✅**, Build ✅, SEO audit ❌.
- Первый RED не связан со SPLINE/business logic. SEO audit дважды принудительно вызывал `/_next/image` для внешних `static.mk.ru` URL; third-party origin ответил 504/non-image Content-Type.
- `f508be1fa2791113acaa3d0bac525af513b3602f`: SEO image availability audit теперь детерминированно проверяет first-party/local source assets; локальные Next Image URL по-прежнему разворачиваются к исходному `/...`, а remote optimizer dependency не вызывается. Отдельные media-policy tests продолжают контролировать third-party media boundary/config.
- `2071ce5fa61c8a21f8850dc762d4b36ec4934d5b`: добавлен regression для remote optimizer skip/local source unwrap.
- Journal tree `e6b3e30a1d945a7fa48cde1e9ab33dbe3237b0a9`: lint/typecheck прошли, но новый regression упал на unit-test stage до build/SEO. Production SEO-audit и SPLINE при этом не менялись.
- `eee04cb9541fdf2e54e79d230a973c43e8350d57`: **test-only fix** — regression читает `scripts/audit-seo.mjs` через `process.cwd()`/`node:path` и проверяет устойчивый контракт helper/collector без зависимости от `import.meta.url` и хрупкого regex. Production audit не изменён.
- Новый полный CI на journal-only tree после `eee04cb9…` обязателен; SPLINE ещё не считать GREEN до обоих workflow success, включая фактический SEO audit.

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
- bulged closed area/pierce остаётся fail-closed;
- 3D/polyface/mesh legacy POLYLINE остаётся fail-closed.

---

## 4. IN PROGRESS

### SPLINE — strict exact linear planar subset

Scope реализован и покрыт тестами, но block ещё не DONE до полного CI после SEO tooling fix.

Поддерживается только:
- flags planar + linear;
- degree = 1;
- open, non-periodic, non-rational;
- control-point Z = 0; normal +Z/default;
- finite counts/coordinates/knots;
- `knotCount = controlCount + 2`;
- first/last double knots и строго возрастающие interior domain knots;
- отсутствующие weights либо все weights = 1.

Все остальные SPLINE варианты fail-closed и не превращаются в sampling-based production contour.

---

## 5. NEXT ACTION

1. Полный CI на journal-only tree после `eee04cb9…` и этой journal записи.
2. Если RED — получить конкретный job/step и исправить только фактический failure; записать RED/fix.
3. Если GREEN — `fb54a1e0…` становится новым functional checkpoint; exact journal tree становится новым GREEN verified tree; SPLINE переносится в DONE.
4. После GREEN перейти не к feature creep, а к pre-release stabilization для версии проверки перед публикацией: confidentiality boundary, candidate-build regressions, supported/fail-closed CAD matrix, full build/SEO и Draft PR state.
5. Regression-only malformed legacy POLYLINE hardening выполнять только если он остаётся реально незакрытым и не требует нового рискованного geometry layer.

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
- `b984da3e…` both workflows fully GREEN — current verified checkpoint.

### 2026-09-14 — WIP strict linear SPLINE
- `d8e9ad7b…` exact-safe degree-1 planar parser normalized to open polyline;
- `fb54a1e0…` supported/fail-closed regression suite;
- `eb50b7a…`: Alpha CI GREEN; Verify RED only on SEO audit after 557 tests and build succeeded;
- cause: flaky third-party `static.mk.ru` via Next optimizer, not SPLINE/business logic;
- `f508be1f…`: deterministic first-party-only image availability audit;
- `2071ce5f…`: initial regression for remote optimizer skip/local source unwrap;
- `e6b3e30…`: post-fix gate RED on new regression test before build/SEO;
- `eee04cb9…`: test-only stabilization of that regression; production audit unchanged;
- full post-fix CI pending.

---

## 9. Правило обновления журнала

После meaningful block записывать:
1. functional SHA;
2. verified GREEN tree SHA;
3. RED/fix, если был;
4. что DONE, что fail-closed;
5. следующий конкретный action.