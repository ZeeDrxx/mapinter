import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { getMyEvent } from "@/lib/events";
import { listAnchors } from "@/lib/anchors";
import { getSiteUrl } from "@/lib/site-url";
import { anchorUrl } from "@/lib/anchor";
import { PrintButton } from "./print-button";

export const metadata: Metadata = { title: "Affiches QR" };

type SheetData = { key: string; kind: "map" | "here"; title: string; url: string; svg: string };

export default function QrPage({ params }: PageProps<"/dashboard/events/[id]/qr">) {
  return (
    <Suspense fallback={<div className="page"><p className="label">Génération des QR codes…</p></div>}>
      <QrSheets params={params} />
    </Suspense>
  );
}

function qrSvg(url: string) {
  // Correction d'erreur « Q » (25 %) : l'affiche reste lisible si elle est un peu abîmée
  return QRCode.toString(url, { type: "svg", errorCorrectionLevel: "Q", margin: 0, color: { dark: "#15171a" } });
}

async function QrSheets({ params }: Pick<PageProps<"/dashboard/events/[id]/qr">, "params">) {
  const { id } = await params;
  const event = await getMyEvent(id);
  if (!event) notFound();

  const [anchors, siteUrl] = await Promise.all([listAnchors(event.id), getSiteUrl()]);
  const sheets: SheetData[] = await Promise.all(
    [
      { key: "map", kind: "map" as const, title: "Plan interactif", url: anchorUrl(siteUrl, event.slug) },
      ...anchors.map((a) => ({
        key: a.id,
        kind: "here" as const,
        title: a.label,
        url: anchorUrl(siteUrl, event.slug, a.id),
      })),
    ].map(async (s) => ({ ...s, svg: await qrSvg(s.url) })),
  );

  const isLocal = /localhost|127\.0\.0\.1/.test(siteUrl);

  return (
    <div className="page flex flex-col gap-8 print:block print:max-w-none print:p-0">
      <div className="flex flex-col gap-4 print:hidden">
        <Link href={`/dashboard/events/${event.id}/plan?tab=qr`} className="btn btn-ghost btn-sm -ml-3 self-start">
          ← Placer les QR codes
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="label">{event.name}</p>
            <h1 className="h1 mt-2">Affiches QR</h1>
            <p className="body mt-2 max-w-[60ch] text-[14px]">
              <span className="num">{anchors.length}</span> affiches « Vous êtes ici » et l&apos;affiche du plan. Format A4,
              une par page : choisissez « Enregistrer en PDF » à l&apos;impression pour obtenir un fichier.
            </p>
          </div>
          <PrintButton />
        </div>
        {isLocal && (
          <p className="well flex gap-3 p-3.5 text-[13.5px] text-t2">
            <span className="mt-1.5 size-2 shrink-0 rounded-full bg-busy" aria-hidden />
            <span>
              Ces QR codes pointent vers <span className="font-mono">{siteUrl}</span> : ils ne fonctionneront que sur cet
              ordinateur. Une fois le site en ligne, définissez <span className="font-mono">NEXT_PUBLIC_SITE_URL</span> puis
              réimprimez.
            </span>
          </p>
        )}
        {!event.is_published && (
          <p className="well flex gap-3 p-3.5 text-[13.5px] text-t2">
            <span className="mt-1.5 size-2 shrink-0 rounded-full border border-t3" aria-hidden />
            L&apos;event n&apos;est pas encore publié : les visiteurs qui scanneront ces affiches verront une page
            introuvable tant qu&apos;il ne l&apos;est pas.
          </p>
        )}
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 print:block">
        {sheets.map((s) => (
          <Sheet key={s.key} eventName={event.name} sheet={s} />
        ))}
      </div>
    </div>
  );
}

// Une affiche imprimée est toujours claire : couleurs fixes, indépendantes du thème de l'écran.
const POSTER = { paper: "#ffffff", ink: "#15171a", muted: "#6b6d70", signal: "#d63b22" };

/** Affiche A4 ; les tailles en cqw suivent la largeur de l'affiche, à l'écran comme à l'impression. */
function Sheet({ eventName, sheet }: { eventName: string; sheet: SheetData }) {
  const isHere = sheet.kind === "here";
  return (
    <section
      className="qr-sheet aspect-[210/297] overflow-hidden rounded-sign shadow-lift [container-type:inline-size] print:aspect-auto print:h-[273mm] print:rounded-none print:shadow-none"
      style={{ background: POSTER.paper, color: POSTER.ink }}
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between px-[7cqw] py-[4.5cqw]" style={{ background: POSTER.ink, color: POSTER.paper }}>
          <p className="text-[3.6cqw] leading-tight font-bold tracking-[0.1em] text-balance uppercase">{eventName}</p>
          <span className="flex shrink-0 items-center gap-[1.4cqw] text-[3.2cqw] font-extrabold">
            <span className="size-[2.6cqw] rounded-full" style={{ background: POSTER.signal }} />
            MapInter
          </span>
        </div>

        <div className="flex flex-1 flex-col items-center justify-between px-[7cqw] pt-[7cqw] pb-[6cqw] text-center">
          {isHere ? (
            <div className="flex flex-col items-center gap-[3cqw]">
              <span className="grid size-[15cqw] place-items-center rounded-full" style={{ background: POSTER.signal, boxShadow: `0 0 0 3.5cqw ${POSTER.signal}22` }}>
                <span className="size-[5cqw] rounded-full" style={{ background: POSTER.paper }} />
              </span>
              <h2 className="mt-[2cqw] text-[12.5cqw] leading-[0.95] font-extrabold tracking-[-0.04em]">Vous êtes ici</h2>
              <p className="rounded-[3px] px-[3cqw] pt-[1.4cqw] pb-[1cqw] text-[5.4cqw] font-bold" style={{ background: POSTER.ink, color: POSTER.paper }}>
                {sheet.title}
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-[2.5cqw]">
              <p className="text-[3.4cqw] font-bold tracking-[0.16em] uppercase" style={{ color: POSTER.signal }}>
                Plan interactif
              </p>
              <h2 className="text-[11cqw] leading-[0.95] font-extrabold tracking-[-0.04em]">Trouvez votre chemin</h2>
              <p className="text-[4.6cqw] font-medium" style={{ color: POSTER.muted }}>
                Stands, services, programme
              </p>
            </div>
          )}

          {/* SVG produit par la librairie qrcode à partir de notre URL */}
          <div className="w-[56%] [&>svg]:h-auto [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: sheet.svg }} />

          <div className="flex flex-col items-center gap-[1.2cqw]">
            <p className="text-[4.4cqw] font-bold">
              {isHere ? "Scannez pour voir où vous êtes" : "Scannez avec l'appareil photo"}
            </p>
            <p className="font-mono text-[2.5cqw] break-all" style={{ color: POSTER.muted }}>
              {sheet.url}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
