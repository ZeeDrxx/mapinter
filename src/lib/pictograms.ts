// Pictogrammes des catégories : tracés sur une grille de 24, dessinés au trait (stroke 2, bouts ronds).
// Une seule source pour l'interface (SVG) et la carte (Path2D sur canvas).
import type { PoiCategory } from "@/lib/poi";

export type Pictogram = { path: string } | { text: string };

export const PICTOGRAMS: Record<PoiCategory, Pictogram> = {
  stand: { path: "M4 9.5 6 5h12l2 4.5M4 9.5h16M5.5 9.5V19h13V9.5M10 19v-4.5h4V19" },
  stage: { path: "M12 4a3 3 0 0 1 3 3v4a3 3 0 0 1-6 0V7a3 3 0 0 1 3-3ZM7 11a5 5 0 0 0 10 0M12 16v4M9 20h6" },
  room: { path: "M7 20V5.5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1V20M4.5 20h15M14 12.5h.01" },
  food: { path: "M7.5 4v5.5a1.5 1.5 0 0 0 3 0V4M9 11v9M16.5 20V4c-2 1.5-3 4-3 7h3" },
  toilet: { text: "WC" },
  info: { path: "M12 10.5V17M12 7h.01" },
  first_aid: { path: "M12 6v12M6 12h12" },
  entrance: { path: "M12 4v10M7.5 9.5 12 14l4.5-4.5M5 19h14" },
  exit: { path: "M10 4.5H6.5a1 1 0 0 0-1 1v13a1 1 0 0 0 1 1H10M14.5 8l4 4-4 4M18.5 12H9.5" },
  other: { path: "M12 12h.01" },
};

/** Dessine le pictogramme dans un carré de `size` px centré en (cx, cy). */
export function drawPictogram(
  ctx: CanvasRenderingContext2D,
  category: PoiCategory,
  cx: number,
  cy: number,
  size: number,
  color: string,
  fontFamily = "system-ui, sans-serif",
) {
  const p = PICTOGRAMS[category];
  ctx.save();
  if ("text" in p) {
    ctx.fillStyle = color;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `800 ${size * 0.46}px ${fontFamily}`;
    ctx.fillText(p.text, cx, cy + size * 0.04);
  } else {
    const scale = size / 24;
    ctx.translate(cx - 12 * scale, cy - 12 * scale);
    ctx.scale(scale, scale);
    ctx.strokeStyle = color;
    ctx.lineWidth = category === "other" || category === "info" ? 3 : 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke(new Path2D(p.path));
  }
  ctx.restore();
}
