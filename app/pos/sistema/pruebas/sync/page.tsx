"use client";

import { useState } from "react";

import { getSQLiteDatabase } from "../../../../../lib/sqlite/database";
import { obtenerClientePorId } from "../../../../../lib/sqlite/clientes";
import {
    agregarSyncQueue,
    obtenerSyncQueuePendientes,
} from "../../../../../lib/sqlite/syncQueue";
import { procesarSyncQueueItem } from "../../../../../lib/sqlite/syncEngine";
import { obtenerUsuarioPOS } from "../../../../../lib/usuarioPOS";
import { supabasePOS } from "../../../../../lib/supabase";

import ModalMensaje from "../../../../components/ModalMensaje";

interface ClientePrueba {
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

export default function PruebaSyncPage() {
    const [procesando, setProcesando] = useState(false);
    const [resultado, setResultado] = useState<string[]>([]);

    const [modal, setModal] = useState<{
        abierto: boolean;
        tipo: "exito" | "error" | "info" | "confirmacion";
        titulo: string;
        mensaje: string;
    }>({
        abierto: false,
        tipo: "info",
        titulo: "",
        mensaje: "",
    });

    function mostrarModal(
        tipo: "exito" | "error" | "info" | "confirmacion",
        titulo: string,
        mensaje: string
    ) {
        setModal({
            abierto: true,
            tipo,
            titulo,
            mensaje,
        });
    }

    function agregarResultado(mensaje: string) {
        setResultado((actual) => [...actual, mensaje]);
    }

    async function ejecutarPrueba() {
        if (procesando) return;

        setProcesando(true);
        setResultado([]);

        try {
            agregarResultado("1. Obteniendo usuario POS...");

            const usuarioPOS = await obtenerUsuarioPOS();

            if (
                !usuarioPOS ||
                !usuarioPOS.id ||
                !usuarioPOS.negocio_id
            ) {
                throw new Error(
                    "No existe un usuario POS autenticado con negocio_id válido."
                );
            }

            agregarResultado(
                `Usuario POS: ${usuarioPOS.nombre}`
            );

            agregarResultado(
                `Negocio: ${usuarioPOS.negocio_id}`
            );

            agregarResultado("2. Generando UUID local...");

            const clienteId = crypto.randomUUID();
            const ahora = new Date().toISOString();

            const nombrePrueba =
                `PRUEBA SYNC v1.6.0 ${new Date().toLocaleString("es-MX")}`;

            const cliente: ClientePrueba = {
                id: clienteId,
                negocio_id: usuarioPOS.negocio_id,
                nombre: nombrePrueba,
                telefono: null,
                email: null,
                direccion: null,
                rfc: null,
                limite_credito: 0,
                saldo_credito: 0,
                activo: 1,
                created_at: ahora,
            };

            agregarResultado(
                `UUID generado: ${clienteId}`
            );

            agregarResultado("3. Insertando cliente en SQLite...");

            const db = await getSQLiteDatabase();

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
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        `,
                [
                    cliente.id,
                    cliente.negocio_id,
                    cliente.nombre,
                    cliente.telefono,
                    cliente.email,
                    cliente.direccion,
                    cliente.rfc,
                    cliente.limite_credito,
                    cliente.saldo_credito,
                    cliente.activo,
                    cliente.created_at,
                ]
            );

            const clienteLocal = await obtenerClientePorId(
                cliente.id
            );

            if (!clienteLocal) {
                throw new Error(
                    "El cliente no pudo ser encontrado después de insertarlo en SQLite."
                );
            }

            agregarResultado(
                `Cliente creado localmente: ${clienteLocal.nombre}`
            );

            agregarResultado("4. Agregando operación a sync_queue...");

            const queueId = await agregarSyncQueue({
                entidad: "clientes",
                operacion: "insert",
                registro_id: cliente.id,
                payload: cliente,
            });

            agregarResultado(
                `Operación creada en sync_queue: ${queueId}`
            );

            agregarResultado("5. Recuperando operación pendiente...");

            const pendientes =
                await obtenerSyncQueuePendientes();

            const item = pendientes.find(
                (elemento) => elemento.id === queueId
            );

            if (!item) {
                throw new Error(
                    "No fue posible recuperar la operación recién creada en sync_queue."
                );
            }

            agregarResultado(
                `Estado inicial: ${item.estado}`
            );

            agregarResultado("6. Enviando operación a Supabase...");

            await procesarSyncQueueItem(item);

            agregarResultado(
                "Operación enviada correctamente a Supabase."
            );

            agregarResultado("7. Verificando cliente en Supabase...");

            const {
                data: clienteSupabase,
                error: errorSupabase,
            } = await supabasePOS
                .from("clientes")
                .select(
                    `
            id,
            negocio_id,
            nombre,
            limite_credito,
            saldo_credito,
            activo
          `
                )
                .eq("id", cliente.id)
                .maybeSingle();

            if (errorSupabase) {
                throw new Error(
                    `No fue posible verificar el cliente en Supabase: ${errorSupabase.message}`
                );
            }

            if (!clienteSupabase) {
                throw new Error(
                    "La operación terminó pero el cliente no fue encontrado en Supabase."
                );
            }

            agregarResultado(
                `Cliente confirmado en Supabase: ${clienteSupabase.nombre}`
            );

            agregarResultado(
                `UUID Supabase: ${clienteSupabase.id}`
            );

            agregarResultado(
                `Negocio Supabase: ${clienteSupabase.negocio_id}`
            );

            agregarResultado(
                `Activo Supabase: ${clienteSupabase.activo ? "Sí" : "No"}`
            );

            agregarResultado(
                "8. Verificando estado final de sync_queue..."
            );

            const pendientesFinales =
                await obtenerSyncQueuePendientes();

            const itemFinal = pendientesFinales.find(
                (elemento) => elemento.id === queueId
            );

            if (itemFinal) {
                throw new Error(
                    `La operación continúa en la cola con estado "${itemFinal.estado}".`
                );
            }

            agregarResultado(
                "Estado final: sincronizado"
            );

            mostrarModal(
                "exito",
                "Sincronización exitosa",
                "La prueba SQLite → sync_queue → Supabase terminó correctamente."
            );
        } catch (error) {
            const mensaje =
                error instanceof Error
                    ? error.message
                    : String(error);

            agregarResultado(
                `ERROR: ${mensaje}`
            );

            mostrarModal(
                "error",
                "Error en la prueba",
                mensaje
            );
        } finally {
            setProcesando(false);
        }
    }

    return (
        <>
            <main className="min-h-screen bg-slate-100 p-4 sm:p-6">
                <div className="mx-auto max-w-4xl">
                    <div className="mb-6">
                        <div className="inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                            PRUEBA TEMPORAL — v1.6.0
                        </div>

                        <h1 className="mt-3 text-2xl font-bold text-slate-900">
                            Prueba de sincronización SQLite → Supabase
                        </h1>

                        <p className="mt-2 text-sm text-slate-600">
                            Esta página crea un cliente de prueba localmente,
                            lo agrega a la cola de sincronización y lo envía
                            a Supabase.
                        </p>
                    </div>

                    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <h2 className="font-semibold text-slate-900">
                                    Flujo controlado
                                </h2>

                                <p className="mt-1 text-sm text-slate-500">
                                    No modifica la pantalla normal de clientes.
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={ejecutarPrueba}
                                disabled={procesando}
                                className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {procesando
                                    ? "Ejecutando prueba..."
                                    : "Ejecutar prueba"}
                            </button>
                        </div>
                    </section>

                    {resultado.length > 0 && (
                        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                            <h2 className="font-semibold text-slate-900">
                                Resultado
                            </h2>

                            <div className="mt-4 space-y-2">
                                {resultado.map((mensaje, index) => (
                                    <div
                                        key={`${index}-${mensaje}`}
                                        className="rounded-lg bg-slate-50 px-3 py-2 font-mono text-xs text-slate-700"
                                    >
                                        {mensaje}
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}
                </div>
            </main>

            {modal.abierto && (
                <ModalMensaje
                    abierto={modal.abierto}
                    tipo={modal.tipo}
                    titulo={modal.titulo}
                    mensaje={modal.mensaje}
                    onCerrar={() =>
                        setModal((actual) => ({
                            ...actual,
                            abierto: false,
                        }))
                    }
                />
            )}
        </>
    );
}
