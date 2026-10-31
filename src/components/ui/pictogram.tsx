import { PICTOGRAMS } from "@/lib/pictograms";
import { POI_CATEGORIES, type PoiCategory } from "@/lib/poi";

/** Plaque de catégorie : pictogramme clair sur encre, comme un panneau. */
export function Pictogram({
  category,
  size = 22,
  tone = "ink",
  className = "",
}: {
  category: PoiCategory;
  size?: number;
  tone?: "ink" | "signal" | "bare";
  className?: string;
}) {
  const p = PICTOGRAMS[category];
  const plate =
    tone === "ink" ? "bg-ink text-on-ink" : tone === "signal" ? "bg-signal text-on-signal" : "text-t2";
  return (
    <span
      role="img"
      aria-label={POI_CATEGORIES[category].label}
      className={`inline-grid shrink-0 place-items-center rounded-sign ${plate} ${className}`}
      style={{ width: size, height: size }}
    >
      {"text" in p ? (
        <span className="font-extrabold leading-none" style={{ fontSize: size * 0.42, marginTop: size * 0.06 }}>
          {p.text}
        </span>
      ) : (
        <svg
          viewBox="0 0 24 24"
          width={size * 0.72}
          height={size * 0.72}
          fill="none"
          stroke="currentColor"
          strokeWidth={category === "other" || category === "info" ? 3 : 2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d={p.path} />
        </svg>
      )}
    </span>
  );
}
