type SolutionItemVisualProps = { kind: string; title: string; brighter?: boolean };

const line = "#f2f3f4";
const accent = "#ea5b0c";
const muted = "#647078";

type ProductVisual = { src: string; alt: string; imageClassName?: string };

// Визуалы решений — самостоятельные оригинальные концепт-иллюстрации.
// Фотографии производства, компании и проектов намеренно не стилизуются.
const productVisuals: Record<string, ProductVisual> = {
  basket: {
    src: "/images/solutions/climate/ac-basket-anime-r01.png",
    alt: "Корзина для наружного блока кондиционера из перфорированного металла",
    imageClassName: "brightness-[1.22] contrast-[1.02] saturate-[1.04]",
  },
  "climate-bracket": {
    src: "/images/solutions/climate/ac-brackets-anime-r01.png",
    alt: "Усиленные кронштейны для наружного блока кондиционера",
    imageClassName: "brightness-[1.24] contrast-[1.02] saturate-[1.04]",
  },
  screen: {
    src: "/images/solutions/climate/ac-screen-anime-r02.png",
    alt: "Декоративный экран для климатического оборудования",
    imageClassName: "brightness-[1.32] contrast-[1.03] saturate-[1.04]",
  },
  "custom-basket": {
    src: "/images/solutions/climate/ac-custom-baskets-anime-r01.png",
    alt: "Индивидуальные корзины для группы кондиционеров",
    imageClassName: "brightness-[1.22] contrast-[1.02] saturate-[1.04]",
  },
  guard: {
    src: "/images/solutions/climate/ac-antivandal-anime-r01.png",
    alt: "Антивандальная защитная конструкция для наружного блока",
    imageClassName: "brightness-[1.24] contrast-[1.02] saturate-[1.04]",
  },
  "perforated-panel": {
    src: "/images/solutions/climate/ac-perforated-panel-anime-r01.png",
    alt: "Декоративная перфорированная панель для климатической зоны",
    imageClassName: "brightness-[1.23] contrast-[1.02] saturate-[1.05]",
  },
  fasteners: {
    src: "/images/solutions/climate/ac-fasteners-anime-r01.png",
    alt: "Монтажные элементы и крепёж для климатического оборудования",
  },
  cabinet: {
    src: "/images/solutions/industry/cabinet-anime-r01.png",
    alt: "Корпуса и шкафы для промышленного оборудования",
  },
  "industrial-guard": {
    src: "/images/solutions/industry/industrial-guard-anime-r01.png",
    alt: "Защитное ограждение для промышленного оборудования",
  },
  frame: {
    src: "/images/solutions/industry/frame-anime-r01.png",
    alt: "Сварная несущая рама для промышленного оборудования",
  },
  tray: {
    src: "/images/solutions/industry/tray-anime-r01.png",
    alt: "Кабельные лотки и короба из листового металла",
  },
  "industrial-panel": {
    src: "/images/solutions/industry/industrial-panel-anime-r01.png",
    alt: "Сервисная панель для промышленного оборудования",
  },
  platform: {
    src: "/images/solutions/industry/platform-anime-r01.png",
    alt: "Промышленная площадка с лестницей и ограждением",
  },
  pallet: {
    src: "/images/solutions/industry/pallet-anime-r01.png",
    alt: "Металлический поддон для промышленного оборудования",
  },
  "industrial-bracket": {
    src: "/images/solutions/industry/industrial-bracket-anime-r01.png",
    alt: "Усиленный кронштейн для промышленного оборудования",
  },
  grille: {
    src: "/images/solutions/engineering/grille-anime-r01.png",
    alt: "Вентиляционная решётка из листового металла",
  },
  hatch: {
    src: "/images/solutions/engineering/hatch-anime-r01.png",
    alt: "Металлический ревизионный люк для инженерных систем",
  },
  "engineering-bracket": {
    src: "/images/solutions/engineering/engineering-bracket-anime-r01.png",
    alt: "Инженерный кронштейн для крепления коммуникаций",
  },
  mounting: {
    src: "/images/solutions/engineering/mounting-anime-r01.png",
    alt: "Монтажная рама для инженерного оборудования",
  },
  support: {
    src: "/images/solutions/engineering/support-anime-r01.png",
    alt: "Опорная конструкция для технического оборудования",
  },
  "roof-system": {
    src: "/images/solutions/engineering/roof-system-anime-r01.png",
    alt: "Кровельная монтажная система для инженерного оборудования",
  },
  deflector: {
    src: "/images/solutions/engineering/deflector-anime-r01.png",
    alt: "Кровельный дефлектор и вентиляционный зонт",
  },
  design: {
    src: "/images/solutions/custom/design-anime-r01.png",
    alt: "Инженерная разработка изделия из листового металла",
  },
  documentation: {
    src: "/images/solutions/custom/documentation-anime-r01.png",
    alt: "Подготовка конструкторской документации на изделие",
  },
  prototype: {
    src: "/images/solutions/custom/prototype-anime-r01.png",
    alt: "Опытный образец изделия из листового металла",
  },
  production: {
    src: "/images/solutions/custom/production-anime-r01.png",
    alt: "Лазерная резка и гибка изделия по чертежам",
    imageClassName: "brightness-[1.22] contrast-[1.02] saturate-[1.04]",
  },
  serial: {
    src: "/images/solutions/custom/serial-anime-r01.png",
    alt: "Серийное производство корпусов из листового металла",
  },
  substitution: {
    src: "/images/solutions/custom/substitution-anime-r01.png",
    alt: "Импортозамещение детали из листового металла",
  },
  optimization: {
    src: "/images/solutions/custom/optimization-anime-r01.png",
    alt: "Оптимизация раскроя и конструкции изделия",
  },
  oem: {
    src: "/images/solutions/custom/oem-anime-r01.png",
    alt: "OEM-производство и упаковка изделий из листового металла",
  },
};

