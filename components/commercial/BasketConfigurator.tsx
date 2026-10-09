"use client";

import { useRef, useState } from "react";
import { PRODUCT_CALCULATION_NOTICE } from "@/lib/product-calculation-notice";
import { BasketAppearance } from "./BasketAppearance";
import { applyBasketAcReference, basketAcDimensionDisclaimer } from "@/lib/quote/basket-ac-reference";
import { BasketAcReference } from "./BasketAcReference";
import { BasketFitFields } from "./BasketFitFields";
import { calculatedBasketSize, requiredBasketSpace } from "@/lib/quote/basket-fit";
import { basketFitForSizing } from "@/lib/quote/basket-mounting";
import { basketDesignSummary, validBasketDesign, defaultBasketDesign, type BasketDesign } from "@/lib/quote/basket-design";
import { BasketSpecification } from "./BasketSpecification";
import type { BasketBrief } from "@/lib/quote/basket-brief";
import { BasketCustomerFields } from "./BasketCustomerFields";
import { BasketReviewChecklist } from "./BasketReviewChecklist";
import { basketReview, basketReviewSummary, validBasketReview, defaultBasketReview, type BasketCustomerReview } from "@/lib/quote/basket-review";
import { BasketDesignFields } from "./BasketDesignFields";
import { AttributionLink } from "@/components/AttributionLink";
import { basketBriefHref, basketBriefText, basketColors, basketSizeExamples, validBasketBrief } from "@/lib/quote/basket-brief";
import styles from "./BasketConfigurator.module.css";

