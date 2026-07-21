import Link from "next/link";

type InnerHeroProps = { eyebrow: string; title: string; description: string; image?: string; imageBrightness?: boolean };

export function InnerHero({ eyebrow, title, description, image, imageBrightness = false }: InnerHeroProps) {
  return <section className="relative isolate min-h-[620px] overflow-hidden pt-[88px]">
    <div className="inner-hero-surface absolute inset-0" style={image ? { backgroundImage: `${imageBrightness ? "linear-gradient(90deg,#101112 0%,rgba(16,17,18,.67) 47%,rgba(16,17,18,.09) 100%)" : "linear-gradient(90deg,#101112 0%,rgba(16,17,18,.72) 47%,rgba(16,17,18,.14) 100%)"}, url('${image}')` } : undefined} aria-hidden="true" />
    <div className="container relative z-10 flex min-h-[532px] items-end pb-16"><div className="max-w-3xl"><p className="eyebrow">{eyebrow}</p><h1 className="mt-5 text-4xl font-semibold uppercase leading-[1.04] tracking-[-.035em] sm:text-6xl">{title}</h1><p className="mt-7 max-w-xl text-lg leading-relaxed text-white/72">{description}</p><div className="mt-9 flex gap-3"><Link href="/contacts#contact-form" className="clip-corner bg-steel-orange px-7 py-4 text-sm font-bold">Получить расчет</Link><Link href="/projects" className="clip-corner border border-white/45 px-7 py-4 text-sm font-bold">Все проекты</Link></div></div></div>
  </section>;
}
