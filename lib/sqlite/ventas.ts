import { getSQLiteDatabase } from "./database";

export interface SQLiteVenta {
  id: string;
  negocio_id: string;
  sucursal_id: string;
  caja_id: string;
  sesion_caja_id: string;
  usuario_id: string;
  cliente_id: string | null;
  subtotal: number;
  descuento: number;
  impuesto: number;
  total: number;
  metodo_pago: string;
  estado: string;
  referencia: string | null;
  notas: string | null;
  created_at: string;
  folio: number | null;
}

export interface SQLiteDetalleVenta {
  id: string;
  venta_id: string;
  producto_id: string;
  cantidad: number;
  precio_unitario: number;
  descuento: number;
  impuesto: number;
  subtotal: number;
  total: number;
  created_at: string;
}

export interface SQLitePago {
  id: string;
  venta_id: string;
  metodo_pago: string;
  monto: number;
  monto_recibido: number | null;
  cambio: number;
  referencia: string | null;
  created_at: string;
}

export async function obtenerVentaPorId(
  ventaId: string
): Promise<SQLiteVenta | null> {
  const db = await getSQLiteDatabase();

  const rows = await db.select<SQLiteVenta[]>(
    `
      SELECT
        id,
        negocio_id,
        sucursal_id,
        caja_id,
        sesion_caja_id,
        usuario_id,
        cliente_id,
        subtotal,
        descuento,
        impuesto,
        total,
        metodo_pago,
        estado,
        referencia,
        notas,
        created_at,
        folio
      FROM ventas
      WHERE id = $1
      LIMIT 1
    `,
    [ventaId]
  );

  return rows[0] ?? null;
}

export async function obtenerDetallesVenta(
  ventaId: string
): Promise<SQLiteDetalleVenta[]> {
  const db = await getSQLiteDatabase();

  return await db.select<SQLiteDetalleVenta[]>(
    `
      SELECT
        id,
        venta_id,
        producto_id,
        cantidad,
        precio_unitario,
        descuento,
        impuesto,
        subtotal,
        total,
        created_at
      FROM detalle_ventas
      WHERE venta_id = $1
      ORDER BY created_at
    `,
    [ventaId]
  );
}

export async function obtenerPagosVenta(
  ventaId: string
): Promise<SQLitePago[]> {
  const db = await getSQLiteDatabase();

  return await db.select<SQLitePago[]>(
    `
      SELECT
        id,
        venta_id,
        metodo_pago,
        monto,
        monto_recibido,
        cambio,
        referencia,
        created_at
      FROM pagos
      WHERE venta_id = $1
      ORDER BY created_at
    `,
    [ventaId]
  );
}

export async function obtenerVentasSesion(
  sesionCajaId: string
): Promise<SQLiteVenta[]> {
  const db = await getSQLiteDatabase();

  return await db.select<SQLiteVenta[]>(
    `
      SELECT
        id,
        negocio_id,
        sucursal_id,
        caja_id,
        sesion_caja_id,
        usuario_id,
        cliente_id,
        subtotal,
        descuento,
        impuesto,
        total,
        metodo_pago,
        estado,
        referencia,
        notas,
        created_at,
        folio
      FROM ventas
      WHERE sesion_caja_id = $1
      ORDER BY created_at DESC
    `,
    [sesionCajaId]
  );
}
