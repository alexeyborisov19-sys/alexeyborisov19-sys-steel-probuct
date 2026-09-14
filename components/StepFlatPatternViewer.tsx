import type { SheetMetalBoundaryPreview } from "@/lib/instant-quote/sheet-metal";

type StepFlatPatternViewerProps = {
  preview: SheetMetalBoundaryPreview;
  widthMm: number;
  heightMm: number;
  className?: string;
};

export function StepFlatPatternViewer({ preview, widthMm, heightMm, className = "" }: StepFlatPatternViewerProps) {
  const padding = Math.max(4, Math.max(widthMm, heightMm) * 0.06);
  const viewWidth = Math.max(widthMm, 1) + padding * 2;
  const viewHeight = Math.max(heightMm, 1) + padding * 2;

  return (
    <div className={`relative flex h-full w-full items-center justify-center ${className}`}>
      <svg
        role="img"
        aria-label="BRep-превью плоской STEP-детали"
        viewBox={`${-padding} ${-padding} ${viewWidth} ${viewHeight}`}
        className="h-full w-full"
        preserveAspectRatio="xMidYMid meet"
      >
        <rect
          x={0}
          y={0}
          width={widthMm}
          height={heightMm}
          fill="none"
          className="stroke-white/10"
          vectorEffect="non-scaling-stroke"
          strokeDasharray="4 4"
        />
        {preview.wires.flatMap((wire) =>
          wire.edges.map((edge) => (
            <polyline
              key={`${wire.id}:${edge.id}`}
              points={edge.pointsMm.map(([u, v]) => `${u},${heightMm - v}`).join(" ")}
              fill="none"
              className="stroke-steel-orange"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          )),
        )}
      </svg>
      <div className="pointer-events-none absolute left-3 top-3 border border-white/10 bg-black/65 px-2 py-1 text-[9px] font-bold uppercase tracking-[.12em] text-white/45">
        BRep 2D · preview only
      </div>
    </div>
  );
}
