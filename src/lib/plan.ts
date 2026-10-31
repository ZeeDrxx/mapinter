import type { Feature, FeatureCollection, LineString, Polygon } from "geojson";
import type { LngLat } from "./geo";

// ---------------------------------------------------------------------------
// Éléments du plan dessiné
// ---------------------------------------------------------------------------

// Le rendu de chaque type (encre plus ou moins dense) est dans components/map/plan-layers.ts.
export const PLAN_KINDS = {
  hall: { label: "Hall / bâtiment" },
  zone: { label: "Zone" },
  stand: { label: "Stand" },
  stage: { label: "Scène" },
  obstacle: { label: "Obstacle / mur" },
  path: { label: "Chemin / allée" },
} as const;

export type PlanKind = keyof typeof PLAN_KINDS;
export type AreaKind = Exclude<PlanKind, "path">;
export const AREA_KINDS = (Object.keys(PLAN_KINDS) as PlanKind[]).filter(
  (k): k is AreaKind => k !== "path",
);

export type PlanProps = { id: string; kind: PlanKind; label: string; osmId?: string };
export type PlanFeature = Feature<Polygon | LineString, PlanProps>;
export type PlanCollection = FeatureCollection<Polygon | LineString, PlanProps>;

export const emptyPlan = (): PlanCollection => ({ type: "FeatureCollection", features: [] });

export function polygonFeature(id: string, ring: LngLat[], kind: AreaKind, label = ""): PlanFeature {
  return {
    type: "Feature",
    properties: { id, kind, label },
    geometry: { type: "Polygon", coordinates: [[...ring, ring[0]]] },
  };
}

export function pathFeature(id: string, points: LngLat[], label = ""): PlanFeature {
  return {
    type: "Feature",
    properties: { id, kind: "path", label },
    geometry: { type: "LineString", coordinates: points },
  };
}

/** Valide grossièrement une FeatureCollection lue en base. */
export function parsePlan(json: unknown): PlanCollection {
  const fc = json as PlanCollection | null;
  if (!fc || fc.type !== "FeatureCollection" || !Array.isArray(fc.features)) return emptyPlan();
  return {
    type: "FeatureCollection",
    features: fc.features.filter(
      (f) =>
        f?.properties?.id &&
        f.properties.kind in PLAN_KINDS &&
        (f.geometry?.type === "Polygon" || f.geometry?.type === "LineString"),
    ),
  };
}

// ---------------------------------------------------------------------------
// Projection locale (mètres) — suffisante à l'échelle d'un event
// ---------------------------------------------------------------------------

export type XY = [x: number, y: number];

const M_PER_DEG = (Math.PI / 180) * 6_371_008.8;
const rad = (deg: number) => (deg * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

/** Coordonnées en mètres (x vers l'est, y vers le nord) relatives à `origin`. */
export function toLocal(origin: LngLat, p: LngLat): XY {
  return [
    (p[0] - origin[0]) * M_PER_DEG * Math.cos(rad(origin[1])),
    (p[1] - origin[1]) * M_PER_DEG,
  ];
}

export function fromLocal(origin: LngLat, [x, y]: XY): LngLat {
  return [origin[0] + x / (M_PER_DEG * Math.cos(rad(origin[1]))), origin[1] + y / M_PER_DEG];
}

/** Rectangle orienté : côté a→b, largeur donnée par la distance de c à ce côté. */
export function rectFrom3(a: LngLat, b: LngLat, c: LngLat): LngLat[] {
  const [bx, by] = toLocal(a, b);
  const len = Math.hypot(bx, by);
  if (len === 0) return [a, a, a, a];
  const n: XY = [-by / len, bx / len];
  const [cx, cy] = toLocal(a, c);
  const h = cx * n[0] + cy * n[1];
  const v: XY = [n[0] * h, n[1] * h];
  return [
    [0, 0],
    [bx, by],
    [bx + v[0], by + v[1]],
    v,
  ].map((p) => fromLocal(a, p as XY));
}

/** Grille de rows × cols cellules dans le rectangle orienté (a, b, c), numérotée ligne par ligne. */
export function gridFrom3(a: LngLat, b: LngLat, c: LngLat, rows: number, cols: number): LngLat[][] {
  const [o, p1, , p3] = rectFrom3(a, b, c).map((p) => toLocal(a, p));
  const u: XY = [(p1[0] - o[0]) / cols, (p1[1] - o[1]) / cols];
  const v: XY = [(p3[0] - o[0]) / rows, (p3[1] - o[1]) / rows];
  const cells: LngLat[][] = [];
  for (let r = 0; r < rows; r++) {
    for (let k = 0; k < cols; k++) {
      const x = u[0] * k + v[0] * r;
      const y = u[1] * k + v[1] * r;
      cells.push(
        [
          [x, y],
          [x + u[0], y + u[1]],
          [x + u[0] + v[0], y + u[1] + v[1]],
          [x + v[0], y + v[1]],
        ].map((p) => fromLocal(a, p as XY)),
      );
    }
  }
  return cells;
}

/** Aire d'un anneau, en m². */
export function ringArea(ring: LngLat[]): number {
  const o = ring[0];
  const pts = ring.map((p) => toLocal(o, p));
  let sum = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    sum += x1 * y2 - x2 * y1;
  }
  return Math.abs(sum) / 2;
}

