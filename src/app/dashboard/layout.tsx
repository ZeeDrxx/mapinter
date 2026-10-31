import { Suspense } from "react";
import Link from "next/link";
import { Logo } from "@/components/ui/logo";
import { getUser } from "@/lib/supabase/server";
import { signOut } from "@/app/login/actions";

export default function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-20 border-b border-hair bg-paper/90 backdrop-blur print:hidden">
        <div className="mx-auto flex h-14 w-full max-w-[1120px] items-center justify-between gap-4 px-6">
          <Link href="/dashboard" aria-label="Mes events">
            <Logo />
          </Link>
          <Suspense fallback={<div className="skeleton h-5 w-40" />}>
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
    <div className="flex min-w-0 items-center gap-2">
      <span className="hidden truncate text-[13px] text-t3 sm:inline">{user.email}</span>
      <form action={signOut}>
        <button type="submit" className="btn btn-ghost btn-sm">
          Déconnexion
        </button>
      </form>
    </div>
  );
}
