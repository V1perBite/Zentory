import { requireProfile } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import { redirect } from "next/navigation";
import { PrintCenter } from "@/components/printing/print-center";

export default async function ImprimirPage() {
  const profile = await requireProfile();

  if (profile.rol !== ROLES.ADMIN) {
    redirect("/dashboard");
  }

  return <PrintCenter />;
}
