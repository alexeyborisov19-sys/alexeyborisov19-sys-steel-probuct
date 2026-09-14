import Image from "next/image";
import type { ProjectPhoto } from "@/data/real-project-showcase";

type ProjectPhotoGalleryProps = {
  photos: ProjectPhoto[];
  className?: string;
  tall?: boolean;
};

const nonPhotographicProjectMedia = new Set([
  "https://images.cdn-cian.ru/images/0/542/096/solovinaya-roshca-novyy-kvartal-smolensk-jk-690245038-6.jpg",
  "https://images.cdn-cian.ru/images/apartkompleks-yuniti-smolensk-jk-1894417700-10.jpg",
  "https://images.cdn-cian.ru/images/po-ul-25-sentyabrya-smolensk-jk-2005676224-7.jpg",
  "https://vostokstroy67.ru/images/vostok-new/images/3.jpg",
]);

const residentialFallback: ProjectPhoto = {
  src: "/images/industries/residential.jpg",
  alt: "Иллюстративный визуал жилой застройки — реальная фотография объекта проверяется",
  credit: "Иллюстративный визуал отрасли · не фото объекта",
  sourceUrl: "/projects",
};

export function ProjectPhotoGallery({ photos, className = "", tall = false }: ProjectPhotoGalleryProps) {
  const verifiedPhotos = photos.filter((photo) => !nonPhotographicProjectMedia.has(photo.src));
  const visiblePhotos = verifiedPhotos.length ? verifiedPhotos : [residentialFallback];

  return (
    <div className={`relative overflow-hidden bg-[#172026] ${className}`}>
      <div className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:thin] [scrollbar-color:rgba(224,86,36,.65)_rgba(255,255,255,.08)]">
        {visiblePhotos.map((photo, index) => (
          <figure key={`${photo.src}-${index}`} className="relative min-w-full snap-center">
            <div className={`relative w-full ${tall ? "h-[420px] sm:h-[520px]" : "h-64 sm:h-72"}`}>
              <Image
                src={photo.src}
                alt={photo.alt}
                fill
                sizes="(max-width: 639px) 100vw, (max-width: 1279px) 50vw, 33vw"
                priority={index === 0 && tall}
                className="object-cover brightness-[.92]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#080b0d]/78 via-transparent to-transparent" />
              <a
                href={photo.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="absolute bottom-3 left-3 max-w-[calc(100%-6rem)] bg-black/72 px-3 py-2 text-[10px] leading-4 text-white/70 transition hover:text-white"
              >
                Источник: {photo.credit}&nbsp; ↗
              </a>
              {visiblePhotos.length > 1 ? (
                <span className="absolute bottom-3 right-3 bg-steel-orange px-2.5 py-2 text-[10px] font-bold tabular-nums text-white">
                  {index + 1}/{visiblePhotos.length}
                </span>
              ) : null}
            </div>
          </figure>
        ))}
      </div>
      {visiblePhotos.length > 1 ? (
        <p className="border-t border-white/10 bg-[#0c1013] px-4 py-2 text-[10px] uppercase tracking-[.08em] text-white/38">
          Несколько подтверждённых источников фото · пролистайте карточки →
        </p>
      ) : null}
    </div>
  );
}
