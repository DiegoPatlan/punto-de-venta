import { getSQLiteDatabase } from "./database";

export interface SQLiteCaja {
  id: string;
  sucursal_id: string;
  nombre: string;
  activo: number;
  created_at: string;
}

export interface SQLiteSesionCaja {
  id: string;
  caja_id: string;
  usuario_apertura_id: string;
  usuario_cierre_id: string | null;
  monto_inicial: number;
  monto_esperado: number;
  monto_real: number | null;
  diferencia: number | null;
  estado: string;
  fecha_apertura: string;
  fecha_cierre: string | null;
}

export async function obtenerCajasUsuario(
  usuarioId: string
): Promise<SQLiteCaja[]> {
  const db = await getSQLiteDatabase();

  return await db.select<SQLiteCaja[]>(
    `
      SELECT
        c.id,
        c.sucursal_id,
        c.nombre,
        c.activo,
        c.created_at
      FROM cajas c
      INNER JOIN usuario_cajas uc
        ON uc.caja_id = c.id
      WHERE uc.usuario_id = $1
        AND c.activo = 1
      ORDER BY c.nombre
    `,
    [usuarioId]
  );
}

export async function obtenerCajaPorId(
  cajaId: string
): Promise<SQLiteCaja | null> {
  const db = await getSQLiteDatabase();

  const rows = await db.select<SQLiteCaja[]>(
    `
      SELECT
        id,
        sucursal_id,
        nombre,
        activo,
        created_at
      FROM cajas
      WHERE id = $1
      LIMIT 1
    `,
    [cajaId]
  );

  return rows[0] ?? null;
}

export async function obtenerSesionCajaAbierta(
  cajaId: string
): Promise<SQLiteSesionCaja | null> {
  const db = await getSQLiteDatabase();

  const rows = await db.select<SQLiteSesionCaja[]>(
    `
      SELECT
        id,
        caja_id,
        usuario_apertura_id,
        usuario_cierre_id,
        monto_inicial,
        monto_esperado,
        monto_real,
        diferencia,
        estado,
        fecha_apertura,
        fecha_cierre
      FROM sesiones_caja
      WHERE caja_id = $1
        AND estado = 'abierta'
      ORDER BY fecha_apertura DESC
      LIMIT 1
    `,
    [cajaId]
  );

  return rows[0] ?? null;
}

export async function obtenerSesionCajaPorId(
  sesionId: string
): Promise<SQLiteSesionCaja | null> {
  const db = await getSQLiteDatabase();

  const rows = await db.select<SQLiteSesionCaja[]>(
    `
      SELECT
        id,
        caja_id,
        usuario_apertura_id,
        usuario_cierre_id,
        monto_inicial,
        monto_esperado,
        monto_real,
        diferencia,
        estado,
        fecha_apertura,
        fecha_cierre
      FROM sesiones_caja
      WHERE id = $1
      LIMIT 1
    `,
    [sesionId]
  );

  return rows[0] ?? null;
}
