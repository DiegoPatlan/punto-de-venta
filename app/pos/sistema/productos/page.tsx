"use client";

import { useEffect, useMemo, useState } from "react";

import { supabasePOS } from "../../../../lib/supabase";

import {
    obtenerUsuarioPOS,
    type UsuarioPOS,
} from "../../../../lib/usuarioPOS";

interface Categoria {
    id: string;
    nombre: string;
}

interface Producto {
    id: string;
    nombre: string;
    codigo_barras: string | null;
    sku: string | null;
    categoria_id: string | null;
    categoria_nombre: string | null;
    precio_venta: number;
    unidad: string;
    imagen_url: string | null;
    activo: boolean;
    stock: number;
}

export default function ProductosPOSPage() {
    const [usuario, setUsuario] = useState<UsuarioPOS | null>(null);
    const [sucursalId, setSucursalId] = useState<string | null>(null);
    const [productos, setProductos] = useState<Producto[]>([]);
    const [categorias, setCategorias] = useState<Categoria[]>([]);
    const [busqueda, setBusqueda] = useState("");
    const [categoriaSeleccionada, setCategoriaSeleccionada] =
        useState<string>("todas");
    const [cargandoContexto, setCargandoContexto] = useState(true);
    const [cargandoProductos, setCargandoProductos] = useState(false);
    const [error, setError] = useState<string | null>(null);

    /*
     * ============================================================
     * CARGAR CONTEXTO POS
     * ============================================================
     *
     * sesiones_caja NO tiene sucursal_id.
     *
     * La relación correcta es:
     *
     * sesiones_caja.caja_id
     *       ↓
     * cajas.id
     *       ↓
     * cajas.sucursal_id
     */
    useEffect(() => {
        let activo = true;

        async function cargarContextoPOS() {
            setCargandoContexto(true);
            setError(null);

            try {
                const usuarioActual = await obtenerUsuarioPOS();

                if (!usuarioActual) {
                    if (activo) {
                        setError(
                            "No fue posible obtener el usuario actual del POS."
                        );
                        setCargandoContexto(false);
                    }
                    return;
                }

                if (!usuarioActual.negocio_id) {
                    if (activo) {
                        setError(
                            "El usuario POS no tiene un negocio asociado."
                        );
                        setCargandoContexto(false);
                    }
                    return;
                }

                /*
                 * Buscamos la sesión de caja abierta del usuario.
                 *
                 * IMPORTANTE:
                 * sucursal_id se obtiene desde cajas.
                 */
                const {
                    data: sesionCaja,
                    error: sesionError,
                } = await supabasePOS
                    .from("sesiones_caja")
                    .select(`
                        id,
                        caja_id,
                        cajas (
                            id,
                            sucursal_id
                        )
                    `)
                    .eq(
                        "usuario_apertura_id",
                        usuarioActual.id
                    )
                    .eq("estado", "abierta")
                    .maybeSingle();

                if (sesionError) {
                    console.error(
                        "❌ Error cargando contexto POS:",
                        sesionError
                    );

                    if (activo) {
                        setError(
                            "No fue posible obtener la sesión de caja."
                        );
                        setCargandoContexto(false);
                    }

                    return;
                }

                if (!sesionCaja) {
                    if (activo) {
                        setError(
                            "No tienes una sesión de caja abierta."
                        );
                        setCargandoContexto(false);
                    }

                    return;
                }

                /*
                 * Supabase puede devolver la relación como objeto
                 * o como arreglo dependiendo de la relación inferida.
                 */
                const cajaData = Array.isArray(sesionCaja.cajas)
                    ? sesionCaja.cajas[0]
                    : sesionCaja.cajas;

                const sucursalActualId =
                    cajaData?.sucursal_id ?? null;

                if (!sucursalActualId) {
                    console.error(
                        "❌ La caja de la sesión no tiene sucursal asociada."
                    );

                    if (activo) {
                        setError(
                            "La caja actual no tiene una sucursal asociada."
                        );
                        setCargandoContexto(false);
                    }

                    return;
                }

                if (activo) {
                    setUsuario(usuarioActual);
                    setSucursalId(sucursalActualId);
                    setCargandoContexto(false);
                }
            } catch (err) {
                console.error(
                    "❌ Error inesperado cargando contexto POS:",
                    err
                );

                if (activo) {
                    setError(
                        "Ocurrió un error al cargar el contexto del POS."
                    );
                    setCargandoContexto(false);
                }
            }
        }

        cargarContextoPOS();

        return () => {
            activo = false;
        };
    }, []);

    /*
     * ============================================================
     * CARGAR CATEGORÍAS Y PRODUCTOS
     * ============================================================
     */
    useEffect(() => {
        if (!usuario?.negocio_id || !sucursalId) {
            return;
        }

        let activo = true;

        async function cargarDatos() {
            setCargandoProductos(true);
            setError(null);

            try {
                /*
                 * ------------------------------------------------
                 * CATEGORÍAS
                 * ------------------------------------------------
                 */
                const {
                    data: categoriasData,
                    error: categoriasError,
                } = await supabasePOS
                    .from("categorias")
                    .select("id, nombre")
                    .eq(
                        "negocio_id",
                        usuario!.negocio_id!
                    )
                    .eq("activo", true)
                    .order("nombre", {
                        ascending: true,
                    });

                if (categoriasError) {
                    console.error(
                        "❌ Error cargando categorías:",
                        categoriasError
                    );

                    if (activo) {
                        setError(
                            "No fue posible cargar las categorías."
                        );
                    }

                    return;
                }

                /*
                 * ------------------------------------------------
                 * PRODUCTOS
                 * ------------------------------------------------
                 *
                 * Solamente productos activos del negocio.
                 *
                 * Inventario se filtra posteriormente por la
                 * sucursal de la sesión actual.
                 */
                const {
                    data: productosData,
                    error: productosError,
                } = await supabasePOS
                    .from("productos")
                    .select(`
                        id,
                        nombre,
                        codigo_barras,
                        sku,
                        categoria_id,
                        precio_venta,
                        unidad,
                        imagen_url,
                        activo,
                        categorias (
                            id,
                            nombre
                        ),
                        inventario (
                            stock,
                            sucursal_id
                        )
                    `)
                    .eq(
                        "negocio_id",
                        usuario!.negocio_id!
                    )
                    .eq("activo", true)
                    .order("nombre", {
                        ascending: true,
                    });

                if (productosError) {
                    console.error(
                        "❌ Error cargando productos:",
                        productosError
                    );

                    if (activo) {
                        setError(
                            "No fue posible cargar los productos."
                        );
                    }

                    return;
                }

                const productosProcesados: Producto[] =
                    (productosData ?? []).map(
                        (producto: any) => {
                            /*
                             * Obtener inventario únicamente de la
                             * sucursal actual.
                             */
                            const inventarios = Array.isArray(
                                producto.inventario
                            )
                                ? producto.inventario
                                : [];

                            const inventarioSucursal =
                                inventarios.find(
                                    (item: any) =>
                                        item.sucursal_id ===
                                        sucursalId
                                );

                            const categoriaData =
                                Array.isArray(
                                    producto.categorias
                                )
                                    ? producto.categorias[0]
                                    : producto.categorias;

                            return {
                                id: producto.id,
                                nombre: producto.nombre,
                                codigo_barras:
                                    producto.codigo_barras ?? null,
                                sku:
                                    producto.sku ?? null,
                                categoria_id:
                                    producto.categoria_id ?? null,
                                categoria_nombre:
                                    categoriaData?.nombre ?? null,
                                precio_venta:
                                    Number(
                                        producto.precio_venta
                                    ) || 0,
                                unidad:
                                    producto.unidad || "pieza",
                                imagen_url:
                                    producto.imagen_url ?? null,
                                activo:
                                    producto.activo === true,
                                stock:
                                    Number(
                                        inventarioSucursal?.stock
                                    ) || 0,
                            };
                        }
                    );

                if (activo) {
                    setCategorias(categoriasData ?? []);
                    setProductos(productosProcesados);
                }
            } catch (err) {
                console.error(
                    "❌ Error inesperado cargando productos:",
                    err
                );

                if (activo) {
                    setError(
                        "Ocurrió un error al cargar los productos."
                    );
                }
            } finally {
                if (activo) {
                    setCargandoProductos(false);
                }
            }
        }

        cargarDatos();

        return () => {
            activo = false;
        };
    }, [usuario, sucursalId]);

    /*
     * ============================================================
     * FILTRADO
     * ============================================================
     */
    const productosFiltrados = useMemo(() => {
        const texto = busqueda
            .trim()
            .toLowerCase();

        return productos.filter((producto) => {
            const coincideBusqueda =
                texto.length === 0 ||
                producto.nombre
                    .toLowerCase()
                    .includes(texto) ||
                (producto.codigo_barras ?? "")
                    .toLowerCase()
                    .includes(texto) ||
                (producto.sku ?? "")
                    .toLowerCase()
                    .includes(texto);

            const coincideCategoria =
                categoriaSeleccionada === "todas" ||
                producto.categoria_id ===
                categoriaSeleccionada;

            return (
                coincideBusqueda &&
                coincideCategoria
            );
        });
    }, [
        productos,
        busqueda,
        categoriaSeleccionada,
    ]);

    /*
     * ============================================================
     * ESTADÍSTICAS
     * ============================================================
     */
    const totalProductos = productosFiltrados.length;

    const productosDisponibles =
        productosFiltrados.filter(
            (producto) => producto.stock > 0
        ).length;

    const productosAgotados =
        productosFiltrados.filter(
            (producto) => producto.stock <= 0
        ).length;

    /*
     * ============================================================
     * LOADING CONTEXTO
     * ============================================================
     */
    if (cargandoContexto) {
        return (
            <div
                className="flex min-h-[60vh] items-center justify-center px-4"
                style={{
                    backgroundColor:
                        "var(--color-background)",
                }}
            >
                <div className="text-center">
                    <div className="text-4xl">📦</div>

                    <p
                        className="mt-4 text-sm font-semibold"
                        style={{
                            color: "var(--color-text)",
                        }}
                    >
                        Cargando productos...
                    </p>

                    <p
                        className="mt-1 text-xs"
                        style={{
                            color:
                                "var(--color-text-secondary)",
                        }}
                    >
                        Verificando sucursal y sesión de caja.
                    </p>
                </div>
            </div>
        );
    }

    /*
     * ============================================================
     * ERROR
     * ============================================================
     */
    if (error && !usuario) {
        return (
            <div
                className="flex min-h-[60vh] items-center justify-center p-4 sm:p-6"
                style={{
                    backgroundColor:
                        "var(--color-background)",
                }}
            >
                <div
                    className="w-full max-w-md rounded-2xl border p-6 text-center shadow-sm"
                    style={{
                        borderColor:
                            "var(--color-border)",
                        backgroundColor:
                            "var(--color-surface)",
                    }}
                >
                    <div className="text-4xl">⚠️</div>

                    <h2
                        className="mt-3 text-lg font-semibold"
                        style={{
                            color: "var(--color-text)",
                        }}
                    >
                        No se pudo cargar Productos
                    </h2>

                    <p
                        className="mt-2 text-sm"
                        style={{
                            color:
                                "var(--color-text-secondary)",
                        }}
                    >
                        {error}
                    </p>

                    <button
                        type="button"
                        onClick={() =>
                            window.location.reload()
                        }
                        className="mt-5 min-h-11 rounded-xl px-5 py-3 text-sm font-semibold text-white transition hover:opacity-95 active:scale-[0.98]"
                        style={{
                            backgroundColor:
                                "var(--color-primary)",
                        }}
                    >
                        Reintentar
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div
            className="space-y-5"
            style={{
                color: "var(--color-text)",
            }}
        >
            {/* ==================================================
                ENCABEZADO
            ================================================== */}
            <div>
                <h1
                    className="text-2xl font-bold sm:text-3xl"
                    style={{
                        color: "var(--color-text)",
                    }}
                >
                    Productos
                </h1>

                <p
                    className="mt-1 text-sm"
                    style={{
                        color:
                            "var(--color-text-secondary)",
                    }}
                >
                    Consulta existencias y precios de los productos.
                </p>
            </div>

            {/* ==================================================
                ERROR DE CARGA
            ================================================== */}
            {error && (
                <div
                    className="rounded-2xl border p-4 shadow-sm"
                    style={{
                        borderColor:
                            "var(--color-border)",
                        backgroundColor:
                            "var(--color-danger-soft)",
                    }}
                >
                    <div className="flex items-start gap-3">
                        <span className="text-xl">
                            ⚠️
                        </span>

                        <div className="min-w-0">
                            <p
                                className="text-sm font-semibold"
                                style={{
                                    color:
                                        "var(--color-danger)",
                                }}
                            >
                                No fue posible cargar toda la
                                información.
                            </p>

                            <p
                                className="mt-1 text-sm"
                                style={{
                                    color:
                                        "var(--color-danger)",
                                }}
                            >
                                {error}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* ==================================================
                BUSCADOR
            ================================================== */}
            <div
                className="rounded-2xl border p-4 shadow-sm"
                style={{
                    borderColor:
                        "var(--color-border)",
                    backgroundColor:
                        "var(--color-surface)",
                }}
            >
                <label
                    htmlFor="buscar-producto-pos"
                    className="mb-2 block text-sm font-semibold"
                    style={{
                        color:
                            "var(--color-text)",
                    }}
                >
                    Buscar producto
                </label>

                <div className="relative">
                    <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lg">
                        🔎
                    </span>

                    <input
                        id="buscar-producto-pos"
                        type="text"
                        value={busqueda}
                        onChange={(e) =>
                            setBusqueda(e.target.value)
                        }
                        placeholder="Nombre, código de barras o SKU..."
                        className="min-h-12 w-full rounded-xl border py-3 pl-11 pr-4 text-sm outline-none transition focus:ring-2"
                        style={{
                            borderColor:
                                "var(--color-border)",
                            backgroundColor:
                                "var(--color-surface)",
                            color:
                                "var(--color-text)",
                            ["--tw-ring-color" as string]:
                                "color-mix(in srgb, var(--color-primary) 20%, transparent)",
                        }}
                    />
                </div>
            </div>

            {/* ==================================================
                CATEGORÍAS
            ================================================== */}
            <div className="-mx-1 overflow-x-auto px-1 pb-1">
                <div className="flex min-w-max gap-2">
                    <button
                        type="button"
                        onClick={() =>
                            setCategoriaSeleccionada(
                                "todas"
                            )
                        }
                        className="min-h-10 rounded-full px-4 py-2 text-sm font-semibold transition active:scale-[0.98]"
                        style={
                            categoriaSeleccionada === "todas"
                                ? {
                                    backgroundColor:
                                        "var(--color-primary)",
                                    color: "#ffffff",
                                }
                                : {
                                    border:
                                        "1px solid var(--color-border)",
                                    backgroundColor:
                                        "var(--color-surface)",
                                    color:
                                        "var(--color-text)",
                                }
                        }
                    >
                        Todas
                    </button>

                    {categorias.map((categoria) => (
                        <button
                            key={categoria.id}
                            type="button"
                            onClick={() =>
                                setCategoriaSeleccionada(
                                    categoria.id
                                )
                            }
                            className="min-h-10 rounded-full px-4 py-2 text-sm font-semibold transition active:scale-[0.98]"
                            style={
                                categoriaSeleccionada ===
                                    categoria.id
                                    ? {
                                        backgroundColor:
                                            "var(--color-primary)",
                                        color: "#ffffff",
                                    }
                                    : {
                                        border:
                                            "1px solid var(--color-border)",
                                        backgroundColor:
                                            "var(--color-surface)",
                                        color:
                                            "var(--color-text)",
                                    }
                            }
                        >
                            {categoria.nombre}
                        </button>
                    ))}
                </div>
            </div>

            {/* ==================================================
                RESUMEN
            ================================================== */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div
                    className="rounded-2xl border p-4 shadow-sm"
                    style={{
                        borderColor:
                            "var(--color-border)",
                        backgroundColor:
                            "var(--color-surface)",
                    }}
                >
                    <p
                        className="text-xs font-medium"
                        style={{
                            color:
                                "var(--color-text-secondary)",
                        }}
                    >
                        Productos encontrados
                    </p>

                    <p
                        className="mt-1 text-2xl font-bold"
                        style={{
                            color:
                                "var(--color-text)",
                        }}
                    >
                        {totalProductos}
                    </p>
                </div>

                <div
                    className="rounded-2xl border p-4 shadow-sm"
                    style={{
                        borderColor:
                            "var(--color-border)",
                        backgroundColor:
                            "var(--color-surface)",
                    }}
                >
                    <p
                        className="text-xs font-medium"
                        style={{
                            color:
                                "var(--color-text-secondary)",
                        }}
                    >
                        Disponibles
                    </p>

                    <p
                        className="mt-1 text-2xl font-bold"
                        style={{
                            color:
                                "var(--color-success)",
                        }}
                    >
                        {productosDisponibles}
                    </p>
                </div>

                <div
                    className="rounded-2xl border p-4 shadow-sm"
                    style={{
                        borderColor:
                            "var(--color-border)",
                        backgroundColor:
                            "var(--color-surface)",
                    }}
                >
                    <p
                        className="text-xs font-medium"
                        style={{
                            color:
                                "var(--color-text-secondary)",
                        }}
                    >
                        Agotados
                    </p>

                    <p
                        className="mt-1 text-2xl font-bold"
                        style={{
                            color:
                                "var(--color-danger)",
                        }}
                    >
                        {productosAgotados}
                    </p>
                </div>
            </div>

            {/* ==================================================
                CARGANDO PRODUCTOS
            ================================================== */}
            {cargandoProductos ? (
                <div
                    className="flex min-h-[250px] items-center justify-center rounded-2xl border"
                    style={{
                        borderColor:
                            "var(--color-border)",
                        backgroundColor:
                            "var(--color-surface)",
                    }}
                >
                    <div className="text-center">
                        <div className="text-4xl">
                            📦
                        </div>

                        <p
                            className="mt-3 text-sm font-semibold"
                            style={{
                                color:
                                    "var(--color-text)",
                            }}
                        >
                            Cargando inventario...
                        </p>
                    </div>
                </div>
            ) : productosFiltrados.length === 0 ? (
                /* ==================================================
                   SIN RESULTADOS
                   ================================================== */
                <div
                    className="flex min-h-[280px] items-center justify-center rounded-2xl border p-6 text-center"
                    style={{
                        borderColor:
                            "var(--color-border)",
                        backgroundColor:
                            "var(--color-surface)",
                    }}
                >
                    <div>
                        <div className="text-5xl">
                            🔎
                        </div>

                        <p
                            className="mt-4 text-sm font-semibold"
                            style={{
                                color:
                                    "var(--color-text)",
                            }}
                        >
                            No se encontraron productos
                        </p>

                        <p
                            className="mt-1 text-xs"
                            style={{
                                color:
                                    "var(--color-text-secondary)",
                            }}
                        >
                            Intenta con otro nombre, código de barras,
                            SKU o categoría.
                        </p>

                        {busqueda && (
                            <button
                                type="button"
                                onClick={() =>
                                    setBusqueda("")
                                }
                                className="mt-4 min-h-10 rounded-xl border px-4 py-2 text-sm font-semibold transition active:scale-[0.98]"
                                style={{
                                    borderColor:
                                        "var(--color-border)",
                                    backgroundColor:
                                        "var(--color-surface)",
                                    color:
                                        "var(--color-text)",
                                }}
                            >
                                Limpiar búsqueda
                            </button>
                        )}
                    </div>
                </div>
            ) : (
                /* ==================================================
                   LISTA DE PRODUCTOS
                   ================================================== */
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {productosFiltrados.map(
                        (producto) => {
                            const disponible =
                                producto.stock > 0;

                            return (
                                <div
                                    key={producto.id}
                                    className="overflow-hidden rounded-2xl border shadow-sm transition hover:shadow-md"
                                    style={{
                                        borderColor:
                                            "var(--color-border)",
                                        backgroundColor:
                                            "var(--color-surface)",
                                    }}
                                >
                                    {/* IMAGEN */}
                                    <div
                                        className="flex h-44 items-center justify-center border-b"
                                        style={{
                                            borderColor:
                                                "var(--color-border)",
                                            backgroundColor:
                                                "var(--color-background)",
                                        }}
                                    >
                                        {producto.imagen_url ? (
                                            <img
                                                src={
                                                    producto.imagen_url
                                                }
                                                alt={
                                                    producto.nombre
                                                }
                                                className="h-full w-full object-contain p-3"
                                            />
                                        ) : (
                                            <div
                                                className="text-6xl opacity-40"
                                                style={{
                                                    color:
                                                        "var(--color-text-secondary)",
                                                }}
                                            >
                                                📦
                                            </div>
                                        )}
                                    </div>

                                    {/* INFORMACIÓN */}
                                    <div className="p-4">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <h2
                                                    className="line-clamp-2 text-sm font-semibold"
                                                    style={{
                                                        color:
                                                            "var(--color-text)",
                                                    }}
                                                >
                                                    {
                                                        producto.nombre
                                                    }
                                                </h2>

                                                {producto.categoria_nombre && (
                                                    <p
                                                        className="mt-1 text-xs"
                                                        style={{
                                                            color:
                                                                "var(--color-text-secondary)",
                                                        }}
                                                    >
                                                        {
                                                            producto.categoria_nombre
                                                        }
                                                    </p>
                                                )}
                                            </div>

                                            <span
                                                className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold"
                                                style={
                                                    disponible
                                                        ? {
                                                            backgroundColor:
                                                                "color-mix(in srgb, var(--color-success) 12%, transparent)",
                                                            color:
                                                                "var(--color-success)",
                                                        }
                                                        : {
                                                            backgroundColor:
                                                                "var(--color-danger-soft)",
                                                            color:
                                                                "var(--color-danger)",
                                                        }
                                                }
                                            >
                                                {disponible
                                                    ? "Disponible"
                                                    : "Agotado"}
                                            </span>
                                        </div>

                                        {/* PRECIO */}
                                        <div className="mt-4 flex items-end justify-between gap-4">
                                            <div>
                                                <p
                                                    className="text-xs"
                                                    style={{
                                                        color:
                                                            "var(--color-text-secondary)",
                                                    }}
                                                >
                                                    Precio de venta
                                                </p>

                                                <p
                                                    className="mt-1 text-xl font-bold"
                                                    style={{
                                                        color:
                                                            "var(--color-text)",
                                                    }}
                                                >
                                                    $
                                                    {producto.precio_venta.toFixed(
                                                        2
                                                    )}
                                                </p>
                                            </div>

                                            {/* EXISTENCIA */}
                                            <div className="text-right">
                                                <p
                                                    className="text-xs"
                                                    style={{
                                                        color:
                                                            "var(--color-text-secondary)",
                                                    }}
                                                >
                                                    Existencia
                                                </p>

                                                <p
                                                    className="mt-1 text-xl font-bold"
                                                    style={{
                                                        color: disponible
                                                            ? "var(--color-success)"
                                                            : "var(--color-danger)",
                                                    }}
                                                >
                                                    {
                                                        producto.stock
                                                    }
                                                </p>

                                                <p
                                                    className="text-[11px]"
                                                    style={{
                                                        color:
                                                            "var(--color-text-secondary)",
                                                    }}
                                                >
                                                    {
                                                        producto.unidad
                                                    }
                                                </p>
                                            </div>
                                        </div>

                                        {/* CÓDIGOS */}
                                        <div
                                            className="mt-4 space-y-1 border-t pt-3"
                                            style={{
                                                borderColor:
                                                    "var(--color-border)",
                                            }}
                                        >
                                            {producto.codigo_barras && (
                                                <div className="flex justify-between gap-3 text-xs">
                                                    <span
                                                        style={{
                                                            color:
                                                                "var(--color-text-secondary)",
                                                        }}
                                                    >
                                                        Código
                                                    </span>

                                                    <span
                                                        className="truncate font-medium"
                                                        style={{
                                                            color:
                                                                "var(--color-text)",
                                                        }}
                                                    >
                                                        {
                                                            producto.codigo_barras
                                                        }
                                                    </span>
                                                </div>
                                            )}

                                            {producto.sku && (
                                                <div className="flex justify-between gap-3 text-xs">
                                                    <span
                                                        style={{
                                                            color:
                                                                "var(--color-text-secondary)",
                                                        }}
                                                    >
                                                        SKU
                                                    </span>

                                                    <span
                                                        className="truncate font-medium"
                                                        style={{
                                                            color:
                                                                "var(--color-text)",
                                                        }}
                                                    >
                                                        {
                                                            producto.sku
                                                        }
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        }
                    )}
                </div>
            )}
        </div>
    );
}