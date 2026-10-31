"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useMapLibre } from "@/components/map/use-maplibre";
import { setZone } from "@/components/map/zone-layer";
import { setPlanFeatures, setPlanImage } from "@/components/map/plan-layers";
import { setPois as renderPois } from "@/components/map/poi-layers";
import { createClient } from "@/lib/supabase/client";
import { loadImageSize } from "@/lib/image";
import { cornersAspect, emptyPlan, type PlanCollection } from "@/lib/plan";
import type { Poi } from "@/lib/poi";
import type { BBox } from "@/lib/geo";
import type { DrawnLayer, ImageLayer } from "@/lib/layers";
import type { Json } from "@/lib/database.types";
import { ImagePanel } from "./image-panel";
import { DrawPanel } from "./draw-panel";
import { PoiPanel } from "./poi-panel";
import { AnchorPanel } from "./anchor-panel";
import type { Anchor } from "@/lib/anchor";

/** Calque image en cours d'édition ; `aspect` = hauteur / largeur en pixels, connu après chargement. */
export type EditorImage = ImageLayer & { aspect: number | null };

export type EditorTab = "image" | "draw" | "pois" | "qr";
type SaveState = "idle" | "saving" | "saved" | "error";

const HISTORY_LIMIT = 100;

const TABS: [EditorTab, string][] = [
  ["image", "Image"],
  ["draw", "Dessin"],
  ["pois", "Lieux"],
  ["qr", "QR codes"],
];

