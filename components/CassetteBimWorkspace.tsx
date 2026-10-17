"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import styles from "./CassetteBimWorkspace.module.css";

const sections = [
  { key: "library", hash: "bim-library", label: "Каталог изделий", number: "01" },
  { key: "layout", hash: "bim-config-title", label: "Раскладка фасада", number: "02" },
  { key: "joints", hash: "bim-joints", label: "Узлы и примыкания", number: "03" },
  { key: "help", hash: "bim-passport", label: "Форматы и помощь", number: "04" },
] as const;
type SectionKey = typeof sections[number]["key"];
type Props = Record<SectionKey, ReactNode>;

export function CassetteBimWorkspace(props: Props) {
  const [active, setActive] = useState<SectionKey>("library");
  const root = useRef<HTMLDivElement>(null);
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    const followHash = () => {
      let hash: string;
      try { hash = decodeURIComponent(window.location.hash.slice(1)); } catch { return; }
      if (!hash) { setActive("library"); return; }
      const direct = sections.find(section => section.hash === hash);
      const target = document.getElementById(hash);
      const owner = target?.closest<HTMLElement>("[data-bim-panel]");
      const selected = direct?.key ?? sections.find(section => section.key === owner?.dataset.bimPanel)?.key;
      if (!selected) return;
      setActive(selected);
      // Hidden panels remain mounted; reveal before resolving an incoming anchor.
      requestAnimationFrame(() => requestAnimationFrame(() => target?.scrollIntoView({ block: "start" })));
    };
    const followInternalAnchor = (event: MouseEvent) => {
      const link = (event.target as Element | null)?.closest<HTMLAnchorElement>("a[href^='#']");
      if (!link || !root.current?.contains(link) || !link.hash) return;
      // Clicking the current hash does not emit hashchange.
      if (link.hash === window.location.hash) followHash();
    };
    followHash();
    window.addEventListener("hashchange", followHash);
    document.addEventListener("click", followInternalAnchor);
    return () => {
      window.removeEventListener("hashchange", followHash);
      document.removeEventListener("click", followInternalAnchor);
    };
  }, []);

  function activate(index: number, focus = false) {
    const section = sections[index];
    setActive(section.key);
    const hash = `#${section.hash}`;
    if (window.location.hash !== hash) window.history.pushState(null, "", hash);
    if (focus) buttons.current[index]?.focus();
  }
  function navigate(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next = index;
    if (event.key === "ArrowRight") next = (index + 1) % sections.length;
    else if (event.key === "ArrowLeft") next = (index + sections.length - 1) % sections.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = sections.length - 1;
    else return;
    event.preventDefault();
    activate(next, true);
  }

  return <div className={styles.workspace} ref={root}>
    <div className={styles.intro}>
      <p className={styles.lead}>Выберите готовое изделие или соберите фасадный фрагмент.</p>
      <ul className={styles.metrics} aria-label="О библиотеке"><li><strong>15</strong> исходных моделей</li><li><strong>IFC4</strong> для координации</li><li>Без регистрации</li></ul>
    </div>
    <div className={styles.tabs} role="tablist" aria-label="Разделы BIM-библиотеки">
      {sections.map((section, index) => <button key={section.key} ref={element => { buttons.current[index] = element; }} type="button" role="tab" id={`bim-tab-${section.key}`} aria-selected={active === section.key} aria-controls={`bim-panel-${section.key}`} tabIndex={active === section.key ? 0 : -1} onClick={() => activate(index)} onKeyDown={event => navigate(event, index)} className={styles.tab}><span aria-hidden="true">{section.number}</span>{section.label}</button>)}
    </div>
    {sections.map(section => <div key={section.key} id={`bim-panel-${section.key}`} role="tabpanel" aria-labelledby={`bim-tab-${section.key}`} data-bim-panel={section.key} hidden={active !== section.key} tabIndex={0} className={styles.panel}>{props[section.key]}</div>)}
  </div>;
}
