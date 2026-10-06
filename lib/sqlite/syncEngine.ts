import {
  marcarSyncQueueError,
  marcarSyncQueueProcesando,
  marcarSyncQueueSincronizado,
  obtenerSyncQueuePendientes,
  type SyncQueueItem,
} from "./syncQueue";

export async function procesarSyncQueueItem(
  item: SyncQueueItem
): Promise<void> {
  await marcarSyncQueueProcesando(item.id);

  try {
    throw new Error(
      "El envío a Supabase todavía no está implementado."
    );
  } catch (error) {
    const mensaje =
      error instanceof Error ? error.message : String(error);

    await marcarSyncQueueError(item.id, mensaje);

    throw error;
  }
}

export async function procesarSyncQueue(): Promise<void> {
  const pendientes = await obtenerSyncQueuePendientes();

  for (const item of pendientes) {
    try {
      await procesarSyncQueueItem(item);
    } catch {
      // El error ya fue registrado en sync_queue.
      // Continuamos con el siguiente elemento.
    }
  }
}
