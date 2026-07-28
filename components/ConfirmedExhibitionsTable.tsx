export type ConfirmedExhibition = {
  name: string;
  date: string;
  city: string;
  venue: string;
  focus: string;
  url: string;
};

export function ConfirmedExhibitionsTable({
  events,
}: {
  events: ConfirmedExhibition[];
}) {
  return (
    <div className="mt-8">
      <div className="grid gap-3 md:hidden">
        {events.map((event, index) => (
          <article key={event.name} className="border border-white/12 bg-[#101417] p-5">
            <div className="flex items-start justify-between gap-4">
              <span className="font-mono text-sm font-bold text-steel-orange">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="border border-emerald-400/35 bg-emerald-400/[.08] px-2 py-1 text-[9px] font-bold uppercase tracking-[.12em] text-emerald-300">
                Дата подтверждена
              </span>
            </div>
            <h3 className="mt-5 text-lg font-semibold leading-6 text-white">{event.name}</h3>
            <p className="mt-3 font-mono text-sm font-bold text-steel-orange">{event.date}</p>
            <p className="mt-4 text-sm font-semibold text-white/72">{event.city}</p>
            <p className="mt-1 text-xs leading-5 text-white/42">{event.venue}</p>
            <p className="mt-4 border-t border-white/10 pt-4 text-sm leading-6 text-white/62">
              {event.focus}
            </p>
            <a
              href={event.url}
              target="_blank"
              rel="noreferrer"
              className="mt-5 inline-block text-xs font-bold uppercase tracking-[.06em] text-steel-orange"
            >
              Официальный сайт&nbsp; ↗
            </a>
          </article>
        ))}
      </div>

      <div className="hidden overflow-hidden border border-white/12 md:block">
        <table className="w-full border-collapse text-left">
          <thead className="bg-[#0b0f12]">
            <tr className="text-[10px] uppercase tracking-[.12em] text-white/48">
              <th className="w-[22%] border-r border-white/10 p-5">Выставка</th>
              <th className="w-[17%] border-r border-white/10 p-5 text-steel-orange">Даты</th>
              <th className="w-[22%] border-r border-white/10 p-5">Город и площадка</th>
              <th className="border-r border-white/10 p-5">Основная тематика</th>
              <th className="w-[13%] p-5">Источник</th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {events.map((event, index) => (
              <tr
                key={event.name}
                className={`${index % 2 === 0 ? "bg-[#111519]" : "bg-[#0e1316]"} border-t border-white/10 transition hover:bg-[#171c20]`}
              >
                <th scope="row" className="border-r border-white/10 p-5 font-semibold leading-6 text-white">
                  {event.name}
                </th>
                <td className="border-r border-white/10 p-5">
                  <span className="font-mono text-sm font-bold leading-6 text-steel-orange">
                    {event.date}
                  </span>
                  <span className="mt-3 block w-fit border border-emerald-400/30 bg-emerald-400/[.07] px-2 py-1 text-[8px] font-bold uppercase tracking-[.1em] text-emerald-300">
                    Подтверждено
                  </span>
                </td>
                <td className="border-r border-white/10 p-5 leading-6 text-white/66">
                  <span className="font-semibold text-white/82">{event.city}</span>
                  <span className="mt-1 block text-xs leading-5 text-white/42">{event.venue}</span>
                </td>
                <td className="border-r border-white/10 p-5 leading-6 text-white/66">{event.focus}</td>
                <td className="p-5">
                  <a
                    href={event.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-bold uppercase leading-5 text-steel-orange"
                  >
                    Официальный сайт&nbsp; ↗
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
