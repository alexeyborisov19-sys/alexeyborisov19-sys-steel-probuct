import Image from "next/image";
import Link from "next/link";
import { siteMode } from "@/data/site-mode";

type InnerHeroProps = { eyebrow: string; title: string; titleAccent?: string; description: string; image?: string; imageAlt?: string; imageBrightness?: boolean };

export function InnerHero({ eyebrow, title, titleAccent, description, image, imageAlt, imageBrightness = false }: InnerHeroProps) {
  const spacing = siteMode.isTest ? "min-h-[648px] pt-[116px]" : "min-h-[620px] pt-[88px]";

  return <section className={`relative isolate overflow-hidden ${spacing}`}>
    {/* A backdrop carries no meaning and stays hidden from assistive tech; a photo
        that actually depicts the subject gets described and can be found in image
        search. The caller decides which of the two it is passing. */}
    {image ? <Image src={image} alt={imageAlt ?? ""} aria-hidden={imageAlt ? undefined : "true"} fill priority sizes="100vw" className="object-cover" /> : null}
    <div className="inner-hero-surface absolute inset-0" style={image ? { backgroundImage: imageBrightness ? "linear-gradient(90deg,#101112 0%,rgba(16,17,18,.67) 47%,rgba(16,17,18,.09) 100%)" : "linear-gradient(90deg,#101112 0%,rgba(16,17,18,.72) 47%,rgba(16,17,18,.14) 100%)" } : undefined} aria-hidden="true" />
    <div className="container relative z-10 flex min-h-[532px] items-end pb-16"><div className="min-w-0 w-full max-w-3xl"><p className="eyebrow">{eyebrow}</p><h1 className="mt-5 break-words text-4xl font-semibold uppercase leading-[1.04] tracking-[-.035em] sm:text-6xl">{title}{titleAccent ? <span className="journal-mark mt-4"><span className="journal-mark__edge" aria-hidden="true" /><span className="journal-mark__panel clip-corner"><span className="journal-mark__kicker">Технологии · практика · события</span><span className="journal-mark__title">{titleAccent}</span></span></span> : null}</h1><p className="mt-7 max-w-xl text-lg leading-relaxed text-white/72">{description}</p><div className="mt-9 flex flex-wrap gap-3"><Link href="/contacts#contact-form" className="clip-corner bg-steel-orange px-7 py-4 text-sm font-bold">Получить расчёт</Link><Link href="/projects" className="clip-corner border border-white/45 px-7 py-4 text-sm font-bold">Все проекты</Link></div></div></div>
  </section>;
}
