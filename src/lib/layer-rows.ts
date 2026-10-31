// Conversion des lignes de la table `layers` en plan affichable (serveur, navigateur et temps réel).
import { parseCorners, parsePlan, type Corners, type PlanCollection } from "@/lib/plan";

export const LAYERS_BUCKET = "layers";
export const LAYER_COLUMNS = "id, kind, image_path, corners, features, opacity";

export type ImageLayer = { id: string; path: string; url: string; corners: Corners; opacity: number };
export type DrawnLayer = { id: string; features: PlanCollection };
export type EventPlan = { image: ImageLayer | null; drawn: DrawnLayer | null };

export type LayerRow = {
  id: string;
  kind: string;
  image_path: string | null;
  corners: unknown;
  features: unknown;
  opacity: number;
};

type PublicUrl = (path: string) => string;

/** Applique une ligne (création ou modification) au plan courant. */
export function applyLayerRow(plan: EventPlan, row: LayerRow, publicUrl: PublicUrl): EventPlan {
  if (row.kind === "image") {
    const corners = parseCorners(row.corners);
    if (!row.image_path || !corners) return plan;
    // Un seul calque image pour le MVP : on garde le premier
    if (plan.image && plan.image.id !== row.id) return plan;
    return {
      ...plan,
      image: { id: row.id, path: row.image_path, url: publicUrl(row.image_path), corners, opacity: row.opacity },
    };
  }
  if (row.kind === "drawn") {
    if (plan.drawn && plan.drawn.id !== row.id) return plan;
    return { ...plan, drawn: { id: row.id, features: parsePlan(row.features) } };
  }
  return plan;
}

export function removeLayer(plan: EventPlan, id: string): EventPlan {
  return {
    image: plan.image?.id === id ? null : plan.image,
    drawn: plan.drawn?.id === id ? null : plan.drawn,
  };
}

/** Lignes triées par sort_order puis date de création. */
export function rowsToPlan(rows: LayerRow[], publicUrl: PublicUrl): EventPlan {
  return rows.reduce<EventPlan>((plan, row) => applyLayerRow(plan, row, publicUrl), { image: null, drawn: null });
}
