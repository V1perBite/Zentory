"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  createUsuario,
  updateUsuario,
  deleteUsuario,
  toggleUsuarioActivo,
  togglePuedeCrearProductos,
  togglePermisoAuditoria,
} from "@/app/actions/admin-usuarios";
import { ROLES, ROLES_LABEL } from "@/lib/constants";
import type { UserRole } from "@/lib/constants";
import { isAdminRole } from "@/lib/permissions";

type UsuarioRow = {
  id: string;
  nombre: string;
  email: string;
  rol: string;
  activo: boolean;
  puede_crear_productos: boolean;
  puede_ver_auditoria: boolean;
  puede_exportar_auditoria: boolean;
};

type UsuariosClientProps = {
  usuarios: UsuarioRow[];
  currentUserId: string;
  currentRol: string;
};

const inputCls =
  "w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none";

export function UsuariosClient({
  usuarios,
  currentUserId,
  currentRol,
}: UsuariosClientProps) {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rol, setRol] = useState<UserRole>(ROLES.VENDEDOR);
  const [loading, setLoading] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);
  const [togglingCrear, setTogglingCrear] = useState<string | null>(null);
  const [togglingAud, setTogglingAud] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Edición
  const [editando, setEditando] = useState<UsuarioRow | null>(null);
  const [editNombre, setEditNombre] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editRol, setEditRol] = useState<UserRole>(ROLES.VENDEDOR);
  const [guardando, setGuardando] = useState(false);

  // Eliminación
  const [eliminando, setEliminando] = useState<UsuarioRow | null>(null);
  const [confirmEmail, setConfirmEmail] = useState("");
  const [borrando, setBorrando] = useState(false);

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

  const abrirEdicion = (u: UsuarioRow) => {
    setEditando(u);
    setEditNombre(u.nombre);
    setEditEmail(u.email);
    setEditPassword("");
    setEditRol(u.rol as UserRole);
    setError(null);
  };

  const cerrarEdicion = () => {
    if (guardando) return;
    setEditando(null);
    setEditPassword("");
    setError(null);
  };

  const handleUpdate = async () => {
    if (!editando) return;
    if (!editNombre.trim() || !editEmail.trim()) {
      setError("Nombre y email son obligatorios.");
      return;
    }
    setGuardando(true);
    setError(null);
    setSuccess(null);
    const result = await updateUsuario({
      id: editando.id,
      nombre: editNombre,
      email: editEmail,
      password: editPassword.trim() || undefined,
      rol: editRol,
    });
    setGuardando(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setEditando(null);
    setEditPassword("");
    setSuccess(`Usuario ${editEmail.trim()} actualizado.`);
    router.refresh();
  };

  const abrirEliminacion = (u: UsuarioRow) => {
    setEliminando(u);
    setConfirmEmail("");
    setError(null);
  };

  const cerrarEliminacion = () => {
    if (borrando) return;
    setEliminando(null);
    setConfirmEmail("");
    setError(null);
  };

  const handleDelete = async () => {
    if (!eliminando) return;
    if (confirmEmail.trim().toLowerCase() !== eliminando.email.toLowerCase()) {
      setError("El correo no coincide: escribe el correo exacto del usuario.");
      return;
    }
    setBorrando(true);
    setError(null);
    setSuccess(null);
    const result = await deleteUsuario({ id: eliminando.id });
    setBorrando(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    const borrado = eliminando.email;
    setEliminando(null);
    setConfirmEmail("");
    setSuccess(`Usuario ${borrado} eliminado.`);
    router.refresh();
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

  const handleToggleCrear = async (id: string, puedeCrear: boolean) => {
    setTogglingCrear(id);
    setError(null);
    const result = await togglePuedeCrearProductos({ id, puedeCrear });
    setTogglingCrear(null);
    if (result.error) {
      setError(result.error);
    } else {
      router.refresh();
    }
  };

  const handleToggleAuditoria = async (
    id: string,
    permiso: "ver" | "exportar",
    valor: boolean,
  ) => {
    setTogglingAud(`${id}:${permiso}`);
    setError(null);
    const result = await togglePermisoAuditoria({ id, permiso, valor });
    setTogglingAud(null);
    if (result.error) {
      setError(result.error);
    } else {
      router.refresh();
    }
  };

  const botonPermiso = (
    id: string,
    permiso: "ver" | "exportar",
    activo: boolean,
  ) => (
    <button
      type="button"
      disabled={togglingAud === `${id}:${permiso}`}
      onClick={() => handleToggleAuditoria(id, permiso, activo)}
      className={`rounded px-2 py-0.5 text-xs disabled:opacity-40 ${
        activo
          ? "border border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
          : "border border-slate-300 text-slate-600 hover:bg-slate-50"
      }`}
    >
      {togglingAud === `${id}:${permiso}` ? "..." : activo ? "✓ Activo" : "Inactivo"}
    </button>
  );

  const celdaPermisoAdmin = <span className="text-xs text-slate-400">Siempre</span>;

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
      {error && !editando && !eliminando ? (
        <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="px-3 py-2">Nombre</th>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Rol</th>
              <th className="px-3 py-2">Estado</th>
              <th className="px-3 py-2">Crear productos</th>
              <th className="px-3 py-2">Ver auditoría</th>
              <th className="px-3 py-2">Exportar auditoría</th>
              <th className="px-3 py-2">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map((u) => {
              const esSuperadmin = u.rol === ROLES.SUPERADMIN;
              const esPropia = u.id === currentUserId;
              const esAdminLike = isAdminRole(u.rol);
              // La fila superadmin sólo es editable por la propia cuenta superadmin.
              const puedeEditar = !esSuperadmin || (esPropia && currentRol === ROLES.SUPERADMIN);

              return (
                <tr key={u.id} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-medium">{u.nombre}</td>
                  <td className="px-3 py-2 text-slate-600">{u.email}</td>
                  <td className="px-3 py-2">
                    {esSuperadmin ? (
                      <span className="rounded bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-700">
                        Superadmin
                      </span>
                    ) : (
                      <span className={esAdminLike ? "font-semibold text-slate-800" : "text-slate-500"}>
                        {ROLES_LABEL[u.rol as UserRole] ?? u.rol}
                      </span>
                    )}
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
                    {esAdminLike ? (
                      celdaPermisoAdmin
                    ) : (
                      <button
                        type="button"
                        disabled={togglingCrear === u.id}
                        onClick={() => handleToggleCrear(u.id, u.puede_crear_productos)}
                        className={`rounded px-2 py-0.5 text-xs disabled:opacity-40 ${
                          u.puede_crear_productos
                            ? "border border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100"
                            : "border border-slate-300 text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        {togglingCrear === u.id ? "..." : u.puede_crear_productos ? "✓ Activo" : "Inactivo"}
                      </button>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {esAdminLike ? celdaPermisoAdmin : botonPermiso(u.id, "ver", u.puede_ver_auditoria)}
                  </td>
                  <td className="px-3 py-2">
                    {esAdminLike
                      ? celdaPermisoAdmin
                      : botonPermiso(u.id, "exportar", u.puede_exportar_auditoria)}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap items-center gap-1">
                      <button
                        type="button"
                        disabled={!puedeEditar}
                        onClick={() => abrirEdicion(u)}
                        title={puedeEditar ? "Editar usuario" : "Sólo la cuenta superadmin puede editarse"}
                        className="rounded border border-slate-300 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                      >
                        ✏️ Editar
                      </button>
                      {!esSuperadmin ? (
                        <button
                          type="button"
                          disabled={toggling === u.id || esPropia}
                          onClick={() => handleToggle(u.id, u.activo)}
                          title={esPropia ? "No puedes desactivarte a ti mismo" : ""}
                          className={`rounded px-2 py-0.5 text-xs disabled:opacity-40 ${
                            u.activo
                              ? "border border-amber-300 text-amber-700 hover:bg-amber-50"
                              : "border border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                          }`}
                        >
                          {toggling === u.id ? "..." : u.activo ? "Desactivar" : "Activar"}
                        </button>
                      ) : null}
                      {!esSuperadmin && !esPropia ? (
                        <button
                          type="button"
                          onClick={() => abrirEliminacion(u)}
                          className="rounded border border-rose-200 px-2 py-0.5 text-xs text-rose-600 hover:bg-rose-50"
                        >
                          🗑 Eliminar
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {usuarios.length === 0 ? (
        <p className="text-sm text-slate-500">No hay usuarios registrados.</p>
      ) : null}

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

            {error && !editando && !eliminando ? (
              <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
            ) : null}

            <div className="space-y-3">
              <label className="block space-y-1 text-xs text-slate-600">
                <span>Nombre *</span>
                <input
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Nombre completo"
                  className={inputCls}
                />
              </label>
              <label className="block space-y-1 text-xs text-slate-600">
                <span>Email *</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="usuario@empresa.com"
                  className={inputCls}
                />
              </label>
              <label className="block space-y-1 text-xs text-slate-600">
                <span>Contraseña *</span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className={inputCls}
                />
              </label>
              <label className="block space-y-1 text-xs text-slate-600">
                <span>Rol *</span>
                <select
                  value={rol}
                  onChange={(e) => setRol(e.target.value as UserRole)}
                  className={inputCls}
                >
                  <option value={ROLES.VENDEDOR}>{ROLES_LABEL[ROLES.VENDEDOR]}</option>
                  <option value={ROLES.ADMIN}>{ROLES_LABEL[ROLES.ADMIN]}</option>
                </select>
                <span className="block text-[11px] text-slate-400">
                  El rol superadmin no se puede asignar.
                </span>
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

      {editando ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
          onClick={cerrarEdicion}
        >
          <div
            className="w-full max-w-md space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold">Editar usuario</h3>
              <button
                type="button"
                onClick={cerrarEdicion}
                className="rounded-md border border-slate-300 px-2 py-1 text-xs"
              >
                Cerrar ✕
              </button>
            </div>

            {error ? (
              <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
            ) : null}

            <div className="space-y-3">
              <label className="block space-y-1 text-xs text-slate-600">
                <span>Nombre *</span>
                <input
                  value={editNombre}
                  onChange={(e) => setEditNombre(e.target.value)}
                  className={inputCls}
                />
              </label>
              <label className="block space-y-1 text-xs text-slate-600">
                <span>Email *</span>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className={inputCls}
                />
              </label>
              <label className="block space-y-1 text-xs text-slate-600">
                <span>Contraseña</span>
                <input
                  type="password"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  placeholder="Dejar vacío para no cambiarla"
                  className={inputCls}
                />
              </label>
              <label className="block space-y-1 text-xs text-slate-600">
                <span>Rol *</span>
                <select
                  value={editRol}
                  disabled={editando.rol === ROLES.SUPERADMIN || editando.id === currentUserId}
                  onChange={(e) => setEditRol(e.target.value as UserRole)}
                  className={`${inputCls} disabled:bg-slate-100 disabled:text-slate-500`}
                >
                  {editando.rol === ROLES.SUPERADMIN ? (
                    <option value={ROLES.SUPERADMIN}>{ROLES_LABEL[ROLES.SUPERADMIN]}</option>
                  ) : (
                    <>
                      <option value={ROLES.VENDEDOR}>{ROLES_LABEL[ROLES.VENDEDOR]}</option>
                      <option value={ROLES.ADMIN}>{ROLES_LABEL[ROLES.ADMIN]}</option>
                    </>
                  )}
                </select>
                <span className="block text-[11px] text-slate-400">
                  {editando.rol === ROLES.SUPERADMIN
                    ? "El rol superadmin no se puede cambiar."
                    : editando.id === currentUserId
                      ? "No puedes cambiar tu propio rol."
                      : ""}
                </span>
              </label>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={guardando}
                onClick={cerrarEdicion}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={guardando}
                onClick={handleUpdate}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60 hover:bg-slate-800"
              >
                {guardando ? "Guardando..." : "Guardar cambios"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {eliminando ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
          onClick={cerrarEliminacion}
        >
          <div
            className="w-full max-w-md space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-rose-700">Eliminar usuario</h3>
              <button
                type="button"
                onClick={cerrarEliminacion}
                className="rounded-md border border-slate-300 px-2 py-1 text-xs"
              >
                Cerrar ✕
              </button>
            </div>

            {error ? (
              <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
            ) : null}

            <div className="space-y-2 text-sm text-slate-700">
              <p>
                Vas a eliminar <strong>{eliminando.nombre}</strong> ({eliminando.email}).
                Esta acción borra la cuenta de acceso y no se puede deshacer.
              </p>
              <p className="text-xs text-slate-500">
                Si el usuario tiene facturas o movimientos asociados, el sistema pedirá
                desactivarlo en su lugar.
              </p>
              <label className="block space-y-1 text-xs text-slate-600">
                <span>Escribe el correo para confirmar *</span>
                <input
                  type="email"
                  value={confirmEmail}
                  onChange={(e) => setConfirmEmail(e.target.value)}
                  placeholder={eliminando.email}
                  className={inputCls}
                />
              </label>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={borrando}
                onClick={cerrarEliminacion}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={borrando || confirmEmail.trim() === ""}
                onClick={handleDelete}
                className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60 hover:bg-rose-700"
              >
                {borrando ? "Eliminando..." : "Eliminar definitivamente"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
