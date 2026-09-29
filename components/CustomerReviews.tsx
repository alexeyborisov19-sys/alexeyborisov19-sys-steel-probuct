import { customerReviews, customerReviewSource } from "@/data/customer-reviews";
import { brandOfficialProfiles } from "@/data/entity-references";

export default function CustomerReviews() {
  return (
    <section id="reviews" aria-labelledby="reviews-heading" className="border-y border-white/10 bg-[#111519] py-6 text-white sm:py-8">
      <div className="container">
        <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-3">
          <h2 id="reviews-heading" className="text-lg font-semibold">Отзывы заказчиков</h2>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            {brandOfficialProfiles.map((profile) => (
              <a key={profile.name} href={profile.name === "Яндекс Карты" ? `${profile.url}?tab=reviews` : profile.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 text-sm text-white/80 underline-offset-4 hover:text-white hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-steel-orange">
                {profile.name}<span aria-hidden="true">↗</span><span className="sr-only"> (в новой вкладке)</span>
              </a>
            ))}
          </div>
        </div>
        <details className="group mt-1">
          <summary className="w-fit cursor-pointer py-3 text-sm text-white/70 underline underline-offset-4 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-steel-orange">Читать выдержки из отзывов</summary>
          <div className="pb-2 pt-4">
            <p className="max-w-3xl text-sm leading-6 text-white/70">Отзывы в Яндекс Картах о производстве «Энергоальянс». ООО «ЭНЕРГОАЛЬЯНС» работает под брендом «Сталь Продукт».</p>
            <div className="mt-5 grid gap-6 md:grid-cols-3">
              {customerReviews.map((review) => (
                <figure key={review.author} className="border-l border-white/20 pl-4">
                  <blockquote className="text-base leading-7 text-white/90">«{review.excerpt}»</blockquote>
                  <figcaption className="mt-3 text-sm text-white/70">
                    <span className="font-semibold text-white/90">{review.author}</span>
                    <time dateTime={review.date} className="mt-1 block">{review.dateLabel}</time>
                  </figcaption>
                </figure>
              ))}
            </div>
            <p className="mt-6 text-sm leading-6 text-white/70">Выбранные фрагменты. <a href={customerReviewSource} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-steel-orange">Полные отзывы и оценки в Яндекс Картах<span className="sr-only"> (в новой вкладке)</span></a>. Источник проверен 28 сентября 2026.</p>
          </div>
        </details>
      </div>
    </section>
  );
}
