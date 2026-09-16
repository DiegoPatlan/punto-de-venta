"use client";

import { useEffect, useState } from "react";

import Card from "../../components/Card";
import { supabase } from "../../../lib/supabase";
import { obtenerUsuarioActual } from "../../../lib/auth/roleGuard";

interface Movimiento {
    id: string;
    inventario_id: string;
    usuario_id: string | null;
    tipo: string;
    cantidad: number;
    stock_anterior: number;
    stock_nuevo: number;
    referencia_id: string | null;
    motivo: string | null;
    created_at: string;
    inventario: {
        producto: {
            nombre: string;
            codigo_barras: string | null;
            sku: string | null;
            unidad: string;
        } | null;
        sucursal: {
            id: string;
            nombre: string;
        } | null;
    } | null;
    usuario: {
        nombre: string;
    } | null;
}

interface Sucursal {
    id: string;
    nombre: string;
}

export default function MovimientosPage() {
    const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
    const [sucursales, setSucursales] = useState<Sucursal[]>([]);
    const [busqueda, setBusqueda] = useState("");
    const [tipoFiltro, setTipoFiltro] = useState("");
    const [sucursalFiltro, setSucursalFiltro] = useState("");
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState("");

    async function cargarMovimientos() {
        setCargando(true);
        setError("");

        try {
            const usuario = await obtenerUsuarioActual();

            if (!usuario?.negocio_id) {
                setError("No se encontró el negocio del usuario.");
                return;
            }

            // ==========================================
            // 1. Obtener sucursales del negocio
            // ==========================================

            const {
                data: sucursalesData,
                error: errorSucursales,
            } = await supabase
                .from("sucursales")
                .select("id, nombre")
                .eq("negocio_id", usuario.negocio_id)
                .eq("activo", true)
                .order("nombre", {
                    ascending: true,
                });

            if (errorSucursales) {
                console.error(
                    "Error cargando sucursales:",
                    errorSucursales
                );

                setError(
                    "No se pudieron cargar las sucursales."
                );

                return;
            }

            const sucursalesActuales =
                sucursalesData ?? [];

            setSucursales(sucursalesActuales);

            const sucursalIds =
                sucursalesActuales.map(
                    (sucursal) => sucursal.id
                );

            if (sucursalIds.length === 0) {
                setMovimientos([]);
                return;
            }

            // ==========================================
            // 2. Obtener inventarios de esas sucursales
            // ==========================================

            const {
                data: inventariosData,
                error: errorInventarios,
            } = await supabase
                .from("inventario")
                .select("id, sucursal_id")
                .in("sucursal_id", sucursalIds);

            if (errorInventarios) {
                console.error(
                    "Error cargando inventarios:",
                    errorInventarios
                );

                setError(
                    "No se pudieron cargar los inventarios."
                );

                return;
            }

            const inventarioIds =
                (inventariosData ?? []).map(
                    (inventario) => inventario.id
                );

            if (inventarioIds.length === 0) {
                setMovimientos([]);
                return;
            }

            // ==========================================
            // 3. Obtener movimientos
            // ==========================================

            const {
                data,
                error: errorMovimientos,
            } = await supabase
                .from("movimientos_inventario")
                .select(`
id,
    inventario_id,
    usuario_id,
    tipo,
    cantidad,
    stock_anterior,
    stock_nuevo,
    referencia_id,
    motivo,
    created_at,
    inventario: inventario(
        producto: productos(
            nombre,
            codigo_barras,
            sku,
            unidad
        ),
        sucursal: sucursales(
            id,
            nombre
        )
    ),
        usuario: usuarios(
            nombre
        )
            `)
                .in("inventario_id", inventarioIds)
                .order("created_at", {
                    ascending: false,
                });

            if (errorMovimientos) {
                console.error(
                    "Error cargando movimientos:",
                    errorMovimientos
                );

                setError(
                    "No se pudieron cargar los movimientos."
                );

                return;
            }

            const movimientosCargados =
                (data as unknown as Movimiento[]) ?? [];

            setMovimientos(movimientosCargados);
        } catch (error) {
            console.error(
                "Error inesperado cargando movimientos:",
                error
            );

            setError(
                "Ocurrió un error al cargar los movimientos."
            );
        } finally {
            setCargando(false);
        }
    }

    useEffect(() => {
        cargarMovimientos();
    }, []);

    // ==========================================
    // FILTROS
    // ==========================================

    const movimientosFiltrados =
        movimientos.filter((movimiento) => {
            const texto =
                busqueda.toLowerCase().trim();

            const producto =
                movimiento.inventario?.producto;

            const sucursal =
                movimiento.inventario?.sucursal;

            const usuario =
                movimiento.usuario;

            const coincideBusqueda =
                !texto ||
                producto?.nombre
                    ?.toLowerCase()
                    .includes(texto) ||
                producto?.codigo_barras
                    ?.toLowerCase()
                    .includes(texto) ||
                producto?.sku
                    ?.toLowerCase()
                    .includes(texto) ||
                sucursal?.nombre
                    ?.toLowerCase()
                    .includes(texto) ||
                usuario?.nombre
                    ?.toLowerCase()
                    .includes(texto);

            const coincideTipo =
                !tipoFiltro ||
                movimiento.tipo === tipoFiltro;

            const coincideSucursal =
                !sucursalFiltro ||
                movimiento.inventario?.sucursal?.id ===
                sucursalFiltro;

            return (
                coincideBusqueda &&
                coincideTipo &&
                coincideSucursal
            );
        });

    // ==========================================
    // ESTADÍSTICAS
    // ==========================================

    const totalMovimientos =
        movimientosFiltrados.length;

    const totalEntradas =
        movimientosFiltrados.filter(
            (movimiento) =>
                movimiento.tipo === "entrada"
        ).length;

    const totalSalidas =
        movimientosFiltrados.filter(
            (movimiento) =>
                movimiento.tipo === "salida"
        ).length;

    const totalAjustes =
        movimientosFiltrados.filter(
            (movimiento) =>
                movimiento.tipo === "ajuste"
        ).length;

    // ==========================================
    // FORMATO FECHA
    // ==========================================

    function formatearFecha(fecha: string) {
        return new Date(fecha).toLocaleString(
            "es-MX",
            {
                dateStyle: "short",
                timeStyle: "short",
            }
        );
    }

    // ==========================================
    // TIPO DE MOVIMIENTO
    // ==========================================

    function obtenerTipoMovimiento(tipo: string) {
        if (tipo === "entrada") {
            return {
                texto: "Entrada",
                clase:
                    "border-green-200 bg-green-50 text-green-700",
            };
        }

        if (tipo === "salida") {
            return {
                texto: "Salida",
                clase:
                    "border-red-200 bg-red-50 text-red-700",
            };
        }

        return {
            texto: "Ajuste",
            clase:
                "border-blue-200 bg-blue-50 text-blue-700",
        };
    }

    return (
        <div className="space-y-6">
            {/* ==========================================
                ENCABEZADO
            ========================================== */}

            <div>
                <h1 className="text-2xl font-bold tracking-tight text-[var(--color-text)] sm:text-3xl">
                    Movimientos de inventario
                </h1>

                <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--color-text-secondary)]">
                    Consulta el historial de entradas,
                    salidas y ajustes de inventario.
                </p>
            </div>

            {/* ==========================================
                ESTADÍSTICAS
            ========================================== */}

            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
                <Card className="p-4 sm:p-5">
                    <p className="text-xs font-medium text-[var(--color-text-secondary)] sm:text-sm">
                        Movimientos
                    </p>

                    <p className="mt-2 text-2xl font-bold text-[var(--color-text)] sm:text-3xl">
                        {totalMovimientos}
                    </p>
                </Card>

                <Card className="p-4 sm:p-5">
                    <p className="text-xs font-medium text-[var(--color-text-secondary)] sm:text-sm">
                        Entradas
                    </p>

                    <p className="mt-2 text-2xl font-bold text-green-600 sm:text-3xl">
                        {totalEntradas}
                    </p>
                </Card>

                <Card className="p-4 sm:p-5">
                    <p className="text-xs font-medium text-[var(--color-text-secondary)] sm:text-sm">
                        Salidas
                    </p>

                    <p className="mt-2 text-2xl font-bold text-red-600 sm:text-3xl">
                        {totalSalidas}
                    </p>
                </Card>

                <Card className="p-4 sm:p-5">
                    <p className="text-xs font-medium text-[var(--color-text-secondary)] sm:text-sm">
                        Ajustes
                    </p>

                    <p className="mt-2 text-2xl font-bold text-blue-600 sm:text-3xl">
                        {totalAjustes}
                    </p>
                </Card>
            </div>

            {/* ==========================================
                FILTROS
            ========================================== */}

            <Card className="p-4">
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                    {/* Buscar */}

                    <div className="lg:col-span-1">
                        <label
                            htmlFor="buscar-movimientos"
                            className="mb-1.5 block text-xs font-semibold text-[var(--color-text-secondary)]"
                        >
                            Buscar
                        </label>

                        <input
                            id="buscar-movimientos"
                            type="search"
                            value={busqueda}
                            onChange={(e) =>
                                setBusqueda(
                                    e.target.value
                                )
                            }
                            placeholder="Producto, código, SKU o usuario..."
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
                                focus:ring-blue-100
                            "
                        />
                    </div>

                    {/* Sucursal */}

                    <div>
                        <label
                            htmlFor="filtro-sucursal"
                            className="mb-1.5 block text-xs font-semibold text-[var(--color-text-secondary)]"
                        >
                            Sucursal
                        </label>

                        <select
                            id="filtro-sucursal"
                            value={sucursalFiltro}
                            onChange={(e) =>
                                setSucursalFiltro(
                                    e.target.value
                                )
                            }
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
                                focus:border-[var(--color-primary)]
                                focus:ring-4
                                focus:ring-blue-100
                            "
                        >
                            <option value="">
                                Todas las sucursales
                            </option>

                            {sucursales.map(
                                (sucursal) => (
                                    <option
                                        key={
                                            sucursal.id
                                        }
                                        value={
                                            sucursal.id
                                        }
                                    >
                                        {sucursal.nombre}
                                    </option>
                                )
                            )}
                        </select>
                    </div>

                    {/* Tipo */}

                    <div>
                        <label
                            htmlFor="filtro-tipo"
                            className="mb-1.5 block text-xs font-semibold text-[var(--color-text-secondary)]"
                        >
                            Tipo de movimiento
                        </label>

                        <select
                            id="filtro-tipo"
                            value={tipoFiltro}
                            onChange={(e) =>
                                setTipoFiltro(
                                    e.target.value
                                )
                            }
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
                                focus:border-[var(--color-primary)]
                                focus:ring-4
                                focus:ring-blue-100
                            "
                        >
                            <option value="">
                                Todos los movimientos
                            </option>

                            <option value="entrada">
                                Entradas
                            </option>

                            <option value="salida">
                                Salidas
                            </option>

                            <option value="ajuste">
                                Ajustes
                            </option>
                        </select>
                    </div>
                </div>

                {/* Indicador de resultados filtrados */}

                {!cargando &&
                    !error &&
                    (busqueda ||
                        tipoFiltro ||
                        sucursalFiltro) && (
                        <div className="mt-3 border-t border-[var(--color-border)] pt-3">
                            <p className="text-xs text-[var(--color-text-secondary)]">
                                Mostrando{" "}
                                <span className="font-semibold text-[var(--color-text)]">
                                    {
                                        movimientosFiltrados.length
                                    }
                                </span>{" "}
                                de{" "}
                                <span className="font-semibold text-[var(--color-text)]">
                                    {movimientos.length}
                                </span>{" "}
                                movimientos.
                            </p>
                        </div>
                    )}
            </Card>

            {/* ==========================================
                CARGANDO
            ========================================== */}

            {cargando && (
                <Card className="p-8">
                    <div className="flex flex-col items-center justify-center text-center">
                        <div
                            className="
                                mb-4
                                h-8
                                w-8
                                animate-spin
                                rounded-full
                                border-4
                                border-[var(--color-border)]
                                border-t-[var(--color-primary)]
                            "
                        />

                        <p className="text-sm font-medium text-[var(--color-text)]">
                            Cargando movimientos...
                        </p>

                        <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                            Estamos consultando el
                            historial de inventario.
                        </p>
                    </div>
                </Card>
            )}

            {/* ==========================================
                ERROR
            ========================================== */}

            {!cargando && error && (
                <Card className="border-red-200 bg-red-50 p-6">
                    <div className="flex items-start gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-700">
                            !
                        </div>

                        <div>
                            <h2 className="text-sm font-semibold text-red-800">
                                No se pudo cargar el historial
                            </h2>

                            <p className="mt-1 text-sm leading-5 text-red-700">
                                {error}
                            </p>
                        </div>
                    </div>
                </Card>
            )}

            {/* ==========================================
                TABLA
            ========================================== */}

            {!cargando &&
                !error &&
                movimientosFiltrados.length > 0 && (
                    <Card className="overflow-hidden">
                        <div className="border-b border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 sm:px-5">
                            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    <h2 className="text-sm font-bold text-[var(--color-text)]">
                                        Historial de movimientos
                                    </h2>

                                    <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
                                        Ordenado del más
                                        reciente al más
                                        antiguo.
                                    </p>
                                </div>

                                <span className="text-xs font-medium text-[var(--color-text-secondary)]">
                                    {
                                        movimientosFiltrados.length
                                    }{" "}
                                    registro
                                    {movimientosFiltrados.length !==
                                        1
                                        ? "s"
                                        : ""}
                                </span>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[1050px] text-left">
                                <thead className="border-b border-[var(--color-border)] bg-[var(--color-background)]">
                                    <tr>
                                        <th className="whitespace-nowrap px-5 py-4 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
                                            Fecha
                                        </th>

                                        <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
                                            Producto
                                        </th>

                                        <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
                                            Sucursal
                                        </th>

                                        <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
                                            Tipo
                                        </th>

                                        <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
                                            Cantidad
                                        </th>

                                        <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
                                            Stock
                                        </th>

                                        <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
                                            Usuario
                                        </th>

                                        <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
                                            Motivo
                                        </th>
                                    </tr>
                                </thead>

                                <tbody className="divide-y divide-[var(--color-border)]">
                                    {movimientosFiltrados.map(
                                        (movimiento) => {
                                            const tipo =
                                                obtenerTipoMovimiento(
                                                    movimiento.tipo
                                                );

                                            const producto =
                                                movimiento
                                                    .inventario
                                                    ?.producto;

                                            const sucursal =
                                                movimiento
                                                    .inventario
                                                    ?.sucursal;

                                            return (
                                                <tr
                                                    key={
                                                        movimiento.id
                                                    }
                                                    className="transition hover:bg-[var(--color-background)]"
                                                >
                                                    {/* Fecha */}

                                                    <td className="whitespace-nowrap px-5 py-4 text-sm text-[var(--color-text-secondary)]">
                                                        {formatearFecha(
                                                            movimiento.created_at
                                                        )}
                                                    </td>

                                                    {/* Producto */}

                                                    <td className="max-w-sm px-5 py-4">
                                                        <p className="font-semibold leading-5 text-[var(--color-text)]">
                                                            {producto?.nombre ??
                                                                "Producto no disponible"}
                                                        </p>

                                                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[var(--color-text-secondary)]">
                                                            {producto?.codigo_barras && (
                                                                <span>
                                                                    Código:{" "}
                                                                    {
                                                                        producto.codigo_barras
                                                                    }
                                                                </span>
                                                            )}

                                                            {producto?.sku && (
                                                                <span>
                                                                    SKU:{" "}
                                                                    {
                                                                        producto.sku
                                                                    }
                                                                </span>
                                                            )}

                                                            {!producto?.codigo_barras &&
                                                                !producto?.sku && (
                                                                    <span>
                                                                        Sin
                                                                        código
                                                                    </span>
                                                                )}
                                                        </div>
                                                    </td>

                                                    {/* Sucursal */}

                                                    <td className="px-5 py-4 text-sm text-[var(--color-text-secondary)]">
                                                        {sucursal?.nombre ??
                                                            "Sucursal no disponible"}
                                                    </td>

                                                    {/* Tipo */}

                                                    <td className="px-5 py-4">
                                                        <span
                                                            className={`
inline - flex
items - center

border
px - 3
py - 1
text - xs
font - semibold
                                                                ${tipo.clase}
`}
                                                        >
                                                            {
                                                                tipo.texto
                                                            }
                                                        </span>
                                                    </td>

                                                    {/* Cantidad */}

                                                    <td className="px-5 py-4">
                                                        <div className="flex items-baseline gap-1">
                                                            <span
                                                                className={`
text - sm
font - bold
                                                                    ${movimiento.tipo ===
                                                                        "salida"
                                                                        ? "text-red-600"
                                                                        : movimiento.tipo ===
                                                                            "entrada"
                                                                            ? "text-green-600"
                                                                            : "text-blue-600"
                                                                    }
`}
                                                            >
                                                                {movimiento.tipo ===
                                                                    "entrada"
                                                                    ? "+"
                                                                    : movimiento.tipo ===
                                                                        "salida"
                                                                        ? "-"
                                                                        : ""}

                                                                {Math.abs(
                                                                    Number(
                                                                        movimiento.cantidad
                                                                    )
                                                                ).toFixed(
                                                                    3
                                                                )}
                                                            </span>

                                                            <span className="text-xs text-[var(--color-text-secondary)]">
                                                                {producto?.unidad ??
                                                                    ""}
                                                            </span>
                                                        </div>
                                                    </td>

                                                    {/* Stock */}

                                                    <td className="px-5 py-4">
                                                        <div className="inline-flex items-center gap-2 whitespace-nowrap">
                                                            <span className="rounded-lg bg-[var(--color-background)] px-2.5 py-1 text-sm font-semibold text-[var(--color-text)]">
                                                                {Number(
                                                                    movimiento.stock_anterior
                                                                ).toFixed(
                                                                    3
                                                                )}
                                                            </span>

                                                            <span className="text-xs font-medium text-[var(--color-text-secondary)]">
                                                                →
                                                            </span>

                                                            <span className="rounded-lg bg-[var(--color-background)] px-2.5 py-1 text-sm font-semibold text-[var(--color-text)]">
                                                                {Number(
                                                                    movimiento.stock_nuevo
                                                                ).toFixed(
                                                                    3
                                                                )}
                                                            </span>
                                                        </div>
                                                    </td>

                                                    {/* Usuario */}

                                                    <td className="px-5 py-4">
                                                        <p className="text-sm font-medium text-[var(--color-text)]">
                                                            {movimiento
                                                                .usuario
                                                                ?.nombre ??
                                                                "Usuario desconocido"}
                                                        </p>
                                                    </td>

                                                    {/* Motivo */}

                                                    <td className="max-w-xs px-5 py-4">
                                                        <p
                                                            className="truncate text-sm text-[var(--color-text-secondary)]"
                                                            title={
                                                                movimiento.motivo ??
                                                                ""
                                                            }
                                                        >
                                                            {movimiento.motivo ||
                                                                "Sin motivo"}
                                                        </p>
                                                    </td>
                                                </tr>
                                            );
                                        }
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Indicador móvil */}

                        <div className="border-t border-[var(--color-border)] px-4 py-3 text-center text-xs text-[var(--color-text-secondary)] sm:hidden">
                            Desliza horizontalmente para
                            consultar todas las columnas.
                        </div>
                    </Card>
                )}

            {/* ==========================================
                SIN RESULTADOS
            ========================================== */}

            {!cargando &&
                !error &&
                movimientosFiltrados.length === 0 && (
                    <Card className="p-8 sm:p-10">
                        <div className="mx-auto max-w-md text-center">
                            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-background)] text-[var(--color-text-secondary)]">
                                <svg
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="1.8"
                                    className="h-6 w-6"
                                    aria-hidden="true"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M9 5h6M9 9h6M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"
                                    />
                                </svg>
                            </div>

                            <h2 className="mt-4 text-lg font-bold text-[var(--color-text)]">
                                No hay movimientos
                            </h2>

                            <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
                                {busqueda ||
                                    sucursalFiltro ||
                                    tipoFiltro
                                    ? "No encontramos movimientos con los filtros seleccionados."
                                    : "Todavía no hay movimientos registrados."}
                            </p>

                            {(busqueda ||
                                sucursalFiltro ||
                                tipoFiltro) && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setBusqueda("");
                                            setSucursalFiltro(
                                                ""
                                            );
                                            setTipoFiltro("");
                                        }}
                                        className="
                                        mt-5
                                        rounded-xl
                                        border
                                        border-[var(--color-border)]
                                        bg-[var(--color-surface)]
                                        px-4
                                        py-2.5
                                        text-sm
                                        font-semibold
                                        text-[var(--color-text)]
                                        transition
                                        hover:bg-[var(--color-background)]
                                        focus:outline-none
                                        focus:ring-4
                                        focus:ring-blue-100
                                    "
                                    >
                                        Limpiar filtros
                                    </button>
                                )}
                        </div>
                    </Card>
                )}
        </div>
    );
}