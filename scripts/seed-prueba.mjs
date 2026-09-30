/**
 * Crea datos de prueba marcados con el prefijo [PRUEBA] para que los
 * reportes muestren información durante el periodo de prueba.
 *
 * Uso:  node scripts/seed-prueba.mjs
 *
 * Todo lo creado queda registrado en scripts/datos-prueba.json para que
 * scripts/limpiar-prueba.js pueda eliminarlo al final del periodo.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

function loadEnv(file) {
  const out = {};
  const full = path.join(ROOT, file);
  if (!fs.existsSync(full)) return out;
  for (const line of fs.readFileSync(full, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)$/);
    if (m) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return out;
}

const env = { ...loadEnv(".env.local"), ...loadEnv(".env") };
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Falta NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local");
  process.exit(1);
}

async function rest(pathAndQuery, { method = "GET", body } = {}) {
  const res = await fetch(SUPABASE_URL + "/rest/v1/" + pathAndQuery, {
    method,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: "Bearer " + SERVICE_KEY,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    throw new Error(`${method} ${pathAndQuery} -> ${res.status} ${await res.text()}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : [];
}

// Zona horaria local del negocio (UTC-5). created_at se guarda en UTC.
function utcFromLocal(dateStr, hh, mm) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, hh + 5, mm, 0, 0)).toISOString();
}

const PRUEBA_CLIENTES = [
  { nombre: "[PRUEBA] Cliente Andes", identificacion: "PRUEBA-CLI-001" },
  { nombre: "[PRUEBA] Cliente Centro", identificacion: "PRUEBA-CLI-002" },
  { nombre: "[PRUEBA] Cliente Norte", identificacion: "PRUEBA-CLI-003" },
];

const PRUEBA_PRODUCTOS = [
  { nombre: "[PRUEBA] Café premium 500g", sku_code: "PRUEBA-001", precio_venta: 18500, precio_costo: 11000, stock_actual: 42, minimo_stock: 10 },
  { nombre: "[PRUEBA] Arroz integral 1kg", sku_code: "PRUEBA-002", precio_venta: 4800, precio_costo: 3200, stock_actual: 60, minimo_stock: 15 },
  { nombre: "[PRUEBA] Aceite vegetal 1L", sku_code: "PRUEBA-003", precio_venta: 9200, precio_costo: 6500, stock_actual: 2, minimo_stock: 8 },
  { nombre: "[PRUEBA] Panela orgánica 500g", sku_code: "PRUEBA-004", precio_venta: 6500, precio_costo: 4000, stock_actual: 5, minimo_stock: 5 },
  { nombre: "[PRUEBA] Miel de abeja 350ml", sku_code: "PRUEBA-005", precio_venta: 15000, precio_costo: 9500, stock_actual: 0, minimo_stock: 5 },
  { nombre: "[PRUEBA] Harina de trigo 1kg", sku_code: "PRUEBA-006", precio_venta: 3900, precio_costo: 2600, stock_actual: 35, minimo_stock: 12 },
  { nombre: "[PRUEBA] Chocolate artesanal", sku_code: "PRUEBA-007", precio_venta: 12000, precio_costo: 7400, stock_actual: 18, minimo_stock: 6 },
  { nombre: "[PRUEBA] Té verde 20 bolsas", sku_code: "PRUEBA-008", precio_venta: 8400, precio_costo: 5100, stock_actual: 24, minimo_stock: 10 },
  { nombre: "[PRUEBA] Frutos secos 200g", sku_code: "PRUEBA-009", precio_venta: 21000, precio_costo: 14500, stock_actual: 14, minimo_stock: 4 },
  { nombre: "[PRUEBA] Yogur natural 1L", sku_code: "PRUEBA-010", precio_venta: 7200, precio_costo: 4500, stock_actual: 3, minimo_stock: 9 },
];

// p: índice en PRUEBA_PRODUCTOS · r: índice en productos reales · c: cantidad
const FACTURAS = [
  { fecha: "2026-09-30", hh: 0, mm: 40, estado: "impresa", cliente: 0, vendedor: 0, items: [{ p: 0, c: 2 }, { p: 6, c: 1 }, { r: 0, c: 1 }] },
  { fecha: "2026-09-30", hh: 1, mm: 5, estado: "impresa", cliente: 1, vendedor: 1, items: [{ p: 1, c: 5 }, { r: 2, c: 2 }] },
  { fecha: "2026-09-29", hh: 14, mm: 30, estado: "impresa", cliente: 2, vendedor: 2, items: [{ p: 8, c: 1 }, { p: 7, c: 2 }, { r: 4, c: 1 }] },
  { fecha: "2026-09-27", hh: 11, mm: 15, estado: "pendiente_impresion", cliente: 0, vendedor: 3, items: [{ p: 5, c: 4 }, { r: 1, c: 1 }] },
  { fecha: "2026-09-25", hh: 16, mm: 40, estado: "impresa", cliente: 1, vendedor: 4, items: [{ p: 2, c: 3 }, { p: 9, c: 2 }] },
  { fecha: "2026-09-22", hh: 10, mm: 5, estado: "impresa", cliente: 2, vendedor: 0, items: [{ p: 3, c: 6 }, { r: 3, c: 2 }] },
  { fecha: "2026-09-18", hh: 17, mm: 25, estado: "impresa", cliente: 0, vendedor: 1, items: [{ p: 6, c: 2 }, { p: 4, c: 1 }, { r: 5, c: 3 }] },
  { fecha: "2026-09-15", hh: 12, mm: 50, estado: "impresa", cliente: 1, vendedor: 2, items: [{ p: 0, c: 1 }, { r: 6, c: 2 }] },
  { fecha: "2026-09-12", hh: 15, mm: 35, estado: "impresa", cliente: 2, vendedor: 3, items: [{ p: 7, c: 3 }, { p: 1, c: 2 }] },
  { fecha: "2026-09-08", hh: 9, mm: 45, estado: "impresa", cliente: 0, vendedor: 4, items: [{ p: 8, c: 2 }, { r: 7, c: 1 }] },
  {
    fecha: "2026-09-03", hh: 18, mm: 10, estado: "anulada", cliente: 1, vendedor: 0,
    items: [{ p: 9, c: 4 }, { r: 0, c: 2 }],
    razon_anulacion: "[PRUEBA] Producto defectuoso reportado por el cliente",
  },
  { fecha: "2026-08-31", hh: 13, mm: 20, estado: "impresa", cliente: 2, vendedor: 1, items: [{ p: 5, c: 3 }, { p: 2, c: 1 }] },
];

const MERMAS = [
  { fecha: "2026-09-14", hh: 10, mm: 30, producto: 0, cantidad: 2, motivo: "[PRUEBA] Merma por daño en bodega", costo: 11000 },
  { fecha: "2026-09-20", hh: 15, mm: 10, producto: 4, cantidad: 1, motivo: "[PRUEBA] Merma por vencimiento", costo: 9500 },
  { fecha: "2026-09-28", hh: 9, mm: 20, producto: 6, cantidad: 3, motivo: "[PRUEBA] Merma por rotura en transporte", costo: 7400 },
];

const money = (n) => Math.round(n * 100) / 100;

async function main() {
  const existentes = (await rest("clientes?select=id,identificacion")).filter((c) =>
    String(c.identificacion).startsWith("PRUEBA-")
  );
  if (existentes.length > 0) {
    console.error(
      `Ya existen ${existentes.length} clientes [PRUEBA]. Ejecuta antes: node scripts/limpiar-prueba.js`
    );
    process.exit(1);
  }

  const usuarios = await rest(
    "usuarios?select=id,nombre&activo=eq.true&order=created_at.asc"
  );
  const reales = await rest(
    "productos?select=id,nombre,precio_venta,precio_costo&activo=eq.true&precio_costo=gt.0&order=sku_code.asc&limit=12"
  );
  if (usuarios.length < 5) throw new Error("Se esperaban >= 5 usuarios activos");
  if (reales.length < 8) throw new Error("Se esperaban >= 8 productos reales con costo > 0");

  const clientes = await rest("clientes", { method: "POST", body: PRUEBA_CLIENTES });
  const productos = await rest("productos", {
    method: "POST",
    body: PRUEBA_PRODUCTOS.map((p) => ({ ...p, activo: true })),
  });
  console.log(`clientes [PRUEBA]: ${clientes.length} · productos [PRUEBA]: ${productos.length}`);

  const registro = {
    creado_en: new Date().toISOString(),
    marca: "[PRUEBA]",
    clientes: clientes.map((c) => ({ id: c.id, nombre: c.nombre, identificacion: c.identificacion })),
    productos: productos.map((p) => ({ id: p.id, nombre: p.nombre, sku_code: p.sku_code })),
    facturas: [],
    movimientos: [],
  };

  for (const f of FACTURAS) {
    const items = f.items.map((it) => {
      if (it.p !== undefined) {
        const prod = productos[it.p];
        return { producto_id: prod.id, cantidad: it.c, precio: prod.precio_venta, origen: "prueba" };
      }
      const prod = reales[it.r];
      return { producto_id: prod.id, cantidad: it.c, precio: Number(prod.precio_venta), origen: "real" };
    });

    const subtotal = money(
      items.reduce((acc, it) => acc + it.cantidad * Number(it.precio), 0)
    );
    const created = utcFromLocal(f.fecha, f.hh, f.mm);
    const vendedor = usuarios[f.vendedor % usuarios.length];

    const body = {
      cliente_id: clientes[f.cliente % clientes.length].id,
      vendedor_id: vendedor.id,
      subtotal,
      descuento_total: 0,
      total: subtotal,
      estado: f.estado,
      created_at: created,
    };
    if (f.estado === "anulada") {
      body.fecha_anulacion = created;
      body.razon_anulacion = f.razon_anulacion;
      body.usuario_anulacion_id = vendedor.id;
    }

    const [factura] = await rest("facturas", { method: "POST", body });
    const rows = await rest("items_factura", {
      method: "POST",
      body: items.map((it) => ({
        factura_id: factura.id,
        producto_id: it.producto_id,
        cantidad: it.cantidad,
        precio_unitario: it.precio,
        descuento_item: 0,
        tipo_descuento_item: "valor",
        subtotal_item: money(it.cantidad * Number(it.precio)),
      })),
    });
    registro.facturas.push({
      id: factura.id,
      numero_factura: factura.numero_factura,
      estado: factura.estado,
      created_at: created,
      vendedor: vendedor.nombre,
      items: rows.length,
    });
    console.log(
      `  N#${factura.numero_factura} ${factura.estado.padEnd(20)} ${created} total=${subtotal} (${rows.length} items)`
    );
  }

  for (const m of MERMAS) {
    const [mov] = await rest("movimientos_stock", {
      method: "POST",
      body: {
        producto_id: productos[m.producto].id,
        tipo: "salida",
        cantidad: m.cantidad,
        motivo: m.motivo,
        factura_id: null,
        usuario_id: usuarios[0].id,
        costo_unitario: m.costo,
        created_at: utcFromLocal(m.fecha, m.hh, m.mm),
      },
    });
    registro.movimientos.push({ id: mov.id, motivo: m.motivo, created_at: mov.created_at });
    console.log(`  merma: ${m.motivo} (${m.cantidad} u)`);
  }

  const out = path.join(ROOT, "scripts", "datos-prueba.json");
  fs.writeFileSync(out, JSON.stringify(registro, null, 2) + "\n", "utf8");
  console.log(`\nListo: ${registro.facturas.length} facturas, ${registro.movimientos.length} mermas.`);
  console.log(`IDs guardados en ${out}`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