type SchemeMeta = {
  code: string;
  horizontal: string;
  vertical: string;
  callouts: [string, string];
};

const schemeMeta: Record<string, SchemeMeta> = {
  basket: { code: "СП-КЛ-01", horizontal: "L — по габариту блока", vertical: "H — по фасадной сетке", callouts: ["Защитный контур", "Свободный воздушный поток"] },
  "climate-bracket": { code: "СП-КЛ-02", horizontal: "L — вылет консоли", vertical: "H — отметка монтажа", callouts: ["Анкерное крепление", "Раскос под нагрузку"] },
  screen: { code: "СП-КЛ-03", horizontal: "L — ширина экрана", vertical: "H — высота экрана", callouts: ["Перфорация", "Сервисный доступ"] },
  "custom-basket": { code: "СП-КЛ-04", horizontal: "L — по проекту", vertical: "H — по проекту", callouts: ["Рама изделия", "Объём для оборудования"] },
  guard: { code: "СП-КЛ-05", horizontal: "L — зона защиты", vertical: "H — по высоте оборудования", callouts: ["Усиленный лист", "Контролируемый доступ"] },
  "perforated-panel": { code: "СП-КЛ-06", horizontal: "L — по модулю фасада", vertical: "H — по проекту", callouts: ["Рисунок перфорации", "Монтажная рамка"] },
  fasteners: { code: "СП-КЛ-07", horizontal: "L — длина направляющей", vertical: "H — шаг крепления", callouts: ["Совместимый крепёж", "Маркировка комплекта"] },
  cabinet: { code: "СП-ПР-01", horizontal: "B — ширина корпуса", vertical: "H — высота корпуса", callouts: ["Сервисная дверь", "Вводы и вентиляция"] },
  "industrial-guard": { code: "СП-ПР-02", horizontal: "L — зона ограждения", vertical: "H — уровень защиты", callouts: ["Защитная сетка", "Доступ к узлу"] },
  frame: { code: "СП-ПР-03", horizontal: "L — база рамы", vertical: "H — монтажная высота", callouts: ["Несущий каркас", "Точки сборки"] },
  tray: { code: "СП-ПР-04", horizontal: "B — ширина лотка", vertical: "H — высота борта", callouts: ["Кабельная зона", "Крышка / соединитель"] },
  "industrial-panel": { code: "СП-ПР-05", horizontal: "L — по корпусу", vertical: "H — по корпусу", callouts: ["Сервисная панель", "Вентиляционная зона"] },
  platform: { code: "СП-ПР-06", horizontal: "L — длина площадки", vertical: "H — рабочая отметка", callouts: ["Настил и борт", "Безопасный доступ"] },
  pallet: { code: "СП-ПР-07", horizontal: "L — опорная база", vertical: "H — высота поддона", callouts: ["Зона размещения", "Точки опоры"] },
  "industrial-bracket": { code: "СП-ПР-08", horizontal: "L — вылет кронштейна", vertical: "H — отметка крепления", callouts: ["Опорная консоль", "Анкеры / болты"] },
  grille: { code: "СП-ИС-01", horizontal: "L — размер проёма", vertical: "H — размер проёма", callouts: ["Ламели / перфорация", "Рамка проёма"] },
  hatch: { code: "СП-ИС-02", horizontal: "L — световой проём", vertical: "H — световой проём", callouts: ["Ревизионная дверь", "Узел запирания"] },
  "engineering-bracket": { code: "СП-ИС-03", horizontal: "L — вылет консоли", vertical: "H — шаг анкеров", callouts: ["Несущая консоль", "Инженерная нагрузка"] },
  mounting: { code: "СП-ИС-04", horizontal: "L — монтажная рама", vertical: "H — монтажная рама", callouts: ["Направляющие", "Соединительный узел"] },
  support: { code: "СП-ИС-05", horizontal: "L — база опоры", vertical: "H — высота опоры", callouts: ["Распределение нагрузки", "Основание / анкеры"] },
  "roof-system": { code: "СП-ИС-06", horizontal: "L — база на кровле", vertical: "H — отметка оборудования", callouts: ["Опора на кровле", "Трасса коммуникаций"] },
  deflector: { code: "СП-ИС-07", horizontal: "D — размер канала", vertical: "H — высота зонта", callouts: ["Защита от осадков", "Выход воздушного потока"] },
  design: { code: "СП-ИН-01", horizontal: "ТЗ — исходные данные", vertical: "КД — комплект документации", callouts: ["Эскиз и 3D-модель", "Согласование решения"] },
  documentation: { code: "СП-ИН-02", horizontal: "КД — спецификация", vertical: "КД — узлы и размеры", callouts: ["Рабочие чертежи", "Контроль версий"] },
  prototype: { code: "СП-ИН-03", horizontal: "L — геометрия образца", vertical: "H — проверка посадки", callouts: ["Опытный образец", "Проверка сборки"] },
  production: { code: "СП-ИН-04", horizontal: "L — по чертежу", vertical: "H — по чертежу", callouts: ["Раскрой и гибка", "Согласованная технология"] },
  serial: { code: "СП-ИН-05", horizontal: "N — количество в серии", vertical: "Q — контроль партии", callouts: ["Повторяемая геометрия", "Маркировка и упаковка"] },
  substitution: { code: "СП-ИН-06", horizontal: "Функция исходного узла", vertical: "Совместимость решения", callouts: ["Анализ образца", "Адаптация под производство"] },
  optimization: { code: "СП-ИН-07", horizontal: "Снижение трудоёмкости", vertical: "Стабильность качества", callouts: ["Оптимизация раскроя", "Рациональные гибы"] },
  oem: { code: "СП-ИН-08", horizontal: "Требования бренда", vertical: "Регламент поставки", callouts: ["Маркировка", "Серийная упаковка"] },
};

