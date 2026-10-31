"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { createClient, getUser } from "@/lib/supabase/server";

export async function setPublished(eventId: string, published: boolean) {
  const user = await getUser();
  if (!user) redirect("/login");

  const supabase = await createClient();
  const { error } = await supabase
    .from("events")
    .update({ is_published: published })
    .eq("id", eventId)
    .eq("owner_id", user.id);
  if (error) throw error;

  refresh();
}
