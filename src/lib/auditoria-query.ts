import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuditoriaFiltros } from "@/lib/types";

const esFecha = (v?: string) => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);

const escapar = (v: string) => v.replace(/[%_]/g, (c) => `\\${c}`);

/**
 * Filtros compartidos entre la pantalla de auditoría (server component)
 * y la exportación CSV (server action): una sola definición de qué
 * significa cada filtro.
 */
export function construirQueryAuditoria(
  supabase: SupabaseClient,
  filtros: AuditoriaFiltros,
) {
  let query = supabase
    .from("auditoria_eventos")
    .select("*", { count: "exact" });

  if (filtros.usuario) query = query.eq("usuario_id", filtros.usuario);
  if (filtros.modulo) query = query.eq("modulo", filtros.modulo);
  if (filtros.accion) query = query.eq("accion", filtros.accion);

  if (filtros.producto) {
    query = query
      .eq("entidad", "PRODUCTO")
      .ilike("entidad_ref", `%${escapar(filtros.producto)}%`);
  }
  if (filtros.factura) {
    query = query
      .eq("entidad", "FACTURA")
      .ilike("entidad_ref", `%${escapar(filtros.factura)}%`);
  }
  if (filtros.cliente) {
    query = query
      .eq("entidad", "CLIENTE")
      .ilike("entidad_ref", `%${escapar(filtros.cliente)}%`);
  }

  if (esFecha(filtros.desde)) query = query.gte("created_at", `${filtros.desde}T00:00:00`);
  if (esFecha(filtros.hasta)) query = query.lte("created_at", `${filtros.hasta}T23:59:59`);

  return query.order("created_at", { ascending: false });
}

export function leerFiltros(searchParams: Record<string, string | undefined>): AuditoriaFiltros {
  const numero = (v?: string) => (v && /^\d+$/.test(v) ? Number(v) : undefined);
  return {
    usuario: searchParams.usuario?.trim() || undefined,
    desde: searchParams.desde?.trim() || undefined,
    hasta: searchParams.hasta?.trim() || undefined,
    accion: searchParams.accion?.trim() || undefined,
    modulo: searchParams.modulo?.trim() || undefined,
    producto: searchParams.producto?.trim() || undefined,
    factura: searchParams.factura?.trim() || undefined,
    cliente: searchParams.cliente?.trim() || undefined,
    page: numero(searchParams.page) ?? 1,
  };
}
