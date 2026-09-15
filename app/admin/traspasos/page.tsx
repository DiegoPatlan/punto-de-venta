"use client";

import { useEffect, useMemo, useState } from "react";
import Card from "../../components/Card";
import { supabase } from "../../../lib/supabase";
import { obtenerUsuarioActual } from "../../../lib/auth/roleGuard";

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

interface UsuarioActual {
    id: string;
    negocio_id: string | null;
    nombre: string;
    rol: string;
}

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

    const [error, setError] = useState("");
    const [mensajeExito, setMensajeExito] = useState("");

    /*
     * ==========================================
     * CARGAR DATOS
     * ==========================================
     */

    async function cargarDatos() {
        setCargando(true);
        setError("");

        try {
            const usuario =
                (await obtenerUsuarioActual()) as UsuarioActual | null;

            if (!usuario?.negocio_id) {
                setError(
                    "No se encontró el negocio del usuario."
                );
                return;
            }

            // ==========================================
            // 1. SUCURSALES
            // ==========================================

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
                console.error(
                    "Error cargando sucursales:",
                    errorSucursales
                );

                setError(
                    "No se pudieron cargar las sucursales."
                );

                return;
            }

            setSucursales(
                (sucursalesData ?? []) as Sucursal[]
            );

            // ==========================================
            // 2. TRASPASOS
            // ==========================================

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
                console.error(
                    "Error cargando traspasos:",
                    errorTraspasos
                );

                setError(
                    "No se pudo cargar el historial de traspasos."
                );

                return;
            }

            console.log(
                "Traspasos encontrados:",
                traspasosData
            );

            if (
                !traspasosData ||
                traspasosData.length === 0
            ) {
                setTraspasos([]);
                return;
            }

            // ==========================================
            // 3. IDS DE TRASPASOS
            // ==========================================

            const traspasoIds =
                traspasosData.map(
                    (traspaso) =>
                        traspaso.id
                );

            // ==========================================
            // 4. DETALLES DE TRASPASOS
            // ==========================================

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
                console.error(
                    "Error cargando detalles de traspasos:",
                    errorDetalles
                );

                setError(
                    "No se pudieron cargar los productos de los traspasos."
                );

                return;
            }

            // ==========================================
            // 5. PRODUCTOS
            // ==========================================

            const productoIds = [
                ...new Set(
                    (detallesData ?? []).map(
                        (detalle) =>
                            detalle.producto_id
                    )
                ),
            ];

            let productosData: any[] = [];

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
                    console.error(
                        "Error cargando productos:",
                        errorProductos
                    );

                    setError(
                        "No se pudieron cargar los productos de los traspasos."
                    );

                    return;
                }

                productosData =
                    data ?? [];
            }

            // ==========================================
            // 6. USUARIOS
            // ==========================================

            const usuarioIds = [
                ...new Set(
                    traspasosData.map(
                        (traspaso) =>
                            traspaso.usuario_id
                    )
                ),
            ];

            let usuariosData: any[] = [];

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
                    console.error(
                        "Error cargando usuarios:",
                        errorUsuarios
                    );

                    setError(
                        "No se pudieron cargar los usuarios de los traspasos."
                    );

                    return;
                }

                usuariosData =
                    data ?? [];
            }

            // ==========================================
            // 7. ARMAR HISTORIAL
            // ==========================================

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

            console.log(
                "Historial de traspasos armado:",
                historial
            );

            setTraspasos(historial);

        } catch (error) {

            console.error(
                "Error inesperado cargando datos:",
                error
            );

            setError(
                "Ocurrió un error al cargar los datos."
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
                    producto:productos(
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
                console.error(
                    "Error cargando productos:",
                    errorInventario
                );

                setError(
                    "No se pudieron cargar los productos."
                );

                return;
            }

            const productosFormateados: Producto[] =
                (data ?? [])
                    .map((item: any) => ({
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
                            Number(item.stock ?? 0),

                        stock_reservado:
                            Number(
                                item.stock_reservado ?? 0
                            ),
                    }))
                    .filter(
                        (producto) =>
                            producto.stock -
                            producto.stock_reservado >
                            0
                    );

            setProductos(
                productosFormateados
            );

        } catch (error) {

            console.error(
                "Error inesperado cargando productos:",
                error
            );

            setError(
                "Ocurrió un error al cargar los productos."
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
            setError(
                "Selecciona un producto."
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
            setError(
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
            setError(
                "No se encontró el producto."
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
            setError(
                `Stock insuficiente. Disponible: ${stockDisponible}.`
            );
            return;
        }

        setError("");

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
        setError("");
        setMensajeExito("");

        if (!sucursalOrigen) {
            setError(
                "Selecciona la sucursal origen."
            );
            return;
        }

        if (!sucursalDestino) {
            setError(
                "Selecciona la sucursal destino."
            );
            return;
        }

        if (
            sucursalOrigen ===
            sucursalDestino
        ) {
            setError(
                "La sucursal origen y destino deben ser diferentes."
            );
            return;
        }

        if (
            productosTraspaso.length ===
            0
        ) {
            setError(
                "Agrega al menos un producto al traspaso."
            );
            return;
        }

        const usuario =
            (await obtenerUsuarioActual()) as UsuarioActual | null;

        if (
            !usuario?.id ||
            !usuario.negocio_id
        ) {
            setError(
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
                console.error(
                    "Error realizando traspaso:",
                    errorRPC
                );

                setError(
                    errorRPC.message ||
                    "No se pudo realizar el traspaso."
                );

                return;
            }

            console.log(
                "Traspaso creado:",
                data
            );

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

            setMensajeExito(
                `Traspaso realizado correctamente. ${cantidadProductos} ${cantidadProductos === 1
                    ? "producto"
                    : "productos"
                } fueron transferidos de ${nombreOrigen} a ${nombreDestino}.`
            );

            setSucursalOrigen("");
            setSucursalDestino("");
            setProductos([]);
            setProductosTraspaso([]);
            setProductoSeleccionado("");
            setCantidad("");
            setNotas("");
            setBusquedaProducto("");

            await cargarDatos();

        } catch (error) {

            console.error(
                "Error inesperado realizando traspaso:",
                error
            );

            setError(
                "Ocurrió un error al realizar el traspaso."
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
                    <p className="text-center text-sm text-[var(--color-text-secondary)]">
                        Cargando traspasos...
                    </p>
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

            {/* MENSAJE ÉXITO */}

            {mensajeExito && (
                <div className="rounded-2xl border border-green-200 bg-green-50 p-4">
                    <div className="flex items-start gap-3">
                        <span className="text-xl">
                            ✅
                        </span>

                        <div>
                            <p className="font-semibold text-green-800">
                                Traspaso realizado correctamente
                            </p>

                            <p className="mt-1 text-sm text-green-700">
                                {mensajeExito}
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={() =>
                                setMensajeExito("")
                            }
                            className="ml-auto text-green-700 hover:text-green-900"
                        >
                            ×
                        </button>
                    </div>
                </div>
            )}

            {/* ERROR */}

            {error && (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
                    <div className="flex items-start gap-3">
                        <span className="text-xl">
                            ⚠️
                        </span>

                        <p className="text-sm text-red-700">
                            {error}
                        </p>

                        <button
                            type="button"
                            onClick={() =>
                                setError("")
                            }
                            className="ml-auto text-red-700 hover:text-red-900"
                        >
                            ×
                        </button>
                    </div>
                </div>
            )}

            {/* NUEVO TRASPASO */}

            <Card className="p-5 sm:p-6">

                <div className="mb-6">
                    <h2 className="text-lg font-semibold text-[var(--color-text)]">
                        Nuevo traspaso
                    </h2>

                    <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                        Selecciona las sucursales y los productos que deseas transferir.
                    </p>
                </div>

                {/* SUCURSALES */}

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">

                    <div>
                        <label className="mb-2 block text-sm font-medium text-[var(--color-text)]">
                            Sucursal origen
                        </label>

                        <select
                            value={
                                sucursalOrigen
                            }
                            onChange={(e) =>
                                cambiarSucursalOrigen(
                                    e.target.value
                                )
                            }
                            className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-4 focus:ring-blue-100"
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
                        <label className="mb-2 block text-sm font-medium text-[var(--color-text)]">
                            Sucursal destino
                        </label>

                        <select
                            value={
                                sucursalDestino
                            }
                            onChange={(e) =>
                                setSucursalDestino(
                                    e.target.value
                                )
                            }
                            className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-4 focus:ring-blue-100"
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

                    <h3 className="text-sm font-semibold text-[var(--color-text)]">
                        Productos
                    </h3>

                    {!sucursalOrigen && (
                        <p className="mt-3 rounded-xl bg-slate-50 p-4 text-sm text-[var(--color-text-secondary)]">
                            Selecciona primero la sucursal origen.
                        </p>
                    )}

                    {sucursalOrigen && (
                        <div className="mt-4 space-y-4">

                            {/* BUSCAR */}

                            <input
                                type="search"
                                value={
                                    busquedaProducto
                                }
                                onChange={(e) =>
                                    setBusquedaProducto(
                                        e.target.value
                                    )
                                }
                                placeholder="Buscar producto, código o SKU..."
                                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-4 focus:ring-blue-100"
                            />

                            {cargandoProductos && (
                                <p className="text-sm text-[var(--color-text-secondary)]">
                                    Cargando productos...
                                </p>
                            )}

                            {!cargandoProductos &&
                                productos.length ===
                                0 && (
                                    <div className="rounded-xl bg-slate-50 p-4 text-sm text-[var(--color-text-secondary)]">
                                        No hay productos con stock disponible en esta sucursal.
                                    </div>
                                )}

                            {!cargandoProductos &&
                                productos.length >
                                0 && (
                                    <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_140px_auto]">

                                        <select
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
                                            className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-4 focus:ring-blue-100"
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

                                        <input
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
                                            className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-4 focus:ring-blue-100"
                                        />

                                        <button
                                            type="button"
                                            onClick={
                                                agregarProducto
                                            }
                                            className="rounded-xl bg-[var(--color-primary)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--color-primary-hover)]"
                                        >
                                            Agregar
                                        </button>

                                    </div>
                                )}

                            {/* LISTA */}

                            {productosTraspaso.length >
                                0 && (
                                    <div className="overflow-hidden rounded-2xl border border-[var(--color-border)]">

                                        <div className="hidden grid-cols-[1fr_150px_140px_60px] border-b border-[var(--color-border)] bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)] md:grid">
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
                                                        className="grid grid-cols-1 gap-3 px-4 py-4 md:grid-cols-[1fr_150px_140px_60px] md:items-center"
                                                    >

                                                        <div>
                                                            <p className="font-medium text-[var(--color-text)]">
                                                                {
                                                                    producto.nombre
                                                                }
                                                            </p>

                                                            <p className="text-xs text-[var(--color-text-secondary)]">
                                                                {
                                                                    producto.unidad
                                                                }
                                                            </p>
                                                        </div>

                                                        <div>
                                                            <span className="text-sm text-[var(--color-text-secondary)]">
                                                                {
                                                                    producto.stock_disponible
                                                                }
                                                            </span>
                                                        </div>

                                                        <input
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
                                                            className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]"
                                                        />

                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                eliminarProducto(
                                                                    producto.producto_id
                                                                )
                                                            }
                                                            className="rounded-xl px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
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

                    <label className="mb-2 block text-sm font-medium text-[var(--color-text)]">
                        Notas
                    </label>

                    <textarea
                        value={notas}
                        onChange={(e) =>
                            setNotas(
                                e.target.value
                            )
                        }
                        rows={3}
                        placeholder="Notas opcionales del traspaso..."
                        className="w-full resize-none rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-4 focus:ring-blue-100"
                    />

                </div>

                {/* BOTÓN */}

                <div className="mt-6 flex justify-end">

                    <button
                        type="button"
                        disabled={guardando}
                        onClick={
                            realizarTraspaso
                        }
                        className="w-full rounded-xl bg-[var(--color-primary)] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[var(--color-primary-hover)] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                    >
                        {guardando
                            ? "Realizando traspaso..."
                            : "Realizar traspaso"}
                    </button>

                </div>

            </Card>

            {/* HISTORIAL */}

            <Card className="overflow-hidden">

                <div className="border-b border-[var(--color-border)] p-5">

                    <h2 className="text-lg font-semibold text-[var(--color-text)]">
                        Historial de traspasos
                    </h2>

                    <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                        Consulta las transferencias realizadas entre sucursales.
                    </p>

                </div>

                {traspasos.length === 0 ? (
                    <div className="p-8 text-center">
                        <p className="text-sm text-[var(--color-text-secondary)]">
                            Todavía no hay traspasos registrados.
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">

                        <table className="w-full text-left">

                            <thead className="border-b border-[var(--color-border)] bg-slate-50">

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
                                    (traspaso) => (
                                        <tr
                                            key={
                                                traspaso.id
                                            }
                                            className="hover:bg-slate-50"
                                        >

                                            <td className="px-5 py-4 text-sm text-[var(--color-text)]">
                                                {formatearFecha(
                                                    traspaso.created_at
                                                )}
                                            </td>

                                            <td className="px-5 py-4 text-sm font-medium text-[var(--color-text)]">
                                                {
                                                    traspaso
                                                        .sucursal_origen
                                                        ?.nombre
                                                }
                                            </td>

                                            <td className="px-5 py-4 text-sm font-medium text-[var(--color-text)]">
                                                {
                                                    traspaso
                                                        .sucursal_destino
                                                        ?.nombre
                                                }
                                            </td>

                                            <td className="px-5 py-4">

                                                <div className="space-y-1">

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
                                                                {
                                                                    detalle
                                                                        .producto
                                                                        ?.nombre
                                                                }{" "}
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
                                                {
                                                    traspaso
                                                        .usuario
                                                        ?.nombre
                                                }
                                            </td>

                                            <td className="px-5 py-4">

                                                <span className="inline-flex rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
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
                )}

            </Card>

        </div>
    );
}