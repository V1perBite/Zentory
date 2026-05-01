import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ROLES } from "@/lib/constants";
import { HistorialClient } from "@/components/historial/historial-client";

type HistorialPageProps = {
  searchParams?: {
    estado?: string;
    desde?: string;
    hasta?: string;
    numero?: string;
    vendedor_id?: string;
  };
};

export default async function HistorialPage({ searchParams }: HistorialPageProps) {
  const profile = await requireProfile();
  const isAdmin = profile.rol === ROLES.ADMIN;

  const supabase = createClient();
  const estado = searchParams?.estado?.trim() ?? "";
  const desde = searchParams?.desde?.trim() ?? "";
  const hasta = searchParams?.hasta?.trim() ?? "";
  const numero = searchParams?.numero?.trim() ?? "";
  const vendedorId = searchParams?.vendedor_id?.trim() ?? "";

  let query = supabase
    .from("facturas")
    .select(
      "id,numero_factura,subtotal,descuento_total,total,estado,created_at,vendedor_id,cliente:clientes(nombre),vendedor:usuarios(nombre),items:items_factura(cantidad,precio_unitario,descuento_item,subtotal_item,producto:productos(nombre))",
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (estado) query = query.eq("estado", estado);
  if (desde) query = query.gte("created_at", `${desde}T00:00:00`);
  if (hasta) query = query.lte("created_at", `${hasta}T23:59:59`);
  if (numero && /^\d+$/.test(numero)) query = query.eq("numero_factura", Number(numero));
  if (isAdmin) {
    if (vendedorId) query = query.eq("vendedor_id", vendedorId);
  } else {
    query = query.eq("vendedor_id", profile.id);
  }

  const [{ data: facturasRaw }, { data: vendedores }] = await Promise.all([
    query,
    isAdmin
      ? supabase.from("usuarios").select("id,nombre").eq("activo", true).order("nombre")
      : Promise.resolve({ data: [] as Array<{ id: string; nombre: string }> }),
  ]);

  const facturas = (facturasRaw ?? []).map((f) => {
    // eslint-disable-next-line
    const v = f.vendedor as any;
    const vendedorNombre = Array.isArray(v) ? (v[0]?.nombre ?? "-") : (v?.nombre ?? "-");

    // eslint-disable-next-line
    const c = f.cliente as any;
    const clienteNombre = Array.isArray(c) ? (c[0]?.nombre ?? "-") : (c?.nombre ?? "-");

    // eslint-disable-next-line
    const items = ((f.items ?? []) as any[]).map((fi) => ({
      nombre: Array.isArray(fi.producto)
        ? (fi.producto[0]?.nombre ?? "-")
        : (fi.producto?.nombre ?? "-"),
      cantidad: fi.cantidad,
      subtotal: Number(fi.subtotal_item),
    }));

    return {
      id: f.id,
      numero_factura: f.numero_factura,
      subtotal: Number(f.subtotal),
      descuento_total: Number(f.descuento_total),
      total: Number(f.total),
      estado: f.estado,
      created_at: f.created_at,
      cliente: clienteNombre,
      vendedor: vendedorNombre,
      items,
    };
  });

  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold">Historial de facturas</h1>
          <p className="text-sm text-slate-600">
            {isAdmin ? "Vista global · puedes anular facturas desde aquí." : "Vista de tus facturas."}
          </p>
        </div>
      </div>

      <form className="grid gap-2 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-6">
        <input
          name="numero"
          defaultValue={numero}
          placeholder="N° factura"
          className="rounded border border-slate-300 px-2 py-2 text-sm"
        />
        <select
          name="estado"
          defaultValue={estado}
          className="rounded border border-slate-300 px-2 py-2 text-sm"
        >
          <option value="">Todos los estados</option>
          <option value="pendiente_impresion">Pendiente</option>
          <option value="impresa">Impresa</option>
          <option value="anulada">Anulada</option>
        </select>
        {isAdmin ? (
          <select
            name="vendedor_id"
            defaultValue={vendedorId}
            className="rounded border border-slate-300 px-2 py-2 text-sm"
          >
            <option value="">Todos los vendedores</option>
            {(vendedores ?? []).map((v) => (
              <option key={v.id} value={v.id}>
                {v.nombre}
              </option>
            ))}
          </select>
        ) : (
          <div className="hidden sm:block" />
        )}
        <input
          name="desde"
          type="date"
          defaultValue={desde}
          className="rounded border border-slate-300 px-2 py-2 text-sm"
        />
        <input
          name="hasta"
          type="date"
          defaultValue={hasta}
          className="rounded border border-slate-300 px-2 py-2 text-sm"
        />
        <button type="submit" className="rounded bg-slate-900 px-3 py-2 text-sm text-white">
          Filtrar
        </button>
      </form>

      <HistorialClient facturas={facturas} isAdmin={isAdmin} />
    </section>
  );
}
