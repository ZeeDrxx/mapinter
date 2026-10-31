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
    <Suspense fallback={<div className="page text-sm text-zinc-500">Génération des QR codes…</div>}>
      <QrSheets params={params} />
    </Suspense>
  );
}

function qrSvg(url: string) {
  // Correction d'erreur « Q » (25 %) : l'affiche reste lisible si elle est un peu abîmée
  return QRCode.toString(url, { type: "svg", errorCorrectionLevel: "Q", margin: 0, color: { dark: "#18181b" } });
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
    <div className="page flex flex-col gap-6 print:block print:max-w-none print:p-0">
      <div className="flex flex-col gap-3 print:hidden">
        <Link href={`/dashboard/events/${event.id}/plan?tab=qr`} className="text-sm text-zinc-500 hover:underline">
          ← Placer les QR codes
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Affiches QR · {event.name}</h1>
            <p className="text-sm text-zinc-500">
              {anchors.length} affiche(s) « Vous êtes ici » + 1 affiche du plan. Format A4, une par page :
              choisissez « Enregistrer en PDF » dans la fenêtre d&apos;impression pour obtenir un fichier.
            </p>
          </div>
          <PrintButton />
        </div>
        {isLocal && (
          <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
            Ces QR codes pointent vers <span className="font-mono">{siteUrl}</span> : ils ne fonctionneront que sur
            cet ordinateur. Une fois le site en ligne, définissez <span className="font-mono">NEXT_PUBLIC_SITE_URL</span>{" "}
            puis réimprimez.
          </p>
        )}
        {!event.is_published && (
          <p className="rounded-lg border border-zinc-300 bg-zinc-50 p-3 text-sm text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
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

/** Affiche A4 ; les tailles en cqw suivent la largeur de l'affiche, à l'écran comme à l'impression. */
function Sheet({ eventName, sheet }: { eventName: string; sheet: SheetData }) {
  const isHere = sheet.kind === "here";
  return (
    <section className="qr-sheet aspect-[210/297] rounded-xl border border-zinc-200 bg-white text-center text-zinc-900 [container-type:inline-size] print:aspect-auto print:h-[273mm] print:rounded-none print:border-0">
      <div className="flex h-full flex-col items-center justify-between p-[7cqw]">
        <p className="text-[4cqw] font-semibold tracking-wide text-zinc-500 uppercase">{eventName}</p>

        <div className="flex flex-col items-center gap-[2cqw]">
          {isHere ? (
            <>
              <span className="grid size-[12cqw] place-items-center rounded-full bg-rose-600">
                <span className="size-[4cqw] rounded-full bg-white" />
              </span>
              <h2 className="text-[11cqw] leading-none font-black text-rose-600">Vous êtes ici</h2>
              <p className="text-[6cqw] font-bold">{sheet.title}</p>
            </>
          ) : (
            <>
              <h2 className="text-[11cqw] leading-none font-black text-blue-600">{sheet.title}</h2>
              <p className="text-[5cqw] font-medium">Trouvez un stand, un service, votre chemin</p>
            </>
          )}
        </div>

        {/* SVG produit par la librairie qrcode à partir de notre URL */}
        <div className="w-[62%] [&>svg]:h-auto [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: sheet.svg }} />

        <div className="flex flex-col gap-[1cqw]">
          <p className="text-[4.5cqw] font-semibold">
            {isHere ? "Scannez pour voir où vous êtes sur le plan" : "Scannez avec l'appareil photo de votre téléphone"}
          </p>
          <p className="font-mono text-[2.6cqw] break-all text-zinc-400">{sheet.url}</p>
        </div>
      </div>
    </section>
  );
}
