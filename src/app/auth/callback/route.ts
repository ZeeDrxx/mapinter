import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Retour du lien de confirmation envoyé par e-mail : échange le code contre une session.
 * Le code n'est valable que dans le navigateur où le compte a été créé (PKCE).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL("/dashboard", url.origin));
  }

  const failed = new URL("/login", url.origin);
  failed.searchParams.set("confirmation", "echec");
  return NextResponse.redirect(failed);
}
