import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/ui/logo";
import { AuthForm } from "./auth-form";

export const metadata: Metadata = { title: "Connexion" };

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <main className="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center gap-8 px-6 py-16">
      <div className="rise">
        <Link href="/" aria-label="Accueil MapInter">
          <Logo />
        </Link>
        <h1 className="h1 mt-8">Espace organisateur</h1>
        <p className="body mt-2">Créez la carte de votre event en quelques minutes.</p>
      </div>
      <Suspense>
        <ConfirmationNotice searchParams={searchParams} />
      </Suspense>
      <AuthForm />
    </main>
  );
}

async function ConfirmationNotice({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  const { confirmation } = await searchParams;
  if (confirmation !== "echec") return null;
  return (
    <p className="well flex gap-3 p-3.5 text-[14px] text-t2">
      <span className="mt-1.5 size-2 shrink-0 rounded-full bg-busy" aria-hidden />
      Le lien de confirmation est invalide ou a expiré. Ouvrez-le dans le navigateur où vous avez créé le compte, ou
      connectez-vous si votre adresse est déjà confirmée.
    </p>
  );
}
