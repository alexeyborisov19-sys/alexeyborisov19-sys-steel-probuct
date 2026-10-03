import { AttributionLink } from "@/components/AttributionLink";
import { customerGuides } from "@/data/customer-guides";
export function CustomerResources({ current }: { current?: string }) {
  return (
    <section className="border-y border-white/15 bg-[#101416] py-12 sm:py-16">
      <div className="container">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="eyebrow">Заказ без недосказанностей</p>
            <h2 className="mt-3 text-2xl font-semibold sm:text-3xl">
              Подготовьтесь к следующему шагу
            </h2>
          </div>
          <AttributionLink
            className="inline-flex min-h-11 items-center font-semibold text-steel-orange underline underline-offset-4"
            href="/customers"
          >
            Заказчику →
          </AttributionLink>
        </div>
        <div className="mt-7 grid gap-4 md:grid-cols-3">
          {customerGuides
            .filter((g) => g.slug !== current)
            .map((guide, i) => (
              <AttributionLink
                key={guide.slug}
                href={"/customers/" + guide.slug}
                className="group border border-white/20 p-6 transition hover:border-steel-orange"
              >
                <span className="font-mono text-sm text-steel-orange">
                  0{i + 1}
                </span>
                <h3 className="mt-4 text-lg font-semibold group-hover:text-steel-orange">
                  {guide.title}
                </h3>
                <p className="mt-3 text-sm leading-6 text-white/75">
                  {guide.description}
                </p>
                <span className="mt-5 block text-sm font-semibold">
                  Открыть руководство →
                </span>
              </AttributionLink>
            ))}
        </div>
      </div>
    </section>
  );
}
