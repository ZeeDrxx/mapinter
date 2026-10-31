import type { Metadata } from "next";
import Link from "next/link";
import { AuthForm } from "./auth-form";

export const metadata: Metadata = { title: "Connexion" };

export default function LoginPage() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-6 py-16">
      <div className="text-center">
        <Link href="/" className="text-sm font-semibold uppercase tracking-wider text-blue-600">
          MapInter
        </Link>
        <h1 className="mt-2 text-2xl font-bold">Espace organisateur</h1>
      </div>
      <AuthForm />
    </main>
  );
}