const steps = [
  { title: "Размеры", caption: "Габариты и количество", stage: 0 },
  { title: "Крепление", caption: "Стена и фасад", stage: 1 },
  { title: "Результат", caption: "Стоимость и задание", stage: 3 },
];
export function BasketConfigurator() {
  const [items, setItems] = useState<BasketBrief[]>([]);
  const [editing, setEditing] = useState<number | null>(null);
  const [saved, setSaved] = useState("");
  const [step, setStep] = useState(0);
  const [design, setDesign] = useState<BasketDesign>(() => { const d = defaultBasketDesign(); return {...d, sizing:"block" as const, front:{...d.front,pattern:"wide-slots" as const}, side:{...d.side,pattern:"wide-slots" as const}}; });
  const [dimensions, setDimensions] = useState({ width: "900", height: "600", depth: "550", quantity: "1" });
  const [review, setReview] = useState<BasketCustomerReview>(defaultBasketReview);
  const [ral, setRal] = useState("7024");
  const heading = useRef<HTMLDivElement>(null);
  const screen = design.front.pattern;
  const byBlock = design.sizing === "block";
  const calculated = calculatedBasketSize(design.fit);
  const selectedDimensions = byBlock ? {
    width: calculated ? String(calculated.width) : "",
    height: calculated ? String(calculated.height) : "",
    depth: calculated ? String(calculated.depth) : "",
    quantity: dimensions.quantity,
  } : dimensions;
  const input = { width: Number(selectedDimensions.width), height: Number(selectedDimensions.height), depth: Number(selectedDimensions.depth), quantity: Number(selectedDimensions.quantity), ral, screen, design, review };
  const dimensionsValid = Object.values(selectedDimensions).every((v) => /^\d+$/.test(v) && Number(v) > 0 && Number(v) <= 10000);
  const valid = dimensionsValid && validBasketBrief(input);
  const preliminaryValid = validBasketDesign(design) && validBasketReview(review);
  const requiredSpace = requiredBasketSpace(design.fit);
  const tooSmall = !byBlock && requiredSpace && dimensionsValid && (input.width <= requiredSpace.width || input.height <= requiredSpace.height || input.depth <= requiredSpace.depth);
  const color = basketColors.find((c) => c.ral === ral)!;
  const href = valid ? basketBriefHref(input) : "";
  const summary = valid ? basketBriefText(input) : "";
  const checks = basketReview(input);
  const pendingCount = checks.filter(check => check.state === "missing" || check.state === "conflict").length;
  function go(next: number) {
    setStep(next);
    heading.current?.focus({ preventScroll: true });
    heading.current?.scrollIntoView({ block: "start", behavior: "instant" });
  }
  function savePosition() {
    const value=structuredClone(input);
    if(editing===null){setItems([...items,value]);setSaved("Позиция добавлена в спецификацию.");}
    else{setItems(items.map((x,i)=>i===editing?value:x));setEditing(null);setSaved("Изменения позиции сохранены.");}
  }
  function download(preliminary = false) {
    const content = preliminary ? `ПРЕДВАРИТЕЛЬНОЕ ЗАДАНИЕ ДЛЯ ПОДБОРА КОРЗИНЫ\n${PRODUCT_CALCULATION_NOTICE}.\nРазмер корзины не определён: зазоры не подтверждены.\nКоличество: ${Number.isFinite(input.quantity) && input.quantity > 0 ? input.quantity : "нужно уточнить"}. Цвет: RAL ${ral}.\n${basketDesignSummary(design)}\n${basketReviewSummary(review)}` : summary;
    const url = URL.createObjectURL(new Blob(["\uFEFF" + content], { type: "text/plain;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = "Задание-корзины.txt"; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <div className={styles.studio} data-basket-configurator>
      <header className={styles.header}>
        <div><p className={styles.eyebrow}>СТАЛЬ ПРОДУКТ / КОНФИГУРАТОР</p>
          <h2>Ваша корзина.<br /><span>В деталях.</span></h2>
          <p>От наружного блока до спецификации: размеры, зазоры, панели и данные для проверки инженером.</p>
        </div>
        <span className={styles.free}>Бесплатно · без регистрации</span>
      </header>
      <nav aria-label="Шаги подбора корзины" className={styles.steps}>
        {steps.map((s, i) => <button type="button" key={s.title} aria-current={step === i ? "step" : undefined} onClick={() => go(i)}>
          <span className={styles.stepNumber}>{String(i + 1).padStart(2, "0")}</span>
          <span><strong>{s.title}</strong><small>{s.caption}</small></span>
        </button>)}
      </nav>
      <div className={styles.workspace}>
        <div className={styles.editor}>
          <div ref={heading} tabIndex={-1} className={styles.editorHeading}>
            <p className={styles.eyebrow}>ШАГ {step + 1} ИЗ 3</p>
            <h3>{["С чего начнём подбор?", "Уточните стену и фасад", "Проверьте и сохраните задание"][step]}</h3>
            <p className={styles.intro}>{["Есть проектные размеры корзины? Введите их и добавьте позицию. Или начните с наружного блока.", "Отделите глубину фасада от зазора за блоком. Неизвестные данные можно уточнить с инженером.", "Размеры, цвет и рисунок можно изменить. Стоимость предварительная; изготовление — после проверки задания."][step]}</p>
          </div>
          {editing !== null && <p className={styles.editingNotice}>Редактируется позиция {editing + 1}{review.mark ? ` · ${review.mark}` : ""}. Изменения попадут в спецификацию после сохранения.</p>}
          <div hidden={step !== 0}>
            <div className="my-5 flex gap-2" role="group" aria-label="Способ определения размеров">
              {([['basket','Знаю размеры корзины'],['block','Подобрать по кондиционеру']] as const).map(([value,label])=><button key={value} type="button" aria-pressed={(byBlock?'block':'basket')===value} onClick={()=>{
                const fit=basketFitForSizing(design,value);
                setDesign({...design,sizing:value,fit,...(fit?{offset:fit.rear,blockWidth:fit.width??0,blockHeight:fit.height??0,blockDepth:fit.depth??0}:{})});
              }} className={`min-h-12 flex-1 rounded-lg border px-3 py-2 text-sm font-semibold ${((byBlock?'block':'basket')===value)?'border-[#283431] bg-[#283431] text-white':'border-slate-300 bg-white text-slate-700'}`}>{label}</button>)}
            </div>
            {byBlock && <>
            <details className={styles.powerReference}>
              <summary>Подобрать ориентир по мощности кондиционера</summary>
              <BasketAcReference value={design.capacityClass} onChange={capacityClass => setDesign({...design, capacityClass})}
                onApplyUnit={code => setDesign(applyBasketAcReference(design, code))}
                onApply={([width, height, depth]) => {
                  setDimensions({...dimensions, width:String(width), height:String(height), depth:String(depth)});
                  setDesign({...design, sizing:"basket"});
                }} />
            </details>
            {design.acReference && <p className={styles.referenceWarning}>Пример: {design.acReference.model}. {basketAcDimensionDisclaimer}.</p>}
            </>}
            {byBlock ? <BasketFitFields value={design.fit} onChange={fit=>setDesign({...design,fit,offset:fit.rear,blockWidth:fit.width??0,blockHeight:fit.height??0,blockDepth:fit.depth??0})}/> : <>
            <p className={styles.intro}>Введите наружные размеры из проекта, в миллиметрах.</p>
            <details className={styles.reference}><summary>Примеры наружных размеров</summary><div className={styles.presets} aria-label="Примеры габаритов">
              {basketSizeExamples.map((s, i) => <button type="button" key={s.width}
                aria-pressed={input.width === s.width && input.height === s.height && input.depth === s.depth}
                onClick={() => setDimensions({ ...dimensions, width: String(s.width), height: String(s.height), depth: String(s.depth) })}>
                <span>{["Компактная", "Средняя", "Большая", "Увеличенная"][i]}</span><b>{s.width} × {s.height} × {s.depth}</b>
              </button>)}
            </div></details>
            </>}
            <div className={styles.inputs}>
              {([{ key:"width",label:"Ширина, мм" },{ key:"height",label:"Высота, мм" },{ key:"depth",label:"Глубина, мм" },{ key:"quantity",label:"Количество, шт." }] as const).filter(field=>!byBlock||field.key==="quantity").map((field) => <label key={field.key} htmlFor={`basket-${field.key}`}>
                {field.label}<input id={`basket-${field.key}`} type="text" inputMode="numeric" autoComplete="off" pattern="[0-9]*" value={dimensions[field.key]} aria-describedby={byBlock?undefined:"basket-size-help"} aria-invalid={!/^\d+$/.test(dimensions[field.key]) || Number(dimensions[field.key]) < 1 || Number(dimensions[field.key]) > 10000 || undefined} onChange={(e) => setDimensions({ ...dimensions, [field.key]:e.target.value })} />
              </label>)}
            </div>
            {!byBlock && <><p id="basket-size-help" className={styles.help}>Ширина × высота × глубина, в миллиметрах. Размеры включают наружные панели; свободный объём внутри меньше.</p>
            </>}
            <details className={styles.reference}><summary>Модель и примечания к позиции</summary><BasketCustomerFields section="equipment" value={review} onChange={setReview} /></details>
          </div>
          {step === 2 && <p className={styles.referenceWarning}>{PRODUCT_CALCULATION_NOTICE}.</p>}
          {step === 2 && <details className={styles.reference}><summary>Изменить рисунок и цвет</summary><fieldset className={styles.colors}>
            <legend>Цвет покрытия <b>RAL {ral}</b></legend>
            <div>{basketColors.map((c) => <button type="button" key={c.ral} aria-label={`RAL ${c.ral}, ${c.name}`} aria-pressed={ral === c.ral} onClick={() => setRal(c.ral)}><span style={{backgroundColor:c.hex}}/><small>{c.ral}</small></button>)}</div>
            <p>{color.name}. Цвет экрана приблизительный; покрытие согласуется по образцу.</p>
          </fieldset><BasketDesignFields step={2} design={design} onChange={setDesign} width={input.width} height={input.height} depth={input.depth} quantity={input.quantity}/></details>}
          {(step !== 2 || dimensionsValid) && <BasketDesignFields step={steps[step].stage} design={design} onChange={setDesign} width={input.width} height={input.height} depth={input.depth} quantity={input.quantity}/>}
          {step === 1 && <details className={styles.reference}><summary>Сервисный доступ и данные блока</summary><BasketCustomerFields section="service" value={review} onChange={setReview} /></details>}
          {step === 2 && <details className={styles.reference}><summary>Что проверить перед изготовлением · {pendingCount} уточнений</summary><BasketReviewChecklist input={input} onStep={target => go(target === 3 ? 2 : target === 2 ? 1 : 0)} /></details>}
          {step === 2 && tooSmall && <p className={styles.validation} role="alert">Корзину нужно увеличить: наружные размеры не вмещают необходимый свободный объём {requiredSpace.width} × {requiredSpace.height} × {requiredSpace.depth} мм. Исправьте размеры или передайте задание инженеру для подбора.</p>}
          {!valid && step === 2 && !(byBlock && !dimensionsValid) && <p className={styles.validation} role="status">{!dimensionsValid ? "Заполните размеры и количество." : "Проверьте параметры исполнения, сервисные расстояния и примечания. Размер отверстия должен быть меньше шага; числовые поля должны быть заполнены корректно."}</p>}
          {!byBlock && step === 0 && <div className={styles.actions}>
            <button type="button" className={styles.primary} disabled={!valid || (items.length >= 100 && editing === null)} onClick={savePosition}>{editing === null ? "Добавить в спецификацию" : `Сохранить позицию ${editing+1}`}</button>
            <p role="status">{saved}</p>
          </div>}
          <div className={styles.navigation}>
            <button type="button" disabled={step === 0} onClick={() => go(step - 1)}>← Назад</button>
            {step < 2 && <button type="button" className={!byBlock && step === 0 ? undefined : styles.primary} onClick={() => go(step + 1)}>Далее: {steps[step + 1].title.toLowerCase()} →</button>}
          </div>
          {step === 2 && byBlock && !dimensionsValid && <div className={styles.referenceWarning}>
            <p>Размер корзины не определён: зазоры не подтверждены. Можно передать известные данные для подбора.</p>
            <button type="button" className="mt-3 min-h-11 w-full rounded-lg border border-orange-300 bg-white px-3 py-2 text-sm font-semibold" disabled={!preliminaryValid} onClick={() => download(true)}>Скачать предварительное задание · TXT ↓</button>
            <AttributionLink href="/contacts" className="mt-2 block py-3 text-center text-sm font-semibold underline underline-offset-4">Передать специалисту →</AttributionLink>
            <p className="mt-2 text-xs">Скачайте задание и приложите его к обращению. Это данные для подбора, не спецификация готовой корзины.</p>
          </div>}
          {step === 2 && !(byBlock && !dimensionsValid) && <div className={styles.actions}>
            {valid ? <AttributionLink href={href} className={styles.primary}>Передать специалисту →</AttributionLink> : <button disabled className={styles.primary}>Уточните параметры</button>}
            <button type="button" disabled={!valid || (items.length >= 100 && editing === null)} onClick={savePosition}>{editing===null?"Добавить в спецификацию":`Сохранить позицию ${editing+1}`}</button>
            {editing!==null && <button type="button" onClick={()=>{setEditing(null);setSaved("");}}>Выйти без сохранения позиции</button>}
            <button type="button" disabled={!valid} onClick={() => download()}>Скачать задание · TXT ↓</button>
            <p className={styles.help}>Полное задание с моделью, сервисным доступом и примечаниями сохраняется в TXT и файле спецификации. По ссылке в форму передаются основные параметры корзины; полное задание приложите отдельно.</p>
            <p role="status">{saved}</p>
          </div>}
        </div>
        <aside className={styles.preview} aria-label="Визуализация корзины">
          <div className={styles.previewInner}>

            <BasketAppearance width={input.width} height={input.height} depth={input.depth} color={color.hex} ral={ral} design={design} review={review} />
          </div>
        </aside>
      </div>
      <BasketSpecification items={items} editing={editing} onChange={(next)=>{setItems(next);setEditing(null);setSaved("");}} onEdit={(v,i)=>{
        const fallback=defaultBasketDesign();
        const pattern=v.screen as BasketDesign["front"]["pattern"];
        const restored=v.design?structuredClone(v.design):{...fallback,front:{...fallback.front,pattern},side:{...fallback.side,pattern}};
        setDimensions({width:String(v.width),height:String(v.height),depth:String(v.depth),quantity:String(v.quantity)});setRal(v.ral);setDesign(restored);setReview(v.review ? structuredClone(v.review) : defaultBasketReview());setEditing(i);setSaved("");go(0);
      }}/>
    </div>
  );
}
