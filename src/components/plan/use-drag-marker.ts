"use client";

import { useEffect, useEffectEvent, useRef } from "react";
import type { Map as MapLibreMap, Marker } from "maplibre-gl";
import type { LngLat } from "@/lib/geo";

type Item = { id: string; lng: number; lat: number };

/** Poignée déplaçable posée sur l'élément sélectionné ; `onMove` est appelé au lâcher. */
export function useDragMarker(
  map: MapLibreMap,
  selected: Item | null,
  onMove: (id: string, position: LngLat) => void,
  className: string,
) {
  const marker = useRef<Marker | null>(null);
  const selectedId = selected?.id ?? null;
  const currentPosition = useEffectEvent((): LngLat | null => (selected ? [selected.lng, selected.lat] : null));
  const handleDragEnd = useEffectEvent((id: string, position: LngLat) => onMove(id, position));
  const getClassName = useEffectEvent(() => className);

  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    import("maplibre-gl").then(({ Marker }) => {
      const pos = currentPosition();
      if (cancelled || !pos) return;
      const el = document.createElement("div");
      el.className = getClassName();
      el.title = "Glisser pour déplacer";
      const m = new Marker({ element: el, draggable: true }).setLngLat(pos).addTo(map);
      m.on("dragend", () => {
        const p = m.getLngLat();
        handleDragEnd(selectedId, [p.lng, p.lat]);
      });
      marker.current = m;
    });
    return () => {
      cancelled = true;
      marker.current?.remove();
      marker.current = null;
    };
  }, [map, selectedId]);

  // Suit l'élément s'il bouge par ailleurs (annulation, autre onglet…)
  const lng = selected?.lng;
  const lat = selected?.lat;
  useEffect(() => {
    if (lng !== undefined && lat !== undefined) marker.current?.setLngLat([lng, lat]);
  }, [lng, lat]);
}
