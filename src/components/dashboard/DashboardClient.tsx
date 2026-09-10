"use client";

import React, { useState, useMemo } from "react";
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
  Download,
  FileText,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Info,
  Package,
} from "lucide-react";

type DateRange = "hoy" | "ultimos_7_dias" | "ultimos_30_dias" | "este_mes" | "mes_anterior";

const mockDataByRange = {
  hoy: { ventas: 1250, ganancia: 450, facturas: 15, prevVentas: 1100, prevGanancia: 400 },
  ultimos_7_dias: { ventas: 8400, ganancia: 3100, facturas: 85, prevVentas: 7900, prevGanancia: 2800 },
  ultimos_30_dias: { ventas: 35000, ganancia: 12500, facturas: 320, prevVentas: 32000, prevGanancia: 11000 },
  este_mes: { ventas: 15000, ganancia: 5200, facturas: 140, prevVentas: 14000, prevGanancia: 4800 },
  mes_anterior: { ventas: 32000, ganancia: 11000, facturas: 300, prevVentas: 30000, prevGanancia: 10500 },
};

const mockChartDataEvolucion = {
  hoy: Array.from({ length: 8 }, (_, i) => ({ time: `${i + 9}:00`, ventas: Math.floor(Math.random() * 300) + 50 })),
  ultimos_7_dias: Array.from({ length: 7 }, (_, i) => ({ time: `Día ${i + 1}`, ventas: Math.floor(Math.random() * 1500) + 500 })),
  ultimos_30_dias: Array.from({ length: 15 }, (_, i) => ({ time: `Día ${i * 2 + 1}`, ventas: Math.floor(Math.random() * 3000) + 1000 })),
  este_mes: Array.from({ length: 10 }, (_, i) => ({ time: `Día ${i * 3 + 1}`, ventas: Math.floor(Math.random() * 2000) + 800 })),
  mes_anterior: Array.from({ length: 10 }, (_, i) => ({ time: `Día ${i * 3 + 1}`, ventas: Math.floor(Math.random() * 2000) + 800 })),
};

const topProductos = [
  { id: 1, nombre: "Laptop Pro 15\"", unidades: 12, ventas: 14400, ganancia: 3600 },
  { id: 2, nombre: "Monitor 27\" 4K", unidades: 25, ventas: 7500, ganancia: 1500 },
  { id: 3, nombre: "Teclado Mecánico", unidades: 45, ventas: 4050, ganancia: 1215 },
  { id: 4, nombre: "Ratón Inalámbrico", unidades: 60, ventas: 1800, ganancia: 720 },
  { id: 5, nombre: "Auriculares Noise-Cancelling", unidades: 30, ventas: 4500, ganancia: 1350 },
];

const heatmapDays = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const heatmapHours = ["08-12", "12-16", "16-20", "20-24"];

function getIntensityClass(value: number) {
  if (value > 80) return "bg-blue-600 text-white";
  if (value > 60) return "bg-blue-400 text-white";
  if (value > 40) return "bg-blue-300 text-slate-800";
  if (value > 20) return "bg-blue-200 text-slate-800";
  return "bg-slate-100 text-slate-400";
}

