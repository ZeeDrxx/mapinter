"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import type { Map as MapLibreMap, MapOptions } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { mapPalette } from "@/lib/theme";

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

    import("maplibre-gl").then(({ Map, NavigationControl, setWorkerUrl, getVersion }) => {
      const container = containerRef.current;
      if (cancelled || !container) return;
      // Worker servi depuis public/ (copié par scripts/copy-maplibre-worker.mjs) ; la version évite un cache périmé
      setWorkerUrl(`${window.location.origin}/vendor/maplibre-gl-worker.mjs?v=${getVersion()}`);
      instance = new Map({
        container,
        // Fond OpenStreetMap sobre (OpenFreeMap, sans clé), clair ou sombre selon le système
        style: mapPalette().basemap,
        attributionControl: { compact: true },
        ...initialOptions.current,
      });
      instance.addControl(new NavigationControl({ showCompass: false }), "top-right");
      // Le fond de carte cite des motifs qu'il ne fournit pas (« wood-pattern ») : on les remplace par du vide
      instance.setMissingStyleImageResolver((id) => {
        if (!instance!.hasImage(id)) instance!.addImage(id, { width: 1, height: 1, data: new Uint8Array(4) });
      });
      instance.on("load", () => {
        if (cancelled) return;
        // Mention des sources repliée en « i » : elle s'étalait sur toute la largeur sur mobile
        container.querySelector(".maplibregl-ctrl-attrib")?.classList.remove("maplibregl-compact-show");
        // Le cadrage initial est calculé à la création, parfois avant que le conteneur ait sa taille finale
        const { bounds, fitBoundsOptions } = initialOptions.current;
        if (bounds) instance!.fitBounds(bounds, { ...fitBoundsOptions, animate: false });
        setMap(instance!);
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
