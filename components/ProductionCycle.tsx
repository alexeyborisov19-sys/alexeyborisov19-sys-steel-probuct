"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type CycleStage = readonly [title: string, image: string];

type ProductionCycleProps = {
  stages: readonly CycleStage[];
};

/**
 * A small, deliberate reveal that makes the production sequence easier to
 * follow without turning the approved industrial layout into a showy slider.
 */
export function ProductionCycle({ stages }: ProductionCycleProps) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const element = sectionRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setIsVisible(true);
        observer.disconnect();
      },
      { threshold: 0.22 },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={sectionRef}
      className={`production-cycle-track ${isVisible ? "is-visible" : ""}`}
    >
      {stages.map(([title, image], index) => (
        <Link
          key={title}
          href="/production"
          className="production-cycle-item relative aspect-video overflow-hidden bg-[#101112] p-4 transition-colors duration-300 hover:bg-[#171b1e] lg:aspect-auto lg:min-h-36"
          style={{ "--cycle-delay": `${index * 85}ms` } as React.CSSProperties}
        >
          <img
            src={`/images/web/cycle-${image}`}
            width={428}
            height={240}
            alt=""
            loading="lazy"
            decoding="async"
            className="production-cycle-image absolute inset-0 h-full w-full object-cover object-center opacity-60"
          />
          <div className="relative">
            <b className="text-xl text-steel-orange">{String(index + 1).padStart(2, "0")}</b>
            <p className="mt-3 text-xs font-bold uppercase leading-tight">{title}</p>
          </div>
        </Link>
      ))}
    </div>
  );
}
