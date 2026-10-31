"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import type { Map as MapLibreMap, MapOptions } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

// Fond de carte OpenStreetMap vectoriel, gratuit et sans clé (OpenFreeMap).
export const BASE_STYLE = "https://tiles.openfreemap.org/styles/liberty";

type InitOptions = Pick<MapOptions, "center" | "zoom" | "bounds" | "fitBoundsOptions">;

/**
 * Crée une carte MapLibre dans `containerRef` et la renvoie une fois le style chargé.
 * MapLibre est importé dynamiquement : il dépend de `window` et ne doit pas tourner côté serveur.
 * Les options ne sont lues qu'à la création.
 */
export function useMapLibre(
  containerRef: RefObject<HTMLDivElement | null>,
  options: InitOptions,
): MapLibreMap | null {
  const [map, setMap] = useState<MapLibreMap | null>(null);
  const initialOptions = useRef(options);

  useEffect(() => {
    let cancelled = false;
    let instance: MapLibreMap | undefined;

    import("maplibre-gl").then(({ Map, NavigationControl }) => {
      const container = containerRef.current;
      if (cancelled || !container) return;
      instance = new Map({
        container,
        style: BASE_STYLE,
        attributionControl: { compact: true },
        ...initialOptions.current,
      });
      instance.addControl(new NavigationControl(), "top-right");
      instance.on("load", () => {
        if (!cancelled) setMap(instance!);
      });
    });

    return () => {
      cancelled = true;
      instance?.remove();
      setMap(null);
    };
  }, [containerRef]);

  return map;
}
