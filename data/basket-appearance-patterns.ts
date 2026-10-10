/** Original concept appearances. These are not approved manufacturing families. */
export const basketAppearancePatterns = {
 circle: {title:'Круг',detail:'Круглая перфорация',primary:true},
 regular: {title:'Ровные прорези',detail:'12 длинных прорезей',primary:true},
 shift: {title:'Сдвиг',detail:'12 прорезей разной длины',primary:true},
 rhythm: {title:'Ритм',detail:'12 прорезей с разными интервалами',primary:false},
 tilt: {title:'Наклон',detail:'12 слегка наклонённых прорезей',primary:false},
 square: {title:'Квадрат',detail:'Квадратная перфорация',primary:false},
 louvers: {title:'Жалюзи',detail:'12 объёмных ламелей',primary:false},
} as const;
export type BasketAppearancePattern = keyof typeof basketAppearancePatterns;
export function validBasketAppearancePattern(value:unknown):value is BasketAppearancePattern {
 return typeof value==='string'&&Object.hasOwn(basketAppearancePatterns,value);
}
