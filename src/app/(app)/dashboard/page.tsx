import { redirect } from "next/navigation";
import { isAdmin, requireProfile } from "@/lib/auth";
import DashboardClient from "@/components/dashboard/DashboardClient";

export default async function DashboardPage() {
  const profile = await requireProfile();

  if (!isAdmin(profile)) {
    redirect("/facturas/nueva");
  }

  return (
    <div className="w-full">
      <DashboardClient />
    </div>
  );
}
