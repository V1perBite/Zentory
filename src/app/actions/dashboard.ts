"use server";

import { createClient } from "@/lib/supabase/server";
import { startOfDay, startOfWeek, startOfMonth, subDays, subMonths, endOfDay, subWeeks } from "date-fns";

export type DateRangeKey = "hoy" | "ultimos_7_dias" | "ultimos_30_dias" | "este_mes" | "mes_anterior";

function getDateRange(range: DateRangeKey) {
  const now = new Date();
  let start: Date, end: Date, prevStart: Date, prevEnd: Date;

  switch (range) {
    case "hoy":
      start = startOfDay(now);
      end = endOfDay(now);
      prevStart = startOfDay(subDays(now, 1));
      prevEnd = endOfDay(subDays(now, 1));
      break;
    case "ultimos_7_dias":
      start = startOfDay(subDays(now, 6));
      end = endOfDay(now);
      prevStart = startOfDay(subDays(now, 13));
      prevEnd = endOfDay(subDays(now, 7));
      break;
    case "ultimos_30_dias":
      start = startOfDay(subDays(now, 29));
      end = endOfDay(now);
      prevStart = startOfDay(subDays(now, 59));
      prevEnd = endOfDay(subDays(now, 30));
      break;
    case "este_mes":
      start = startOfMonth(now);
      end = endOfDay(now);
      prevStart = startOfMonth(subMonths(now, 1));
      prevEnd = endOfDay(subDays(start, 1)); // approx prev end
      break;
    case "mes_anterior":
      start = startOfMonth(subMonths(now, 1));
      end = endOfDay(subDays(startOfMonth(now), 1));
      prevStart = startOfMonth(subMonths(now, 2));
      prevEnd = endOfDay(subDays(startOfMonth(subMonths(now, 1)), 1));
      break;
    default:
      start = startOfDay(now);
      end = endOfDay(now);
      prevStart = startOfDay(subDays(now, 1));
      prevEnd = endOfDay(subDays(now, 1));
  }
  return { start, end, prevStart, prevEnd };
}

export async function getDashboardStats(rangeKey: DateRangeKey) {
  const supabase = createClient();
  const { start, end, prevStart, prevEnd } = getDateRange(rangeKey);

  // Consulta de facturas del periodo actual
  const { data: facturasCurrent } = await supabase
    .from("facturas")
    .select("id, total, estado, created_at")
    .gte("created_at", start.toISOString())
    .lte("created_at", end.toISOString())
    .neq("estado", "anulada");

  // Consulta de facturas del periodo anterior
  const { data: facturasPrev } = await supabase
    .from("facturas")
    .select("id, total, estado, created_at")
    .gte("created_at", prevStart.toISOString())
    .lte("created_at", prevEnd.toISOString())
    .neq("estado", "anulada");

  const currentFacturas = facturasCurrent || [];
  const prevFacturas = facturasPrev || [];

  const ventas = currentFacturas.reduce((sum, f) => sum + f.total, 0);
  const prevVentas = prevFacturas.reduce((sum, f) => sum + f.total, 0);
  const numFacturas = currentFacturas.length;

  // Consultar items para sacar ganancia del periodo actual
  let ganancia = 0;
  let prevGanancia = 0;
  let topProductos = [];

  if (currentFacturas.length > 0) {
    const ids = currentFacturas.map(f => f.id);
    const { data: items } = await supabase
      .from("factura_items")
      .select("cantidad, subtotal_item, producto:productos(id, nombre, precio_costo)")
      .in("factura_id", ids);

    if (items) {
      const prodStats: Record<string, any> = {};

      items.forEach(item => {
        // Handle array or single object depending on RLS/schema
        const p = Array.isArray(item.producto) ? item.producto[0] : item.producto;
        const costo = p?.precio_costo || 0;
        const gananciaItem = item.subtotal_item - (costo * item.cantidad);
        ganancia += gananciaItem;

        if (p) {
          if (!prodStats[p.id]) {
            prodStats[p.id] = { id: p.id, nombre: p.nombre, unidades: 0, ventas: 0, ganancia: 0 };
          }
          prodStats[p.id].unidades += item.cantidad;
          prodStats[p.id].ventas += item.subtotal_item;
          prodStats[p.id].ganancia += gananciaItem;
        }
      });

      topProductos = Object.values(prodStats)
        .sort((a: any, b: any) => b.ventas - a.ventas)
        .slice(0, 5);
    }
  }

  // Mismos cálculos de ganancia para periodo anterior
  if (prevFacturas.length > 0) {
    const prevIds = prevFacturas.map(f => f.id);
    const { data: prevItems } = await supabase
      .from("factura_items")
      .select("cantidad, subtotal_item, producto:productos(precio_costo)")
      .in("factura_id", prevIds);

    if (prevItems) {
      prevItems.forEach(item => {
        const p = Array.isArray(item.producto) ? item.producto[0] : item.producto;
        const costo = p?.precio_costo || 0;
        prevGanancia += item.subtotal_item - (costo * item.cantidad);
      });
    }
  }

  // Estados de facturas general del periodo (incluyendo anuladas)
  const { data: allFacturas } = await supabase
    .from("facturas")
    .select("estado")
    .gte("created_at", start.toISOString())
    .lte("created_at", end.toISOString());

  const estadosCount = { pagadas: 0, pendientes: 0, vencidas: 0, anuladas: 0 };
  if (allFacturas) {
    allFacturas.forEach(f => {
      if (f.estado === "anulada") estadosCount.anuladas++;
      else if (f.estado === "pendiente_impresion") estadosCount.pendientes++; // Ajusta según tu lógica real de "pendiente" vs "pagada"
      else estadosCount.pagadas++; 
    });
  }

  // Generar datos de gráfico lineal agrupando por días
  // Por simplicidad, agrupamos estáticamente en 7 puntos (1 por día de la semana) o similar según el rango
  // Aquí podemos hacer algo rápido o usar los valores directamente.
  const chartDataMap: Record<string, number> = {};
  currentFacturas.forEach(f => {
    const day = new Date(f.created_at).toLocaleDateString('es-ES', { month: 'short', day: 'numeric' });
    chartDataMap[day] = (chartDataMap[day] || 0) + f.total;
  });
  const chartData = Object.keys(chartDataMap).map(k => ({ time: k, ventas: chartDataMap[k] }));

  // Productos con bajo stock (Alertas)
  const { count: lowStockCount } = await supabase
    .from("productos")
    .select("*", { count: "exact", head: true })
    .eq("activo", true)
    .lte("stock_actual", 5); // Simplificación: puedes comparar stock_actual <= minimo_stock si lo traes, o traer los q cumplen eso.

  // Fetch full list for alert
  const { data: lowStockProds } = await supabase
    .from("productos")
    .select("nombre")
    .eq("activo", true)
    .lte("stock_actual", 5) // idealmente usar rpc o traer todo si es poco, pero por ahora limit 3
    .limit(3);

  return {
    metrics: { ventas, ganancia, facturas: numFacturas, prevVentas, prevGanancia },
    chartData,
    topProductos,
    estadosCount,
    alertas: {
      lowStockCount: lowStockCount || 0,
      lowStockNames: lowStockProds ? lowStockProds.map(p => p.nombre).join(", ") : ""
    }
  };
}
