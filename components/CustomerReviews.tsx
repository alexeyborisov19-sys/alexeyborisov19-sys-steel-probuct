import { brandOfficialProfiles } from "@/data/entity-references";

export default function CustomerReviews() {
  return (
    <section id="reviews" aria-labelledby="reviews-heading" className="bg-[#f3f4f2] py-12 text-[#202629] sm:py-16">
      <div className="container grid gap-8 lg:grid-cols-[1fr_1.2fr] lg:gap-12">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-[#80502b]">Обратная связь</p>
          <h2 id="reviews-heading" className="mt-3 text-2xl font-semibold sm:text-3xl">Отзывы и профили компании</h2>
          <p className="mt-4 max-w-lg leading-7 text-[#50595e]">Найдите «Сталь Продукт» на независимых площадках. Уже работали с нами? Поделитесь опытом — это поможет другим заказчикам выбрать производство.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {brandOfficialProfiles.map((profile) => {
            const isYandex = profile.name === "Яндекс Карты";
            return (
              <a key={profile.name} href={isYandex ? `${profile.url}?tab=reviews` : profile.url} target="_blank" rel="noopener noreferrer" className="group flex min-h-48 flex-col border border-[#d8deda] bg-white p-6 transition-colors hover:border-[#b95a15] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#b95a15]">
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
