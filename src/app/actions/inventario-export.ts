"use server";

import { createClient } from "@/lib/supabase/server";
import { isAdmin, requireProfile } from "@/lib/auth";
import { auditService } from "@/lib/audit";
import { aCsv, marcaArchivo, type ColumnaCsv } from "@/lib/csv";

/**
 * Las primeras 6 columnas son exactamente las del template de import
 * (import-csv-modal.tsx) para que el ciclo exportar -> editar -> importar
 * cierre sin perder datos. Las 2 últimas son de solo lectura y el parser
 * de import las ignora.
 */
const COLUMNAS: readonly ColumnaCsv[] = [
  ["nombre", "nombre"],
  ["sku_code", "sku_code"],
  ["precio_venta", "precio_venta"],
  ["precio_costo", "precio_costo"],
  ["stock_actual", "stock_actual"],
  ["minimo_stock", "minimo_stock"],
  ["activo", "activo"],
  ["valor_inventario", "valor_inventario"],
];

const PAGINA = 1000;
const TOPE_SEGURIDAD = 100000;

/**
 * Exporta el catálogo completo de productos a CSV con todos sus datos.
 * Sólo administradores: incluye precio_costo y valor del inventario.
 */
export async function exportarInventarioCSV(): Promise<{
  csv?: string;
  filename?: string;
  error?: string;
}> {
  const profile = await requireProfile();
  if (!isAdmin(profile)) {
    return { error: "Solo un administrador puede exportar el inventario." };
  }

  const supabase = createClient();
  const filas: Array<Record<string, unknown>> = [];
  let desde = 0;

  for (;;) {
    const { data, error } = await supabase
      .from("productos")
      .select(
        "nombre,sku_code,precio_venta,precio_costo,stock_actual,minimo_stock,activo",
      )
      .order("nombre", { ascending: true })
      .order("id", { ascending: true })
      .range(desde, desde + PAGINA - 1);

    if (error) return { error: error.message };

    const lote = data ?? [];
    for (const p of lote) {
      const costo = Number(p.precio_costo ?? 0);
      filas.push({
        nombre: p.nombre,
        sku_code: p.sku_code,
        precio_venta: p.precio_venta,
        precio_costo: costo,
        stock_actual: p.stock_actual,
        minimo_stock: p.minimo_stock,
        activo: p.activo ? "true" : "false",
        valor_inventario: costo * Number(p.stock_actual ?? 0),
      });
    }

    if (lote.length < PAGINA) break;
    desde += PAGINA;
    if (desde >= TOPE_SEGURIDAD) break;
  }

  await auditService.log(
    {
      action: "EXPORTACION_INVENTARIO",
      module: "INVENTARIO",
      entityType: "PRODUCTO",
      entityId: null,
      entityRef: profile.email,
      description: `Exportación de ${filas.length} productos del inventario`,
      metadata: { total: filas.length },
    },
    supabase,
  );

  return {
    csv: aCsv(filas, COLUMNAS),
    filename: `inventario-${marcaArchivo()}.csv`,
  };
}
