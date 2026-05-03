import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Usuario } from "@/lib/types";

export async function getSessionUser() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function getCurrentProfile(): Promise<Usuario | null> {
  const user = await getSessionUser();
  if (!user) return null;

  const supabase = createClient();
  const { data, error } = await supabase
    .from("usuarios")
    .select("id,nombre,email,rol,activo,puede_crear_productos,created_at")
    .eq("id", user.id)
    .single();

  if (error || !data) return null;
  return data as Usuario;
}

export async function requireProfile() {
  const profile = await getCurrentProfile();
  if (!profile) {
    redirect("/login");
  }

  if (!profile.activo) {
    redirect("/login?error=usuario-inactivo");
  }

  return profile;
}
