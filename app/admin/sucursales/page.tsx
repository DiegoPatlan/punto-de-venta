"use client";

import { useEffect, useState } from "react";

import Card from "../../components/Card";
import Button from "../../components/Button";
import ModalMensaje from "../../components/ModalMensaje";

import { supabase } from "../../../lib/supabase";
import { obtenerUsuarioActual } from "../../../lib/auth/roleGuard";

interface Sucursal {
    id: string;
    negocio_id: string;
    nombre: string;
    direccion: string | null;
    telefono: string | null;
    activo: boolean;
    created_at: string;
}

interface UsuarioActual {
    negocio_id: string | null;
}

type TipoMensaje =
    | "exito"
    | "error"
    | "confirmacion"
    | "info";

export default function SucursalesPage() {
    const [sucursales, setSucursales] = useState<Sucursal[]>([]);

    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState("");

    const [modalAbierto, setModalAbierto] = useState(false);
    const [editando, setEditando] =
        useState<Sucursal | null>(null);

    const [nombre, setNombre] = useState("");
    const [direccion, setDireccion] = useState("");
    const [telefono, setTelefono] = useState("");
    const [activo, setActivo] = useState(true);

    const [guardando, setGuardando] = useState(false);

    /* =========================================================
       MODAL DE MENSAJES
    ========================================================= */

    const [modalMensajeAbierto, setModalMensajeAbierto] =
        useState(false);

    const [tipoMensaje, setTipoMensaje] =
        useState<TipoMensaje>("info");

    const [tituloMensaje, setTituloMensaje] =
        useState("");

    const [textoMensaje, setTextoMensaje] =
        useState("");

    const [sucursalPendienteEstado, setSucursalPendienteEstado] =
        useState<Sucursal | null>(null);

    function mostrarMensaje(
        tipo: TipoMensaje,
        titulo: string,
        mensaje: string
    ) {
        if (!mensaje) return;

        setTipoMensaje(tipo);
        setTituloMensaje(titulo);
        setTextoMensaje(mensaje);
        setModalMensajeAbierto(true);
    }

    function cerrarModalMensaje() {
        if (guardando) return;

        setModalMensajeAbierto(false);
        setSucursalPendienteEstado(null);
    }

    /* =========================================================
       CARGAR SUCURSALES
    ========================================================= */

    async function cargarSucursales() {
        setCargando(true);
        setError("");

        try {
            const usuario =
                (await obtenerUsuarioActual()) as
                | UsuarioActual
                | null;

            if (!usuario?.negocio_id) {
                const mensaje =
                    "No se encontró el negocio del usuario.";

                setError(mensaje);

                mostrarMensaje(
                    "error",
                    "No se pudo cargar",
                    mensaje
                );

                return;
            }

            const {
                data,
                error: errorSucursales,
            } = await supabase
                .from("sucursales")
                .select(`
                    id,
                    negocio_id,
                    nombre,
                    direccion,
                    telefono,
                    activo,
                    created_at
                `)
                .eq(
                    "negocio_id",
                    usuario.negocio_id
                )
                .order("created_at", {
                    ascending: true,
                });

            if (errorSucursales) {
                console.error(
                    "Error cargando sucursales:",
                    errorSucursales
                );

                const mensaje =
                    "No se pudieron cargar las sucursales.";

                setError(mensaje);

                mostrarMensaje(
                    "error",
                    "Error al cargar",
                    mensaje
                );

                return;
            }

            setSucursales(
                (data ?? []) as Sucursal[]
            );
        } catch (error) {
            console.error(
                "Error inesperado cargando sucursales:",
                error
            );

            const mensaje =
                "Ocurrió un error al cargar las sucursales.";

            setError(mensaje);

            mostrarMensaje(
                "error",
                "Error inesperado",
                mensaje
            );
        } finally {
            setCargando(false);
        }
    }

    useEffect(() => {
        cargarSucursales();
    }, []);

    /* =========================================================
       NUEVA SUCURSAL
    ========================================================= */

    function abrirNuevaSucursal() {
        setEditando(null);
        setNombre("");
        setDireccion("");
        setTelefono("");
        setActivo(true);
        setModalAbierto(true);
    }

    /* =========================================================
       EDITAR SUCURSAL
    ========================================================= */

    function abrirEditarSucursal(
        sucursal: Sucursal
    ) {
        setEditando(sucursal);
        setNombre(sucursal.nombre);
        setDireccion(
            sucursal.direccion ?? ""
        );
        setTelefono(
            sucursal.telefono ?? ""
        );
        setActivo(sucursal.activo);
        setModalAbierto(true);
    }

    /* =========================================================
       CERRAR MODAL FORMULARIO
    ========================================================= */

    function cerrarModal() {
        if (guardando) return;

        setModalAbierto(false);
        setEditando(null);
        setNombre("");
        setDireccion("");
        setTelefono("");
        setActivo(true);
    }

    /* =========================================================
       GUARDAR SUCURSAL
    ========================================================= */

    async function guardarSucursal() {
        if (!nombre.trim()) {
            mostrarMensaje(
                "info",
                "Dato obligatorio",
                "El nombre de la sucursal es obligatorio."
            );

            return;
        }

        setGuardando(true);

        try {
            const usuario =
                (await obtenerUsuarioActual()) as
                | UsuarioActual
                | null;

            if (!usuario?.negocio_id) {
                mostrarMensaje(
                    "error",
                    "No se pudo guardar",
                    "No se encontró el negocio del usuario."
                );

                return;
            }

            if (editando) {
                const {
                    error: errorActualizar,
                } = await supabase
                    .from("sucursales")
                    .update({
                        nombre: nombre.trim(),
                        direccion:
                            direccion.trim() || null,
                        telefono:
                            telefono.trim() || null,
                        activo,
                    })
                    .eq(
                        "id",
                        editando.id
                    )
                    .eq(
                        "negocio_id",
                        usuario.negocio_id
                    );

                if (errorActualizar) {
                    console.error(
                        "Error actualizando sucursal:",
                        errorActualizar
                    );

                    mostrarMensaje(
                        "error",
                        "No se pudo actualizar",
                        "No se pudo actualizar la sucursal."
                    );

                    return;
                }

                cerrarModal();

                await cargarSucursales();

                mostrarMensaje(
                    "exito",
                    "Sucursal actualizada",
                    "Los datos de la sucursal se actualizaron correctamente."
                );
            } else {
                const {
                    error: errorCrear,
                } = await supabase
                    .from("sucursales")
                    .insert({
                        negocio_id:
                            usuario.negocio_id,
                        nombre: nombre.trim(),
                        direccion:
                            direccion.trim() || null,
                        telefono:
                            telefono.trim() || null,
                        activo,
                    });

                if (errorCrear) {
                    console.error(
                        "Error creando sucursal:",
                        errorCrear
                    );

                    mostrarMensaje(
                        "error",
                        "No se pudo crear",
                        "No se pudo crear la sucursal."
                    );

                    return;
                }

                cerrarModal();

                await cargarSucursales();

                mostrarMensaje(
                    "exito",
                    "Sucursal creada",
                    "La sucursal se creó correctamente."
                );
            }
        } catch (error) {
            console.error(
                "Error inesperado guardando sucursal:",
                error
            );

            mostrarMensaje(
                "error",
                "Error inesperado",
                "Ocurrió un error al guardar la sucursal."
            );
        } finally {
            setGuardando(false);
        }
    }

    /* =========================================================
       CAMBIO DE ESTADO
    ========================================================= */

    function solicitarCambioEstado(
        sucursal: Sucursal
    ) {
        const nuevoEstado = !sucursal.activo;

        const accion = nuevoEstado
            ? "activar"
            : "desactivar";

        setSucursalPendienteEstado(sucursal);

        mostrarMensaje(
            "confirmacion",
            nuevoEstado
                ? "Activar sucursal"
                : "Desactivar sucursal",
            `¿Seguro que deseas ${accion} la sucursal "${sucursal.nombre}"?`
        );
    }

    async function confirmarCambioEstado() {
        if (!sucursalPendienteEstado) return;

        const sucursal =
            sucursalPendienteEstado;

        const nuevoEstado =
            !sucursal.activo;

        setModalMensajeAbierto(false);

        try {
            const usuario =
                (await obtenerUsuarioActual()) as
                | UsuarioActual
                | null;

            if (!usuario?.negocio_id) {
                setSucursalPendienteEstado(null);

                mostrarMensaje(
                    "error",
                    "No se pudo actualizar",
                    "No se encontró el negocio del usuario."
                );

                return;
            }

            const {
                error: errorActualizar,
            } = await supabase
                .from("sucursales")
                .update({
                    activo: nuevoEstado,
                })
                .eq(
                    "id",
                    sucursal.id
                )
                .eq(
                    "negocio_id",
                    usuario.negocio_id
                );

            if (errorActualizar) {
                console.error(
                    "Error cambiando estado:",
                    errorActualizar
                );

                setSucursalPendienteEstado(null);

                mostrarMensaje(
                    "error",
                    "No se pudo cambiar el estado",
                    "No se pudo cambiar el estado de la sucursal."
                );

                return;
            }

            setSucursalPendienteEstado(null);

            await cargarSucursales();

            mostrarMensaje(
                "exito",
                nuevoEstado
                    ? "Sucursal activada"
                    : "Sucursal desactivada",
                nuevoEstado
                    ? `La sucursal "${sucursal.nombre}" ahora está activa.`
                    : `La sucursal "${sucursal.nombre}" ahora está inactiva.`
            );
        } catch (error) {
            console.error(
                "Error inesperado cambiando estado:",
                error
            );

            setSucursalPendienteEstado(null);

            mostrarMensaje(
                "error",
                "Error inesperado",
                "Ocurrió un error al cambiar el estado."
            );
        }
    }

    /* =========================================================
       FECHA
    ========================================================= */

    function formatearFecha(
        fecha: string
    ) {
        return new Date(
            fecha
        ).toLocaleDateString(
            "es-MX",
            {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
            }
        );
    }

    const sucursalesActivas =
        sucursales.filter(
            (sucursal) =>
                sucursal.activo
        ).length;

    const sucursalesInactivas =
        sucursales.filter(
            (sucursal) =>
                !sucursal.activo
        ).length;

    /* =========================================================
       RENDER
    ========================================================= */

    return (
        <div className="space-y-6">
            {/* =================================================
                ENCABEZADO
            ================================================= */}

            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[var(--color-primary)]">
                        ADMINISTRACIÓN
                    </p>

                    <h1 className="mt-1 text-2xl font-black text-[var(--color-text)] sm:text-3xl">
                        Sucursales
                    </h1>

                    <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                        Administra las sucursales de tu negocio.
                    </p>
                </div>

                <Button
                    type="button"
                    onClick={
                        abrirNuevaSucursal
                    }
                    className="w-full sm:w-auto"
                >
                    + Nueva sucursal
                </Button>
            </div>

            {/* =================================================
                RESUMEN
            ================================================= */}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Card className="p-5">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
                                Total de sucursales
                            </p>

                            <p className="mt-2 text-3xl font-black text-[var(--color-text)]">
                                {sucursales.length}
                            </p>

                            <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                                Registradas en el negocio
                            </p>
                        </div>

                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-primary)]/10 text-xl">
                            🏪
                        </div>
                    </div>
                </Card>

                <Card className="p-5">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
                                Sucursales activas
                            </p>

                            <p className="mt-2 text-3xl font-black text-[var(--color-success)]">
                                {sucursalesActivas}
                            </p>

                            <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                                Disponibles para operaciones
                            </p>
                        </div>

                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-success)]/10 text-xl">
                            ✓
                        </div>
                    </div>
                </Card>

                <Card className="p-5">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
                                Sucursales inactivas
                            </p>

                            <p className="mt-2 text-3xl font-black text-[var(--color-text-secondary)]">
                                {sucursalesInactivas}
                            </p>

                            <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                                No disponibles actualmente
                            </p>
                        </div>

                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-text-secondary)]/10 text-xl">
                            ○
                        </div>
                    </div>
                </Card>
            </div>

            {/* =================================================
                CARGANDO
            ================================================= */}

            {cargando && (
                <Card className="p-8">
                    <div className="flex flex-col items-center justify-center text-center">
                        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-primary)]/10 text-xl">
                            ⏳
                        </div>

                        <p className="text-sm font-semibold text-[var(--color-text)]">
                            Cargando sucursales...
                        </p>

                        <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                            Estamos obteniendo la información de tu negocio.
                        </p>
                    </div>
                </Card>
            )}

            {/* =================================================
                ERROR
            ================================================= */}

            {!cargando && error && (
                <Card className="border-[var(--color-border)] p-6">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <p className="text-sm font-bold text-[var(--color-text)]">
                                No fue posible cargar las sucursales
                            </p>

                            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                                Intenta nuevamente.
                            </p>
                        </div>

                        <Button
                            type="button"
                            variant="secondary"
                            onClick={
                                cargarSucursales
                            }
                            className="w-full sm:w-auto"
                        >
                            Reintentar
                        </Button>
                    </div>
                </Card>
            )}

            {/* =================================================
                SIN SUCURSALES
            ================================================= */}

            {!cargando &&
                !error &&
                sucursales.length === 0 && (
                    <Card className="p-10">
                        <div className="mx-auto max-w-md text-center">
                            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--color-primary)]/10 text-3xl">
                                🏪
                            </div>

                            <h2 className="mt-5 text-lg font-bold text-[var(--color-text)]">
                                No tienes sucursales
                            </h2>

                            <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
                                Crea tu primera sucursal para comenzar a organizar las operaciones de tu negocio.
                            </p>

                            <Button
                                type="button"
                                onClick={
                                    abrirNuevaSucursal
                                }
                                className="mt-6 w-full sm:w-auto"
                            >
                                + Crear primera sucursal
                            </Button>
                        </div>
                    </Card>
                )}

            {/* =================================================
                LISTA DE SUCURSALES
            ================================================= */}

            {!cargando &&
                !error &&
                sucursales.length > 0 && (
                    <section>
                        <div className="mb-4">
                            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[var(--color-primary)]">
                                REGISTROS
                            </p>

                            <h2 className="mt-1 text-xl font-black text-[var(--color-text)]">
                                Tus sucursales
                            </h2>

                            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                                Consulta y administra cada punto de operación.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                            {sucursales.map(
                                (sucursal) => (
                                    <Card
                                        key={
                                            sucursal.id
                                        }
                                        className="overflow-hidden"
                                    >
                                        {/* ENCABEZADO DE TARJETA */}

                                        <div className="p-5">
                                            <div className="flex items-start justify-between gap-4">
                                                <div className="flex min-w-0 items-center gap-3">
                                                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-primary)]/10 text-xl">
                                                        🏪
                                                    </div>

                                                    <div className="min-w-0">
                                                        <h2 className="truncate text-lg font-black text-[var(--color-text)]">
                                                            {
                                                                sucursal.nombre
                                                            }
                                                        </h2>

                                                        <span
                                                            className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${sucursal.activo
                                                                ? "bg-[var(--color-success)]/10 text-[var(--color-success)]"
                                                                : "bg-[var(--color-text-secondary)]/10 text-[var(--color-text-secondary)]"
                                                                }`}
                                                        >
                                                            {sucursal.activo
                                                                ? "Activa"
                                                                : "Inactiva"}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* INFORMACIÓN */}

                                            <div className="mt-6 space-y-4">
                                                <div className="rounded-xl border border-[var(--color-border)] p-4">
                                                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--color-text-secondary)]">
                                                        Dirección
                                                    </p>

                                                    <p className="mt-1.5 break-words text-sm leading-6 text-[var(--color-text)]">
                                                        {sucursal.direccion ||
                                                            "Sin dirección registrada"}
                                                    </p>
                                                </div>

                                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                                    <div className="rounded-xl border border-[var(--color-border)] p-4">
                                                        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--color-text-secondary)]">
                                                            Teléfono
                                                        </p>

                                                        <p className="mt-1.5 break-words text-sm text-[var(--color-text)]">
                                                            {sucursal.telefono ||
                                                                "Sin teléfono registrado"}
                                                        </p>
                                                    </div>

                                                    <div className="rounded-xl border border-[var(--color-border)] p-4">
                                                        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--color-text-secondary)]">
                                                            Creación
                                                        </p>

                                                        <p className="mt-1.5 text-sm text-[var(--color-text)]">
                                                            {formatearFecha(
                                                                sucursal.created_at
                                                            )}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* ACCIONES */}

                                        <div className="border-t border-[var(--color-border)] bg-[var(--color-background)] p-4">
                                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                                <Button
                                                    type="button"
                                                    variant="secondary"
                                                    onClick={() =>
                                                        abrirEditarSucursal(
                                                            sucursal
                                                        )
                                                    }
                                                    className="w-full"
                                                >
                                                    Editar
                                                </Button>

                                                <Button
                                                    type="button"
                                                    variant={
                                                        sucursal.activo
                                                            ? "danger"
                                                            : "primary"
                                                    }
                                                    onClick={() =>
                                                        solicitarCambioEstado(
                                                            sucursal
                                                        )
                                                    }
                                                    className="w-full"
                                                >
                                                    {sucursal.activo
                                                        ? "Desactivar"
                                                        : "Activar"}
                                                </Button>
                                            </div>
                                        </div>
                                    </Card>
                                )
                            )}
                        </div>
                    </section>
                )}

            {/* =================================================
                MODAL NUEVA / EDITAR SUCURSAL
            ================================================= */}

            {modalAbierto && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
                    onMouseDown={(e) => {
                        if (
                            e.target ===
                            e.currentTarget
                        ) {
                            cerrarModal();
                        }
                    }}
                >
                    <div
                        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl"
                        onMouseDown={(e) =>
                            e.stopPropagation()
                        }
                    >
                        {/* CABECERA */}

                        <div className="flex items-start justify-between gap-4 border-b border-[var(--color-border)] p-5 sm:p-6">
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--color-primary)]">
                                    {editando
                                        ? "EDITAR"
                                        : "NUEVA"}
                                </p>

                                <h2 className="mt-1 text-xl font-black text-[var(--color-text)]">
                                    {editando
                                        ? "Editar sucursal"
                                        : "Nueva sucursal"}
                                </h2>

                                <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                                    {editando
                                        ? "Modifica los datos de la sucursal."
                                        : "Registra una nueva sucursal para tu negocio."}
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={
                                    cerrarModal
                                }
                                disabled={
                                    guardando
                                }
                                aria-label="Cerrar"
                                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-lg text-[var(--color-text-secondary)] transition hover:bg-[var(--color-primary)]/10 hover:text-[var(--color-text)] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                ✕
                            </button>
                        </div>

                        {/* FORMULARIO */}

                        <div className="space-y-5 p-5 sm:p-6">
                            {/* NOMBRE */}

                            <div>
                                <label
                                    htmlFor="nombreSucursal"
                                    className="mb-2 block text-sm font-bold text-[var(--color-text)]"
                                >
                                    Nombre de la sucursal *
                                </label>

                                <input
                                    id="nombreSucursal"
                                    type="text"
                                    value={
                                        nombre
                                    }
                                    onChange={(
                                        e
                                    ) =>
                                        setNombre(
                                            e
                                                .target
                                                .value
                                        )
                                    }
                                    placeholder="Ej. Sucursal Centro"
                                    disabled={
                                        guardando
                                    }
                                    autoFocus
                                    className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm text-[var(--color-text)] outline-none transition placeholder:text-[var(--color-text-secondary)] focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[var(--color-primary)]/10 disabled:cursor-not-allowed disabled:opacity-60"
                                />
                            </div>

                            {/* DIRECCIÓN */}

                            <div>
                                <label
                                    htmlFor="direccionSucursal"
                                    className="mb-2 block text-sm font-bold text-[var(--color-text)]"
                                >
                                    Dirección
                                </label>

                                <textarea
                                    id="direccionSucursal"
                                    value={
                                        direccion
                                    }
                                    onChange={(
                                        e
                                    ) =>
                                        setDireccion(
                                            e
                                                .target
                                                .value
                                        )
                                    }
                                    placeholder="Ej. Av. Juárez #123"
                                    rows={3}
                                    disabled={
                                        guardando
                                    }
                                    className="w-full resize-none rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm leading-6 text-[var(--color-text)] outline-none transition placeholder:text-[var(--color-text-secondary)] focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[var(--color-primary)]/10 disabled:cursor-not-allowed disabled:opacity-60"
                                />
                            </div>

                            {/* TELÉFONO */}

                            <div>
                                <label
                                    htmlFor="telefonoSucursal"
                                    className="mb-2 block text-sm font-bold text-[var(--color-text)]"
                                >
                                    Teléfono
                                </label>

                                <input
                                    id="telefonoSucursal"
                                    type="tel"
                                    value={
                                        telefono
                                    }
                                    onChange={(
                                        e
                                    ) =>
                                        setTelefono(
                                            e
                                                .target
                                                .value
                                        )
                                    }
                                    placeholder="Ej. 33 1234 5678"
                                    disabled={
                                        guardando
                                    }
                                    className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm text-[var(--color-text)] outline-none transition placeholder:text-[var(--color-text-secondary)] focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[var(--color-primary)]/10 disabled:cursor-not-allowed disabled:opacity-60"
                                />
                            </div>

                            {/* ESTADO */}

                            <div className="flex items-center justify-between gap-4 rounded-2xl border border-[var(--color-border)] p-4">
                                <div className="min-w-0">
                                    <p className="text-sm font-bold text-[var(--color-text)]">
                                        Sucursal activa
                                    </p>

                                    <p className="mt-1 text-xs leading-5 text-[var(--color-text-secondary)]">
                                        Las sucursales inactivas no estarán disponibles para operaciones.
                                    </p>
                                </div>

                                <button
                                    type="button"
                                    onClick={() =>
                                        setActivo(
                                            !activo
                                        )
                                    }
                                    disabled={
                                        guardando
                                    }
                                    aria-label="Cambiar estado de la sucursal"
                                    aria-pressed={
                                        activo
                                    }
                                    className={`relative h-7 w-12 shrink-0 rounded-full transition ${activo
                                        ? "bg-[var(--color-primary)]"
                                        : "bg-[var(--color-text-secondary)]/30"
                                        } disabled:cursor-not-allowed disabled:opacity-60`}
                                >
                                    <span
                                        className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition ${activo
                                            ? "left-6"
                                            : "left-1"
                                            }`}
                                    />
                                </button>
                            </div>
                        </div>

                        {/* ACCIONES MODAL */}

                        <div className="flex flex-col-reverse gap-3 border-t border-[var(--color-border)] p-5 sm:flex-row sm:justify-end sm:p-6">
                            <Button
                                type="button"
                                variant="secondary"
                                onClick={
                                    cerrarModal
                                }
                                disabled={
                                    guardando
                                }
                                className="w-full sm:w-auto"
                            >
                                Cancelar
                            </Button>

                            <Button
                                type="button"
                                onClick={
                                    guardarSucursal
                                }
                                disabled={
                                    guardando ||
                                    !nombre.trim()
                                }
                                className="w-full sm:w-auto"
                            >
                                {guardando
                                    ? "Guardando..."
                                    : editando
                                        ? "Guardar cambios"
                                        : "Crear sucursal"}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* =================================================
                MODAL DE MENSAJES
            ================================================= */}

            <ModalMensaje
                abierto={
                    modalMensajeAbierto
                }
                tipo={
                    tipoMensaje
                }
                titulo={
                    tituloMensaje
                }
                mensaje={
                    textoMensaje
                }
                textoBoton={
                    tipoMensaje ===
                        "confirmacion"
                        ? "Confirmar"
                        : "Aceptar"
                }
                textoCancelar="Cancelar"
                onCerrar={
                    cerrarModalMensaje
                }
                onConfirmar={
                    tipoMensaje ===
                        "confirmacion"
                        ? confirmarCambioEstado
                        : undefined
                }
            />
        </div>
    );
}