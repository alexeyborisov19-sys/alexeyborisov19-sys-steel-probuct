import Link from "next/link";

type InnerHeroProps = { eyebrow: string; title: string; titleAccent?: string; description: string; image?: string; imageBrightness?: boolean };

export function InnerHero({ eyebrow, title, titleAccent, description, image, imageBrightness = false }: InnerHeroProps) {
  return <section className="relative isolate min-h-[620px] overflow-hidden pt-[88px]">
    {image ? <img src={image} alt="" aria-hidden="true" width={1280} height={720} loading="eager" fetchPriority="high" decoding="async" className="absolute inset-0 h-full w-full object-cover" /> : null}
    <div className="inner-hero-surface absolute inset-0" style={image ? { backgroundImage: imageBrightness ? "linear-gradient(90deg,#101112 0%,rgba(16,17,18,.67) 47%,rgba(16,17,18,.09) 100%)" : "linear-gradient(90deg,#101112 0%,rgba(16,17,18,.72) 47%,rgba(16,17,18,.14) 100%)" } : undefined} aria-hidden="true" />
    <div className="container relative z-10 flex min-h-[532px] items-end pb-16"><div className="min-w-0 w-full max-w-3xl"><p className="eyebrow">{eyebrow}</p><h1 className="mt-5 break-words text-4xl font-semibold uppercase leading-[1.04] tracking-[-.035em] sm:text-6xl">{title}{titleAccent ? <span className="journal-mark mt-4"><span className="journal-mark__edge" aria-hidden="true" /><span className="journal-mark__panel clip-corner"><span className="journal-mark__kicker">Технологии · практика · события</span><span className="journal-mark__title">{titleAccent}</span></span></span> : null}</h1><p className="mt-7 max-w-xl text-lg leading-relaxed text-white/72">{description}</p><div className="mt-9 flex flex-wrap gap-3"><Link href="/contacts#contact-form" className="clip-corner bg-steel-orange px-7 py-4 text-sm font-bold">Получить расчет</Link><Link href="/projects" className="clip-corner border border-white/45 px-7 py-4 text-sm font-bold">Все проекты</Link></div></div></div>
  </section>;
}
