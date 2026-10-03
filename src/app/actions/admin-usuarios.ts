"use server";

import { createServerClient } from "@supabase/ssr";
import { createClient } from "@/lib/supabase/server";
import { isAdmin, requireProfile } from "@/lib/auth";
import { AUDITORIA_ENTIDADES, AUDITORIA_MODULOS, ROLES } from "@/lib/constants";
import type { UserRole } from "@/lib/constants";
import { registrarEventoAuditoria } from "@/app/actions/auditoria";

type UsuarioFila = {
  id: string;
  nombre: string;
  email: string | null;
  rol: string;
  activo: boolean;
};

function createAdminClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { get: () => undefined, set: () => {}, remove: () => {} } },
  );
}

/** Lee la fila con el cliente de sesión (respeta RLS). */
async function cargarUsuario(id: string): Promise<UsuarioFila | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from("usuarios")
    .select("id,nombre,email,rol,activo")
    .eq("id", id)
    .maybeSingle();
  return (data as UsuarioFila | null) ?? null;
}

export async function createUsuario(params: {
  nombre: string;
  email: string;
  password: string;
  rol: UserRole;
}): Promise<{ error?: string }> {
  const profile = await requireProfile();
  if (!isAdmin(profile)) return { error: "Sin permisos." };

  const nombre = params.nombre.trim();
  const email = params.email.trim();
  if (!nombre) return { error: "El nombre es obligatorio." };
  if (!email) return { error: "El correo es obligatorio." };
  if (params.rol === ROLES.SUPERADMIN) {
    return { error: "El rol superadmin no se puede asignar." };
  }

  const adminClient = createAdminClient();

  const { data, error } = await adminClient.auth.admin.createUser({
    email,
    password: params.password,
    email_confirm: true,
    user_metadata: { nombre, rol: params.rol },
  });

  if (error) return { error: error.message };

  // La fila de usuarios la crea handle_new_auth_user sin actor, así que el
  // trigger de auditoría la omite: aquí se registra con el admin real.
  await registrarEventoAuditoria({
    action: "USUARIO_CREADO",
    module: AUDITORIA_MODULOS.USUARIOS,
    entityType: AUDITORIA_ENTIDADES.USUARIO,
    entityId: data.user?.id ?? null,
    entityRef: email,
    description: `Usuario creado: ${nombre} (${params.rol})`,
    newValue: {
      nombre,
      email,
      rol: params.rol,
      activo: true,
    },
  });

  return {};
}

export async function updateUsuario(params: {
  id: string;
  nombre: string;
  email: string;
  /** Vacío / no enviado = no cambia la contraseña. */
  password?: string;
  rol: UserRole;
}): Promise<{ error?: string }> {
  const profile = await requireProfile();
  if (!isAdmin(profile)) return { error: "Sin permisos." };

  const nombre = params.nombre.trim();
  const email = params.email.trim();
  if (!nombre) return { error: "El nombre es obligatorio." };
  if (!email) return { error: "El correo es obligatorio." };

  const password = params.password?.trim() ?? "";
  if (password && password.length < 6) {
    return { error: "La contraseña debe tener al menos 6 caracteres." };
  }

  const target = await cargarUsuario(params.id);
  if (!target) return { error: "Usuario no encontrado." };

  // La fila superadmin sólo se modifica a sí misma; su rol no cambia nunca.
  const esFilaSuperadmin = target.rol === ROLES.SUPERADMIN;
  if (esFilaSuperadmin && profile.id !== params.id) {
    return { error: "Sólo la cuenta superadmin puede modificarse a sí misma." };
  }
  if (esFilaSuperadmin && params.rol !== ROLES.SUPERADMIN) {
    return { error: "No se puede cambiar el rol superadmin." };
  }
  if (!esFilaSuperadmin && profile.id === params.id && params.rol !== target.rol) {
    return { error: "No puedes cambiar tu propio rol." };
  }
  if (!esFilaSuperadmin && params.rol === ROLES.SUPERADMIN) {
    return { error: "El rol superadmin no se puede asignar." };
  }

  const rol = esFilaSuperadmin ? ROLES.SUPERADMIN : params.rol;
  const adminClient = createAdminClient();

  // 1) Auth (valida unicidad de correo y contraseña)…
  const { error: authError } = await adminClient.auth.admin.updateUserById(params.id, {
    email,
    email_confirm: true,
    ...(password ? { password } : {}),
    user_metadata: { nombre, rol },
  });
  if (authError) return { error: authError.message };

  // 2) …y la fila de la app. El trigger trg_auditoria_usuarios registra
  //    el diff OLD/NEW (nombre, correo, rol) automáticamente.
  const supabase = createClient();
  const { error } = await supabase
    .from("usuarios")
    .update({ nombre, email, rol })
    .eq("id", params.id);
  if (error) return { error: error.message };

  // El cambio de contraseña no toca ninguna tabla, así que ningún trigger
  // lo ve: queda registrado aquí (el RPC sanitiza cualquier valor sensible).
  if (password) {
    await registrarEventoAuditoria({
      action: "USUARIO_MODIFICADO",
      module: AUDITORIA_MODULOS.USUARIOS,
      entityType: AUDITORIA_ENTIDADES.USUARIO,
      entityId: params.id,
      entityRef: email,
      description: `Contraseña actualizada: ${email}`,
      newValue: { campo: "contraseña" },
    });
  }

  return {};
}

