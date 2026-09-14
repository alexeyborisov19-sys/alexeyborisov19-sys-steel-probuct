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

### Последняя проверенная точка

- **Last functional implementation SHA:** `f0436d73f43bd2a9d0b303aeedf26b25b7e381bf`
- Functional commit: `Test fail-closed DXF ellipse length convergence and parameter sweep`
- **Last GREEN verified tree HEAD:** `b984da3e54c624b5b5fca0fcf094723c495f7de6`
- CI на `b984da3e…` полностью GREEN:
  - `Steel Product Online Alpha CI`: TypeScript ✅, Unit tests ✅, Next.js build ✅
  - `Verify project package`: Lint ✅, Typecheck ✅, Tests ✅, Build ✅, SEO audit ✅

### Закрытый последний block — DXF ELLIPSE

- Autodesk DXF contract: center `10/20`, major-axis vector `11/21`, minor/major ratio `40`, start/end parameters `41/42`; full ellipse = `0..2π`.
- `671ad842…`: ellipse shape, exact parameterization, analytic extrema/bounds, exact full area `πab`, controlled adaptive-Simpson cut length.
- `95ffc444…`: preview sampling отдельно от production math.
- `c16e0162…`: full/rotated/partial/wrapped/hole/non-planar/invalid-ratio regression suite.
- `aa6bee60…`: numerical integration fails closed при non-finite math или recursion depth exhaustion без доказанной tolerance.
- `f0436d73…`: zero wrapped sweep и unavailable-length regressions.
- Non-XY extrusion / major-axis Z не проецируются молча в XY.
- Full ellipse участвует в exact closed topology; partial ellipse остаётся open topology.

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

### SPLINE — только доказуемый linear planar subset

Autodesk contract подтверждён: flags `70`, degree `71`, knot count `72`, control-point count `73`, knots `40`, control points `10/20/30`, optional weights `41`, normal `210/220/230`.

Первый безопасный scope:
- только open, non-periodic, non-rational SPLINE;
- degree = 1;
- planar/linear flags должны подтверждать линейный 2D spline;
- control-point Z = 0; normal только +Z/default;
- knot count и control-point count должны совпадать с фактическими данными;
- поддерживать только корректный open-clamped degree-1 knot vector: первые/последние 2 knots равны, внутренние knots строго возрастают;
- такой spline геометрически совпадает с последовательностью control-point line segments и может быть нормализован в open straight polyline;
- любые closed/periodic/rational/nonlinear/3D/malformed варианты — fail-closed, не sampling.

---

## 5. NEXT ACTION

1. Добавить parser `SPLINE` для strict linear planar subset с отдельными internal issue codes.
2. Не использовать fit points как замену control points и не реконструировать nonlinear spline приблизительно.
3. Regression: valid degree-1 open-clamped spline, rotated/general control points, invalid knot count/order, degree>1, rational/periodic/closed, non-zero Z/non-planar normal.
4. Preview должен переиспользовать normalized polyline; production length/bounds — exact straight segments.
5. Записать WIP в журнал и выполнить полный CI до следующего layer.

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

### 2026-09-14 — next WIP
- open strict degree-1 planar SPLINE subset only; nonlinear/rational/periodic remain unsupported.

---

## 9. Правило обновления журнала

После meaningful block записывать:
1. functional SHA;
2. verified GREEN tree SHA;
3. RED/fix, если был;
4. что DONE, что fail-closed;
5. следующий конкретный action.
