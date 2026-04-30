import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { getSessionUser } from "@/lib/auth";

export default async function LoginPage() {
  const user = await getSessionUser();
  if (user) {
    redirect("/dashboard");
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md items-center px-4">
      <div className="w-full space-y-4">
        <div>
          <h1 className="text-2xl font-bold">Iniciar sesión</h1>
          <p className="text-sm text-slate-600">
            Acceso a inventario, facturación e impresión remota.
          </p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
