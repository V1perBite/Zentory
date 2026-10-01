"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { hasPermission, requireProfile } from "@/lib/auth";
import { PERMISOS } from "@/lib/constants";
import { auditService, type AuditInput } from "@/lib/audit";
import { construirQueryAuditoria } from "@/lib/auditoria-query";
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

function escalar(valor: unknown): string {
  if (valor === null || valor === undefined) return "";
  if (typeof valor === "object") return JSON.stringify(valor);
  return String(valor);
}

function aCsv(filas: Record<string, unknown>[]): string {
  const columnas = [
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

  const celda = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lineas = [columnas.map(([titulo]) => celda(titulo)).join(",")];

  for (const fila of filas) {
    lineas.push(columnas.map(([, key]) => celda(escalar(fila[key]))).join(","));
  }

  // BOM para que Excel abra los acentos correctamente
  return `\uFEFF${lineas.join("\r\n")}`;
}

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

  const marca = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  return { csv: aCsv(filas), filename: `auditoria-${marca}.csv` };
}
