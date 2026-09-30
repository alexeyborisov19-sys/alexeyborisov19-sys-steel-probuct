import Image from "next/image";
import Link from "next/link";
import { AttributionLink } from "./AttributionLink";
import { innerHeroOffset } from "@/data/site-mode";
import { siteConfig } from "@/lib/site";

type InnerHeroProps = {
  eyebrow: string;
  title: string;
  titleAccent?: string;
  description: string;
  image?: string;
  imageAlt?: string;
  imageBrightness?: boolean;
  primaryLabel?: string;
  secondaryHref?: string;
  secondaryLabel?: string;
  enquirySupport?: boolean;
};

export function InnerHero({
  eyebrow,
  title,
  titleAccent,
  description,
  image,
  imageAlt,
  imageBrightness = false,
  primaryLabel = "Получить расчёт",
  secondaryHref = "/projects",
  secondaryLabel = "Все проекты",
  enquirySupport = false,
}: InnerHeroProps) {
  return <section className={`relative isolate overflow-hidden ${innerHeroOffset}`}>
    {/* A backdrop carries no meaning and stays hidden from assistive tech; a photo
        that actually depicts the subject gets described and can be found in image
        search. The caller decides which of the two it is passing. */}
    {image ? <Image src={image} alt={imageAlt ?? ""} aria-hidden={imageAlt ? undefined : "true"} fill priority sizes="100vw" className="object-cover" /> : null}
    <div className="inner-hero-surface absolute inset-0" style={image ? { backgroundImage: imageBrightness ? "linear-gradient(90deg,#101112 0%,rgba(16,17,18,.67) 47%,rgba(16,17,18,.09) 100%)" : "linear-gradient(90deg,#101112 0%,rgba(16,17,18,.72) 47%,rgba(16,17,18,.14) 100%)" } : undefined} aria-hidden="true" />
    <div className="container relative z-10 flex min-h-[532px] items-end pb-16">
      <div className="min-w-0 w-full max-w-3xl">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="mt-5 break-words text-4xl font-semibold uppercase leading-[1.04] tracking-[-.035em] sm:text-6xl">{title}{titleAccent ? <span className="journal-mark mt-4"><span className="journal-mark__edge" aria-hidden="true" /><span className="journal-mark__panel clip-corner"><span className="journal-mark__kicker">Технологии · практика · события</span><span className="journal-mark__title">{titleAccent}</span></span></span> : null}</h1>
        <p className="mt-7 max-w-xl text-lg leading-relaxed text-white/72">{description}</p>
        <div className="mt-9 flex flex-wrap gap-3">
          <AttributionLink href="/contacts#contact-form" className="clip-corner bg-steel-orange-deep px-7 py-4 text-sm font-bold">{primaryLabel}</AttributionLink>
          <Link href={secondaryHref} className="clip-corner border border-white/45 px-7 py-4 text-sm font-bold">{secondaryLabel}</Link>
        </div>
        {enquirySupport ? <div data-enquiry-support className="mt-4 max-w-2xl">
          <p className="text-sm leading-6 text-white/80">Можно без чертежа: опишите изделие и количество. Недостающие данные уточнит инженер.</p>
          <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm font-semibold">
            <a href={`tel:${siteConfig.telephone}`} className="inline-flex min-h-11 items-center underline underline-offset-4 transition hover:text-steel-orange">Позвонить {siteConfig.telephoneDisplay}</a>
            <a href={`mailto:${siteConfig.email}`} className="inline-flex min-h-11 max-w-full items-center break-all underline underline-offset-4 transition hover:text-steel-orange">Написать {siteConfig.email}</a>
          </div>
        </div> : null}
      </div>
    </div>
  </section>;
}
