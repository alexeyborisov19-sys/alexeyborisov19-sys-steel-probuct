import { customerReviews, customerReviewSource } from "@/data/customer-reviews";
import { brandOfficialProfiles } from "@/data/entity-references";

export default function CustomerReviews() {
  return (
    <section id="reviews" aria-labelledby="reviews-heading" className="bg-[#f3f4f2] py-12 text-[#202629] sm:py-16">
      <div className="container">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-[#80502b]">Обратная связь</p>
          <h2 id="reviews-heading" className="mt-3 text-2xl font-semibold sm:text-3xl">Заказчики о нашей работе</h2>
          <p className="mt-4 max-w-lg leading-7 text-[#50595e]">Выдержки из отзывов о нашем производстве в Яндекс Картах — карточка «Энергоальянс». ООО «ЭНЕРГОАЛЬЯНС» — компания, работающая под брендом «Сталь Продукт».</p>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {customerReviews.map((review) => (
            <figure key={review.author} className="flex flex-col border border-[#d8deda] bg-white p-6">
              <blockquote className="text-lg leading-8">«{review.excerpt}»</blockquote>
              <figcaption className="mt-auto pt-6">
                <p className="font-semibold">{review.author}</p>
                <time dateTime={review.date} className="mt-1 block text-sm text-[#50595e]">{review.dateLabel}</time>
                <a href={customerReviewSource} target="_blank" rel="noopener noreferrer" className="mt-4 inline-block text-sm font-semibold text-[#94410e] underline underline-offset-4">Отзывы в Яндекс Картах<span className="sr-only"> (в новой вкладке)</span></a>
              </figcaption>
            </figure>
          ))}
        </div>
        <p className="mt-4 text-sm text-[#50595e]">Это выбранные фрагменты отзывов. Полные тексты и все оценки доступны на площадке. Источник проверен 28 сентября 2026.</p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {brandOfficialProfiles.map((profile) => {
            const isYandex = profile.name === "Яндекс Карты";
            return (
              <a key={profile.name} href={isYandex ? `${profile.url}?tab=reviews` : profile.url} target="_blank" rel="noopener noreferrer" className="group flex min-h-40 flex-col border border-[#d8deda] bg-white p-6 transition-colors hover:border-[#b95a15] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#b95a15]">
                <h3 className="text-xl font-semibold">{profile.name}</h3>
                <p className="mt-3 text-sm leading-6 text-[#50595e]">{isYandex ? "Карточка производства и раздел отзывов в Яндекс Картах." : "Официальный профиль компании на Авито."}</p>
                <span className="mt-auto pt-6 text-sm font-semibold text-[#94410e]">{isYandex ? "Перейти к отзывам" : "Открыть профиль"} <span aria-hidden="true">↗</span><span className="sr-only"> (в новой вкладке)</span></span>
              </a>
            );
          })}
        </div>
      </div>
    </section>
  );
}
