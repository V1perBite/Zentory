"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { registrarEventoAuditoria } from "@/app/actions/auditoria";
import { AUDITORIA_ENTIDADES, AUDITORIA_MODULOS } from "@/lib/constants";

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
    <form onSubmit={onSubmit} className="space-y-4 rounded-xl bg-white p-6 shadow-sm">
      <div>
        <label className="mb-1 block text-sm font-medium">Email</label>
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          className="w-full rounded-lg border border-slate-300 px-3 py-2"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Contraseña</label>
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          className="w-full rounded-lg border border-slate-300 px-3 py-2"
        />
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-70"
      >
        {loading ? "Ingresando..." : "Iniciar sesión"}
      </button>
    </form>
  );
}
