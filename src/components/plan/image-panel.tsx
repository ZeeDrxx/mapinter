"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import type { Map as MapLibreMap, Marker } from "maplibre-gl";
import type { BrowserSupabase } from "@/lib/supabase/client";
import { ACCEPTED_IMAGE_TYPES, prepareImage } from "@/lib/image";
import { newId } from "@/lib/id";
import { bboxSizeMeters, formatMeters, type BBox, type LngLat } from "@/lib/geo";
import {
  cornersAspect,
  cornersToTransform,
  dragCorner,
  isRigid,
  normalizeAngle,
  transformToCorners,
  type Corners,
  type ImageTransform,
} from "@/lib/plan";
import type { EditorImage } from "./plan-editor";

const BUCKET = "layers";
const DEFAULT_OPACITY = 0.75;

type Mode = "rigid" | "free";

function fitTransform(bbox: BBox, aspect: number): ImageTransform {
  const { width, height } = bboxSizeMeters(bbox);
  return {
    center: [(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2],
    width: Math.min(width * 0.9, (height * 0.9) / aspect),
    rotation: 0,
  };
}

function handleElement(kind: "corner" | "center"): HTMLDivElement {
  const el = document.createElement("div");
  el.className =
    kind === "corner"
      ? "size-4 cursor-grab rounded-sm border-2 border-blue-600 bg-white shadow"
      : "grid size-7 cursor-move place-items-center rounded-full border-2 border-white bg-blue-600 text-white shadow-lg";
  if (kind === "center") el.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3"/></svg>';
  return el;
}

export function ImagePanel({
  map,
  supabase,
  eventId,
  bbox,
  image,
  onChange,
}: {
  map: MapLibreMap;
  supabase: BrowserSupabase;
  eventId: string;
  bbox: BBox;
  image: EditorImage | null;
  onChange: (image: EditorImage | null, opts?: { persisted?: boolean }) => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>(() =>
    image && !isRigid(image.corners, cornersAspect(image.corners)) ? "free" : "rigid",
  );

  const aspect = image ? (image.aspect ?? cornersAspect(image.corners)) : 1;
  const transform = image ? cornersToTransform(image.corners) : null;

  // --- Import -------------------------------------------------------------

  async function handleFile(file: File) {
    setError(null);
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      setError("Formats acceptés : PNG, JPG ou WebP. Le PDF arrive bientôt : en attendant, exportez votre plan en image.");
      return;
    }
    setBusy(true);
    try {
      const { blob, width, height } = await prepareImage(file);
      const newAspect = height / width;
      const path = `${eventId}/${newId()}.webp`;
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, blob, { contentType: "image/webp" });
      if (uploadError) throw uploadError;
      const url = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;

      // En cas de remplacement, on garde la position de l'ancienne image
      const corners = transformToCorners(
        image ? cornersToTransform(image.corners) : fitTransform(bbox, newAspect),
        newAspect,
      );
      const opacity = image?.opacity ?? DEFAULT_OPACITY;

      let id = image?.id;
      if (id) {
        const { error } = await supabase
          .from("layers")
          .update({ image_path: path, corners, opacity, name: file.name })
          .eq("id", id);
        if (error) throw error;
        await supabase.storage.from(BUCKET).remove([image!.path]);
      } else {
        const { data, error } = await supabase
          .from("layers")
          .insert({ event_id: eventId, kind: "image", name: file.name, image_path: path, corners, opacity })
          .select("id")
          .single();
        if (error) throw error;
        id = data.id;
      }

      onChange({ id, path, url, corners, opacity, aspect: newAspect }, { persisted: true });
      setMode("rigid");
    } catch (e) {
      console.error(e);
      setError("L'import a échoué. Vérifiez le fichier et réessayez.");
    } finally {
      setBusy(false);
    }
  }

  async function removeImage() {
    if (!image || !confirm("Supprimer l'image du plan ?")) return;
    setBusy(true);
    const { error } = await supabase.from("layers").delete().eq("id", image.id);
    if (error) {
      setError("La suppression a échoué.");
    } else {
      await supabase.storage.from(BUCKET).remove([image.path]);
      onChange(null, { persisted: true });
    }
    setBusy(false);
  }

  function setCorners(corners: Corners) {
    if (image) onChange({ ...image, corners });
  }

  function setTransform(patch: Partial<ImageTransform>) {
    if (image && transform) setCorners(transformToCorners({ ...transform, ...patch }, aspect));
  }

  function switchMode(next: Mode) {
    // Revenir au mode rigide redresse l'image
    if (next === "rigid" && image && transform) setCorners(transformToCorners(transform, aspect));
    setMode(next);
  }

  // --- Poignées sur la carte ---------------------------------------------

  const markers = useRef<{ center: Marker; corners: Marker[] } | null>(null);
  const dragStart = useRef<{ pointer: LngLat; corners: Corners; transform: ImageTransform } | null>(null);

  const getCorners = useEffectEvent(() => image?.corners ?? null);
  const startDrag = useEffectEvent((pointer: LngLat) => {
    if (!image) return;
    dragStart.current = { pointer, corners: image.corners, transform: cornersToTransform(image.corners) };
  });
  const moveCenter = useEffectEvent((pointer: LngLat) => {
    const start = dragStart.current;
    if (!start) return;
    const dLng = pointer[0] - start.pointer[0];
    const dLat = pointer[1] - start.pointer[1];
    setCorners(start.corners.map(([lng, lat]) => [lng + dLng, lat + dLat]) as Corners);
  });
  const moveCorner = useEffectEvent((index: number, pointer: LngLat) => {
    const start = dragStart.current;
    if (!start || !image) return;
    if (mode === "free") {
      const next = [...image.corners] as Corners;
      next[index] = pointer;
      setCorners(next);
    } else {
      setCorners(transformToCorners(dragCorner(start.transform, aspect, index, pointer), aspect));
    }
  });

  const hasImage = image !== null;
  useEffect(() => {
    if (!hasImage) return;
    let cancelled = false;

    import("maplibre-gl").then(({ Marker }) => {
      const corners = getCorners();
      if (cancelled || !corners) return;
      const toLngLat = (e: { target: Marker }): LngLat => {
        const p = e.target.getLngLat();
        return [p.lng, p.lat];
      };

      const centerPos = cornersToTransform(corners).center;
      const center = new Marker({ element: handleElement("center"), draggable: true })
        .setLngLat(centerPos)
        .addTo(map);
      center.on("dragstart", (e) => startDrag(toLngLat(e)));
      center.on("drag", (e) => moveCenter(toLngLat(e)));

      const cornerMarkers = corners.map((pos, i) => {
        const m = new Marker({ element: handleElement("corner"), draggable: true }).setLngLat(pos).addTo(map);
        m.on("dragstart", (e) => startDrag(toLngLat(e)));
        m.on("drag", (e) => moveCorner(i, toLngLat(e)));
        return m;
      });

      markers.current = { center, corners: cornerMarkers };
    });

    return () => {
      cancelled = true;
      markers.current?.center.remove();
      markers.current?.corners.forEach((m) => m.remove());
      markers.current = null;
    };
  }, [map, hasImage]);

  // Garde les poignées sur l'image
  useEffect(() => {
    if (!image || !markers.current) return;
    markers.current.center.setLngLat(cornersToTransform(image.corners).center);
    markers.current.corners.forEach((m, i) => m.setLngLat(image.corners[i]));
  }, [image]);

  // --- Rendu ----------------------------------------------------------------

  const filePicker = (
    <input
      ref={fileInput}
      type="file"
      accept={ACCEPTED_IMAGE_TYPES.join(",")}
      className="hidden"
      onChange={(e) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (file) handleFile(file);
      }}
    />
  );

  if (!image || !transform) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Vous avez déjà le plan de votre lieu ? Importez-le, puis calez-le sur la carte.
        </p>
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const file = e.dataTransfer.files[0];
            if (file) handleFile(file);
          }}
          disabled={busy}
          className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-zinc-300 px-4 py-10 text-center hover:border-blue-400 hover:bg-blue-50/50 dark:border-zinc-700 dark:hover:bg-blue-950/20"
        >
          <span className="font-medium">{busy ? "Import en cours…" : "Choisir une image"}</span>
          <span className="text-xs text-zinc-500">ou glissez-la ici · PNG, JPG, WebP</span>
        </button>
        {filePicker}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <p className="text-sm text-zinc-500">
          Pas de plan ? Passez à l&apos;onglet <strong>Dessin</strong> pour le créer sur le fond de carte.
        </p>
      </div>
    );
  }

  const heightMeters = mode === "rigid" ? transform.width * aspect : null;

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-lg bg-blue-50 p-3 text-sm text-blue-900 dark:bg-blue-950/40 dark:text-blue-200">
        {mode === "rigid" ? (
          <>
            Glissez la <strong>poignée centrale</strong> pour déplacer le plan et un <strong>coin</strong> pour
            l&apos;agrandir et le tourner. Baissez l&apos;opacité pour l&apos;aligner sur la carte.
          </>
        ) : (
          <>
            Glissez chaque <strong>coin</strong> sur sa position réelle. Idéal pour un plan pris en photo ou
            légèrement déformé.
          </>
        )}
      </div>

      <div>
        <p className="label">Mode de calage</p>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ["rigid", "Ajustement"],
              ["free", "Coins libres"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => switchMode(value)}
              className={mode === value ? "btn-primary" : "btn-secondary"}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="opacity" className="label">
          Opacité · {Math.round(image.opacity * 100)} %
        </label>
        <input
          id="opacity"
          type="range"
          min={0.1}
          max={1}
          step={0.05}
          value={image.opacity}
          onChange={(e) => onChange({ ...image, opacity: Number(e.target.value) })}
          className="w-full accent-blue-600"
        />
      </div>

      {mode === "rigid" && (
        <>
          <div>
            <label htmlFor="rotation" className="label">
              Rotation · {transform.rotation.toFixed(1)}°
            </label>
            <input
              id="rotation"
              type="range"
              min={-180}
              max={180}
              step={0.5}
              value={transform.rotation}
              onChange={(e) => setTransform({ rotation: normalizeAngle(Number(e.target.value)) })}
              className="w-full accent-blue-600"
            />
          </div>
          <div>
            <label htmlFor="width" className="label">
              Largeur réelle (m)
            </label>
            <input
              id="width"
              type="number"
              min={1}
              step={1}
              value={Math.round(transform.width)}
              onChange={(e) => {
                const width = Number(e.target.value);
                if (width >= 1) setTransform({ width });
              }}
              className="input"
            />
            {heightMeters !== null && (
              <p className="mt-1 text-xs text-zinc-500">
                Soit {formatMeters(transform.width)} × {formatMeters(heightMeters)}
              </p>
            )}
          </div>
        </>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setCorners(transformToCorners(fitTransform(bbox, aspect), aspect))}
          className="btn-secondary"
        >
          Recentrer sur la zone
        </button>
        <button type="button" onClick={() => fileInput.current?.click()} disabled={busy} className="btn-secondary">
          {busy ? "Import…" : "Remplacer l'image"}
        </button>
        <button type="button" onClick={removeImage} disabled={busy} className="btn-ghost text-red-600">
          Supprimer
        </button>
      </div>
      {filePicker}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