export function PlanEditor({
  event,
  initialImage,
  initialDrawn,
  initialPois,
  initialAnchors,
  initialTab,
}: {
  event: { id: string; name: string; slug: string; bbox: BBox };
  initialImage: ImageLayer | null;
  initialDrawn: DrawnLayer | null;
  initialPois: Poi[];
  initialAnchors: Anchor[];
  initialTab?: EditorTab;
}) {
  const supabase = useMemo(() => createClient(), []);
  const containerRef = useRef<HTMLDivElement>(null);
  const map = useMapLibre(containerRef, {
    bounds: [
      [event.bbox[0], event.bbox[1]],
      [event.bbox[2], event.bbox[3]],
    ],
    fitBoundsOptions: { padding: 40 },
  });

  const [tab, setTab] = useState<EditorTab>(initialTab ?? (initialDrawn && !initialImage ? "draw" : "image"));
  const [pois, setPois] = useState<Poi[]>(initialPois);
  const [selectedPoiId, setSelectedPoiId] = useState<string | null>(null);
  const [anchors, setAnchors] = useState<Anchor[]>(initialAnchors);
  const [image, setImage] = useState<EditorImage | null>(
    initialImage ? { ...initialImage, aspect: null } : null,
  );
  const [imageDirty, setImageDirty] = useState(false);
  const [plan, setPlan] = useState<PlanCollection>(initialDrawn?.features ?? emptyPlan());
  const [drawnId, setDrawnId] = useState(initialDrawn?.id ?? null);
  const [planDirty, setPlanDirty] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const history = useRef<PlanCollection[]>([]);
  const [historySize, setHistorySize] = useState(0);

  const dirty = imageDirty || planDirty;

  // Rapport hauteur/largeur réel de l'image chargée
  const imageUrl = image?.url;
  const aspectKnown = image?.aspect != null;
  useEffect(() => {
    if (!imageUrl || aspectKnown) return;
    let cancelled = false;
    loadImageSize(imageUrl)
      .then(({ width, height }) => height / width)
      .catch(() => null)
      .then((aspect) => {
        if (cancelled) return;
        setImage((img) => {
          if (!img || img.url !== imageUrl) return img;
          return { ...img, aspect: aspect ?? cornersAspect(img.corners) };
        });
      });
    return () => {
      cancelled = true;
    };
  }, [imageUrl, aspectKnown]);

  // Affichage
  useEffect(() => {
    if (map) setZone(map, event.bbox);
  }, [map, event.bbox]);
  useEffect(() => {
    if (map) setPlanImage(map, image && { url: image.url, corners: image.corners, opacity: image.opacity });
  }, [map, image]);
  useEffect(() => {
    if (map) setPlanFeatures(map, plan, selectedId);
  }, [map, plan, selectedId]);
  useEffect(() => {
    if (map) renderPois(map, pois, tab === "pois" ? selectedPoiId : null);
  }, [map, pois, selectedPoiId, tab]);

  // Avertit avant de quitter avec des modifications non enregistrées
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  function changeImage(next: EditorImage | null, { persisted = false } = {}) {
    setImage(next);
    setImageDirty(!persisted);
    if (!persisted) setSaveState("idle");
  }

  function changePlan(next: PlanCollection) {
    history.current = [...history.current.slice(-(HISTORY_LIMIT - 1)), plan];
    setHistorySize(history.current.length);
    setPlan(next);
    setPlanDirty(true);
    setSaveState("idle");
  }

  function undo() {
    const previous = history.current.pop();
    if (!previous) return;
    setHistorySize(history.current.length);
    setPlan(previous);
    setPlanDirty(true);
    setSelectedId(null);
    setSaveState("idle");
  }

  async function save() {
    setSaveState("saving");
    try {
      if (imageDirty && image) {
        const { error } = await supabase
          .from("layers")
          .update({ corners: image.corners, opacity: image.opacity })
          .eq("id", image.id);
        if (error) throw error;
      }
      if (planDirty) {
        // Les types GeoJSON n'ont pas de signature d'index : on les présente comme du JSON générique
        const features = plan as unknown as Json;
        if (drawnId) {
          const { error } = await supabase.from("layers").update({ features }).eq("id", drawnId);
          if (error) throw error;
        } else {
          const { data, error } = await supabase
            .from("layers")
            .insert({ event_id: event.id, kind: "drawn", name: "Dessin", features, sort_order: 1 })
            .select("id")
            .single();
          if (error) throw error;
          setDrawnId(data.id);
        }
      }
      setImageDirty(false);
      setPlanDirty(false);
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col lg:h-[calc(100dvh-3.5rem)] lg:flex-row">
      <aside className="flex w-full shrink-0 flex-col border-zinc-200 bg-white lg:w-[360px] lg:border-r dark:border-zinc-800 dark:bg-zinc-950">
        <div className="border-b border-zinc-200 p-4 dark:border-zinc-800">
          <Link href={`/dashboard/events/${event.id}`} className="text-sm text-zinc-500 hover:underline">
            ← {event.name}
          </Link>
          <div className="mt-1 flex items-center justify-between gap-2">
            <h1 className="text-lg font-bold">Carte de l&apos;event</h1>
            <a href={`/e/${event.slug}`} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:underline">
              Vue visiteur ↗
            </a>
          </div>
          <div className="mt-3 grid grid-cols-4 rounded-lg bg-zinc-100 p-1 text-sm dark:bg-zinc-800">
            {TABS.map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setTab(value);
                  setSelectedId(null);
                  setSelectedPoiId(null);
                }}
                className={`rounded-md py-1.5 font-medium ${
                  tab === value ? "bg-white shadow-sm dark:bg-zinc-900" : "text-zinc-500"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {map &&
            (tab === "image" ? (
              <ImagePanel
                map={map}
                supabase={supabase}
                eventId={event.id}
                bbox={event.bbox}
                image={image}
                onChange={changeImage}
              />
            ) : tab === "qr" ? (
              <AnchorPanel
                map={map}
                supabase={supabase}
                eventId={event.id}
                anchors={anchors}
                onChange={setAnchors}
              />
            ) : tab === "pois" ? (
              <PoiPanel
                map={map}
                supabase={supabase}
                eventId={event.id}
                plan={plan}
                pois={pois}
                onChange={setPois}
                selectedId={selectedPoiId}
                onSelect={setSelectedPoiId}
              />
            ) : (
              <DrawPanel
                map={map}
                bbox={event.bbox}
                plan={plan}
                onChange={changePlan}
                onUndo={undo}
                canUndo={historySize > 0}
                selectedId={selectedId}
                onSelect={setSelectedId}
              />
            ))}
        </div>

        <div className="flex items-center gap-3 border-t border-zinc-200 p-4 dark:border-zinc-800">
          <p className="flex-1 text-sm text-zinc-500">
            <span className="block text-xs text-zinc-400">Plan (image + dessin)</span>
            {saveState === "saving"
              ? "Enregistrement…"
              : saveState === "error"
                ? <span className="text-red-600">Échec de l&apos;enregistrement</span>
                : dirty
                  ? "Modifications non enregistrées"
                  : saveState === "saved"
                    ? "Enregistré"
                    : "À jour"}
          </p>
          <button
            type="button"
            onClick={save}
            disabled={!dirty || saveState === "saving"}
            className="btn-primary"
          >
            Enregistrer
          </button>
        </div>
      </aside>

      <div className="relative min-h-[60dvh] flex-1">
        <div ref={containerRef} className="absolute inset-0" />
        {!map && (
          <div className="absolute inset-0 grid place-items-center bg-zinc-100 text-sm text-zinc-500 dark:bg-zinc-900">
            Chargement de la carte…
          </div>
        )}
      </div>
    </div>
  );
}
