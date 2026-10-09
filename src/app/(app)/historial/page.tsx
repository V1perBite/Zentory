import Link from "next/link";
import { History, Search } from "lucide-react";
import { isAdminRole, requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { HistorialClient } from "@/components/historial/historial-client";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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

  const isAdmin = isAdminRole(profile.rol);

  const supabase = createClient();
  const estado = searchParams?.estado?.trim() ?? "";
  const desde = searchParams?.desde?.trim() ?? "";
  const hasta = searchParams?.hasta?.trim() ?? "";
  const numero = searchParams?.numero?.trim() ?? "";
  const vendedorId = searchParams?.vendedor_id?.trim() ?? "";

  let query = supabase
    .from("facturas")
    .select(
      "id,numero_factura,subtotal,descuento_total,total,estado,created_at,vendedor_id,razon_anulacion,cliente:clientes(nombre),vendedor:usuarios!facturas_vendedor_id_fkey(nombre),items:items_factura(cantidad,precio_unitario,descuento_item,subtotal_item,producto:productos(nombre))",
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

  const [{ data: facturasRaw, error: facturasError }, { data: vendedores, error: vendedoresError }] =
    await Promise.all([
      query,
      isAdmin
        ? supabase.from("usuarios").select("id,nombre").eq("activo", true).order("nombre")
        : Promise.resolve({ data: [] as Array<{ id: string; nombre: string }>, error: null }),
    ]);

  const queryError = facturasError ?? vendedoresError ?? null;

  if (queryError) {
    throw new Error(`No se pudo cargar el historial de facturas: ${queryError.message}`);
  }

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
      razon_anulacion: f.razon_anulacion ?? null,
    };
  });

  return (
    <section className="space-y-4">
      <PageHeader
        title="Historial de facturas"
        subtitle={
          isAdmin
            ? "Vista global · puedes anular facturas desde aquí."
            : "Vista de tus facturas."
        }
        icon={
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-accent-foreground">
            <History className="h-5 w-5" />
          </span>
        }
        actions={<Badge variant="outline" className="tabular-nums">{facturas.length} resultados</Badge>}
      />

      <Card className="border-border shadow-soft">
        <CardContent className="p-4">
          <form className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
            <div className="space-y-1.5">
              <Label htmlFor="f-numero" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                N° factura
              </Label>
              <Input
                id="f-numero"
                name="numero"
                defaultValue={numero}
                inputMode="numeric"
                placeholder="Ej. 1024"
                className="h-9 rounded-lg tabular-nums"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="f-estado" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Estado
              </Label>
              <select
                id="f-estado"
                name="estado"
                defaultValue={estado}
                className="flex h-9 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background"
              >
                <option value="">Todos los estados</option>
                <option value="pendiente_impresion">Pendiente</option>
                <option value="impresa">Impresa</option>
                <option value="anulada">Anulada</option>
              </select>
            </div>

            {isAdmin ? (
              <div className="space-y-1.5">
                <Label htmlFor="f-vendedor" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Vendedor
                </Label>
                <select
                  id="f-vendedor"
                  name="vendedor_id"
                  defaultValue={vendedorId}
                  className="flex h-9 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background"
                >
                  <option value="">Todos los vendedores</option>
                  {(vendedores ?? []).map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.nombre}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="hidden xl:block" />
            )}

            <div className="space-y-1.5">
              <Label htmlFor="f-desde" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Desde
              </Label>
              <Input
                id="f-desde"
                name="desde"
                type="date"
                defaultValue={desde}
                className="h-9 rounded-lg"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="f-hasta" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Hasta
              </Label>
              <Input
                id="f-hasta"
                name="hasta"
                type="date"
                defaultValue={hasta}
                className="h-9 rounded-lg"
              />
            </div>

            <div className="flex items-end gap-2 sm:col-span-2 xl:col-span-1">
              <Button type="submit" className="h-9 flex-1 rounded-lg">
                <Search className="mr-2 h-4 w-4" />
                Filtrar
              </Button>
              <Link
                href="/historial"
                className="flex h-9 items-center rounded-lg border border-border px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                Limpiar
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>

      <HistorialClient facturas={facturas} isAdmin={isAdmin} />
    </section>
  );
}
