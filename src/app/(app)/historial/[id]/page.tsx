import { notFound } from "next/navigation";
import { isAdmin, requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Ticket } from "@/components/printing/ticket";
import { PageHeader } from "@/components/page-header";
import type { FacturaConDetalle, Negocio } from "@/lib/types";

type HistorialDetailPageProps = {
  params: {
    id: string;
  };
};

export default async function HistorialDetailPage({ params }: HistorialDetailPageProps) {
  const profile = await requireProfile();
  const supabase = createClient();

  const { data, error } = await supabase
    .from("facturas")
    .select(
      "id,numero_factura,cliente_id,vendedor_id,subtotal,descuento_total,total,estado,created_at,razon_anulacion,cliente:clientes(id,nombre,identificacion,telefono,direccion),vendedor:usuarios!facturas_vendedor_id_fkey(id,nombre),items:items_factura(id,factura_id,producto_id,cantidad,precio_unitario,descuento_item,tipo_descuento_item,subtotal_item,producto:productos(nombre,sku_code))",
    )
    .eq("id", params.id)
    .single();

  if (error && error.code !== "PGRST116") {
    throw new Error(`No se pudo cargar la factura: ${error.message}`);
  }

  const factura = data as unknown as FacturaConDetalle | null;

  if (!factura) {
    notFound();
  }

  if (!isAdmin(profile) && factura.vendedor_id !== profile.id) {
    notFound();
  }

  const { data: negocioData } = await supabase
    .from("negocio")
    .select("*, negocio_mensajes(*)")
    .limit(1)
    .single();
  const negocio = negocioData as Negocio | null;

  return (
    <section className="space-y-4">
      <PageHeader
        back="/historial"
        backLabel="Volver al historial de facturas"
        title={`Detalle de factura #${factura.numero_factura}`}
        subtitle="Vista de solo lectura."
      />

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <Ticket factura={factura} negocio={negocio} />
      </div>
    </section>
  );
}
