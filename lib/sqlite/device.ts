import { getSQLiteDatabase } from "./database";

export interface SQLiteDeviceInfo {
  id: number;
  device_id: string;
  created_at: string;
  updated_at: string;
}

export async function obtenerDeviceId(): Promise<string> {
  const db = await getSQLiteDatabase();

  const filasIniciales = await db.select<SQLiteDeviceInfo[]>(
    "SELECT id, device_id, created_at, updated_at FROM device_info WHERE id = 1 LIMIT 1;"
  );

  if (filasIniciales.length > 0 && filasIniciales[0].device_id) {
    return filasIniciales[0].device_id;
  }

  const deviceIdNuevo = crypto.randomUUID();
  const ahora = new Date().toISOString();

  await db.execute(
    `
      INSERT OR IGNORE INTO device_info (
        id,
        device_id,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?);
    `,
    [1, deviceIdNuevo, ahora, ahora]
  );

  const filasFinales = await db.select<SQLiteDeviceInfo[]>(
    "SELECT id, device_id, created_at, updated_at FROM device_info WHERE id = 1 LIMIT 1;"
  );

  if (filasFinales.length === 0 || !filasFinales[0].device_id) {
    throw new Error("No fue posible obtener el device_id local.");
  }

  return filasFinales[0].device_id;
}