function Perforation({ columns = 5, rows = 3 }: { columns?: number; rows?: number }) {
  return <>{Array.from({ length: columns * rows }, (_, index) => <circle key={index} cx={112 + (index % columns) * 32} cy={88 + Math.floor(index / columns) * 32} r="4" fill={accent} />)}</>;
}

function Shape({ kind }: { kind: string }) {
  if (kind === "basket") return <><rect x="83" y="55" width="230" height="145" rx="4" fill="none" stroke={line} strokeWidth="4" /><rect x="116" y="83" width="164" height="92" rx="3" fill="#1a2024" stroke={accent} strokeWidth="3" /><circle cx="198" cy="129" r="29" fill="none" stroke={line} strokeWidth="3" /><path d="M198 100v58M169 129h58M177 108l42 42M219 108l-42 42" stroke={muted} strokeWidth="2" /></>;
  if (kind === "climate-bracket" || kind === "industrial-bracket" || kind === "engineering-bracket") return <><path d="M95 65v145h165" fill="none" stroke={line} strokeWidth="10" strokeLinecap="square" /><path d="M118 186 245 77" stroke={accent} strokeWidth="7" /><circle cx="95" cy="91" r="9" fill={accent} /><circle cx="95" cy="153" r="9" fill={accent} /><circle cx="230" cy="210" r="9" fill={accent} /></>;
  if (["screen", "perforated-panel", "industrial-panel", "grille"].includes(kind)) return <><rect x="74" y="50" width="246" height="160" rx="4" fill="#182026" stroke={line} strokeWidth="4" /><Perforation columns={6} rows={4} /><path d="M82 68h230M82 192h230" stroke={accent} strokeWidth="3" /></>;
  if (["custom-basket", "frame", "mounting"].includes(kind)) return <><path d="M105 82 190 45l108 57-86 42-107-62Z" fill="#1b242a" stroke={line} strokeWidth="3" /><path d="M105 82v107l107 55 86-43V102" fill="none" stroke={line} strokeWidth="3" /><path d="M212 144v100M105 189l107-45 86 57" fill="none" stroke={accent} strokeWidth="3" /></>;
  if (kind === "guard" || kind === "industrial-guard") return <><path d="M111 198 75 166V94l36-32h173l36 32v72l-36 32H111Z" fill="#182026" stroke={line} strokeWidth="4" /><path d="m104 184 76-96m-19 111 77-101m-17 104 63-85" stroke={accent} strokeWidth="3" /><circle cx="198" cy="128" r="24" fill="none" stroke={line} strokeWidth="3" /></>;
  if (kind === "fasteners") return <><path d="M104 72h188M104 184h188" stroke={line} strokeWidth="7" /><path d="M120 72v112m56-112v112m56-112v112m44-112v112" stroke={muted} strokeWidth="3" /><path d="M102 128h190" stroke={accent} strokeWidth="5" /><circle cx="120" cy="128" r="13" fill="#192125" stroke={line} strokeWidth="3" /><circle cx="176" cy="128" r="13" fill="#192125" stroke={line} strokeWidth="3" /><circle cx="232" cy="128" r="13" fill="#192125" stroke={line} strokeWidth="3" /></>;
  if (kind === "cabinet") return <><rect x="120" y="45" width="160" height="180" rx="5" fill="#182026" stroke={line} strokeWidth="4" /><path d="M200 49v172M137 82h45m-45 28h45m81-28h-45m45 28h-45" stroke={muted} strokeWidth="3" /><path d="M193 136h14" stroke={accent} strokeWidth="5" /></>;
  if (kind === "tray") return <><path d="M72 93h250v62H72z" fill="#182026" stroke={line} strokeWidth="4" /><path d="M72 93 95 68h250l-23 25M95 155l23 25h204l-23-25" fill="none" stroke={accent} strokeWidth="4" /><path d="M110 112h172M110 135h172" stroke={muted} strokeWidth="3" /></>;
  if (kind === "platform") return <><path d="M80 175h250M104 175v40m175-40v40M88 215h232" fill="none" stroke={line} strokeWidth="6" /><path d="M92 71h226M104 71v104m61-104v104m61-104v104m80-104v104" fill="none" stroke={accent} strokeWidth="4" /><path d="M92 111h226" stroke={muted} strokeWidth="3" /></>;
  if (kind === "pallet") return <><path d="M80 114h240l-24 73H104l-24-73Z" fill="#182026" stroke={line} strokeWidth="4" /><path d="M97 142h206M124 187v26m76-26v26m76-26v26" stroke={accent} strokeWidth="5" /><path d="M108 98h184" stroke={muted} strokeWidth="5" /></>;
  if (kind === "hatch") return <><rect x="93" y="52" width="214" height="166" rx="4" fill="#182026" stroke={line} strokeWidth="4" /><rect x="116" y="75" width="168" height="120" rx="2" fill="none" stroke={accent} strokeWidth="3" /><path d="M178 135h44" stroke={line} strokeWidth="7" strokeLinecap="round" /><circle cx="128" cy="89" r="5" fill={muted} /><circle cx="272" cy="181" r="5" fill={muted} /></>;
  if (kind === "support") return <><path d="M91 204h218M138 204l46-142m78 142L216 62M148 133h104" fill="none" stroke={line} strokeWidth="6" /><path d="M145 180h110M183 62h50" stroke={accent} strokeWidth="6" /><circle cx="184" cy="62" r="10" fill={accent} /></>;
  if (kind === "roof-system") return <><path d="M67 180h270L266 88H138L67 180Z" fill="#182026" stroke={line} strokeWidth="4" /><path d="M119 180 175 88m42 92 51-92" stroke={muted} strokeWidth="3" /><rect x="151" y="108" width="102" height="45" fill="#121719" stroke={accent} strokeWidth="4" /><path d="M142 153v27m121-27v27" stroke={line} strokeWidth="6" /></>;
  if (kind === "deflector") return <><path d="M128 205h144M142 205V122h116v83" fill="none" stroke={line} strokeWidth="6" /><path d="M106 122h188l-36-52h-116l-36 52Z" fill="#182026" stroke={accent} strokeWidth="4" /><path d="M200 70v-25m0 0-15 16m15-16 15 16" stroke={line} strokeWidth="4" /></>;
  if (kind === "design" || kind === "documentation") return <><rect x="113" y="48" width="150" height="174" fill="#182026" stroke={line} strokeWidth="4" /><path d="M140 88h96m-96 30h96m-96 30h60" stroke={muted} strokeWidth="4" /><path d="m170 187 83-83 20 20-83 83-29 9 9-29Z" fill="none" stroke={accent} strokeWidth="4" /></>;
  if (kind === "prototype" || kind === "production") return <><path d="M105 91 194 50l100 55-89 44-100-58Z" fill="#1b242a" stroke={line} strokeWidth="4" /><path d="M105 91v104l100 52 89-45V105" fill="none" stroke={line} strokeWidth="4" /><path d="M205 149v98m-100-52 100-46 89 53" fill="none" stroke={accent} strokeWidth="3" /></>;
  if (kind === "serial") return <><rect x="76" y="88" width="72" height="92" fill="#182026" stroke={line} strokeWidth="4" /><rect x="164" y="88" width="72" height="92" fill="#182026" stroke={accent} strokeWidth="4" /><rect x="252" y="88" width="72" height="92" fill="#182026" stroke={line} strokeWidth="4" /><path d="M90 106h44m-44 22h44m88-22h-44m44 22h-44m132-22h-44m44 22h-44" stroke={muted} strokeWidth="3" /></>;
  if (kind === "substitution") return <><circle cx="200" cy="133" r="68" fill="none" stroke={line} strokeWidth="4" /><path d="M149 94h47V64l47 45-47 45v-30h-47m102 47h-47v30l-47-45 47-45v30h47" fill="none" stroke={accent} strokeWidth="5" /></>;
  if (kind === "optimization") return <><path d="M84 200 126 72l32 86 30-108 37 150" fill="none" stroke={line} strokeWidth="5" /><path d="m87 164 35-24 34 18 34-53 45 40" fill="none" stroke={accent} strokeWidth="5" /><circle cx="235" cy="145" r="9" fill={accent} /></>;
  if (kind === "oem") return <><path d="M111 78h178v132H111z" fill="#182026" stroke={line} strokeWidth="4" /><path d="M111 78 200 40l89 38M111 210l89 40 89-40" fill="none" stroke={accent} strokeWidth="4" /><text x="200" y="156" textAnchor="middle" fill={line} fontSize="42" fontWeight="700">OEM</text></>;
  return <><circle cx="200" cy="132" r="74" fill="#182026" stroke={line} strokeWidth="4" /><path d="M149 132h102M200 81v102" stroke={accent} strokeWidth="5" /></>;
}

