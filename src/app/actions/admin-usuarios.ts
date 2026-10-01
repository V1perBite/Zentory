"use server";

import { createServerClient } from "@supabase/ssr";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { AUDITORIA_ENTIDADES, AUDITORIA_MODULOS, ROLES } from "@/lib/constants";
import type { UserRole } from "@/lib/constants";
import { registrarEventoAuditoria } from "@/app/actions/auditoria";

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

  const { data, error } = await adminClient.auth.admin.createUser({
    email: params.email,
    password: params.password,
    email_confirm: true,
    user_metadata: { nombre: params.nombre, rol: params.rol },
  });

  if (error) return { error: error.message };

  // La fila de usuarios la crea handle_new_auth_user sin actor, así que el
  // trigger de auditoría la omite: aquí se registra con el admin real.
  await registrarEventoAuditoria({
    action: "USUARIO_CREADO",
    module: AUDITORIA_MODULOS.USUARIOS,
    entityType: AUDITORIA_ENTIDADES.USUARIO,
    entityId: data.user?.id ?? null,
    entityRef: params.email,
    description: `Usuario creado: ${params.nombre} (${params.rol})`,
    newValue: {
      nombre: params.nombre,
      email: params.email,
      rol: params.rol,
      activo: true,
    },
  });

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

export async function togglePermisoAuditoria(params: {
  id: string;
  permiso: "ver" | "exportar";
  valor: boolean;
}): Promise<{ error?: string }> {
  const profile = await requireProfile();
  if (profile.rol !== ROLES.ADMIN) return { error: "Sin permisos." };

  const supabase = createClient();
  const cambios =
    params.permiso === "ver"
      ? { puede_ver_auditoria: params.valor }
      : { puede_exportar_auditoria: params.valor };

  const { error } = await supabase
    .from("usuarios")
    .update(cambios)
    .eq("id", params.id);

  if (error) return { error: error.message };
  return {};
}
