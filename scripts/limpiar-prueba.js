/**
 * Elimina todos los datos de prueba creados por scripts/seed-prueba.mjs.
 *
 * Uso:  node scripts/limpiar-prueba.js
 *
 * 1. Genera scripts/limpiar-prueba.sql (por si hay que correrlo a mano en
 *    el SQL Editor de Supabase).
 * 2. Intenta ejecutarlo automáticamente por el MCP de Supabase (usa el
 *    token OAuth de opencode en ~/.local/share/opencode/mcp-auth.json).
 *
 * Nota: borra la factura anulada de prueba, así que el SQL deshabilita
 * temporalmente trg_bloquear_modificacion_anulada dentro de una
 * transacción (si algo falla, todo se revierte).
 */
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

const ROOT = process.cwd();
const REG_PATH = path.join(ROOT, "scripts", "datos-prueba.json");
const SQL_PATH = path.join(ROOT, "scripts", "limpiar-prueba.sql");

if (!fs.existsSync(REG_PATH)) {
  console.error("No existe scripts/datos-prueba.json (¿ya se limpió?)");
  process.exit(1);
}

const reg = JSON.parse(fs.readFileSync(REG_PATH, "utf8"));
const asArray = (values, cast) =>
  values.length ? `array[${values.join(", ")}]::${cast}[]` : "'{}'::uuid[]";

const clientes = reg.clientes.map((c) => `'${c.id}'::uuid`);
const productos = reg.productos.map((p) => `'${p.id}'::uuid`);
const facturas = reg.facturas.map((f) => `'${f.id}'::uuid`);

const VERIFICACION = `select
  (select count(*) from public.clientes where identificacion like 'PRUEBA-%') as clientes_prueba,
  (select count(*) from public.productos where sku_code like 'PRUEBA-%') as productos_prueba,
  (select count(*) from public.movimientos_stock where motivo like '[PRUEBA]%') as movimientos_prueba,
  (select count(*) from public.facturas f
     join public.clientes c on c.id = f.cliente_id
    where c.identificacion like 'PRUEBA-%') as facturas_prueba;`;

const sql = `-- Generado por scripts/limpiar-prueba.js el ${new Date().toISOString()}
-- Borra TODOS los datos marcados [PRUEBA] (clientes, productos, facturas,
-- items y movimientos). Idempotente.
begin;
do $limpia$
declare
  v_clientes  uuid[] := ${asArray(clientes, "uuid")};
  v_productos uuid[] := ${asArray(productos, "uuid")};
  v_facturas  uuid[] := ${asArray(facturas, "uuid")};
begin
  alter table public.facturas
    disable trigger trg_bloquear_modificacion_anulada;

  delete from public.movimientos_stock
   where motivo like '[PRUEBA]%'
      or factura_id = any(v_facturas)
      or producto_id = any(v_productos);

  delete from public.facturas
   where id = any(v_facturas)
      or cliente_id in (select id from public.clientes
                         where identificacion like 'PRUEBA-%');

  delete from public.productos
   where id = any(v_productos) or sku_code like 'PRUEBA-%';

  delete from public.clientes
   where id = any(v_clientes) or identificacion like 'PRUEBA-%';

  alter table public.facturas
    enable trigger trg_bloquear_modificacion_anulada;
end $limpia$;
commit;
`;

const sqlCompleta = `${sql}\n-- Verificación: deben quedar 0 filas marcadas\n${VERIFICACION}\n`;
fs.writeFileSync(SQL_PATH, sqlCompleta, "utf8");
console.log(`SQL generado en ${SQL_PATH}`);

const DRY_RUN = process.argv.includes("--dry-run");
const MIGRATIONS = {
  initialize: {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2025-03-26",
      capabilities: {},
      clientInfo: { name: "zentory-limpieza", version: "1.0" },
    },
  },
};

async function mcpCall(url, headers, body, sid) {
  const h = { ...headers };
  if (sid) h["mcp-session-id"] = sid;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 90000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: h,
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    const text = await res.text();
    return { status: res.status, sid: res.headers.get("mcp-session-id"), text };
  } finally {
    clearTimeout(timer);
  }
}

function parseSse(text) {
  if (text.startsWith("event:") || text.startsWith("data:")) {
    return text
      .split("\n")
      .filter((l) => l.startsWith("data:"))
      .map((l) => l.slice(5))
      .join("");
  }
  return text;
}

async function ejecutarPorMcp() {
  const authPath = path.join(os.homedir(), ".local", "share", "opencode", "mcp-auth.json");
  if (!fs.existsSync(authPath)) return null;
  const auth = JSON.parse(fs.readFileSync(authPath, "utf8"));
  const tok = auth && auth.supabase && auth.supabase.tokens && auth.supabase.tokens.accessToken;
  if (!tok) return null;

  const url =
    "https://mcp.supabase.com/mcp?project_ref=nzkoxiddpdtiqqhtawtu&features=database,debugging,development";
  const headers = {
    authorization: "Bearer " + tok,
    accept: "application/json, text/event-stream",
    "content-type": "application/json",
  };

  const init = await mcpCall(url, headers, MIGRATIONS.initialize);
  if (!init.sid) return null;
  await mcpCall(url, headers, { jsonrpc: "2.0", method: "notifications/initialized" }, init.sid);

  const run = await mcpCall(
    url,
    headers,
    {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: "execute_sql", arguments: { query: sqlCompleta } },
    },
    init.sid
  );
  const payload = JSON.parse(parseSse(run.text));
  if (!payload.result || payload.result.isError) {
    throw new Error(run.text.slice(0, 500));
  }

  const verify = await mcpCall(
    url,
    headers,
    {
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: { name: "execute_sql", arguments: { query: VERIFICACION } },
    },
    init.sid
  );
  return parseSse(verify.text);
}

(async () => {
  if (DRY_RUN) {
    console.log("Dry run: solo se generó el SQL, no se ejecutó nada.");
    return;
  }
  try {
    const resultado = await ejecutarPorMcp();
    if (resultado) {
      console.log("Limpieza ejecutada por el MCP de Supabase.");
      console.log(resultado.replace(/\\n/g, " ").slice(0, 600));
      const left = path.join(ROOT, "scripts", "datos-prueba-eliminado.json");
      fs.renameSync(REG_PATH, left);
      console.log(`Registro renombrado a ${left}`);
    } else {
      console.log(
        "No hay token del MCP de Supabase. Ejecuta scripts/limpiar-prueba.sql en el SQL Editor."
      );
      process.exitCode = 2;
    }
  } catch (err) {
    console.error("Fallo al ejecutar por MCP:", err.message || err);
    console.log("Ejecuta manualmente scripts/limpiar-prueba.sql en el SQL Editor de Supabase.");
    process.exitCode = 2;
  }
})();
