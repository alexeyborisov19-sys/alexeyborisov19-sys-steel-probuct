/** Public catalogue topology only. No catalogue dimension is a factory default. */
export const trimBimCatalog = [
  { id:'reveal', title:'Откос для окна', sourcePage:'07', sourceSection:'Откос для окон, нижняя часть листа', productPath:'/products/otkosy-dlya-okon', segments:['Основная полка','Перемычка','Возвратная полка','Концевая полка'], turnSigns:[-1,-1,1], scope:'Один четырёхполочный профиль. Аквилон и сопряжения не входят.' },
  { id:'sill', title:'Отлив для окна', sourcePage:'09', sourceSection:'Отлив для окон, верхняя часть листа', productPath:'/products/otlivy-dlya-okon', segments:['Задняя полка','Основная полка','Передняя полка','Капельник'], turnSigns:[1,-1,1], scope:'Один продольный профиль. Боковые загибы, торцевые заглушки и оконный узел не входят.' },
  { id:'open-parapet', title:'Крышка парапета · открытый тип', sourcePage:'08', sourceSection:'Вариант 1, верхняя часть листа', productPath:'/products/parapetnye-kryshki', segments:['Первый капельник','Первая боковая полка','Верхняя полка','Вторая боковая полка','Второй капельник'], turnSigns:[1,-1,-1,1], scope:'Только крышка открытого типа. Отверстия, крепёж, опорные профили и скрытый замок не входят.' },
  { id:'fire-stop', title:'Г-профиль отсечки', sourcePage:'09', sourceSection:'Пожарная отсечка, нижняя часть листа', productPath:'/products/pozharnye-otsechki', segments:['Первая полка','Вторая полка'], turnSigns:[1], scope:'Только Г-образная форма. Модель не подтверждает огнестойкость или соответствие противопожарного узла.' },
] as const;
export type TrimTemplateId = typeof trimBimCatalog[number]['id'];
export function getTrimTemplate(id: string) {
  const template = trimBimCatalog.find(item => item.id === id);
  if (!template) throw new Error('Неизвестный шаблон доборного элемента.');
  return template;
}
export function trimSourceImage(id: string) { return `/images/products/catalog-sheets/page-${getTrimTemplate(id).sourcePage}.png`; }
/** Absolute canonical provenance survives offline downloads; UI keeps the relative image helper. */
export function trimSourceUrl(id:string) { return `https://www.steelprodukt.ru${trimSourceImage(id)}`; }
export const TRIM_GEOMETRY_SCOPE = 'Предварительная модель наружного Г-профиля по листу 09. A и B — наружные длины полок от теоретического внешнего угла до торца; H — продольная длина; T — толщина, отложенная внутрь. A и B сохраняются без прибавки толщины. Угол C = 90° по схеме каталога. Гиб заменён острым внешним и внутренним углом: радиус, развёртка и припуски не моделируются. Крепёж, отверстия, стыки и монтажный узел не входят. Координатный шаг этой предварительной модели — 0,01 мм; более мелкие значения отклоняются без округления. Это вычислительное ограничение, не допуск изготовления. Модель не предназначена для изготовления, расчёта нагрузок или подтверждения огнестойкости.';
export const trimPendingReasons:Partial<Record<TrimTemplateId,string>> = {
  reveal:'Требует подтверждения: к каким наружным или внутренним граням относятся A/B/C/D с учётом толщины и гибов.',
  sill:'Требует проверки модели по размерным базам A/B/C/D и внутренним углам E/F/G. Значения гибов на развёртке не подставляются вместо этих углов.',
  'open-parapet':'Требует подтверждения: связи B/B1/C/D/E, углы F/G и отдельные размеры обеих сторон крышки.',
};
