"use client";

import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import type { GeoJSONSource, Map as MapLibreMap, MapMouseEvent } from "maplibre-gl";
import type { FeatureCollection } from "geojson";
import { useMapLibre } from "@/components/map/use-maplibre";
import { PLAN_FILL, setPlanFeatures, setPlanImage, type PlanImage } from "@/components/map/plan-layers";
import { poiAt, setPois } from "@/components/map/poi-layers";
import {
  POI_CATEGORIES,
  POI_CATEGORY_IDS,
  POI_STATUSES,
  poiTitle,
  searchPois,
  type Poi,
  type PoiCategory,
} from "@/lib/poi";
import { fromLocal, type PlanCollection } from "@/lib/plan";
import type { BBox, LngLat } from "@/lib/geo";

const POI_PARAM = "lieu";
/** Au-delà, la position GPS est signalée comme approximative. */
const GOOD_ACCURACY_M = 30;
/** Hauteur réservée à la fiche du lieu, pour centrer la carte au-dessus. */
const SHEET_PADDING = 240;

type Geo = { position: LngLat; accuracy: number };

// ---------------------------------------------------------------------------
// Position de l'utilisateur
// ---------------------------------------------------------------------------

const ME_SOURCE = "me";

function circleRing(center: LngLat, radius: number, steps = 64): LngLat[] {
  return Array.from({ length: steps + 1 }, (_, i) => {
    const a = (i / steps) * Math.PI * 2;
    return fromLocal(center, [Math.cos(a) * radius, Math.sin(a) * radius]);
  });
}

function setMe(map: MapLibreMap, geo: Geo | null) {
  const data: FeatureCollection = {
    type: "FeatureCollection",
    features: geo
      ? [
          {
            type: "Feature",
            properties: { kind: "accuracy" },
            geometry: { type: "Polygon", coordinates: [circleRing(geo.position, geo.accuracy)] },
          },
          { type: "Feature", properties: { kind: "dot" }, geometry: { type: "Point", coordinates: geo.position } },
        ]
      : [],
  };
  const source = map.getSource<GeoJSONSource>(ME_SOURCE);
  if (source) {
    source.setData(data);
    return;
  }
  map.addSource(ME_SOURCE, { type: "geojson", data });
  map.addLayer({
    id: `${ME_SOURCE}-accuracy`,
    type: "fill",
    source: ME_SOURCE,
    filter: ["==", ["get", "kind"], "accuracy"],
    paint: { "fill-color": "#2563eb", "fill-opacity": 0.12, "fill-outline-color": "#2563eb" },
  });
  map.addLayer({
    id: `${ME_SOURCE}-dot`,
    type: "circle",
    source: ME_SOURCE,
    filter: ["==", ["get", "kind"], "dot"],
    paint: { "circle-radius": 7, "circle-color": "#2563eb", "circle-stroke-color": "#ffffff", "circle-stroke-width": 3 },
  });
}

function inside(b: BBox, [lng, lat]: LngLat, margin = 0) {
  const dx = (b[2] - b[0]) * margin;
  const dy = (b[3] - b[1]) * margin;
  return lng >= b[0] - dx && lng <= b[2] + dx && lat >= b[1] - dy && lat <= b[3] + dy;
}

// ---------------------------------------------------------------------------

