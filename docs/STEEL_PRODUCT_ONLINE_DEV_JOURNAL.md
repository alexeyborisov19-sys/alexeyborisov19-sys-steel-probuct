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

### Закрытый последний block — legacy POLYLINE / VERTEX

- `1f8b1202…`: safe parser `POLYLINE → VERTEX* → SEQEND` для простого 2D subset.
- `72cc5ecc…`: regression open/closed/bulge/closing-bulge/3D-mesh rejection.
- 2D legacy path нормализуется в тот же `{points, bulges, closed}`, что LWPOLYLINE.
- bbox/cut length/bulge preview переиспользуют уже проверенный analytic segment engine.
- curve-fit/spline-fit/3D/mesh/polyface flags и complex vertices не promoted в production geometry.
- Non-zero vertex Z не flatten-ится молча в 2D.
- Nested VERTEX/SEQEND не становятся ложными top-level unsupported entities.
- Complex sequence оставляет unsupported evidence и fail-closed semantics.

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

### Следующий DXF compatibility block — ELLIPSE

Выбран как меньший доказуемый блок после GREEN legacy POLYLINE gate.

Безопасная цель первого этапа:
- поддержать DXF `ELLIPSE` только как 2D analytic curve;
- читать center (10/20), major-axis endpoint vector (11/21), ratio minor/major (40), start/end parameters (41/42);
- production bbox считать аналитически для полного эллипса и параметрической дуги, а не по coarse preview sampling;
- production cut length: для полного/частичного эллипса не выдавать недоказанную простую формулу; использовать математически контролируемую numerical integration с заданной error tolerance либо оставлять factual length unavailable до proof;
- preview sampling отделить от production calculations;
- closed full ellipse topology/area можно объявлять exact только при доказанном полном параметрическом диапазоне; partial ellipse остаётся open topology.

---

## 5. NEXT ACTION

1. Проверить DXF ELLIPSE parameter semantics и текущую shape/model boundary.
2. Добавить отдельный `ellipse` shape с center, major vector, ratio, start/end parameters.
3. Реализовать analytic parameter point + extrema/bounds; не использовать preview sampling для production bbox.
4. Выбрать доказуемый cut-length method с regression fixtures; если точность не доказана — fail closed вместо approximate factual length.
5. Regression: axis-aligned full ellipse, rotated full ellipse, partial arc crossing extrema, invalid ratio/vector, preview only after production math.
6. Journal WIP → полный CI → GREEN checkpoint до следующего слоя.

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
- `72cc5ecc…` open/closed/bulge/closing-bulge/3D-mesh regression;
- `5e38668…` both workflows fully GREEN;
- `72cc5ecc…` = current functional checkpoint.

### 2026-09-14 — WIP ELLIPSE
- block открыт после GREEN legacy POLYLINE gate;
- никакая approximate ellipse length/area не считается factual без отдельного proof/regression.

---

## 9. Правило обновления журнала

После meaningful block записывать:
1. functional SHA;
2. verified GREEN tree SHA;
3. RED/fix, если был;
4. что DONE, что fail-closed;
5. следующий конкретный action.
