"use client";

import { useEffect, useRef, useState } from "react";

import { supabasePOS } from "../../lib/supabase";

/*
 * ==========================================
 * PRODUCTO
 * ==========================================
 */

export interface ProductoVenta {

    id: string;

    nombre: string;

    codigo_barras: string | null;

    sku: string | null;

    categoria_id: string | null;

    categoria_nombre: string | null;

    precio_base: number;

    precio_venta: number;

    stock: number;

    unidad: string;

    imagen_url: string | null;

    activo: boolean;

}

/*
 * ==========================================
 * CATEGORÍA
 * ==========================================
 */

interface Categoria {

    id: string;

    nombre: string;

}

/*
 * ==========================================
 * PROPS
 * ==========================================
 */

interface BuscadorProductosProps {

    sucursalId: string;

    negocioId: string;

    onAgregarProducto: (producto: ProductoVenta) => void;

}

/*
 * ==========================================
 * COMPONENTE
 * ==========================================
 */

export default function BuscadorProductos({

    sucursalId,

    negocioId,

    onAgregarProducto,

}: BuscadorProductosProps) {

    /*
     * ==========================================
     * ESTADOS
     * ==========================================
     */

    const [busqueda, setBusqueda] = useState("");

    const [

        categoriaSeleccionada,

        setCategoriaSeleccionada,

    ] = useState("");

    const [categorias, setCategorias] = useState<Categoria[]>([]);

    const [productos, setProductos] = useState<ProductoVenta[]>([]);

    const [cargando, setCargando] = useState(false);

    const [cargandoCategorias, setCargandoCategorias] =

        useState(false);

    const [error, setError] = useState("");

    /*
     * ==========================================
     * REFERENCIA AL INPUT
     * ==========================================
     *
     * Nos permite mantener el comportamiento
     * del lector de código de barras.
     */

    const inputRef = useRef<HTMLInputElement | null>(null);

    /*
     * ==========================================
     * DEBUG INICIAL
     * ==========================================
     */

    useEffect(() => {

        console.log(

            "=========================================="

        );

        console.log(

            "🔎 BUSCADOR DE PRODUCTOS INICIADO"

        );

        console.log(

            "🏢 NEGOCIO ID:",

            negocioId

        );

        console.log(

            "🏪 SUCURSAL ID:",

            sucursalId

        );

        console.log(

            "=========================================="

        );

    }, [negocioId, sucursalId]);

    /*
     * ==========================================
     * CARGAR CATEGORÍAS
     * ==========================================
     */

    useEffect(() => {

        let cancelado = false;

        async function cargarCategorias() {

            if (!negocioId) {

                console.warn(

                    "⚠️ No existe negocioId para cargar categorías."

                );

                setCategorias([]);

                return;

            }

            setCargandoCategorias(true);

            setError("");

            try {

                /*
                 * ======================================
                 * VERIFICAR USUARIO AUTENTICADO
                 * ======================================
                 */

                const {

                    data: usuarioAuth,

                    error: errorAuth,

                } = await supabasePOS.auth.getUser();

                console.log(

                    "🔐 AUTH UID DESDE BUSCADOR POS:",

                    usuarioAuth?.user?.id

                );

                console.log(

                    "🔐 ERROR AUTH POS:",

                    errorAuth

                );

                /*
                 * ======================================
                 * VERIFICAR NEGOCIO SEGÚN RPC
                 * ======================================
                 */

                const {

                    data: negocioFuncion,

                    error: errorFuncion,

                } = await supabasePOS.rpc(

                    "get_mi_negocio_id"

                );

                console.log(

                    "🏢 NEGOCIO SEGÚN get_mi_negocio_id():",

                    negocioFuncion

                );

                console.log(

                    "❌ ERROR get_mi_negocio_id():",

                    errorFuncion

                );

                /*
                 * ======================================
                 * CARGAR CATEGORÍAS
                 * ======================================
                 */

                console.log(

                    "📂 CARGANDO CATEGORÍAS DEL NEGOCIO:",

                    negocioId

                );

                const {

                    data,

                    error: errorCategorias,

                } = await supabasePOS

                    .from("categorias")

                    .select(

                        "id, nombre, negocio_id, activo"

                    )

                    .eq(

                        "negocio_id",

                        negocioId

                    )

                    .eq(

                        "activo",

                        true

                    )

                    .order(

                        "nombre",

                        {

                            ascending: true,

                        }

                    );

                if (errorCategorias) {

                    console.error(

                        "❌ ERROR CARGANDO CATEGORÍAS:",

                        errorCategorias

                    );

                    if (!cancelado) {

                        setError(

                            "No se pudieron cargar las categorías."

                        );

                    }

                    return;

                }

                console.log(

                    "✅ CATEGORÍAS ENCONTRADAS:",

                    data

                );

                if (!cancelado) {

                    setCategorias(

                        (data ?? []).map(

                            (categoria: any) => ({

                                id: categoria.id,

                                nombre: categoria.nombre,

                            })

                        )

                    );

                }

            } catch (error) {

                console.error(

                    "❌ ERROR INESPERADO CARGANDO CATEGORÍAS:",

                    error

                );

                if (!cancelado) {

                    setError(

                        "Ocurrió un error al cargar las categorías."

                    );

                }

            } finally {

                if (!cancelado) {

                    setCargandoCategorias(false);

                }

            }

        }

        cargarCategorias();

        return () => {

            cancelado = true;

        };

    }, [negocioId]);

    /*
     * ==========================================
     * BUSCAR PRODUCTOS
     * ==========================================
     */

    useEffect(() => {

        let cancelado = false;

        async function buscarProductos() {

            const termino = busqueda.trim();

            /*
             * ======================================
             * VALIDAR NEGOCIO Y SUCURSAL
             * ======================================
             */

            if (!negocioId || !sucursalId) {

                setProductos([]);

                setCargando(false);

                return;

            }

            /*
             * ======================================
             * SI NO HAY BÚSQUEDA NI CATEGORÍA
             * ======================================
             */

            if (

                !termino &&

                !categoriaSeleccionada

            ) {

                setProductos([]);

                setCargando(false);

                return;

            }

            setCargando(true);

            setError("");

            try {

                console.log(

                    "=========================================="

                );

                console.log(

                    "🔎 CONSULTANDO PRODUCTOS"

                );

                console.log(

                    "🏢 Negocio:",

                    negocioId

                );

                console.log(

                    "🏪 Sucursal:",

                    sucursalId

                );

                console.log(

                    "🔍 Búsqueda:",

                    termino

                );

                console.log(

                    "📂 Categoría:",

                    categoriaSeleccionada

                );

                /*
                 * ======================================
                 * OBTENER PRODUCTOS
                 * ======================================
                 */

                let consulta = supabasePOS

                    .from("productos")

                    .select(`

            id,

            nombre,

            codigo_barras,

            sku,

            categoria_id,

            precio_base,

            precio_venta,

            unidad,

            imagen_url,

            activo,

            negocio_id,

            categoria:categorias(

              nombre

            ),

            inventario:inventario(

              stock,

              sucursal_id

            )

          `)

                    .eq(

                        "negocio_id",

                        negocioId

                    )

                    .eq(

                        "activo",

                        true

                    );

                /*
                 * ======================================
                 * FILTRO POR CATEGORÍA
                 * ======================================
                 */

                if (categoriaSeleccionada) {

                    consulta = consulta.eq(

                        "categoria_id",

                        categoriaSeleccionada

                    );

                }

                /*
                 * ======================================
                 * BÚSQUEDA
                 * ======================================
                 *
                 * Buscamos por:
                 *
                 * - nombre
                 * - código de barras
                 * - SKU
                 */

                if (termino) {

                    const terminoNormalizado =

                        termino

                            .toLowerCase()

                            .trim();

                    /*
                     * Escapar caracteres especiales
                     * utilizados por el filtro de Supabase.
                     */

                    const terminoSeguro =

                        terminoNormalizado

                            .replace(/\\/g, "\\\\")

                            .replace(/%/g, "\\%")

                            .replace(/,/g, "\\,");

                    consulta = consulta.or(

                        `nombre.ilike.%${terminoSeguro}%,codigo_barras.ilike.%${terminoSeguro}%,sku.ilike.%${terminoSeguro}%`

                    );

                }

                /*
                 * ======================================
                 * EJECUTAR CONSULTA
                 * ======================================
                 */

                const {

                    data,

                    error: errorProductos,

                } = await consulta

                    .order(

                        "nombre",

                        {

                            ascending: true,

                        }

                    )

                    .limit(50);

                if (errorProductos) {

                    console.error(

                        "❌ ERROR BUSCANDO PRODUCTOS:",

                        errorProductos

                    );

                    if (!cancelado) {

                        setError(

                            "No se pudieron buscar los productos."

                        );

                    }

                    return;

                }

                console.log(

                    "📦 PRODUCTOS RECIBIDOS:",

                    data

                );

                console.log(

                    "📦 TOTAL PRODUCTOS:",

                    data?.length ?? 0

                );

                /*
                 * ======================================
                 * FORMATEAR PRODUCTOS
                 * ======================================
                 */

                const productosFormateados =

                    (data ?? []).map(

                        (

                            producto: any

                        ): ProductoVenta => {

                            /*
                             * ==================================
                             * INVENTARIO DE LA SUCURSAL ACTUAL
                             * ==================================
                             */

                            const inventarioSucursal =

                                Array.isArray(

                                    producto.inventario

                                )

                                    ? producto.inventario.find(

                                        (

                                            item: any

                                        ) =>

                                            item.sucursal_id ===

                                            sucursalId

                                    )

                                    : null;

                            /*
                             * ==================================
                             * CATEGORÍA
                             * ==================================
                             */

                            let categoriaNombre:

                                | string

                                | null = null;

                            if (

                                Array.isArray(

                                    producto.categoria

                                )

                            ) {

                                categoriaNombre =

                                    producto

                                        .categoria[0]

                                        ?.nombre ??

                                    null;

                            } else {

                                categoriaNombre =

                                    producto

                                        .categoria

                                        ?.nombre ??

                                    null;

                            }

                            /*
                             * ==================================
                             * PRODUCTO FORMATEADO
                             * ==================================
                             */

                            return {

                                id: producto.id,

                                nombre:

                                    producto.nombre,

                                codigo_barras:

                                    producto.codigo_barras,

                                sku:

                                    producto.sku,

                                categoria_id:

                                    producto.categoria_id ??

                                    null,

                                categoria_nombre:

                                    categoriaNombre,

                                precio_base:

                                    Number(

                                        producto.precio_base

                                    ),

                                precio_venta:

                                    Number(

                                        producto.precio_venta

                                    ),

                                stock:

                                    Number(

                                        inventarioSucursal?.stock ??

                                        0

                                    ),

                                unidad:

                                    producto.unidad,

                                imagen_url:

                                    producto.imagen_url,

                                activo:

                                    producto.activo,

                            };

                        }

                    );

                /*
                 * ======================================
                 * FILTRAR POR CATEGORÍA ESCRITA
                 * ======================================
                 *
                 * Ejemplo:
                 *
                 * Si el usuario escribe:
                 *
                 * "bebidas"
                 *
                 * intentamos encontrar la categoría
                 * correspondiente.
                 */

                let productosFinales =

                    productosFormateados;

                if (

                    termino &&

                    !categoriaSeleccionada

                ) {

                    const terminoNormalizado =

                        termino

                            .toLowerCase()

                            .trim();

                    const categoriaCoincide =

                        categorias.find(

                            (

                                categoria

                            ) =>

                                categoria.nombre

                                    .toLowerCase()

                                    .includes(

                                        terminoNormalizado

                                    )

                        );

                    if (categoriaCoincide) {

                        console.log(

                            "📂 CATEGORÍA COINCIDENTE:",

                            categoriaCoincide

                        );

                        /*
                         * ==================================
                         * BUSCAR PRODUCTOS DE LA CATEGORÍA
                         * ==================================
                         */

                        const {

                            data:

                            productosCategoria,

                            error:

                            errorCategoria,

                        } = await supabasePOS

                            .from("productos")

                            .select(`

                id,

                nombre,

                codigo_barras,

                sku,

                categoria_id,

                precio_base,

                precio_venta,

                unidad,

                imagen_url,

                activo,

                negocio_id,

                categoria:categorias(

                  nombre

                ),

                inventario:inventario(

                  stock,

                  sucursal_id

                )

              `)

                            .eq(

                                "negocio_id",

                                negocioId

                            )

                            .eq(

                                "activo",

                                true

                            )

                            .eq(

                                "categoria_id",

                                categoriaCoincide.id

                            )

                            .order(

                                "nombre",

                                {

                                    ascending: true,

                                }

                            )

                            .limit(50);

                        if (

                            !errorCategoria &&

                            productosCategoria

                        ) {

                            const productosDeCategoria =

                                productosCategoria.map(

                                    (

                                        producto: any

                                    ): ProductoVenta => {

                                        /*
                                         * ==================================
                                         * INVENTARIO SUCURSAL
                                         * ==================================
                                         */

                                        const inventarioSucursal =

                                            Array.isArray(

                                                producto.inventario

                                            )

                                                ? producto.inventario.find(

                                                    (

                                                        item: any

                                                    ) =>

                                                        item.sucursal_id ===

                                                        sucursalId

                                                )

                                                : null;

                                        /*
                                         * ==================================
                                         * CATEGORÍA
                                         * ==================================
                                         */

                                        let categoriaNombre:

                                            | string

                                            | null = null;

                                        if (

                                            Array.isArray(

                                                producto.categoria

                                            )

                                        ) {

                                            categoriaNombre =

                                                producto

                                                    .categoria[0]

                                                    ?.nombre ??

                                                null;

                                        } else {

                                            categoriaNombre =

                                                producto

                                                    .categoria

                                                    ?.nombre ??

                                                null;

                                        }

                                        /*
                                         * ==================================
                                         * PRODUCTO
                                         * ==================================
                                         */

                                        return {

                                            id:

                                                producto.id,

                                            nombre:

                                                producto.nombre,

                                            codigo_barras:

                                                producto.codigo_barras,

                                            sku:

                                                producto.sku,

                                            categoria_id:

                                                producto.categoria_id ??

                                                null,

                                            categoria_nombre:

                                                categoriaNombre,

                                            precio_base:

                                                Number(

                                                    producto.precio_base

                                                ),

                                            precio_venta:

                                                Number(

                                                    producto.precio_venta

                                                ),

                                            stock:

                                                Number(

                                                    inventarioSucursal?.stock ??

                                                    0

                                                ),

                                            unidad:

                                                producto.unidad,

                                            imagen_url:

                                                producto.imagen_url,

                                            activo:

                                                producto.activo,

                                        };

                                    }

                                );

                            /*
                             * ==================================
                             * EVITAR DUPLICADOS
                             * ==================================
                             */

                            const mapa =

                                new Map<

                                    string,

                                    ProductoVenta

                                >();

                            [

                                ...productosFormateados,

                                ...productosDeCategoria,

                            ].forEach(

                                (

                                    producto

                                ) => {

                                    mapa.set(

                                        producto.id,

                                        producto

                                    );

                                }

                            );

                            productosFinales =

                                Array.from(

                                    mapa.values()

                                );

                        } else if (

                            errorCategoria

                        ) {

                            console.error(

                                "❌ ERROR BUSCANDO PRODUCTOS POR CATEGORÍA:",

                                errorCategoria

                            );

                        }

                    }

                }

                /*
                 * ======================================
                 * ORDENAR RESULTADOS
                 * ======================================
                 */

                productosFinales.sort(

                    (

                        a,

                        b

                    ) =>

                        a.nombre.localeCompare(

                            b.nombre,

                            "es",

                            {

                                sensitivity:

                                    "base",

                            }

                        )

                );

                /*
                 * ======================================
                 * DEBUG FINAL
                 * ======================================
                 */

                console.log(

                    "✅ PRODUCTOS FINALES:",

                    productosFinales

                );

                console.log(

                    "✅ TOTAL FINAL:",

                    productosFinales.length

                );

                /*
                 * ======================================
                 * GUARDAR RESULTADOS
                 * ======================================
                 */

                if (!cancelado) {

                    setProductos(

                        productosFinales

                    );

                }

            } catch (error) {

                console.error(

                    "❌ ERROR INESPERADO BUSCANDO PRODUCTOS:",

                    error

                );

                if (!cancelado) {

                    setError(

                        "Ocurrió un error al buscar productos."

                    );

                }

            } finally {

                if (!cancelado) {

                    setCargando(false);

                }

            }

        }

        /*
         * ==========================================
         * DEBOUNCE
         * ==========================================
         *
         * Evitamos realizar una consulta por
         * cada tecla inmediatamente.
         */

        const temporizador =

            setTimeout(

                buscarProductos,

                200

            );

        return () => {

            cancelado = true;

            clearTimeout(

                temporizador

            );

        };

    }, [

        busqueda,

        categoriaSeleccionada,

        sucursalId,

        negocioId,

        categorias,

    ]);

    /*
     * ==========================================
     * CAMBIAR CATEGORÍA
     * ==========================================
     */

    function seleccionarCategoria(

        categoriaId: string

    ) {

        setCategoriaSeleccionada(

            categoriaId

        );

        /*
         * Si seleccionamos una categoría,
         * limpiamos la búsqueda de texto.
         */

        setBusqueda("");

        /*
         * Enfocar buscador para poder
         * continuar utilizando el teclado
         * o escáner.
         */

        setTimeout(() => {

            inputRef.current?.focus();

        }, 0);

    }

    /*
     * ==========================================
     * RENDER
     * ==========================================
     */

    return (

        <div className="space-y-4">

            {/* ================================== */}

            {/* BUSCADOR */}

            {/* ================================== */}

            <div className="relative">

                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lg">

                    🔎

                </span>

                <input

                    ref={inputRef}

                    type="text"

                    value={busqueda}

                    onChange={(e) =>

                        setBusqueda(

                            e.target.value

                        )

                    }

                    placeholder="Buscar producto, código de barras, SKU o categoría..."

                    autoComplete="off"

                    className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] py-3 pl-11 pr-4 text-sm text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)] focus:ring-4 focus:ring-blue-100"

                />

            </div>

            {/* ================================== */}

            {/* CATEGORÍAS */}

            {/* ================================== */}

            <div>

                <div className="mb-2 flex items-center justify-between">

                    <p className="text-sm font-semibold text-[var(--color-text)]">

                        Categorías

                    </p>

                    {categoriaSeleccionada && (

                        <button

                            type="button"

                            onClick={() =>

                                seleccionarCategoria("")

                            }

                            className="text-xs font-semibold text-[var(--color-primary)] hover:underline"

                        >

                            Ver todas

                        </button>

                    )}

                </div>

                {cargandoCategorias ? (

                    <div className="rounded-xl bg-slate-50 p-3">

                        <p className="text-xs text-[var(--color-text-secondary)]">

                            Cargando categorías...

                        </p>

                    </div>

                ) : categorias.length === 0 ? (

                    <div className="rounded-xl bg-slate-50 p-3">

                        <p className="text-xs text-[var(--color-text-secondary)]">

                            No hay categorías disponibles.

                        </p>

                    </div>

                ) : (

                    <div className="flex gap-2 overflow-x-auto pb-2">

                        {/* TODAS */}

                        <button

                            type="button"

                            onClick={() =>

                                seleccionarCategoria("")

                            }

                            className={`shrink-0 rounded-full px-4 py-2 text-xs font-semibold transition ${categoriaSeleccionada === ""

                                ? "bg-[var(--color-primary)] text-white"

                                : "border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] hover:bg-slate-50"

                                }`}

                        >

                            Todas

                        </button>

                        {/* CATEGORÍAS */}

                        {categorias.map(

                            (categoria) => (

                                <button

                                    key={categoria.id}

                                    type="button"

                                    onClick={() =>

                                        seleccionarCategoria(

                                            categoria.id

                                        )

                                    }

                                    className={`shrink-0 rounded-full px-4 py-2 text-xs font-semibold transition ${categoriaSeleccionada ===

                                        categoria.id

                                        ? "bg-[var(--color-primary)] text-white"

                                        : "border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] hover:bg-slate-50"

                                        }`}

                                >

                                    {categoria.nombre}

                                </button>

                            )

                        )}

                    </div>

                )}

            </div>

            {/* ================================== */}

            {/* CARGANDO */}

            {/* ================================== */}

            {cargando && (

                <div className="rounded-xl bg-slate-50 p-4 text-center">

                    <p className="text-sm text-[var(--color-text-secondary)]">

                        Buscando productos...

                    </p>

                </div>

            )}

            {/* ================================== */}

            {/* ERROR */}

            {/* ================================== */}

            {error && (

                <div className="rounded-xl border border-red-200 bg-red-50 p-4">

                    <p className="text-sm text-red-700">

                        {error}

                    </p>

                </div>

            )}

            {/* ================================== */}

            {/* SIN RESULTADOS */}

            {/* ================================== */}

            {!cargando &&

                (busqueda.trim() ||

                    categoriaSeleccionada) &&

                productos.length === 0 &&

                !error && (

                    <div className="rounded-xl bg-slate-50 p-6 text-center">

                        <p className="text-sm font-semibold text-[var(--color-text)]">

                            No se encontraron productos

                        </p>

                        <p className="mt-1 text-xs text-[var(--color-text-secondary)]">

                            Intenta con otro nombre,

                            código, SKU o categoría.

                        </p>

                    </div>

                )}

            {/* ================================== */}

            {/* LISTA DE PRODUCTOS */}

            {/* ================================== */}

            {productos.length > 0 && (

                <div className="max-h-[500px] space-y-2 overflow-y-auto">

                    {productos.map(

                        (producto) => {

                            const sinStock =

                                producto.stock <= 0;

                            return (

                                <button

                                    key={producto.id}

                                    type="button"

                                    disabled={sinStock}

                                    onClick={() =>

                                        onAgregarProducto(

                                            producto

                                        )

                                    }

                                    className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-left transition hover:border-[var(--color-primary)] hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"

                                >

                                    <div className="flex items-center justify-between gap-4">
                                        {/* FOTO */}
                                        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-[var(--color-border)] bg-slate-50">
                                            {producto.imagen_url ? (
                                                <img
                                                    src={producto.imagen_url}
                                                    alt={producto.nombre}
                                                    className="h-full w-full object-cover"
                                                />
                                            ) : (
                                                <div className="flex h-full w-full items-center justify-center text-xl text-slate-300">
                                                    📦
                                                </div>
                                            )}
                                        </div>

                                        {/* INFORMACIÓN */}
                                        <div className="min-w-0 flex-1">

                                            <p className="truncate text-sm font-semibold text-[var(--color-text)]">

                                                {producto.nombre}

                                            </p>

                                            {/* CATEGORÍA */}

                                            {producto.categoria_nombre && (

                                                <span className="mt-1 inline-flex rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">

                                                    {

                                                        producto.categoria_nombre

                                                    }

                                                </span>

                                            )}

                                            {/* CÓDIGO Y SKU */}

                                            <div className="mt-1 flex flex-wrap gap-2">

                                                {producto.codigo_barras && (

                                                    <span className="text-xs text-[var(--color-text-secondary)]">

                                                        CB:{" "}

                                                        {

                                                            producto.codigo_barras

                                                        }

                                                    </span>

                                                )}

                                                {producto.sku && (

                                                    <span className="text-xs text-[var(--color-text-secondary)]">

                                                        SKU:{" "}

                                                        {

                                                            producto.sku

                                                        }

                                                    </span>

                                                )}

                                            </div>

                                            {/* STOCK */}

                                            <p

                                                className={`mt-1 text-xs font-medium ${sinStock

                                                    ? "text-red-600"

                                                    : "text-green-600"

                                                    }`}

                                            >

                                                {sinStock

                                                    ? "Sin existencia"

                                                    : `Stock: ${producto.stock} ${producto.unidad}`}

                                            </p>

                                        </div>

                                        {/* PRECIO */}

                                        <div className="shrink-0 text-right">

                                            <p className="text-lg font-bold text-[var(--color-text)]">

                                                $

                                                {producto.precio_venta.toFixed(

                                                    2

                                                )}

                                            </p>

                                            {!sinStock && (

                                                <p className="text-xs font-medium text-[var(--color-primary)]">

                                                    Agregar

                                                </p>

                                            )}

                                        </div>

                                    </div>

                                </button>

                            );

                        }

                    )}

                </div>

            )}

        </div>

    );

}