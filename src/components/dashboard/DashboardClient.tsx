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
  Loader2,
  Receipt
} from "lucide-react";
import { getDashboardStats, type DateRangeKey } from "@/app/actions/dashboard";

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

  const formatCurrency = (val: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(val);

  if (!data && loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="animate-spin text-slate-400" size={32} />
      </div>
    );
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
  const getPercent = (count: number) => totalFacturas > 0 ? Math.round((count / totalFacturas) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Dashboard de Facturación y Ventas</h1>
          <p className="text-sm text-slate-500">Panel analítico de rendimiento comercial en tiempo real</p>
        </div>
      </div>

      {/* Filtros Globales */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap gap-4 items-end">
        <div className="flex flex-col gap-1.5 w-full sm:w-auto">
          <label className="text-xs font-semibold text-slate-500 uppercase">Rango de Fechas</label>
          <select 
            className="border-slate-200 rounded-md text-sm py-2 px-3 focus:ring-blue-500 focus:border-blue-500 bg-slate-50 disabled:opacity-50"
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
        {loading && <div className="text-sm text-blue-600 flex items-center gap-2"><Loader2 className="animate-spin" size={16} /> Actualizando...</div>}
      </div>

      {/* KPIs Principales */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* Ventas */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-1">
          <span className="text-sm font-medium text-slate-500">Ventas Totales</span>
          <span className="text-2xl font-bold text-slate-800">{formatCurrency(metrics.ventas)}</span>
          <div className={`flex items-center gap-1 text-xs font-medium mt-1 ${comparativaVentas >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
            {comparativaVentas >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            <span>{Math.abs(comparativaVentas).toFixed(1)}% vs anterior</span>
          </div>
        </div>

        {/* Ganancia */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-1">
          <span className="text-sm font-medium text-slate-500">Ganancia Neta</span>
          <span className="text-2xl font-bold text-slate-800">{formatCurrency(metrics.ganancia)}</span>
          <div className={`flex items-center gap-1 text-xs font-medium mt-1 ${comparativaGanancia >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
            {comparativaGanancia >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            <span>{Math.abs(comparativaGanancia).toFixed(1)}% vs anterior</span>
          </div>
        </div>

        {/* Margen */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-1">
          <span className="text-sm font-medium text-slate-500">Margen de Ganancia</span>
          <span className="text-2xl font-bold text-slate-800">{margen}%</span>
          <span className="text-xs text-slate-400 mt-1">Margen operativo</span>
        </div>

        {/* Facturas */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-1">
          <span className="text-sm font-medium text-slate-500">Facturas Emitidas</span>
          <span className="text-2xl font-bold text-slate-800">{metrics.facturas}</span>
          <span className="text-xs text-slate-400 mt-1">En el periodo validas</span>
        </div>

        {/* Ticket Promedio */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-1">
          <span className="text-sm font-medium text-slate-500">Ticket Promedio</span>
          <span className="text-2xl font-bold text-slate-800">{formatCurrency(Number(ticketPromedio))}</span>
          <span className="text-xs text-slate-400 mt-1">Ventas / Facturas</span>
        </div>

        {/* Pendiente de pago (Compras) — saldo actual, no depende del rango */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-1">
          <span className="text-sm font-medium text-slate-500">Pendiente de Pago</span>
          <span className={`text-2xl font-bold ${compras.pendientePago > 0 ? "text-amber-600" : "text-slate-800"}`}>
            {formatCurrency(compras.pendientePago)}
          </span>
          <span className="text-xs text-slate-400 mt-1">
            {compras.pendientesCount} factura{compras.pendientesCount === 1 ? "" : "s"} · saldo actual
          </span>
        </div>
      </div>

      {/* Análisis Gráfico */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-base font-semibold text-slate-800 mb-4">Evolución de Ventas (Periodo)</h3>
          <div className="h-72 w-full">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="time" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={(val) => `$${val}`} />
                  <Tooltip 
                    formatter={(value: any) => [formatCurrency(Number(value) || 0), "Ventas"]}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Line type="monotone" dataKey="ventas" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, fill: '#3b82f6' }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-slate-400 text-sm">No hay ventas en este periodo</div>
            )}
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col">
          <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
            <h3 className="text-base font-semibold text-slate-800">Comparativa vs Periodo Anterior</h3>
            <div className="flex items-center gap-3 text-xs font-medium">
              <span className={comparativaVentas >= 0 ? "text-emerald-600" : "text-rose-600"}>
                Ventas {comparativaVentas >= 0 ? "+" : "−"}{Math.abs(comparativaVentas).toFixed(1)}%
              </span>
              <span className={comparativaGanancia >= 0 ? "text-emerald-600" : "text-rose-600"}>
                Ganancia {comparativaGanancia >= 0 ? "+" : "−"}{Math.abs(comparativaGanancia).toFixed(1)}%
              </span>
            </div>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={comparativaData} margin={{ top: 5, right: 0, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={(val) => `$${val}`} />
                <Tooltip formatter={(value: any) => [formatCurrency(Number(value) || 0), ""]} cursor={{ fill: 'rgba(148, 163, 184, 0.12)' }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="actual" name="Periodo actual" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={34} />
                <Bar dataKey="anterior" name="Periodo anterior" fill="#cbd5e1" radius={[4, 4, 0, 0]} barSize={34} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Rendimiento Productos */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
        <h3 className="text-base font-semibold text-slate-800 mb-4">Top Productos Más Vendidos</h3>
        {topProductos.length > 0 ? (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="pb-3 text-sm font-semibold text-slate-500">Producto</th>
                <th className="pb-3 text-sm font-semibold text-slate-500 text-right">Unidades</th>
                <th className="pb-3 text-sm font-semibold text-slate-500 text-right">Total Ventas</th>
                <th className="pb-3 text-sm font-semibold text-slate-500 text-right">Ganancia</th>
              </tr>
            </thead>
            <tbody>
              {topProductos.map((p: any) => (
                <tr key={p.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors">
                  <td className="py-3 text-sm font-medium text-slate-800">{p.nombre}</td>
                  <td className="py-3 text-sm text-slate-600 text-right">{p.unidades}</td>
                  <td className="py-3 text-sm font-medium text-slate-800 text-right">{formatCurrency(p.ventas)}</td>
                  <td className="py-3 text-sm font-medium text-emerald-600 text-right">{formatCurrency(p.ganancia)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="text-sm text-slate-500 text-center py-8">No hay ventas registradas.</div>
        )}
      </div>

      {/* Operaciones */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col">
          <h3 className="text-base font-semibold text-slate-800 mb-4">Estado de Facturación</h3>
          <div className="grid grid-cols-3 gap-4 flex-1 content-center">
            <div className="flex flex-col items-center justify-center p-4 bg-emerald-50 rounded-lg border border-emerald-100">
              <span className="text-2xl font-bold text-emerald-600">{getPercent(estadosCount.impresas)}%</span>
              <span className="text-xs font-medium text-emerald-800 uppercase mt-1">Impresas</span>
              <span className="text-[10px] text-emerald-600 mt-0.5">{estadosCount.impresas} facturas</span>
            </div>
            <div className="flex flex-col items-center justify-center p-4 bg-amber-50 rounded-lg border border-amber-100">
              <span className="text-2xl font-bold text-amber-600">{getPercent(estadosCount.pendientes)}%</span>
              <span className="text-xs font-medium text-amber-800 uppercase mt-1">Pendientes</span>
              <span className="text-[10px] text-amber-600 mt-0.5">{estadosCount.pendientes} facturas</span>
            </div>
            <div className="flex flex-col items-center justify-center p-4 bg-slate-50 rounded-lg border border-slate-200">
              <span className="text-2xl font-bold text-slate-600">{getPercent(estadosCount.anuladas)}%</span>
              <span className="text-xs font-medium text-slate-800 uppercase mt-1">Anuladas</span>
              <span className="text-[10px] text-slate-500 mt-0.5">{estadosCount.anuladas} facturas</span>
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col">
          <div className="flex items-center justify-between gap-2 mb-4">
            <h3 className="flex items-center gap-2 text-base font-semibold text-slate-800">
              <Receipt size={18} className="text-orange-600" />
              Compras por Pagar
            </h3>
            <Link href="/compras" className="text-xs font-semibold text-orange-700 hover:text-orange-800 underline">
              Ver todas
            </Link>
          </div>
          {compras.porPagar.length > 0 ? (
            <ul className="space-y-2 flex-1">
              {compras.porPagar.map((c: {
                id: string;
                empresa: string;
                numero_factura: string | null;
                valor: number;
                fecha_recibida: string;
                dias: number;
              }) => (
                <li key={c.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-800">{c.empresa}</p>
                    <p className="text-[11px] text-slate-500">
                      {c.numero_factura ? `#${c.numero_factura} · ` : ""}
                      recibida {c.fecha_recibida}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-bold text-slate-800">{formatCurrency(c.valor)}</p>
                    <p className={`text-[11px] ${c.dias > compras.diasVencida ? "text-rose-600 font-semibold" : "text-slate-500"}`}>
                      {c.dias} d
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center py-8 text-center">
              <p className="text-sm font-medium text-slate-600">Nada por pagar</p>
              <p className="mt-1 text-xs text-slate-500">Todas las facturas de compra están saldadas.</p>
            </div>
          )}
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col">
          <div className="flex items-center justify-between gap-2 mb-4">
            <h3 className="flex items-center gap-2 text-base font-semibold text-slate-800">
              <AlertTriangle size={18} className="text-rose-600" />
              Stock Crítico
            </h3>
            <Link href="/reportes/bajo-stock" className="text-xs font-semibold text-rose-700 hover:text-rose-800 underline">
              Ver reporte
            </Link>
          </div>
          {bajoStock.length > 0 ? (
            <ul className="space-y-2 flex-1">
              {bajoStock.map((p: { id: string; nombre: string; stock: number; minimo: number }) => {
                const agotado = p.stock <= 0;
                const pct = Math.max(4, Math.round((p.stock / Math.max(p.minimo, 1)) * 100));
                return (
                  <li key={p.id} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate text-sm font-semibold text-slate-800">{p.nombre}</p>
                      <span className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] font-semibold ${agotado ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"}`}>
                        {agotado ? "Sin stock" : `${p.stock} / ${p.minimo}`}
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 w-full rounded-full bg-slate-200">
                      <div className={`h-1.5 rounded-full ${agotado ? "bg-rose-500" : "bg-amber-500"}`} style={{ width: `${agotado ? 100 : pct}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center py-8 text-center">
              <p className="text-sm font-medium text-slate-600">Todo en orden</p>
              <p className="mt-1 text-xs text-slate-500">Ningún producto está por debajo de su mínimo.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