function Dimension({ x1, y1, x2, y2, label, vertical = false }: { x1: number; y1: number; x2: number; y2: number; label: string; vertical?: boolean }) {
  const labelX = (x1 + x2) / 2;
  const labelY = (y1 + y2) / 2;
  return <g>
    <path d={`M${x1} ${y1}L${x2} ${y2}`} stroke={accent} strokeOpacity=".85" strokeWidth="1.5" />
    <path d={vertical ? `M${x1 - 4} ${y1 + 6}L${x1} ${y1}L${x1 + 4} ${y1 + 6}M${x2 - 4} ${y2 - 6}L${x2} ${y2}L${x2 + 4} ${y2 - 6}` : `M${x1 + 6} ${y1 - 4}L${x1} ${y1}L${x1 + 6} ${y1 + 4}M${x2 - 6} ${y2 - 4}L${x2} ${y2}L${x2 - 6} ${y2 + 4}`} fill="none" stroke={accent} strokeWidth="1.5" />
    <text x={vertical ? labelX - 5 : labelX} y={vertical ? labelY : labelY - 5} fill="#e8a37e" fontSize="8" textAnchor="middle" transform={vertical ? `rotate(-90 ${labelX - 5} ${labelY})` : undefined}>{label}</text>
  </g>;
}

