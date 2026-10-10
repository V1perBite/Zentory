"use server";

import { createClient } from "@/lib/supabase/server";
import { isAdmin, requireProfile } from "@/lib/auth";
import {
  AUDITORIA_ENTIDADES,
  AUDITORIA_MODULOS,
  ESTADOS_COMPRA,
} from "@/lib/constants";
import type { EstadoCompra } from "@/lib/types";
import { registrarEventoAuditoria } from "@/app/actions/auditoria";
import { aCsv, marcaArchivo, type ColumnaCsv } from "@/lib/csv";

export type FacturaCompraInput = {
  empresa: string;
  numero_factura?: string | null;
  concepto?: string | null;
  valor: number | string;
  fecha_recibida: string;
  fecha_pago?: string | null;
  estado: EstadoCompra;
  notas?: string | null;
};

type Fila = Record<string, unknown>;

const CAMPOS =
  "id,empresa,numero_factura,concepto,valor,valor_abonado,fecha_recibida,fecha_pago,estado,notas,creado_por,created_at,updated_at";

function validar(input: FacturaCompraInput): string | null {
  if (!input.empresa.trim()) return "La empresa es obligatoria.";
  const valor = Number(input.valor);
  if (!Number.isFinite(valor) || valor < 0) {
    return "El valor debe ser un número mayor o igual a 0.";
  }
  if (!input.fecha_recibida) return "La fecha de recibida es obligatoria.";
  if (input.fecha_pago && input.fecha_pago < input.fecha_recibida) {
    return "La fecha de pago no puede ser anterior a la fecha de recibida.";
  }
  if (!(input.estado in ESTADOS_COMPRA)) return "Estado no válido.";
  return null;
}

function normalizar(input: FacturaCompraInput) {
  return {
    empresa: input.empresa.trim(),
    numero_factura: input.numero_factura?.trim() || null,
    concepto: input.concepto?.trim() || null,
    valor: Number(input.valor),
    fecha_recibida: input.fecha_recibida,
    fecha_pago: input.fecha_pago || null,
    estado: input.estado,
    notas: input.notas?.trim() || null,
  };
}

async function leerFila(
  id: string,
): Promise<{ fila: Fila | null; error?: string }> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("facturas_compra")
    .select(CAMPOS)
    .eq("id", id)
    .maybeSingle();
  if (error) return { fila: null, error: error.message };
  return { fila: (data as Fila | null) ?? null };
}

export async function crearFacturaCompra(
  input: FacturaCompraInput,
): Promise<{ error?: string }> {
  const profile = await requireProfile();
  if (!isAdmin(profile)) return { error: "Sin permisos." };

  const problema = validar(input);
  if (problema) return { error: problema };

  const valores = normalizar(input);
  const supabase = createClient();
  const { data, error } = await supabase
    .from("facturas_compra")
    .insert(valores)
    .select(CAMPOS)
    .single();
  if (error) return { error: error.message };

  const fila = data as Fila;
  await registrarEventoAuditoria({
    action: "COMPRA_CREADA",
    module: AUDITORIA_MODULOS.COMPRAS,
    entityType: AUDITORIA_ENTIDADES.FACTURA_COMPRA,
    entityId: fila.id as string,
    entityRef: valores.numero_factura ?? valores.empresa,
    description: `Factura de compra creada: ${valores.empresa} (${valores.valor})`,
    newValue: valores,
  });

  return {};
}

