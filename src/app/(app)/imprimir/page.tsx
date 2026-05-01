import { requireProfile } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PrintCenter } from "@/components/printing/print-center";
import type { Negocio } from "@/lib/types";

export default async function ImprimirPage() {
  const profile = await requireProfile();

  if (profile.rol !== ROLES.ADMIN) {
    redirect("/dashboard");
  }

  const supabase = createClient();
  const { data } = await supabase
    .from("negocio")
    .select("*, negocio_mensajes(*)")
    .limit(1)
    .single();
  const negocio = data as Negocio | null;

  return <PrintCenter negocio={negocio} />;
}
