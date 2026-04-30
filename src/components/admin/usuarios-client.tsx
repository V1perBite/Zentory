"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createUsuario, toggleUsuarioActivo } from "@/app/actions/admin-usuarios";
import { ROLES } from "@/lib/constants";
import type { UserRole } from "@/lib/constants";

type UsuarioRow = {
  id: string;
  nombre: string;
  email: string;
  rol: string;
  activo: boolean;
};

type UsuariosClientProps = {
  usuarios: UsuarioRow[];
  currentUserId: string;
};

export function UsuariosClient({ usuarios, currentUserId }: UsuariosClientProps) {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rol, setRol] = useState<UserRole>(ROLES.VENDEDOR);
  const [loading, setLoading] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!nombre.trim() || !email.trim() || !password.trim()) {
      setError("Nombre, email y contraseña son obligatorios.");
      return;
    }
    setLoading(true);
    setError(null);
    setSuccess(null);
    const result = await createUsuario({ nombre, email, password, rol });
    setLoading(false);
    if (result.error) {
      setError(result.error);
    } else {
      setSuccess(`Usuario ${email} creado.`);
      setShowModal(false);
      setNombre("");
      setEmail("");
      setPassword("");
      setRol(ROLES.VENDEDOR);
      router.refresh();
    }
  };

  const handleToggle = async (id: string, activo: boolean) => {
    setToggling(id);
    setError(null);
    const result = await toggleUsuarioActivo({ id, activo });
    setToggling(null);
    if (result.error) {
      setError(result.error);
    } else {
      router.refresh();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Lista de usuarios</h2>
        <button
          type="button"
          onClick={() => { setShowModal(true); setError(null); setSuccess(null); }}
          className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          ➕ Crear usuario
        </button>
      </div>

      {success ? <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</p> : null}
      {error ? <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="px-3 py-2">Nombre</th>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Rol</th>
              <th className="px-3 py-2">Estado</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map((u) => (
              <tr key={u.id} className="border-t border-slate-100">
                <td className="px-3 py-2 font-medium">{u.nombre}</td>
                <td className="px-3 py-2 text-slate-600">{u.email}</td>
                <td className="px-3 py-2">
                  <span className={u.rol === ROLES.ADMIN ? "font-semibold text-slate-800" : "text-slate-500"}>
                    {u.rol}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <span
                    className={
                      u.activo
                        ? "rounded bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700"
                        : "rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-500"
                    }
                  >
                    {u.activo ? "Activo" : "Inactivo"}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    disabled={toggling === u.id || u.id === currentUserId}
                    onClick={() => handleToggle(u.id, u.activo)}
                    title={u.id === currentUserId ? "No puedes desactivarte a ti mismo" : ""}
                    className={`rounded px-2 py-0.5 text-xs disabled:opacity-40 ${
                      u.activo
                        ? "border border-amber-300 text-amber-700 hover:bg-amber-50"
                        : "border border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                    }`}
                  >
                    {toggling === u.id ? "..." : u.activo ? "Desactivar" : "Activar"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
          onClick={() => setShowModal(false)}
        >
          <div
            className="w-full max-w-md space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold">Crear usuario</h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="rounded-md border border-slate-300 px-2 py-1 text-xs"
              >
                Cerrar ✕
              </button>
            </div>

            {error ? <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}

            <div className="space-y-3">
              <label className="block space-y-1 text-xs text-slate-600">
                <span>Nombre *</span>
                <input
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Nombre completo"
                  className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                />
              </label>
              <label className="block space-y-1 text-xs text-slate-600">
                <span>Email *</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="usuario@empresa.com"
                  className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                />
              </label>
              <label className="block space-y-1 text-xs text-slate-600">
                <span>Contraseña *</span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                />
              </label>
              <label className="block space-y-1 text-xs text-slate-600">
                <span>Rol *</span>
                <select
                  value={rol}
                  onChange={(e) => setRol(e.target.value as UserRole)}
                  className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                >
                  <option value={ROLES.VENDEDOR}>Vendedor</option>
                  <option value={ROLES.ADMIN}>Admin</option>
                </select>
              </label>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                disabled={loading}
                onClick={handleCreate}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60 hover:bg-slate-800"
              >
                {loading ? "Creando..." : "Crear usuario"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
