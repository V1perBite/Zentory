import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient as createClientCliente } from "@/lib/supabase/client";

/**
 * AuditService — punto central de auditoría para toda la aplicación.
 *
 * Registros que provienen de tablas (productos, facturas, stock, usuarios,
 * negocio, clientes) los escriben los triggers de BD
 * (ver supabase/migrations/20261001_014_auditoria.sql): así no hay que
 * duplicar lógica en cada módulo y se capturan OLD/NEW exactos.
 *
 * Este servicio sólo registra los eventos que NO tienen fila en una tabla
 * (LOGIN, LOGIN_FALLIDO, LOGOUT, USUARIO_CREADO, EXPORTACION_AUDITORIA),
 * que son los que la BD no puede ver.
 *
 * Nunca lanza excepciones: un fallo de auditoría no puede romper el
 * flujo de negocio.
 */

export type AuditInput = {
  /** Código de acción, ver ACCIONES_AUDITORIA en @/lib/constants */
  action: string;
  /** Módulo, ver AUDITORIA_MODULOS */
  module: string;
  /** Entidad afectada, ver AUDITORIA_ENTIDADES */
  entityType: string;
  entityId?: string | null;
  /** Referencia legible: SKU, N° de factura, identificación, email */
  entityRef?: string | null;
  description?: string | null;
  oldValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
  reason?: string | null;
  /** Sólo disponible en contextos de servidor (headers de la petición) */
  ip?: string | null;
  metadata?: Record<string, unknown> | null;
};

type RpcClient = Pick<SupabaseClient, "rpc">;

function defaultClient(): RpcClient {
  return createClientCliente();
}

export const auditService = {
  async log(input: AuditInput, client?: RpcClient): Promise<void> {
    try {
      const supabase = client ?? defaultClient();
      const { error } = await supabase.rpc("auditoria_registrar", {
        p_accion: input.action,
        p_modulo: input.module,
        p_entidad: input.entityType,
        p_entidad_id: input.entityId ?? null,
        p_entidad_ref: input.entityRef ?? null,
        p_descripcion: input.description ?? null,
        p_valores_previos: input.oldValue ?? null,
        p_valores_nuevos: input.newValue ?? null,
        p_motivo: input.reason ?? null,
        p_ip: input.ip ?? null,
        p_metadata: input.metadata ?? null,
      });

      if (error) {
        console.error("[auditoria] no se pudo registrar:", error.message);
      }
    } catch (err) {
      console.error("[auditoria] error inesperado:", err);
    }
  },

  /**
   * Guarda la IP de la sesión actual en usuarios.ultima_ip para que los
   * triggers de BD puedan incluirla en cada evento. Sólo escribe si cambió.
   */
  async registrarIp(ip: string | null, client?: RpcClient): Promise<void> {
    if (!ip) return;
    try {
      const supabase = client ?? defaultClient();
      const { error } = await supabase.rpc("auditoria_registrar_ip", {
        p_ip: ip,
      });
      if (error) {
        console.error("[auditoria] no se pudo guardar la IP:", error.message);
      }
    } catch (err) {
      console.error("[auditoria] error guardando IP:", err);
    }
  },
};
