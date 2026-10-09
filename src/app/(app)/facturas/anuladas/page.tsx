import { redirect } from "next/navigation";
import Link from "next/link";
import { isAdmin, requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatCOP } from "@/lib/invoice-calculations";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Search, FileX } from "lucide-react";

const TH =
  "px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground";

type PageProps = {
  searchParams?: {
    desde?: string;
    hasta?: string;
    numero?: string;
  };
};

const BOGOTA_TZ = "America/Bogota";
const LOCALE = "es-CO";

function fmtFecha(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(LOCALE, {
    timeZone: BOGOTA_TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function FacturasAnuladasPage({ searchParams }: PageProps) {
  const profile = await requireProfile();
  if (!isAdmin(profile)) redirect("/facturas/nueva");

  const supabase = createClient();

  const desde = searchParams?.desde?.trim() ?? "";
  const hasta = searchParams?.hasta?.trim() ?? "";
  const numero = searchParams?.numero?.trim() ?? "";

  let query = supabase
    .from("facturas")
    .select(
      [
        "id",
        "numero_factura",
        "total",
        "created_at",
        "fecha_anulacion",
        "razon_anulacion",
        // join al usuario que anuló (puede ser NULL en facturas pre-migración)
        "usuario_anulacion:usuarios!usuario_anulacion_id(nombre)",
      ].join(","),
    )
    .eq("estado", "anulada")
    .order("fecha_anulacion", { ascending: false, nullsFirst: false });

  // Filtrar por rango de fecha de anulación. Si la factura no tiene
  // fecha_anulacion (registros anteriores a la auditoría), el rango se
  // aplica sobre created_at para que nunca desaparezca de los resultados.
  const esFecha = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);
  const desdeIso = desde && esFecha(desde) ? `${desde}T00:00:00` : null;
  const hastaIso = hasta && esFecha(hasta) ? `${hasta}T23:59:59` : null;

  if (desdeIso && hastaIso) {
    query = query.or(
      `and(fecha_anulacion.gte."${desdeIso}",fecha_anulacion.lte."${hastaIso}"),and(fecha_anulacion.is.null,created_at.gte."${desdeIso}",created_at.lte."${hastaIso}")`,
    );
  } else if (desdeIso) {
    query = query.or(
      `fecha_anulacion.gte."${desdeIso}",and(fecha_anulacion.is.null,created_at.gte."${desdeIso}")`,
    );
  } else if (hastaIso) {
    query = query.or(
      `fecha_anulacion.lte."${hastaIso}",and(fecha_anulacion.is.null,created_at.lte."${hastaIso}")`,
    );
  }

  if (numero && /^\d+$/.test(numero))
    query = query.eq("numero_factura", Number(numero));

  const { data: raw } = await query.limit(500);

  // eslint-disable-next-line
  const rows = (raw ?? []).map((f: any) => {
    const u = f.usuario_anulacion;
    const usuarioNombre: string = Array.isArray(u)
      ? (u[0]?.nombre ?? "—")
      : (u?.nombre ?? "—");
    return {
      id: f.id as string,
      numero_factura: f.numero_factura as number,
      total: Number(f.total),
      created_at: f.created_at as string,
      fecha_anulacion: f.fecha_anulacion as string | null,
      razon_anulacion: f.razon_anulacion as string | null,
      usuarioNombre,
    };
  });

  return (
    <section className="space-y-6">
      {/* Encabezado */}
      <PageHeader
        back="/facturas"
        backLabel="Volver a facturas"
        title="Registro de anulaciones"
        subtitle={`Solo visible para administradores · ${rows.length} factura${
          rows.length !== 1 ? "s" : ""
        } anulada${rows.length !== 1 ? "s" : ""}`}
        icon={
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
            <FileX className="h-5 w-5" />
          </span>
        }
      />

      {/* Filtros */}
      <Card className="border-border shadow-soft">
        <CardContent className="p-4">
          <form className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-1.5">
              <Label htmlFor="a-numero" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                N° factura
              </Label>
              <Input
                id="a-numero"
                name="numero"
                defaultValue={numero}
                inputMode="numeric"
                placeholder="Ej. 1024"
                className="h-9 rounded-lg tabular-nums"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="a-desde" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Desde
              </Label>
              <Input id="a-desde" name="desde" type="date" defaultValue={desde} className="h-9 rounded-lg" />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="a-hasta" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Hasta
              </Label>
              <Input id="a-hasta" name="hasta" type="date" defaultValue={hasta} className="h-9 rounded-lg" />
            </div>

            <div className="flex items-end gap-2">
              <Button type="submit" className="h-9 flex-1 rounded-lg">
                <Search className="mr-2 h-4 w-4" />
                Filtrar
              </Button>
              {desde || hasta || numero ? (
                <Link
                  href="/facturas/anuladas"
                  className="flex h-9 items-center rounded-lg border border-border px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  Limpiar
                </Link>
              ) : null}
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Tabla — escritorio */}
      <div className="hidden overflow-hidden rounded-2xl border border-border bg-card shadow-soft md:block">
        <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="border-b border-border bg-accent/60 text-left">
            <tr>
              <th className={TH}>N°</th>
              <th className={TH}>Fecha venta</th>
              <th className={TH}>Fecha anulación</th>
              <th className={TH}>Anulado por</th>
              <th className={TH}>Motivo</th>
              <th className={cn(TH, "text-right")}>Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/70">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-16 text-center text-sm text-muted-foreground">
                  <FileX className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
                  No hay facturas anuladas con los filtros aplicados.
                </td>
              </tr>
            ) : null}
            {rows.map((f) => (
              <tr key={f.id} className="transition-opacity hover:bg-accent/50">
                <td className="px-4 py-3 font-bold text-foreground tabular-nums">
                  <Link
                    href={`/historial/${f.id}`}
                    className="text-primary hover:underline"
                  >
                    #{f.numero_factura}
                  </Link>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-muted-foreground tabular-nums">
                  {fmtFecha(f.created_at)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-muted-foreground tabular-nums">
                  {fmtFecha(f.fecha_anulacion)}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{f.usuarioNombre}</td>
                <td className="max-w-xs px-4 py-3 text-muted-foreground">
                  {f.razon_anulacion ? (
                    <span title={f.razon_anulacion}>
                      {f.razon_anulacion.length > 80
                        ? f.razon_anulacion.slice(0, 80) + "…"
                        : f.razon_anulacion}
                    </span>
                  ) : (
                    <span className="italic text-muted-foreground/60">Sin motivo registrado</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right font-bold text-foreground line-through tabular-nums">
                  {formatCOP(f.total)}
                </td>
              </tr>
            ))}
          </tbody>
          {rows.length > 0 && (
            <tfoot className="border-t border-border bg-accent/60">
              <tr>
                <td colSpan={5} className="px-4 py-2 text-xs text-muted-foreground">
                  {rows.length} factura{rows.length !== 1 ? "s" : ""} anulada
                  {rows.length !== 1 ? "s" : ""}
                </td>
                <td className="px-4 py-2 text-right text-xs font-semibold text-foreground tabular-nums">
                  {formatCOP(rows.reduce((s, r) => s + r.total, 0))} devueltos
                </td>
              </tr>
            </tfoot>
          )}
        </table>
        </div>
      </div>

      {/* Tarjetas — móvil */}
      <div className="grid gap-3 md:hidden">
        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card py-12 text-center">
            <FileX className="mb-2 h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              No hay facturas anuladas con los filtros aplicados.
            </p>
          </div>
        ) : null}
        {rows.map((f) => (
          <div
            key={f.id}
            className="rounded-2xl border border-border bg-card p-4 opacity-85 shadow-soft"
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Link
                  href={`/historial/${f.id}`}
                  className="font-bold text-primary hover:underline tabular-nums"
                >
                  #{f.numero_factura}
                </Link>
                <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                  Venta: {fmtFecha(f.created_at)}
                </p>
                <p className="text-xs text-muted-foreground tabular-nums">
                  Anulada: {fmtFecha(f.fecha_anulacion)}
                </p>
              </div>
              <p className="shrink-0 font-bold text-muted-foreground line-through tabular-nums">
                {formatCOP(f.total)}
              </p>
            </div>
            <p className="mb-1 text-xs font-medium text-muted-foreground">Por: {f.usuarioNombre}</p>
            {f.razon_anulacion ? (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                {f.razon_anulacion}
              </p>
            ) : (
              <p className="text-xs italic text-muted-foreground/60">Sin motivo registrado</p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
