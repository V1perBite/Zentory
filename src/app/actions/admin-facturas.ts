"use server";

import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { ROLES } from "@/lib/constants";

export async function anularFactura(
  facturaId: string,
  razon?: string,
): Promise<{ error?: string }> {
  const profile = await requireProfile();
  if (profile.rol !== ROLES.ADMIN) return { error: "Sin permisos." };

  const razonTrim = (razon ?? "").trim();
  if (razonTrim.length < 10) {
    return {
      error: "El motivo de anulación debe tener al menos 10 caracteres.",
    };
  }

  const supabase = createClient();
  const { error } = await supabase.rpc("anular_factura", {
    p_factura_id: facturaId,
    p_razon: razonTrim,
  });

  if (error) return { error: error.message };
  return {};
}
