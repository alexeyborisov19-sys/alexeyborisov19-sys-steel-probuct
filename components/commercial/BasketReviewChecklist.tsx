"use client";
import type { BasketBrief } from "@/lib/quote/basket-brief";
import { basketReview } from "@/lib/quote/basket-review";
import styles from "./BasketConfigurator.module.css";

const states = { supplied: "Указано", missing: "Нужно уточнить", conflict: "Есть несоответствие", review: "Проверит инженер" };
export function BasketReviewChecklist({ input, onStep }: { input: BasketBrief; onStep: (step: number) => void }) {
  const checks = basketReview(input);
  const missing = checks.filter(check => check.state === "missing").length;
  const conflicts = checks.filter(check => check.state === "conflict").length;
  return <section className={styles.review} aria-labelledby="basket-review-title">
    <div className={styles.reviewHeading}>
      <div><p className={styles.eyebrow}>ПЕРЕД ПЕРЕДАЧЕЙ ИНЖЕНЕРУ</p><h4 id="basket-review-title">Что ещё нужно уточнить</h4></div>
      <span>{conflicts ? `${conflicts} несоответствия` : missing ? `${missing} пунктов без данных` : "Данные собраны"}</span>
    </div>
    <p className={styles.help}>Отметка «Указано» означает только наличие ваших данных. Она не подтверждает совместимость оборудования или готовность к изготовлению.</p>
    <ul className={styles.reviewList}>
      {checks.map(check => <li key={check.id} data-state={check.state}>
        <span className={styles.reviewDot} aria-hidden="true">{check.state === "supplied" ? "✓" : check.state === "conflict" ? "!" : "·"}</span>
        <div><span className={styles.reviewState}>{states[check.state]}</span><strong>{check.title}</strong><p>{check.detail}</p></div>
        {check.step !== 3 && check.state !== "supplied" && <button type="button" aria-label={`Уточнить: ${check.title}`} onClick={() => onStep(check.step)}>Уточнить ↗</button>}
      </li>)}
    </ul>
  </section>;
}
