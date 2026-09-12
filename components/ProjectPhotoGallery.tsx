import type { ProjectPhoto } from "@/data/real-project-showcase";

type ProjectPhotoGalleryProps = {
  photos: ProjectPhoto[];
  className?: string;
  tall?: boolean;
};

export function ProjectPhotoGallery({ photos, className = "", tall = false }: ProjectPhotoGalleryProps) {
  return (
    <div className={`relative overflow-hidden bg-[#172026] ${className}`}>
      <div className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:thin] [scrollbar-color:rgba(224,86,36,.65)_rgba(255,255,255,.08)]">
        {photos.map((photo, index) => (
          <figure key={`${photo.src}-${index}`} className="relative min-w-full snap-center">
            <div className={`relative w-full ${tall ? "h-[420px] sm:h-[520px]" : "h-64 sm:h-72"}`}>
              {/* External project imagery is intentionally rendered without Next image optimisation: sources remain attributable and do not become a production dependency of the image proxy. */}
              <img
                src={photo.src}
                alt={photo.alt}
                loading={index === 0 ? "eager" : "lazy"}
                decoding="async"
                className="absolute inset-0 h-full w-full object-cover brightness-[.92]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#080b0d]/78 via-transparent to-transparent" />
              <a
                href={photo.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="absolute bottom-3 left-3 max-w-[calc(100%-6rem)] bg-black/72 px-3 py-2 text-[10px] leading-4 text-white/70 transition hover:text-white"
              >
                Фото: {photo.credit}&nbsp; ↗
              </a>
              {photos.length > 1 ? (
                <span className="absolute bottom-3 right-3 bg-steel-orange px-2.5 py-2 text-[10px] font-bold tabular-nums text-white">
                  {index + 1}/{photos.length}
                </span>
              ) : null}
            </div>
          </figure>
        ))}
      </div>
      {photos.length > 1 ? (
        <p className="border-t border-white/10 bg-[#0c1013] px-4 py-2 text-[10px] uppercase tracking-[.08em] text-white/38">
          Несколько фотографий объекта · пролистайте галерею →
        </p>
      ) : null}
    </div>
  );
}
