import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-8 px-6 py-24">
      <p className="text-sm font-semibold uppercase tracking-wider text-blue-600">MapInter</p>
      <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
        La carte live de votre event, au mètre près.
      </h1>
      <p className="text-lg text-zinc-600 dark:text-zinc-400">
        Délimitez votre lieu, importez ou dessinez votre plan, placez stands et services : vos
        visiteurs scannent un QR code et se repèrent instantanément, sans application à installer.
      </p>
      <div className="flex gap-3">
        <Link href="/dashboard" className="btn-primary">
          Créer mon event
        </Link>
        <Link href="/login" className="btn-secondary">
          Se connecter
        </Link>
      </div>
    </main>
  );
}
