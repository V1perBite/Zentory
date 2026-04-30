import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { NuevaFacturaClient } from "@/components/facturas/nueva-factura-client";

export default async function NuevaFacturaPage() {
  await requireProfile();
  const supabase = createClient();

  const { data: productosRaw } = await supabase
    .from("productos")
    .select("id,nombre,sku_code,precio_venta,stock_actual")
    .eq("activo", true)
    .order("nombre", { ascending: true })
    .limit(500);

  const productos = (productosRaw ?? []) as {
    id: string;
    nombre: string;
    sku_code: string;
    precio_venta: number;
    stock_actual: number;
  }[];

  return <NuevaFacturaClient productos={productos} />;
}
