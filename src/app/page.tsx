import Link from "next/link";
import { Logo } from "@/components/ui/logo";
import { HeroPlan } from "@/components/ui/hero-plan";

const STEPS = [
  {
    n: "01",
    title: "Délimitez le lieu",
    text: "Cherchez votre salle, votre parc ou votre campus et tracez la zone de l'event.",
  },
  {
    n: "02",
    title: "Posez votre plan",
    text: "Importez le plan que vous avez déjà et calez-le sur la carte, ou dessinez halls, allées et grilles de stands.",
  },
  {
    n: "03",
    title: "Guidez en direct",
    text: "Des QR codes « Vous êtes ici » sur place, une carte qui se met à jour seule, des annonces en un clic.",
  },
];

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-[1120px] items-center justify-between px-6 py-5">
        <Logo />
        <nav className="flex items-center gap-1">
          <Link href="/e/demo-salon-tech-2026" className="btn btn-ghost btn-sm">
            Voir la démo
          </Link>
          <Link href="/login" className="btn btn-ghost btn-sm">
            Se connecter
          </Link>
        </nav>
      </header>

      <main className="flex-1">
        <section className="mx-auto grid w-full max-w-[1120px] items-center gap-12 px-6 pt-10 pb-20 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:pt-16">
          <div className="rise">
            <p className="label text-signal-ink">Plan interactif pour events</p>
            <h1 className="mt-4 text-[clamp(2.4rem,1.6rem+3.2vw,4rem)] leading-[0.98] font-extrabold tracking-[-0.045em] text-balance">
              Vos visiteurs savent où ils sont. Et où aller.
            </h1>
            <p className="lead mt-6">
              Salons, forums, festivals : une carte du lieu, au mètre près, qui s&apos;ouvre d&apos;un scan. Sans
              application, sans Google Maps, et mise à jour en direct par l&apos;organisateur.
            </p>
            <div className="mt-8 flex flex-wrap gap-2">
              <Link href="/dashboard" className="btn btn-primary">
                Créer mon event
              </Link>
              <Link href="/e/demo-salon-tech-2026" className="btn btn-secondary">
                Essayer la démo
                <span aria-hidden>→</span>
              </Link>
            </div>
          </div>
          <div className="sheet-lift rise overflow-hidden p-2 [animation-delay:80ms]">
            <HeroPlan className="block h-auto w-full" />
          </div>
        </section>

        <section className="border-t border-hair">
          <ol className="mx-auto grid w-full max-w-[1120px] gap-px px-6 py-14 md:grid-cols-3 md:gap-10">
            {STEPS.map((s) => (
              <li key={s.n} className="border-t border-ink pt-4 pb-6 md:pb-0">
                <p className="num font-mono text-[13px] font-semibold text-t3">{s.n}</p>
                <h2 className="h2 mt-2">{s.title}</h2>
                <p className="body mt-2 text-[14.5px]">{s.text}</p>
              </li>
            ))}
          </ol>
        </section>
      </main>

      <footer className="border-t border-hair">
        <div className="mx-auto flex w-full max-w-[1120px] items-center justify-between px-6 py-6">
          <Logo className="text-[14px]" />
          <p className="fine">Fond de carte © OpenStreetMap</p>
        </div>
      </footer>
    </div>
  );
}
