import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import DashboardClient from "@/components/dashboard/DashboardClient";

export default async function DashboardPage() {
  const profile = await requireProfile();

  if (profile.rol !== ROLES.ADMIN) {
    redirect("/facturas/nueva");
  }

  return (
    <div className="w-full">
      <DashboardClient />
    </div>
  );
}
