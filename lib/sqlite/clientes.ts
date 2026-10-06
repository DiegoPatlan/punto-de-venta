import { getSQLiteDatabase } from "./database";

export interface SQLiteCliente {
  id: string;
  negocio_id: string;
  nombre: string;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  rfc: string | null;
  limite_credito: number;
  saldo_credito: number;
  activo: number;
  created_at: string;
}

export async function obtenerClientePorId(
  clienteId: string
): Promise<SQLiteCliente | null> {
  const db = await getSQLiteDatabase();

  const rows = await db.select<SQLiteCliente[]>(
    `
      SELECT
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
      FROM clientes
      WHERE id = $1
      LIMIT 1
    `,
    [clienteId]
  );

  return rows[0] ?? null;
}

export async function obtenerClientesNegocio(
  negocioId: string
): Promise<SQLiteCliente[]> {
  const db = await getSQLiteDatabase();

  return await db.select<SQLiteCliente[]>(
    `
      SELECT
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
      FROM clientes
      WHERE negocio_id = $1
        AND activo = 1
      ORDER BY nombre
    `,
    [negocioId]
  );
}
