"use client";

import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import type { GeoJSONSource, Map as MapLibreMap, MapMouseEvent } from "maplibre-gl";
import type { FeatureCollection } from "geojson";
import { useMapLibre } from "@/components/map/use-maplibre";
import { PLAN_FILL, setPlanFeatures, setPlanImage, type PlanImage } from "@/components/map/plan-layers";
import { poiAt, setPois } from "@/components/map/poi-layers";
import { setGuide, setHere } from "@/components/map/anchor-layers";
import { Pictogram } from "@/components/ui/pictogram";
import { StatusMark } from "@/components/ui/status";
import { POI_CATEGORIES, POI_CATEGORY_IDS, poiTitle, searchPois, type Poi, type PoiCategory } from "@/lib/poi";
import { emptyPlan, fromLocal, type PlanCollection } from "@/lib/plan";
import { mapPalette } from "@/lib/theme";
import type { Anchor } from "@/lib/anchor";
import {
  bearingDegrees,
  cardinal,
  distanceMeters,
  formatMeters,
  walkingMinutes,
  type BBox,
  type LngLat,
} from "@/lib/geo";
import { useLiveEvent, type LiveData } from "./use-live-event";
import { AnnouncementBanner } from "./announcement-banner";

const POI_PARAM = "lieu";
/** Au-delà, la position GPS est signalée comme approximative. */
const GOOD_ACCURACY_M = 30;
/** En deçà, le GPS est préféré au dernier QR scanné (qui vieillit dès qu'on marche). */
const PRECISE_GPS_M = 15;
/** Hauteur réservée à la fiche du lieu, pour centrer la carte au-dessus (mobile). */
const SHEET_PADDING = 260;

type Geo = { position: LngLat; accuracy: number };

// ---------------------------------------------------------------------------
// Position GPS de l'utilisateur
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
  const c = mapPalette();
  map.addSource(ME_SOURCE, { type: "geojson", data });
  map.addLayer({
    id: `${ME_SOURCE}-accuracy`,
    type: "fill",
    source: ME_SOURCE,
    filter: ["==", ["get", "kind"], "accuracy"],
    paint: { "fill-color": c.signal, "fill-opacity": 0.1 },
  });
  map.addLayer({
    id: `${ME_SOURCE}-dot`,
    type: "circle",
    source: ME_SOURCE,
    filter: ["==", ["get", "kind"], "dot"],
    paint: { "circle-radius": 7, "circle-color": c.signal, "circle-stroke-color": c.paper, "circle-stroke-width": 3 },
  });
}

/** Distance, direction et temps de marche à vol d'oiseau (en attendant le calcul d'itinéraire). */
function describeRoute(from: LngLat, to: LngLat) {
  const meters = distanceMeters(from, to);
  const bearing = bearingDegrees(from, to);
  return { meters, bearing, direction: cardinal(bearing), minutes: walkingMinutes(meters) };
}

/** Emprise des éléments dessinés, ou null si le plan est vide. */
function planExtent(plan: PlanCollection): BBox | null {
  const points = plan.features.flatMap((f) =>
    f.geometry.type === "Polygon" ? (f.geometry.coordinates[0] as LngLat[]) : (f.geometry.coordinates as LngLat[]),
  );
  if (!points.length) return null;
  return [
    Math.min(...points.map((p) => p[0])),
    Math.min(...points.map((p) => p[1])),
    Math.max(...points.map((p) => p[0])),
    Math.max(...points.map((p) => p[1])),
  ];
}

/** « vers le nord », « vers l'est » */
function towards(direction: string) {
  return /^[eo]/.test(direction) ? `vers l'${direction}` : `vers le ${direction}`;
}

function inside(b: BBox, [lng, lat]: LngLat, margin = 0) {
  const dx = (b[2] - b[0]) * margin;
  const dy = (b[3] - b[1]) * margin;
  return lng >= b[0] - dx && lng <= b[2] + dx && lat >= b[1] - dy && lat <= b[3] + dy;
}

// ---------------------------------------------------------------------------

