import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ROLES } from "@/lib/constants";
import { Ticket } from "@/components/printing/ticket";
import type { FacturaConDetalle, Negocio } from "@/lib/types";

type HistorialDetailPageProps = {
  params: {
    id: string;
  };
};

export default async function HistorialDetailPage({ params }: HistorialDetailPageProps) {
  const profile = await requireProfile();
  const supabase = createClient();

  const { data } = await supabase
    .from("facturas")
    .select(
      "id,numero_factura,cliente_id,vendedor_id,subtotal,descuento_total,total,estado,created_at,cliente:clientes(id,nombre,identificacion,telefono,direccion),vendedor:usuarios(id,nombre),items:items_factura(id,factura_id,producto_id,cantidad,precio_unitario,descuento_item,tipo_descuento_item,subtotal_item,producto:productos(nombre,sku_code))",
    )
    .eq("id", params.id)
    .single();

  const factura = data as unknown as FacturaConDetalle | null;

  if (!factura) {
    notFound();
  }

  const { data: negocioData } = await supabase
    .from("negocio")
    .select("*, negocio_mensajes(*)")
    .limit(1)
    .single();
  const negocio = negocioData as Negocio | null;

  if (profile.rol !== ROLES.ADMIN && factura.vendedor_id !== profile.id) {
    notFound();
  }

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Detalle de factura #{factura.numero_factura}</h1>
        <p className="text-sm text-slate-600">Vista de solo lectura.</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <Ticket factura={factura} negocio={negocio} />
      </div>
    </section>
  );
}
