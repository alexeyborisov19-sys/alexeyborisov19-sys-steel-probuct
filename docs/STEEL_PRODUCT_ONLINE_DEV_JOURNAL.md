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

- **Last functional implementation SHA:** `72cc5ecc4bfd7e5abe326c265e3f43201f034f01`
- Functional commit: `Test safe legacy DXF POLYLINE VERTEX support`
- **Last GREEN verified tree HEAD:** `5e38668d7d4c603c1e5c72213f8cc984e65868b7`
- CI на `5e38668…` полностью GREEN:
  - `Steel Product Online Alpha CI`: TypeScript ✅, Unit tests ✅, Next.js build ✅
  - `Verify project package`: Lint ✅, Typecheck ✅, Tests ✅, Build ✅, SEO audit ✅

### Текущий WIP — DXF ELLIPSE

- Autodesk DXF contract проверен: center `10/20`, major-axis vector `11/21`, minor/major ratio `40`, start/end parameters `41/42`; full ellipse = `0..2π`.
- `671ad8426efaa6ed737d046f06c8c9b453181a91`: добавлен `ellipse` shape, exact parametric point, analytic extrema/bounds, exact full area `πab`, controlled adaptive-Simpson cut length.
- `95ffc444fb2a411be4cecdd21cd338214d42c89a`: preview sampling вынесен отдельно от production math.
- `c16e0162a60b76945afc4e8e6a6c2d0e6ccf8c36`: regression fixtures: axis-aligned full ellipse, rotated bounds, partial/wrapped parameters, exact ellipse hole topology, preview separation, non-planar и invalid-ratio fail-closed.
- Non-XY extrusion и major-axis Z не проецируются молча в XY; дают internal unsupported evidence.
- Full ellipse area/topology считается exact только для доказанного `0..2π`; partial ellipse остаётся open topology.
- WIP CI ещё не зафиксирован как GREEN. До gate следующий functional layer не начинать.

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
- topology/unfold/flat-pattern verification gates;
- unverified bent STEP fail-closed для pricing/CAM;
- server-only exact STEP surface area для internal factual coating;
- server-authoritative factual evidence только в confidential snapshot/revisions.

### Factual/internal
- private runtime rate book + supplier snapshot basis;
- factual project aggregation;
- bending/welding/powder/assembly/surface-preparation/packaging;
- `assemblyMinutes` + `surfacePreparationAreaM2` через internal immutable revisions;
- internal reports/RBAC/CSRF/revision lineage;
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
- exact LWPOLYLINE/legacy bulge bbox/length + curved preview;
- bulged closed area/pierce остаётся fail-closed;
- 3D/polyface/mesh legacy POLYLINE остаётся fail-closed.

---

## 4. IN PROGRESS

### ELLIPSE

Реализовано в WIP:
- 2D parameterization `P(t) = C + A cos(t) + B sin(t)`, где `A` — major vector, `B` — перпендикулярный minor vector с ratio;
- full/partial parameter sweep с wrap через `2π`;
- analytic X/Y extrema для production bbox;
- cut length через adaptive Simpson integration параметрической скорости с absolute error tolerance, не через preview sampling;
- exact full area `πab` и containment для hole topology;
- partial ellipse не считается closed contour;
- non-planar/invalid ellipse не становится production geometry;
- preview имеет отдельный sampling helper.

Regression WIP:
- full axis-aligned `a=100,b=50`, reference circumference `484.4224110273838`;
- rotated full ellipse bbox;
- partial circular ellipse `r·Δt`;
- wrapped parameter range;
- ellipse hole внутри closed rectangle;
- preview endpoints;
- non-planar major-axis Z and invalid ratio fail-closed.

---

## 5. NEXT ACTION

1. Полный CI на текущем ELLIPSE WIP tree после journal commit.
2. Если RED — исправить только ELLIPSE block и записать failure/fix.
3. Если GREEN — `c16e0162…` становится новым functional checkpoint; journal tree — новым GREEN verified tree.
4. После GREEN оценить следующий gap: SPLINE только как строго ограниченный subset либо exact bulged closed topology; не начинать до gate.

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
- `e2d3bb9c…` analytic bulge geometry; `2a0a6089…` preview; `9e163240…` regressions;
- RED: old snapshot fixture lacked `bulges[]`; `f8f97fc2…` fixed fixture only;
- `155c19c…` both workflows GREEN.

### 2026-09-14 — legacy POLYLINE/VERTEX
- `1f8b1202…` safe simple 2D parser + complex/3D fail-closed;
- `72cc5ecc…` regression;
- `5e38668…` both workflows fully GREEN.

### 2026-09-14 — WIP ELLIPSE
- `671ad842…` analytic geometry/topology + controlled length integration;
- `95ffc444…` separate preview;
- `c16e0162…` regression suite;
- CI pending на момент записи.

---

## 9. Правило обновления журнала

После meaningful block записывать:
1. functional SHA;
2. verified GREEN tree SHA;
3. RED/fix, если был;
4. что DONE, что fail-closed;
5. следующий конкретный action.
