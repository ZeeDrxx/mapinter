"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { POI_COLUMNS, rowToPoi, type Poi } from "@/lib/poi";
import {
  ANNOUNCEMENT_COLUMNS,
  rowToAnnouncement,
  sortAnnouncements,
  type Announcement,
} from "@/lib/announcement";
import {
  LAYER_COLUMNS,
  LAYERS_BUCKET,
  applyLayerRow,
  removeLayer,
  rowsToPlan,
  type EventPlan,
  type LayerRow,
} from "@/lib/layer-rows";

export type LiveData = { pois: Poi[]; plan: EventPlan; announcements: Announcement[] };

type Row = Record<string, unknown>;

function upsert<T extends { id: string }>(list: T[], item: T): T[] {
  const i = list.findIndex((x) => x.id === item.id);
  if (i === -1) return [...list, item];
  const next = [...list];
  next[i] = item;
  return next;
}

/**
 * Données de la carte tenues à jour en direct (Supabase Realtime, filtré par la RLS).
 * À chaque (re)connexion, on recharge tout une fois pour rattraper ce qui a pu changer entre-temps.
 */
export function useLiveEvent(eventId: string, initial: LiveData) {
  const supabase = useMemo(() => createClient(), []);
  const [data, setData] = useState<LiveData>(initial);
  const [live, setLive] = useState(false);

  useEffect(() => {
    const publicUrl = (path: string) => supabase.storage.from(LAYERS_BUCKET).getPublicUrl(path).data.publicUrl;
    const filter = `event_id=eq.${eventId}`;
    let cancelled = false;

    async function resync() {
      const [pois, layers, announcements] = await Promise.all([
        supabase.from("pois").select(POI_COLUMNS).eq("event_id", eventId).order("created_at"),
        supabase.from("layers").select(LAYER_COLUMNS).eq("event_id", eventId).order("sort_order").order("created_at"),
        supabase
          .from("announcements")
          .select(ANNOUNCEMENT_COLUMNS)
          .eq("event_id", eventId)
          .eq("active", true)
          .order("created_at", { ascending: false })
          .limit(30),
      ]);
      if (cancelled || pois.error || layers.error || announcements.error) return;
      setData({
        pois: pois.data.map(rowToPoi),
        plan: rowsToPlan(layers.data, publicUrl),
        announcements: announcements.data.map(rowToAnnouncement),
      });
    }

    // Les suppressions ne sont pas filtrables côté Realtime : on ignore les id inconnus.
    const channel = supabase
      .channel(`event-live-${eventId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "pois", filter }, ({ eventType, new: row }) => {
        if (eventType === "DELETE") return;
        setData((d) => ({ ...d, pois: upsert(d.pois, rowToPoi(row as Parameters<typeof rowToPoi>[0])) }));
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "pois" }, ({ old }) => {
        const id = (old as Row).id;
        setData((d) => ({ ...d, pois: d.pois.filter((p) => p.id !== id) }));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "layers", filter }, ({ eventType, new: row }) => {
        if (eventType === "DELETE") return;
        setData((d) => ({ ...d, plan: applyLayerRow(d.plan, row as LayerRow, publicUrl) }));
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "layers" }, ({ old }) => {
        setData((d) => ({ ...d, plan: removeLayer(d.plan, String((old as Row).id)) }));
      })
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "announcements", filter },
        ({ eventType, new: row }) => {
          if (eventType === "DELETE") return;
          const a = rowToAnnouncement(row as Parameters<typeof rowToAnnouncement>[0]);
          setData((d) => ({ ...d, announcements: sortAnnouncements(upsert(d.announcements, a)) }));
        },
      )
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "announcements" }, ({ old }) => {
        const id = (old as Row).id;
        setData((d) => ({ ...d, announcements: d.announcements.filter((a) => a.id !== id) }));
      })
      // « SUBSCRIBED » arrive avant que l'écoute de la base soit prête : on attend ce message
      .on("system", {}, (msg: { extension?: string; status?: string }) => {
        if (msg.extension !== "postgres_changes") return;
        setLive(msg.status === "ok");
        if (msg.status === "ok") resync();
      })
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") setLive(false);
      });

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [supabase, eventId]);

  return { ...data, live };
}
