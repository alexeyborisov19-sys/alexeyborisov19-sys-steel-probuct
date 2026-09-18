import Image from "next/image";
import Link from "next/link";

type CycleStage = readonly [title: string, image: string];

type ProductionCycleProps = {
  stages: readonly CycleStage[];
};

export function ProductionCycle({ stages }: ProductionCycleProps) {
  return (
    <div className="production-cycle-track">
      {stages.map(([title, image], index) => (
        <Link
          key={title}
          href="/production"
          className="production-cycle-item relative aspect-video overflow-hidden bg-[#101112] p-4 transition-colors duration-300 hover:bg-[#171b1e] lg:aspect-auto lg:min-h-36"
        >
          <Image
            src={`/images/web/cycle-${image}`}
            fill
            sizes="(max-width: 639px) 100vw, (max-width: 1023px) 50vw, 190px"
            alt={`${title} — этап производства изделий из листового металла`}
            className="production-cycle-image object-cover object-center opacity-60"
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
