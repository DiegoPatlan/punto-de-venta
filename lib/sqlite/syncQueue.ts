import { getSQLiteDatabase } from "./database";

export type SyncQueueEstado = "pendiente" | "procesando" | "sincronizado" | "error";

export interface SyncQueueItem {
  id: string;
  device_id: string;
  entidad: string;
  operacion: string;
  registro_id: string;
  payload: string;
  estado: SyncQueueEstado;
  intentos: number;
  ultimo_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface AgregarSyncQueueInput {
  entidad: string;
  operacion: string;
  registro_id: string;
  payload: unknown;
}

export async function agregarSyncQueue(
  input: AgregarSyncQueueInput
): Promise<string> {
  const db = await getSQLiteDatabase();

  const deviceIdResult = await db.select<{ device_id: string }[]>(
    "SELECT device_id FROM device_info WHERE id = 1 LIMIT 1;"
  );

  if (deviceIdResult.length === 0 || !deviceIdResult[0].device_id) {
    throw new Error("No existe un device_id local.");
  }

  const id = crypto.randomUUID();
  const ahora = new Date().toISOString();

  await db.execute(
    `
      INSERT INTO sync_queue (
        id,
        device_id,
        entidad,
        operacion,
        registro_id,
        payload,
        estado,
        intentos,
        ultimo_error,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, 'pendiente', 0, NULL, ?, ?);
    `,
    [
      id,
      deviceIdResult[0].device_id,
      input.entidad,
      input.operacion,
      input.registro_id,
      JSON.stringify(input.payload),
      ahora,
      ahora,
    ]
  );

  return id;
}

export async function obtenerSyncQueuePendientes(): Promise<SyncQueueItem[]> {
  const db = await getSQLiteDatabase();

  return db.select<SyncQueueItem[]>(
    `
      SELECT
        id,
        device_id,
        entidad,
        operacion,
        registro_id,
        payload,
        estado,
        intentos,
        ultimo_error,
        created_at,
        updated_at
      FROM sync_queue
      WHERE estado IN ('pendiente', 'error')
      ORDER BY created_at ASC;
    `
  );
}

export async function marcarSyncQueueProcesando(
  id: string
): Promise<void> {
  const db = await getSQLiteDatabase();

  await db.execute(
    `
      UPDATE sync_queue
      SET
        estado = 'procesando',
        updated_at = ?
      WHERE id = ?;
    `,
    [new Date().toISOString(), id]
  );
}

export async function marcarSyncQueueSincronizado(
  id: string
): Promise<void> {
  const db = await getSQLiteDatabase();

  await db.execute(
    `
      UPDATE sync_queue
      SET
        estado = 'sincronizado',
        ultimo_error = NULL,
        updated_at = ?
      WHERE id = ?;
    `,
    [new Date().toISOString(), id]
  );
}

export async function marcarSyncQueueError(
  id: string,
  error: string
): Promise<void> {
  const db = await getSQLiteDatabase();

  await db.execute(
    `
      UPDATE sync_queue
      SET
        estado = 'error',
        intentos = intentos + 1,
        ultimo_error = ?,
        updated_at = ?
      WHERE id = ?;
    `,
    [error, new Date().toISOString(), id]
  );
}
