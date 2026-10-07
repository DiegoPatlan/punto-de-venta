import { supabasePOS } from "../supabase";
import { obtenerUsuarioPOS } from "../usuarioPOS";

import {
  marcarSyncQueueError,
  marcarSyncQueueProcesando,
  marcarSyncQueueSincronizado,
  obtenerSyncQueuePendientes,
  type SyncQueueItem,
} from "./syncQueue";

import type { SQLiteCliente } from "./clientes";

type SyncClienteInsertPayload = Pick<
  SQLiteCliente,
  | "id"
  | "negocio_id"
  | "nombre"
  | "telefono"
  | "email"
  | "direccion"
  | "rfc"
  | "limite_credito"
  | "saldo_credito"
  | "activo"
  | "created_at"
>;

function obtenerPayloadCliente(
  item: SyncQueueItem
): SyncClienteInsertPayload {
  let payload: unknown;

  try {
    payload = JSON.parse(item.payload);
  } catch {
    throw new Error(
      "El payload de sync_queue no contiene JSON válido."
    );
  }

  if (
    !payload ||
    typeof payload !== "object" ||
    Array.isArray(payload)
  ) {
    throw new Error(
      "El payload de cliente no tiene un formato válido."
    );
  }

  const cliente =
    payload as Partial<SyncClienteInsertPayload>;

  if (!cliente.id) {
    throw new Error(
      "El payload del cliente no contiene id."
    );
  }

  if (!cliente.negocio_id) {
    throw new Error(
      "El payload del cliente no contiene negocio_id."
    );
  }

  if (!cliente.nombre) {
    throw new Error(
      "El payload del cliente no contiene nombre."
    );
  }

  if (cliente.limite_credito === undefined) {
    throw new Error(
      "El payload del cliente no contiene limite_credito."
    );
  }

  if (cliente.saldo_credito === undefined) {
    throw new Error(
      "El payload del cliente no contiene saldo_credito."
    );
  }

  if (cliente.activo === undefined) {
    throw new Error(
      "El payload del cliente no contiene activo."
    );
  }

  if (!cliente.created_at) {
    throw new Error(
      "El payload del cliente no contiene created_at."
    );
  }

  return {
    id: cliente.id,
    negocio_id: cliente.negocio_id,
    nombre: cliente.nombre,
    telefono: cliente.telefono ?? null,
    email: cliente.email ?? null,
    direccion: cliente.direccion ?? null,
    rfc: cliente.rfc ?? null,
    limite_credito: Number(
      cliente.limite_credito
    ),
    saldo_credito: Number(
      cliente.saldo_credito
    ),
    activo: Number(cliente.activo),
    created_at: cliente.created_at,
  };
}

async function sincronizarClienteInsert(
  item: SyncQueueItem
): Promise<void> {
  const cliente =
    obtenerPayloadCliente(item);

  if (item.registro_id !== cliente.id) {
    throw new Error(
      "El registro_id de sync_queue no coincide con el id del cliente."
    );
  }

  /*
   * ==========================================
   * VALIDAR USUARIO POS
   * ==========================================
   */

  const usuarioPOS =
    await obtenerUsuarioPOS();

  if (
    !usuarioPOS ||
    !usuarioPOS.id ||
    !usuarioPOS.negocio_id
  ) {
    throw new Error(
      "No existe un usuario POS autenticado válido para sincronizar."
    );
  }

  /*
   * ==========================================
   * VALIDAR NEGOCIO
   * ==========================================
   *
   * El cliente debe pertenecer al mismo negocio
   * del usuario POS que está ejecutando la
   * sincronización.
   */

  if (
    cliente.negocio_id !==
    usuarioPOS.negocio_id
  ) {
    throw new Error(
      "El cliente pertenece a un negocio diferente al usuario POS autenticado."
    );
  }

  /*
   * ==========================================
   * IDEMPOTENCIA
   * ==========================================
   *
   * Antes de insertar, verificamos si el UUID
   * ya existe en Supabase.
   *
   * Si ya existe en el mismo negocio,
   * consideramos la operación sincronizada.
   */

  const {
    data: clienteExistente,
    error: errorExistente,
  } = await supabasePOS
    .from("clientes")
    .select(
      "id, negocio_id"
    )
    .eq(
      "id",
      cliente.id
    )
    .maybeSingle();

  if (errorExistente) {
    throw new Error(
      `No fue posible verificar el cliente en Supabase: ${errorExistente.message}`
    );
  }

  if (clienteExistente) {
    if (
      clienteExistente.negocio_id !==
      usuarioPOS.negocio_id
    ) {
      throw new Error(
        "El UUID del cliente ya existe en otro negocio."
      );
    }

    return;
  }

  /*
   * ==========================================
   * INSERTAR EN SUPABASE
   * ==========================================
   */

  const {
    error: errorInsert,
  } = await supabasePOS
    .from("clientes")
    .insert({
      id: cliente.id,
      negocio_id:
        cliente.negocio_id,
      nombre:
        cliente.nombre,
      telefono:
        cliente.telefono,
      email:
        cliente.email,
      direccion:
        cliente.direccion,
      rfc:
        cliente.rfc,
      limite_credito:
        cliente.limite_credito,
      saldo_credito:
        cliente.saldo_credito,
      activo:
        cliente.activo === 1,
      created_at:
        cliente.created_at,
    });

  if (errorInsert) {
    throw new Error(
      `No fue posible insertar el cliente en Supabase: ${errorInsert.message}`
    );
  }
}

export async function procesarSyncQueueItem(
  item: SyncQueueItem
): Promise<void> {
  await marcarSyncQueueProcesando(
    item.id
  );

  try {
    /*
     * ==========================================
     * ENTIDADES SOPORTADAS EN v1.6.0
     * ==========================================
     */

    if (
      item.entidad !== "clientes"
    ) {
      throw new Error(
        `Entidad no soportada por el motor de sincronización: ${item.entidad}`
      );
    }

    /*
     * ==========================================
     * OPERACIONES SOPORTADAS
     * ==========================================
     *
     * Por ahora solamente INSERT.
     *
     * UPDATE y DELETE se habilitarán después
     * de validar sus reglas de conflicto.
     */

    if (
      item.operacion !== "insert"
    ) {
      throw new Error(
        `Operación no soportada para clientes: ${item.operacion}`
      );
    }

    await sincronizarClienteInsert(
      item
    );

    await marcarSyncQueueSincronizado(
      item.id
    );
  } catch (error) {
    const mensaje =
      error instanceof Error
        ? error.message
        : String(error);

    await marcarSyncQueueError(
      item.id,
      mensaje
    );

    throw error;
  }
}

export async function procesarSyncQueue(): Promise<void> {
  const pendientes =
    await obtenerSyncQueuePendientes();

  for (const item of pendientes) {
    try {
      await procesarSyncQueueItem(
        item
      );
    } catch {
      /*
       * El error ya fue registrado
       * en sync_queue.
       *
       * Continuamos con el siguiente
       * elemento.
       */
    }
  }
}