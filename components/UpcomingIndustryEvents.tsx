import { JsonLd } from "@/components/JsonLd";
import { upcomingIndustryEvents } from "@/data/upcoming-industry-events";

const eventsSchema = {
  "@context": "https://schema.org",
  "@type": "ItemList",
  name: "Ближайшие отраслевые выставки и события",
  itemListElement: upcomingIndustryEvents.map((event, index) => ({
    "@type": "ListItem",
    position: index + 1,
    item: {
      "@type": "Event",
      name: event.name,
      startDate: event.startDate,
      endDate: event.endDate,
      eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
      eventStatus: "https://schema.org/EventScheduled",
      location: {
        "@type": "Place",
        name: event.venue,
        address: {
          "@type": "PostalAddress",
          addressLocality: event.city,
        },
      },
      description: event.why,
      url: event.url,
    },
  })),
};

export function UpcomingIndustryEvents() {
  return (
    <>
      <JsonLd data={eventsSchema} />
      <div className="mt-7">
        <div className="flex flex-col justify-between gap-4 border border-steel-orange/35 bg-[linear-gradient(135deg,rgba(224,86,36,.12),rgba(16,21,25,.98)_48%)] p-5 sm:flex-row sm:items-end sm:p-6">
          <div>
            <p className="eyebrow">Проверено 12 сентября 2026</p>
            <h3 className="mt-2 text-xl font-semibold uppercase sm:text-2xl">Ближайшие подтверждённые выставки и события</h3>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-white/55">Даты, города и площадки сверены по официальным сайтам организаторов. В подборке — фасады, строительство, сварка, покрытия, металлообработка и промышленное оборудование.</p>
          </div>
          <span className="shrink-0 text-4xl font-semibold tabular-nums text-steel-orange">{upcomingIndustryEvents.length}</span>
        </div>

        <div className="grid gap-3 border-x border-b border-white/12 bg-[#0b0f12] p-3 sm:p-4 xl:grid-cols-2">
          {upcomingIndustryEvents.map((event) => (
            <a key={event.name} href={event.url} target="_blank" rel="noreferrer" className="group flex h-full flex-col border border-white/10 bg-[#101519] p-5 transition hover:border-steel-orange/65">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="border border-steel-orange/45 bg-steel-orange/10 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-[.08em] text-steel-orange">{event.badge}</span>
                <time dateTime={event.startDate} className="text-xs text-white/38">{event.dates}</time>
              </div>
              <h4 className="mt-4 text-lg font-semibold uppercase leading-tight">{event.shortName}</h4>
              <p className="mt-1 text-xs font-semibold uppercase tracking-[.06em] text-white/42">{event.city} · {event.venue}</p>
              <p className="mt-4 text-xs font-bold uppercase tracking-[.08em] text-steel-orange/90">{event.direction}</p>
              <p className="mt-2 text-sm leading-6 text-white/56">{event.why}</p>
              <span className="mt-auto pt-5 text-xs font-bold uppercase text-steel-orange">Официальный сайт&nbsp; ↗</span>
            </a>
          ))}
        </div>
      </div>
    </>
  );
}
