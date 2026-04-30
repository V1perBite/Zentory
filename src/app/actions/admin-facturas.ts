"use server";

import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { ROLES } from "@/lib/constants";

export async function anularFactura(
  facturaId: string,
): Promise<{ error?: string }> {
  const profile = await requireProfile();
  if (profile.rol !== ROLES.ADMIN) return { error: "Sin permisos." };

  const supabase = createClient();
  const { error } = await supabase.rpc("anular_factura", {
    p_factura_id: facturaId,
  });

  if (error) return { error: error.message };
  return {};
}
