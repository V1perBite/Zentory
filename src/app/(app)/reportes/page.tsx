import { requireProfile } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import { redirect } from "next/navigation";
import {
  BarChart3,
  TrendingUp,
  ArrowDownToLine,
  DollarSign,
  Users,
  AlertTriangle,
  PackageOpen,
  RefreshCw,
  FileMinus,
  Star,
  History,
  Lock
} from "lucide-react";
import Link from "next/link";

const REPORTES = [
  {
    id: "ventas-periodo",
    titulo: "Ventas por Período",
    descripcion: "Ventas diarias, semanales o mensuales. Identifica tendencias.",
    icono: TrendingUp,
    color: "text-blue-600",
    bgColor: "bg-blue-100",
    href: "/reportes/ventas-periodo",
    disponible: true,
  },
  {
    id: "productos-top",
    titulo: "Productos Más/Menos Vendidos",
    descripcion: "Qué productos rotan más y cuáles considerar liquidar.",
    icono: ArrowDownToLine,
    color: "text-emerald-600",
    bgColor: "bg-emerald-100",
    href: "/reportes/productos-top",
    disponible: true,
  },
  {
    id: "rentabilidad",
    titulo: "Rentabilidad por Producto",
    descripcion: "Margen de ganancia de cada producto.",
    icono: DollarSign,
    color: "text-amber-600",
    bgColor: "bg-amber-100",
    href: "/reportes/rentabilidad",
    disponible: true,
  },
  {
    id: "ventas-vendedor",
    titulo: "Ventas por Vendedor",
    descripcion: "Rendimiento individual y cálculo de comisiones.",
    icono: Users,
    color: "text-purple-600",
    bgColor: "bg-purple-100",
    href: "/reportes/ventas-vendedor",
    disponible: true,
  },
  {
    id: "bajo-stock",
    titulo: "Alerta de Bajo Stock",
    descripcion: "Productos que están por agotarse (punto de reorden).",
    icono: AlertTriangle,
    color: "text-red-600",
    bgColor: "bg-red-100",
    href: "/reportes/bajo-stock",
    disponible: true,
  },
  {
    id: "valoracion-inventario",
    titulo: "Valoración del Inventario",
    descripcion: "Capital invertido en mercancía actual.",
    icono: PackageOpen,
    color: "text-indigo-600",
    bgColor: "bg-indigo-100",
    href: "/reportes/valoracion-inventario",
    disponible: true,
  },
  {
    id: "rotacion",
    titulo: "Rotación de Inventario",
    descripcion: "Velocidad a la que se vende el inventario.",
    icono: RefreshCw,
    color: "text-cyan-600",
    bgColor: "bg-cyan-100",
    href: "/reportes/rotacion",
    disponible: true,
  },
  {
    id: "mermas",
    titulo: "Mermas / Ajustes",
    descripcion: "Productos dañados, caducados o perdidos.",
    icono: FileMinus,
    color: "text-rose-600",
    bgColor: "bg-rose-100",
    href: "/reportes/mermas",
    disponible: true,
  },
  {
    id: "mejores-clientes",
    titulo: "Mejores Clientes",
    descripcion: "Top clientes por volumen de compras.",
    icono: Star,
    color: "text-yellow-600",
    bgColor: "bg-yellow-100",
    href: "/reportes/mejores-clientes",
    disponible: true,
  },
  {
    id: "historial-cliente",
    titulo: "Historial por Cliente",
    descripcion: "Qué compra cada persona (cross-selling).",
    icono: History,
    color: "text-teal-600",
    bgColor: "bg-teal-100",
    href: "/reportes/historial-cliente",
    disponible: true,
  },
  {
    id: "corte-caja",
    titulo: "Corte de Caja Diario",
    descripcion: "Resumen de ingresos vs egresos del día.",
    icono: BarChart3,
    color: "text-lime-600",
    bgColor: "bg-lime-100",
    href: "/reportes/corte-caja",
    disponible: true,
  }
];

export default async function ReportesPage() {
  const profile = await requireProfile();

  if (profile.rol !== ROLES.ADMIN) {
    redirect("/dashboard");
  }

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Reportes de Negocio</h1>
        <p className="text-sm text-slate-600">Encuentra todos los reportes necesarios para optimizar tu negocio.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {REPORTES.map((reporte, index) => {
          const Icono = reporte.icono;
          return (
            <Link
              key={index}
              href={reporte.href}
              className="relative flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:shadow-md hover:border-indigo-200 group"
            >
              <div className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl ${reporte.bgColor}`}>
                <Icono className={`h-6 w-6 ${reporte.color}`} />
              </div>
              <h3 className="mb-1 text-base font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors">
                {reporte.titulo}
              </h3>
              <p className="text-sm text-slate-500 line-clamp-2">
                {reporte.descripcion}
              </p>
              
              {!reporte.disponible && (
                <div className="mt-4 flex items-center text-xs font-medium text-slate-400">
                  <Lock className="mr-1.5 h-3.5 w-3.5" />
                  <span>Próximamente</span>
                </div>
              )}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
