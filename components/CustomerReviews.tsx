import { customerReviewSource } from "@/data/customer-reviews";
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
        <p className="mt-2 text-sm leading-6 text-white/70">
          <a href={customerReviewSource} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-steel-orange">
            Читать отзывы о производстве «Энергоальянс» в Яндекс Картах
            <span className="sr-only"> (в новой вкладке)</span>
          </a>
        </p>
      </div>
    </section>
  );
}
