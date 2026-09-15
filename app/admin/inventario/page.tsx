"use client";

import { useEffect, useState } from "react";
import Card from "../../components/Card";
import { supabase } from "../../../lib/supabase";
import { obtenerUsuarioActual } from "../../../lib/auth/roleGuard";

interface Inventario {
    id: string;
    producto_id: string;
    sucursal_id: string;
    stock: number;
    stock_reservado: number;
    producto: {
        nombre: string;
        codigo_barras: string | null;
        sku: string | null;
        unidad: string;
        stock_minimo: number;
        precio_venta: number;
        activo: boolean;
    } | null;
    sucursal: {
        nombre: string;
    } | null;
}

interface Sucursal {
    id: string;
    nombre: string;
}

type TipoMensaje = "success" | "error" | "warning";

interface MensajeModal {
    abierto: boolean;
    tipo: TipoMensaje;
    titulo: string;
    mensaje: string;
}

export default function InventarioPage() {
    const [inventarios, setInventarios] = useState<Inventario[]>([]);
    const [sucursales, setSucursales] = useState<Sucursal[]>([]);
    const [busqueda, setBusqueda] = useState("");
    const [sucursalSeleccionada, setSucursalSeleccionada] = useState("");
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState("");

    const [modalAjustar, setModalAjustar] = useState(false);
    const [inventarioSeleccionado, setInventarioSeleccionado] =
        useState<Inventario | null>(null);

    const [tipoMovimiento, setTipoMovimiento] = useState("entrada");
    const [cantidadMovimiento, setCantidadMovimiento] = useState("");
    const [motivoMovimiento, setMotivoMovimiento] = useState("");
    const [guardandoMovimiento, setGuardandoMovimiento] = useState(false);

    const [mensajeModal, setMensajeModal] = useState<MensajeModal>({
        abierto: false,
        tipo: "success",
        titulo: "",
        mensaje: "",
    });

    function mostrarMensaje(
        tipo: TipoMensaje,
        titulo: string,
        mensaje: string
    ) {
        setMensajeModal({
            abierto: true,
            tipo,
            titulo,
            mensaje,
        });
    }

    function cerrarMensaje() {
        setMensajeModal((actual) => ({
            ...actual,
            abierto: false,
        }));
    }

    async function cargarInventario() {
        setCargando(true);
        setError("");

        try {
            const usuario = await obtenerUsuarioActual();

            if (!usuario?.negocio_id) {
                setError("No se encontró el negocio del usuario.");
                return;
            }

            /*
             * 1. Obtener sucursales
             */
            const {
                data: sucursalesData,
                error: errorSucursales,
            } = await supabase
                .from("sucursales")
                .select("id, nombre")
                .eq("negocio_id", usuario.negocio_id)
                .eq("activo", true)
                .order("nombre", { ascending: true });

            if (errorSucursales) {
                console.error(
                    "Error cargando sucursales:",
                    errorSucursales
                );

                setError("No se pudieron cargar las sucursales.");
                return;
            }

            setSucursales(sucursalesData ?? []);

            /*
             * 2. Obtener inventario
             */
            const {
                data: inventarioData,
                error: errorInventario,
            } = await supabase
                .from("inventario")
                .select(`
                    id,
                    producto_id,
                    sucursal_id,
                    stock,
                    stock_reservado,
                    producto:productos (
                        nombre,
                        codigo_barras,
                        sku,
                        unidad,
                        stock_minimo,
                        precio_venta,
                        activo
                    ),
                    sucursal:sucursales (
                        nombre
                    )
                `)
                .eq("sucursal.negocio_id", usuario.negocio_id)
                .order("created_at", { ascending: false });

            if (errorInventario) {
                console.error(
                    "Error cargando inventario:",
                    errorInventario
                );

                setError("No se pudo cargar el inventario.");
                return;
            }

            setInventarios(
                (inventarioData as unknown as Inventario[]) ?? []
            );
        } catch (error) {
            console.error(
                "Error inesperado cargando inventario:",
                error
            );

            setError("Ocurrió un error al cargar el inventario.");
        } finally {
            setCargando(false);
        }
    }

    useEffect(() => {
        cargarInventario();
    }, []);

    function abrirAjusteStock(item: Inventario) {
        setInventarioSeleccionado(item);
        setTipoMovimiento("entrada");
        setCantidadMovimiento("");
        setMotivoMovimiento("");
        setModalAjustar(true);
    }

    function cerrarAjusteStock() {
        if (guardandoMovimiento) return;

        setModalAjustar(false);
        setInventarioSeleccionado(null);
        setCantidadMovimiento("");
        setMotivoMovimiento("");
    }

    async function guardarMovimiento() {
        if (!inventarioSeleccionado) return;

        const cantidad = Number(cantidadMovimiento);

        if (!cantidadMovimiento || cantidad <= 0) {
            mostrarMensaje(
                "warning",
                "Cantidad inválida",
                "Ingresa una cantidad válida mayor que cero."
            );
            return;
        }

        if (!motivoMovimiento.trim()) {
            mostrarMensaje(
                "warning",
                "Motivo requerido",
                "Ingresa el motivo del movimiento."
            );
            return;
        }

        const stockAnterior = Number(inventarioSeleccionado.stock);

        let stockNuevo = stockAnterior;

        if (tipoMovimiento === "entrada") {
            stockNuevo = stockAnterior + cantidad;
        }

        if (tipoMovimiento === "salida") {
            stockNuevo = stockAnterior - cantidad;
        }

        /*
         * IMPORTANTE:
         * Un ajuste establece el stock al valor indicado.
         * No suma la cantidad al stock existente.
         */
        if (tipoMovimiento === "ajuste") {
            stockNuevo = cantidad;
        }

        if (stockNuevo < 0) {
            mostrarMensaje(
                "warning",
                "Stock inválido",
                "El stock no puede quedar negativo."
            );
            return;
        }

        setGuardandoMovimiento(true);

        try {
            const usuario = await obtenerUsuarioActual();

            if (!usuario) {
                mostrarMensaje(
                    "error",
                    "Usuario no encontrado",
                    "No se encontró el usuario actual."
                );
                return;
            }

            /*
             * 1. Actualizar inventario
             */
            const { error: errorInventario } = await supabase
                .from("inventario")
                .update({
                    stock: stockNuevo,
                    updated_at: new Date().toISOString(),
                })
                .eq("id", inventarioSeleccionado.id);

            if (errorInventario) {
                console.error(
                    "Error actualizando inventario:",
                    errorInventario
                );

                mostrarMensaje(
                    "error",
                    "No se actualizó el inventario",
                    "No se pudo actualizar el inventario."
                );

                return;
            }

            /*
             * 2. Registrar movimiento
             */
            const { error: errorMovimiento } = await supabase
                .from("movimientos_inventario")
                .insert({
                    inventario_id: inventarioSeleccionado.id,
                    usuario_id: usuario.id,
                    tipo: tipoMovimiento,
                    cantidad:
                        tipoMovimiento === "salida"
                            ? -cantidad
                            : cantidad,
                    stock_anterior: stockAnterior,
                    stock_nuevo: stockNuevo,
                    motivo: motivoMovimiento.trim(),
                });

            if (errorMovimiento) {
                console.error(
                    "Error registrando movimiento:",
                    errorMovimiento
                );

                mostrarMensaje(
                    "warning",
                    "Movimiento no registrado",
                    "El stock se actualizó, pero no se pudo registrar el movimiento."
                );

                await cargarInventario();
                cerrarAjusteStock();

                return;
            }

            /*
             * 3. Actualizar pantalla
             */
            await cargarInventario();

            /*
             * 4. Cerrar modal
             */
            cerrarAjusteStock();

            /*
             * 5. Mostrar mensaje
             */
            mostrarMensaje(
                "success",
                "Inventario actualizado",
                tipoMovimiento === "entrada"
                    ? "Entrada de inventario registrada correctamente."
                    : tipoMovimiento === "salida"
                        ? "Salida de inventario registrada correctamente."
                        : "Ajuste de inventario registrado correctamente."
            );
        } catch (error) {
            console.error(
                "Error inesperado registrando movimiento:",
                error
            );

            mostrarMensaje(
                "error",
                "Error inesperado",
                "Ocurrió un error al registrar el movimiento."
            );
        } finally {
            setGuardandoMovimiento(false);
        }
    }

    /*
     * Filtros
     */
    const inventarioFiltrado = inventarios.filter((item) => {
        const texto = busqueda.toLowerCase().trim();

        const coincideBusqueda =
            !texto ||
            item.producto?.nombre.toLowerCase().includes(texto) ||
            item.producto?.codigo_barras
                ?.toLowerCase()
                .includes(texto) ||
            item.producto?.sku?.toLowerCase().includes(texto);

        const coincideSucursal =
            !sucursalSeleccionada ||
            item.sucursal_id === sucursalSeleccionada;

        return coincideBusqueda && coincideSucursal;
    });

    /*
     * Estadísticas
     */
    const totalProductos = inventarioFiltrado.length;

    const productosAgotados = inventarioFiltrado.filter(
        (item) => Number(item.stock) <= 0
    ).length;

    const productosStockBajo = inventarioFiltrado.filter(
        (item) =>
            Number(item.stock) > 0 &&
            Number(item.stock) <=
            Number(item.producto?.stock_minimo ?? 0)
    ).length;

    const productosDisponibles = inventarioFiltrado.filter(
        (item) =>
            Number(item.stock) >
            Number(item.producto?.stock_minimo ?? 0)
    ).length;

    return (
        <div className="space-y-6">
            {/* Modal de mensajes */}
            {mensajeModal.abierto && (
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
                    aria-labelledby="mensaje-inventario-titulo"
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
                                        rounded-full
                                        text-lg
                                        font-bold
                                        ${mensajeModal.tipo === "success"
                                            ? "bg-green-100 text-green-700"
                                            : mensajeModal.tipo === "warning"
                                                ? "bg-amber-100 text-amber-700"
                                                : "bg-red-100 text-red-700"
                                        }
                                    `}
                                >
                                    {mensajeModal.tipo === "success"
                                        ? "✓"
                                        : mensajeModal.tipo === "warning"
                                            ? "!"
                                            : "×"}
                                </div>

                                <div className="min-w-0 flex-1">
                                    <h2
                                        id="mensaje-inventario-titulo"
                                        className="text-lg font-bold text-[var(--color-text)]"
                                    >
                                        {mensajeModal.titulo}
                                    </h2>

                                    <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
                                        {mensajeModal.mensaje}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div
                            className="
                                border-t
                                border-[var(--color-border)]
                                bg-[var(--color-background)]
                                p-4
                            "
                        >
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
                                    transition
                                    hover:opacity-90
                                    active:scale-[0.99]
                                "
                            >
                                Entendido
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal ajustar stock */}
            {modalAjustar && inventarioSeleccionado && (
                <div
                    className="
                        fixed
                        inset-0
                        z-[200]
                        flex
                        items-center
                        justify-center
                        bg-black/40
                        p-4
                        backdrop-blur-sm
                    "
                >
                    <div
                        className="
                            max-h-[calc(100vh-2rem)]
                            w-full
                            max-w-lg
                            overflow-y-auto
                            rounded-2xl
                            border
                            border-[var(--color-border)]
                            bg-[var(--color-surface)]
                            shadow-2xl
                        "
                    >
                        {/* Encabezado */}
                        <div
                            className="
                                sticky
                                top-0
                                z-10
                                flex
                                items-center
                                justify-between
                                border-b
                                border-[var(--color-border)]
                                bg-[var(--color-surface)]
                                px-5
                                py-4
                            "
                        >
                            <div>
                                <h2 className="text-lg font-bold text-[var(--color-text)]">
                                    Ajustar inventario
                                </h2>

                                <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                                    Registra una entrada, salida o ajuste.
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={cerrarAjusteStock}
                                disabled={guardandoMovimiento}
                                aria-label="Cerrar"
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
                            >
                                ×
                            </button>
                        </div>

                        {/* Contenido */}
                        <div className="space-y-5 p-5">
                            {/* Producto */}
                            <div
                                className="
                                    rounded-xl
                                    border
                                    border-[var(--color-border)]
                                    bg-[var(--color-background)]
                                    p-4
                                "
                            >
                                <p className="text-sm font-bold text-[var(--color-text)]">
                                    {inventarioSeleccionado.producto?.nombre}
                                </p>

                                <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                                    Sucursal:{" "}
                                    {inventarioSeleccionado.sucursal?.nombre}
                                </p>

                                <div className="mt-3 grid grid-cols-2 gap-3">
                                    <div>
                                        <p className="text-xs text-[var(--color-text-secondary)]">
                                            Stock actual
                                        </p>

                                        <p className="mt-1 text-sm font-bold text-[var(--color-text)]">
                                            {Number(
                                                inventarioSeleccionado.stock
                                            ).toFixed(3)}{" "}
                                            <span className="font-normal text-[var(--color-text-secondary)]">
                                                {
                                                    inventarioSeleccionado
                                                        .producto?.unidad
                                                }
                                            </span>
                                        </p>
                                    </div>

                                    <div>
                                        <p className="text-xs text-[var(--color-text-secondary)]">
                                            Reservado
                                        </p>

                                        <p className="mt-1 text-sm font-bold text-[var(--color-text)]">
                                            {Number(
                                                inventarioSeleccionado.stock_reservado
                                            ).toFixed(3)}{" "}
                                            <span className="font-normal text-[var(--color-text-secondary)]">
                                                {
                                                    inventarioSeleccionado
                                                        .producto?.unidad
                                                }
                                            </span>
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Tipo */}
                            <div>
                                <label
                                    htmlFor="tipo-movimiento"
                                    className="mb-2 block text-sm font-semibold text-[var(--color-text)]"
                                >
                                    Tipo de movimiento
                                </label>

                                <select
                                    id="tipo-movimiento"
                                    value={tipoMovimiento}
                                    onChange={(e) =>
                                        setTipoMovimiento(e.target.value)
                                    }
                                    disabled={guardandoMovimiento}
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
                                        focus:ring-[var(--color-primary)]/10
                                        disabled:cursor-not-allowed
                                        disabled:opacity-60
                                    "
                                >
                                    <option value="entrada">
                                        Entrada
                                    </option>

                                    <option value="salida">
                                        Salida
                                    </option>

                                    <option value="ajuste">
                                        Ajuste de inventario
                                    </option>
                                </select>
                            </div>

                            {/* Cantidad */}
                            <div>
                                <label
                                    htmlFor="cantidad-movimiento"
                                    className="mb-2 block text-sm font-semibold text-[var(--color-text)]"
                                >
                                    {tipoMovimiento === "ajuste"
                                        ? "Nuevo stock"
                                        : "Cantidad"}
                                </label>

                                <input
                                    id="cantidad-movimiento"
                                    type="number"
                                    min="0"
                                    step="0.001"
                                    value={cantidadMovimiento}
                                    onChange={(e) =>
                                        setCantidadMovimiento(
                                            e.target.value
                                        )
                                    }
                                    disabled={guardandoMovimiento}
                                    placeholder="0"
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
                                        focus:ring-[var(--color-primary)]/10
                                        disabled:cursor-not-allowed
                                        disabled:opacity-60
                                    "
                                />

                                {tipoMovimiento === "ajuste" && (
                                    <p className="mt-2 text-xs leading-5 text-[var(--color-text-secondary)]">
                                        El valor indicado será el nuevo stock
                                        total del producto.
                                    </p>
                                )}
                            </div>

                            {/* Motivo */}
                            <div>
                                <label
                                    htmlFor="motivo-movimiento"
                                    className="mb-2 block text-sm font-semibold text-[var(--color-text)]"
                                >
                                    Motivo
                                </label>

                                <textarea
                                    id="motivo-movimiento"
                                    rows={3}
                                    value={motivoMovimiento}
                                    onChange={(e) =>
                                        setMotivoMovimiento(
                                            e.target.value
                                        )
                                    }
                                    disabled={guardandoMovimiento}
                                    placeholder="Ej. Compra a proveedor, mercancía dañada, conteo físico..."
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
                                        focus:border-[var(--color-primary)]
                                        focus:ring-4
                                        focus:ring-[var(--color-primary)]/10
                                        disabled:cursor-not-allowed
                                        disabled:opacity-60
                                    "
                                />
                            </div>
                        </div>

                        {/* Pie */}
                        <div
                            className="
                                sticky
                                bottom-0
                                flex
                                flex-col-reverse
                                gap-3
                                border-t
                                border-[var(--color-border)]
                                bg-[var(--color-background)]
                                p-4
                                sm:flex-row
                                sm:justify-end
                            "
                        >
                            <button
                                type="button"
                                onClick={cerrarAjusteStock}
                                disabled={guardandoMovimiento}
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
                                onClick={guardarMovimiento}
                                disabled={guardandoMovimiento}
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
                                    active:scale-[0.99]
                                    disabled:cursor-not-allowed
                                    disabled:opacity-60
                                    sm:w-auto
                                "
                            >
                                {guardandoMovimiento
                                    ? "Guardando..."
                                    : "Guardar movimiento"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Encabezado */}
            <div>
                <h1 className="text-2xl font-bold text-[var(--color-text)] sm:text-3xl">
                    Inventario
                </h1>

                <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                    Consulta y administra las existencias de tus productos.
                </p>
            </div>

            {/* Estadísticas */}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <Card className="p-5">
                    <p className="text-sm text-[var(--color-text-secondary)]">
                        Productos
                    </p>

                    <p className="mt-2 text-2xl font-bold text-[var(--color-text)]">
                        {totalProductos}
                    </p>
                </Card>

                <Card className="p-5">
                    <p className="text-sm text-[var(--color-text-secondary)]">
                        Disponibles
                    </p>

                    <p className="mt-2 text-2xl font-bold text-green-600">
                        {productosDisponibles}
                    </p>
                </Card>

                <Card className="p-5">
                    <p className="text-sm text-[var(--color-text-secondary)]">
                        Stock bajo
                    </p>

                    <p className="mt-2 text-2xl font-bold text-amber-600">
                        {productosStockBajo}
                    </p>
                </Card>

                <Card className="p-5">
                    <p className="text-sm text-[var(--color-text-secondary)]">
                        Agotados
                    </p>

                    <p className="mt-2 text-2xl font-bold text-red-600">
                        {productosAgotados}
                    </p>
                </Card>
            </div>

            {/* Filtros */}
            <Card className="p-4">
                <div className="flex flex-col gap-3 lg:flex-row">
                    <input
                        type="search"
                        value={busqueda}
                        onChange={(e) => setBusqueda(e.target.value)}
                        placeholder="Buscar producto, código o SKU..."
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
                            focus:ring-[var(--color-primary)]/10
                            lg:flex-1
                        "
                    />

                    <select
                        value={sucursalSeleccionada}
                        onChange={(e) =>
                            setSucursalSeleccionada(e.target.value)
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
                            focus:ring-[var(--color-primary)]/10
                            lg:w-64
                        "
                    >
                        <option value="">
                            Todas las sucursales
                        </option>

                        {sucursales.map((sucursal) => (
                            <option
                                key={sucursal.id}
                                value={sucursal.id}
                            >
                                {sucursal.nombre}
                            </option>
                        ))}
                    </select>
                </div>
            </Card>

            {/* Cargando */}
            {cargando && (
                <Card className="p-8">
                    <div className="text-center">
                        <div
                            className="
                                mx-auto
                                mb-3
                                h-8
                                w-8
                                animate-spin
                                rounded-full
                                border-4
                                border-[var(--color-border)]
                                border-t-[var(--color-primary)]
                            "
                        />

                        <p className="text-sm text-[var(--color-text-secondary)]">
                            Cargando inventario...
                        </p>
                    </div>
                </Card>
            )}

            {/* Error */}
            {!cargando && error && (
                <Card className="border-red-200 bg-red-50 p-6">
                    <div className="flex items-start gap-3">
                        <div
                            className="
                                flex
                                h-9
                                w-9
                                shrink-0
                                items-center
                                justify-center
                                rounded-full
                                bg-red-100
                                font-bold
                                text-red-700
                            "
                        >
                            ×
                        </div>

                        <div>
                            <p className="text-sm font-bold text-red-800">
                                No se pudo cargar el inventario
                            </p>

                            <p className="mt-1 text-sm text-red-700">
                                {error}
                            </p>
                        </div>
                    </div>
                </Card>
            )}

            {/* Tabla */}
            {!cargando &&
                !error &&
                inventarioFiltrado.length > 0 && (
                    <Card className="overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[850px] text-left">
                                <thead
                                    className="
                                        border-b
                                        border-[var(--color-border)]
                                        bg-[var(--color-background)]
                                    "
                                >
                                    <tr>
                                        <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
                                            Producto
                                        </th>

                                        <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
                                            Sucursal
                                        </th>

                                        <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
                                            Stock
                                        </th>

                                        <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
                                            Mínimo
                                        </th>

                                        <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
                                            Estado
                                        </th>

                                        <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
                                            Acción
                                        </th>
                                    </tr>
                                </thead>

                                <tbody className="divide-y divide-[var(--color-border)]">
                                    {inventarioFiltrado.map((item) => {
                                        const stock = Number(item.stock);

                                        const minimo = Number(
                                            item.producto?.stock_minimo ?? 0
                                        );

                                        let estado = "Disponible";

                                        let claseEstado =
                                            "bg-green-100 text-green-700";

                                        if (stock <= 0) {
                                            estado = "Agotado";

                                            claseEstado =
                                                "bg-red-100 text-red-700";
                                        } else if (stock <= minimo) {
                                            estado = "Stock bajo";

                                            claseEstado =
                                                "bg-amber-100 text-amber-700";
                                        }

                                        return (
                                            <tr
                                                key={item.id}
                                                className="
                                                    transition
                                                    hover:bg-[var(--color-background)]
                                                "
                                            >
                                                <td className="px-5 py-4">
                                                    <p className="font-semibold text-[var(--color-text)]">
                                                        {item.producto?.nombre ??
                                                            "Producto desconocido"}
                                                    </p>

                                                    <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                                                        {item.producto
                                                            ?.codigo_barras ||
                                                            item.producto
                                                                ?.sku ||
                                                            "Sin código"}
                                                    </p>
                                                </td>

                                                <td className="px-5 py-4 text-sm text-[var(--color-text-secondary)]">
                                                    {item.sucursal?.nombre ??
                                                        "Sucursal desconocida"}
                                                </td>

                                                <td className="px-5 py-4">
                                                    <span className="text-lg font-bold text-[var(--color-text)]">
                                                        {stock.toFixed(3)}
                                                    </span>

                                                    <span className="ml-1 text-xs text-[var(--color-text-secondary)]">
                                                        {
                                                            item.producto
                                                                ?.unidad
                                                        }
                                                    </span>

                                                    {Number(
                                                        item.stock_reservado
                                                    ) > 0 && (
                                                            <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                                                                Reservado:{" "}
                                                                {Number(
                                                                    item.stock_reservado
                                                                ).toFixed(3)}
                                                            </p>
                                                        )}
                                                </td>

                                                <td className="px-5 py-4 text-sm text-[var(--color-text-secondary)]">
                                                    {minimo.toFixed(3)}
                                                </td>

                                                <td className="px-5 py-4">
                                                    <span
                                                        className={`
                                                            inline-flex
                                                            rounded-full
                                                            px-3
                                                            py-1
                                                            text-xs
                                                            font-semibold
                                                            ${claseEstado}
                                                        `}
                                                    >
                                                        {estado}
                                                    </span>
                                                </td>

                                                <td className="px-5 py-4 text-right">
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            abrirAjusteStock(
                                                                item
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
                                                            hover:bg-[var(--color-background)]
                                                            active:scale-95
                                                        "
                                                    >
                                                        Ajustar stock
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                )}

            {/* Sin resultados */}
            {!cargando &&
                !error &&
                inventarioFiltrado.length === 0 && (
                    <Card className="p-10">
                        <div className="text-center">
                            <div
                                className="
                                    mx-auto
                                    flex
                                    h-14
                                    w-14
                                    items-center
                                    justify-center
                                    rounded-2xl
                                    bg-[var(--color-background)]
                                    text-2xl
                                    text-[var(--color-primary)]
                                "
                            >
                                📦
                            </div>

                            <h2 className="mt-4 text-lg font-bold text-[var(--color-text)]">
                                No hay inventario
                            </h2>

                            <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
                                {busqueda || sucursalSeleccionada
                                    ? "No encontramos productos con los filtros seleccionados."
                                    : "Todavía no hay productos registrados en el inventario."}
                            </p>
                        </div>
                    </Card>
                )}
        </div>
    );
}