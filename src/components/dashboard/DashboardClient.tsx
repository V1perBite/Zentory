"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  AlertCircle,
  Clock,
  Loader2,
  Receipt,
  LayoutDashboard,
} from "lucide-react";
import { getDashboardStats, type DateRangeKey } from "@/app/actions/dashboard";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { useCountUp } from "@/hooks/use-count-up";
import { cn } from "@/lib/utils";

const formatCurrency = (val: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(val);

type KpiTone = "default" | "warning";

function KpiCard({
  label,
  value,
  format = "currency",
  sub,
  delta,
  tone = "default",
  className,
}: {
  label: string;
  value: number;
  format?: "currency" | "percent" | "int";
  sub?: React.ReactNode;
  delta?: number | null;
  tone?: KpiTone;
  className?: string;
}) {
  const animated = useCountUp(value);

  const texto =
    format === "currency"
      ? formatCurrency(animated)
      : format === "percent"
        ? `${animated.toFixed(1)}%`
        : Math.round(animated).toLocaleString("es-CO");

  return (
    <Card
      className={cn(
        "border-border shadow-soft transition-shadow hover:shadow-lift",
        className,
      )}
    >
      <CardContent className="flex h-full flex-col gap-1 p-4">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <span
          className={cn(
            "truncate text-2xl font-bold tabular-nums",
            tone === "warning" && value > 0
              ? "text-amber-600"
              : "text-foreground",
          )}
        >
          {texto}
        </span>
        {typeof delta === "number" ? (
          <span
            className={cn(
              "flex items-center gap-1 text-xs font-medium",
              delta >= 0 ? "text-emerald-600" : "text-rose-600",
            )}
          >
            {delta >= 0 ? (
              <TrendingUp className="h-3.5 w-3.5" />
            ) : (
              <TrendingDown className="h-3.5 w-3.5" />
            )}
            <span>{Math.abs(delta).toFixed(1)}% vs anterior</span>
          </span>
        ) : sub ? (
          <span className="text-xs text-muted-foreground">{sub}</span>
        ) : null}
      </CardContent>
    </Card>
  );
}

function EstadoTile({
  label,
  count,
  total,
  tone,
}: {
  label: string;
  count: number;
  total: number;
  tone: "emerald" | "amber" | "slate";
}) {
  const percent = useCountUp(total > 0 ? Math.round((count / total) * 100) : 0);

  const toneClass =
    tone === "emerald"
      ? "border-emerald-200/70 bg-emerald-50 text-emerald-600"
      : tone === "amber"
        ? "border-amber-200/70 bg-amber-50 text-amber-600"
        : "border-border bg-accent text-slate-600";

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border p-3 text-center",
        toneClass,
      )}
    >
      <span className="text-2xl font-bold tabular-nums">{Math.round(percent)}%</span>
      <span className="mt-1 text-[11px] font-semibold uppercase tracking-wide">
        {label}
      </span>
      <span className="mt-0.5 text-[10px] tabular-nums opacity-80">
        {count} facturas
      </span>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard de Facturación y Ventas"
        subtitle="Cargando el panel analítico…"
        icon={
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-accent-foreground">
            <LayoutDashboard className="h-5 w-5" />
          </span>
        }
      />
      <Card>
        <CardContent className="p-4">
          <Skeleton className="h-10 w-full max-w-xs" />
        </CardContent>
      </Card>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="flex flex-col gap-2.5 p-4">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-7 w-32" />
              <Skeleton className="h-3.5 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-5">
              <Skeleton className="mb-4 h-5 w-56" />
              <Skeleton className="h-72 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default function DashboardClient() {
  const [dateRange, setDateRange] = useState<DateRangeKey>("ultimos_7_dias");
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const stats = await getDashboardStats(dateRange);
        setData(stats);
      } catch (error) {
        console.error("Error cargando estadísticas", error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [dateRange]);

  if (!data && loading) {
    return <DashboardSkeleton />;
  }

  const { metrics, chartData, topProductos, estadosCount, bajoStock, compras } = data || {
    metrics: { ventas: 0, ganancia: 0, facturas: 0, prevVentas: 0, prevGanancia: 0 },
    chartData: [], topProductos: [], estadosCount: { impresas: 0, pendientes: 0, anuladas: 0 },
    bajoStock: [] as Array<{ id: string; nombre: string; stock: number; minimo: number }>,
    compras: {
      pendientePago: 0,
      pendientesCount: 0,
      diasVencida: 30,
      porPagar: [] as Array<{
        id: string;
        empresa: string;
        numero_factura: string | null;
        valor: number;
        fecha_recibida: string;
        dias: number;
        diasRestantes: number;
      }>,
    },
  };

  const margen = metrics.ventas > 0 ? ((metrics.ganancia / metrics.ventas) * 100).toFixed(1) : "0.0";
  const ticketPromedio = metrics.facturas > 0 ? (metrics.ventas / metrics.facturas).toFixed(2) : "0.00";
  
  const getComparativa = (current: number, prev: number) => {
    if (prev === 0) return current > 0 ? 100 : 0;
    return ((current - prev) / prev) * 100;
  };

  const comparativaVentas = getComparativa(metrics.ventas, metrics.prevVentas);
  const comparativaGanancia = getComparativa(metrics.ganancia, metrics.prevGanancia);

  const comparativaData = [
    { name: "Ventas", actual: metrics.ventas, anterior: metrics.prevVentas },
    { name: "Ganancia", actual: metrics.ganancia, anterior: metrics.prevGanancia },
  ];

  const totalFacturas = estadosCount.impresas + estadosCount.pendientes + estadosCount.anuladas;

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Dashboard de Facturación y Ventas"
        subtitle="Panel analítico de rendimiento comercial en tiempo real"
        icon={
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-accent-foreground">
            <LayoutDashboard className="h-5 w-5" />
          </span>
        }
      />

      {/* Filtros Globales */}
      <Card className="border-border shadow-soft">
        <CardContent className="flex flex-wrap items-end gap-4 p-4">
          <div className="flex w-full flex-col gap-1.5 sm:w-auto">
            <Label
              htmlFor="dash-rango"
              className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
            >
              Rango de fechas
            </Label>
            <select
              id="dash-rango"
              className="h-9 rounded-lg border border-input bg-background px-3 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as DateRangeKey)}
              disabled={loading}
            >
              <option value="hoy">Hoy</option>
              <option value="ultimos_7_dias">Últimos 7 días</option>
              <option value="ultimos_30_dias">Últimos 30 días</option>
              <option value="este_mes">Este mes</option>
              <option value="mes_anterior">Mes anterior</option>
            </select>
          </div>
          <div
            aria-live="polite"
            className="text-sm font-medium text-primary"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Actualizando…
              </span>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {/* KPIs Principales */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
        <KpiCard
          label="Ventas totales"
          value={metrics.ventas}
          delta={comparativaVentas}
          className="animate-fade-in-up stagger-1"
        />

        <KpiCard
          label="Ganancia neta"
          value={metrics.ganancia}
          delta={comparativaGanancia}
          className="animate-fade-in-up stagger-2"
        />

        <KpiCard
          label="Margen de ganancia"
          value={Number(margen)}
          format="percent"
          sub="Margen operativo"
          className="animate-fade-in-up stagger-3"
        />

        <KpiCard
          label="Facturas emitidas"
          value={metrics.facturas}
          format="int"
          sub="Válidas en el periodo"
          className="animate-fade-in-up stagger-4"
        />

        <KpiCard
          label="Ticket promedio"
          value={Number(ticketPromedio)}
          sub="Ventas / Facturas"
          className="animate-fade-in-up stagger-5"
        />

        {/* Pendiente de pago (Compras) — saldo actual, no depende del rango */}
        <KpiCard
          label="Pendiente de pago"
          value={compras.pendientePago}
          tone="warning"
          sub={`${compras.pendientesCount} factura${compras.pendientesCount === 1 ? "" : "s"} · saldo actual`}
          className="animate-fade-in-up stagger-5"
        />
      </div>

      {/* Análisis Gráfico */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="border-border shadow-soft">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Evolución de ventas (periodo)</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className="h-72 w-full"
              role="img"
              aria-label={
                chartData.length > 0
                  ? `Gráfico de líneas con la evolución de ventas en ${chartData.length} puntos del periodo.`
                  : "Gráfico de evolución de ventas sin datos en este periodo."
              }
            >
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="time" tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} tickFormatter={(val) => `$${val}`} />
                    <Tooltip
                      formatter={(value: any) => [formatCurrency(Number(value) || 0), "Ventas"]}
                      contentStyle={{ borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 6px 16px -4px rgb(15 23 42 / 0.12)" }}
                    />
                    <Line type="monotone" dataKey="ventas" stroke="#4f46e5" strokeWidth={3} dot={{ r: 4, fill: "#4f46e5" }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  No hay ventas en este periodo
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border shadow-soft">
          <CardHeader className="pb-2">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <CardTitle className="text-base">Comparativa vs periodo anterior</CardTitle>
              <div className="flex items-center gap-3 text-xs font-medium">
                <span className={comparativaVentas >= 0 ? "text-emerald-600" : "text-rose-600"}>
                  Ventas {comparativaVentas >= 0 ? "+" : "−"}{Math.abs(comparativaVentas).toFixed(1)}%
                </span>
                <span className={comparativaGanancia >= 0 ? "text-emerald-600" : "text-rose-600"}>
                  Ganancia {comparativaGanancia >= 0 ? "+" : "−"}{Math.abs(comparativaGanancia).toFixed(1)}%
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div
              className="h-72 w-full"
              role="img"
              aria-label={`Gráfico de barras comparando el periodo actual con el anterior. Ventas: ${formatCurrency(metrics.ventas)} frente a ${formatCurrency(metrics.prevVentas)}. Ganancia: ${formatCurrency(metrics.ganancia)} frente a ${formatCurrency(metrics.prevGanancia)}.`}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={comparativaData} margin={{ top: 5, right: 0, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} tickFormatter={(val) => `$${val}`} />
                  <Tooltip formatter={(value: any) => [formatCurrency(Number(value) || 0), ""]} cursor={{ fill: "rgba(148, 163, 184, 0.12)" }} contentStyle={{ borderRadius: "12px", border: "1px solid #e2e8f0" }} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: "12px" }} />
                  <Bar dataKey="actual" name="Periodo actual" fill="#4f46e5" radius={[6, 6, 0, 0]} barSize={34} />
                  <Bar dataKey="anterior" name="Periodo anterior" fill="#cbd5e1" radius={[6, 6, 0, 0]} barSize={34} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Rendimiento Productos */}
      <Card className="border-border shadow-soft">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Top productos más vendidos</CardTitle>
        </CardHeader>
        <CardContent>
          {topProductos.length > 0 ? (
            <>
              {/* Listado en tarjetas (móvil) */}
              <ul className="space-y-2 md:hidden">
                {topProductos.map((p: any) => (
                  <li
                    key={p.id}
                    className="rounded-xl border border-border bg-card px-3 py-2.5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="min-w-0 truncate text-sm font-semibold text-foreground">
                        {p.nombre}
                      </p>
                      <span className="shrink-0 text-sm font-bold tabular-nums text-foreground">
                        {formatCurrency(p.ventas)}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-3 text-xs text-muted-foreground tabular-nums">
                      <span>{p.unidades} unidades</span>
                      <span className="font-medium text-emerald-600">
                        +{formatCurrency(p.ganancia)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>

              {/* Tabla (md en adelante) */}
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="pb-3 text-sm font-semibold text-muted-foreground">Producto</th>
                      <th className="pb-3 text-right text-sm font-semibold text-muted-foreground">Unidades</th>
                      <th className="pb-3 text-right text-sm font-semibold text-muted-foreground">Total ventas</th>
                      <th className="pb-3 text-right text-sm font-semibold text-muted-foreground">Ganancia</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topProductos.map((p: any) => (
                      <tr
                        key={p.id}
                        className="border-b border-border/60 transition-colors last:border-0 hover:bg-accent/50"
                      >
                        <td className="py-3 text-sm font-medium text-foreground">{p.nombre}</td>
                        <td className="py-3 text-right text-sm tabular-nums text-muted-foreground">{p.unidades}</td>
                        <td className="py-3 text-right text-sm font-medium tabular-nums text-foreground">{formatCurrency(p.ventas)}</td>
                        <td className="py-3 text-right text-sm font-medium tabular-nums text-emerald-600">{formatCurrency(p.ganancia)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No hay ventas registradas.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Operaciones */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="border-border shadow-soft">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Estado de facturación</CardTitle>
          </CardHeader>
          <CardContent className="flex-1">
            <div className="grid flex-1 grid-cols-3 content-center gap-3">
              <EstadoTile
                label="Impresas"
                count={estadosCount.impresas}
                total={totalFacturas}
                tone="emerald"
              />
              <EstadoTile
                label="Pendientes"
                count={estadosCount.pendientes}
                total={totalFacturas}
                tone="amber"
              />
              <EstadoTile
                label="Anuladas"
                count={estadosCount.anuladas}
                total={totalFacturas}
                tone="slate"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border shadow-soft">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Receipt className="h-4 w-4 text-primary" />
              Compras por pagar
            </CardTitle>
            <Link
              href="/compras"
              className="text-xs font-semibold text-primary underline-offset-4 hover:underline"
            >
              Ver todas
            </Link>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col">
            {compras.porPagar.length > 0 ? (
              <ul className="flex-1 space-y-2">
                {compras.porPagar.map((c: {
                  id: string;
                  empresa: string;
                  numero_factura: string | null;
                  valor: number;
                  fecha_recibida: string;
                  dias: number;
                  diasRestantes: number;
                }) => {
                  const vencida = c.diasRestantes < 0;
                  const porVencer = !vencida && c.diasRestantes <= 5;
                  return (
                    <li
                      key={c.id}
                      className={cn(
                        "flex items-center justify-between gap-3 rounded-xl border px-3 py-2",
                        vencida
                          ? "border-rose-200 bg-rose-50/60"
                          : porVencer
                            ? "border-amber-200 bg-amber-50/60"
                            : "border-border bg-accent/40",
                      )}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="truncate text-sm font-semibold text-foreground">{c.empresa}</p>
                          {vencida && (
                            <AlertCircle className="h-3.5 w-3.5 shrink-0 text-rose-500" />
                          )}
                          {porVencer && (
                            <Clock className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          {c.numero_factura ? `#${c.numero_factura} · ` : ""}
                          recibida {c.fecha_recibida}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-bold tabular-nums text-foreground">{formatCurrency(c.valor)}</p>
                        <p className={cn(
                          "text-[11px] tabular-nums",
                          vencida ? "font-semibold text-rose-600" : porVencer ? "font-semibold text-amber-600" : "text-muted-foreground",
                        )}>
                          {vencida ? `${Math.abs(c.diasRestantes)} d atrasada` : porVencer ? `vence en ${c.diasRestantes} d` : `${c.diasRestantes} d restantes`}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center py-8 text-center">
                <p className="text-sm font-medium text-foreground">Nada por pagar</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Todas las facturas de compra están saldadas.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border shadow-soft">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-rose-600" />
              Stock crítico
            </CardTitle>
            <Link
              href="/reportes/bajo-stock"
              className="text-xs font-semibold text-rose-600 underline-offset-4 hover:underline"
            >
              Ver reporte
            </Link>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col">
            {bajoStock.length > 0 ? (
              <ul className="flex-1 space-y-2">
                {bajoStock.map((p: { id: string; nombre: string; stock: number; minimo: number }) => {
                  const agotado = p.stock <= 0;
                  const pct = Math.max(4, Math.round((p.stock / Math.max(p.minimo, 1)) * 100));
                  return (
                    <li key={p.id} className="rounded-xl border border-border bg-accent/40 px-3 py-2">
                      <div className="flex items-center justify-between gap-3">
                        <p className="truncate text-sm font-semibold text-foreground">{p.nombre}</p>
                        <Badge
                          variant="outline"
                          className={cn(
                            "shrink-0 tabular-nums",
                            agotado
                              ? "border-rose-200 bg-rose-100 text-rose-700"
                              : "border-amber-200 bg-amber-100 text-amber-700",
                          )}
                        >
                          {agotado ? "Sin stock" : `${p.stock} / ${p.minimo}`}
                        </Badge>
                      </div>
                      <div
                        role="progressbar"
                        aria-valuenow={Math.min(100, pct)}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`Stock de ${p.nombre} frente al mínimo`}
                        className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200"
                      >
                        <div
                          className={cn(
                            "h-1.5 rounded-full transition-[width] duration-700 ease-out",
                            agotado ? "bg-rose-500" : "bg-amber-500",
                          )}
                          style={{ width: `${agotado ? 100 : Math.min(100, pct)}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center py-8 text-center">
                <p className="text-sm font-medium text-foreground">Todo en orden</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Ningún producto está por debajo de su mínimo.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
