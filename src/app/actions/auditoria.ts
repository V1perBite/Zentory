"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { hasPermission, isAdmin, requireProfile } from "@/lib/auth";
import { PERMISOS } from "@/lib/constants";
import { auditService, type AuditInput } from "@/lib/audit";
import { construirQueryAuditoria } from "@/lib/auditoria-query";
import { aCsv, marcaArchivo } from "@/lib/csv";
import type { AuditoriaFiltros } from "@/lib/types";

const MAX_EXPORTAR = 5000;

function ipActual(): string | null {
  const h = headers();
  const directa = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return directa || h.get("x-real-ip")?.trim() || null;
}

/**
 * Registra un evento de auditoría que no nace de una tabla
 * (login, logout, login fallido, creación de usuario, exportación).
 * Siempre desde servidor: aquí existe la IP de la petición.
 */
export async function registrarEventoAuditoria(
  input: AuditInput,
): Promise<{ error?: string }> {
  try {
    const supabase = createClient();
    await auditService.log(
      { ...input, ip: input.ip ?? ipActual() },
      supabase,
    );
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error de auditoría" };
  }
}

/**
 * Guarda la IP de la sesión en usuarios.ultima_ip (una vez por sesión)
 * para que los triggers de BD puedan registrarla en cada evento.
 */
export async function sincronizarIp(): Promise<void> {
  const ip = ipActual();
  if (!ip) return;

  try {
    const supabase = createClient();
    await auditService.registrarIp(ip, supabase);
  } catch (err) {
    console.error("[auditoria] no se pudo sincronizar la IP:", err);
  }
}

/**
 * Deja constancia de la exportación de un reporte. Los reportes se arman
 * en el navegador, así que éste es el único punto donde queda registro.
 */
export async function registrarExportacionReporte(
  reporte: string,
  total: number,
): Promise<{ error?: string }> {
  try {
    const profile = await requireProfile();
    if (!isAdmin(profile)) return { error: "Sin permisos." };

    const supabase = createClient();
    await auditService.log(
      {
        action: "EXPORTACION_REPORTE",
        module: "SISTEMA",
        entityType: "USUARIO",
        entityId: profile.id,
        entityRef: profile.email,
        description: `Exportación del reporte ${reporte} (${total} filas)`,
        metadata: { reporte, total },
        ip: ipActual(),
      },
      supabase,
    );
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error de auditoría" };
  }
}

const COLUMNAS_AUDITORIA = [
  ["fecha", "created_at"],
  ["usuario", "usuario_nombre"],
  ["email", "usuario_email"],
  ["accion", "accion"],
  ["modulo", "modulo"],
  ["entidad", "entidad"],
  ["referencia", "entidad_ref"],
  ["descripcion", "descripcion"],
  ["ip", "ip"],
  ["motivo", "motivo"],
  ["valor_anterior", "valores_previos"],
  ["valor_nuevo", "valores_nuevos"],
] as const;

/**
 * Exporta los eventos filtrados a CSV. Requiere auditoria.exportar
 * y deja constancia de la exportación en la propia auditoría.
 */
export async function exportarAuditoriaCSV(
  filtros: AuditoriaFiltros,
): Promise<{ csv?: string; filename?: string; error?: string }> {
  const profile = await requireProfile();
  if (!hasPermission(profile, PERMISOS.AUDITORIA_EXPORTAR)) {
    return { error: "No tienes permiso para exportar la auditoría." };
  }

  const supabase = createClient();
  const { data, error } = await construirQueryAuditoria(supabase, filtros).limit(
    MAX_EXPORTAR,
  );

  if (error) return { error: error.message };

  const filas = (data ?? []) as Record<string, unknown>[];

  await auditService.log(
    {
      action: "EXPORTACION_AUDITORIA",
      module: "SISTEMA",
      entityType: "USUARIO",
      entityId: profile.id,
      entityRef: profile.email,
      description: `Exportación de ${filas.length} eventos de auditoría`,
      metadata: { filtros, total: filas.length },
    },
    supabase,
  );

  const marca = marcaArchivo();
  return {
    csv: aCsv(filas, COLUMNAS_AUDITORIA),
    filename: `auditoria-${marca}.csv`,
  };
}
