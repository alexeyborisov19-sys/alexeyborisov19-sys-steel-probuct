# Steel Product Online — UI / motion direction

## Design intent

Встроенное производственное приложение должно ощущаться как инженерный инструмент «Сталь Продукт», а не как маркетинговая форма и не как копия интерфейса конкурента.

### Визуальные принципы
- фон: black / deep graphite;
- панели: RAL 7024-like graphite layers;
- action/highlight: фирменный orange;
- прямые углы;
- тонкие технические границы;
- фирменный срез в углах карточек;
- engineering grid как фон рабочего пространства;
- технические подписи мелким uppercase;
- контрастные крупные числа и статусы;
- модель всегда главный визуальный объект.

## Desktop layout

`Project rail | CAD / DFM workspace | Manufacturing configurator`

### Project rail
- позиции проекта;
- thumbnail детали;
- revision/state;
- add/duplicate/replace;
- в дальнейшем drag sorting и bulk edit.

### Workspace
- Model / DFM / Flat / 3D tabs;
- pan/zoom/rotate controls;
- dimensions overlay;
- feature markers;
- toolpath-like contour animation;
- geometry/DFM summary.

### Configurator
- material;
- thickness;
- quantity;
- operations;
- context-sensitive options;
- commercial result;
- lead time;
- primary action.

## Mobile

Панели превращаются в вертикальный flow:
1. project item/header;
2. viewport;
3. geometry/DFM tabs;
4. sticky bottom quote summary;
5. configurator as expandable sections.

## Motion

Motion должен объяснять состояние системы.

### CAD ingest
- drop pulse;
- scanning line;
- sequential stage activation;
- geometry draws in as toolpath.

### DFM
- status appears per rule;
- blocking rule pulses once, not infinitely;
- selecting rule will later highlight corresponding geometry feature.

### Configuration
- selected operation lights up corresponding production-route node;
- unavailable operation collapses/desaturates;
- quantity/price later uses rolling number transition.

### Sheet metal / STEP
- 2D ↔ 3D morph is not faked;
- after STEP engine exists, bend preview animates actual hinge transforms around detected bend lines;
- flat/fold state reflects authoritative geometry.

### Accessibility
- all decorative infinite motion disabled/reduced for `prefers-reduced-motion`;
- no critical state communicated by motion alone.

## Screens planned

1. Empty upload workspace.
2. CAD analysis.
3. 2D DXF result.
4. DFM result.
5. STEP 3D result.
6. Bend configuration.
7. Operations configuration.
8. Quote result.
9. Multi-part project/cart.
10. Formal quote / company details.
11. Account: Parts / Projects / Orders.
12. Order tracking / production status.
13. Technology review queue (internal).
14. Materials / DFM / pricing admin (internal).
