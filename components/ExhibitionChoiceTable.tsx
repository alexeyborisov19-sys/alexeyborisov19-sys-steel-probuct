export type ExhibitionChoiceRow = {
  task: string;
  primary: string;
  primaryDate: string;
  alternative: string;
  alternativeDate: string;
  focus: string;
};

export function ExhibitionChoiceTable({ rows }: { rows: ExhibitionChoiceRow[] }) {
  return (
    <div className="mt-8">
      <div className="grid gap-3 md:hidden">
        {rows.map((row, index) => (
          <article key={row.task} className="border border-white/12 bg-[#101417] p-5">
            <div className="flex items-start gap-4">
              <span className="font-mono text-sm font-bold text-steel-orange">
                {String(index + 1).padStart(2, "0")}
              </span>
              <h3 className="text-base font-semibold leading-6 text-white">{row.task}</h3>
            </div>
            <dl className="mt-5 grid gap-4 border-t border-white/10 pt-5">
              <div>
                <dt className="text-[9px] font-bold uppercase tracking-[.14em] text-steel-orange">
                  Основной выбор
                </dt>
                <dd className="mt-2 text-sm font-semibold leading-6 text-white">{row.primary}</dd>
                <dd className="mt-1 font-mono text-xs font-bold text-steel-orange">{row.primaryDate}</dd>
              </div>
              <div>
                <dt className="text-[9px] font-bold uppercase tracking-[.14em] text-white/38">
                  Дополнительно
                </dt>
                <dd className="mt-2 text-sm leading-6 text-white/64">{row.alternative}</dd>
                <dd className="mt-1 font-mono text-xs font-bold text-white/48">{row.alternativeDate}</dd>
              </div>
              <div>
                <dt className="text-[9px] font-bold uppercase tracking-[.14em] text-white/38">
                  Что смотреть
                </dt>
                <dd className="mt-2 text-sm leading-6 text-white/64">{row.focus}</dd>
              </div>
            </dl>
          </article>
        ))}
      </div>

      <div className="hidden overflow-hidden border border-white/12 md:block">
        <table className="w-full border-collapse text-left">
          <thead className="bg-[#0b0f12]">
            <tr className="text-[10px] uppercase tracking-[.12em] text-white/48">
              <th className="w-[24%] border-r border-white/10 p-5">Что интересует</th>
              <th className="w-[20%] border-r border-white/10 p-5 text-steel-orange">Основной выбор</th>
              <th className="w-[20%] border-r border-white/10 p-5">Дополнительно</th>
              <th className="p-5">Что смотреть на выставке</th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {rows.map((row, index) => (
              <tr
                key={row.task}
                className={`${index % 2 === 0 ? "bg-[#111519]" : "bg-[#0e1316]"} border-t border-white/10 transition hover:bg-[#171c20]`}
              >
                <th scope="row" className="border-r border-white/10 p-5 font-semibold leading-6 text-white">
                  {row.task}
                </th>
                <td className="border-r border-white/10 p-5 font-semibold leading-6 text-steel-orange">
                  {row.primary}
                  <span className="mt-2 block font-mono text-xs font-bold text-white/62">
                    {row.primaryDate}
                  </span>
                </td>
                <td className="border-r border-white/10 p-5 leading-6 text-white/66">
                  {row.alternative}
                  <span className="mt-2 block font-mono text-xs font-bold text-white/42">
                    {row.alternativeDate}
                  </span>
                </td>
                <td className="p-5 leading-6 text-white/66">{row.focus}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
