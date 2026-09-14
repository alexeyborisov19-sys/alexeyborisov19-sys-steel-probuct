"use client";

import { motion } from "framer-motion";
import { arcPoints, ellipsePreviewPoints, polylinePreviewPoints, type ParsedDxf } from "@/lib/instant-quote/dxf";

export function Cad2DViewer({ parsed, animated = false }: { parsed: ParsedDxf; animated?: boolean }) {
  const pad = Math.max(parsed.width, parsed.height, 10) * 0.09;
  const bounds = {
    x: parsed.minX - pad,
    y: parsed.minY - pad,
    w: Math.max(parsed.width + pad * 2, 1),
    h: Math.max(parsed.height + pad * 2, 1),
  };
  const y = (value: number) => parsed.minY + parsed.maxY - value;
  const common = {
    fill: "none",
    stroke: "#f58220",
    strokeWidth: Math.max(bounds.w, bounds.h) / 720,
    vectorEffect: "non-scaling-stroke" as const,
  };

  return (
    <svg className="h-full w-full" viewBox={`${bounds.x} ${bounds.y} ${bounds.w} ${bounds.h}`} preserveAspectRatio="xMidYMid meet" aria-label="2D CAD preview">
      {parsed.shapes.map((shape, index) => {
        if (shape.kind === "line") {
          return animated ? (
            <motion.line
              key={index}
              initial={{ pathLength: 0, opacity: 0.2 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 0.5, delay: Math.min(index * 0.012, 0.45) }}
              x1={shape.a.x}
              y1={y(shape.a.y)}
              x2={shape.b.x}
              y2={y(shape.b.y)}
              {...common}
            />
          ) : (
            <line key={index} x1={shape.a.x} y1={y(shape.a.y)} x2={shape.b.x} y2={y(shape.b.y)} {...common} />
          );
        }

        if (shape.kind === "polyline") {
          const points = polylinePreviewPoints(shape)
            .map((point) => `${point.x},${y(point.y)}`)
            .join(" ");
          return <polyline key={index} points={points} {...common} />;
        }

        if (shape.kind === "circle") {
          return <circle key={index} cx={shape.c.x} cy={y(shape.c.y)} r={shape.r} {...common} />;
        }

        if (shape.kind === "ellipse") {
          return <polyline key={index} points={ellipsePreviewPoints(shape).map((point) => `${point.x},${y(point.y)}`).join(" ")} {...common} />;
        }

        return <polyline key={index} points={arcPoints(shape).map((point) => `${point.x},${y(point.y)}`).join(" ")} {...common} />;
      })}
    </svg>
  );
}