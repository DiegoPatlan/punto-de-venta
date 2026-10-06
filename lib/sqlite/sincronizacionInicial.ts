import { supabasePOS } from "../supabase";
import { getSQLiteDatabase } from "./database";
import { obtenerUsuarioPOS } from "../usuarioPOS";

interface NegocioRow {
  id: string;
  nombre: string;
  tipo_negocio: string | null;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  logo_url: string | null;
  activo: boolean;
  impuestos_activos: boolean;
  iva_porcentaje: number;
  recargo_tarjeta_activo: boolean;
  recargo_tarjeta_porcentaje: number;
  created_at: string;
}

interface SucursalRow {
  id: string;
  negocio_id: string;
  nombre: string;
  direccion: string | null;
  telefono: string | null;
  activo: boolean;
  created_at: string;
}

interface UsuarioRow {
  id: string;
  auth_user_id: string | null;
  negocio_id: string;
  nombre: string;
  rol: string;
  activo: boolean;
  created_at: string;
  sucursal_id: string | null;
  foto_url: string | null;
}

interface UsuarioSucursalRow {
  id: string;
  usuario_id: string;
  sucursal_id: string;
  created_at: string;
}

interface CajaRow {
  id: string;
  sucursal_id: string;
  nombre: string;
  activo: boolean;
  created_at: string;
}

interface UsuarioCajaRow {
  id: string;
  usuario_id: string;
  caja_id: string;
  created_at: string;
}

interface CategoriaRow {
  id: string;
  negocio_id: string;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
  created_at: string;
}

interface ProductoRow {
  id: string;
  negocio_id: string;
  categoria_id: string | null;
  codigo_barras: string | null;
  sku: string | null;
  nombre: string;
  descripcion: string | null;
  precio_compra: number;
  precio_venta: number;
  unidad: string;
  imagen_url: string | null;
  stock_minimo: number;
  activo: boolean;
  created_at: string;
  updated_at: string | null;
  precio_base: number | null;
}

interface InventarioRow {
  id: string;
  producto_id: string;
  sucursal_id: string;
  stock: number;
  stock_reservado: number;
  created_at: string;
  updated_at: string | null;
}

interface ClienteRow {
  id: string;
  negocio_id: string;
  nombre: string;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  rfc: string | null;
  limite_credito: number;
  saldo_credito: number;
  activo: boolean;
  created_at: string;
}

export interface ResultadoSincronizacionInicial {
  negocioId: string;
  negocio: number;
  sucursales: number;
  usuarios: number;
  usuarioSucursales: number;
  cajas: number;
  usuarioCajas: number;
  categorias: number;
  productos: number;
  inventario: number;
  clientes: number;
  total: number;
}

function booleanoSQLite(valor: boolean): number {
  return valor ? 1 : 0;
}

function numeroSeguro(valor: number | null | undefined): number {
  if (valor === null || valor === undefined) {
    return 0;
  }

  const numero = Number(valor);

  return Number.isFinite(numero) ? numero : 0;
}

async function obtenerDatosSupabase<T>(
  consulta: PromiseLike<{
    data: T[] | null;
    error: {
      message: string;
      details?: string;
      hint?: string;
      code?: string;
    } | null;
  }>
): Promise<T[]> {
  const resultado = await consulta;

  if (resultado.error) {
    throw new Error(
      [
        resultado.error.message,
        resultado.error.code
          ? `Código: ${resultado.error.code}`
          : null,
        resultado.error.details
          ? `Detalles: ${resultado.error.details}`
          : null,
        resultado.error.hint
          ? `Ayuda: ${resultado.error.hint}`
          : null,
      ]
        .filter(Boolean)
        .join(" | ")
    );
  }

  return resultado.data ?? [];
}

