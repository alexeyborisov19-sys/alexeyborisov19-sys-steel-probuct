"use client";

import { motion } from "framer-motion";
import type { ClientCadDrawingPreview } from "@/lib/instant-quote/client-cad-preview-types";

export function ClientCad2DPreview({ drawing, animated = false }: { drawing: ClientCadDrawingPreview; animated?: boolean }) {
  const pad = Math.max(drawing.widthMm, drawing.heightMm, 10) * 0.09;
  const bounds = {
    x: drawing.minX - pad,
    y: drawing.minY - pad,
    w: Math.max(drawing.widthMm + pad * 2, 1),
    h: Math.max(drawing.heightMm + pad * 2, 1),
  };
  const flipY = (value: number) => drawing.minY + drawing.maxY - value;
  // A page loaded before a release can post to the server that follows it, so
  // the field may be missing from a payload this build expects to have it.
  const excludedLayers = drawing.excludedLayers ?? [];
  const common = {
    fill: "none",
    stroke: "#f58220",
    // vector-effect keeps the line weight off the viewBox transform, which
    // means this number is screen pixels — not millimetres of the drawing. It
    // used to be derived from the bounding box, so a 340 mm part was drawn at
    // half a pixel: a hairline the display smeared into a broken dotted line,
    // and a part ten times larger would have been drawn ten times heavier.
    strokeWidth: 1.4,
    vectorEffect: "non-scaling-stroke" as const,
    // A drawing arrives as many separate segments. Round joins and caps close
    // the pinholes where two of them meet, so the contour reads as one line.
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  return (
    <div className="flex h-full w-full flex-col">
      <svg
        className="min-h-0 w-full flex-1"
        viewBox={`${bounds.x} ${bounds.y} ${bounds.w} ${bounds.h}`}
        preserveAspectRatio="xMidYMid meet"
        aria-label="2D CAD preview"
      >
        {drawing.polylines.map((polyline, index) => {
          const points = polyline.points
            .map(([x, y]) => `${x},${flipY(y)}`)
            .join(" ");
          const renderedPoints = polyline.closed && polyline.points.length > 0
            ? `${points} ${polyline.points[0][0]},${flipY(polyline.points[0][1])}`
            : points;

          if (animated) {
            // Fade, not pathLength. Framer draws a pathLength animation with
            // stroke-dasharray, and a dash pattern under non-scaling-stroke is
            // measured on the untransformed path and painted on the transformed
            // one — every straight run came out as evenly spaced dots.
            return (
              <motion.polyline
                key={index}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.35, delay: Math.min(index * 0.008, 0.35) }}
                points={renderedPoints}
                {...common}
              />
            );
          }

          return <polyline key={index} points={renderedPoints} {...common} />;
        })}
      </svg>
      {excludedLayers.length > 0 ? (
        // Without this the drawing simply comes up short and the customer has
        // no way to know why: a contour drawn on a layer whose name reads as
        // annotation is excluded on purpose, and silently.
        <p className="mt-3 shrink-0 text-center text-[11px] leading-relaxed text-white/45">
          Не показаны слои оформления:{" "}
          <span className="text-white/70">{excludedLayers.join(", ")}</span>. Если контур детали
          начерчен на одном из них, переименуйте слой и загрузите файл заново.
        </p>
      ) : null}
    </div>
  );
}
