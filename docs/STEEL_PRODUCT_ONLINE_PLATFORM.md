# Steel Product Online — архитектура цифровой производственной платформы

Статус: архитектурный baseline для ветки `feat/steel-product-instant-quote-cad-sep14`.

## Цель

Создать встроенную в steelprodukt.ru клиентскую платформу, в которой заказчик проходит путь от CAD-файла до производственного заказа с минимальным участием менеджера:

`CAD → Geometry → DFM → Configuration → Quote → Project/Cart → Commercial docs → Order → Production handoff → Tracking → Reorder`.

Продукт разрабатывается независимо под бренд «Сталь Продукт». Внешний UX ориентируется на лучшие практики instant-manufacturing платформ, но код, графика, тексты, дизайн-система, технологические правила и коммерческая логика являются собственными.

## 1. Клиентское приложение

### 1.1 Start / Intake
- Drag & Drop.
- DXF, DWG, STEP, STP в целевой версии.
- Пакетная загрузка нескольких деталей.
- Позже: PDF/эскиз и AI Parts Builder.
- Выбор единиц измерения при неоднозначности.

### 1.2 CAD Workspace
- 2D viewer для DXF/DWG.
- 3D viewer для STEP/STP.
- Fit / rotate / pan / zoom / reset.
- Изоляция детали из сборки.
- Подсветка выбранных граней, отверстий и гибов.
- Просмотр flat/folded для листовой детали.

### 1.3 Part Inspector
Нормализованное представление детали:
- bounding box;
- material thickness;
- area / volume / mass;
- outer contours;
- inner contours;
- cut length;
- pierce count;
- holes/features;
- bends;
- bend directions;
- bend angles;
- assembly/body count;
- revision/hash исходного CAD.

### 1.4 Manufacturing Configurator
Каскадная конфигурация:
`материал → толщина → доступные технологии → доступные параметры операции`.

Целевые операции:
- лазерная резка;
- гибка;
- панельная гибка;
- резьба;
- зенковка;
- запрессовочный крепёж;
- слесарно-доводочные операции;
- сварка;
- сборка;
- подготовка поверхности;
- порошковая окраска;
- контроль;
- комплектация и упаковка.

Пользователь не должен иметь возможность выбрать технологически несовместимую комбинацию.

## 2. CAD / Geometry Engine

Вход: исходный CAD.

Выход: `NormalizedPart`.

### DXF
Первый поддерживаемый формат. Клиентский parser используется для быстрого preview; серверный parser должен выполнять authoritative-анализ перед коммерческим расчётом.

### STEP/STP
Целевая схема:
1. server-side STEP parser / geometry kernel;
2. извлечение solids/faces/edges;
3. поиск постоянной толщины;
4. классификация как sheet-metal / machined / unsupported;
5. извлечение цилиндрических отверстий;
6. распознавание bend regions;
7. построение neutral surface / flat pattern;
8. возврат облегчённой mesh-модели в браузер.

Клиентское приложение никогда не считается authoritative-источником технологических размеров.

## 3. DFM Engine

DFM работает до цены.

Результат каждого правила:
- `pass`;
- `warning`;
- `blocking_error`;
- `manual_review`.

### Категории правил
- поддерживаемый материал;
- толщина;
- максимальный/минимальный габарит;
- минимальное отверстие;
- минимальная перемычка;
- расстояние отверстия до края;
- расстояние отверстия до зоны гиба;
- минимальная полка;
- внутренний радиус;
- допустимый угол;
- максимальная длина гиба;
- коллизии при гибке;
- доступный инструмент;
- открытая/битая геометрия;
- дублирующиеся контуры;
- самопересечения;
- технологичность сварки/сборки;
- ограничения окраски/печи/подвеса;
- ограничения упаковки.

Каждое правило имеет version + effective date. Цена сохраняет версию правил, по которой была рассчитана.

## 4. Materials & Capability Engine

`MaterialFamily → Grade → Thickness → Operations → Parameters`.

Данные должны быть администрируемыми, а не захардкоженными в UI.

Примеры параметров:
- плотность;
- закупочная стоимость;
- стандартный формат/рулон;
- доступные толщины;
- laser speed profile;
- pierce profile;
- kerf;
- bend radius;
- K-factor/bend deduction;
- min flange;
- доступные V-матрицы/пуансон;
- допустимые покрытия;
- температурные/габаритные ограничения окраски.

До подтверждения реальных значений используются только `TBD`, а не вымышленные нормы.

## 5. Pricing Engine

Pricing Engine принимает authoritative geometry + manufacturing configuration + quantity.

Структура стоимости:
- material allocation;
- nesting/material yield;
- cutting time;
- pierces;
- machine setup;
- bending cycles/setup;
- secondary operations;
- welding/assembly labor;
- finishing;
- QC;
- packaging;
- handling;
- risk/scrap reserve;
- overhead;
- margin;
- quantity economics.

Pricing Engine хранит cost breakdown внутренне. Клиенту может выводиться только коммерческая цена и разрешённая детализация.