export async function deleteUsuario(params: {
  id: string;
}): Promise<{ error?: string }> {
  const profile = await requireProfile();
  if (!isAdmin(profile)) return { error: "Sin permisos." };
  if (profile.id === params.id) {
    return { error: "No puedes eliminar tu propia cuenta." };
  }

  const target = await cargarUsuario(params.id);
  if (!target) return { error: "Usuario no encontrado." };
  if (target.rol === ROLES.SUPERADMIN) {
    return { error: "No se puede eliminar la cuenta superadmin." };
  }

  // El usuario sólo se puede borrar si no deja huella en el histórico:
  // facturas, movimientos de kardex y anulaciones referencian su id.
  const supabase = createClient();
  const [facturas, movimientos, anulaciones] = await Promise.all([
    supabase
      .from("facturas")
      .select("id", { count: "exact", head: true })
      .eq("vendedor_id", params.id),
    supabase
      .from("movimientos_stock")
      .select("id", { count: "exact", head: true })
      .eq("usuario_id", params.id),
    supabase
      .from("facturas")
      .select("id", { count: "exact", head: true })
      .eq("usuario_anulacion_id", params.id),
  ]);
  if (facturas.error || movimientos.error || anulaciones.error) {
    return { error: "No se pudo verificar el historial del usuario." };
  }
  if (
    (facturas.count ?? 0) > 0 ||
    (movimientos.count ?? 0) > 0 ||
    (anulaciones.count ?? 0) > 0
  ) {
    return {
      error:
        "Ese usuario tiene facturas o movimientos asociados: desactívalo en su lugar.",
    };
  }

  const adminClient = createAdminClient();
  const { error } = await adminClient.auth.admin.deleteUser(params.id);
  if (error) {
    if (error.message.toLowerCase().includes("foreign key")) {
      return {
        error:
          "Ese usuario tiene facturas o movimientos asociados: desactívalo en su lugar.",
      };
    }
    return { error: error.message };
  }

  // deleteUser corre desde GoTrue (sin auth.uid()), así que el trigger de
  // auditoría de la tabla no tiene actor y omite el evento: lo registramos aquí.
  await registrarEventoAuditoria({
    action: "USUARIO_ELIMINADO",
    module: AUDITORIA_MODULOS.USUARIOS,
    entityType: AUDITORIA_ENTIDADES.USUARIO,
    entityId: params.id,
    entityRef: target.email,
    description: `Usuario eliminado: ${target.nombre} (${target.rol})`,
    oldValue: {
      nombre: target.nombre,
      email: target.email,
      rol: target.rol,
      activo: target.activo,
    },
  });

  return {};
}

export async function toggleUsuarioActivo(params: {
  id: string;
  activo: boolean;
}): Promise<{ error?: string }> {
  const profile = await requireProfile();
  if (!isAdmin(profile)) return { error: "Sin permisos." };
  if (profile.id === params.id) return { error: "No puedes desactivarte a ti mismo." };

  const target = await cargarUsuario(params.id);
  if (!target) return { error: "Usuario no encontrado." };
  if (target.rol === ROLES.SUPERADMIN) {
    return { error: "La cuenta superadmin no puede desactivarse." };
  }

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
  if (!isAdmin(profile)) return { error: "Sin permisos." };

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
  if (!isAdmin(profile)) return { error: "Sin permisos." };

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
