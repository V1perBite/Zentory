import { PERMISOS, ROLES, type Permiso } from "@/lib/constants";
import type { Usuario } from "@/lib/types";

/**
 * Regla de permisos de la aplicación — sin dependencias de servidor,
 * usable tanto en componentes cliente (menú) como en el servidor
 * (páginas y acciones).
 *
 * El admin tiene todos los permisos; el resto depende de las banderas
 * de la fila del usuario (usuarios.puede_*), nunca del cliente.
 */
export function hasPermission(
  profile: Usuario | null,
  permiso: Permiso,
): boolean {
  if (!profile || !profile.activo) return false;
  if (profile.rol === ROLES.ADMIN) return true;

  switch (permiso) {
    case PERMISOS.AUDITORIA_VER:
      return profile.puede_ver_auditoria === true;
    case PERMISOS.AUDITORIA_EXPORTAR:
      return profile.puede_exportar_auditoria === true;
    default:
      return false;
  }
}
