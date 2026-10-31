import { POI_STATUSES, type PoiStatus } from "@/lib/poi";

/** Forme + mot, jamais la couleur seule : disque plein (ouvert), demi-disque (affluence), croix (fermé). */
export function StatusMark({ status, className = "" }: { status: PoiStatus; className?: string }) {
  const tone = status === "open" ? "text-ok" : status === "busy" ? "text-busy" : "text-t3";
  return (
    <span className={`inline-flex items-center gap-1.5 text-[13px] font-semibold ${tone} ${className}`}>
      <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden>
        {status === "open" && <circle cx="6" cy="6" r="5" fill="currentColor" />}
        {status === "busy" && (
          <>
            <circle cx="6" cy="6" r="4.4" fill="none" stroke="currentColor" strokeWidth="1.4" />
            <path d="M6 1.6a4.4 4.4 0 0 1 0 8.8Z" fill="currentColor" />
          </>
        )}
        {status === "closed" && (
          <path d="M2.5 2.5l7 7M9.5 2.5l-7 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        )}
      </svg>
      {POI_STATUSES[status].label}
    </span>
  );
}

/** Publié / brouillon d'un event. */
export function PublishMark({ published }: { published: boolean }) {
  return published ? (
    <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-ok">
      <span className="size-2 rounded-full bg-ok" aria-hidden />
      En ligne
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-t3">
      <span className="size-2 rounded-full border border-current" aria-hidden />
      Brouillon
    </span>
  );
}