export function VisitorMap({
  event,
  initial,
  initialPoiId = null,
  here = null,
}: {
  event: { id: string; name: string; bbox: BBox; isPublished: boolean };
  /** Données rendues côté serveur, ensuite tenues à jour en direct. */
  initial: LiveData;
  initialPoiId?: string | null;
  /** Ancre QR scannée pour ouvrir la carte. */
  here?: Anchor | null;
}) {
  const { bbox } = event;
  const { pois, plan: livePlan, announcements, live } = useLiveEvent(event.id, initial);
  const image = useMemo<PlanImage | null>(
    () => livePlan.image && { url: livePlan.image.url, corners: livePlan.image.corners, opacity: livePlan.image.opacity },
    [livePlan.image],
  );
  const plan = livePlan.drawn?.features ?? null;
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
  const overlayRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);

  /** Marges de cadrage : la carte se centre dans la partie que les panneaux ne couvrent pas. */
  function overlayPadding(sheetOpen: boolean) {
    const r = overlayRef.current?.getBoundingClientRect();
    if (window.matchMedia("(min-width: 768px)").matches) {
      return { top: 48, bottom: 48, left: (r?.right ?? 416) + 40, right: 72 };
    }
    // Fiche ouverte : filtres et annonces sont masqués, seul l'en-tête reste
    const top = sheetOpen ? headerRef.current?.getBoundingClientRect().bottom : r?.bottom;
    return { top: (top ?? 160) + 20, bottom: sheetOpen ? SHEET_PADDING + 24 : 80, left: 24, right: 24 };
  }

  const selected = pois.find((p) => p.id === selectedId) ?? null;
  const visible = useMemo(
    () => (filters.size ? pois.filter((p) => filters.has(p.category)) : pois),
    [pois, filters],
  );
  const categories = POI_CATEGORY_IDS.filter((c) => pois.some((p) => p.category === c));
  const results = searchOpen ? searchPois(pois, query) : [];

  // Point de départ du guidage : GPS s'il est très précis, sinon le dernier QR scanné, sinon un GPS correct
  const origin: LngLat | null =
    geo && geo.accuracy <= PRECISE_GPS_M
      ? geo.position
      : here
        ? [here.lng, here.lat]
        : geo && geo.accuracy <= GOOD_ACCURACY_M
          ? geo.position
          : null;
  const guidance = origin && selected ? describeRoute(origin, [selected.lng, selected.lat]) : null;

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

  const selectedFeatureId = selected?.featureId ?? null;
  useEffect(() => {
    if (!map) return;
    setPlanImage(map, image);
    setPlanFeatures(map, plan ?? emptyPlan(), selectedFeatureId);
  }, [map, image, plan, selectedFeatureId]);

  useEffect(() => {
    if (map) setPois(map, visible, selectedId);
  }, [map, visible, selectedId]);

  useEffect(() => {
    if (map) setMe(map, geo);
  }, [map, geo]);

  useEffect(() => {
    if (map) setHere(map, here);
  }, [map, here]);

  const originLng = origin?.[0];
  const originLat = origin?.[1];
  useEffect(() => {
    if (!map) return;
    const from: LngLat | null = originLng !== undefined && originLat !== undefined ? [originLng, originLat] : null;
    setGuide(map, from, selected ? [selected.lng, selected.lat] : null);
  }, [map, originLng, originLat, selected]);

  // Carte toujours orientée nord : la flèche de direction reste juste
  useEffect(() => {
    if (!map) return;
    map.dragRotate.disable();
    map.touchZoomRotate.disableRotation();
    map.keyboard.disableRotation();
  }, [map]);

  function select(poi: Poi | null, { fly = true } = {}) {
    setSelectedId(poi?.id ?? null);
    const url = new URL(window.location.href);
    if (poi) url.searchParams.set(POI_PARAM, poi.id);
    else url.searchParams.delete(POI_PARAM);
    window.history.replaceState(null, "", url);
    if (!map) return;
    // La marge des panneaux vit sur la carte (persistante) : les mouvements n'en ajoutent pas,
    // sinon fitBounds les cumule et dézoome.
    map.setPadding(overlayPadding(poi !== null));
    if (!poi || !fly) return;
    if (origin) {
      // Cadre le trajet entier : position du visiteur → lieu
      map.fitBounds(
        [
          [Math.min(origin[0], poi.lng), Math.min(origin[1], poi.lat)],
          [Math.max(origin[0], poi.lng), Math.max(origin[1], poi.lat)],
        ],
        { padding: 40, maxZoom: 19 },
      );
    } else {
      map.easeTo({ center: [poi.lng, poi.lat], zoom: Math.max(map.getZoom(), 18) });
    }
  }

  // Ouverture par un lien : sur le lieu partagé (?lieu=) ou sur le QR scanné (?ici=)
  const centerOnInitial = useEffectEvent(() => {
    if (!map) return;
    map.setPadding(overlayPadding(selected !== null));
    if (selected) {
      map.jumpTo({ center: [selected.lng, selected.lat], zoom: 18 });
    } else if (here) {
      map.jumpTo({ center: [here.lng, here.lat], zoom: 18 });
    } else {
      // Le plan dessiné plutôt que la zone (qui garde des marges) : le hall remplit l'écran
      const [w, s, e, n] = (plan && planExtent(plan)) ?? bbox;
      map.fitBounds(
        [
          [w, s],
          [e, n],
        ],
        { padding: 16, animate: false },
      );
    }
  });
  useEffect(() => {
    if (map) centerOnInitial();
  }, [map]);

  // Les panneaux changent de taille (annonce masquée, rotation de l'écran…) : la marge suit
  const syncPadding = useEffectEvent(() => {
    if (!map) return;
    const next = overlayPadding(selectedId !== null);
    const current = map.getPadding();
    const same = (["top", "bottom", "left", "right"] as const).every((k) => Math.abs((current[k] ?? 0) - next[k]) < 2);
    // Inchangée (cas d'une sélection, déjà posée par select) : ne pas couper l'animation en cours
    if (!same) map.easeTo({ padding: next, duration: 250 });
  });
  useEffect(() => {
    if (!map || !overlayRef.current) return;
    let first = true;
    const observer = new ResizeObserver(() => {
      // Le premier appel est immédiat et la marge vient d'être posée par centerOnInitial
      if (first) first = false;
      else syncPadding();
    });
    observer.observe(overlayRef.current);
    return () => observer.disconnect();
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
    if (!map) return;
    const overStand =
      map.getLayer(PLAN_FILL) &&
      map
        .queryRenderedFeatures(e.point, { layers: [PLAN_FILL] })
        .some((f) => visible.some((p) => p.featureId === f.properties?.id));
    map.getCanvas().style.cursor = poiAt(map, e.point) || overStand ? "pointer" : "";
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
      setToast("La localisation demande une connexion sécurisée (https).");
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
            setToast(`Position approximative (± ${Math.round(next.accuracy)} m), fréquent en intérieur. Scannez un QR code « Vous êtes ici ».`);
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
    const title = `${poiTitle(poi)} · ${event.name}`;
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
    <div className="fixed inset-0 overflow-hidden bg-paper">
      <div ref={containerRef} className="map-fill absolute inset-0" />
      {!map && (
        <div className="absolute inset-0 grid place-items-center">
          <p className="label">Chargement du plan…</p>
        </div>
      )}

      {/* Colonne : panneau d'en-tête, filtres, annonces */}
      <div ref={overlayRef} className="pointer-events-none absolute inset-x-0 top-0 flex flex-col gap-2 p-3 md:right-auto md:w-[400px] md:p-4">
        {!event.isPublished && (
          <p className="pointer-events-auto self-start rounded-sign bg-ink px-2.5 py-1 text-[11px] font-bold tracking-[0.14em] text-on-ink uppercase">
            Aperçu · non publié
          </p>
        )}

        <div ref={headerRef} className="pointer-events-auto relative">
          <div className="sheet-lift">
            <div className="flex items-center gap-3 px-4 pt-3">
              <h1 className="min-w-0 flex-1 truncate text-[15px] font-bold tracking-[-0.01em]">{event.name}</h1>
              <span className="flex items-center gap-1.5" title={live ? "Mises à jour en direct" : "Connexion au direct…"}>
                {live ? (
                  <span className="signal-dot signal-dot--live size-1.5" />
                ) : (
                  <span className="size-1.5 rounded-full border border-t4" />
                )}
                <span className={`label text-[10px] ${live ? "text-signal-ink" : "text-t4"}`}>
                  {live ? "En direct" : "Connexion"}
                </span>
              </span>
            </div>
            <label className="flex items-center gap-2.5 px-4 pt-1 pb-3">
              <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" className="shrink-0 text-t3" aria-hidden>
                <circle cx="8.5" cy="8.5" r="5.5" />
                <path d="m13 13 4 4" strokeLinecap="round" />
              </svg>
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
                placeholder="Un stand, un numéro, un service…"
                aria-label="Rechercher un lieu"
                className="min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-t4"
              />
            </label>
          </div>

          {results.length > 0 && (
            <ul className="sheet-lift rise absolute inset-x-0 z-10 mt-1.5 max-h-[55dvh] overflow-y-auto py-1.5">
              {results.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => {
                      select(p);
                      setSearchOpen(false);
                    }}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-paper-2"
                  >
                    {p.code ? <span className="plate w-11 text-[12px]">{p.code}</span> : <Pictogram category={p.category} size={26} className="mx-[9px]" />}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-semibold">{p.name}</span>
                      <span className="block text-[12px] text-t3">{POI_CATEGORIES[p.category].label}</span>
                    </span>
                    {p.status !== "open" && <StatusMark status={p.status} className="text-[12px]" />}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {searchOpen && query.trim() && results.length === 0 && (
            <p className="sheet-lift absolute inset-x-0 z-10 mt-1.5 px-4 py-3 text-[14px] text-t3">Aucun lieu ne correspond.</p>
          )}
        </div>

        {/* Sur mobile, une fiche ouverte libère la place : seule la recherche reste en haut */}
        <div className={`flex flex-col gap-2 ${selected ? "max-md:hidden" : ""}`}>
        {categories.length > 1 && (
          <div className="pointer-events-auto -mx-3 flex gap-1.5 overflow-x-auto px-3 pb-1 [scrollbar-width:none] md:mx-0 md:flex-wrap md:px-0">
            {categories.map((c) => {
              const active = filters.has(c);
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => toggleFilter(c)}
                  aria-pressed={active}
                  className={`flex shrink-0 items-center gap-2 rounded-sign py-1 pr-3 pl-1 text-[13px] font-semibold shadow-sheet transition-colors ${
                    active ? "bg-ink text-on-ink" : "bg-sheet text-t1 hover:bg-paper-2"
                  }`}
                >
                  <Pictogram category={c} size={22} tone={active ? "signal" : "ink"} />
                  {POI_CATEGORIES[c].plural}
                </button>
              );
            })}
          </div>
        )}

        <AnnouncementBanner announcements={announcements} />

        {here && (
          <p className="pointer-events-auto flex items-center gap-2.5 self-start rounded-sign bg-signal py-1.5 pr-3 pl-2 text-[13px] font-semibold text-on-signal shadow-sheet">
            <span className="grid size-4 place-items-center rounded-full bg-on-signal/25">
              <span className="size-1.5 rounded-full bg-on-signal" />
            </span>
            Vous êtes ici · {here.label}
          </p>
        )}
        </div>
      </div>

      {/* Bouton de localisation */}
      <button
        type="button"
        onClick={locate}
        aria-label="Me localiser"
        className="sheet-lift absolute right-3 grid size-11 place-items-center text-t1 transition-[bottom] duration-300 ease-sign md:right-4 md:bottom-6"
        style={{ bottom: selected ? SHEET_PADDING - 8 : 24 }}
      >
        {locating ? (
          <span className="size-4 animate-spin rounded-full border-2 border-t1 border-t-transparent" />
        ) : (
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
            <circle cx="12" cy="12" r="6.5" />
            <circle cx="12" cy="12" r="2.2" fill={geo ? "var(--signal)" : "currentColor"} stroke="none" />
            <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3" strokeLinecap="round" />
          </svg>
        )}
      </button>

      {/* Message temporaire */}
      {toast && (
        <p
          role="status"
          className="rise absolute inset-x-3 mx-auto max-w-sm rounded-sign bg-ink px-4 py-3 text-center text-[13.5px] text-on-ink shadow-lift md:inset-x-auto md:left-4 md:mx-0 md:w-[400px] md:max-w-none"
          style={{ bottom: selected ? SHEET_PADDING + 52 : 84 }}
        >
          {toast}
        </p>
      )}

      {/* Fiche du lieu */}
      {selected && (
        <section
          key={selected.id}
          aria-label={poiTitle(selected)}
          className="sheet-lift rise absolute inset-x-0 bottom-0 max-h-[62dvh] overflow-y-auto rounded-b-none px-5 pt-2.5 pb-[max(1.25rem,env(safe-area-inset-bottom))] md:inset-x-auto md:bottom-4 md:left-4 md:w-[400px] md:rounded-sign md:pt-5"
        >
          <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-hair-strong md:hidden" aria-hidden />
          <div className="flex items-start gap-3">
            <Pictogram category={selected.category} size={30} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="label">{POI_CATEGORIES[selected.category].label}</span>
                <StatusMark status={selected.status} className="text-[12px]" />
              </div>
              <h2 className="mt-1 text-[20px] leading-tight font-bold tracking-[-0.02em]">
                {selected.code && selected.code !== selected.name && (
                  <span className="plate mr-2 align-[2px] text-[13px]">{selected.code}</span>
                )}
                {selected.name}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => select(null)}
              aria-label="Fermer"
              className="btn btn-ghost btn-icon -mt-1 -mr-2 size-9 min-h-0"
            >
              <svg viewBox="0 0 16 16" width="14" height="14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
                <path d="m3.5 3.5 9 9m0-9-9 9" />
              </svg>
            </button>
          </div>

          {guidance && (
            <div className="mt-4 flex items-center gap-4 rounded-sign bg-paper-2 p-3">
              <span className="grid size-12 shrink-0 place-items-center rounded-sign bg-signal text-on-signal">
                {guidance.meters < 5 ? (
                  <span className="size-3 rounded-full bg-on-signal" />
                ) : (
                  <svg viewBox="0 0 24 24" width="26" height="26" style={{ transform: `rotate(${guidance.bearing}deg)` }} aria-hidden>
                    <path d="M12 3v18M12 3l-6 6M12 3l6 6" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </span>
              {guidance.meters < 5 ? (
                <p className="text-[17px] font-bold">Vous y êtes</p>
              ) : (
                <div className="min-w-0">
                  <p className="num flex items-baseline gap-2">
                    <span className="text-[24px] leading-none font-extrabold tracking-[-0.03em]">
                      {formatMeters(guidance.meters)}
                    </span>
                    <span className="text-[13px] font-semibold text-t2">~{guidance.minutes} min</span>
                  </p>
                  <p className="mt-1 text-[12.5px] text-t3">{towards(guidance.direction)} · à vol d&apos;oiseau</p>
                </div>
              )}
            </div>
          )}

          {selected.description && (
            <p className="mt-4 text-[14.5px] leading-relaxed whitespace-pre-line text-t2">{selected.description}</p>
          )}

          <div className="mt-5 flex gap-2">
            <button type="button" onClick={() => share(selected)} className="btn btn-secondary flex-1">
              <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M10 3v10M6 7l4-4 4 4M4 12v4h12v-4" />
              </svg>
              Partager
            </button>
          </div>
          {!origin && (
            <p className="fine mt-3">
              Scannez un QR code « Vous êtes ici » ou activez la localisation pour voir la distance.
            </p>
          )}
        </section>
      )}

      {pois.length === 0 && map && (
        <p className="sheet absolute inset-x-3 bottom-6 mx-auto max-w-sm px-4 py-3 text-center text-[14px] text-t3 md:left-4 md:mx-0">
          Le plan de cet event est en cours de préparation.
        </p>
      )}
    </div>
  );
}
