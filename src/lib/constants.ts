export const APP_NAME = "Zentory";

export const ROLES = {
  /** Sólo la cuenta protegida (davidromerogocel@gmail.com). No asignable desde la UI. */
  SUPERADMIN: "superadmin",
  ADMIN: "admin",
  VENDEDOR: "vendedor",
} as const;

export type UserRole = (typeof ROLES)[keyof typeof ROLES];

export const ROLES_LABEL: Record<UserRole, string> = {
  superadmin: "Superadmin",
  admin: "Admin",
  vendedor: "Vendedor",
};

export const FACTURA_ESTADOS = {
  PENDIENTE_IMPRESION: "pendiente_impresion",
  IMPRESA: "impresa",
  ANULADA: "anulada",
} as const;

export const TIPO_DESCUENTO = {
  PORCENTAJE: "porcentaje",
  VALOR: "valor",
} as const;

export const PERMISOS = {
  AUDITORIA_VER: "auditoria.ver",
  AUDITORIA_EXPORTAR: "auditoria.exportar",
} as const;

export type Permiso = (typeof PERMISOS)[keyof typeof PERMISOS];

export const AUDITORIA_MODULOS = {
  USUARIOS: "USUARIOS",
  PRODUCTOS: "PRODUCTOS",
  INVENTARIO: "INVENTARIO",
  FACTURACION: "FACTURACION",
  CONFIGURACION: "CONFIGURACION",
  SISTEMA: "SISTEMA",
} as const;

export type AuditoriaModulo =
  (typeof AUDITORIA_MODULOS)[keyof typeof AUDITORIA_MODULOS];

export const AUDITORIA_ENTIDADES = {
  USUARIO: "USUARIO",
  PRODUCTO: "PRODUCTO",
  MOVIMIENTO: "MOVIMIENTO",
  FACTURA: "FACTURA",
  CLIENTE: "CLIENTE",
  NEGOCIO: "NEGOCIO",
} as const;

export type AuditoriaEntidad =
  (typeof AUDITORIA_ENTIDADES)[keyof typeof AUDITORIA_ENTIDADES];

// Deben coincidir exactamente con los valores que escribe
// supabase/migrations/20261001_014_auditoria.sql
export const ACCIONES_AUDITORIA: Record<string, string> = {
  // Usuarios / sesión
  LOGIN: "Inicio de sesión",
  LOGOUT: "Cierre de sesión",
  LOGIN_FALLIDO: "Inicio de sesión fallido",
  USUARIO_CREADO: "Usuario creado",
  USUARIO_MODIFICADO: "Usuario modificado",
  USUARIO_ELIMINADO: "Usuario eliminado",
  ROL_CAMBIADO: "Cambio de rol",
  USUARIO_ACTIVADO: "Usuario activado",
  USUARIO_DESACTIVADO: "Usuario desactivado",
  PERMISO_CAMBIADO: "Cambio de permiso",
  // Productos
  PRODUCTO_CREADO: "Producto creado",
  PRODUCTO_MODIFICADO: "Producto modificado",
  PRODUCTO_PRECIO_MODIFICADO: "Cambio de precio",
  PRODUCTO_CODIGO_MODIFICADO: "Cambio de código",
  PRODUCTO_COSTO_MODIFICADO: "Cambio de costo",
  PRODUCTO_ESTADO_MODIFICADO: "Producto activado/desactivado",
  PRODUCTO_ELIMINADO: "Producto eliminado",
  // Inventario
  ENTRADA_MERCANCIA: "Entrada de mercancía",
  SALIDA_MERCANCIA: "Salida de mercancía",
  AJUSTE_INVENTARIO: "Ajuste manual",
  INVENTARIO_FISICO: "Inventario físico",
  PRODUCTO_DANADO: "Producto dañado",
  PERDIDA: "Pérdida",
  MERMA: "Merma",
  DEVOLUCION: "Devolución",
  // Facturación
  FACTURA_CREADA: "Factura creada",
  FACTURA_MODIFICADA: "Factura modificada",
  FACTURA_IMPRESA: "Factura marcada impresa",
  ANULACION_FACTURA: "Anulación de factura",
  FACTURA_ELIMINADA: "Factura eliminada",
  DESCUENTO_APLICADO: "Descuento aplicado",
  CLIENTE_CREADO: "Cliente creado",
  CLIENTE_MODIFICADO: "Cliente modificado",
  CLIENTE_ELIMINADO: "Cliente eliminado",
  // Configuración
  CONFIGURACION_CREADA: "Configuración creada",
  CONFIGURACION_MODIFICADA: "Configuración modificada",
  CONFIGURACION_ELIMINADA: "Configuración eliminada",
  // Exportaciones
  EXPORTACION_INVENTARIO: "Exportación de inventario",
  EXPORTACION_REPORTE: "Exportación de reporte",
  // Sistema
  EXPORTACION_AUDITORIA: "Exportación de auditoría",
};

export const MODULO_LABEL: Record<string, string> = {
  USUARIOS: "Usuarios",
  PRODUCTOS: "Productos",
  INVENTARIO: "Inventario",
  FACTURACION: "Facturación",
  CONFIGURACION: "Configuración",
  SISTEMA: "Sistema",
};

// Colores de badge por módulo (misma paleta que el resto de la app)
export const MODULO_BADGE: Record<string, string> = {
  USUARIOS: "bg-violet-100 text-violet-700",
  PRODUCTOS: "bg-indigo-100 text-indigo-700",
  INVENTARIO: "bg-amber-100 text-amber-700",
  FACTURACION: "bg-emerald-100 text-emerald-700",
  CONFIGURACION: "bg-sky-100 text-sky-700",
  SISTEMA: "bg-slate-200 text-slate-600",
};
