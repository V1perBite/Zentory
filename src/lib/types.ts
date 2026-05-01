import type { UserRole } from "./constants";

export type Usuario = {
  id: string;
  nombre: string;
  email: string | null;
  rol: UserRole;
  activo: boolean;
  created_at: string;
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
