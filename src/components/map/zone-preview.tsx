"use client";

import { useEffect, useRef } from "react";
import { useMapLibre } from "./use-maplibre";
import { setZone } from "./zone-layer";
import { setPlanFeatures, setPlanImage, type PlanImage } from "./plan-layers";
import type { BBox } from "@/lib/geo";
import type { PlanCollection } from "@/lib/plan";
import type { Poi } from "@/lib/poi";
import { setPois } from "./poi-layers";

/** Carte en lecture seule centrée sur la zone d'un event, avec son plan s'il existe. */
export function ZonePreview({
  bbox,
  image = null,
  plan = null,
  pois = null,
  className,
}: {
  bbox: BBox;
  image?: PlanImage | null;
  plan?: PlanCollection | null;
  pois?: Poi[] | null;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const map = useMapLibre(containerRef, {
    bounds: [
      [bbox[0], bbox[1]],
      [bbox[2], bbox[3]],
    ],
    fitBoundsOptions: { padding: 32 },
  });

  useEffect(() => {
    if (!map) return;
    setZone(map, bbox);
    setPlanImage(map, image);
    if (plan) setPlanFeatures(map, plan);
    if (pois) setPois(map, pois);
  }, [map, bbox, image, plan, pois]);

  return (
    <div className={`relative overflow-hidden rounded-sign bg-paper-2 ${className ?? ""}`}>
      <div ref={containerRef} className="map-fill absolute inset-0" />
    </div>
  );
}
