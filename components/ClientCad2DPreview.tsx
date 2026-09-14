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
  const common = {
    fill: "none",
    stroke: "#f58220",
    strokeWidth: Math.max(bounds.w, bounds.h) / 720,
    vectorEffect: "non-scaling-stroke" as const,
  };

  return (
    <svg
      className="h-full w-full"
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
          return (
            <motion.polyline
              key={index}
              initial={{ pathLength: 0, opacity: 0.2 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 0.45, delay: Math.min(index * 0.01, 0.4) }}
              points={renderedPoints}
              {...common}
            />
          );
        }

        return <polyline key={index} points={renderedPoints} {...common} />;
      })}
    </svg>
  );
}
