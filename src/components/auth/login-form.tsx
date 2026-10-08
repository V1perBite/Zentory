"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { registrarEventoAuditoria } from "@/app/actions/auditoria";
import { AUDITORIA_ENTIDADES, AUDITORIA_MODULOS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, Loader2 } from "lucide-react";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();

    const { data, error: loginError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (loginError) {
      setLoading(false);
      setError(loginError.message);
      await registrarEventoAuditoria({
        action: "LOGIN_FALLIDO",
        module: AUDITORIA_MODULOS.USUARIOS,
        entityType: AUDITORIA_ENTIDADES.USUARIO,
        entityRef: email,
        description: `Inicio de sesión fallido: ${email}`,
        metadata: { motivo: loginError.message },
      });
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("usuarios")
      .select("activo")
      .eq("id", data.user.id)
      .single();

    if (profileError || !profile?.activo) {
      await supabase.auth.signOut();
      setLoading(false);
      setError("Tu usuario está inactivo o no tiene perfil asignado.");
      await registrarEventoAuditoria({
        action: "LOGIN_FALLIDO",
        module: AUDITORIA_MODULOS.USUARIOS,
        entityType: AUDITORIA_ENTIDADES.USUARIO,
        entityRef: email,
        description: `Intento con usuario inactivo o sin perfil: ${email}`,
      });
      return;
    }

    await registrarEventoAuditoria({
      action: "LOGIN",
      module: AUDITORIA_MODULOS.USUARIOS,
      entityType: AUDITORIA_ENTIDADES.USUARIO,
      entityId: data.user.id,
      entityRef: email,
      description: `Inicio de sesión: ${email}`,
    });

    router.replace("/dashboard");
    router.refresh();
  };

  return (
    <Card className="animate-fade-in-up border-border shadow-lift">
      <CardContent className="p-6">
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="login-email">Correo electrónico</Label>
            <Input
              id="login-email"
              type="email"
              name="email"
              autoComplete="email"
              inputMode="email"
              placeholder="tu@correo.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="login-password">Contraseña</Label>
            <Input
              id="login-password"
              type="password"
              name="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>

          <div aria-live="polite" role="alert">
            {error ? (
              <p className="flex items-start gap-2 rounded-xl bg-destructive/10 px-3 py-2.5 text-sm font-medium text-destructive">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </p>
            ) : null}
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="h-11 w-full text-base shadow-lift-sm"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Ingresando…
              </>
            ) : (
              "Iniciar sesión"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