export async function sincronizarDatosIniciales(): Promise<ResultadoSincronizacionInicial> {
  const usuarioPOS = await obtenerUsuarioPOS();

  if (!usuarioPOS) {
    throw new Error(
      "No fue posible obtener el usuario POS autenticado."
    );
  }

  if (!usuarioPOS.negocio_id) {
    throw new Error(
      "El usuario POS no tiene un negocio asociado."
    );
  }

  const negocioId = usuarioPOS.negocio_id;

  const db = await getSQLiteDatabase();

  /*
   * ============================================================
   * 1. NEGOCIO
   * ============================================================
   */

  const negocios = await obtenerDatosSupabase<NegocioRow>(
    supabasePOS
      .from("negocios")
      .select(
        `
          id,
          nombre,
          tipo_negocio,
          telefono,
          email,
          direccion,
          logo_url,
          activo,
          impuestos_activos,
          iva_porcentaje,
          recargo_tarjeta_activo,
          recargo_tarjeta_porcentaje,
          created_at
        `
      )
      .eq("id", negocioId)
      .limit(1)
  );

  if (negocios.length === 0) {
    throw new Error(
      "No se encontró el negocio del usuario autenticado."
    );
  }

  /*
   * ============================================================
   * 2. SUCURSALES
   * ============================================================
   */

  const sucursales = await obtenerDatosSupabase<SucursalRow>(
    supabasePOS
      .from("sucursales")
      .select(
        `
          id,
          negocio_id,
          nombre,
          direccion,
          telefono,
          activo,
          created_at
        `
      )
      .eq("negocio_id", negocioId)
  );

  /*
   * ============================================================
   * 3. USUARIOS
   * ============================================================
   */

  const usuarios = await obtenerDatosSupabase<UsuarioRow>(
    supabasePOS
      .from("usuarios")
      .select(
        `
          id,
          auth_user_id,
          negocio_id,
          nombre,
          rol,
          activo,
          created_at,
          sucursal_id,
          foto_url
        `
      )
      .eq("negocio_id", negocioId)
  );

  const idsUsuarios = usuarios.map(
    (usuario) => usuario.id
  );

  /*
   * ============================================================
   * 4. USUARIO_SUCURSALES
   * ============================================================
   */

  let usuarioSucursales: UsuarioSucursalRow[] = [];

  if (idsUsuarios.length > 0) {
    usuarioSucursales =
      await obtenerDatosSupabase<UsuarioSucursalRow>(
        supabasePOS
          .from("usuario_sucursales")
          .select(
            `
              id,
              usuario_id,
              sucursal_id,
              created_at
            `
          )
          .in("usuario_id", idsUsuarios)
      );
  }

  /*
   * ============================================================
   * 5. CAJAS
   * ============================================================
   */

  const idsSucursales = sucursales.map(
    (sucursal) => sucursal.id
  );

  let cajas: CajaRow[] = [];

  if (idsSucursales.length > 0) {
    cajas = await obtenerDatosSupabase<CajaRow>(
      supabasePOS
        .from("cajas")
        .select(
          `
            id,
            sucursal_id,
            nombre,
            activo,
            created_at
          `
        )
        .in("sucursal_id", idsSucursales)
    );
  }

  const idsCajas = cajas.map(
    (caja) => caja.id
  );

  /*
   * ============================================================
   * 6. USUARIO_CAJAS
   * ============================================================
   */

  let usuarioCajas: UsuarioCajaRow[] = [];

  if (idsUsuarios.length > 0 && idsCajas.length > 0) {
    usuarioCajas =
      await obtenerDatosSupabase<UsuarioCajaRow>(
        supabasePOS
          .from("usuario_cajas")
          .select(
            `
              id,
              usuario_id,
              caja_id,
              created_at
            `
          )
          .in("usuario_id", idsUsuarios)
          .in("caja_id", idsCajas)
      );
  }

  /*
   * ============================================================
   * 7. CATEGORIAS
   * ============================================================
   */

  const categorias = await obtenerDatosSupabase<CategoriaRow>(
    supabasePOS
      .from("categorias")
      .select(
        `
          id,
          negocio_id,
          nombre,
          descripcion,
          activo,
          created_at
        `
      )
      .eq("negocio_id", negocioId)
  );

  /*
   * ============================================================
   * 8. PRODUCTOS
   * ============================================================
   */

  const productos = await obtenerDatosSupabase<ProductoRow>(
    supabasePOS
      .from("productos")
      .select(
        `
          id,
          negocio_id,
          categoria_id,
          codigo_barras,
          sku,
          nombre,
          descripcion,
          precio_compra,
          precio_venta,
          unidad,
          imagen_url,
          stock_minimo,
          activo,
          created_at,
          updated_at,
          precio_base
        `
      )
      .eq("negocio_id", negocioId)
  );

  /*
   * ============================================================
   * 9. INVENTARIO
   * ============================================================
   */

  const idsProductos = productos.map(
    (producto) => producto.id
  );

  let inventario: InventarioRow[] = [];

  if (idsProductos.length > 0 && idsSucursales.length > 0) {
    inventario =
      await obtenerDatosSupabase<InventarioRow>(
        supabasePOS
          .from("inventario")
          .select(
            `
              id,
              producto_id,
              sucursal_id,
              stock,
              stock_reservado,
              created_at,
              updated_at
            `
          )
          .in("producto_id", idsProductos)
          .in("sucursal_id", idsSucursales)
      );
  }

  /*
   * ============================================================
   * 10. CLIENTES
   * ============================================================
   */

  const clientes = await obtenerDatosSupabase<ClienteRow>(
    supabasePOS
      .from("clientes")
      .select(
        `
          id,
          negocio_id,
          nombre,
          telefono,
          email,
          direccion,
          rfc,
          limite_credito,
          saldo_credito,
          activo,
          created_at
        `
      )
      .eq("negocio_id", negocioId)
  );

  /*
   * ============================================================
   * LIMPIEZA DE DATOS LOCALES DEL NEGOCIO
   *
   * Se hace en orden inverso para respetar las FK.
   * Esto permite volver a ejecutar la sincronización inicial
   * sin duplicar registros.
   * ============================================================
   */

  await db.execute(
    `DELETE FROM inventario WHERE sucursal_id IN (
      SELECT id FROM sucursales WHERE negocio_id = $1
    )`,
    [negocioId]
  );

  await db.execute(
    `DELETE FROM productos WHERE negocio_id = $1`,
    [negocioId]
  );

  await db.execute(
    `DELETE FROM categorias WHERE negocio_id = $1`,
    [negocioId]
  );

  await db.execute(
    `DELETE FROM usuario_cajas WHERE usuario_id IN (
      SELECT id FROM usuarios WHERE negocio_id = $1
    )`,
    [negocioId]
  );

  await db.execute(
    `DELETE FROM cajas WHERE sucursal_id IN (
      SELECT id FROM sucursales WHERE negocio_id = $1
    )`,
    [negocioId]
  );

  await db.execute(
    `DELETE FROM usuario_sucursales WHERE usuario_id IN (
      SELECT id FROM usuarios WHERE negocio_id = $1
    )`,
    [negocioId]
  );

  await db.execute(
    `DELETE FROM usuarios WHERE negocio_id = $1`,
    [negocioId]
  );

  await db.execute(
    `DELETE FROM clientes WHERE negocio_id = $1`,
    [negocioId]
  );

  await db.execute(
    `DELETE FROM sucursales WHERE negocio_id = $1`,
    [negocioId]
  );

  await db.execute(
    `DELETE FROM negocios WHERE id = $1`,
    [negocioId]
  );

  /*
   * ============================================================
   * INSERTAR NEGOCIO
   * ============================================================
   */

  for (const negocio of negocios) {
    await db.execute(
      `
        INSERT INTO negocios (
          id,
          nombre,
          tipo_negocio,
          telefono,
          email,
          direccion,
          logo_url,
          activo,
          impuestos_activos,
          iva_porcentaje,
          recargo_tarjeta_activo,
          recargo_tarjeta_porcentaje,
          created_at
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8,
          $9,
          $10,
          $11,
          $12,
          $13
        )
      `,
      [
        negocio.id,
        negocio.nombre,
        negocio.tipo_negocio,
        negocio.telefono,
        negocio.email,
        negocio.direccion,
        negocio.logo_url,
        booleanoSQLite(negocio.activo),
        booleanoSQLite(negocio.impuestos_activos),
        numeroSeguro(negocio.iva_porcentaje),
        booleanoSQLite(negocio.recargo_tarjeta_activo),
        numeroSeguro(negocio.recargo_tarjeta_porcentaje),
        negocio.created_at,
      ]
    );
  }

  /*
   * ============================================================
   * INSERTAR SUCURSALES
   * ============================================================
   */

  for (const sucursal of sucursales) {
    await db.execute(
      `
        INSERT INTO sucursales (
          id,
          negocio_id,
          nombre,
          direccion,
          telefono,
          activo,
          created_at
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7
        )
      `,
      [
        sucursal.id,
        sucursal.negocio_id,
        sucursal.nombre,
        sucursal.direccion,
        sucursal.telefono,
        booleanoSQLite(sucursal.activo),
        sucursal.created_at,
      ]
    );
  }

  /*
   * ============================================================
   * INSERTAR USUARIOS
   * ============================================================
   */

  for (const usuario of usuarios) {
    await db.execute(
      `
        INSERT INTO usuarios (
          id,
          auth_user_id,
          negocio_id,
          nombre,
          rol,
          activo,
          sucursal_id,
          foto_url,
          created_at
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8,
          $9
        )
      `,
      [
        usuario.id,
        usuario.auth_user_id,
        usuario.negocio_id,
        usuario.nombre,
        usuario.rol,
        booleanoSQLite(usuario.activo),
        usuario.sucursal_id,
        usuario.foto_url,
        usuario.created_at,
      ]
    );
  }

  /*
   * ============================================================
   * INSERTAR USUARIO_SUCURSALES
   * ============================================================
   */

  for (const asignacion of usuarioSucursales) {
    await db.execute(
      `
        INSERT INTO usuario_sucursales (
          id,
          usuario_id,
          sucursal_id,
          created_at
        )
        VALUES (
          $1,
          $2,
          $3,
          $4
        )
      `,
      [
        asignacion.id,
        asignacion.usuario_id,
        asignacion.sucursal_id,
        asignacion.created_at,
      ]
    );
  }

  /*
   * ============================================================
   * INSERTAR CAJAS
   * ============================================================
   */

  for (const caja of cajas) {
    await db.execute(
      `
        INSERT INTO cajas (
          id,
          sucursal_id,
          nombre,
          activo,
          created_at
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5
        )
      `,
      [
        caja.id,
        caja.sucursal_id,
        caja.nombre,
        booleanoSQLite(caja.activo),
        caja.created_at,
      ]
    );
  }

  /*
   * ============================================================
   * INSERTAR USUARIO_CAJAS
   * ============================================================
   */

  for (const asignacion of usuarioCajas) {
    await db.execute(
      `
        INSERT INTO usuario_cajas (
          id,
          usuario_id,
          caja_id,
          created_at
        )
        VALUES (
          $1,
          $2,
          $3,
          $4
        )
      `,
      [
        asignacion.id,
        asignacion.usuario_id,
        asignacion.caja_id,
        asignacion.created_at,
      ]
    );
  }

  /*
   * ============================================================
   * INSERTAR CATEGORIAS
   * ============================================================
   */

  for (const categoria of categorias) {
    await db.execute(
      `
        INSERT INTO categorias (
          id,
          negocio_id,
          nombre,
          descripcion,
          activo,
          created_at
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6
        )
      `,
      [
        categoria.id,
        categoria.negocio_id,
        categoria.nombre,
        categoria.descripcion,
        booleanoSQLite(categoria.activo),
        categoria.created_at,
      ]
    );
  }

  /*
   * ============================================================
   * INSERTAR PRODUCTOS
   * ============================================================
   */

  for (const producto of productos) {
    await db.execute(
      `
        INSERT INTO productos (
          id,
          negocio_id,
          categoria_id,
          codigo_barras,
          sku,
          nombre,
          descripcion,
          precio_compra,
          precio_venta,
          unidad,
          imagen_url,
          stock_minimo,
          activo,
          precio_base,
          created_at,
          updated_at
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8,
          $9,
          $10,
          $11,
          $12,
          $13,
          $14,
          $15,
          $16
        )
      `,
      [
        producto.id,
        producto.negocio_id,
        producto.categoria_id,
        producto.codigo_barras,
        producto.sku,
        producto.nombre,
        producto.descripcion,
        numeroSeguro(producto.precio_compra),
        numeroSeguro(producto.precio_venta),
        producto.unidad,
        producto.imagen_url,
        numeroSeguro(producto.stock_minimo),
        booleanoSQLite(producto.activo),
        producto.precio_base === null
          ? null
          : numeroSeguro(producto.precio_base),
        producto.created_at,
        producto.updated_at,
      ]
    );
  }

  /*
   * ============================================================
   * INSERTAR INVENTARIO
   * ============================================================
   */

  for (const item of inventario) {
    await db.execute(
      `
        INSERT INTO inventario (
          id,
          producto_id,
          sucursal_id,
          stock,
          stock_reservado,
          created_at,
          updated_at
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7
        )
      `,
      [
        item.id,
        item.producto_id,
        item.sucursal_id,
        numeroSeguro(item.stock),
        numeroSeguro(item.stock_reservado),
        item.created_at,
        item.updated_at,
      ]
    );
  }

  /*
   * ============================================================
   * INSERTAR CLIENTES
   * ============================================================
   */

  for (const cliente of clientes) {
    await db.execute(
      `
        INSERT INTO clientes (
          id,
          negocio_id,
          nombre,
          telefono,
          email,
          direccion,
          rfc,
          limite_credito,
          saldo_credito,
          activo,
          created_at
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8,
          $9,
          $10,
          $11
        )
      `,
      [
        cliente.id,
        cliente.negocio_id,
        cliente.nombre,
        cliente.telefono,
        cliente.email,
        cliente.direccion,
        cliente.rfc,
        numeroSeguro(cliente.limite_credito),
        numeroSeguro(cliente.saldo_credito),
        booleanoSQLite(cliente.activo),
        cliente.created_at,
      ]
    );
  }

  /*
   * ============================================================
   * RESULTADO
   * ============================================================
   */

  const resultado: ResultadoSincronizacionInicial = {
    negocioId,
    negocio: negocios.length,
    sucursales: sucursales.length,
    usuarios: usuarios.length,
    usuarioSucursales: usuarioSucursales.length,
    cajas: cajas.length,
    usuarioCajas: usuarioCajas.length,
    categorias: categorias.length,
    productos: productos.length,
    inventario: inventario.length,
    clientes: clientes.length,
    total:
      negocios.length +
      sucursales.length +
      usuarios.length +
      usuarioSucursales.length +
      cajas.length +
      usuarioCajas.length +
      categorias.length +
      productos.length +
      inventario.length +
      clientes.length,
  };

  console.log(
    "Sincronización inicial SQLite completada:",
    resultado
  );

  return resultado;
}

