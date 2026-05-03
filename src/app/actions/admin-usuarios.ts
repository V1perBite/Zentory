"use server";

import { createServerClient } from "@supabase/ssr";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import type { UserRole } from "@/lib/constants";

function createAdminClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { get: () => undefined, set: () => {}, remove: () => {} } },
  );
}

export async function createUsuario(params: {
  nombre: string;
  email: string;
  password: string;
  rol: UserRole;
}): Promise<{ error?: string }> {
  const profile = await requireProfile();
  if (profile.rol !== ROLES.ADMIN) return { error: "Sin permisos." };

  const adminClient = createAdminClient();

  const { error } = await adminClient.auth.admin.createUser({
    email: params.email,
    password: params.password,
    email_confirm: true,
    user_metadata: { nombre: params.nombre, rol: params.rol },
  });

  if (error) return { error: error.message };
  return {};
}

export async function toggleUsuarioActivo(params: {
  id: string;
  activo: boolean;
}): Promise<{ error?: string }> {
  const profile = await requireProfile();
  if (profile.rol !== ROLES.ADMIN) return { error: "Sin permisos." };
  if (profile.id === params.id) return { error: "No puedes desactivarte a ti mismo." };

  const supabase = createClient();
  const { error } = await supabase
    .from("usuarios")
    .update({ activo: !params.activo })
    .eq("id", params.id);

  if (error) return { error: error.message };
  return {};
}

export async function togglePuedeCrearProductos(params: {
  id: string;
  puedeCrear: boolean;
}): Promise<{ error?: string }> {
  const profile = await requireProfile();
  if (profile.rol !== ROLES.ADMIN) return { error: "Sin permisos." };

  const supabase = createClient();
  const { error } = await supabase
    .from("usuarios")
    .update({ puede_crear_productos: !params.puedeCrear })
    .eq("id", params.id);

  if (error) return { error: error.message };
  return {};
}
