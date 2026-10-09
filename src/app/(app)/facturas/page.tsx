import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowUpRight,
  FileX2,
  History,
  Printer,
  ReceiptText,
} from "lucide-react";
import { isAdmin, requireProfile } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";

const accesos = [
  {
    href: "/facturas/nueva",
    titulo: "Nueva factura",
    descripcion: "Crea una factura con carrito, escaneo y descuentos.",
    icono: ReceiptText,
    acento: "bg-emerald-500/10 text-emerald-600",
    borde: "hover:border-emerald-400/60",
  },
  {
    href: "/historial",
    titulo: "Historial",
    descripcion: "Consulta, filtra y anula facturas generadas.",
    icono: History,
    acento: "bg-primary/10 text-primary",
    borde: "hover:border-primary/50",
  },
  {
    href: "/facturas/anuladas",
    titulo: "Anulaciones",
    descripcion: "Registro de facturas anuladas con motivo y auditoría.",
    icono: FileX2,
    acento: "bg-rose-500/10 text-rose-600",
    borde: "hover:border-rose-400/60",
  },
  {
    href: "/imprimir",
    titulo: "Cola de impresión",
    descripcion: "Procesa las facturas pendientes de impresión.",
    icono: Printer,
    acento: "bg-amber-500/10 text-amber-600",
    borde: "hover:border-amber-400/60",
  },
];

export default async function FacturasPage() {
  const profile = await requireProfile();

  if (!isAdmin(profile)) {
    redirect("/facturas/nueva");
  }

  return (
    <section className="space-y-6">
      <PageHeader
        title="Facturación"
        subtitle="Gestión de facturación, historial y cola de impresión."
        icon={
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-accent-foreground">
            <ReceiptText className="h-5 w-5" />
          </span>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {accesos.map((acceso, i) => (
          <Link
            key={acceso.href}
            href={acceso.href}
            className={`group animate-fade-in-up stagger-${i + 1}`}
          >
            <Card
              className={`h-full border-border shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-lift ${acceso.borde}`}
            >
              <CardContent className="flex h-full flex-col gap-3 p-5">
                <div className="flex items-start justify-between">
                  <span
                    className={`flex h-11 w-11 items-center justify-center rounded-xl ${acceso.acento}`}
                  >
                    <acceso.icono className="h-5 w-5" />
                  </span>
                  <ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                </div>
                <div className="mt-auto">
                  <p className="font-semibold text-foreground">{acceso.titulo}</p>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    {acceso.descripcion}
                  </p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  );
}
