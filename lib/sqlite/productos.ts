import { getSQLiteDatabase } from "./database";

export interface SQLiteProducto {
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
  activo: number;
  precio_base: number | null;
  created_at: string;
  updated_at: string | null;
}

export async function obtenerProductoPorId(
  productoId: string
): Promise<SQLiteProducto | null> {
  const db = await getSQLiteDatabase();

  const rows = await db.select<SQLiteProducto[]>(
    `
      SELECT
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
      FROM productos
      WHERE id = $1
      LIMIT 1
    `,
    [productoId]
  );

  return rows[0] ?? null;
}

export async function obtenerProductoPorCodigoBarras(
  negocioId: string,
  codigoBarras: string
): Promise<SQLiteProducto | null> {
  const db = await getSQLiteDatabase();

  const rows = await db.select<SQLiteProducto[]>(
    `
      SELECT
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
      FROM productos
      WHERE negocio_id = $1
        AND codigo_barras = $2
        AND activo = 1
      LIMIT 1
    `,
    [negocioId, codigoBarras]
  );

  return rows[0] ?? null;
}

export async function obtenerProductoPorSku(
  negocioId: string,
  sku: string
): Promise<SQLiteProducto | null> {
  const db = await getSQLiteDatabase();

  const rows = await db.select<SQLiteProducto[]>(
    `
      SELECT
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
      FROM productos
      WHERE negocio_id = $1
        AND sku = $2
        AND activo = 1
      LIMIT 1
    `,
    [negocioId, sku]
  );

  return rows[0] ?? null;
}
