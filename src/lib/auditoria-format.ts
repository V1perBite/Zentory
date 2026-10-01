const BOGOTA_TZ = "America/Bogota";

const CAMPO_LABEL: Record<string, string> = {
  nombre: "Nombre",
  email: "Email",
  rol: "Rol",
  activo: "Activo",
  sku_code: "Código",
  precio_venta: "Precio de venta",
  precio_costo: "Precio de costo",
  stock_actual: "Stock actual",
  minimo_stock: "Stock mínimo",
  identificacion: "Identificación",
  nit: "NIT",
  telefono: "Teléfono",
  direccion: "Dirección",
  estado: "Estado",
  subtotal: "Subtotal",
  descuento_total: "Descuento total",
  total: "Total",
  razon_anulacion: "Motivo de anulación",
  fecha_anulacion: "Fecha de anulación",
  usuario_anulacion_id: "Anulado por",
  puede_crear_productos: "Permiso: crear productos",
  puede_ver_auditoria: "Permiso: ver auditoría",
  puede_exportar_auditoria: "Permiso: exportar auditoría",
  numero_factura: "Número de factura",
  cliente_id: "Cliente",
  vendedor_id: "Vendedor",
  id: "ID",
  created_at: "Creado",
  updated_at: "Actualizado",
};

export function formatoFechaAuditoria(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-CO", {
    timeZone: BOGOTA_TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function etiquetaCampo(campo: string): string {
  return CAMPO_LABEL[campo] ?? campo.replace(/_/g, " ");
}

export function textoValor(valor: unknown): string {
  if (valor === null || valor === undefined || valor === "") return "—";
  if (typeof valor === "boolean") return valor ? "Sí" : "No";
  if (typeof valor === "object") return JSON.stringify(valor);
  return String(valor);
}

export type Diferencia = {
  campo: string;
  etiqueta: string;
  antes: string;
  despues: string;
  cambiado: boolean;
};

/**
 * Une las claves de valor anterior y valor nuevo y devuelve la fila
 * de la tabla ANTES → DESPUÉS (lo que pide la vista de detalle).
 */
export function calcularDiferencia(
  previos: Record<string, unknown> | null,
  nuevos: Record<string, unknown> | null,
): Diferencia[] {
  const claves = Array.from(
    new Set([...Object.keys(previos ?? {}), ...Object.keys(nuevos ?? {})]),
  ).sort();

  return claves.map((campo) => {
    const antes = textoValor(previos?.[campo]);
    const despues = textoValor(nuevos?.[campo]);
    return {
      campo,
      etiqueta: etiquetaCampo(campo),
      antes,
      despues,
      cambiado: antes !== despues,
    };
  });
}
