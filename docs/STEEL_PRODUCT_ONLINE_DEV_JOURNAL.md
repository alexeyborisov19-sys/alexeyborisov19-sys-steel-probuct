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

- **Last functional implementation SHA:** `f8f97fc2a5ed77a36dab76e209d08f9227528e44`
- Functional commit: `Update snapshot fixture for DXF bulge metadata`
- **Last GREEN verified tree HEAD:** `155c19c555d4788d8a5af35f684ebdd231211482`
- CI на `155c19c…` полностью GREEN:
  - `Steel Product Online Alpha CI`: TypeScript ✅, Unit tests ✅, Next.js build ✅
  - `Verify project package`: Lint ✅, Typecheck ✅, Tests ✅, Build ✅, SEO audit ✅

### Текущий WIP — legacy POLYLINE / VERTEX

- `1f8b12025fd6e1940a62f7ef55359ee9c2768609`: parser поддерживает безопасный legacy `POLYLINE → VERTEX* → SEQEND` subset.
- `72cc5ecc4bfd7e5abe326c265e3f43201f034f01`: regression fixtures для open/closed, vertex bulge, closing bulge и complex 3D/mesh fail-closed.
- Обычный 2D legacy path нормализуется в тот же `{ points, bulges, closed }`, что LWPOLYLINE.
- `POLYLINE` flags curve-fit/spline-fit/3D/mesh/polyface и complex `VERTEX` flags не promoted в production geometry.
- Non-zero vertex Z не flatten-ится молча в 2D.
- Complex sequence создаёт internal unsupported evidence (`POLYLINE_COMPLEX` / sequence issue), а не производственный контур.
- CI для этого WIP ещё не зафиксирован как GREEN. До gate следующий функциональный слой не начинать.

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
Клиенту не показывать: закупочные цены, ставки, себестоимость, нормы, массу/отход/рез/прожиги как внутреннюю калькуляцию, detailed internal DFM, production evidence, report IDs/paths, factual assembly/surface-preparation inputs.

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
- client-safe `/online-order` workspace;
- safe client DTO;
- public calculation server повторно анализирует CAD;
- private economics/DFM/report evidence не импортируются в client boundary;
- confidentiality regression запрещает `powderAreaM2`, `assemblyMinutes`, `surfacePreparationAreaM2`, `authoritativeFactualByPartId`, cost/rate/supplier/report/DFM evidence в client workspace/DTO.

### STEP
- OpenCascade analysis;
- BRep planar/cylindrical evidence;
- thickness/bend candidates;
- topology/unfold pipeline;
- flat-pattern verification gates;
- unverified bent STEP fail-closed для pricing/CAM;
- server-only exact STEP surface area для internal factual coating;
- server-authoritative factual evidence только в confidential snapshot/revisions.

### Factual/internal
- private runtime rate book;
- supplier snapshot basis;
- factual project aggregation;
- bending/welding/powder;
- assembly/surface-preparation/packaging semantics;
- `assemblyMinutes` + `surfacePreparationAreaM2` через internal immutable revisions;
- internal report/list/detail/RBAC/CSRF/revision lineage;
- manual technologist override выше automatic evidence.

### Supplier feed
- Atlantik protected refresh/parser/snapshot flow;
- HTTPS allowlist, PDF validation, SHA-256, dry-run/persist, atomic private replacement;
- METALLSERVIS не использовать как authoritative до стабильного official machine endpoint.

### DXF
- LINE, CIRCLE, ARC, LWPOLYLINE;
- exact straight closed-polyline area/hole topology;
- exact ARC bbox/length;
- exact LWPOLYLINE bulge bbox/length + curved preview;
- bulged closed area/pierce остаётся fail-closed.

---

## 4. IN PROGRESS

### Legacy `POLYLINE / VERTEX / SEQEND`

Реализовано в WIP:
- stateful sequence parse `POLYLINE → VERTEX* → SEQEND`;
- simple 2D vertices читают X/Y и optional bulge group 42;
- open/closed берётся из `POLYLINE group 70 bit 1`;
- normalized shape переиспользует существующий analytic segment engine, поэтому bbox/cut length/bulge preview не имеют отдельной legacy-формулы;
- closing vertex bulge поддерживается;
- nested VERTEX/SEQEND не появляются как ложные top-level unsupported entities;
- 3D/polyface/polygon mesh/curve-fit/spline-fit и complex vertices fail-closed;
- invalid/missing sequence/vertices не объявляются production geometry.

Regression WIP:
- simple open 2D path;
- closed rectangle: exact area/pierce/hole semantics;
- legacy vertex semicircle bulge: exact bbox/cut length;
- closing bulge;
- 3D/mesh complex sequence исключается из shapes и оставляет unsupported evidence.

---

## 5. NEXT ACTION

1. Запустить/проверить полный CI на текущем WIP tree после journal commit.
2. Если RED — локализовать и исправить только текущий legacy POLYLINE block; записать failure/fix в журнал.
3. Если GREEN — `72cc5ecc…` становится новым functional checkpoint, а проверенный journal tree — новым GREEN verified tree.
4. После GREEN выбрать следующий малый DXF gap: exact bulged closed topology либо ELLIPSE/SPLINE; никаких новых слоёв до gate.

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
- approximate curved area/pierces выдавать как exact factual values.

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
- `ae09b1e5…` — предыдущий green functional checkpoint.

### 2026-09-14 — DXF LWPOLYLINE bulge
- `e2d3bb9c…` — analytic bulge arc geometry, exact bbox/cut length;
- `2a0a6089…` — curved preview;
- `9e163240…` — regression suite;
- CI RED: legacy snapshot fixture не содержал `bulges[]`;
- `f8f97fc2…` — fixture updated, без ослабления production logic;
- `155c19c…` — verified tree: оба workflow полностью GREEN;
- curved closed area/pierce topology намеренно остаётся fail-closed.

### 2026-09-14 — WIP legacy POLYLINE/VERTEX
- `1f8b1202…` — safe simple 2D legacy sequence parser + complex/3D fail-closed masks;
- `72cc5ecc…` — regression tests open/closed/bulge/closing-bulge/3D-mesh rejection;
- CI pending на момент записи.

---

## 9. Правило обновления журнала

После meaningful block записывать:
1. functional SHA;
2. verified GREEN tree SHA;
3. RED/fix, если был;
4. что DONE, что fail-closed;
5. следующий конкретный action.
