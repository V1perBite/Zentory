import { PERMISOS, ROLES, type Permiso } from "@/lib/constants";
import type { Usuario } from "@/lib/types";

/**
 * Regla de permisos de la aplicación — sin dependencias de servidor,
 * usable tanto en componentes cliente (menú) como en el servidor
 * (páginas y acciones).
 *
 * Roles:
 *   superadmin → todos los permisos; sólo esa cuenta puede gestionar
 *                usuarios (y nunca a la propia cuenta superadmin).
 *   admin      → todos los permisos menos tocar la fila superadmin.
 *   vendedor   → sólo lo que habiliten las banderas de su fila
 *                (usuarios.puede_*), nunca del cliente.
 *
 * En BD la misma regla vive en is_admin() / proteger_superadmin()
 * (migrations 016), así que RLS y app nunca se contradicen.
 */

/** true si el rol dado es admin o superadmin (para filas/props con el rol suelto). */
export function isAdminRole(rol: string | null | undefined): boolean {
  return rol === ROLES.ADMIN || rol === ROLES.SUPERADMIN;
}

/** true si el perfil tiene permisos de administrador. */
export function isAdmin(profile: Usuario | null): boolean {
  return profile ? isAdminRole(profile.rol) : false;
}

/** true sólo para la cuenta protegida (superadmin). */
export function isSuperAdmin(profile: Usuario | null): boolean {
  return profile?.rol === ROLES.SUPERADMIN;
}

export function hasPermission(
  profile: Usuario | null,
  permiso: Permiso,
): boolean {
  if (!profile || !profile.activo) return false;
  if (isAdmin(profile)) return true;

  switch (permiso) {
    case PERMISOS.AUDITORIA_VER:
      return profile.puede_ver_auditoria === true;
    case PERMISOS.AUDITORIA_EXPORTAR:
      return profile.puede_exportar_auditoria === true;
    default:
      return false;
  }
}
