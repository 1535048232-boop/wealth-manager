import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

export async function ensureProfileForUser(user: User, fallbackEmail?: string) {
  const email = user.email ?? fallbackEmail ?? "";

  const { data: existing, error: selectError } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (selectError) throw selectError;
  if (existing) return;

  const { error: insertError } = await supabase.from("profiles").insert({
    id: user.id,
    email,
    display_name: email ? email.split("@")[0] : "新用户",
  });

  if (insertError && insertError.code !== "23505") {
    throw insertError;
  }
}