export default function DashboardClient() {
  const [dateRange, setDateRange] = useState<DateRange>("ultimos_7_dias");

  const metrics = mockDataByRange[dateRange];
  const chartData = mockChartDataEvolucion[dateRange];
  
  const margen = ((metrics.ganancia / metrics.ventas) * 100).toFixed(1);
  const ticketPromedio = (metrics.ventas / metrics.facturas).toFixed(2);
  
  const getComparativa = (current: number, prev: number) => {
    const diff = ((current - prev) / prev) * 100;
    return diff;
  };

  const comparativaVentas = getComparativa(metrics.ventas, metrics.prevVentas);
  const comparativaGanancia = getComparativa(metrics.ganancia, metrics.prevGanancia);

  const formatCurrency = (val: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(val);

  const rentabilidadData = [
    { name: "Rentabilidad", ventas: metrics.ventas, costos: metrics.ventas - metrics.ganancia, ganancia: metrics.ganancia }
  ];

  return (
    <div className="space-y-6">
      {/* Header y Acciones de Exportación */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Dashboard de Facturación y Ventas</h1>
          <p className="text-sm text-slate-500">Panel analítico de rendimiento comercial</p>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 px-3 py-2 text-sm font-medium bg-slate-100 text-slate-700 rounded-md hover:bg-slate-200 transition-colors">
            <Download size={16} />
            <span className="hidden sm:inline">Exportar Vista</span>
          </button>
          <button className="flex items-center gap-2 px-3 py-2 text-sm font-medium bg-slate-100 text-slate-700 rounded-md hover:bg-slate-200 transition-colors">
            <FileText size={16} />
            <span className="hidden sm:inline">Reporte Ventas</span>
          </button>
        </div>
      </div>

      {/* Filtros Globales */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap gap-4 items-end">
        <div className="flex flex-col gap-1.5 w-full sm:w-auto">
          <label className="text-xs font-semibold text-slate-500 uppercase">Rango de Fechas</label>
          <select 
            className="border-slate-200 rounded-md text-sm py-2 px-3 focus:ring-blue-500 focus:border-blue-500 bg-slate-50"
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as DateRange)}
          >
            <option value="hoy">Hoy</option>
            <option value="ultimos_7_dias">Últimos 7 días</option>
            <option value="ultimos_30_dias">Últimos 30 días</option>
            <option value="este_mes">Este mes</option>
            <option value="mes_anterior">Mes anterior</option>
          </select>
        </div>
        <div className="flex flex-col gap-1.5 w-full sm:w-auto">
          <label className="text-xs font-semibold text-slate-500 uppercase">Sucursal (Opcional)</label>
          <select className="border-slate-200 rounded-md text-sm py-2 px-3 bg-slate-50">
            <option value="">Todas</option>
            <option value="principal">Sede Principal</option>
          </select>
        </div>
        <div className="flex flex-col gap-1.5 w-full sm:w-auto">
          <label className="text-xs font-semibold text-slate-500 uppercase">Método Pago (Opcional)</label>
          <select className="border-slate-200 rounded-md text-sm py-2 px-3 bg-slate-50">
            <option value="">Todos</option>
            <option value="efectivo">Efectivo</option>
            <option value="tarjeta">Tarjeta</option>
            <option value="transferencia">Transferencia</option>
          </select>
        </div>
      </div>

      {/* KPIs Principales */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
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
          <span className="text-xs text-slate-400 mt-1">En el periodo</span>
        </div>

        {/* Ticket Promedio */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-1">
          <span className="text-sm font-medium text-slate-500">Ticket Promedio</span>
          <span className="text-2xl font-bold text-slate-800">{formatCurrency(Number(ticketPromedio))}</span>
          <span className="text-xs text-slate-400 mt-1">Ventas / Facturas</span>
        </div>
      </div>

      {/* Análisis Gráfico y Rentabilidad */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm lg:col-span-2">
          <h3 className="text-base font-semibold text-slate-800 mb-4">Evolución de Ventas</h3>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="time" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={(val) => `$${val}`} />
                <Tooltip 
                  formatter={(value: number) => [formatCurrency(value), "Ventas"]}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Line type="monotone" dataKey="ventas" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, fill: '#3b82f6' }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm lg:col-span-1 flex flex-col">
          <h3 className="text-base font-semibold text-slate-800 mb-4">Desglose de Rentabilidad</h3>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rentabilidadData} margin={{ top: 5, right: 0, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={(val) => `$${val}`} />
                <Tooltip formatter={(value: number) => [formatCurrency(value), ""]} cursor={{ fill: 'transparent' }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="ventas" name="Ventas" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={40} />
                <Bar dataKey="costos" name="Costos" fill="#cbd5e1" radius={[4, 4, 0, 0]} barSize={40} />
                <Bar dataKey="ganancia" name="Ganancia" fill="#10b981" radius={[4, 4, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Rendimiento Productos y Horarios */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
          <h3 className="text-base font-semibold text-slate-800 mb-4">Top Productos Más Vendidos</h3>
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
              {topProductos.map((p) => (
                <tr key={p.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors">
                  <td className="py-3 text-sm font-medium text-slate-800">{p.nombre}</td>
                  <td className="py-3 text-sm text-slate-600 text-right">{p.unidades}</td>
                  <td className="py-3 text-sm font-medium text-slate-800 text-right">{formatCurrency(p.ventas)}</td>
                  <td className="py-3 text-sm font-medium text-emerald-600 text-right">{formatCurrency(p.ganancia)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-base font-semibold text-slate-800 mb-4">Días y Horarios de Mayor Venta</h3>
          <div className="grid grid-cols-[auto_repeat(4,1fr)] gap-1 text-center text-xs">
            {/* Headers */}
            <div className="p-2"></div>
            {heatmapHours.map(h => <div key={h} className="p-2 font-medium text-slate-500">{h}</div>)}
            
            {/* Grid */}
            {heatmapDays.map((day) => (
              <React.Fragment key={day}>
                <div className="p-2 font-medium text-slate-500 text-right flex items-center justify-end">{day}</div>
                {heatmapHours.map((hour) => {
                  const val = Math.floor(Math.random() * 100);
                  return (
                    <div 
                      key={`${day}-${hour}`} 
                      className={`p-2 rounded-md min-h-[32px] flex items-center justify-center transition-colors ${getIntensityClass(val)}`}
                      title={`${day} ${hour}: ${val}% intensidad`}
                    >
                      {val > 20 ? val : ''}
                    </div>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
          <div className="mt-4 flex items-center justify-end gap-2 text-xs text-slate-500">
            <span>Menos</span>
            <div className="w-4 h-4 rounded-sm bg-slate-100"></div>
            <div className="w-4 h-4 rounded-sm bg-blue-200"></div>
            <div className="w-4 h-4 rounded-sm bg-blue-400"></div>
            <div className="w-4 h-4 rounded-sm bg-blue-600"></div>
            <span>Más</span>
          </div>
        </div>
      </div>

      {/* Operaciones y Alertas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col">
          <h3 className="text-base font-semibold text-slate-800 mb-4">Estado de Facturación</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 flex-1 content-center">
            <div className="flex flex-col items-center justify-center p-4 bg-emerald-50 rounded-lg border border-emerald-100">
              <span className="text-2xl font-bold text-emerald-600">85%</span>
              <span className="text-xs font-medium text-emerald-800 uppercase mt-1">Pagadas</span>
            </div>
            <div className="flex flex-col items-center justify-center p-4 bg-amber-50 rounded-lg border border-amber-100">
              <span className="text-2xl font-bold text-amber-600">10%</span>
              <span className="text-xs font-medium text-amber-800 uppercase mt-1">Pendientes</span>
            </div>
            <div className="flex flex-col items-center justify-center p-4 bg-rose-50 rounded-lg border border-rose-100">
              <span className="text-2xl font-bold text-rose-600">3%</span>
              <span className="text-xs font-medium text-rose-800 uppercase mt-1">Vencidas</span>
            </div>
            <div className="flex flex-col items-center justify-center p-4 bg-slate-50 rounded-lg border border-slate-200">
              <span className="text-2xl font-bold text-slate-600">2%</span>
              <span className="text-xs font-medium text-slate-800 uppercase mt-1">Anuladas</span>
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-base font-semibold text-slate-800 mb-4">Alertas del Sistema</h3>
          <div className="space-y-3">
            <div className="flex gap-3 items-start p-3 bg-rose-50 border border-rose-100 rounded-lg">
              <AlertTriangle className="text-rose-600 shrink-0 mt-0.5" size={18} />
              <div>
                <p className="text-sm font-semibold text-rose-800">Inventario Crítico</p>
                <p className="text-xs text-rose-600 mt-0.5">3 productos están por debajo del stock mínimo. Recomendamos reabastecer "Laptop Pro 15\"".</p>
              </div>
            </div>
            
            <div className="flex gap-3 items-start p-3 bg-amber-50 border border-amber-100 rounded-lg">
              <AlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={18} />
              <div>
                <p className="text-sm font-semibold text-amber-800">Facturas por Vencer</p>
                <p className="text-xs text-amber-700 mt-0.5">Hay 2 facturas que vencen en los próximos 3 días. Revise la sección de cobranza.</p>
              </div>
            </div>

            <div className="flex gap-3 items-start p-3 bg-blue-50 border border-blue-100 rounded-lg">
              <Info className="text-blue-600 shrink-0 mt-0.5" size={18} />
              <div>
                <p className="text-sm font-semibold text-blue-800">Resumen de Facturas</p>
                <p className="text-xs text-blue-700 mt-0.5">Se han procesado {metrics.facturas} facturas exitosamente en este periodo.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
