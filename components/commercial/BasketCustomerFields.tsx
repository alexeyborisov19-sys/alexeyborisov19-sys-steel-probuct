"use client";

import { basketAccessMethods, basketReviewTextLimits, basketServiceSides, type BasketCustomerReview } from "@/lib/quote/basket-review";
import { BasketNumberInput } from "./BasketNumberInput";
import styles from "./BasketConfigurator.module.css";

export function BasketCustomerFields({ value, onChange, section }: {
  value: BasketCustomerReview;
  onChange: (value: BasketCustomerReview) => void;
  section: "equipment" | "service";
}) {
  const textField = (key: keyof typeof basketReviewTextLimits, label: string, placeholder: string) => <label key={key} className={styles.customerField}>
    {label}
    <input type="text" value={value[key]} maxLength={basketReviewTextLimits[key]} placeholder={placeholder} onChange={event => onChange({ ...value, [key]: event.target.value })} />
  </label>;
  if (section === "equipment") return <fieldset className={styles.customerFields}>
    <legend>Оборудование и марка позиции</legend>
    <p className={styles.help}>Можно оставить неизвестное пустым. Эти данные заказчика войдут в скачиваемое задание; проверенной базы моделей здесь нет.</p>
    {textField("mark", "Марка / зона установки", "Например: КР-01, северный фасад")}
    {textField("equipment", "Производитель и модель наружного блока", "Перепишите из паспорта или с шильдика")}
    {textField("clearanceSource", "Источник требований к зазорам", "Название инструкции, раздел или страница")}
  </fieldset>;
  return <fieldset className={styles.customerFields}>
    <legend>Сервисный доступ</legend>
    <p className={styles.help}>Пожелания к конструкции для проверки инженером. Сторона обслуживания задаётся при взгляде на корзину спереди. Съёмность панели пока не подтверждена.</p>
    <div className={styles.inputs}>
      <label>Сервисная сторона
        <select value={value.serviceSide} onChange={event => onChange({ ...value, serviceSide: event.target.value as BasketCustomerReview["serviceSide"] })}>
          {Object.entries(basketServiceSides).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
      </label>
      <label>Желаемый способ доступа
        <select value={value.accessMethod} onChange={event => onChange({ ...value, accessMethod: event.target.value as BasketCustomerReview["accessMethod"] })}>
          {Object.entries(basketAccessMethods).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
      </label>
    </div>
    <div className={styles.inputs}>
      <label>Нужно для обслуживания, мм
        <BasketNumberInput value={value.requiredServiceMm} emptyValue={null} min={0} max={10000} placeholder="По инструкции блока" onValue={requiredServiceMm => onChange({ ...value, requiredServiceMm })} />
      </label>
      <label>Есть на объекте, мм
        <BasketNumberInput value={value.availableServiceMm} emptyValue={null} min={0} max={10000} placeholder="По замеру / проекту" onValue={availableServiceMm => onChange({ ...value, availableServiceMm })} />
      </label>
    </div>
    <p className={styles.help}>Доступное место с сервисной стороны после установки корзины. Сравниваем два указанных расстояния; к габариту корзины их автоматически не прибавляем.</p>
    {Number.isFinite(value.requiredServiceMm) && Number.isFinite(value.availableServiceMm) && value.requiredServiceMm !== null && value.availableServiceMm !== null && value.availableServiceMm < value.requiredServiceMm && <p className={styles.validation} role="status">Для обслуживания не хватает {Number((value.requiredServiceMm - value.availableServiceMm).toFixed(2))} мм. Уточните размещение и способ доступа.</p>}
    {textField("facadeNotes", "Примечание по фасаду и трассам", "Основание, вывод трубок, ограничения доступа")}
  </fieldset>;
}
