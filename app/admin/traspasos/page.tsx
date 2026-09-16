"use client";

import { useEffect, useMemo, useState } from "react";

import Card from "../../components/Card";
import ModalMensaje from "../../components/ModalMensaje";

import { supabase } from "../../../lib/supabase";
import {
    obtenerUsuarioActual,
    type UsuarioActual,
} from "../../../lib/auth/roleGuard";

interface Sucursal {
    id: string;
    nombre: string;
}

interface Producto {
    producto_id: string;
    inventario_id: string;
    nombre: string;
    codigo_barras: string | null;
    sku: string | null;
    unidad: string;
    stock: number;
    stock_reservado: number;
}

interface ProductoTraspaso {
    producto_id: string;
    nombre: string;
    unidad: string;
    stock_disponible: number;
    cantidad: number;
}

interface Traspaso {
    id: string;
    sucursal_origen_id: string;
    sucursal_destino_id: string;
    usuario_id: string;
    estado: string;
    notas: string | null;
    created_at: string;
    sucursal_origen: {
        nombre: string;
    } | null;
    sucursal_destino: {
        nombre: string;
    } | null;
    usuario: {
        nombre: string;
    } | null;
    detalle_traspasos: {
        cantidad: number;
        producto: {
            nombre: string;
            unidad: string;
        } | null;
    }[];
}

type TipoMensaje =
    | "info"
    | "error"
    | "exito"
    | "confirmacion";

