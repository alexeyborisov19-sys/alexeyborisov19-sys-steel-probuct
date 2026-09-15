# Steel Product Online — постоянный журнал разработки

> Recovery/checkpoint-файл. После обрыва сначала сверить этот журнал с фактическими branch HEAD, Draft PR #90 и CI.

## 0. Протокол восстановления

1. Проверить `feat/steel-product-online-clean-alpha-sep14` и Draft PR #90.
2. Сравнить HEAD с `Last GREEN verified tree` и `Last functional implementation SHA`.
3. Journal-only commits не считать новой функциональностью; GREEN относится только к точному проверенному SHA.
4. Любой RED исправлять до нового functional layer.
5. Не переписывать DONE-блоки без конкретного regression/CI evidence.

---

## 1. FINAL REVIEW CHECKPOINT

**Обновлено:** 2026-09-14

- Репозиторий: `alexeyborisov19-sys/alexeyborisov19-sys-steel-probuct`
- Ветка: `feat/steel-product-online-clean-alpha-sep14`
- Draft PR: **#90 — `Steel Product Online: sanitized clean alpha snapshot`**
- Base: `main`
- PR должен оставаться: `open`, `draft`, `merged=false`
- Публикация/deploy: **НЕ ДЕЛАТЬ**
- Merge в `main`: **НЕ ДЕЛАТЬ**
- Payment/checkout: **НЕ РАЗРАБАТЫВАТЬ**

### READY FOR REVIEW BEFORE PUBLICATION

Feature development для текущей pre-release версии остановлен. Новые geometry features до проверки владельцем не добавлять.

- **Last functional implementation SHA:** `fb54a1e0d140662608a85e92b8b3bf92c898f965`
- Functional block: strict exact-safe linear planar DXF SPLINE subset + regressions.
- **Latest stabilization SHA:** `c912cafba2d2857c66bd25bc9854b6125201841c`
- Stabilization block: regression-only malformed legacy POLYLINE matrix; production parser не менялся.
- **FINAL REVIEW CANDIDATE HEAD:** `a47dccda70d2666d3cc78136b3d7f8deae87fa0a`
- **Last GREEN verified tree HEAD:** `a47dccda70d2666d3cc78136b3d7f8deae87fa0a`
- CI на `a47dccda…` полностью GREEN:
  - `Steel Product Online Alpha CI`: TypeScript ✅, Unit tests ✅, Next.js build ✅
  - `Verify project package`: Lint ✅, Typecheck ✅, Tests ✅, Build ✅, SEO audit ✅
- Draft PR #90 на момент проверки: `open`, `draft`, `merged=false`, mergeable=true.
- Этот checkpoint — окончательная версия текущего pre-release scope для ручной проверки владельцем перед решением о публикации.

---

## 2. Жёсткие решения владельца

### Продукт
`CAD → геометрия → DFM → материал/толщина → операции → фактический производственный расчёт → безопасный клиентский результат`.

### Конфиденциальность
Клиенту не показывать:
- supplier prices и private rates;
- direct cost, margin/coefficients;
- manufacturing norms;
- внутренние mass/waste/cut/pierce breakdown;
- detailed internal DFM и production evidence;
- report IDs/paths/storage evidence;
- `powderAreaM2`, `assemblyMinutes`, `surfacePreparationAreaM2`, authoritative factual provenance.

Public/client boundary содержит только безопасный CAD/preview, безопасные размеры, выбранные material/thickness/quantity/operations, coarse status и в будущем отдельно утверждённую sales price/delivery.

### Расчёт
- Laser = фактический контур.
- Material до реального nesting = bounding rectangle вокруг детали, включая scrap.
- Missing physical input/rate = `missing/partial`, не ноль.
- Реальные rates/supplier prices = private runtime basis, не Git/client bundle.
- Аппроксимацию нельзя выдавать за factual production value.
- Unverified/bent STEP остаётся fail-closed для pricing/CAM.

---

## 3. DONE — pre-release scope

### Public/client safety
- client-safe `/online-order` workspace и safe calculation DTO;
- server повторно анализирует CAD перед confidential calculation;
- private economics/DFM/report modules не входят в client boundary;
- `tests/online-order-confidentiality.test.ts` запрещает private economics/production evidence в public workspace/DTO;
- public supplier seed не содержит supplier prices;
- публичный supplier-pricing API/client price service отсутствует.

### Candidate/release safety
- `tests/deploy-candidate-build.test.ts` входит в общий `tests/*.test.ts` GREEN suite;
- candidate build проверяется до замены active build;
- build commit identity проверяется;
- rollback build сохраняется до production redirect audit;
- interrupted promotion имеет service-restore guard;
- **этим checkpoint никакой deploy/publish не выполнялся**.

### STEP
- OpenCascade/BRep analysis;
- planar/cylindrical evidence;
- topology/unfold/flat-pattern verification gates;
- verified planar STEP path;
- server-only exact STEP boundary surface area для internal coating evidence;
- authoritative factual evidence остаётся только в confidential snapshots/revisions;
- unverified/bent STEP не promoted в pricing/CAM.

### Internal factual calculation
- private runtime rate book + supplier snapshot basis;
- bending/welding/powder/assembly/surface-preparation/packaging;
- internal immutable revisions, RBAC/CSRF/report lineage;
- manual technologist override выше automatic evidence;
- missing rate/input остаётся partial/missing.

