/** Fixed, neutralised drawing examples. Not a size rule or an approved mounting family. */
export const basketDrawingModels = [
  { id: 'body-1430-880', label: '1430 × 880 × 500', width: 1430, height: 880, depth: 500, frontCount: 1, frontWidth: 1430, bearingCount: 3, frontContour: 'front-1430-880', sideContour: 'side-500-880', bottomContour: 'bottom-1430-500' },
  { id: 'body-1430-1280', label: '1430 × 1280 × 500', width: 1430, height: 1280, depth: 500, frontCount: 2, frontWidth: 715, bearingCount: 3, frontContour: 'front-715-1280', sideContour: 'side-500-1280', bottomContour: 'bottom-1430-500' },
  { id: 'body-2030-880', label: '2030 × 880 × 500', width: 2030, height: 880, depth: 500, frontCount: 1, frontWidth: 2030, bearingCount: 4, frontContour: 'front-2030-880', sideContour: 'side-500-880', bottomContour: 'bottom-2030-500' },
  { id: 'body-2030-1280', label: '2030 × 1280 × 500', width: 2030, height: 1280, depth: 500, frontCount: 2, frontWidth: 1015, bearingCount: 4, frontContour: 'front-1015-1280', sideContour: 'side-500-1280', bottomContour: 'bottom-2030-500' },
] as const;
export type BasketDrawingModel = (typeof basketDrawingModels)[number];
export type BasketDrawingModelId = BasketDrawingModel['id'];
export function getBasketDrawingModel(id: string): BasketDrawingModel {
  const model = basketDrawingModels.find(item => item.id === id);
  if (!model) throw new Error('Исполнение по чертежу не найдено.');
  return model;
}
export const basketDrawingScope = 'Фиксированное исполнение по чертежу. Просмотр не изменяет ваши размеры и расчёт.';
export const basketDrawingDetailScope = 'Габариты и разбиение кожуха — по чертежу. Показаны кожух и условные основные кронштейны; удлинители, пятки, внутренние опоры и усилители не показаны. Мелкие гибы, радиусы и крепёж упрощены. Положение кронштейнов схематичное: точка крепления внутри регулируемой прорези не назначена.';
