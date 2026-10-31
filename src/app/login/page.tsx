import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { AuthForm } from "./auth-form";

export const metadata: Metadata = { title: "Connexion" };

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-6 py-16">
      <div className="text-center">
        <Link href="/" className="text-sm font-semibold uppercase tracking-wider text-blue-600">
          MapInter
        </Link>
        <h1 className="mt-2 text-2xl font-bold">Espace organisateur</h1>
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
    <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
      Le lien de confirmation est invalide ou a expiré. Ouvrez-le dans le navigateur où vous avez créé le compte, ou
      connectez-vous si votre adresse est déjà confirmée.
    </p>
  );
}