export function VisitorMap({
  event,
  image,
  plan,
  pois,
  initialPoiId = null,
}: {
  event: { name: string; bbox: BBox; isPublished: boolean };
  image: PlanImage | null;
  plan: PlanCollection | null;
  pois: Poi[];
  initialPoiId?: string | null;
}) {
  const { bbox } = event;
  const containerRef = useRef<HTMLDivElement>(null);
  const map = useMapLibre(containerRef, {
    bounds: [
      [bbox[0], bbox[1]],
      [bbox[2], bbox[3]],
    ],
    fitBoundsOptions: { padding: 24 },
  });

  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [filters, setFilters] = useState<Set<PoiCategory>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(
    initialPoiId && pois.some((p) => p.id === initialPoiId) ? initialPoiId : null,
  );
  const [geo, setGeo] = useState<Geo | null>(null);
  const [locating, setLocating] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const watchId = useRef<number | null>(null);

  const selected = pois.find((p) => p.id === selectedId) ?? null;
  const visible = useMemo(
    () => (filters.size ? pois.filter((p) => filters.has(p.category)) : pois),
    [pois, filters],
  );
  const categories = POI_CATEGORY_IDS.filter((c) => pois.some((p) => p.category === c));
  const results = searchOpen ? searchPois(pois, query) : [];

  // --- Carte ------------------------------------------------------------------

  // On empêche de s'éloigner du site (zone + sa taille de chaque côté)
  useEffect(() => {
    if (!map) return;
    const dx = bbox[2] - bbox[0];
    const dy = bbox[3] - bbox[1];
    map.setMaxBounds([
      [bbox[0] - dx, bbox[1] - dy],
      [bbox[2] + dx, bbox[3] + dy],
    ]);
  }, [map, bbox]);

  useEffect(() => {
    if (!map) return;
    setPlanImage(map, image);
    if (plan) setPlanFeatures(map, plan);
  }, [map, image, plan]);

  useEffect(() => {
    if (map) setPois(map, visible, selectedId);
  }, [map, visible, selectedId]);

  useEffect(() => {
    if (map) setMe(map, geo);
  }, [map, geo]);

  function select(poi: Poi | null, { fly = true } = {}) {
    setSelectedId(poi?.id ?? null);
    const url = new URL(window.location.href);
    if (poi) url.searchParams.set(POI_PARAM, poi.id);
    else url.searchParams.delete(POI_PARAM);
    window.history.replaceState(null, "", url);
    if (poi && fly && map) {
      map.easeTo({
        center: [poi.lng, poi.lat],
        zoom: Math.max(map.getZoom(), 18),
        padding: { top: 0, bottom: SHEET_PADDING, left: 0, right: 0 },
      });
    }
  }

  // Lien partagé (/e/slug?lieu=<id>) : centre la carte sur le lieu à l'ouverture
  const centerOnInitial = useEffectEvent(() => {
    if (!map || !selected) return;
    map.jumpTo({
      center: [selected.lng, selected.lat],
      zoom: 18,
      padding: { top: 0, bottom: SHEET_PADDING, left: 0, right: 0 },
    });
  });
  useEffect(() => {
    if (map) centerOnInitial();
  }, [map]);

  const onClick = useEffectEvent((e: MapMouseEvent) => {
    if (!map) return;
    setSearchOpen(false);
    const id = poiAt(map, e.point);
    if (id) {
      select(pois.find((p) => p.id === id) ?? null, { fly: false });
      return;
    }
    // Un clic sur un stand dessiné ouvre le lieu associé
    if (map.getLayer(PLAN_FILL)) {
      const featureId = map.queryRenderedFeatures(e.point, { layers: [PLAN_FILL] })[0]?.properties?.id;
      const poi = featureId && visible.find((p) => p.featureId === featureId);
      if (poi) {
        select(poi, { fly: false });
        return;
      }
    }
    select(null);
  });
  const onMove = useEffectEvent((e: MapMouseEvent) => {
    if (map) map.getCanvas().style.cursor = poiAt(map, e.point) ? "pointer" : "";
  });

  useEffect(() => {
    if (!map) return;
    map.on("click", onClick);
    map.on("mousemove", onMove);
    return () => {
      map.off("click", onClick);
      map.off("mousemove", onMove);
    };
  }, [map]);

  // --- Localisation -------------------------------------------------------------

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(
    () => () => {
      if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    },
    [],
  );

  function locate() {
    if (geo && map) {
      map.easeTo({ center: geo.position, zoom: Math.max(map.getZoom(), 18) });
      return;
    }
    if (!window.isSecureContext || !("geolocation" in navigator)) {
      setToast("La localisation n'est pas disponible sur cette connexion (https requis).");
      return;
    }
    setLocating(true);
    let first = true;
    watchId.current = navigator.geolocation.watchPosition(
      ({ coords }) => {
        const next: Geo = { position: [coords.longitude, coords.latitude], accuracy: coords.accuracy };
        setGeo(next);
        setLocating(false);
        if (!first) return;
        first = false;
        if (!inside(bbox, next.position, 0.5)) {
          setToast("Vous semblez être en dehors du site.");
        } else {
          map?.easeTo({ center: next.position, zoom: Math.max(map.getZoom(), 18) });
          if (next.accuracy > GOOD_ACCURACY_M) {
            setToast(`Position approximative (± ${Math.round(next.accuracy)} m), fréquent en intérieur.`);
          }
        }
      },
      (err) => {
        setLocating(false);
        if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
        watchId.current = null;
        setToast(
          err.code === err.PERMISSION_DENIED
            ? "Autorisez la localisation dans votre navigateur pour vous situer."
            : "Impossible d'obtenir votre position pour le moment.",
        );
      },
      { enableHighAccuracy: true, maximumAge: 5_000, timeout: 20_000 },
    );
  }

  // --- Rendu --------------------------------------------------------------------

  function toggleFilter(c: PoiCategory) {
    const next = new Set(filters);
    if (next.has(c)) next.delete(c);
    else next.add(c);
    setFilters(next);
    // Le lieu ouvert disparaît s'il n'est plus dans les catégories filtrées
    if (selected && next.size > 0 && !next.has(selected.category)) select(null);
  }

  async function share(poi: Poi) {
    const url = window.location.href;
    const title = `${poiTitle(poi)} · ${event.name}`;
    try {
      if (navigator.share) await navigator.share({ title, url });
      else {
        await navigator.clipboard.writeText(url);
        setToast("Lien copié.");
      }
    } catch {
      // Partage annulé par l'utilisateur
    }
  }

  return (
    <div className="fixed inset-0 overflow-hidden bg-zinc-100 dark:bg-zinc-900">
      <div ref={containerRef} className="absolute inset-0" />
      {!map && (
        <div className="absolute inset-0 grid place-items-center text-sm text-zinc-500">Chargement de la carte…</div>
      )}

      {/* En-tête : recherche + filtres */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-col gap-2 p-3">
        {!event.isPublished && (
          <p className="pointer-events-auto mx-auto rounded-full bg-amber-500 px-3 py-1 text-xs font-semibold text-white shadow">
            Aperçu organisateur · non publié
          </p>
        )}
        <div className="pointer-events-auto relative mx-auto w-full max-w-md">
          <div className="rounded-2xl bg-white shadow-lg ring-1 ring-black/5 dark:bg-zinc-900 dark:ring-white/10">
            <p className="truncate px-4 pt-2.5 text-xs font-semibold text-blue-600">{event.name}</p>
            <input
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSearchOpen(true);
              }}
              onFocus={() => setSearchOpen(true)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && results[0]) {
                  select(results[0]);
                  setSearchOpen(false);
                  e.currentTarget.blur();
                }
                if (e.key === "Escape") setSearchOpen(false);
              }}
              placeholder="Rechercher un stand, un lieu…"
              aria-label="Rechercher un lieu"
              className="w-full rounded-b-2xl bg-transparent px-4 pt-0.5 pb-3 text-base outline-none"
            />
          </div>
          {results.length > 0 && (
            <ul className="absolute inset-x-0 mt-2 max-h-[50dvh] overflow-y-auto rounded-2xl bg-white py-1 shadow-lg ring-1 ring-black/5 dark:bg-zinc-900 dark:ring-white/10">
              {results.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => {
                      select(p);
                      setSearchOpen(false);
                    }}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  >
                    <span className="size-3 shrink-0 rounded-full" style={{ background: POI_CATEGORIES[p.category].color }} />
                    <span className="flex-1 truncate text-sm">{poiTitle(p)}</span>
                    <span className="text-xs text-zinc-500">{POI_CATEGORIES[p.category].label}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {searchOpen && query.trim() && results.length === 0 && (
            <p className="absolute inset-x-0 mt-2 rounded-2xl bg-white px-4 py-3 text-sm text-zinc-500 shadow-lg dark:bg-zinc-900">
              Aucun lieu ne correspond.
            </p>
          )}
        </div>

        {categories.length > 1 && (
          <div className="pointer-events-auto mx-auto flex w-full max-w-md gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
            {categories.map((c) => {
              const active = filters.has(c);
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => toggleFilter(c)}
                  aria-pressed={active}
                  className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium shadow ring-1 ring-black/5 ${
                    active ? "text-white" : "bg-white text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
                  }`}
                  style={active ? { background: POI_CATEGORIES[c].color } : undefined}
                >
                  {!active && <span className="size-2.5 rounded-full" style={{ background: POI_CATEGORIES[c].color }} />}
                  {POI_CATEGORIES[c].plural}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Bouton de localisation */}
      <button
        type="button"
        onClick={locate}
        aria-label="Me localiser"
        className="absolute right-3 grid size-12 place-items-center rounded-full bg-white text-blue-600 shadow-lg ring-1 ring-black/5 transition-[bottom] dark:bg-zinc-900"
        style={{ bottom: selected ? SHEET_PADDING - 24 : 24 }}
      >
        {locating ? (
          <span className="size-5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
        ) : (
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="4" fill={geo ? "currentColor" : "none"} />
            <path d="M12 2v3M12 19v3M2 12h3M19 12h3" strokeLinecap="round" />
          </svg>
        )}
      </button>

      {/* Message temporaire */}
      {toast && (
        <p
          role="status"
          className="absolute inset-x-3 mx-auto max-w-md rounded-xl bg-zinc-900/90 px-4 py-2.5 text-center text-sm text-white shadow-lg"
          style={{ bottom: selected ? SHEET_PADDING + 40 : 88 }}
        >
          {toast}
        </p>
      )}

      {/* Fiche du lieu */}
      {selected && (
        <section
          aria-label={poiTitle(selected)}
          className="absolute inset-x-0 bottom-0 mx-auto max-h-[60dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-[0_-8px_30px_rgba(0,0,0,0.12)] dark:bg-zinc-900"
        >
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
                <span className="flex items-center gap-1.5 text-zinc-500">
                  <span className="size-2.5 rounded-full" style={{ background: POI_CATEGORIES[selected.category].color }} />
                  {POI_CATEGORIES[selected.category].label}
                </span>
                {selected.status !== "open" && (
                  <span className={`rounded-full px-2 py-0.5 ${POI_STATUSES[selected.status].className}`}>
                    {POI_STATUSES[selected.status].label}
                  </span>
                )}
              </div>
              <h2 className="mt-1 text-xl font-bold">
                {selected.code && selected.code !== selected.name && (
                  <span className="mr-2 rounded-md bg-zinc-100 px-1.5 py-0.5 font-mono text-base dark:bg-zinc-800">
                    {selected.code}
                  </span>
                )}
                {selected.name}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => select(null)}
              aria-label="Fermer"
              className="grid size-8 shrink-0 place-items-center rounded-full bg-zinc-100 text-zinc-500 dark:bg-zinc-800"
            >
              ✕
            </button>
          </div>
          {selected.description && (
            <p className="mt-3 text-sm whitespace-pre-line text-zinc-600 dark:text-zinc-300">{selected.description}</p>
          )}
          <div className="mt-4 flex gap-2">
            <button type="button" onClick={() => share(selected)} className="btn-secondary flex-1">
              Partager
            </button>
          </div>
        </section>
      )}

      {pois.length === 0 && map && (
        <p className="absolute inset-x-3 bottom-6 mx-auto max-w-md rounded-xl bg-white px-4 py-3 text-center text-sm text-zinc-500 shadow-lg dark:bg-zinc-900">
          Le plan de cet event est en cours de préparation.
        </p>
      )}
    </div>
  );
}
