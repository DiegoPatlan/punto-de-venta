import { getSQLiteDatabase } from "./database";

export interface SQLiteInventario {
  id: string;
  producto_id: string;
  sucursal_id: string;
  stock: number;
  stock_reservado: number;
  created_at: string;
  updated_at: string | null;
}

export async function obtenerInventarioProducto(
  productoId: string,
  sucursalId: string
): Promise<SQLiteInventario | null> {
  const db = await getSQLiteDatabase();

  const rows = await db.select<SQLiteInventario[]>(
    `
      SELECT
        id,
        producto_id,
        sucursal_id,
        stock,
        stock_reservado,
        created_at,
        updated_at
      FROM inventario
      WHERE producto_id = $1
        AND sucursal_id = $2
      LIMIT 1
    `,
    [productoId, sucursalId]
  );

  return rows[0] ?? null;
}

export async function obtenerInventarioSucursal(
  sucursalId: string
): Promise<SQLiteInventario[]> {
  const db = await getSQLiteDatabase();

  return await db.select<SQLiteInventario[]>(
    `
      SELECT
        id,
        producto_id,
        sucursal_id,
        stock,
        stock_reservado,
        created_at,
        updated_at
      FROM inventario
      WHERE sucursal_id = $1
      ORDER BY producto_id
    `,
    [sucursalId]
  );
}
