import { isAdmin, requireProfile } from "@/lib/auth";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ComprasClient } from "@/components/compras/compras-client";
import type { FacturaCompra } from "@/lib/types";

const CAMPOS =
  "id,empresa,numero_factura,concepto,valor,fecha_recibida,fecha_pago,estado,notas,creado_por,created_at,updated_at";

export default async function ComprasPage() {
  const profile = await requireProfile();
  if (!isAdmin(profile)) redirect("/dashboard");

  const supabase = createClient();
  const { data } = await supabase
    .from("facturas_compra")
    .select(CAMPOS)
    .order("fecha_recibida", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(500);

  const filas = (data ?? []) as FacturaCompra[];

  // Empresas ya usadas, para el autocompletado del formulario.
  const empresas = Array.from(
    new Set(filas.map((f) => f.empresa.trim()).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b, "es"));

  return <ComprasClient filas={filas} empresas={empresas} />;
}
