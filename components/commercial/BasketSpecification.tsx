"use client";
import { BasketOrderSummary } from "./BasketOrderSummary";
import { basketAppearancePatterns } from "@/data/basket-appearance-patterns";
import { basketAcDimensionDisclaimer } from "@/lib/quote/basket-ac-reference";
import { useRef, useState } from "react";
import { type BasketBrief, basketBriefText, basketScreens } from "@/lib/quote/basket-brief";
import { serializeBasketProject, parseBasketProject, MAX_BASKET_POSITIONS, MAX_BASKET_PROJECT_BYTES } from "@/lib/quote/basket-project";
import { basketReview } from "@/lib/quote/basket-review";
import styles from "./BasketConfigurator.module.css";

export function BasketSpecification({ items, onChange, onEdit, editing = null }: {
  items: BasketBrief[];
  onChange: (value: BasketBrief[]) => void;
  onEdit: (value: BasketBrief, index: number) => void;
  editing?: number | null;
}) {
  const upload = useRef<HTMLInputElement>(null);
  const latestItems = useRef(items);
  latestItems.current = items;
  const [message, setMessage] = useState("");
  // Object identities prevent deleting or editing one row from selecting a different row.
  const [selected, setSelected] = useState<Set<BasketBrief>>(() => new Set());
  const selectedItems = items.filter(item => selected.has(item));
  const total = items.reduce((sum, item) => sum + item.quantity, 0);
  const pending = items.filter(item => basketReview(item).some(check => check.state === "missing" || check.state === "conflict")).length;
  function download(name: string, text: string, json = false) {
    const url = URL.createObjectURL(new Blob([json ? text : "\uFEFF" + text], { type: json ? "application/json;charset=utf-8" : "text/plain;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function brief(list: BasketBrief[]) {
    return ["СПЕЦИФИКАЦИЯ КОРЗИН — предварительное задание", `Позиций: ${list.length}; корзин: ${list.reduce((sum, item) => sum + item.quantity, 0)}.`, "Это перечень запрошенных изделий, не производственная ведомость крепежа и не подтверждённая стоимость заказа.", ...list.map(item => `ПОЗИЦИЯ ${items.indexOf(item) + 1}\n${basketBriefText(item)}`)].join("\n\n");
  }
  return <section aria-labelledby="basket-spec-title" className={styles.specification}>
    <div className={styles.specHeading}><div><p className={styles.eyebrow}>ПРОЕКТ / ДО 100 ПОЗИЦИЙ</p><h3 id="basket-spec-title">Спецификация корзин</h3></div><span>{items.length} / {MAX_BASKET_POSITIONS}</span></div>
    <p className={styles.help}>Добавляйте размеры и исполнения по одному. Файл версии 2 сохраняет модель блока и пожелания к доступу; старые файлы версии 1 открываются здесь. Данные не сохраняются автоматически.</p>
    {items.length > 0 && <dl className={styles.specMetrics}>
      <div><dt>Корзин</dt><dd>{total}<small> в {items.length} позициях</small></dd></div>
      <div><dt>Передних панелей</dt><dd>{total}<small> по 1 на корзину</small></dd></div>
      <div><dt>Боковых панелей</dt><dd>{total * 2}<small> по 2 на корзину</small></dd></div>
      <div><dt>Позиций для уточнения</dt><dd>{pending}<small> по входным данным</small></dd></div>
    </dl>}
    <div className={styles.specActions}>
      <button type="button" onClick={() => upload.current?.click()}>Открыть спецификацию</button>
      <button type="button" disabled={!items.length} onClick={() => download("Корзины.baskets.json", serializeBasketProject(items), true)}>Сохранить все · JSON</button>
      <button type="button" disabled={!items.length} onClick={() => download("Задание-корзины-все.txt", brief(items))}>Скачать общее задание · TXT</button>
      <input ref={upload} type="file" accept=".json" className="hidden" aria-label="Файл спецификации корзин" onChange={async event => {
        const file = event.target.files?.[0]; event.target.value = ""; if (!file) return;
        try {
          if (file.size > MAX_BASKET_PROJECT_BYTES) throw Error("Размер файла превышает 512 КБ.");
          const added = parseBasketProject((await file.text()).replace(/^\uFEFF/, ""));
          if (latestItems.current.length + added.length > MAX_BASKET_POSITIONS) throw Error("Общий предел — 100 позиций.");
          onChange([...latestItems.current, ...added]); setSelected(new Set()); setMessage(`Добавлено позиций из файла: ${added.length}.`);
        } catch (error) { setMessage(error instanceof Error ? error.message : "Не удалось прочитать файл."); }
      }} />
    </div>
    <p role="status" className={styles.specMessage}>{message}</p>
    {items.length ? <>
      <div className={styles.specSelection}>
        <label><input type="checkbox" checked={selectedItems.length === items.length} onChange={event => setSelected(event.target.checked ? new Set(items) : new Set())} />Выбрать все позиции</label>
        <span>Выбрано: {selectedItems.length}</span>
        <button type="button" disabled={!selectedItems.length} onClick={() => download("Корзины-выбранные.baskets.json", serializeBasketProject(selectedItems), true)}>Сохранить выбранные</button>
      </div>
      <ol className={styles.specList}>
        {items.map((item, index) => {
          const checks = basketReview(item);
          const issues = checks.filter(check => check.state === "missing" || check.state === "conflict").length;
          const conflicts = checks.some(check => check.state === "conflict");
          return <li key={item.positionId??index} className={editing === index ? styles.specEditing : ""}>
            <label className={styles.specCheck}><input type="checkbox" aria-label={`Выбрать позицию ${index + 1}`} checked={selected.has(item)} onChange={event => setSelected(previous => { const next = new Set(previous); if (event.target.checked) next.add(item); else next.delete(item); return next; })} /><span>{String(index + 1).padStart(2, "0")}</span></label>
            <div className={styles.specBody}>
              <div className={styles.specRowTitle}><h4>{item.review?.mark || `Корзина ${index + 1}`}</h4><span>{item.quantity} шт.</span></div>
              <p className={styles.specSize}>{item.width} × {item.height} × {item.depth} мм <span>{item.design?.sizing === "block" ? "внутренний расчётный" : "наружный"}</span></p>
              <p>{item.review?.equipment || "Модель наружного блока не указана"}</p>
              {(item.design?.acReference || item.design?.capacityClass) && <p className={styles.referenceWarning}>{basketAcDimensionDisclaimer}.</p>}
              <div className={styles.specTags}><span>RAL {item.ral}</span><span>Передняя: {item.design?.appearance?basketAppearancePatterns[item.design.appearance].title:basketScreens[(item.design?.front.pattern ?? item.screen) as keyof typeof basketScreens]}</span><span>Боковые: {item.design?.appearance?"По эскизу":basketScreens[(item.design?.side.pattern ?? item.screen) as keyof typeof basketScreens]}</span></div>
              <p className={styles.specReviewStatus} data-conflict={conflicts || undefined}>{conflicts ? "Есть несоответствие" : issues ? `Нужно уточнить: ${issues}` : "Входные данные указаны"} · Проверка инженером обязательна</p>
              <div className={styles.specItemActions}>
                <button type="button" onClick={() => onEdit(item, index)} aria-label={`Изменить позицию ${index + 1}`}>{editing === index ? "Редактируется ↑" : "Изменить ↑"}</button>
                <button type="button" disabled={items.length >= MAX_BASKET_POSITIONS} onClick={() => { onChange([...items, structuredClone(item)]); setMessage(`Создана копия позиции ${index + 1}. Измените её параметры при необходимости.`); }} aria-label={`Копировать позицию ${index + 1}`}>Копия</button>
                <button type="button" onClick={() => { onChange(items.filter((_, n) => n !== index)); setMessage(`Позиция ${index + 1} удалена из текущей спецификации.`); }} aria-label={`Удалить позицию ${index + 1}`}>Удалить</button>
              </div>
            </div>
          </li>;
        })}
      </ol>
      <BasketOrderSummary items={items}/>
      <p className={styles.help}>Состав: передняя и две боковые панели без верхней крышки. Крепёж, новые несущие кронштейны, анкеры и доставка согласуются отдельно. Цены отдельных позиций не суммируются без проверки комплектации.</p>
    </> : <div className={styles.specEmpty}><strong>Первая позиция пока не добавлена</strong><p>Соберите корзину и на шаге «Результат» нажмите «Добавить в спецификацию». Здесь появятся её марка, размеры, количество и вопросы для проверки.</p></div>}
  </section>;
}