### Supplier feed
- protected Atlantik refresh/parser/snapshot flow;
- HTTPS allowlist, PDF validation, SHA-256, dry-run/persist, atomic private replacement;
- METALLSERVIS не authoritative до стабильного official machine endpoint.

### DXF — supported factual subset
- `LINE`;
- `CIRCLE`;
- `ARC` — analytic bounds/length;
- `LWPOLYLINE`;
- simple planar legacy `POLYLINE → VERTEX* → SEQEND`;
- straight closed-polyline exact area/hole topology;
- polyline bulge exact bounds + cut length + curved preview;
- `ELLIPSE` full/partial с analytic bounds и controlled numerical length; full ellipse имеет exact area/containment/hole topology;
- strict linear planar `SPLINE`: degree 1, open, non-periodic, non-rational, planar+linear flags, Z=0, +Z/default normal, valid counts, valid open-clamped knot vector, weights absent/all 1; normalizes to exact open straight polyline.

### Regression-only malformed legacy POLYLINE
`c912cafb…` подтверждает fail-closed без parser changes для:
- missing `SEQEND`;
- unexpected nested entity;
- missing X/Y vertex coordinate;
- fewer than two valid vertices.

### Intentionally fail-closed
- bulged closed polyline exact area/pierces пока unavailable;
- legacy 3D/polyface/mesh/complex POLYLINE;
- nonlinear, rational, periodic, closed, 3D или malformed SPLINE;
- non-planar/invalid ELLIPSE;
- unverified/bent STEP pricing/CAM;
- DXF powder coating area без explicit sides.

---

## 4. Последние CI incidents — закрыты

### External image availability
Tree `eb50b7a…`: application tests/build GREEN, SEO audit получил 504 от third-party `static.mk.ru` через Next optimizer.

Fix:
- `f508be1fa2791113acaa3d0bac525af513b3602f`: deterministic first-party image availability audit; remote optimizer availability не считается доступностью нашего сайта.
- third-party media policy/config остаётся под отдельными regressions.

### Regression test contract
Tree `e6b3e30…`: новый SEO-boundary regression упал до build/SEO; production audit/SPLINE не менялись.

Fixes:
- `eee04cb9541fdf2e54e79d230a973c43e8350d57`: test-only stabilization через `process.cwd()`/`node:path`;
- `0c6e10bbc996978016a0dd2e3a671cc987d29839`: collector-contract correction;
- `961c43c0…`: оба workflow GREEN, включая реальный SEO audit.

---

## 5. Manual review checklist

Перед любым решением о публикации владельцу проверить:
1. `/online-order`: upload DXF/STEP, preview, безопасные dimensions/material/thickness/quantity/operations/status.
2. Supported DXF fixtures: line/polyline/bulge/ellipse/strict linear spline.
3. Fail-closed UX для unsupported curved/3D/nonlinear CAD.
4. Internal production report/revision flow отдельно от client UI.
5. Client network/UI не раскрывает rates, supplier prices, costs, DFM/evidence или factual internal inputs.
6. Candidate-build/rollback pipeline запускать только после отдельного решения на deploy.

---

## 6. NEXT ACTION

**Текущий pre-release scope завершён. Feature development остановить до ручного review.**

1. Считать `a47dccda70d2666d3cc78136b3d7f8deae87fa0a` последним подтверждённым FINAL REVIEW CANDIDATE после GREEN обоих workflow.
2. Текущий journal-only commit должен пройти оба workflow; если GREEN — он становится новым metadata-only review checkpoint, функциональный candidate остаётся `a47dccda…`.
3. Отдать владельцу на ручную проверку `/online-order` и внутреннего review flow перед публикацией.
4. Не deploy/publish/merge до отдельного прямого указания владельца.
5. Defects из ручного review исправлять regression-first отдельным блоком с новым CI gate.

---

## 7. Запрещено без нового прямого решения владельца

- merge `main`;
- deploy/publish;
- payment/checkout;
- release/prerelease publication;
- public internal economics/DFM/evidence;
- реальные private rates/prices в Git/client;
- approximate/unsupported geometry как production-authoritative.

---

## 8. Key changelog

- private STEP surface evidence + confidential provenance;
- internal assembly/surface-preparation revision path;
- DXF bulge analytic bounds/length/preview;
- legacy planar POLYLINE safe parser;
- analytic/controlled DXF ELLIPSE;
- strict exact degree-1 planar SPLINE;
- deterministic first-party SEO image availability audit;
- malformed legacy POLYLINE regression-only hardening;
- confidentiality and candidate-build regressions included in full GREEN suite;
- `a47dccda…` = fully verified FINAL REVIEW CANDIDATE before this metadata-only journal checkpoint.
- явная наценка владельца на металл в фактическом расчёте (`STEEL_PRODUCT_METAL_UPLIFT_PCT`, по умолчанию 5 %), значение только на сервере;
- systemd-таймер обновления прайса поставщика `deploy/systemd/steelprodukt-metal-prices.*` (дважды в сутки, внутри 72-часового окна свежести). Перед установкой администратор обязан проверить фактические пути `npm`, права пользователя `nodejs` и выполнить `npm run prices:refresh -- --dry-run`; до этого автообновление цен нельзя считать включённым на production.
