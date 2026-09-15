"use client";

import { useEffect, useState } from "react";

import Card from "../../components/Card";
import { supabase } from "../../../lib/supabase";
import { obtenerUsuarioActual } from "../../../lib/auth/roleGuard";

interface Categoria {
    id: string;
    nombre: string;
    descripcion: string | null;
    activo: boolean;
    created_at: string;
}

type TipoMensaje = "success" | "error" | "warning";

interface MensajeModal {
    tipo: TipoMensaje;
    titulo: string;
    mensaje: string;
}

interface ConfirmacionModal {
    titulo: string;
    mensaje: string;
    confirmarTexto: string;
    cancelarTexto: string;
    accion: () => void;
}

export default function CategoriasPage() {
    const [categorias, setCategorias] = useState<Categoria[]>([]);
    const [busqueda, setBusqueda] = useState("");
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState("");

    const [modalNueva, setModalNueva] = useState(false);
    const [guardando, setGuardando] = useState(false);
    const [editando, setEditando] = useState<Categoria | null>(null);

    const [formCategoria, setFormCategoria] = useState({
        nombre: "",
        descripcion: "",
    });

    const [mensajeModal, setMensajeModal] =
        useState<MensajeModal | null>(null);

    const [confirmacionModal, setConfirmacionModal] =
        useState<ConfirmacionModal | null>(null);

    /*
     * ============================================================
     * MENSAJES
     * ============================================================
     */

    function mostrarMensaje(
        tipo: TipoMensaje,
        titulo: string,
        mensaje: string
    ) {
        setMensajeModal({
            tipo,
            titulo,
            mensaje,
        });
    }

    function cerrarMensaje() {
        setMensajeModal(null);
    }

    /*
     * ============================================================
     * CONFIRMACIÓN
     * ============================================================
     */

    function mostrarConfirmacion(
        titulo: string,
        mensaje: string,
        accion: () => void,
        confirmarTexto = "Confirmar",
        cancelarTexto = "Cancelar"
    ) {
        setConfirmacionModal({
            titulo,
            mensaje,
            confirmarTexto,
            cancelarTexto,
            accion,
        });
    }

    function cerrarConfirmacion() {
        setConfirmacionModal(null);
    }

    function ejecutarConfirmacion() {
        if (!confirmacionModal) return;

        const accion = confirmacionModal.accion;

        setConfirmacionModal(null);

        accion();
    }

    /*
     * ============================================================
     * CARGAR CATEGORÍAS
     * ============================================================
     */

    async function cargarCategorias() {
        setCargando(true);
        setError("");

        try {
            const usuario = await obtenerUsuarioActual();

            if (!usuario?.negocio_id) {
                setError("No se encontró el negocio del usuario.");
                return;
            }

            const { data, error } = await supabase
                .from("categorias")
                .select(
                    `
                    id,
                    nombre,
                    descripcion,
                    activo,
                    created_at
                    `
                )
                .eq("negocio_id", usuario.negocio_id)
                .order("nombre", { ascending: true });

            if (error) {
                console.error("Error cargando categorías:", error);
                setError("No se pudieron cargar las categorías.");
                return;
            }

            setCategorias(data ?? []);
        } catch (error) {
            console.error("Error inesperado:", error);
            setError("Ocurrió un error al cargar las categorías.");
        } finally {
            setCargando(false);
        }
    }

    /*
     * ============================================================
     * ABRIR MODAL NUEVA CATEGORÍA
     * ============================================================
     */

    function abrirNuevaCategoria() {
        setEditando(null);

        setFormCategoria({
            nombre: "",
            descripcion: "",
        });

        setModalNueva(true);
    }

    /*
     * ============================================================
     * CERRAR MODAL CATEGORÍA
     * ============================================================
     */

    function cerrarModalCategoria() {
        if (guardando) return;

        setModalNueva(false);

        setFormCategoria({
            nombre: "",
            descripcion: "",
        });

        setEditando(null);
    }

    /*
     * ============================================================
     * ABRIR MODAL EDITAR
     * ============================================================
     */

    function abrirEditarCategoria(categoria: Categoria) {
        setEditando(categoria);

        setFormCategoria({
            nombre: categoria.nombre,
            descripcion: categoria.descripcion ?? "",
        });

        setModalNueva(true);
    }

    /*
     * ============================================================
     * GUARDAR CATEGORÍA
     * ============================================================
     */

    async function guardarCategoria() {
        const nombre = formCategoria.nombre.trim();
        const descripcion = formCategoria.descripcion.trim();

        if (!nombre) {
            mostrarMensaje(
                "warning",
                "Nombre requerido",
                "El nombre de la categoría es obligatorio."
            );
            return;
        }

        setGuardando(true);

        try {
            const usuario = await obtenerUsuarioActual();

            if (!usuario?.negocio_id) {
                mostrarMensaje(
                    "error",
                    "Negocio no encontrado",
                    "No se encontró el negocio del usuario."
                );
                return;
            }

            /*
             * ====================================================
             * EDITAR
             * ====================================================
             */

            if (editando) {
                const { error } = await supabase
                    .from("categorias")
                    .update({
                        nombre,
                        descripcion: descripcion || null,
                    })
                    .eq("id", editando.id)
                    .eq("negocio_id", usuario.negocio_id);

                if (error) {
                    console.error(
                        "Error actualizando categoría:",
                        error
                    );

                    if (error.code === "23505") {
                        mostrarMensaje(
                            "error",
                            "Categoría duplicada",
                            "Ya existe una categoría con ese nombre."
                        );
                    } else {
                        mostrarMensaje(
                            "error",
                            "No se pudo actualizar",
                            "No se pudo actualizar la categoría."
                        );
                    }

                    return;
                }

                mostrarMensaje(
                    "success",
                    "Categoría actualizada",
                    "La categoría se actualizó correctamente."
                );
            }

            /*
             * ====================================================
             * CREAR
             * ====================================================
             */

            else {
                const { error } = await supabase
                    .from("categorias")
                    .insert({
                        negocio_id: usuario.negocio_id,
                        nombre,
                        descripcion: descripcion || null,
                        activo: true,
                    });

                if (error) {
                    console.error(
                        "Error creando categoría:",
                        error
                    );

                    if (error.code === "23505") {
                        mostrarMensaje(
                            "error",
                            "Categoría duplicada",
                            "Ya existe una categoría con ese nombre."
                        );
                    } else {
                        mostrarMensaje(
                            "error",
                            "No se pudo crear",
                            "No se pudo crear la categoría."
                        );
                    }

                    return;
                }

                mostrarMensaje(
                    "success",
                    "Categoría creada",
                    "La categoría se creó correctamente."
                );
            }

            setModalNueva(false);

            setFormCategoria({
                nombre: "",
                descripcion: "",
            });

            setEditando(null);

            await cargarCategorias();
        } catch (error) {
            console.error(
                "Error inesperado guardando categoría:",
                error
            );

            mostrarMensaje(
                "error",
                "Error inesperado",
                "Ocurrió un error inesperado."
            );
        } finally {
            setGuardando(false);
        }
    }

    /*
     * ============================================================
     * ACTIVAR / DESACTIVAR
     * ============================================================
     */

    async function cambiarEstado(categoria: Categoria) {
        const nuevoEstado = !categoria.activo;

        const mensaje = nuevoEstado
            ? `¿Quieres activar "${categoria.nombre}"?`
            : `¿Quieres desactivar "${categoria.nombre}"?`;

        mostrarConfirmacion(
            nuevoEstado
                ? "Activar categoría"
                : "Desactivar categoría",
            mensaje,
            async () => {
                try {
                    const usuario = await obtenerUsuarioActual();

                    if (!usuario?.negocio_id) {
                        mostrarMensaje(
                            "error",
                            "Negocio no encontrado",
                            "No se encontró el negocio del usuario."
                        );
                        return;
                    }

                    const { error } = await supabase
                        .from("categorias")
                        .update({
                            activo: nuevoEstado,
                        })
                        .eq("id", categoria.id)
                        .eq("negocio_id", usuario.negocio_id);

                    if (error) {
                        console.error(
                            "Error cambiando estado:",
                            error
                        );

                        mostrarMensaje(
                            "error",
                            "No se pudo cambiar el estado",
                            "No se pudo cambiar el estado de la categoría."
                        );

                        return;
                    }

                    await cargarCategorias();
                } catch (error) {
                    console.error(error);

                    mostrarMensaje(
                        "error",
                        "Error inesperado",
                        "Ocurrió un error inesperado."
                    );
                }
            },
            nuevoEstado ? "Activar" : "Desactivar"
        );
    }

    /*
     * ============================================================
     * CARGA INICIAL
     * ============================================================
     */

    useEffect(() => {
        cargarCategorias();
    }, []);

    /*
     * ============================================================
     * FILTRO
     * ============================================================
     */

    const categoriasFiltradas = categorias.filter((categoria) => {
        const texto = busqueda.toLowerCase().trim();

        if (!texto) return true;

        return (
            categoria.nombre
                .toLowerCase()
                .includes(texto) ||
            categoria.descripcion
                ?.toLowerCase()
                .includes(texto)
        );
    });

    const categoriasActivas = categorias.filter(
        (categoria) => categoria.activo
    ).length;

    const categoriasInactivas = categorias.filter(
        (categoria) => !categoria.activo
    ).length;

    /*
     * ============================================================
     * INTERFAZ
     * ============================================================
     */

    return (
        <div className="space-y-6">
            {/* ================================================= */}
            {/* MENSAJE MODAL */}
            {/* ================================================= */}

            {mensajeModal && (
                <div
                    className="
                        fixed
                        inset-0
                        z-[300]
                        flex
                        items-center
                        justify-center
                        bg-black/40
                        p-4
                        backdrop-blur-sm
                    "
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="mensaje-titulo"
                >
                    <div
                        className="
                            w-full
                            max-w-md
                            overflow-hidden
                            rounded-2xl
                            border
                            border-[var(--color-border)]
                            bg-[var(--color-surface)]
                            shadow-2xl
                        "
                    >
                        <div className="p-6">
                            <div className="flex items-start gap-4">
                                <div
                                    className={`
                                        flex
                                        h-11
                                        w-11
                                        shrink-0
                                        items-center
                                        justify-center
                                        rounded-xl
                                        text-xl
                                        ${mensajeModal.tipo ===
                                            "success"
                                            ? "bg-green-100 text-green-700"
                                            : mensajeModal.tipo ===
                                                "warning"
                                                ? "bg-amber-100 text-amber-700"
                                                : "bg-red-100 text-red-700"
                                        }
                                    `}
                                >
                                    {mensajeModal.tipo === "success"
                                        ? "✓"
                                        : mensajeModal.tipo === "warning"
                                            ? "⚠️"
                                            : "!"
                                    }
                                </div>

                                <div className="min-w-0 flex-1">
                                    <h2
                                        id="mensaje-titulo"
                                        className="
                                            text-lg
                                            font-bold
                                            text-[var(--color-text)]
                                        "
                                    >
                                        {mensajeModal.titulo}
                                    </h2>

                                    <p
                                        className="
                                            mt-2
                                            text-sm
                                            leading-6
                                            text-[var(--color-text-secondary)]
                                        "
                                    >
                                        {mensajeModal.mensaje}
                                    </p>
                                </div>
                            </div>

                            <div className="mt-6 flex justify-end">
                                <button
                                    type="button"
                                    onClick={cerrarMensaje}
                                    className="
                                        w-full
                                        rounded-xl
                                        bg-[var(--color-primary)]
                                        px-5
                                        py-3
                                        text-sm
                                        font-semibold
                                        text-white
                                        shadow-sm
                                        transition
                                        hover:opacity-90
                                        active:scale-[0.98]
                                        sm:w-auto
                                    "
                                >
                                    Entendido
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ================================================= */}
            {/* CONFIRMACIÓN MODAL */}
            {/* ================================================= */}

            {confirmacionModal && (
                <div
                    className="
                        fixed
                        inset-0
                        z-[250]
                        flex
                        items-center
                        justify-center
                        bg-black/40
                        p-4
                        backdrop-blur-sm
                    "
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="confirmacion-titulo"
                >
                    <div
                        className="
                            w-full
                            max-w-md
                            overflow-hidden
                            rounded-2xl
                            border
                            border-[var(--color-border)]
                            bg-[var(--color-surface)]
                            shadow-2xl
                        "
                    >
                        <div className="p-6">
                            <div className="flex items-start gap-4">
                                <div
                                    className="
                                        flex
                                        h-11
                                        w-11
                                        shrink-0
                                        items-center
                                        justify-center
                                        rounded-xl
                                        bg-amber-100
                                        text-xl
                                        text-amber-700
                                    "
                                >
                                    ⚠️
                                </div>

                                <div className="min-w-0 flex-1">
                                    <h2
                                        id="confirmacion-titulo"
                                        className="
                                            text-lg
                                            font-bold
                                            text-[var(--color-text)]
                                        "
                                    >
                                        {confirmacionModal.titulo}
                                    </h2>

                                    <p
                                        className="
                                            mt-2
                                            text-sm
                                            leading-6
                                            text-[var(--color-text-secondary)]
                                        "
                                    >
                                        {confirmacionModal.mensaje}
                                    </p>
                                </div>
                            </div>

                            <div
                                className="
                                    mt-6
                                    flex
                                    flex-col-reverse
                                    gap-3
                                    sm:flex-row
                                    sm:justify-end
                                "
                            >
                                <button
                                    type="button"
                                    onClick={cerrarConfirmacion}
                                    className="
                                        w-full
                                        rounded-xl
                                        border
                                        border-[var(--color-border)]
                                        bg-[var(--color-surface)]
                                        px-5
                                        py-3
                                        text-sm
                                        font-semibold
                                        text-[var(--color-text)]
                                        transition
                                        hover:bg-[var(--color-background)]
                                        sm:w-auto
                                    "
                                >
                                    {confirmacionModal.cancelarTexto}
                                </button>

                                <button
                                    type="button"
                                    onClick={ejecutarConfirmacion}
                                    className="
                                        w-full
                                        rounded-xl
                                        bg-[var(--color-primary)]
                                        px-5
                                        py-3
                                        text-sm
                                        font-semibold
                                        text-white
                                        transition
                                        hover:opacity-90
                                        active:scale-[0.98]
                                        sm:w-auto
                                    "
                                >
                                    {confirmacionModal.confirmarTexto}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ================================================= */}
            {/* ENCABEZADO */}
            {/* ================================================= */}

            <div
                className="
                    flex
                    flex-col
                    gap-4
                    sm:flex-row
                    sm:items-center
                    sm:justify-between
                "
            >
                <div>
                    <div className="flex items-center gap-3">
                        <div
                            className="
                                flex
                                h-12
                                w-12
                                items-center
                                justify-center
                                rounded-2xl
                                text-2xl
                            "
                            style={{
                                backgroundColor:
                                    "color-mix(in srgb, var(--color-primary) 10%, transparent)",
                            }}
                        >
                            🏷️
                        </div>

                        <div>
                            <h1
                                className="
                                    text-2xl
                                    font-bold
                                    text-[var(--color-text)]
                                    sm:text-3xl
                                "
                            >
                                Categorías
                            </h1>

                            <p
                                className="
                                    mt-1
                                    text-sm
                                    text-[var(--color-text-secondary)]
                                "
                            >
                                Organiza tus productos por categorías.
                            </p>
                        </div>
                    </div>
                </div>

                <button
                    type="button"
                    onClick={abrirNuevaCategoria}
                    className="
                        w-full
                        rounded-xl
                        bg-[var(--color-primary)]
                        px-5
                        py-3
                        text-sm
                        font-semibold
                        text-white
                        shadow-sm
                        transition
                        hover:opacity-90
                        active:scale-[0.98]
                        sm:w-auto
                    "
                >
                    + Nueva categoría
                </button>
            </div>

            {/* ================================================= */}
            {/* RESUMEN */}
            {/* ================================================= */}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Card className="p-5">
                    <div className="flex items-center gap-4">
                        <div
                            className="
                                flex
                                h-11
                                w-11
                                items-center
                                justify-center
                                rounded-xl
                                text-xl
                            "
                            style={{
                                backgroundColor:
                                    "color-mix(in srgb, var(--color-primary) 10%, transparent)",
                            }}
                        >
                            🏷️
                        </div>

                        <div>
                            <p
                                className="
                                    text-xs
                                    font-semibold
                                    uppercase
                                    tracking-wide
                                    text-[var(--color-text-secondary)]
                                "
                            >
                                Total
                            </p>

                            <p
                                className="
                                    mt-1
                                    text-2xl
                                    font-bold
                                    text-[var(--color-text)]
                                "
                            >
                                {categorias.length}
                            </p>
                        </div>
                    </div>
                </Card>

                <Card className="p-5">
                    <div className="flex items-center gap-4">
                        <div
                            className="
                                flex
                                h-11
                                w-11
                                items-center
                                justify-center
                                rounded-xl
                                bg-green-50
                                text-xl
                            "
                        >
                            🟢
                        </div>

                        <div>
                            <p
                                className="
                                    text-xs
                                    font-semibold
                                    uppercase
                                    tracking-wide
                                    text-[var(--color-text-secondary)]
                                "
                            >
                                Activas
                            </p>

                            <p className="mt-1 text-2xl font-bold text-green-600">
                                {categoriasActivas}
                            </p>
                        </div>
                    </div>
                </Card>

                <Card className="p-5">
                    <div className="flex items-center gap-4">
                        <div
                            className="
                                flex
                                h-11
                                w-11
                                items-center
                                justify-center
                                rounded-xl
                                text-xl
                            "
                            style={{
                                backgroundColor:
                                    "var(--color-background)",
                                color:
                                    "var(--color-text-secondary)",
                            }}
                        >
                            ⚪
                        </div>

                        <div>
                            <p
                                className="
                                    text-xs
                                    font-semibold
                                    uppercase
                                    tracking-wide
                                    text-[var(--color-text-secondary)]
                                "
                            >
                                Inactivas
                            </p>

                            <p
                                className="
                                    mt-1
                                    text-2xl
                                    font-bold
                                    text-[var(--color-text-secondary)]
                                "
                            >
                                {categoriasInactivas}
                            </p>
                        </div>
                    </div>
                </Card>
            </div>

            {/* ================================================= */}
            {/* BUSCADOR */}
            {/* ================================================= */}

            <Card className="p-4">
                <div
                    className="
                        flex
                        flex-col
                        gap-3
                        sm:flex-row
                        sm:items-center
                    "
                >
                    <div className="flex-1">
                        <label
                            htmlFor="buscar-categoria"
                            className="sr-only"
                        >
                            Buscar categoría
                        </label>

                        <input
                            id="buscar-categoria"
                            type="search"
                            value={busqueda}
                            onChange={(e) =>
                                setBusqueda(e.target.value)
                            }
                            placeholder="Buscar categoría..."
                            className="
                                w-full
                                rounded-xl
                                border
                                border-[var(--color-border)]
                                bg-[var(--color-surface)]
                                px-4
                                py-3
                                text-sm
                                text-[var(--color-text)]
                                outline-none
                                transition
                                placeholder:text-[var(--color-text-secondary)]
                                focus:border-[var(--color-primary)]
                                focus:ring-4
                                focus:ring-[var(--color-primary)]/10
                            "
                        />
                    </div>

                    <div
                        className="
                            text-sm
                            text-[var(--color-text-secondary)]
                        "
                    >
                        {categoriasFiltradas.length} categoría
                        {categoriasFiltradas.length !== 1
                            ? "s"
                            : ""}
                    </div>
                </div>
            </Card>

            {/* ================================================= */}
            {/* CARGANDO */}
            {/* ================================================= */}

            {cargando && (
                <Card className="p-10">
                    <div className="text-center">
                        <div
                            className="
                                mx-auto
                                flex
                                h-12
                                w-12
                                items-center
                                justify-center
                                rounded-xl
                                text-xl
                            "
                            style={{
                                backgroundColor:
                                    "color-mix(in srgb, var(--color-primary) 10%, transparent)",
                            }}
                        >
                            ⏳
                        </div>

                        <p
                            className="
                                mt-4
                                text-sm
                                font-semibold
                                text-[var(--color-text)]
                            "
                        >
                            Cargando categorías...
                        </p>
                    </div>
                </Card>
            )}

            {/* ================================================= */}
            {/* ERROR */}
            {/* ================================================= */}

            {!cargando && error && (
                <Card className="border-red-200 bg-red-50 p-6">
                    <div className="flex gap-3">
                        <span className="text-xl">⚠️</span>

                        <div>
                            <p className="font-semibold text-red-700">
                                No se pudieron cargar las categorías
                            </p>

                            <p className="mt-1 text-sm text-red-600">
                                {error}
                            </p>
                        </div>
                    </div>
                </Card>
            )}

            {/* ================================================= */}
            {/* SIN CATEGORÍAS */}
            {/* ================================================= */}

            {!cargando &&
                !error &&
                categoriasFiltradas.length === 0 && (
                    <Card className="p-10">
                        <div className="text-center">
                            <div
                                className="
                                    mx-auto
                                    flex
                                    h-16
                                    w-16
                                    items-center
                                    justify-center
                                    rounded-2xl
                                    text-3xl
                                "
                                style={{
                                    backgroundColor:
                                        "color-mix(in srgb, var(--color-primary) 10%, transparent)",
                                }}
                            >
                                🏷️
                            </div>

                            <h2
                                className="
                                    mt-5
                                    text-lg
                                    font-bold
                                    text-[var(--color-text)]
                                "
                            >
                                {busqueda
                                    ? "No encontramos categorías"
                                    : "Todavía no tienes categorías"}
                            </h2>

                            <p
                                className="
                                    mt-2
                                    text-sm
                                    text-[var(--color-text-secondary)]
                                "
                            >
                                {busqueda
                                    ? "Prueba con otro término de búsqueda."
                                    : "Crea tu primera categoría para comenzar a organizar tus productos."}
                            </p>

                            {!busqueda && (
                                <button
                                    type="button"
                                    onClick={abrirNuevaCategoria}
                                    className="
                                        mt-5
                                        rounded-xl
                                        bg-[var(--color-primary)]
                                        px-5
                                        py-3
                                        text-sm
                                        font-semibold
                                        text-white
                                        transition
                                        hover:opacity-90
                                    "
                                >
                                    + Crear primera categoría
                                </button>
                            )}
                        </div>
                    </Card>
                )}

            {/* ================================================= */}
            {/* LISTADO */}
            {/* ================================================= */}

            {!cargando &&
                !error &&
                categoriasFiltradas.length > 0 && (
                    <Card className="overflow-hidden">
                        {/* ================================================= */}
                        {/* DESKTOP */}
                        {/* ================================================= */}

                        <div className="hidden overflow-x-auto md:block">
                            <table className="w-full text-left">
                                <thead
                                    className="
                                        border-b
                                        border-[var(--color-border)]
                                        bg-[var(--color-background)]
                                    "
                                >
                                    <tr>
                                        <th
                                            className="
                                                px-5
                                                py-4
                                                text-xs
                                                font-semibold
                                                uppercase
                                                tracking-wide
                                                text-[var(--color-text-secondary)]
                                            "
                                        >
                                            Categoría
                                        </th>

                                        <th
                                            className="
                                                px-5
                                                py-4
                                                text-xs
                                                font-semibold
                                                uppercase
                                                tracking-wide
                                                text-[var(--color-text-secondary)]
                                            "
                                        >
                                            Descripción
                                        </th>

                                        <th
                                            className="
                                                px-5
                                                py-4
                                                text-xs
                                                font-semibold
                                                uppercase
                                                tracking-wide
                                                text-[var(--color-text-secondary)]
                                            "
                                        >
                                            Estado
                                        </th>

                                        <th
                                            className="
                                                px-5
                                                py-4
                                                text-right
                                                text-xs
                                                font-semibold
                                                uppercase
                                                tracking-wide
                                                text-[var(--color-text-secondary)]
                                            "
                                        >
                                            Acciones
                                        </th>
                                    </tr>
                                </thead>

                                <tbody className="divide-y divide-[var(--color-border)]">
                                    {categoriasFiltradas.map(
                                        (categoria) => (
                                            <tr
                                                key={categoria.id}
                                                className="
                                                    transition
                                                    hover:bg-[var(--color-background)]
                                                "
                                            >
                                                <td className="px-5 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div
                                                            className="
                                                                flex
                                                                h-11
                                                                w-11
                                                                items-center
                                                                justify-center
                                                                rounded-xl
                                                                text-lg
                                                            "
                                                            style={{
                                                                backgroundColor:
                                                                    "color-mix(in srgb, var(--color-primary) 10%, transparent)",
                                                            }}
                                                        >
                                                            🏷️
                                                        </div>

                                                        <div>
                                                            <p
                                                                className="
                                                                    font-semibold
                                                                    text-[var(--color-text)]
                                                                "
                                                            >
                                                                {
                                                                    categoria.nombre
                                                                }
                                                            </p>

                                                            <p
                                                                className="
                                                                    mt-1
                                                                    text-xs
                                                                    text-[var(--color-text-secondary)]
                                                                "
                                                            >
                                                                Categoría de
                                                                productos
                                                            </p>
                                                        </div>
                                                    </div>
                                                </td>

                                                <td
                                                    className="
                                                        px-5
                                                        py-4
                                                        text-sm
                                                        text-[var(--color-text-secondary)]
                                                    "
                                                >
                                                    {categoria.descripcion ||
                                                        "Sin descripción"}
                                                </td>

                                                <td className="px-5 py-4">
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            cambiarEstado(
                                                                categoria
                                                            )
                                                        }
                                                        className={`
                                                            inline-flex
                                                            items-center
                                                            gap-2
                                                            rounded-full
                                                            px-3
                                                            py-1.5
                                                            text-xs
                                                            font-semibold
                                                            transition
                                                            ${categoria.activo
                                                                ? "bg-green-100 text-green-700 hover:bg-green-200"
                                                                : "bg-[var(--color-background)] text-[var(--color-text-secondary)] hover:opacity-80"
                                                            }
                                                        `}
                                                    >
                                                        <span>
                                                            {categoria.activo
                                                                ? "🟢"
                                                                : "⚪"}
                                                        </span>

                                                        {categoria.activo
                                                            ? "Activa"
                                                            : "Inactiva"}
                                                    </button>
                                                </td>

                                                <td className="px-5 py-4 text-right">
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            abrirEditarCategoria(
                                                                categoria
                                                            )
                                                        }
                                                        className="
                                                            rounded-lg
                                                            px-3
                                                            py-2
                                                            text-sm
                                                            font-semibold
                                                            text-[var(--color-primary)]
                                                            transition
                                                            hover:bg-[var(--color-primary)]/10
                                                        "
                                                    >
                                                        ✏️ Editar
                                                    </button>
                                                </td>
                                            </tr>
                                        )
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* ================================================= */}
                        {/* MÓVIL */}
                        {/* ================================================= */}

                        <div className="divide-y divide-[var(--color-border)] md:hidden">
                            {categoriasFiltradas.map(
                                (categoria) => (
                                    <div
                                        key={categoria.id}
                                        className="p-4"
                                    >
                                        <div className="flex gap-3">
                                            <div
                                                className="
                                                    flex
                                                    h-12
                                                    w-12
                                                    shrink-0
                                                    items-center
                                                    justify-center
                                                    rounded-xl
                                                    text-xl
                                                "
                                                style={{
                                                    backgroundColor:
                                                        "color-mix(in srgb, var(--color-primary) 10%, transparent)",
                                                }}
                                            >
                                                🏷️
                                            </div>

                                            <div className="min-w-0 flex-1">
                                                <div
                                                    className="
                                                        flex
                                                        items-start
                                                        justify-between
                                                        gap-3
                                                    "
                                                >
                                                    <div className="min-w-0">
                                                        <h2
                                                            className="
                                                                truncate
                                                                font-semibold
                                                                text-[var(--color-text)]
                                                            "
                                                        >
                                                            {
                                                                categoria.nombre
                                                            }
                                                        </h2>

                                                        <p
                                                            className="
                                                                mt-1
                                                                text-xs
                                                                text-[var(--color-text-secondary)]
                                                            "
                                                        >
                                                            {categoria.descripcion ||
                                                                "Sin descripción"}
                                                        </p>
                                                    </div>

                                                    <span
                                                        className={`
                                                            shrink-0
                                                            rounded-full
                                                            px-2.5
                                                            py-1
                                                            text-[11px]
                                                            font-semibold
                                                            ${categoria.activo
                                                                ? "bg-green-100 text-green-700"
                                                                : "bg-[var(--color-background)] text-[var(--color-text-secondary)]"
                                                            }
                                                        `}
                                                    >
                                                        {categoria.activo
                                                            ? "🟢 Activa"
                                                            : "⚪ Inactiva"}
                                                    </span>
                                                </div>

                                                <div
                                                    className="
                                                        mt-4
                                                        flex
                                                        justify-end
                                                        gap-2
                                                    "
                                                >
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            cambiarEstado(
                                                                categoria
                                                            )
                                                        }
                                                        className="
                                                            rounded-lg
                                                            border
                                                            border-[var(--color-border)]
                                                            px-3
                                                            py-2
                                                            text-xs
                                                            font-semibold
                                                            text-[var(--color-text)]
                                                            transition
                                                            hover:bg-[var(--color-background)]
                                                        "
                                                    >
                                                        {categoria.activo
                                                            ? "Desactivar"
                                                            : "Activar"}
                                                    </button>

                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            abrirEditarCategoria(
                                                                categoria
                                                            )
                                                        }
                                                        className="
                                                            rounded-lg
                                                            px-3
                                                            py-2
                                                            text-xs
                                                            font-semibold
                                                            text-[var(--color-primary)]
                                                            transition
                                                            hover:bg-[var(--color-primary)]/10
                                                        "
                                                        style={{
                                                            backgroundColor:
                                                                "color-mix(in srgb, var(--color-primary) 8%, transparent)",
                                                        }}
                                                    >
                                                        ✏️ Editar
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )
                            )}
                        </div>
                    </Card>
                )}

            {/* ================================================= */}
            {/* MODAL NUEVA / EDITAR CATEGORÍA */}
            {/* ================================================= */}

            {modalNueva && (
                <div
                    className="
                        fixed
                        inset-0
                        z-[100]
                        flex
                        items-center
                        justify-center
                        bg-black/40
                        p-0
                        backdrop-blur-sm
                        sm:p-4
                    "
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="categoria-modal-titulo"
                >
                    <div
                        className="
                            flex
                            h-full
                            w-full
                            flex-col
                            bg-[var(--color-surface)]
                            sm:h-auto
                            sm:max-h-[90vh]
                            sm:max-w-lg
                            sm:rounded-2xl
                            sm:border
                            sm:border-[var(--color-border)]
                            sm:shadow-2xl
                        "
                    >
                        {/* ================================================= */}
                        {/* ENCABEZADO */}
                        {/* ================================================= */}

                        <div
                            className="
                                flex
                                items-center
                                justify-between
                                border-b
                                border-[var(--color-border)]
                                px-5
                                py-4
                                sm:px-6
                            "
                        >
                            <div>
                                <h2
                                    id="categoria-modal-titulo"
                                    className="
                                        text-lg
                                        font-bold
                                        text-[var(--color-text)]
                                    "
                                >
                                    {editando
                                        ? "Editar categoría"
                                        : "Nueva categoría"}
                                </h2>

                                <p
                                    className="
                                        mt-1
                                        text-xs
                                        text-[var(--color-text-secondary)]
                                    "
                                >
                                    {editando
                                        ? "Actualiza la información de la categoría."
                                        : "Crea una categoría para organizar tus productos."}
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={cerrarModalCategoria}
                                disabled={guardando}
                                className="
                                    flex
                                    h-10
                                    w-10
                                    items-center
                                    justify-center
                                    rounded-xl
                                    text-xl
                                    text-[var(--color-text-secondary)]
                                    transition
                                    hover:bg-[var(--color-background)]
                                    disabled:cursor-not-allowed
                                    disabled:opacity-50
                                "
                                aria-label="Cerrar"
                            >
                                ×
                            </button>
                        </div>

                        {/* ================================================= */}
                        {/* CONTENIDO */}
                        {/* ================================================= */}

                        <div className="flex-1 overflow-y-auto p-5 sm:p-6">
                            <div className="space-y-5">
                                {/* ================================================= */}
                                {/* NOMBRE */}
                                {/* ================================================= */}

                                <div>
                                    <label
                                        htmlFor="nombre-categoria"
                                        className="
                                            mb-2
                                            block
                                            text-sm
                                            font-semibold
                                            text-[var(--color-text)]
                                        "
                                    >
                                        Nombre de la categoría *
                                    </label>

                                    <input
                                        id="nombre-categoria"
                                        type="text"
                                        value={
                                            formCategoria.nombre
                                        }
                                        onChange={(e) =>
                                            setFormCategoria(
                                                (actual) => ({
                                                    ...actual,
                                                    nombre: e.target
                                                        .value,
                                                })
                                            )
                                        }
                                        placeholder="Ej. Bebidas"
                                        autoFocus
                                        disabled={guardando}
                                        className="
                                            w-full
                                            rounded-xl
                                            border
                                            border-[var(--color-border)]
                                            bg-[var(--color-surface)]
                                            px-4
                                            py-3
                                            text-sm
                                            text-[var(--color-text)]
                                            outline-none
                                            transition
                                            placeholder:text-[var(--color-text-secondary)]
                                            focus:border-[var(--color-primary)]
                                            focus:ring-4
                                            focus:ring-[var(--color-primary)]/10
                                            disabled:cursor-not-allowed
                                            disabled:opacity-60
                                        "
                                    />
                                </div>

                                {/* ================================================= */}
                                {/* DESCRIPCIÓN */}
                                {/* ================================================= */}

                                <div>
                                    <label
                                        htmlFor="descripcion-categoria"
                                        className="
                                            mb-2
                                            block
                                            text-sm
                                            font-semibold
                                            text-[var(--color-text)]
                                        "
                                    >
                                        Descripción
                                    </label>

                                    <textarea
                                        id="descripcion-categoria"
                                        rows={4}
                                        value={
                                            formCategoria.descripcion
                                        }
                                        onChange={(e) =>
                                            setFormCategoria(
                                                (actual) => ({
                                                    ...actual,
                                                    descripcion:
                                                        e.target
                                                            .value,
                                                })
                                            )
                                        }
                                        placeholder="Describe brevemente esta categoría..."
                                        disabled={guardando}
                                        className="
                                            w-full
                                            resize-none
                                            rounded-xl
                                            border
                                            border-[var(--color-border)]
                                            bg-[var(--color-surface)]
                                            px-4
                                            py-3
                                            text-sm
                                            text-[var(--color-text)]
                                            outline-none
                                            transition
                                            placeholder:text-[var(--color-text-secondary)]
                                            focus:border-[var(--color-primary)]
                                            focus:ring-4
                                            focus:ring-[var(--color-primary)]/10
                                            disabled:cursor-not-allowed
                                            disabled:opacity-60
                                        "
                                    />
                                </div>

                                {/* ================================================= */}
                                {/* AYUDA */}
                                {/* ================================================= */}

                                <div
                                    className="
                                        rounded-xl
                                        border
                                        p-4
                                    "
                                    style={{
                                        borderColor:
                                            "color-mix(in srgb, var(--color-primary) 25%, var(--color-border))",
                                        backgroundColor:
                                            "color-mix(in srgb, var(--color-primary) 7%, transparent)",
                                    }}
                                >
                                    <div className="flex gap-3">
                                        <span className="text-lg">
                                            💡
                                        </span>

                                        <p
                                            className="
                                                text-xs
                                                leading-5
                                                text-[var(--color-text-secondary)]
                                            "
                                        >
                                            Las categorías te ayudan a
                                            organizar tus productos y
                                            encontrarlos más fácilmente
                                            durante una venta.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* ================================================= */}
                        {/* PIE */}
                        {/* ================================================= */}

                        <div
                            className="
                                flex
                                flex-col-reverse
                                gap-3
                                border-t
                                border-[var(--color-border)]
                                bg-[var(--color-background)]
                                p-4
                                sm:flex-row
                                sm:justify-end
                                sm:px-6
                            "
                        >
                            <button
                                type="button"
                                onClick={cerrarModalCategoria}
                                disabled={guardando}
                                className="
                                    w-full
                                    rounded-xl
                                    border
                                    border-[var(--color-border)]
                                    bg-[var(--color-surface)]
                                    px-5
                                    py-3
                                    text-sm
                                    font-semibold
                                    text-[var(--color-text)]
                                    transition
                                    hover:bg-[var(--color-background)]
                                    disabled:cursor-not-allowed
                                    disabled:opacity-60
                                    sm:w-auto
                                "
                            >
                                Cancelar
                            </button>

                            <button
                                type="button"
                                onClick={guardarCategoria}
                                disabled={guardando}
                                className="
                                    w-full
                                    rounded-xl
                                    bg-[var(--color-primary)]
                                    px-5
                                    py-3
                                    text-sm
                                    font-semibold
                                    text-white
                                    transition
                                    hover:opacity-90
                                    active:scale-[0.98]
                                    disabled:cursor-not-allowed
                                    disabled:opacity-60
                                    sm:w-auto
                                "
                            >
                                {guardando
                                    ? "Guardando..."
                                    : editando
                                        ? "Guardar cambios"
                                        : "Crear categoría"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}