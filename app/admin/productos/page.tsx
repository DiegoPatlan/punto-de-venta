"use client";

import { useEffect, useState } from "react";
import Card from "../../components/Card";
import { supabase } from "../../../lib/supabase";
import { obtenerUsuarioActual } from "../../../lib/usuario";

interface Producto {
    id: string;
    nombre: string;
    descripcion: string | null;
    codigo_barras: string | null;
    sku: string | null;
    precio_compra: number;
    precio_venta: number;
    unidad: string;
    imagen_url: string | null;
    stock_minimo: number;
    activo: boolean;
}

export default function ProductosPage() {
    const [productos, setProductos] = useState<Producto[]>([]);
    const [busqueda, setBusqueda] = useState("");
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState("");
    const [modalNuevo, setModalNuevo] = useState(false);
    const [categorias, setCategorias] = useState<
        { id: string; nombre: string }[]
    >([]);

    const [cargandoCategorias, setCargandoCategorias] = useState(false);
    const [guardandoProducto, setGuardandoProducto] = useState(false);

    const [formProducto, setFormProducto] = useState({
        nombre: "",
        codigo_barras: "",
        sku: "",
        categoria_id: "",
        unidad: "pieza",
        precio_compra: "",
        precio_venta: "",
        stock_inicial: "0",
        stock_minimo: "0",
        imagen_url: "",
        descripcion: "",
        activo: true,
        sucursales_ids: [] as string[],
    });

    const [sucursales, setSucursales] = useState<
        {
            id: string;
            nombre: string;
        }[]
    >([]);

    const [modalEditar, setModalEditar] = useState(false);
    const [productoEditando, setProductoEditando] = useState<any | null>(null);
    const [guardandoEdicion, setGuardandoEdicion] = useState(false);

    const [mensajeExito, setMensajeExito] = useState("");

    // Mensajes internos para sustituir alert()
    const [mensajeModal, setMensajeModal] = useState({
        abierto: false,
        tipo: "error" as "error" | "warning" | "success",
        titulo: "",
        mensaje: "",
    });

    function mostrarMensaje(
        titulo: string,
        mensaje: string,
        tipo: "error" | "warning" | "success" = "error"
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

    async function cargarSucursales() {
        try {
            const usuario = await obtenerUsuarioActual();

            if (!usuario?.negocio_id) {
                return;
            }

            const { data, error } = await supabase
                .from("sucursales")
                .select(`
                    id,
                    nombre
                `)
                .eq("negocio_id", usuario.negocio_id)
                .eq("activo", true)
                .order("nombre", {
                    ascending: true,
                });

            if (error) {
                console.error(
                    "Error cargando sucursales:",
                    error
                );

                return;
            }

            setSucursales(data ?? []);
        } catch (error) {
            console.error(
                "Error inesperado cargando sucursales:",
                error
            );
        }
    }

    async function cargarCategorias() {
        setCargandoCategorias(true);

        try {
            const usuario = await obtenerUsuarioActual();

            if (!usuario?.negocio_id) {
                console.error("No se encontró negocio_id del usuario.");
                return;
            }

            const { data, error } = await supabase
                .from("categorias")
                .select("id, nombre")
                .eq("negocio_id", usuario.negocio_id)
                .eq("activo", true)
                .order("nombre", {
                    ascending: true,
                });

            if (error) {
                console.error(
                    "Error al cargar categorías:",
                    error
                );
                return;
            }

            setCategorias(data ?? []);
        } catch (error) {
            console.error(
                "Error inesperado al cargar categorías:",
                error
            );
        } finally {
            setCargandoCategorias(false);
        }
    }

    function actualizarCampo(
        campo: keyof typeof formProducto,
        valor: string
    ) {
        setFormProducto((actual) => ({
            ...actual,
            [campo]: valor,
        }));
    }

    async function abrirEditarProducto(producto: any) {

        await cargarCategorias();

        setProductoEditando({
            id: producto.id,
            nombre: producto.nombre || "",
            codigo_barras: producto.codigo_barras || "",
            sku: producto.sku || "",
            categoria_id: producto.categoria_id || "",
            unidad: producto.unidad || "pieza",

            precio_compra:
                producto.precio_compra ?? "",

            precio_venta:
                producto.precio_base ?? "",

            stock_minimo:
                producto.stock_minimo ?? 0,

            imagen_url:
                producto.imagen_url || "",

            descripcion:
                producto.descripcion || "",

            activo:
                producto.activo ?? true,
        });

        setModalEditar(true);
    }

    async function actualizarProducto() {
        if (!productoEditando) return;

        if (!productoEditando.nombre.trim()) {
            mostrarMensaje(
                "Nombre obligatorio",
                "El nombre del producto es obligatorio.",
                "warning"
            );
            return;
        }

        if (
            productoEditando.precio_venta === "" ||
            Number(productoEditando.precio_venta) < 0
        ) {
            mostrarMensaje(
                "Precio inválido",
                "Ingresa un precio válido.",
                "warning"
            );
            return;
        }

        const precioBase = Number(
            productoEditando.precio_venta
        );

        const precioCompra =
            productoEditando.precio_compra === ""
                ? 0
                : Number(productoEditando.precio_compra);

        const stockMinimo =
            productoEditando.stock_minimo === ""
                ? 0
                : Number(productoEditando.stock_minimo);

        if (
            precioBase < 0 ||
            precioCompra < 0 ||
            stockMinimo < 0
        ) {
            mostrarMensaje(
                "Valores inválidos",
                "Los valores numéricos no pueden ser negativos.",
                "warning"
            );
            return;
        }

        try {
            setGuardandoEdicion(true);

            const {
                data: productoActualizado,
                error,
            } = await supabase
                .from("productos")
                .update({
                    nombre:
                        productoEditando.nombre.trim(),

                    codigo_barras:
                        productoEditando.codigo_barras.trim() ||
                        null,

                    sku:
                        productoEditando.sku.trim() ||
                        null,

                    categoria_id:
                        productoEditando.categoria_id ||
                        null,

                    unidad:
                        productoEditando.unidad,

                    precio_compra:
                        precioCompra,

                    precio_base:
                        precioBase,

                    stock_minimo:
                        stockMinimo,

                    imagen_url:
                        productoEditando.imagen_url.trim() ||
                        null,

                    descripcion:
                        productoEditando.descripcion.trim() ||
                        null,

                    activo:
                        productoEditando.activo,

                    updated_at:
                        new Date().toISOString(),
                })
                .eq(
                    "id",
                    productoEditando.id
                )
                .select(`
                    id,
                    nombre,
                    descripcion,
                    codigo_barras,
                    sku,
                    categoria_id,
                    precio_compra,
                    precio_base,
                    precio_venta,
                    unidad,
                    imagen_url,
                    stock_minimo,
                    activo
                `)
                .single();

            if (error) {
                console.error(
                    "Error actualizando producto:",
                    error
                );

                mostrarMensaje(
                    "No se pudo actualizar",
                    "No se pudo actualizar el producto.",
                    "error"
                );

                return;
            }

            setProductos((actuales: any[]) =>
                actuales.map((producto) =>
                    producto.id === productoEditando.id
                        ? productoActualizado
                        : producto
                )
            );

            setModalEditar(false);
            setProductoEditando(null);

            setMensajeExito(
                "Producto modificado correctamente."
            );

            setTimeout(() => {
                setMensajeExito("");
            }, 3000);
        } catch (error) {
            console.error(
                "Error actualizando producto:",
                error
            );

            mostrarMensaje(
                "Error inesperado",
                "Ocurrió un error al actualizar el producto.",
                "error"
            );
        } finally {
            setGuardandoEdicion(false);
        }
    }

    async function guardarProducto() {
        if (!formProducto.nombre.trim()) {
            mostrarMensaje(
                "Nombre obligatorio",
                "El nombre del producto es obligatorio.",
                "warning"
            );
            return;
        }

        if (!formProducto.precio_venta) {
            mostrarMensaje(
                "Precio obligatorio",
                "El precio de venta es obligatorio.",
                "warning"
            );
            return;
        }

        const precioVenta = Number(formProducto.precio_venta);
        const precioCompra = Number(
            formProducto.precio_compra || 0
        );
        const stockInicial = Number(
            formProducto.stock_inicial || 0
        );
        const stockMinimo = Number(
            formProducto.stock_minimo || 0
        );

        if (
            precioVenta < 0 ||
            precioCompra < 0 ||
            stockInicial < 0 ||
            stockMinimo < 0
        ) {
            mostrarMensaje(
                "Valores inválidos",
                "Los valores numéricos no pueden ser negativos.",
                "warning"
            );
            return;
        }

        setGuardandoProducto(true);

        try {
            const usuario = await obtenerUsuarioActual();

            if (!usuario?.negocio_id) {
                mostrarMensaje(
                    "Negocio no encontrado",
                    "No se encontró el negocio del usuario.",
                    "error"
                );
                return;
            }

            const {
                data: producto,
                error: errorProducto,
            } = await supabase
                .from("productos")
                .insert({
                    negocio_id: usuario.negocio_id,
                    categoria_id:
                        formProducto.categoria_id || null,

                    codigo_barras:
                        formProducto.codigo_barras.trim() ||
                        null,

                    sku:
                        formProducto.sku.trim() ||
                        null,

                    nombre:
                        formProducto.nombre.trim(),

                    descripcion:
                        formProducto.descripcion.trim() ||
                        null,

                    precio_compra:
                        precioCompra,

                    precio_base:
                        precioVenta,

                    precio_venta:
                        precioVenta,

                    unidad:
                        formProducto.unidad,

                    imagen_url:
                        formProducto.imagen_url.trim() ||
                        null,

                    stock_minimo:
                        stockMinimo,

                    activo: true,
                })
                .select("id")
                .single();

            if (errorProducto) {
                console.error(
                    "Error creando producto:",
                    errorProducto
                );

                if (errorProducto.code === "23505") {
                    mostrarMensaje(
                        "Código de barras duplicado",
                        "Ya existe un producto con ese código de barras en este negocio.",
                        "warning"
                    );
                } else {
                    mostrarMensaje(
                        "No se pudo guardar",
                        "No se pudo guardar el producto.",
                        "error"
                    );
                }

                return;
            }

            if (
                formProducto.sucursales_ids.length === 0
            ) {
                mostrarMensaje(
                    "Sucursal requerida",
                    "Debes seleccionar al menos una sucursal.",
                    "warning"
                );

                return;
            }

            if (
                formProducto.sucursales_ids.length > 0
            ) {
                const registrosInventario =
                    formProducto.sucursales_ids.map(
                        (sucursalId) => ({
                            producto_id:
                                producto.id,

                            sucursal_id:
                                sucursalId,

                            stock:
                                stockInicial,

                            stock_reservado:
                                0,
                        })
                    );

                const {
                    error: errorInventario,
                } = await supabase
                    .from("inventario")
                    .insert(
                        registrosInventario
                    );

                if (errorInventario) {
                    console.error(
                        "Error creando inventario:",
                        errorInventario
                    );

                    await supabase
                        .from("productos")
                        .delete()
                        .eq(
                            "id",
                            producto.id
                        );

                    mostrarMensaje(
                        "No se pudo crear el inventario",
                        "No se pudo crear el inventario del producto.",
                        "error"
                    );

                    return;
                }
            }

            await cargarProductos();

            setFormProducto({
                nombre: "",
                codigo_barras: "",
                sku: "",
                categoria_id: "",
                unidad: "pieza",
                precio_compra: "",
                precio_venta: "",
                stock_inicial: "0",
                stock_minimo: "0",
                imagen_url: "",
                descripcion: "",
                activo: true,
                sucursales_ids: [],
            });

            setModalNuevo(false);

            setMensajeExito(
                "Producto creado correctamente."
            );

            setTimeout(() => {
                setMensajeExito("");
            }, 3000);
        } catch (error) {
            console.error(
                "Error inesperado guardando producto:",
                error
            );

            mostrarMensaje(
                "Error inesperado",
                "Ocurrió un error inesperado al guardar el producto.",
                "error"
            );
        } finally {
            setGuardandoProducto(false);
        }
    }

    useEffect(() => {
        cargarProductos();
        cargarSucursales();
    }, []);

    useEffect(() => {
        if (modalNuevo) {
            cargarCategorias();
        }
    }, [modalNuevo]);

    async function cargarProductos() {
        setCargando(true);
        setError("");

        try {
            const usuario = await obtenerUsuarioActual();

            if (!usuario) {
                setError(
                    "No se encontró el usuario."
                );
                return;
            }

            const {
                data,
                error,
            } = await supabase
                .from("productos")
                .select(`
                    id,
                    nombre,
                    descripcion,
                    codigo_barras,
                    sku,
                    categoria_id,
                    precio_compra,
                    precio_base,
                    precio_venta,
                    unidad,
                    imagen_url,
                    stock_minimo,
                    activo
                `)
                .eq(
                    "negocio_id",
                    usuario.negocio_id
                )
                .order(
                    "nombre",
                    {
                        ascending: true,
                    }
                );

            if (error) {
                console.error(
                    "Error cargando productos:",
                    error
                );

                setError(
                    "No se pudieron cargar los productos."
                );

                return;
            }

            setProductos(data ?? []);
        } catch (error) {
            console.error(error);

            setError(
                "Ocurrió un error al cargar los productos."
            );
        } finally {
            setCargando(false);
        }
    }

    useEffect(() => {
        cargarProductos();
    }, []);

    const productosFiltrados =
        productos.filter((producto) => {
            const texto =
                busqueda.toLowerCase().trim();

            if (!texto) return true;

            return (
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
        });

    return (
        <div className="space-y-6">

            {/* =====================================================
                MENSAJE DE ÉXITO
            ====================================================== */}
            {mensajeExito && (
                <div
                    className="
                        fixed
                        right-4
                        top-20
                        z-[200]
                        flex
                        max-w-sm
                        items-center
                        gap-3
                        rounded-2xl
                        border
                        border-green-200
                        bg-[var(--color-surface)]
                        px-5
                        py-4
                        shadow-xl
                        animate-in
                        fade-in
                        slide-in-from-right-5
                    "
                >
                    <div
                        className="
                            flex
                            h-9
                            w-9
                            shrink-0
                            items-center
                            justify-center
                            rounded-full
                            bg-green-100
                            text-green-600
                        "
                    >
                        ✓
                    </div>

                    <div>
                        <p className="text-sm font-bold text-[var(--color-text)]">
                            ¡Listo!
                        </p>

                        <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
                            {mensajeExito}
                        </p>
                    </div>
                </div>
            )}

            {/* =====================================================
                MODAL DE MENSAJES
            ====================================================== */}
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
                                        ${mensajeModal.tipo === "error"
                                            ? "bg-red-100 text-red-600"
                                            : mensajeModal.tipo === "warning"
                                                ? "bg-amber-100 text-amber-600"
                                                : "bg-green-100 text-green-600"
                                        }
                                    `}
                                >
                                    {mensajeModal.tipo === "error"
                                        ? "!"
                                        : mensajeModal.tipo === "warning"
                                            ? "⚠"
                                            : "✓"}
                                </div>

                                <div className="min-w-0 flex-1">
                                    <h3 className="text-base font-bold text-[var(--color-text)]">
                                        {mensajeModal.titulo}
                                    </h3>

                                    <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
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

            {/* =====================================================
                ENCABEZADO
            ====================================================== */}
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
                    <h1 className="text-2xl font-bold text-[var(--color-text)] sm:text-3xl">
                        Productos
                    </h1>

                    <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                        Administra los productos de tu negocio.
                    </p>
                </div>

                <button
                    type="button"
                    onClick={() => setModalNuevo(true)}
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
                    + Nuevo producto
                </button>

                {/* =================================================
                    MODAL NUEVO PRODUCTO
                ================================================== */}
                {modalNuevo && (
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
                                sm:max-w-3xl
                                sm:rounded-2xl
                                sm:border
                                sm:border-[var(--color-border)]
                                sm:shadow-2xl
                            "
                        >

                            {/* Encabezado */}
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
                                    <h2 className="text-lg font-bold text-[var(--color-text)]">
                                        Nuevo producto
                                    </h2>

                                    <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                                        Registra un nuevo producto para tu negocio.
                                    </p>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => setModalNuevo(false)}
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
                                        hover:text-[var(--color-text)]
                                    "
                                    aria-label="Cerrar"
                                >
                                    ×
                                </button>
                            </div>

                            {/* Contenido */}
                            <div className="flex-1 overflow-y-auto p-5 sm:p-6">

                                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">

                                    {/* Nombre */}
                                    <div className="sm:col-span-2">
                                        <label
                                            htmlFor="nombre-producto"
                                            className="mb-2 block text-sm font-semibold text-[var(--color-text)]"
                                        >
                                            Nombre del producto *
                                        </label>

                                        <input
                                            id="nombre-producto"
                                            type="text"
                                            value={formProducto.nombre}
                                            onChange={(e) =>
                                                actualizarCampo(
                                                    "nombre",
                                                    e.target.value
                                                )
                                            }
                                            placeholder="Ej. Coca-Cola 600 ml"
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
                                            "
                                        />
                                    </div>

                                    {/* Código de barras */}
                                    <div>
                                        <label
                                            htmlFor="codigo-barras"
                                            className="mb-2 block text-sm font-semibold text-[var(--color-text)]"
                                        >
                                            Código de barras
                                        </label>

                                        <input
                                            id="codigo-barras"
                                            type="text"
                                            value={formProducto.codigo_barras}
                                            onChange={(e) =>
                                                actualizarCampo(
                                                    "codigo_barras",
                                                    e.target.value
                                                )
                                            }
                                            placeholder="Escanear o escribir"
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
                                            "
                                        />

                                        <p className="mt-1.5 text-xs text-[var(--color-text-secondary)]">
                                            Compatible con lectores USB y Bluetooth.
                                        </p>
                                    </div>

                                    {/* SKU */}
                                    <div>
                                        <label
                                            htmlFor="sku"
                                            className="mb-2 block text-sm font-semibold text-[var(--color-text)]"
                                        >
                                            SKU
                                        </label>

                                        <input
                                            id="sku"
                                            type="text"
                                            value={formProducto.sku}
                                            onChange={(e) =>
                                                actualizarCampo(
                                                    "sku",
                                                    e.target.value
                                                )
                                            }
                                            placeholder="Ej. REF-001"
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
                                            "
                                        />
                                    </div>

                                    {/* Categoría */}
                                    <div>
                                        <label
                                            htmlFor="categoria-producto"
                                            className="mb-2 block text-sm font-semibold text-[var(--color-text)]"
                                        >
                                            Categoría
                                        </label>

                                        <select
                                            id="categoria-producto"
                                            value={formProducto.categoria_id}
                                            onChange={(e) =>
                                                actualizarCampo(
                                                    "categoria_id",
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
                                                focus:ring-[var(--color-primary)]/10
                                            "
                                        >
                                            <option value="">
                                                {cargandoCategorias
                                                    ? "Cargando categorías..."
                                                    : categorias.length === 0
                                                        ? "No hay categorías disponibles"
                                                        : "Seleccionar categoría"}
                                            </option>

                                            {categorias.map((categoria) => (
                                                <option
                                                    key={categoria.id}
                                                    value={categoria.id}
                                                >
                                                    {categoria.nombre}
                                                </option>
                                            ))}
                                        </select>

                                        {!cargandoCategorias &&
                                            categorias.length === 0 && (
                                                <p className="mt-2 text-xs text-amber-600">
                                                    ⚠️ No tienes categorías registradas.
                                                </p>
                                            )}
                                    </div>

                                    {/* Unidad */}
                                    <div>
                                        <label
                                            htmlFor="unidad"
                                            className="mb-2 block text-sm font-semibold text-[var(--color-text)]"
                                        >
                                            Unidad
                                        </label>

                                        <select
                                            id="unidad"
                                            value={formProducto.unidad}
                                            onChange={(e) =>
                                                actualizarCampo(
                                                    "unidad",
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
                                                focus:ring-[var(--color-primary)]/10
                                            "
                                        >
                                            <option value="pieza">Pieza</option>
                                            <option value="kilogramo">Kilogramo</option>
                                            <option value="gramo">Gramo</option>
                                            <option value="litro">Litro</option>
                                            <option value="metro">Metro</option>
                                            <option value="caja">Caja</option>
                                            <option value="paquete">Paquete</option>
                                        </select>
                                    </div>

                                    {/* Precio compra */}
                                    <div>
                                        <label
                                            htmlFor="precio-compra"
                                            className="mb-2 block text-sm font-semibold text-[var(--color-text)]"
                                        >
                                            Precio de compra
                                        </label>

                                        <div className="relative">
                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-[var(--color-text-secondary)]">
                                                $
                                            </span>

                                            <input
                                                id="precio-compra"
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                placeholder="0.00"
                                                value={formProducto.precio_compra}
                                                onChange={(e) =>
                                                    actualizarCampo(
                                                        "precio_compra",
                                                        e.target.value
                                                    )
                                                }
                                                className="
                                                    w-full
                                                    rounded-xl
                                                    border
                                                    border-[var(--color-border)]
                                                    bg-[var(--color-surface)]
                                                    py-3
                                                    pl-8
                                                    pr-4
                                                    text-sm
                                                    text-[var(--color-text)]
                                                    outline-none
                                                    transition
                                                    focus:border-[var(--color-primary)]
                                                    focus:ring-4
                                                    focus:ring-[var(--color-primary)]/10
                                                "
                                            />
                                        </div>
                                    </div>

                                    {/* Precio venta */}
                                    <div>
                                        <label
                                            htmlFor="precio-venta"
                                            className="mb-2 block text-sm font-semibold text-[var(--color-text)]"
                                        >
                                            Precio de venta *
                                        </label>

                                        <div className="relative">
                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-medium text-[var(--color-primary)]">
                                                $
                                            </span>

                                            <input
                                                id="precio-venta"
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                placeholder="0.00"
                                                value={formProducto.precio_venta}
                                                onChange={(e) =>
                                                    actualizarCampo(
                                                        "precio_venta",
                                                        e.target.value
                                                    )
                                                }
                                                className="
                                                    w-full
                                                    rounded-xl
                                                    border
                                                    border-[var(--color-border)]
                                                    bg-[var(--color-surface)]
                                                    py-3
                                                    pl-8
                                                    pr-4
                                                    text-sm
                                                    font-semibold
                                                    text-[var(--color-text)]
                                                    outline-none
                                                    transition
                                                    focus:border-[var(--color-primary)]
                                                    focus:ring-4
                                                    focus:ring-[var(--color-primary)]/10
                                                "
                                            />
                                        </div>
                                    </div>

                                    {/* Stock inicial */}
                                    <div>
                                        <label
                                            htmlFor="stock-inicial"
                                            className="mb-2 block text-sm font-semibold text-[var(--color-text)]"
                                        >
                                            Stock inicial
                                        </label>

                                        <input
                                            id="stock-inicial"
                                            type="number"
                                            min="0"
                                            step="0.001"
                                            value={formProducto.stock_inicial}
                                            onChange={(e) =>
                                                setFormProducto({
                                                    ...formProducto,
                                                    stock_inicial:
                                                        e.target.value,
                                                })
                                            }
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
                                            "
                                        />

                                        <p className="mt-1.5 text-xs text-[var(--color-text-secondary)]">
                                            Cantidad disponible actualmente.
                                        </p>
                                    </div>

                                    {/* Stock mínimo */}
                                    <div>
                                        <label
                                            htmlFor="stock-minimo"
                                            className="mb-2 block text-sm font-semibold text-[var(--color-text)]"
                                        >
                                            Stock mínimo
                                        </label>

                                        <input
                                            id="stock-minimo"
                                            type="number"
                                            min="0"
                                            step="0.001"
                                            value={formProducto.stock_minimo}
                                            onChange={(e) =>
                                                actualizarCampo(
                                                    "stock_minimo",
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
                                                focus:ring-[var(--color-primary)]/10
                                            "
                                        />
                                    </div>

                                    {/* Sucursales */}
                                    <div>
                                        <label className="mb-2 block text-sm font-semibold text-[var(--color-text)]">
                                            Sucursales
                                        </label>

                                        <p className="mb-3 text-xs text-[var(--color-text-secondary)]">
                                            Selecciona las sucursales donde estará disponible este producto.
                                        </p>

                                        <div className="space-y-2">
                                            {sucursales.length === 0 ? (
                                                <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] p-4">
                                                    <p className="text-sm text-[var(--color-text-secondary)]">
                                                        No hay sucursales activas.
                                                    </p>
                                                </div>
                                            ) : (
                                                sucursales.map((sucursal) => {
                                                    const seleccionada =
                                                        formProducto.sucursales_ids.includes(
                                                            sucursal.id
                                                        );

                                                    return (
                                                        <label
                                                            key={sucursal.id}
                                                            className={`
                                                                flex
                                                                cursor-pointer
                                                                items-center
                                                                gap-3
                                                                rounded-xl
                                                                border
                                                                p-4
                                                                transition
                                                                ${seleccionada
                                                                    ? "border-[var(--color-primary)]"
                                                                    : "border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-background)]"
                                                                }
                                                            `}
                                                            style={
                                                                seleccionada
                                                                    ? {
                                                                        backgroundColor:
                                                                            "color-mix(in srgb, var(--color-primary) 8%, transparent)",
                                                                    }
                                                                    : undefined
                                                            }
                                                        >
                                                            <input
                                                                type="checkbox"
                                                                checked={seleccionada}
                                                                onChange={(e) => {
                                                                    setFormProducto(
                                                                        (actual) => {
                                                                            if (
                                                                                e.target
                                                                                    .checked
                                                                            ) {
                                                                                return {
                                                                                    ...actual,
                                                                                    sucursales_ids:
                                                                                        [
                                                                                            ...actual.sucursales_ids,
                                                                                            sucursal.id,
                                                                                        ],
                                                                                };
                                                                            }

                                                                            return {
                                                                                ...actual,
                                                                                sucursales_ids:
                                                                                    actual.sucursales_ids.filter(
                                                                                        (
                                                                                            id
                                                                                        ) =>
                                                                                            id !==
                                                                                            sucursal.id
                                                                                    ),
                                                                            };
                                                                        }
                                                                    );
                                                                }}
                                                                className="h-4 w-4 accent-[var(--color-primary)]"
                                                            />

                                                            <div>
                                                                <p className="text-sm font-semibold text-[var(--color-text)]">
                                                                    {sucursal.nombre}
                                                                </p>

                                                                <p className="text-xs text-[var(--color-text-secondary)]">
                                                                    Disponible para venta
                                                                </p>
                                                            </div>
                                                        </label>
                                                    );
                                                })
                                            )}
                                        </div>
                                    </div>

                                    {/* Estado */}
                                    <div className="sm:col-span-2">
                                        <label className="mb-2 block text-sm font-semibold text-[var(--color-text)]">
                                            Estado del producto
                                        </label>

                                        <label
                                            className="
                                                flex
                                                cursor-pointer
                                                items-center
                                                justify-between
                                                rounded-xl
                                                border
                                                border-[var(--color-border)]
                                                bg-[var(--color-surface)]
                                                px-4
                                                py-3
                                                transition
                                                hover:bg-[var(--color-background)]
                                            "
                                        >
                                            <div>
                                                <p className="text-sm font-semibold text-[var(--color-text)]">
                                                    {formProducto.activo
                                                        ? "Producto activo"
                                                        : "Producto inactivo"}
                                                </p>

                                                <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                                                    {formProducto.activo
                                                        ? "El producto estará disponible para venta."
                                                        : "El producto no estará disponible para venta."}
                                                </p>
                                            </div>

                                            <input
                                                type="checkbox"
                                                checked={formProducto.activo}
                                                onChange={(e) =>
                                                    setFormProducto(
                                                        (actual) => ({
                                                            ...actual,
                                                            activo: e.target
                                                                .checked,
                                                        })
                                                    )
                                                }
                                                className="
                                                    h-5
                                                    w-5
                                                    cursor-pointer
                                                    rounded
                                                    border-[var(--color-border)]
                                                    accent-[var(--color-primary)]
                                                "
                                            />
                                        </label>
                                    </div>

                                    {/* Imagen */}
                                    <div>
                                        <label
                                            htmlFor="imagen-url"
                                            className="mb-2 block text-sm font-semibold text-[var(--color-text)]"
                                        >
                                            Imagen
                                        </label>

                                        <input
                                            id="imagen-url"
                                            type="url"
                                            placeholder="https://..."
                                            value={formProducto.imagen_url}
                                            onChange={(e) =>
                                                actualizarCampo(
                                                    "imagen_url",
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
                                                focus:ring-[var(--color-primary)]/10
                                            "
                                        />
                                    </div>

                                    {/* Descripción */}
                                    <div className="sm:col-span-2">
                                        <label
                                            htmlFor="descripcion"
                                            className="mb-2 block text-sm font-semibold text-[var(--color-text)]"
                                        >
                                            Descripción
                                        </label>

                                        <textarea
                                            id="descripcion"
                                            rows={3}
                                            placeholder="Descripción opcional del producto..."
                                            value={formProducto.descripcion}
                                            onChange={(e) =>
                                                actualizarCampo(
                                                    "descripcion",
                                                    e.target.value
                                                )
                                            }
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
                                            "
                                        />
                                    </div>

                                </div>
                            </div>

                            {/* Pie */}
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
                                    onClick={() => setModalNuevo(false)}
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
                                    Cancelar
                                </button>

                                <button
                                    type="button"
                                    onClick={guardarProducto}
                                    disabled={guardandoProducto}
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
                                        disabled:cursor-not-allowed
                                        disabled:opacity-60
                                        sm:w-auto
                                    "
                                >
                                    {guardandoProducto
                                        ? "Guardando..."
                                        : "Guardar producto"}
                                </button>
                            </div>

                        </div>
                    </div>
                )}
            </div>

            {/* =====================================================
                MODAL EDITAR PRODUCTO
            ====================================================== */}
            {modalEditar && productoEditando && (
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
                            sm:max-w-3xl
                            sm:rounded-2xl
                            sm:border
                            sm:border-[var(--color-border)]
                            sm:shadow-2xl
                        "
                    >

                        {/* Encabezado */}
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
                                <h2 className="text-lg font-bold text-[var(--color-text)]">
                                    Editar producto
                                </h2>

                                <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                                    Modifica la información del producto.
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={() => {
                                    setModalEditar(false);
                                    setProductoEditando(null);
                                }}
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
                                    hover:text-[var(--color-text)]
                                "
                            >
                                ×
                            </button>
                        </div>

                        {/* Contenido */}
                        <div className="flex-1 overflow-y-auto p-5 sm:p-6">

                            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">

                                {/* Nombre */}
                                <div className="sm:col-span-2">
                                    <label className="mb-2 block text-sm font-semibold text-[var(--color-text)]">
                                        Nombre del producto *
                                    </label>

                                    <input
                                        type="text"
                                        value={productoEditando.nombre}
                                        onChange={(e) =>
                                            setProductoEditando({
                                                ...productoEditando,
                                                nombre: e.target.value,
                                            })
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
                                        "
                                    />
                                </div>

                                {/* Código */}
                                <div>
                                    <label className="mb-2 block text-sm font-semibold text-[var(--color-text)]">
                                        Código de barras
                                    </label>

                                    <input
                                        type="text"
                                        value={productoEditando.codigo_barras}
                                        onChange={(e) =>
                                            setProductoEditando({
                                                ...productoEditando,
                                                codigo_barras:
                                                    e.target.value,
                                            })
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
                                        "
                                    />
                                </div>

                                {/* SKU */}
                                <div>
                                    <label className="mb-2 block text-sm font-semibold text-[var(--color-text)]">
                                        SKU
                                    </label>

                                    <input
                                        type="text"
                                        value={productoEditando.sku}
                                        onChange={(e) =>
                                            setProductoEditando({
                                                ...productoEditando,
                                                sku: e.target.value,
                                            })
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
                                        "
                                    />
                                </div>

                                {/* Categoría */}
                                <div>
                                    <label className="mb-2 block text-sm font-semibold text-[var(--color-text)]">
                                        Categoría
                                    </label>

                                    <select
                                        value={productoEditando.categoria_id}
                                        onChange={(e) =>
                                            setProductoEditando({
                                                ...productoEditando,
                                                categoria_id:
                                                    e.target.value,
                                            })
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
                                        "
                                    >
                                        <option value="">
                                            Sin categoría
                                        </option>

                                        {categorias.map((categoria) => (
                                            <option
                                                key={categoria.id}
                                                value={categoria.id}
                                            >
                                                {categoria.nombre}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* Unidad */}
                                <div>
                                    <label className="mb-2 block text-sm font-semibold text-[var(--color-text)]">
                                        Unidad
                                    </label>

                                    <select
                                        value={productoEditando.unidad}
                                        onChange={(e) =>
                                            setProductoEditando({
                                                ...productoEditando,
                                                unidad:
                                                    e.target.value,
                                            })
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
                                        "
                                    >
                                        <option value="pieza">Pieza</option>
                                        <option value="kilogramo">Kilogramo</option>
                                        <option value="gramo">Gramo</option>
                                        <option value="litro">Litro</option>
                                        <option value="metro">Metro</option>
                                        <option value="caja">Caja</option>
                                        <option value="paquete">Paquete</option>
                                    </select>
                                </div>

                                {/* Precio compra */}
                                <div>
                                    <label className="mb-2 block text-sm font-semibold text-[var(--color-text)]">
                                        Precio de compra
                                    </label>

                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={productoEditando.precio_compra}
                                        onChange={(e) =>
                                            setProductoEditando({
                                                ...productoEditando,
                                                precio_compra:
                                                    e.target.value,
                                            })
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
                                        "
                                    />
                                </div>

                                {/* Precio venta */}
                                <div>
                                    <label className="mb-2 block text-sm font-semibold text-[var(--color-text)]">
                                        Precio de venta *
                                    </label>

                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={productoEditando.precio_venta}
                                        onChange={(e) =>
                                            setProductoEditando({
                                                ...productoEditando,
                                                precio_venta:
                                                    e.target.value,
                                            })
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
                                            font-semibold
                                            text-[var(--color-text)]
                                            outline-none
                                            transition
                                            focus:border-[var(--color-primary)]
                                            focus:ring-4
                                            focus:ring-[var(--color-primary)]/10
                                        "
                                    />
                                </div>

                                {/* Stock mínimo */}
                                <div>
                                    <label className="mb-2 block text-sm font-semibold text-[var(--color-text)]">
                                        Stock mínimo
                                    </label>

                                    <input
                                        type="number"
                                        min="0"
                                        step="0.001"
                                        value={productoEditando.stock_minimo}
                                        onChange={(e) =>
                                            setProductoEditando({
                                                ...productoEditando,
                                                stock_minimo:
                                                    e.target.value,
                                            })
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
                                        "
                                    />
                                </div>

                                {/* Imagen */}
                                <div>
                                    <label className="mb-2 block text-sm font-semibold text-[var(--color-text)]">
                                        Imagen
                                    </label>

                                    <input
                                        type="url"
                                        value={productoEditando.imagen_url}
                                        onChange={(e) =>
                                            setProductoEditando({
                                                ...productoEditando,
                                                imagen_url:
                                                    e.target.value,
                                            })
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
                                        "
                                    />
                                </div>

                                {/* Estado */}
                                <div className="sm:col-span-2">
                                    <label
                                        className="
                                            flex
                                            cursor-pointer
                                            items-center
                                            justify-between
                                            rounded-xl
                                            border
                                            border-[var(--color-border)]
                                            bg-[var(--color-surface)]
                                            px-4
                                            py-4
                                            transition
                                            hover:bg-[var(--color-background)]
                                        "
                                    >
                                        <div>
                                            <p className="text-sm font-semibold text-[var(--color-text)]">
                                                {productoEditando.activo
                                                    ? "Producto activo"
                                                    : "Producto inactivo"}
                                            </p>

                                            <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                                                {productoEditando.activo
                                                    ? "Disponible para venta."
                                                    : "No disponible para venta."}
                                            </p>
                                        </div>

                                        <input
                                            type="checkbox"
                                            checked={productoEditando.activo}
                                            onChange={(e) =>
                                                setProductoEditando({
                                                    ...productoEditando,
                                                    activo:
                                                        e.target.checked,
                                                })
                                            }
                                            className="
                                                h-5
                                                w-5
                                                cursor-pointer
                                                accent-[var(--color-primary)]
                                            "
                                        />
                                    </label>
                                </div>

                                {/* Descripción */}
                                <div className="sm:col-span-2">
                                    <label className="mb-2 block text-sm font-semibold text-[var(--color-text)]">
                                        Descripción
                                    </label>

                                    <textarea
                                        rows={3}
                                        value={productoEditando.descripcion}
                                        onChange={(e) =>
                                            setProductoEditando({
                                                ...productoEditando,
                                                descripcion:
                                                    e.target.value,
                                            })
                                        }
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
                                        "
                                    />
                                </div>

                            </div>
                        </div>

                        {/* Pie */}
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
                                onClick={() => {
                                    setModalEditar(false);
                                    setProductoEditando(null);
                                }}
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
                                Cancelar
                            </button>

                            <button
                                type="button"
                                onClick={actualizarProducto}
                                disabled={guardandoEdicion}
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
                                    disabled:cursor-not-allowed
                                    disabled:opacity-60
                                    sm:w-auto
                                "
                            >
                                {guardandoEdicion
                                    ? "Guardando..."
                                    : "Guardar cambios"}
                            </button>
                        </div>

                    </div>
                </div>
            )}

            {/* =====================================================
                BÚSQUEDA
            ====================================================== */}
            <Card className="p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">

                    <div className="flex-1">
                        <label
                            htmlFor="buscar-producto"
                            className="sr-only"
                        >
                            Buscar producto
                        </label>

                        <input
                            id="buscar-producto"
                            type="search"
                            value={busqueda}
                            onChange={(e) =>
                                setBusqueda(e.target.value)
                            }
                            placeholder="Buscar por nombre, código de barras o SKU..."
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
                            rounded-xl
                            bg-[var(--color-background)]
                            px-3
                            py-2
                            text-sm
                            font-medium
                            text-[var(--color-text-secondary)]
                        "
                    >
                        {productosFiltrados.length} producto
                        {productosFiltrados.length !== 1
                            ? "s"
                            : ""}
                    </div>

                </div>
            </Card>

            {/* =====================================================
                CARGANDO
            ====================================================== */}
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
                            Cargando productos...
                        </p>
                    </div>
                </Card>
            )}

            {/* =====================================================
                ERROR
            ====================================================== */}
            {!cargando && error && (
                <Card className="border-red-200 bg-red-50 p-6">
                    <div className="flex items-start gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-100 font-bold text-red-600">
                            !
                        </div>

                        <div>
                            <p className="text-sm font-semibold text-red-700">
                                No se pudieron cargar los productos
                            </p>

                            <p className="mt-1 text-sm text-red-600">
                                {error}
                            </p>
                        </div>
                    </div>
                </Card>
            )}

            {/* =====================================================
                SIN PRODUCTOS
            ====================================================== */}
            {!cargando &&
                !error &&
                productosFiltrados.length === 0 && (
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
                                    text-xl
                                    font-bold
                                    text-[var(--color-primary)]
                                "
                                style={{
                                    backgroundColor:
                                        "color-mix(in srgb, var(--color-primary) 10%, transparent)",
                                }}
                            >
                                P
                            </div>

                            <h2 className="mt-4 text-lg font-bold text-[var(--color-text)]">
                                No hay productos
                            </h2>

                            <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
                                {busqueda
                                    ? "No encontramos productos que coincidan con tu búsqueda."
                                    : "Todavía no tienes productos registrados."}
                            </p>

                            {!busqueda && (
                                <button
                                    type="button"
                                    onClick={() =>
                                        setModalNuevo(true)
                                    }
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
                                    + Registrar producto
                                </button>
                            )}

                        </div>
                    </Card>
                )}

            {/* =====================================================
                PRODUCTOS
            ====================================================== */}
            {!cargando &&
                !error &&
                productosFiltrados.length > 0 && (
                    <Card className="overflow-hidden">

                        {/* =================================================
                            VISTA ESCRITORIO
                        ================================================== */}
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
                                        <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
                                            Producto
                                        </th>

                                        <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
                                            Código
                                        </th>

                                        <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
                                            Precio venta
                                        </th>

                                        <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
                                            Unidad
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

                                    {productosFiltrados.map(
                                        (producto) => (
                                            <tr
                                                key={producto.id}
                                                className="
                                                    transition
                                                    hover:bg-[var(--color-background)]
                                                "
                                            >

                                                <td className="px-5 py-4">
                                                    <div className="flex items-center gap-3">

                                                        {producto.imagen_url ? (
                                                            <img
                                                                src={
                                                                    producto.imagen_url
                                                                }
                                                                alt={
                                                                    producto.nombre
                                                                }
                                                                className="
                                                                    h-11
                                                                    w-11
                                                                    rounded-xl
                                                                    border
                                                                    border-[var(--color-border)]
                                                                    object-cover
                                                                "
                                                            />
                                                        ) : (
                                                            <div
                                                                className="
                                                                    flex
                                                                    h-11
                                                                    w-11
                                                                    items-center
                                                                    justify-center
                                                                    rounded-xl
                                                                    text-xs
                                                                    font-bold
                                                                    text-[var(--color-primary)]
                                                                "
                                                                style={{
                                                                    backgroundColor:
                                                                        "color-mix(in srgb, var(--color-primary) 10%, transparent)",
                                                                }}
                                                            >
                                                                IMG
                                                            </div>
                                                        )}

                                                        <div className="min-w-0">
                                                            <p className="font-semibold text-[var(--color-text)]">
                                                                {
                                                                    producto.nombre
                                                                }
                                                            </p>

                                                            {producto.descripcion && (
                                                                <p className="mt-1 max-w-xs truncate text-xs text-[var(--color-text-secondary)]">
                                                                    {
                                                                        producto.descripcion
                                                                    }
                                                                </p>
                                                            )}
                                                        </div>

                                                    </div>
                                                </td>

                                                <td className="px-5 py-4 text-sm text-[var(--color-text-secondary)]">
                                                    {producto.codigo_barras ||
                                                        producto.sku ||
                                                        "—"}
                                                </td>

                                                <td className="px-5 py-4 text-sm font-bold text-[var(--color-text)]">
                                                    $
                                                    {Number(
                                                        producto.precio_venta
                                                    ).toFixed(2)}
                                                </td>

                                                <td className="px-5 py-4 text-sm text-[var(--color-text-secondary)]">
                                                    {producto.unidad}
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
                                                            ${producto.activo
                                                                ? "bg-green-100 text-green-700"
                                                                : "bg-[var(--color-background)] text-[var(--color-text-secondary)]"
                                                            }
                                                        `}
                                                    >
                                                        {producto.activo
                                                            ? "Activo"
                                                            : "Inactivo"}
                                                    </span>
                                                </td>

                                                <td className="px-5 py-4 text-right">
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            abrirEditarProducto(
                                                                producto
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
                                                        Editar
                                                    </button>
                                                </td>

                                            </tr>
                                        )
                                    )}

                                </tbody>

                            </table>
                        </div>

                        {/* =================================================
                            VISTA MÓVIL
                        ================================================== */}
                        <div className="divide-y divide-[var(--color-border)] md:hidden">

                            {productosFiltrados.map(
                                (producto) => (
                                    <div
                                        key={producto.id}
                                        className="p-4 transition hover:bg-[var(--color-background)]"
                                    >

                                        <div className="flex gap-3">

                                            {producto.imagen_url ? (
                                                <img
                                                    src={
                                                        producto.imagen_url
                                                    }
                                                    alt={
                                                        producto.nombre
                                                    }
                                                    className="
                                                        h-14
                                                        w-14
                                                        shrink-0
                                                        rounded-xl
                                                        border
                                                        border-[var(--color-border)]
                                                        object-cover
                                                    "
                                                />
                                            ) : (
                                                <div
                                                    className="
                                                        flex
                                                        h-14
                                                        w-14
                                                        shrink-0
                                                        items-center
                                                        justify-center
                                                        rounded-xl
                                                        text-xs
                                                        font-bold
                                                        text-[var(--color-primary)]
                                                    "
                                                    style={{
                                                        backgroundColor:
                                                            "color-mix(in srgb, var(--color-primary) 10%, transparent)",
                                                    }}
                                                >
                                                    IMG
                                                </div>
                                            )}

                                            <div className="min-w-0 flex-1">

                                                <div className="flex items-start justify-between gap-3">

                                                    <div className="min-w-0">
                                                        <h2 className="truncate font-semibold text-[var(--color-text)]">
                                                            {
                                                                producto.nombre
                                                            }
                                                        </h2>

                                                        <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                                                            {producto.codigo_barras ||
                                                                producto.sku ||
                                                                "Sin código"}
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
                                                            ${producto.activo
                                                                ? "bg-green-100 text-green-700"
                                                                : "bg-[var(--color-background)] text-[var(--color-text-secondary)]"
                                                            }
                                                        `}
                                                    >
                                                        {producto.activo
                                                            ? "Activo"
                                                            : "Inactivo"}
                                                    </span>

                                                </div>

                                                <div className="mt-3 flex items-end justify-between gap-3">

                                                    <div>
                                                        <p className="text-lg font-bold text-[var(--color-text)]">
                                                            $
                                                            {Number(
                                                                producto.precio_venta
                                                            ).toFixed(2)}
                                                        </p>

                                                        <p className="text-xs text-[var(--color-text-secondary)]">
                                                            por{" "}
                                                            {
                                                                producto.unidad
                                                            }
                                                        </p>
                                                    </div>

                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            abrirEditarProducto(
                                                                producto
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
                                                        Editar
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

        </div>
    );
}