/** Centre de gravité d'un anneau (sans point de fermeture). */
export function ringCentroid(ring: LngLat[]): LngLat {
  const o = ring[0];
  const pts = ring.map((p) => toLocal(o, p));
  let area = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    const cross = x1 * y2 - x2 * y1;
    area += cross;
    cx += (x1 + x2) * cross;
    cy += (y1 + y2) * cross;
  }
  if (Math.abs(area) < 1e-9) {
    // Anneau dégénéré : moyenne des sommets
    const n = pts.length;
    return fromLocal(o, [pts.reduce((s, p) => s + p[0], 0) / n, pts.reduce((s, p) => s + p[1], 0) / n]);
  }
  return fromLocal(o, [cx / (3 * area), cy / (3 * area)]);
}

/** Longueur d'une polyligne, en mètres. */
export function lineLength(points: LngLat[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const [x, y] = toLocal(points[i - 1], points[i]);
    total += Math.hypot(x, y);
  }
  return total;
}

// ---------------------------------------------------------------------------
// Calage d'une image : 4 coins [haut-gauche, haut-droite, bas-droite, bas-gauche]
// ---------------------------------------------------------------------------

export type Corners = [LngLat, LngLat, LngLat, LngLat];

/** Position « rigide » d'une image : centre, largeur (m) et rotation (degrés, sens horaire). */
export type ImageTransform = { center: LngLat; width: number; rotation: number };

// Signes des coins dans le repère de l'image (x vers la droite, y vers le haut)
const CORNER_SIGNS: XY[] = [
  [-1, 1],
  [1, 1],
  [1, -1],
  [-1, -1],
];

function rotateCw([x, y]: XY, degrees: number): XY {
  const t = rad(degrees);
  return [x * Math.cos(t) + y * Math.sin(t), -x * Math.sin(t) + y * Math.cos(t)];
}

/** `aspect` = hauteur / largeur de l'image en pixels. */
export function transformToCorners(t: ImageTransform, aspect: number): Corners {
  const hw = t.width / 2;
  const hh = hw * aspect;
  return CORNER_SIGNS.map(([sx, sy]) => fromLocal(t.center, rotateCw([sx * hw, sy * hh], t.rotation))) as Corners;
}

export function cornersToTransform(c: Corners): ImageTransform {
  const center: LngLat = [
    (c[0][0] + c[1][0] + c[2][0] + c[3][0]) / 4,
    (c[0][1] + c[1][1] + c[2][1] + c[3][1]) / 4,
  ];
  const [vx, vy] = toLocal(c[0], c[1]);
  return { center, width: Math.hypot(vx, vy), rotation: -deg(Math.atan2(vy, vx)) };
}

/** Vrai si les coins forment le rectangle (non déformé) de l'image. */
export function isRigid(c: Corners, aspect: number): boolean {
  const t = cornersToTransform(c);
  const ideal = transformToCorners(t, aspect);
  const tolerance = Math.max(t.width * 0.01, 0.05);
  return c.every((p, i) => {
    const [x, y] = toLocal(ideal[i], p);
    return Math.hypot(x, y) <= tolerance;
  });
}

/** Redimensionne et tourne l'image autour de son centre pour amener le coin `index` sous `pointer`. */
export function dragCorner(t: ImageTransform, aspect: number, index: number, pointer: LngLat): ImageTransform {
  const [px, py] = toLocal(t.center, pointer);
  const [sx, sy] = CORNER_SIGNS[index];
  const baseAngle = Math.atan2(sy * aspect, sx);
  const rotation = -deg(Math.atan2(py, px) - baseAngle);
  const width = (2 * Math.hypot(px, py)) / Math.sqrt(1 + aspect * aspect);
  return { center: t.center, width: Math.max(width, 1), rotation: normalizeAngle(rotation) };
}

/** Rapport hauteur / largeur déduit des coins (exact si l'image n'est pas déformée). */
export function cornersAspect(c: Corners): number {
  const [wx, wy] = toLocal(c[0], c[1]);
  const [hx, hy] = toLocal(c[0], c[3]);
  const width = Math.hypot(wx, wy);
  return width > 0 ? Math.hypot(hx, hy) / width : 1;
}

export function normalizeAngle(degrees: number): number {
  const a = ((degrees + 180) % 360 + 360) % 360 - 180;
  return Object.is(a, -0) ? 0 : a;
}

export function parseCorners(json: unknown): Corners | null {
  if (!Array.isArray(json) || json.length !== 4) return null;
  const ok = json.every(
    (p) => Array.isArray(p) && p.length === 2 && p.every((v) => typeof v === "number" && Number.isFinite(v)),
  );
  return ok ? (json as Corners) : null;
}