export async function actualizarFacturaCompra(
  id: string,
  input: FacturaCompraInput,
): Promise<{ error?: string }> {
  const profile = await requireProfile();
  if (!isAdmin(profile)) return { error: "Sin permisos." };

  const problema = validar(input);
  if (problema) return { error: problema };

  const { fila: previa, error: errorLectura } = await leerFila(id);
  if (errorLectura) return { error: errorLectura };
  if (!previa) return { error: "La factura de compra ya no existe." };

  const valores = normalizar(input);
  const abonadoPrevio = Number(previa.valor_abonado ?? 0);
  const supabase = createClient();
  const { error } = await supabase
    .from("facturas_compra")
    .update({
      ...valores,
      valor_abonado:
        valores.estado === "pagada"
          ? Number(valores.valor)
          : Math.min(abonadoPrevio, Number(valores.valor)),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { error: error.message };

  await registrarEventoAuditoria({
    action: "COMPRA_MODIFICADA",
    module: AUDITORIA_MODULOS.COMPRAS,
    entityType: AUDITORIA_ENTIDADES.FACTURA_COMPRA,
    entityId: id,
    entityRef: (previa.empresa as string) ?? null,
    description: `Factura de compra modificada: ${valores.empresa}`,
    oldValue: previa,
    newValue: valores,
  });

  return {};
}

export async function eliminarFacturaCompra(
  id: string,
): Promise<{ error?: string }> {
  const profile = await requireProfile();
  if (!isAdmin(profile)) return { error: "Sin permisos." };

  const { fila, error: errorLectura } = await leerFila(id);
  if (errorLectura) return { error: errorLectura };
  if (!fila) return { error: "La factura de compra ya no existe." };

  const supabase = createClient();
  const { error } = await supabase
    .from("facturas_compra")
    .delete()
    .eq("id", id);
  if (error) return { error: error.message };

  await registrarEventoAuditoria({
    action: "COMPRA_ELIMINADA",
    module: AUDITORIA_MODULOS.COMPRAS,
    entityType: AUDITORIA_ENTIDADES.FACTURA_COMPRA,
    entityId: id,
    entityRef: (fila.empresa as string) ?? null,
    description: `Factura de compra eliminada: ${fila.empresa} (${fila.valor})`,
    oldValue: fila,
  });

  return {};
}

export async function registrarAbono(
  id: string,
  monto: number,
): Promise<{ error?: string }> {
  const profile = await requireProfile();
  if (!isAdmin(profile)) return { error: "Sin permisos." };

  if (!Number.isFinite(monto) || monto <= 0) {
    return { error: "El abono debe ser un número mayor a 0." };
  }

  const { fila: previa, error: errorLectura } = await leerFila(id);
  if (errorLectura) return { error: errorLectura };
  if (!previa) return { error: "La factura de compra ya no existe." };
  if (previa.estado === "anulada") {
    return { error: "No se puede abonar a una factura anulada." };
  }
  if (previa.estado === "pagada") {
    return { error: "La factura ya está pagada en su totalidad." };
  }

  const valor = Number(previa.valor ?? 0);
  const abonado = Number(previa.valor_abonado ?? 0);
  const saldo = valor - abonado;
  if (monto > saldo + 0.01) {
    return {
      error: `El abono (${monto}) supera el saldo pendiente (${saldo.toFixed(2)}).`,
    };
  }

  const nuevoAbonado = abonado + monto;
  const saldada = nuevoAbonado >= valor - 0.01;
  const ahora = new Date().toISOString();
  const hoyISO = ahora.slice(0, 10);

  const cambios = {
    valor_abonado: nuevoAbonado,
    estado: saldada ? "pagada" : "parcial",
    fecha_pago: saldada ? hoyISO : previa.fecha_pago,
    updated_at: ahora,
  };

  const supabase = createClient();
  const { error } = await supabase
    .from("facturas_compra")
    .update(cambios)
    .eq("id", id);
  if (error) return { error: error.message };

  await registrarEventoAuditoria({
    action: "COMPRA_ABONO",
    module: AUDITORIA_MODULOS.COMPRAS,
    entityType: AUDITORIA_ENTIDADES.FACTURA_COMPRA,
    entityId: id,
    entityRef: (previa.empresa as string) ?? null,
    description: `Abono de ${monto} a factura de compra de ${previa.empresa} (saldo anterior: ${saldo.toFixed(2)})`,
    oldValue: { valor_abonado: abonado, estado: previa.estado },
    newValue: { valor_abonado: nuevoAbonado, estado: cambios.estado },
  });

  return {};
}

const COLUMNAS: readonly ColumnaCsv[] = [
  ["empresa", "empresa"],
  ["numero_factura", "numero_factura"],
  ["concepto", "concepto"],
  ["valor", "valor"],
  ["valor_abonado", "valor_abonado"],
  ["fecha_recibida", "fecha_recibida"],
  ["fecha_pago", "fecha_pago"],
  ["estado", "estado"],
  ["notas", "notas"],
  ["registrada_el", "created_at"],
];

const PAGINA = 1000;
const TOPE_SEGURIDAD = 100000;

/** Exporta el registro completo de compras. Sólo admin/superadmin. */
export async function exportarComprasCSV(): Promise<{
  csv?: string;
  filename?: string;
  error?: string;
}> {
  const profile = await requireProfile();
  if (!isAdmin(profile)) return { error: "Sin permisos." };

  const supabase = createClient();
  const filas: Fila[] = [];
  let desde = 0;

  for (;;) {
    const { data, error } = await supabase
      .from("facturas_compra")
      .select(CAMPOS)
      .order("fecha_recibida", { ascending: false })
      .order("created_at", { ascending: false })
      .range(desde, desde + PAGINA - 1);

    if (error) return { error: error.message };

    const lote = data ?? [];
    filas.push(...(lote as Fila[]));
    if (lote.length < PAGINA) break;
    desde += PAGINA;
    if (desde >= TOPE_SEGURIDAD) break;
  }

  await registrarEventoAuditoria({
    action: "EXPORTACION_COMPRA",
    module: AUDITORIA_MODULOS.COMPRAS,
    entityType: AUDITORIA_ENTIDADES.FACTURA_COMPRA,
    description: `Exportación de ${filas.length} facturas de compra`,
    metadata: { total: filas.length },
  });

  return {
    csv: aCsv(filas, COLUMNAS),
    filename: `compras-${marcaArchivo()}.csv`,
  };
}
