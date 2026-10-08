import type { UserRole } from "./constants";

export type Usuario = {
  id: string;
  nombre: string;
  email: string | null;
  rol: UserRole;
  activo: boolean;
  puede_crear_productos?: boolean;
  puede_ver_auditoria?: boolean;
  puede_exportar_auditoria?: boolean;
  created_at: string;
};

export type AuditoriaEvento = {
  id: string;
  usuario_id: string | null;
  usuario_nombre: string | null;
  usuario_email: string | null;
  accion: string;
  modulo: string;
  entidad: string;
  entidad_id: string | null;
  entidad_ref: string | null;
  descripcion: string | null;
  ip: string | null;
  valores_previos: Record<string, unknown> | null;
  valores_nuevos: Record<string, unknown> | null;
  motivo: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export type AuditoriaFiltros = {
  usuario?: string;
  desde?: string;
  hasta?: string;
  accion?: string;
  modulo?: string;
  producto?: string;
  factura?: string;
  cliente?: string;
  page?: number;
};

export type Producto = {
  id: string;
  nombre: string;
  sku_code: string;
  precio_venta: number;
  precio_costo: number;
  stock_actual: number;
  minimo_stock: number;
  activo: boolean;
  created_at: string;
};

export type Cliente = {
  id: string;
  nombre: string;
  identificacion: string;
  nit: string | null;
  email: string | null;
  telefono: string | null;
  direccion: string | null;
};

export type Negocio = {
  id: string;
  nombre: string;
  direccion: string | null;
  telefono: string | null;
  email: string | null;
  nit: string | null;
  updated_at: string;
  negocio_mensajes?: NegocioMensaje[];
};

export type NegocioMensaje = {
  id: string;
  negocio_id: string;
  tipo: "encabezado" | "cierre";
  orden: number;
  texto: string;
};

export type Factura = {
  id: string;
  numero_factura: number;
  cliente_id: string;
  vendedor_id: string;
  subtotal: number;
  descuento_total: number;
  total: number;
  estado: "pendiente_impresion" | "impresa" | "anulada";
  created_at: string;
  razon_anulacion?: string | null;
  fecha_anulacion?: string | null;
  usuario_anulacion_id?: string | null;
};

export type FacturaConDetalle = Factura & {
  cliente: Cliente;
  vendedor: Pick<Usuario, "id" | "nombre">;
  items: Array<{
    id: string;
    factura_id: string;
    producto_id: string;
    cantidad: number;
    precio_unitario: number;
    descuento_item: number;
    tipo_descuento_item: "porcentaje" | "valor";
    subtotal_item: number;
    producto: Pick<Producto, "nombre" | "sku_code">;
  }>;
};

/** Registro contable de una factura de proveedor (módulo Compras). */
export type EstadoCompra = "pendiente" | "parcial" | "pagada" | "anulada";

export type FacturaCompra = {
  id: string;
  empresa: string;
  numero_factura: string | null;
  concepto: string | null;
  valor: number;
  fecha_recibida: string;
  fecha_pago: string | null;
  estado: EstadoCompra;
  notas: string | null;
  creado_por: string | null;
  created_at: string;
  updated_at: string;
};