function Callout({ x, y, number, text, toX, toY }: { x: number; y: number; number: string; text: string; toX: number; toY: number }) {
  return <g>
    <path d={`M${x + 12} ${y}H${toX}V${toY}`} fill="none" stroke="#a0aab0" strokeOpacity=".75" strokeWidth="1" />
    <circle cx={x} cy={y} r="9" fill="#101416" stroke={accent} strokeWidth="1.5" />
    <text x={x} y={y + 3} fill={line} fontSize="8" textAnchor="middle" fontWeight="700">{number}</text>
    <text x={x + 15} y={y + 3} fill="#b7c0c5" fontSize="8">{text}</text>
  </g>;
}

export function SolutionItemVisual({ kind, title, brighter = false }: SolutionItemVisualProps) {
  const productVisual = productVisuals[kind];
  if (productVisual) {
    const imageTone = brighter ? "brightness-[1.18] contrast-[1.02] saturate-[1.04]" : productVisual.imageClassName ?? "brightness-[1.16] contrast-[1.01] saturate-[1.03]";
    return <div className="relative h-52 overflow-hidden border-b border-white/10 bg-[#0a0d0f]" aria-label={`Визуал изделия: ${title}`}>
      <img src={productVisual.src} alt={productVisual.alt} className={`h-full w-full object-cover transition duration-700 ease-out group-hover:scale-[1.045] ${imageTone}`} loading="lazy" />
      <span className="absolute left-4 top-3 border border-white/15 bg-black/45 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[.13em] text-white/75">Визуал изделия</span>
      <span className="absolute bottom-3 right-4 h-px w-10 bg-steel-orange" aria-hidden="true" />
    </div>;
  }

  const meta = schemeMeta[kind] ?? { code: "СП-РШ-00", horizontal: "L — по проекту", vertical: "H — по проекту", callouts: ["Узел изделия", "Параметры по проекту"] as [string, string] };

  return <div className="relative overflow-hidden border-b border-white/10 bg-[#0a0d0f]" aria-label={`Типовая схема: ${title}`}>
    <svg viewBox="0 0 400 260" className="h-52 w-full" role="img" aria-hidden="true">
      <defs><pattern id={`item-grid-${kind}`} width="20" height="20" patternUnits="userSpaceOnUse"><path d="M 20 0 L 0 0 0 20" fill="none" stroke="#ffffff" strokeOpacity=".055" strokeWidth="1" /></pattern></defs>
      <rect width="400" height="260" fill={`url(#item-grid-${kind})`} />
      <path d="M22 30H378M22 231H378" stroke="#ffffff" strokeOpacity=".16" strokeWidth="1" />
      <path d="M22 30v201M378 30v201" stroke="#ffffff" strokeOpacity=".1" strokeWidth="1" />
      <text x="29" y="21" fill="#e9ecee" fontSize="9" fontWeight="700">{meta.code}</text>
      <text x="371" y="21" fill="#889299" fontSize="8" textAnchor="end">УЗЕЛ / ЭСКИЗ</text>
      <Shape kind={kind} />
      <Dimension x1={78} y1={224} x2={322} y2={224} label={meta.horizontal} />
      <Dimension x1={342} y1={56} x2={342} y2={202} label={meta.vertical} vertical />
      <Callout x={35} y={57} number="1" text={meta.callouts[0]} toX={84} toY={82} />
      <Callout x={35} y={195} number="2" text={meta.callouts[1]} toX={106} toY={174} />
      <path d="M0 248H400" stroke={accent} strokeOpacity=".36" strokeWidth="2" />
      <text x="24" y="256" fill="#7f8b91" fontSize="7">СТАЛЬ ПРОДУКТ · ИНЖЕНЕРНЫЕ РЕШЕНИЯ ИЗ ЛИСТОВОГО МЕТАЛЛА</text>
    </svg>
    <span className="absolute right-4 top-3 border border-white/15 bg-black/35 px-2 py-1 text-[9px] font-bold uppercase tracking-[.13em] text-white/55">Типовой узел</span>
  </div>;
}
