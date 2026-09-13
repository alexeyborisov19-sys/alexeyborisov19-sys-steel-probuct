import type { ProjectPhoto } from "@/data/real-project-showcase";

type ProjectPhotoGalleryProps = {
  photos: ProjectPhoto[];
  className?: string;
  tall?: boolean;
};

function isRemoteSource(src: string) {
  return /^https?:\/\//i.test(src);
}

export function ProjectPhotoGallery({ photos, className = "", tall = false }: ProjectPhotoGalleryProps) {
  return (
    <div className={`relative overflow-hidden bg-[#172026] ${className}`}>
      <div className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:thin] [scrollbar-color:rgba(224,86,36,.65)_rgba(255,255,255,.08)]">
        {photos.map((photo, index) => {
          const remote = isRemoteSource(photo.src);
          return (
            <figure key={`${photo.src}-${index}`} className="relative min-w-full snap-center">
              <div className={`relative w-full ${tall ? "h-[420px] sm:h-[520px]" : "h-64 sm:h-72"}`}>
                {remote ? (
                  <div className="absolute inset-0 flex flex-col justify-end bg-[radial-gradient(circle_at_72%_22%,rgba(224,86,36,.18),transparent_34%),linear-gradient(135deg,#1b252b,#0a0e11_68%)] p-5 sm:p-6">
                    <div className="max-w-xl border-l-2 border-steel-orange pl-4">
                      <p className="text-[10px] font-bold uppercase tracking-[.12em] text-steel-orange">Фото объекта найдено и проверено по источнику</p>
                      <p className="mt-2 text-sm leading-6 text-white/68">Изображение не загружается на steelprodukt.ru напрямую, пока право на публикацию файла не подтверждено. Открыть оригинал можно на сайте источника.</p>
                    </div>
                  </div>
                ) : (
                  <img
                    src={photo.src}
                    alt={photo.alt}
                    loading={index === 0 ? "eager" : "lazy"}
                    decoding="async"
                    className="absolute inset-0 h-full w-full object-cover brightness-[.92]"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-[#080b0d]/78 via-transparent to-transparent" />
                <a
                  href={photo.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="absolute bottom-3 left-3 max-w-[calc(100%-6rem)] bg-black/72 px-3 py-2 text-[10px] leading-4 text-white/70 transition hover:text-white"
                >
                  {remote ? "Оригинал фото" : "Источник"}: {photo.credit}&nbsp; ↗
                </a>
                {photos.length > 1 ? (
                  <span className="absolute bottom-3 right-3 bg-steel-orange px-2.5 py-2 text-[10px] font-bold tabular-nums text-white">
                    {index + 1}/{photos.length}
                  </span>
                ) : null}
              </div>
            </figure>
          );
        })}
      </div>
      {photos.length > 1 ? (
        <p className="border-t border-white/10 bg-[#0c1013] px-4 py-2 text-[10px] uppercase tracking-[.08em] text-white/38">
          Несколько подтверждённых источников фото · пролистайте карточки →
        </p>
      ) : null}
    </div>
  );
}