export default function TraspasosPage() {
    const [sucursales, setSucursales] = useState<Sucursal[]>([]);
    const [productos, setProductos] = useState<Producto[]>([]);
    const [traspasos, setTraspasos] = useState<Traspaso[]>([]);

    const [sucursalOrigen, setSucursalOrigen] = useState("");
    const [sucursalDestino, setSucursalDestino] = useState("");

    const [productoSeleccionado, setProductoSeleccionado] =
        useState("");
    const [cantidad, setCantidad] = useState("");
    const [notas, setNotas] = useState("");

    const [productosTraspaso, setProductosTraspaso] =
        useState<ProductoTraspaso[]>([]);

    const [busquedaProducto, setBusquedaProducto] =
        useState("");

    const [cargando, setCargando] = useState(true);
    const [cargandoProductos, setCargandoProductos] =
        useState(false);
    const [guardando, setGuardando] = useState(false);

    const [modalMensajeAbierto, setModalMensajeAbierto] =
        useState(false);
    const [tipoMensaje, setTipoMensaje] =
        useState<TipoMensaje>("info");
    const [tituloMensaje, setTituloMensaje] = useState("");
    const [textoMensaje, setTextoMensaje] = useState("");

    function mostrarMensaje(
        tipo: TipoMensaje,
        titulo: string,
        mensaje: string
    ) {
        setTipoMensaje(tipo);
        setTituloMensaje(titulo);
        setTextoMensaje(mensaje);
        setModalMensajeAbierto(true);
    }

    function cerrarModalMensaje() {
        setModalMensajeAbierto(false);
    }

    /*
     * ==========================================
     * CARGAR DATOS
     * ==========================================
     */
    async function cargarDatos() {
        setCargando(true);

        try {
            const usuario =
                (await obtenerUsuarioActual()) as
                | UsuarioActual
                | null;

            if (!usuario?.negocio_id) {
                mostrarMensaje(
                    "error",
                    "No se encontró el negocio",
                    "No se encontró el negocio asociado al usuario."
                );
                return;
            }

            /*
             * ==========================================
             * 1. SUCURSALES
             * ==========================================
             */
            const {
                data: sucursalesData,
                error: errorSucursales,
            } = await supabase
                .from("sucursales")
                .select("id, nombre")
                .eq("negocio_id", usuario.negocio_id)
                .order("nombre", {
                    ascending: true,
                });

            if (errorSucursales) {
                mostrarMensaje(
                    "error",
                    "No se pudieron cargar las sucursales",
                    "No fue posible obtener las sucursales. Intenta nuevamente."
                );
                return;
            }

            setSucursales(
                (sucursalesData ?? []) as Sucursal[]
            );

            /*
             * ==========================================
             * 2. TRASPASOS
             * ==========================================
             */
            const {
                data: traspasosData,
                error: errorTraspasos,
            } = await supabase
                .from("traspasos")
                .select(`
    id,
        negocio_id,
        sucursal_origen_id,
        sucursal_destino_id,
        usuario_id,
        estado,
        notas,
        created_at
            `)
                .eq(
                    "negocio_id",
                    usuario.negocio_id
                )
                .order("created_at", {
                    ascending: false,
                });

            if (errorTraspasos) {
                mostrarMensaje(
                    "error",
                    "No se pudo cargar el historial",
                    "No fue posible obtener el historial de traspasos."
                );
                return;
            }

            if (
                !traspasosData ||
                traspasosData.length === 0
            ) {
                setTraspasos([]);
                return;
            }

            /*
             * ==========================================
             * 3. IDS DE TRASPASOS
             * ==========================================
             */
            const traspasoIds =
                traspasosData.map(
                    (traspaso) => traspaso.id
                );

            /*
             * ==========================================
             * 4. DETALLES DE TRASPASOS
             * ==========================================
             */
            const {
                data: detallesData,
                error: errorDetalles,
            } = await supabase
                .from("detalle_traspasos")
                .select(`
    id,
        traspaso_id,
        producto_id,
        cantidad
            `)
                .in(
                    "traspaso_id",
                    traspasoIds
                );

            if (errorDetalles) {
                mostrarMensaje(
                    "error",
                    "No se pudieron cargar los detalles",
                    "No fue posible obtener los productos de los traspasos."
                );
                return;
            }

            /*
             * ==========================================
             * 5. PRODUCTOS
             * ==========================================
             */
            const productoIds = [
                ...new Set(
                    (detallesData ?? []).map(
                        (detalle) =>
                            detalle.producto_id
                    )
                ),
            ];

            let productosData: {
                id: string;
                nombre: string;
                unidad: string;
            }[] = [];

            if (productoIds.length > 0) {
                const {
                    data,
                    error: errorProductos,
                } = await supabase
                    .from("productos")
                    .select(`
    id,
        nombre,
        unidad
            `)
                    .in(
                        "id",
                        productoIds
                    );

                if (errorProductos) {
                    mostrarMensaje(
                        "error",
                        "No se pudieron cargar los productos",
                        "No fue posible obtener los productos de los traspasos."
                    );
                    return;
                }

                productosData = data ?? [];
            }

            /*
             * ==========================================
             * 6. USUARIOS
             * ==========================================
             */
            const usuarioIds = [
                ...new Set(
                    traspasosData.map(
                        (traspaso) =>
                            traspaso.usuario_id
                    )
                ),
            ];

            let usuariosData: {
                id: string;
                nombre: string;
            }[] = [];

            if (usuarioIds.length > 0) {
                const {
                    data,
                    error: errorUsuarios,
                } = await supabase
                    .from("usuarios")
                    .select(`
    id,
        nombre
            `)
                    .in(
                        "id",
                        usuarioIds
                    );

                if (errorUsuarios) {
                    mostrarMensaje(
                        "error",
                        "No se pudieron cargar los usuarios",
                        "No fue posible obtener los usuarios de los traspasos."
                    );
                    return;
                }

                usuariosData = data ?? [];
            }

            /*
             * ==========================================
             * 7. ARMAR HISTORIAL
             * ==========================================
             */
            const historial: Traspaso[] =
                traspasosData.map(
                    (traspaso) => {
                        const sucursalOrigen =
                            (sucursalesData ?? []).find(
                                (sucursal) =>
                                    sucursal.id ===
                                    traspaso.sucursal_origen_id
                            );

                        const sucursalDestino =
                            (sucursalesData ?? []).find(
                                (sucursal) =>
                                    sucursal.id ===
                                    traspaso.sucursal_destino_id
                            );

                        const usuarioTraspaso =
                            usuariosData.find(
                                (item) =>
                                    item.id ===
                                    traspaso.usuario_id
                            );

                        const detalles =
                            (detallesData ?? [])
                                .filter(
                                    (detalle) =>
                                        detalle.traspaso_id ===
                                        traspaso.id
                                )
                                .map(
                                    (detalle) => {
                                        const producto =
                                            productosData.find(
                                                (item) =>
                                                    item.id ===
                                                    detalle.producto_id
                                            );

                                        return {
                                            cantidad:
                                                Number(
                                                    detalle.cantidad
                                                ),
                                            producto:
                                                producto
                                                    ? {
                                                        nombre:
                                                            producto.nombre,
                                                        unidad:
                                                            producto.unidad,
                                                    }
                                                    : null,
                                        };
                                    }
                                );

                        return {
                            id:
                                traspaso.id,
                            sucursal_origen_id:
                                traspaso.sucursal_origen_id,
                            sucursal_destino_id:
                                traspaso.sucursal_destino_id,
                            usuario_id:
                                traspaso.usuario_id,
                            estado:
                                traspaso.estado,
                            notas:
                                traspaso.notas,
                            created_at:
                                traspaso.created_at,
                            sucursal_origen:
                                sucursalOrigen
                                    ? {
                                        nombre:
                                            sucursalOrigen.nombre,
                                    }
                                    : null,
                            sucursal_destino:
                                sucursalDestino
                                    ? {
                                        nombre:
                                            sucursalDestino.nombre,
                                    }
                                    : null,
                            usuario:
                                usuarioTraspaso
                                    ? {
                                        nombre:
                                            usuarioTraspaso.nombre,
                                    }
                                    : null,
                            detalle_traspasos:
                                detalles,
                        };
                    }
                );

            setTraspasos(historial);
        } catch {
            mostrarMensaje(
                "error",
                "Error al cargar los datos",
                "Ocurrió un error inesperado al cargar los traspasos."
            );
        } finally {
            setCargando(false);
        }
    }

    useEffect(() => {
        cargarDatos();
    }, []);

    /*
     * ==========================================
     * CARGAR PRODUCTOS DE ORIGEN
     * ==========================================
     */
    async function cargarProductosOrigen(
        sucursalId: string
    ) {
        setProductos([]);
        setProductosTraspaso([]);
        setProductoSeleccionado("");
        setCantidad("");

        if (!sucursalId) {
            return;
        }

        setCargandoProductos(true);

        try {
            const {
                data,
                error: errorInventario,
            } = await supabase
                .from("inventario")
                .select(`
    id,
        producto_id,
        stock,
        stock_reservado,
        producto: productos(
            nombre,
            codigo_barras,
            sku,
            unidad
        )
            `)
                .eq(
                    "sucursal_id",
                    sucursalId
                )
                .order("created_at", {
                    ascending: false,
                });

            if (errorInventario) {
                mostrarMensaje(
                    "error",
                    "No se pudieron cargar los productos",
                    "No fue posible obtener el inventario de la sucursal seleccionada."
                );
                return;
            }

            const productosFormateados: Producto[] =
                (data ?? [])
                    .map(
                        (item: any) => ({
                            producto_id:
                                item.producto_id,
                            inventario_id:
                                item.id,
                            nombre:
                                item.producto?.nombre ??
                                "Producto",
                            codigo_barras:
                                item.producto?.codigo_barras ??
                                null,
                            sku:
                                item.producto?.sku ??
                                null,
                            unidad:
                                item.producto?.unidad ??
                                "pieza",
                            stock:
                                Number(
                                    item.stock ?? 0
                                ),
                            stock_reservado:
                                Number(
                                    item.stock_reservado ??
                                    0
                                ),
                        })
                    )
                    .filter(
                        (producto) =>
                            producto.stock -
                            producto.stock_reservado >
                            0
                    );

            setProductos(
                productosFormateados
            );
        } catch {
            mostrarMensaje(
                "error",
                "Error al cargar productos",
                "Ocurrió un error inesperado al cargar los productos."
            );
        } finally {
            setCargandoProductos(false);
        }
    }

    function cambiarSucursalOrigen(
        valor: string
    ) {
        setSucursalOrigen(valor);
        cargarProductosOrigen(valor);
    }

    /*
     * ==========================================
     * PRODUCTOS FILTRADOS
     * ==========================================
     */
    const productosFiltrados = useMemo(() => {
        const texto =
            busquedaProducto
                .toLowerCase()
                .trim();

        if (!texto) {
            return productos;
        }

        return productos.filter(
            (producto) =>
                producto.nombre
                    .toLowerCase()
                    .includes(texto) ||
                producto.codigo_barras
                    ?.toLowerCase()
                    .includes(texto) ||
                producto.sku
                    ?.toLowerCase()
                    .includes(texto)
        );
    }, [
        productos,
        busquedaProducto,
    ]);

    /*
     * ==========================================
     * AGREGAR PRODUCTO
     * ==========================================
     */
    function agregarProducto() {
        if (!productoSeleccionado) {
            mostrarMensaje(
                "info",
                "Producto requerido",
                "Selecciona un producto antes de agregarlo."
            );
            return;
        }

        const cantidadNumerica =
            Number(cantidad);

        if (
            !Number.isFinite(
                cantidadNumerica
            ) ||
            cantidadNumerica <= 0
        ) {
            mostrarMensaje(
                "info",
                "Cantidad inválida",
                "La cantidad debe ser mayor que cero."
            );
            return;
        }

        const producto =
            productos.find(
                (item) =>
                    item.producto_id ===
                    productoSeleccionado
            );

        if (!producto) {
            mostrarMensaje(
                "error",
                "Producto no encontrado",
                "No se encontró el producto seleccionado."
            );
            return;
        }

        const stockDisponible =
            producto.stock -
            producto.stock_reservado;

        const existente =
            productosTraspaso.find(
                (item) =>
                    item.producto_id ===
                    producto.producto_id
            );

        const cantidadTotal =
            (existente?.cantidad ?? 0) +
            cantidadNumerica;

        if (
            cantidadTotal >
            stockDisponible
        ) {
            mostrarMensaje(
                "info",
                "Stock insuficiente",
                `La cantidad solicitada supera el stock disponible.Disponible: ${stockDisponible}.`
            );
            return;
        }

        if (existente) {
            setProductosTraspaso(
                productosTraspaso.map(
                    (item) =>
                        item.producto_id ===
                            producto.producto_id
                            ? {
                                ...item,
                                cantidad:
                                    cantidadTotal,
                            }
                            : item
                )
            );
        } else {
            setProductosTraspaso([
                ...productosTraspaso,
                {
                    producto_id:
                        producto.producto_id,
                    nombre:
                        producto.nombre,
                    unidad:
                        producto.unidad,
                    stock_disponible:
                        stockDisponible,
                    cantidad:
                        cantidadNumerica,
                },
            ]);
        }

        setProductoSeleccionado("");
        setCantidad("");
        setBusquedaProducto("");
    }

    /*
     * ==========================================
     * CAMBIAR CANTIDAD
     * ==========================================
     */
    function cambiarCantidadProducto(
        productoId: string,
        nuevaCantidad: number
    ) {
        if (nuevaCantidad <= 0) {
            eliminarProducto(
                productoId
            );
            return;
        }

        setProductosTraspaso(
            productosTraspaso.map(
                (producto) =>
                    producto.producto_id ===
                        productoId
                        ? {
                            ...producto,
                            cantidad:
                                Math.min(
                                    nuevaCantidad,
                                    producto.stock_disponible
                                ),
                        }
                        : producto
            )
        );
    }

    /*
     * ==========================================
     * ELIMINAR PRODUCTO
     * ==========================================
     */
    function eliminarProducto(
        productoId: string
    ) {
        setProductosTraspaso(
            productosTraspaso.filter(
                (producto) =>
                    producto.producto_id !==
                    productoId
            )
        );
    }

    /*
     * ==========================================
     * CREAR TRASPASO
     * ==========================================
     */
    async function realizarTraspaso() {
        if (!sucursalOrigen) {
            mostrarMensaje(
                "info",
                "Sucursal origen requerida",
                "Selecciona la sucursal origen."
            );
            return;
        }

        if (!sucursalDestino) {
            mostrarMensaje(
                "info",
                "Sucursal destino requerida",
                "Selecciona la sucursal destino."
            );
            return;
        }

        if (
            sucursalOrigen ===
            sucursalDestino
        ) {
            mostrarMensaje(
                "info",
                "Sucursales inválidas",
                "La sucursal origen y destino deben ser diferentes."
            );
            return;
        }

        if (
            productosTraspaso.length ===
            0
        ) {
            mostrarMensaje(
                "info",
                "Productos requeridos",
                "Agrega al menos un producto al traspaso."
            );
            return;
        }

        const usuario =
            (await obtenerUsuarioActual()) as
            | UsuarioActual
            | null;

        if (
            !usuario?.id ||
            !usuario.negocio_id
        ) {
            mostrarMensaje(
                "error",
                "Usuario no disponible",
                "No se encontró la información del usuario."
            );
            return;
        }

        setGuardando(true);

        try {
            const detalles =
                productosTraspaso.map(
                    (producto) => ({
                        producto_id:
                            producto.producto_id,
                        cantidad:
                            producto.cantidad,
                    })
                );

            const {
                data,
                error: errorRPC,
            } = await supabase.rpc(
                "crear_traspaso",
                {
                    p_negocio_id:
                        usuario.negocio_id,
                    p_sucursal_origen_id:
                        sucursalOrigen,
                    p_sucursal_destino_id:
                        sucursalDestino,
                    p_usuario_id:
                        usuario.id,
                    p_notas:
                        notas.trim() || null,
                    p_detalles:
                        detalles,
                }
            );

            if (errorRPC) {
                mostrarMensaje(
                    "error",
                    "No se pudo realizar el traspaso",
                    errorRPC.message ||
                    "No se pudo realizar el traspaso."
                );
                return;
            }

            const nombreOrigen =
                sucursales.find(
                    (sucursal) =>
                        sucursal.id ===
                        sucursalOrigen
                )?.nombre ??
                "Sucursal origen";

            const nombreDestino =
                sucursales.find(
                    (sucursal) =>
                        sucursal.id ===
                        sucursalDestino
                )?.nombre ??
                "Sucursal destino";

            const cantidadProductos =
                productosTraspaso.length;

            setSucursalOrigen("");
            setSucursalDestino("");
            setProductos([]);
            setProductosTraspaso([]);
            setProductoSeleccionado("");
            setCantidad("");
            setNotas("");
            setBusquedaProducto("");

            await cargarDatos();

            mostrarMensaje(
                "exito",
                "Traspaso realizado correctamente",
                `Se transfirieron ${cantidadProductos} ${cantidadProductos === 1
                    ? "producto"
                    : "productos"
                } de ${nombreOrigen} a ${nombreDestino}.`
            );
        } catch {
            mostrarMensaje(
                "error",
                "Error al realizar el traspaso",
                "Ocurrió un error inesperado al realizar el traspaso."
            );
        } finally {
            setGuardando(false);
        }
    }

    /*
     * ==========================================
     * FORMATO FECHA
     * ==========================================
     */
    function formatearFecha(
        fecha: string
    ) {
        return new Date(
            fecha
        ).toLocaleString(
            "es-MX",
            {
                dateStyle: "short",
                timeStyle: "short",
            }
        );
    }

    /*
     * ==========================================
     * RENDER
     * ==========================================
     */
    if (cargando) {
        return (
            <div className="space-y-6">
                <Card className="p-8">
                    <div className="flex flex-col items-center justify-center gap-3">
                        <div
                            className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-border)] border-t-[var(--color-primary)]"
                            aria-hidden="true"
                        />
                        <p className="text-center text-sm text-[var(--color-text-secondary)]">
                            Cargando traspasos...
                        </p>
                    </div>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* ENCABEZADO */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-[var(--color-text)] sm:text-3xl">
                        Traspasos
                    </h1>
                    <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                        Transfiere productos entre sucursales.
                    </p>
                </div>
            </div>

            {/* NUEVO TRASPASO */}
            <Card className="p-5 sm:p-6">
                <div className="mb-6">
                    <div className="flex items-start gap-3">
                        <div
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white"
                            style={{
                                background:
                                    "linear-gradient(135deg, var(--color-primary), var(--color-primary-hover))",
                            }}
                        >
                            <svg
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                className="h-5 w-5"
                                aria-hidden="true"
                            >
                                <path d="M7 7h10" />
                                <path d="m13 3 4 4-4 4" />
                                <path d="M17 17H7" />
                                <path d="m11 13-4 4 4 4" />
                            </svg>
                        </div>

                        <div>
                            <h2 className="text-lg font-semibold text-[var(--color-text)]">
                                Nuevo traspaso
                            </h2>
                            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                                Selecciona las sucursales y los productos que deseas transferir.
                            </p>
                        </div>
                    </div>
                </div>

                {/* SUCURSALES */}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                        <label
                            htmlFor="sucursal-origen"
                            className="mb-2 block text-sm font-medium text-[var(--color-text)]"
                        >
                            Sucursal origen
                        </label>

                        <select
                            id="sucursal-origen"
                            value={
                                sucursalOrigen
                            }
                            onChange={(e) =>
                                cambiarSucursalOrigen(
                                    e.target.value
                                )
                            }
                            className="min-h-12 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[var(--color-primary)]/10"
                        >
                            <option value="">
                                Selecciona una sucursal
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
                                        {
                                            sucursal.nombre
                                        }
                                    </option>
                                )
                            )}
                        </select>
                    </div>

                    <div>
                        <label
                            htmlFor="sucursal-destino"
                            className="mb-2 block text-sm font-medium text-[var(--color-text)]"
                        >
                            Sucursal destino
                        </label>

                        <select
                            id="sucursal-destino"
                            value={
                                sucursalDestino
                            }
                            onChange={(e) =>
                                setSucursalDestino(
                                    e.target.value
                                )
                            }
                            className="min-h-12 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[var(--color-primary)]/10"
                        >
                            <option value="">
                                Selecciona una sucursal
                            </option>

                            {sucursales
                                .filter(
                                    (sucursal) =>
                                        sucursal.id !==
                                        sucursalOrigen
                                )
                                .map(
                                    (
                                        sucursal
                                    ) => (
                                        <option
                                            key={
                                                sucursal.id
                                            }
                                            value={
                                                sucursal.id
                                            }
                                        >
                                            {
                                                sucursal.nombre
                                            }
                                        </option>
                                    )
                                )}
                        </select>
                    </div>
                </div>

                {/* PRODUCTOS */}
                <div className="mt-6 border-t border-[var(--color-border)] pt-6">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <h3 className="text-sm font-semibold text-[var(--color-text)]">
                                Productos
                            </h3>
                            <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                                Agrega los productos y cantidades que deseas transferir.
                            </p>
                        </div>

                        {productosTraspaso.length >
                            0 && (
                                <span className="shrink-0 rounded-full bg-[var(--color-primary)]/10 px-3 py-1 text-xs font-semibold text-[var(--color-primary)]">
                                    {
                                        productosTraspaso.length
                                    }{" "}
                                    {productosTraspaso.length ===
                                        1
                                        ? "producto"
                                        : "productos"}
                                </span>
                            )}
                    </div>

                    {!sucursalOrigen && (
                        <div className="mt-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] p-4">
                            <div className="flex items-start gap-3">
                                <span
                                    className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--color-primary)]/10 text-[var(--color-primary)]"
                                    aria-hidden="true"
                                >
                                    →
                                </span>

                                <div>
                                    <p className="text-sm font-medium text-[var(--color-text)]">
                                        Selecciona la sucursal origen
                                    </p>
                                    <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                                        Después podrás consultar el inventario disponible para transferir.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {sucursalOrigen && (
                        <div className="mt-4 space-y-4">
                            {/* BUSCAR */}
                            <div>
                                <label
                                    htmlFor="buscar-producto"
                                    className="mb-2 block text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]"
                                >
                                    Buscar producto
                                </label>

                                <input
                                    id="buscar-producto"
                                    type="search"
                                    value={
                                        busquedaProducto
                                    }
                                    onChange={(e) =>
                                        setBusquedaProducto(
                                            e.target.value
                                        )
                                    }
                                    placeholder="Nombre, código de barras o SKU..."
                                    className="min-h-12 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm text-[var(--color-text)] outline-none transition placeholder:text-[var(--color-text-secondary)] focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[var(--color-primary)]/10"
                                />
                            </div>

                            {cargandoProductos && (
                                <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] p-4">
                                    <div className="flex items-center gap-3">
                                        <div
                                            className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--color-border)] border-t-[var(--color-primary)]"
                                            aria-hidden="true"
                                        />
                                        <p className="text-sm text-[var(--color-text-secondary)]">
                                            Cargando productos...
                                        </p>
                                    </div>
                                </div>
                            )}

                            {!cargandoProductos &&
                                productos.length ===
                                0 && (
                                    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] p-4">
                                        <p className="text-sm font-medium text-[var(--color-text)]">
                                            No hay productos disponibles
                                        </p>
                                        <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                                            Esta sucursal no tiene productos con stock disponible para transferir.
                                        </p>
                                    </div>
                                )}

                            {!cargandoProductos &&
                                productos.length >
                                0 &&
                                productosFiltrados.length ===
                                0 && (
                                    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] p-4">
                                        <p className="text-sm font-medium text-[var(--color-text)]">
                                            Sin resultados
                                        </p>
                                        <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                                            No encontramos productos que coincidan con tu búsqueda.
                                        </p>
                                    </div>
                                )}

                            {!cargandoProductos &&
                                productos.length >
                                0 &&
                                productosFiltrados.length >
                                0 && (
                                    <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_140px_auto]">
                                        <div>
                                            <label
                                                htmlFor="producto"
                                                className="sr-only"
                                            >
                                                Producto
                                            </label>

                                            <select
                                                id="producto"
                                                value={
                                                    productoSeleccionado
                                                }
                                                onChange={(
                                                    e
                                                ) =>
                                                    setProductoSeleccionado(
                                                        e
                                                            .target
                                                            .value
                                                    )
                                                }
                                                className="min-h-12 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[var(--color-primary)]/10"
                                            >
                                                <option value="">
                                                    Selecciona un producto
                                                </option>

                                                {productosFiltrados.map(
                                                    (
                                                        producto
                                                    ) => (
                                                        <option
                                                            key={
                                                                producto.producto_id
                                                            }
                                                            value={
                                                                producto.producto_id
                                                            }
                                                        >
                                                            {
                                                                producto.nombre
                                                            }{" "}
                                                            — Disponible:{" "}
                                                            {producto.stock -
                                                                producto.stock_reservado}
                                                        </option>
                                                    )
                                                )}
                                            </select>
                                        </div>

                                        <div>
                                            <label
                                                htmlFor="cantidad"
                                                className="sr-only"
                                            >
                                                Cantidad
                                            </label>

                                            <input
                                                id="cantidad"
                                                type="number"
                                                min="0.001"
                                                step="0.001"
                                                value={
                                                    cantidad
                                                }
                                                onChange={(
                                                    e
                                                ) =>
                                                    setCantidad(
                                                        e
                                                            .target
                                                            .value
                                                    )
                                                }
                                                placeholder="Cantidad"
                                                className="min-h-12 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm text-[var(--color-text)] outline-none transition placeholder:text-[var(--color-text-secondary)] focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[var(--color-primary)]/10"
                                            />
                                        </div>

                                        <button
                                            type="button"
                                            onClick={
                                                agregarProducto
                                            }
                                            className="min-h-12 rounded-xl bg-[var(--color-primary)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--color-primary-hover)] active:scale-[0.99]"
                                        >
                                            Agregar producto
                                        </button>
                                    </div>
                                )}

                            {/* LISTA */}
                            {productosTraspaso.length >
                                0 && (
                                    <div className="overflow-hidden rounded-2xl border border-[var(--color-border)]">
                                        <div className="hidden grid-cols-[1fr_150px_140px_90px] border-b border-[var(--color-border)] bg-[var(--color-background)] px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)] md:grid">
                                            <span>
                                                Producto
                                            </span>
                                            <span>
                                                Disponible
                                            </span>
                                            <span>
                                                Cantidad
                                            </span>
                                            <span />
                                        </div>

                                        <div className="divide-y divide-[var(--color-border)]">
                                            {productosTraspaso.map(
                                                (
                                                    producto
                                                ) => (
                                                    <div
                                                        key={
                                                            producto.producto_id
                                                        }
                                                        className="grid grid-cols-1 gap-4 px-4 py-4 md:grid-cols-[1fr_150px_140px_90px] md:items-center"
                                                    >
                                                        <div>
                                                            <p className="font-medium text-[var(--color-text)]">
                                                                {
                                                                    producto.nombre
                                                                }
                                                            </p>
                                                            <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                                                                Unidad:{" "}
                                                                {
                                                                    producto.unidad
                                                                }
                                                            </p>
                                                        </div>

                                                        <div className="flex items-center justify-between rounded-xl bg-[var(--color-background)] px-3 py-2 md:block md:bg-transparent md:px-0 md:py-0">
                                                            <span className="text-xs font-medium text-[var(--color-text-secondary)] md:hidden">
                                                                Disponible
                                                            </span>

                                                            <span className="text-sm font-semibold text-[var(--color-text)]">
                                                                {
                                                                    producto.stock_disponible
                                                                }
                                                            </span>
                                                        </div>

                                                        <div>
                                                            <label
                                                                htmlFor={`cantidad - ${producto.producto_id} `}
                                                                className="mb-1.5 block text-xs font-medium text-[var(--color-text-secondary)] md:hidden"
                                                            >
                                                                Cantidad
                                                            </label>

                                                            <input
                                                                id={`cantidad - ${producto.producto_id} `}
                                                                type="number"
                                                                min="0.001"
                                                                max={
                                                                    producto.stock_disponible
                                                                }
                                                                step="0.001"
                                                                value={
                                                                    producto.cantidad
                                                                }
                                                                onChange={(
                                                                    e
                                                                ) =>
                                                                    cambiarCantidadProducto(
                                                                        producto.producto_id,
                                                                        Number(
                                                                            e
                                                                                .target
                                                                                .value
                                                                        )
                                                                    )
                                                                }
                                                                className="min-h-11 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/10"
                                                            />
                                                        </div>

                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                eliminarProducto(
                                                                    producto.producto_id
                                                                )
                                                            }
                                                            className="min-h-11 rounded-xl border border-[var(--color-danger)]/20 px-3 py-2 text-sm font-semibold text-[var(--color-danger)] transition hover:bg-[var(--color-danger-soft)] active:scale-[0.99]"
                                                        >
                                                            Eliminar
                                                        </button>
                                                    </div>
                                                )
                                            )}
                                        </div>
                                    </div>
                                )}
                        </div>
                    )}
                </div>

                {/* NOTAS */}
                <div className="mt-6">
                    <label
                        htmlFor="notas"
                        className="mb-2 block text-sm font-medium text-[var(--color-text)]"
                    >
                        Notas
                    </label>

                    <textarea
                        id="notas"
                        value={notas}
                        onChange={(e) =>
                            setNotas(
                                e.target.value
                            )
                        }
                        rows={3}
                        placeholder="Notas opcionales del traspaso..."
                        className="w-full resize-none rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm text-[var(--color-text)] outline-none transition placeholder:text-[var(--color-text-secondary)] focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[var(--color-primary)]/10"
                    />
                </div>

                {/* RESUMEN */}
                {productosTraspaso.length >
                    0 && (
                        <div className="mt-6 rounded-2xl border border-[var(--color-primary)]/15 bg-[var(--color-primary)]/5 p-4">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    <p className="text-sm font-semibold text-[var(--color-text)]">
                                        Traspaso listo para realizar
                                    </p>
                                    <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                                        {
                                            productosTraspaso.length
                                        }{" "}
                                        {productosTraspaso.length ===
                                            1
                                            ? "producto seleccionado"
                                            : "productos seleccionados"}
                                    </p>
                                </div>

                                <div className="text-sm font-semibold text-[var(--color-primary)]">
                                    {
                                        sucursales.find(
                                            (sucursal) =>
                                                sucursal.id ===
                                                sucursalOrigen
                                        )?.nombre
                                    }{" "}
                                    →{" "}
                                    {
                                        sucursales.find(
                                            (sucursal) =>
                                                sucursal.id ===
                                                sucursalDestino
                                        )?.nombre
                                    }
                                </div>
                            </div>
                        </div>
                    )}

                {/* BOTÓN */}
                <div className="mt-6 flex justify-end">
                    <button
                        type="button"
                        disabled={
                            guardando ||
                            productosTraspaso.length ===
                            0
                        }
                        onClick={
                            realizarTraspaso
                        }
                        className="min-h-12 w-full rounded-xl bg-[var(--color-primary)] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[var(--color-primary-hover)] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                    >
                        {guardando
                            ? "Realizando traspaso..."
                            : "Realizar traspaso"}
                    </button>
                </div>
            </Card>

            {/* HISTORIAL */}
            <Card className="overflow-hidden">
                <div className="border-b border-[var(--color-border)] p-5 sm:p-6">
                    <div className="flex items-start gap-3">
                        <div
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-background)] text-[var(--color-primary)]"
                            aria-hidden="true"
                        >
                            <svg
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                className="h-5 w-5"
                            >
                                <path d="M3 12h18" />
                                <path d="M12 3v18" />
                            </svg>
                        </div>

                        <div>
                            <h2 className="text-lg font-semibold text-[var(--color-text)]">
                                Historial de traspasos
                            </h2>
                            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                                Consulta las transferencias realizadas entre sucursales.
                            </p>
                        </div>
                    </div>
                </div>

                {traspasos.length ===
                    0 ? (
                    <div className="p-8 text-center sm:p-10">
                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--color-background)] text-[var(--color-text-secondary)]">
                            <svg
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.8"
                                className="h-6 w-6"
                                aria-hidden="true"
                            >
                                <path d="M7 7h10" />
                                <path d="m13 3 4 4-4 4" />
                                <path d="M17 17H7" />
                                <path d="m11 13-4 4 4 4" />
                            </svg>
                        </div>

                        <p className="mt-4 text-sm font-medium text-[var(--color-text)]">
                            Todavía no hay traspasos registrados.
                        </p>

                        <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                            Los traspasos realizados aparecerán aquí.
                        </p>
                    </div>
                ) : (
                    <>
                        {/* VISTA MÓVIL */}
                        <div className="divide-y divide-[var(--color-border)] md:hidden">
                            {traspasos.map(
                                (
                                    traspaso
                                ) => (
                                    <div
                                        key={
                                            traspaso.id
                                        }
                                        className="space-y-4 p-5"
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <p className="text-sm font-semibold text-[var(--color-text)]">
                                                    {formatearFecha(
                                                        traspaso.created_at
                                                    )}
                                                </p>
                                                <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                                                    Por{" "}
                                                    {traspaso
                                                        .usuario
                                                        ?.nombre ??
                                                        "Usuario no disponible"}
                                                </p>
                                            </div>

                                            <span className="shrink-0 rounded-full bg-[var(--color-success)]/10 px-3 py-1 text-xs font-semibold capitalize text-[var(--color-success)]">
                                                {
                                                    traspaso.estado
                                                }
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-1 gap-2">
                                            <div className="rounded-xl bg-[var(--color-background)] p-3">
                                                <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
                                                    Origen
                                                </p>
                                                <p className="mt-1 text-sm font-semibold text-[var(--color-text)]">
                                                    {traspaso
                                                        .sucursal_origen
                                                        ?.nombre ??
                                                        "No disponible"}
                                                </p>
                                            </div>

                                            <div className="flex justify-center text-[var(--color-primary)]">
                                                ↓
                                            </div>

                                            <div className="rounded-xl bg-[var(--color-background)] p-3">
                                                <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
                                                    Destino
                                                </p>
                                                <p className="mt-1 text-sm font-semibold text-[var(--color-text)]">
                                                    {traspaso
                                                        .sucursal_destino
                                                        ?.nombre ??
                                                        "No disponible"}
                                                </p>
                                            </div>
                                        </div>

                                        <div>
                                            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
                                                Productos
                                            </p>

                                            <div className="space-y-2">
                                                {traspaso.detalle_traspasos.map(
                                                    (
                                                        detalle,
                                                        index
                                                    ) => (
                                                        <div
                                                            key={
                                                                index
                                                            }
                                                            className="flex items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5"
                                                        >
                                                            <span className="min-w-0 text-sm text-[var(--color-text)]">
                                                                {detalle
                                                                    .producto
                                                                    ?.nombre ??
                                                                    "Producto no disponible"}
                                                            </span>

                                                            <span className="shrink-0 text-sm font-semibold text-[var(--color-text)]">
                                                                ×{" "}
                                                                {
                                                                    detalle.cantidad
                                                                }{" "}
                                                                {detalle
                                                                    .producto
                                                                    ?.unidad ??
                                                                    ""}
                                                            </span>
                                                        </div>
                                                    )
                                                )}
                                            </div>
                                        </div>

                                        {traspaso.notas && (
                                            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] p-3">
                                                <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
                                                    Notas
                                                </p>
                                                <p className="mt-1 text-sm text-[var(--color-text)]">
                                                    {
                                                        traspaso.notas
                                                    }
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                )
                            )}
                        </div>

                        {/* VISTA ESCRITORIO */}
                        <div className="hidden overflow-x-auto md:block">
                            <table className="w-full min-w-[900px] text-left">
                                <thead className="border-b border-[var(--color-border)] bg-[var(--color-background)]">
                                    <tr>
                                        <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
                                            Fecha
                                        </th>

                                        <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
                                            Origen
                                        </th>

                                        <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
                                            Destino
                                        </th>

                                        <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
                                            Productos
                                        </th>

                                        <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
                                            Usuario
                                        </th>

                                        <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
                                            Estado
                                        </th>
                                    </tr>
                                </thead>

                                <tbody className="divide-y divide-[var(--color-border)]">
                                    {traspasos.map(
                                        (
                                            traspaso
                                        ) => (
                                            <tr
                                                key={
                                                    traspaso.id
                                                }
                                                className="transition hover:bg-[var(--color-background)]"
                                            >
                                                <td className="px-5 py-4 text-sm text-[var(--color-text)]">
                                                    {formatearFecha(
                                                        traspaso.created_at
                                                    )}
                                                </td>

                                                <td className="px-5 py-4 text-sm font-medium text-[var(--color-text)]">
                                                    {traspaso
                                                        .sucursal_origen
                                                        ?.nombre ??
                                                        "No disponible"}
                                                </td>

                                                <td className="px-5 py-4 text-sm font-medium text-[var(--color-text)]">
                                                    {traspaso
                                                        .sucursal_destino
                                                        ?.nombre ??
                                                        "No disponible"}
                                                </td>

                                                <td className="px-5 py-4">
                                                    <div className="max-w-sm space-y-1.5">
                                                        {traspaso.detalle_traspasos.map(
                                                            (
                                                                detalle,
                                                                index
                                                            ) => (
                                                                <p
                                                                    key={
                                                                        index
                                                                    }
                                                                    className="text-sm text-[var(--color-text)]"
                                                                >
                                                                    {detalle
                                                                        .producto
                                                                        ?.nombre ??
                                                                        "Producto no disponible"}{" "}
                                                                    ×{" "}
                                                                    {
                                                                        detalle.cantidad
                                                                    }{" "}
                                                                    {
                                                                        detalle
                                                                            .producto
                                                                            ?.unidad
                                                                    }
                                                                </p>
                                                            )
                                                        )}
                                                    </div>
                                                </td>

                                                <td className="px-5 py-4 text-sm text-[var(--color-text-secondary)]">
                                                    {traspaso
                                                        .usuario
                                                        ?.nombre ??
                                                        "No disponible"}
                                                </td>

                                                <td className="px-5 py-4">
                                                    <span className="inline-flex rounded-full bg-[var(--color-success)]/10 px-3 py-1 text-xs font-semibold capitalize text-[var(--color-success)]">
                                                        {
                                                            traspaso.estado
                                                        }
                                                    </span>
                                                </td>
                                            </tr>
                                        )
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
            </Card>

            <ModalMensaje
                abierto={
                    modalMensajeAbierto
                }
                tipo={tipoMensaje}
                titulo={
                    tituloMensaje
                }
                mensaje={
                    textoMensaje
                }
                textoBoton="Aceptar"
                onCerrar={
                    cerrarModalMensaje
                }
            />
        </div>
    );
}