Никакие коммерческие тарифы не публикуются до утверждения владельцем.

## 6. Lead-time Engine

Вход:
- production route;
- quantity;
- material availability;
- current capacity;
- secondary operations;
- batching constraints.

Выход:
- earliest production-ready date;
- standard ready date/window;
- expedite option, если разрешено.

На первом этапе допускается rules-based срок; далее — интеграция с реальной загрузкой производства.

## 7. Project / Cart Engine

Корзина — это производственный проект, а не обычная e-commerce корзина.

### Project
- id;
- customer/company;
- currency;
- delivery data;
- quote status;
- revision.

### ProjectItem
- CAD source;
- geometry snapshot;
- configuration;
- quantity;
- DFM result;
- price snapshot;
- lead-time snapshot;
- revision.

Поддерживаются:
- несколько разных деталей;
- duplicate;
- replace revision;
- change quantity;
- bulk material/finish edit;
- saved project;
- shared project;
- reorder.

## 8. B2B Commerce

Целевой российский сценарий:
- реквизиты юрлица;
- ИНН/КПП;
- КП;
- счёт;
- договор/спецификация при необходимости;
- статус оплаты;
- история документов;
- несколько сотрудников компании и роли.

Внешний checkout не является единственным сценарием: B2B «КП → счёт → оплата» — first-class flow.

## 9. Human Review Gate

Автоматизация не отменяет технолога.

Решение:
- `AUTO_APPROVED` — низкий риск, все правила pass;
- `AUTO_APPROVED_WITH_WARNINGS` — разрешённые warning;
- `TECH_REVIEW_REQUIRED` — спорная геометрия/операция;
- `BLOCKED` — изготовление невозможно в текущей конфигурации.

Технолог видит причину каждого срабатывания и может approve/reject/request-change с аудитом решения.

## 10. Production Bridge

После подтверждения:
- immutable order snapshot;
- manufacturing route;
- файлы/ревизии;
- material requirement;
- operation sequence;
- QC notes;
- packaging notes;
- links to CAM/nesting artifacts.

Дальнейшие стадии:
- CAM/nesting integration;
- производственные задания;
- станок/участок;
- статусы операций;
- QC;
- упаковка;
- отгрузка.

## 11. Customer Account

Разделы:
- Проекты;
- Детали;
- Заказы;
- КП и счета;
- Избранные конфигурации;
- Reorder;
- Company/Team;
- Addresses;
- Notifications.

Каждая деталь имеет стабильный `Part ID` и историю ревизий.

## 12. Analytics / Admin

### Admin
- materials;
- thicknesses;
- operations;
- capabilities;
- DFM rules;
- pricing rules;
- minimum order rules;
- quote approvals;
- manual review queue;
- production integration settings.

### Analytics
- upload → valid CAD;
- valid CAD → priced;
- priced → cart;
- cart → quote/order;
- DFM failure reasons;
- quote latency;
- conversion by material/operation;
- manual review rate;
- reorder rate.

## 13. Безопасность

CAD заказчика — конфиденциальные производственные данные.

Требования:
- authenticated ownership checks;
- opaque object IDs;
- signed download URLs;
- malware/file validation;
- upload size/type limits;
- encryption in transit / at rest where supported;
- audit log;
- retention policy;
- no public indexing of CAD assets;
- server-side authoritative price and DFM.

## 14. UI architecture

Визуальный язык — существующий бренд «Сталь Продукт»:
- black / RAL 7024 graphite / orange;
- прямые углы и фирменный срез;
- engineering grid;
- тонкие линии/размерные метки;
- моноширинные технические secondary labels;
- крупное 2D/3D рабочее поле;
- конфигуратор справа;
- project rail слева/снизу на responsive layouts.

### Motion language
Анимация функциональна:
- staged CAD ingest;
- scan-line при анализе геометрии;
- контуры проявляются как toolpath;
- DFM markers spring-in на проблемные features;
- при выборе операции маршрут подсвечивается;
- цена меняется rolling-number transition;
- 2D ↔ 3D transition;
- bend preview показывает складывание по линиям гиба;
- reduced-motion fallback обязателен.

## 15. Релизная стратегия

### Alpha A — сейчас
- branded workspace;
- DXF upload;
- browser preview;
- geometry summary;
- project item state;
- material/thickness/quantity UI;
- operations UI;
- animated ingest/workspace;
- price remains unavailable without approved rules.

### Alpha B
- server authoritative DXF parser;
- DFM rules v1;
- approved materials matrix;
- first real laser price model;
- cart/project persistence.

### Beta A
- STEP/STP parser;
- 3D mesh viewer;
- sheet metal detection;
- bends/features;
- real bending quote.

### Beta B
- formal quote;
- company accounts;
- saved parts/projects;
- reorder;
- order tracking.

### Production
- CAM/nesting bridge;
- production status integration;
- capacity-driven lead time;
- admin rule management;
- audit/security hardening.
