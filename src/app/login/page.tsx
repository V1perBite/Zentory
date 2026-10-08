import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { getSessionUser } from "@/lib/auth";
import { APP_NAME } from "@/lib/constants";
import { Package } from "lucide-react";

export default async function LoginPage() {
  const user = await getSessionUser();
  if (user) {
    redirect("/dashboard");
  }

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-background px-4 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-primary/10 via-primary/5 to-transparent"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-24 top-1/3 h-72 w-72 rounded-full bg-primary/10 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 bottom-0 h-72 w-72 rounded-full bg-chart-2/10 blur-3xl"
      />

      <div className="relative w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lift">
            <Package className="h-7 w-7" />
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{APP_NAME}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Acceso a inventario, facturación e impresión remota.
            </p>
          </div>
        </div>

        <LoginForm />

        <p className="text-center text-xs text-muted-foreground">
          ¿Necesitas ayuda? Contacta al administrador del negocio.
        </p>
      </div>
    </div>
  );
}
