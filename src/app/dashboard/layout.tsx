import { Suspense } from "react";
import Link from "next/link";
import { getUser } from "@/lib/supabase/server";
import { signOut } from "@/app/login/actions";

export default function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-6">
          <Link href="/dashboard" className="font-semibold">
            <span className="text-blue-600">Map</span>Inter
          </Link>
          <Suspense fallback={<div className="h-5 w-40 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />}>
            <UserMenu />
          </Suspense>
        </div>
      </header>
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}

async function UserMenu() {
  const user = await getUser();
  if (!user) return null;
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="text-zinc-500">{user.email}</span>
      <form action={signOut}>
        <button type="submit" className="btn-ghost px-2 py-1">
          Déconnexion
        </button>
      </form>
    </div>
  );
}
