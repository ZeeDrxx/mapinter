import Link from "next/link";
import { Logo } from "@/components/ui/logo";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-[460px] flex-1 flex-col justify-center gap-6 px-6 py-16">
      <Link href="/" aria-label="Accueil MapInter">
        <Logo />
      </Link>
      <div>
        <p className="num font-mono text-[13px] font-semibold text-t3">404</p>
        <h1 className="h1 mt-2">Ce plan n&apos;existe pas, ou pas encore.</h1>
        <p className="body mt-3">
          Si vous avez scanné une affiche, l&apos;event n&apos;est peut-être pas encore publié par l&apos;organisateur.
        </p>
      </div>
      <Link href="/" className="btn btn-secondary self-start">
        Retour à l&apos;accueil
      </Link>
    </main>
  );
}
