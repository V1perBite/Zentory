import { isAdmin, requireProfile } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { redirect } from "next/navigation";
import { ProductosTopClient } from "@/components/reportes/productos-top-client";

export default async function ProductosTopPage() {
  const profile = await requireProfile();

  if (!isAdmin(profile)) {
    redirect("/dashboard");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        back="/reportes"
        backLabel="Volver al listado de reportes"
        title="Top Productos"
        subtitle="Conoce cuáles son los productos que más unidades venden y más ingresos generan."
      />

      <ProductosTopClient />
    </div>
  );
}
