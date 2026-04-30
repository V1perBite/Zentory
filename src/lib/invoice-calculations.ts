import { TIPO_DESCUENTO } from "@/lib/constants";

export function formatCOP(value: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);
}

export type CartItemInput = {
  productoId: string;
  nombre: string;
  skuCode: string;
  precioUnitario: number;
  cantidad: number;
  descuentoItem: number;
  tipoDescuentoItem: "porcentaje" | "valor";
};

export function calcItemSubtotal(item: CartItemInput) {
  const bruto = item.precioUnitario * item.cantidad;
  const descuento =
    item.tipoDescuentoItem === TIPO_DESCUENTO.PORCENTAJE
      ? (bruto * item.descuentoItem) / 100
      : item.descuentoItem;

  return Math.max(bruto - descuento, 0);
}

export function calcFacturaTotals(
  items: CartItemInput[],
  descuentoGlobalTipo: "porcentaje" | "valor",
  descuentoGlobalValor: number,
) {
  const subtotal = items.reduce((sum, item) => sum + calcItemSubtotal(item), 0);

  const descuentoGlobal =
    descuentoGlobalTipo === TIPO_DESCUENTO.PORCENTAJE
      ? (subtotal * descuentoGlobalValor) / 100
      : descuentoGlobalValor;

  const descuentoTotal = Math.min(Math.max(descuentoGlobal, 0), subtotal);
  const total = Math.max(subtotal - descuentoTotal, 0);

  return {
    subtotal,
    descuentoTotal,
    total,
  };
}
