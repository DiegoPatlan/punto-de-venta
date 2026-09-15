"use client";

import {
    useEffect,
    useRef,
    useState,
} from "react";

import BuscadorProductos, {
    ProductoVenta,
} from "./BuscadorProductos";

import CarritoVenta, {
    ItemCarrito,
} from "./CarritoVenta";

import { supabasePOS } from "../../lib/supabase";

import ModalCobro from "./ModalCobro";
import ModalMensaje from "./ModalMensaje";

interface PuntoDeVentaProps {
    sesionId: string;
    cajaId: string;
    sucursalId: string;
    usuarioId: string;
    negocioId: string;
    cajaNombre: string;
    sucursalNombre: string;
    usuarioNombre: string;
    usuarioRol: string;
    onSalir: () => void;
}

interface ProductoEscaneado {
    id: string;
    nombre: string;
    codigo_barras: string | null;
    sku: string | null;

    // Precio que paga el cliente.
    precio_venta: number | string;

    // Precio antes de IVA.
    precio_base: number | string | null;

    unidad: string;
    imagen_url: string | null;
    activo: boolean;
    categoria_id: string | null;
}

interface Cliente {
    id: string;
    nombre: string;
    telefono: string | null;
    email: string | null;
    limite_credito: number;
    saldo_credito: number;
    activo: boolean;
}

export default function PuntoDeVenta({
    sesionId,
    cajaId,
    sucursalId,
    usuarioId,
    negocioId,
    cajaNombre,
    sucursalNombre,
    usuarioNombre,
    usuarioRol,
    onSalir,
}: PuntoDeVentaProps) {
    const [nombreNegocio, setNombreNegocio] =
        useState("Punto de Venta");

    /*
    ==========================================
    CONFIGURACIÓN FISCAL
    ==========================================
    */

    const [impuestosActivos, setImpuestosActivos] =
        useState(false);

    const [ivaPorcentaje, setIvaPorcentaje] =
        useState(16);

    const [carrito, setCarrito] =
        useState<ItemCarrito[]>([]);

    const [mensajeVenta, setMensajeVenta] =
        useState<{
            folio: number;
            total: number;
            cambio: number;
            impresion: boolean;
        } | null>(null);

    const [modalCobroAbierto, setModalCobroAbierto] =
        useState(false);

    /*
    ==========================================
    CLIENTE
    ==========================================
    */

    const [clienteSeleccionado, setClienteSeleccionado] =
        useState<Cliente | null>(null);

    const [busquedaCliente, setBusquedaCliente] =
        useState("");

    const [clientes, setClientes] =
        useState<Cliente[]>([]);

    const [cargandoClientes, setCargandoClientes] =
        useState(false);

    /*
    ==========================================
    ESCÁNER
    ==========================================
    */

    const [mensajeEscaner, setMensajeEscaner] =
        useState("");

    const [escaneando, setEscaneando] =
        useState(false);

    const bufferEscaner =
        useRef("");

    const tiempoUltimaTecla =
        useRef(0);

    const procesandoEscaner =
        useRef(false);

    /*
    ==========================================
    MODAL DE MENSAJES
    ==========================================
    */

    const [modalMensaje, setModalMensaje] =
        useState<{
            abierto: boolean;
            tipo:
            | "exito"
            | "error"
            | "confirmacion"
            | "info";
            titulo: string;
            mensaje: string;
        }>({
            abierto: false,
            tipo: "info",
            titulo: "",
            mensaje: "",
        });

    function mostrarMensaje(
        tipo:
            | "exito"
            | "error"
            | "confirmacion"
            | "info",
        titulo: string,
        mensaje: string
    ) {
        setModalMensaje({
            abierto: true,
            tipo,
            titulo,
            mensaje,
        });
    }

    /*
    ==========================================
    BUSCAR CLIENTES
    ==========================================
    */

    useEffect(() => {
        let cancelado = false;

        async function buscarClientes() {
            const texto =
                busquedaCliente.trim();

            if (!texto) {
                setClientes([]);
                setCargandoClientes(false);
                return;
            }

            setCargandoClientes(true);

            try {
                const {
                    data,
                    error,
                } = await supabasePOS
                    .from("clientes")
                    .select(`
                        id,
                        nombre,
                        telefono,
                        email,
                        limite_credito,
                        saldo_credito,
                        activo
                    `)
                    .eq(
                        "negocio_id",
                        negocioId
                    )
                    .eq("activo", true)
                    .or(
                        `nombre.ilike.%${texto}%,telefono.ilike.%${texto}%,email.ilike.%${texto}%`
                    )
                    .order("nombre")
                    .limit(10);

                if (cancelado) {
                    return;
                }

                if (error) {
                    console.error(
                        "❌ ERROR BUSCANDO CLIENTES:",
                        error
                    );

                    setClientes([]);
                    return;
                }

                setClientes(
                    (data ?? []) as Cliente[]
                );
            } catch (error) {
                console.error(
                    "❌ ERROR BUSCANDO CLIENTES:",
                    error
                );

                if (!cancelado) {
                    setClientes([]);
                }
            } finally {
                if (!cancelado) {
                    setCargandoClientes(false);
                }
            }
        }

        const temporizador =
            setTimeout(
                buscarClientes,
                250
            );

        return () => {
            cancelado = true;
            clearTimeout(
                temporizador
            );
        };
    }, [
        busquedaCliente,
        negocioId,
    ]);

    /*
    ==========================================
    CARGAR NEGOCIO + IVA
    ==========================================
    */

    useEffect(() => {
        let cancelado = false;

        async function cargarNegocio() {
            const {
                data,
                error,
            } = await supabasePOS
                .from("negocios")
                .select(`
                    nombre,
                    impuestos_activos,
                    iva_porcentaje
                `)
                .eq("id", negocioId)
                .maybeSingle();

            if (cancelado) {
                return;
            }

            if (error) {
                console.error(
                    "❌ ERROR CARGANDO NEGOCIO:",
                    error
                );

                setNombreNegocio(
                    "Punto de Venta"
                );

                /*
                Si no podemos leer la
                configuración fiscal,
                no mostramos IVA.
                */
                setImpuestosActivos(false);
                setIvaPorcentaje(16);

                return;
            }

            setNombreNegocio(
                data?.nombre?.trim() ||
                "Punto de Venta"
            );

            setImpuestosActivos(
                Boolean(
                    data?.impuestos_activos
                )
            );

            const iva =
                Number(
                    data?.iva_porcentaje
                );

            setIvaPorcentaje(
                Number.isFinite(iva)
                    ? iva
                    : 16
            );
        }

        cargarNegocio();

        return () => {
            cancelado = true;
        };
    }, [negocioId]);

    /*
    ==========================================
    SELECCIONAR CLIENTE
    ==========================================
    */

    function seleccionarCliente(
        cliente: Cliente
    ) {
        setClienteSeleccionado(
            cliente
        );

        setBusquedaCliente("");
        setClientes([]);
    }

    /*
    ==========================================
    QUITAR CLIENTE
    ==========================================
    */

    function quitarCliente() {
        setClienteSeleccionado(null);
        setBusquedaCliente("");
        setClientes([]);
    }

    /*
    ==========================================
    AGREGAR PRODUCTO
    ==========================================
    */

    function agregarProducto(
        producto: ProductoVenta
    ) {
        setCarrito((actual) => {
            const existente =
                actual.find(
                    (item) =>
                        item.producto.id ===
                        producto.id
                );

            if (existente) {
                if (
                    existente.cantidad >=
                    producto.stock
                ) {
                    setMensajeEscaner(
                        `No hay más existencia de "${producto.nombre}".`
                    );

                    return actual;
                }

                return actual.map(
                    (item) =>
                        item.producto.id ===
                            producto.id
                            ? {
                                ...item,
                                cantidad:
                                    item.cantidad +
                                    1,
                            }
                            : item
                );
            }

            return [
                ...actual,
                {
                    producto,
                    cantidad: 1,
                },
            ];
        });
    }

    /*
    ==========================================
    BUSCAR PRODUCTO ESCANEADO
    ==========================================
    */

    async function buscarProductoPorCodigo(
        codigo: string
    ) {
        const codigoLimpio =
            codigo
                .trim()
                .replace(/\r/g, "")
                .replace(/\n/g, "");

        if (!codigoLimpio) {
            return;
        }

        setEscaneando(true);
        setMensajeEscaner("");

        try {
            let productoEncontrado:
                | ProductoEscaneado
                | null = null;

            /*
            ==========================================
            BUSCAR POR CÓDIGO DE BARRAS
            ==========================================
            */

            const {
                data: productoCodigo,
                error: errorCodigo,
            } = await supabasePOS
                .from("productos")
                .select(`
                    id,
                    nombre,
                    codigo_barras,
                    sku,
                    precio_base,
                    precio_venta,
                    unidad,
                    imagen_url,
                    activo,
                    categoria_id
                `)
                .eq(
                    "negocio_id",
                    negocioId
                )
                .eq("activo", true)
                .eq(
                    "codigo_barras",
                    codigoLimpio
                )
                .maybeSingle();

            if (
                !errorCodigo &&
                productoCodigo
            ) {
                productoEncontrado =
                    productoCodigo as ProductoEscaneado;
            }

            /*
            ==========================================
            BUSCAR POR SKU
            ==========================================
            */

            if (!productoEncontrado) {
                const {
                    data: productoSku,
                    error: errorSku,
                } = await supabasePOS
                    .from("productos")
                    .select(`
                        id,
                        nombre,
                        codigo_barras,
                        sku,
                        precio_base,
                        precio_venta,
                        unidad,
                        imagen_url,
                        activo,
                        categoria_id
                    `)
                    .eq(
                        "negocio_id",
                        negocioId
                    )
                    .eq("activo", true)
                    .eq(
                        "sku",
                        codigoLimpio
                    )
                    .maybeSingle();

                if (
                    !errorSku &&
                    productoSku
                ) {
                    productoEncontrado =
                        productoSku as ProductoEscaneado;
                }
            }

            /*
            ==========================================
            PRODUCTO NO ENCONTRADO
            ==========================================
            */

            if (!productoEncontrado) {
                setMensajeEscaner(
                    `No se encontró ningún producto con el código ${codigoLimpio}.`
                );

                return;
            }

            /*
            ==========================================
            INVENTARIO
            ==========================================
            */

            const {
                data: inventario,
                error: errorInventario,
            } = await supabasePOS
                .from("inventario")
                .select(`
                    stock,
                    sucursal_id
                `)
                .eq(
                    "producto_id",
                    productoEncontrado.id
                )
                .eq(
                    "sucursal_id",
                    sucursalId
                )
                .maybeSingle();

            if (errorInventario) {
                console.error(
                    "❌ ERROR INVENTARIO:",
                    errorInventario
                );

                setMensajeEscaner(
                    "No se pudo consultar el inventario del producto."
                );

                return;
            }

            const stock =
                Number(
                    inventario?.stock ?? 0
                );

            if (stock <= 0) {
                setMensajeEscaner(
                    `"${productoEncontrado.nombre}" no tiene existencia en esta sucursal.`
                );

                return;
            }

            /*
            ==========================================
            CONVERTIR PRODUCTO
            ==========================================
            */

            const producto: ProductoVenta =
            {
                id:
                    productoEncontrado.id,

                nombre:
                    productoEncontrado.nombre,

                codigo_barras:
                    productoEncontrado.codigo_barras,

                sku:
                    productoEncontrado.sku,

                precio_venta:
                    Number(
                        productoEncontrado.precio_venta ??
                        productoEncontrado.precio_base ??
                        0
                    ),

                precio_base:
                    Number(
                        productoEncontrado.precio_base ??
                        productoEncontrado.precio_venta ??
                        0
                    ),

                stock,

                unidad:
                    productoEncontrado.unidad,

                imagen_url:
                    productoEncontrado.imagen_url,

                activo:
                    productoEncontrado.activo,

                categoria_id:
                    productoEncontrado.categoria_id,

                categoria_nombre:
                    null,
            };

            agregarProducto(producto);

            setMensajeEscaner(
                `✓ ${producto.nombre} agregado`
            );

            setTimeout(() => {
                setMensajeEscaner("");
            }, 1800);
        } catch (error) {
            console.error(
                "❌ ERROR ESCÁNER:",
                error
            );

            setMensajeEscaner(
                "Ocurrió un error al procesar el código."
            );
        } finally {
            setEscaneando(false);
            procesandoEscaner.current =
                false;
        }
    }

    /*
    ==========================================
    DETECTOR GLOBAL DEL ESCÁNER
    ==========================================
    */

    useEffect(() => {
        function manejarTecla(
            event: KeyboardEvent
        ) {
            const elemento =
                event.target as
                | HTMLElement
                | null;

            const estaEnCampoTexto =
                elemento?.tagName ===
                "INPUT" ||
                elemento?.tagName ===
                "TEXTAREA" ||
                elemento?.tagName ===
                "SELECT";

            if (
                event.key ===
                "Enter"
            ) {
                const codigo =
                    bufferEscaner.current.trim();

                bufferEscaner.current =
                    "";

                if (
                    procesandoEscaner.current
                ) {
                    return;
                }

                if (!codigo) {
                    return;
                }

                if (estaEnCampoTexto) {
                    return;
                }

                event.preventDefault();
                event.stopPropagation();

                procesandoEscaner.current =
                    true;

                buscarProductoPorCodigo(
                    codigo
                );

                return;
            }

            if (
                event.key.length !==
                1
            ) {
                return;
            }

            if (estaEnCampoTexto) {
                return;
            }

            const ahora =
                Date.now();

            const diferencia =
                ahora -
                tiempoUltimaTecla.current;

            if (
                diferencia > 100
            ) {
                bufferEscaner.current =
                    "";
            }

            tiempoUltimaTecla.current =
                ahora;

            bufferEscaner.current +=
                event.key;
        }

        window.addEventListener(
            "keydown",
            manejarTecla
        );

        return () => {
            window.removeEventListener(
                "keydown",
                manejarTecla
            );
        };
    }, [
        negocioId,
        sucursalId,
    ]);

    /*
    ==========================================
    AUMENTAR CANTIDAD
    ==========================================
    */

    function aumentarCantidad(
        productoId: string
    ) {
        setCarrito((actual) =>
            actual.map((item) => {
                if (
                    item.producto.id !==
                    productoId
                ) {
                    return item;
                }

                if (
                    item.cantidad >=
                    item.producto.stock
                ) {
                    return item;
                }

                return {
                    ...item,
                    cantidad:
                        item.cantidad + 1,
                };
            })
        );
    }

    /*
    ==========================================
    DISMINUIR CANTIDAD
    ==========================================
    */

    function disminuirCantidad(
        productoId: string
    ) {
        setCarrito((actual) =>
            actual
                .map((item) => {
                    if (
                        item.producto.id !==
                        productoId
                    ) {
                        return item;
                    }

                    return {
                        ...item,
                        cantidad:
                            item.cantidad - 1,
                    };
                })
                .filter(
                    (item) =>
                        item.cantidad >
                        0
                )
        );
    }

    /*
    ==========================================
    ELIMINAR PRODUCTO
    ==========================================
    */

    function eliminarProducto(
        productoId: string
    ) {
        setCarrito((actual) =>
            actual.filter(
                (item) =>
                    item.producto.id !==
                    productoId
            )
        );
    }

    /*
    ==========================================
    COBRAR VENTA
    ==========================================
    */

    function cobrarVenta() {
        if (
            carrito.length ===
            0
        ) {
            return;
        }

        setModalCobroAbierto(
            true
        );
    }

    /*
    ==========================================
    GENERAR TICKET
    ==========================================
    */

    function generarTicket(
        carritoVenta: ItemCarrito[],
        datosVenta: {
            ventaId: string;
            folio: number;
            total: number;
            cambio: number;
        },
        metodoPago:
            | "efectivo"
            | "tarjeta"
            | "transferencia"
            | "mixto"
            | "credito",
        montoPagado: number,
        pagoMixto?: {
            efectivo: number;
            tarjeta: number;
        },
        cliente?: Cliente | null,
        tipoTicket:
            | "cliente"
            | "tienda" = "cliente"
    ) {
        const ANCHO = 42;

        const dinero = (
            valor: number
        ) =>
            `$${Number(
                valor
            ).toFixed(2)} `;

        const redondear =
            (valor: number) =>
                Math.round(
                    (Number(
                        valor
                    ) + Number.EPSILON) *
                    100
                ) / 100;

        const centrar = (
            texto: string
        ) => {
            const espacios =
                Math.max(
                    0,
                    Math.floor(
                        (ANCHO -
                            texto.length) /
                        2
                    )
                );

            return (
                " ".repeat(
                    espacios
                ) + texto
            );
        };

        const linea =
            "-".repeat(ANCHO);

        let ticket = "";

        /*
        ==========================================
        CALCULAR SUBTOTAL BASE
        ==========================================
        */

        let subtotalBase = 0;

        for (
            const item of carritoVenta
        ) {
            const precioBase =
                Number(
                    item.producto
                        .precio_base
                );

            const cantidad =
                Number(
                    item.cantidad
                );

            subtotalBase +=
                redondear(
                    precioBase *
                    cantidad
                );
        }

        subtotalBase =
            redondear(
                subtotalBase
            );

        /*
        ==========================================
        CALCULAR IVA REAL DEL TOTAL COBRADO
        ==========================================
    
        registrar_venta utiliza precio_venta,
        que ya contiene IVA cuando los
        impuestos están activos.

        Por eso NO hacemos:

        precio_venta * 16%

        En su lugar:

        IVA = total real - subtotal base
        */

        const totalFinal =
            redondear(
                Number(
                    datosVenta.total
                )
            );

        let ivaTicket = 0;

        if (
            impuestosActivos
        ) {
            ivaTicket =
                redondear(
                    totalFinal -
                    subtotalBase
                );

            if (
                ivaTicket < 0
            ) {
                ivaTicket = 0;
            }
        }

        /*
        ==========================================
        INICIALIZAR IMPRESORA
        ==========================================
        */

        ticket +=
            "\x1B\x40";

        /*
        ==========================================
        ENCABEZADO
        ==========================================
        */

        ticket +=
            "\x1B\x61\x01";

        ticket +=
            `${nombreNegocio}\n`;

        ticket +=
            "PUNTO DE VENTA\n";

        ticket +=
            "\x1B\x61\x00";

        ticket +=
            "\n";

        ticket +=
            linea + "\n";

        ticket +=
            "\x1B\x61\x01";

        ticket +=
            "CONTENIDO DE COMPRA\n";

        ticket +=
            "\x1B\x61\x00";

        ticket +=
            linea + "\n";

        /*
        ==========================================
        INFORMACIÓN DE VENTA
        ==========================================
        */

        ticket +=
            `Sucursal: ${sucursalNombre}\n`;

        ticket +=
            `Caja: ${cajaNombre}\n`;

        const fecha =
            new Date();

        ticket +=
            `Fecha: ${fecha.toLocaleDateString(
                "es-MX"
            )}\n`;

        ticket +=
            `Hora: ${fecha.toLocaleTimeString(
                "es-MX"
            )}\n`;

        ticket +=
            `Venta: #${datosVenta.folio}\n`;

        ticket +=
            linea + "\n";

        /*
        ==========================================
        PRODUCTOS
        ==========================================
        */

        for (
            const item of carritoVenta
        ) {
            const nombre =
                item.producto
                    .nombre;

            const cantidad =
                item.cantidad;

            const precio =
                Number(
                    item.producto
                        .precio_venta
                );

            const subtotal =
                redondear(
                    precio *
                    cantidad
                );

            ticket +=
                `${nombre.slice(
                    0,
                    ANCHO
                )}\n`;

            const detalle =
                `  ${cantidad} x ${dinero(
                    precio
                )}`;

            const totalTexto =
                dinero(
                    subtotal
                );

            const espacios =
                Math.max(
                    1,
                    ANCHO -
                    detalle.length -
                    totalTexto.length
                );

            ticket +=
                detalle +
                " ".repeat(
                    espacios
                ) +
                totalTexto +
                "\n";
        }

        /*
        ==========================================
        DESGLOSE FISCAL
        ==========================================
        */

        ticket +=
            linea + "\n";

        const subtotalTexto =
            `Subtotal: ${dinero(
                subtotalBase
            )}`;

        ticket +=
            subtotalTexto + "\n";

        if (
            impuestosActivos
        ) {
            const ivaTexto =
                `IVA (${Number(
                    ivaPorcentaje
                ).toFixed(2)}%): ${dinero(
                    ivaTicket
                )}`;

            ticket +=
                ivaTexto + "\n";
        }

        /*
        ==========================================
        TOTAL
        ==========================================
        */

        const totalTexto =
            `TOTAL: ${dinero(
                totalFinal
            )}`;

        ticket +=
            "\x1B\x45\x01";

        ticket +=
            "\x1B\x61\x01";

        ticket +=
            centrar(
                totalTexto
            ) + "\n";

        ticket +=
            "\x1B\x61\x00";

        ticket +=
            "\x1B\x45\x00";

        ticket +=
            linea + "\n";

        /*
        ==========================================
        MÉTODO DE PAGO
        ==========================================
        */

        switch (
        metodoPago
        ) {
            case "efectivo":
                ticket +=
                    "Metodo de pago: EFECTIVO\n";

                ticket +=
                    `Recibido: ${dinero(
                        montoPagado
                    )}\n`;

                ticket +=
                    `Cambio: ${dinero(
                        datosVenta.cambio
                    )}\n`;

                break;

            case "tarjeta":
                ticket +=
                    "Metodo de pago: TARJETA\n";
                break;

            case "transferencia":
                ticket +=
                    "Metodo de pago: TRANSFERENCIA\n";
                break;

            case "mixto":
                ticket +=
                    "Metodo de pago: MIXTO\n";

                ticket +=
                    `Efectivo: ${dinero(
                        pagoMixto?.efectivo ??
                        0
                    )}\n`;

                ticket +=
                    `Tarjeta: ${dinero(
                        pagoMixto?.tarjeta ??
                        0
                    )}\n`;

                break;

            case "credito":
                ticket +=
                    "Metodo de pago: CREDITO\n";

                if (cliente) {
                    ticket +=
                        `Cliente: ${cliente.nombre.slice(
                            0,
                            30
                        )}\n`;
                }

                break;
        }

        ticket +=
            linea + "\n";

        /*
        ==========================================
        PIE
        ==========================================
        */

        ticket +=
            "\x1B\x61\x01";

        ticket +=
            "Gracias por su compra\n";

        ticket +=
            "Vuelva pronto\n";

        ticket +=
            "\n";

        ticket +=
            linea + "\n";

        ticket +=
            "\x1B\x61\x00";

        /*
        ==========================================
        IDENTIFICACIÓN DE COPIA
        ==========================================
        */

        ticket +=
            "\n";

        ticket +=
            "\x1B\x45\x01";

        ticket +=
            "\x1B\x61\x01";

        ticket +=
            tipoTicket ===
                "cliente"
                ? "COPIA CLIENTE\n"
                : "COPIA TIENDA\n";

        ticket +=
            "\x1B\x45\x00";

        ticket +=
            "\x1B\x61\x00";

        /*
        ==========================================
        SOPORTE TI
        ==========================================
        */

        if (
            tipoTicket ===
            "cliente"
        ) {
            ticket +=
                "\x1B\x61\x01";

            ticket +=
                "Punto de Venta por\n";

            ticket +=
                "{{LOGO_SOPORTE_TI}}\n";

            ticket +=
                "\x1B\x61\x00";
        }

        /*
        ==========================================
        FINAL DEL TICKET
        ==========================================

        No agregamos "CORTE".

        PrinterService realiza el corte
        de cada ticket individualmente.
        */

        ticket +=
            "\n";

        return ticket;
    }

    /*
    ==========================================
    ENVIAR TICKET AL SERVICIO LOCAL
    ==========================================
    */

    async function imprimirTicket(
        contenido: string
    ) {
        const respuestaImpresion =
            await fetch(
                "http://localhost:9100/print",
                {
                    method: "POST",
                    headers: {
                        "Content-Type":
                            "application/json",
                    },
                    body:
                        JSON.stringify({
                            contenido,
                        }),
                }
            );

        let resultadoImpresion:
            | {
                ok?: boolean;
                mensaje?: string;
            }
            | null = null;

        try {
            resultadoImpresion =
                await respuestaImpresion.json();
        } catch {
            resultadoImpresion =
                null;
        }

        if (
            !respuestaImpresion.ok ||
            !resultadoImpresion?.ok
        ) {
            throw new Error(
                resultadoImpresion?.mensaje ||
                "No se pudo enviar el ticket al servicio local."
            );
        }

        return resultadoImpresion;
    }

    /*
    ==========================================
    CONFIRMAR COBRO
    ==========================================
    */

    async function confirmarCobro(
        metodoPago:
            | "efectivo"
            | "tarjeta"
            | "transferencia"
            | "mixto"
            | "credito",
        montoPagado: number,
        pagoMixto?: {
            efectivo: number;
            tarjeta: number;
        }
    ) {
        try {
            /*
            ==========================================
            VALIDAR AUTH
            ==========================================
            */

            const {
                data: {
                    user,
                },
                error: authError,
            } =
                await supabasePOS.auth.getUser();

            if (
                authError ||
                !user
            ) {
                mostrarMensaje(
                    "error",
                    "Sesión no disponible",
                    "La sesión de usuario no está disponible. Cierra sesión e inicia sesión nuevamente."
                );

                return;
            }

            /*
            ==========================================
            VALIDAR USUARIO
            ==========================================
            */

            const {
                data: usuario,
                error: usuarioError,
            } =
                await supabasePOS
                    .from("usuarios")
                    .select(
                        "id, auth_user_id, negocio_id, nombre, rol, activo"
                    )
                    .eq(
                        "id",
                        usuarioId
                    )
                    .maybeSingle();

            if (
                usuarioError
            ) {
                console.error(
                    "❌ ERROR USUARIO:",
                    usuarioError
                );

                mostrarMensaje(
                    "error",
                    "Error de validación",
                    "No se pudo validar el usuario del sistema."
                );

                return;
            }

            if (!usuario) {
                mostrarMensaje(
                    "error",
                    "Usuario no encontrado",
                    "El usuario de Punto de Venta no existe."
                );

                return;
            }

            if (
                !usuario.activo
            ) {
                mostrarMensaje(
                    "error",
                    "Usuario inactivo",
                    "El usuario está inactivo y no puede registrar ventas."
                );

                return;
            }

            if (
                usuario.auth_user_id !==
                user.id
            ) {
                mostrarMensaje(
                    "error",
                    "Sesión no válida",
                    "La sesión de Supabase no corresponde al usuario de Punto de Venta."
                );

                return;
            }

            /*
            ==========================================
            PREPARAR PRODUCTOS
            ==========================================
            */

            const productos =
                carrito.map(
                    (item) => ({
                        producto_id:
                            item.producto
                                .id,

                        cantidad:
                            item.cantidad,
                    })
                );

            /*
            ==========================================
            REGISTRAR VENTA
            ==========================================
            */

            const {
                data,
                error,
            } =
                await supabasePOS.rpc(
                    "registrar_venta",
                    {
                        p_caja_id:
                            cajaId,

                        p_productos:
                            productos,

                        p_metodo_pago:
                            metodoPago,

                        p_monto_recibido:
                            metodoPago ===
                                "efectivo"
                                ? montoPagado
                                : metodoPago ===
                                    "mixto"
                                    ? pagoMixto?.efectivo ??
                                    0
                                    : null,

                        p_descuento:
                            0,

                        p_cliente_id:
                            clienteSeleccionado?.id ??
                            null,
                    }
                );

            if (error) {
                console.error(
                    "❌ ERROR REGISTRAR VENTA:",
                    {
                        message:
                            error.message,
                        details:
                            error.details,
                        hint:
                            error.hint,
                        code:
                            error.code,
                    }
                );

                mostrarMensaje(
                    "error",
                    "No se pudo registrar la venta",
                    error.message ||
                    "No se pudo registrar la venta."
                );

                return;
            }

            /*
            ==========================================
            VENTA REGISTRADA
            ==========================================
            */

            const ventaRegistrada =
            {
                ventaId:
                    String(
                        data.venta_id
                    ),

                folio:
                    Number(
                        data.folio
                    ),

                total:
                    Number(
                        data.total
                    ),

                cambio:
                    Number(
                        data.cambio
                    ),
            };

            /*
            ==========================================
            GUARDAR COPIA DEL CARRITO
            ==========================================
            */

            const carritoParaTicket =
                [...carrito];

            /*
            ==========================================
            GUARDAR CLIENTE
            ==========================================
            */

            const clienteParaTicket =
                clienteSeleccionado;

            /*
            ==========================================
            CERRAR COBRO
            ==========================================
            */

            setModalCobroAbierto(
                false
            );

            /*
            ==========================================
            MOSTRAR VENTA
            ==========================================
            */

            setMensajeVenta({
                folio:
                    ventaRegistrada.folio,

                total:
                    ventaRegistrada.total,

                cambio:
                    ventaRegistrada.cambio,

                impresion: true,
            });

            /*
            ==========================================
            LIMPIAR CARRITO
            ==========================================
            */

            setCarrito([]);

            setClienteSeleccionado(
                null
            );

            setBusquedaCliente("");
            setClientes([]);

            /*
            ==========================================
            IMPRESIÓN EN SEGUNDO PLANO
            ==========================================
            */

            void (async () => {
                try {
                    /*
                    ==========================================
                    COPIA CLIENTE
                    ==========================================
                    */

                    const ticketCliente =
                        generarTicket(
                            carritoParaTicket,
                            ventaRegistrada,
                            metodoPago,
                            montoPagado,
                            pagoMixto,
                            clienteParaTicket,
                            "cliente"
                        );

                    await imprimirTicket(
                        ticketCliente
                    );

                    /*
                    ==========================================
                    PAUSA
                    ==========================================
                    */

                    await new Promise(
                        (resolve) =>
                            setTimeout(
                                resolve,
                                150
                            )
                    );

                    /*
                    ==========================================
                    COPIA TIENDA
                    ==========================================
                    */

                    const ticketTienda =
                        generarTicket(
                            carritoParaTicket,
                            ventaRegistrada,
                            metodoPago,
                            montoPagado,
                            pagoMixto,
                            clienteParaTicket,
                            "tienda"
                        );

                    await imprimirTicket(
                        ticketTienda
                    );

                    setMensajeVenta(
                        (actual) =>
                            actual
                                ? {
                                    ...actual,
                                    impresion:
                                        true,
                                }
                                : actual
                    );
                } catch (error) {
                    console.error(
                        "❌ ERROR AL ENVIAR TICKETS:",
                        error
                    );

                    setMensajeVenta(
                        (actual) =>
                            actual
                                ? {
                                    ...actual,
                                    impresion:
                                        false,
                                }
                                : actual
                    );
                }
            })();
        } catch (error) {
            console.error(
                "❌ ERROR INESPERADO:",
                error
            );

            mostrarMensaje(
                "error",
                "Error inesperado",
                "Ocurrió un error inesperado al registrar la venta."
            );
        }
    }

    /*
    ==========================================
    TOTAL
    ==========================================
    */

    const total =
        carrito.reduce(
            (
                acumulado,
                item
            ) =>
                acumulado +
                Number(
                    item.producto
                        .precio_venta
                ) *
                item.cantidad,
            0
        );

    /*
    ==========================================
    RENDER
    ==========================================
    */

    return (
        <div className="space-y-6">

            {/* ENCABEZADO */}

            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm sm:p-5">

                <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">

                    <div className="min-w-0">

                        <div className="flex items-center gap-3">

                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--color-primary)] text-xl text-white shadow-sm">
                                🛒
                            </div>

                            <div className="min-w-0">

                                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
                                    Punto de venta
                                </p>

                                <h1 className="truncate text-xl font-bold text-[var(--color-text)] sm:text-2xl">
                                    Nueva venta
                                </h1>

                            </div>

                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">

                            <span className="inline-flex items-center gap-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700">
                                🏪{" "}
                                {cajaNombre}
                            </span>

                            <span className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
                                📍{" "}
                                {sucursalNombre}
                            </span>

                            <span className="inline-flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs font-semibold text-green-700">
                                <span className="h-2 w-2 rounded-full bg-green-500" />
                                Sesión abierta
                            </span>

                        </div>

                    </div>

                </div>

            </div>

            {/* INFORMACIÓN DE SESIÓN */}

            <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">

                <p className="text-sm font-semibold text-blue-900">
                    Caja lista para vender
                </p>

                <p className="mt-1 text-xs text-blue-700">
                    La venta se registrará en esta sesión de caja.
                </p>

            </div>

            {/* CLIENTE */}

            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">

                <div className="flex items-center justify-between gap-3">

                    <div>

                        <h2 className="text-lg font-semibold text-[var(--color-text)]">
                            Cliente
                        </h2>

                        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                            Opcional. Puedes asociar esta venta a un cliente.
                        </p>

                    </div>

                    {clienteSeleccionado && (
                        <button
                            type="button"
                            onClick={
                                quitarCliente
                            }
                            className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50"
                        >
                            Quitar
                        </button>
                    )}

                </div>

                {clienteSeleccionado ? (
                    <div className="mt-4 rounded-xl border border-green-200 bg-green-50 p-4">

                        <div className="flex items-start justify-between gap-4">

                            <div>

                                <p className="text-xs font-semibold uppercase tracking-wide text-green-700">
                                    Cliente seleccionado
                                </p>

                                <p className="mt-1 text-lg font-bold text-green-900">
                                    {
                                        clienteSeleccionado.nombre
                                    }
                                </p>

                                {clienteSeleccionado.telefono && (
                                    <p className="mt-1 text-sm text-green-700">
                                        📞{" "}
                                        {
                                            clienteSeleccionado.telefono
                                        }
                                    </p>
                                )}

                                {clienteSeleccionado.email && (
                                    <p className="mt-1 text-sm text-green-700">
                                        ✉️{" "}
                                        {
                                            clienteSeleccionado.email
                                        }
                                    </p>
                                )}

                            </div>

                            <div className="rounded-lg bg-white px-3 py-2 text-right shadow-sm">

                                <p className="text-xs text-slate-500">
                                    Saldo crédito
                                </p>

                                <p className="font-bold text-slate-800">
                                    $
                                    {Number(
                                        clienteSeleccionado.saldo_credito
                                    ).toFixed(
                                        2
                                    )}
                                </p>

                            </div>

                        </div>

                    </div>
                ) : (
                    <div className="relative mt-4">

                        <div className="relative">

                            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                                🔎
                            </span>

                            <input
                                type="text"
                                value={
                                    busquedaCliente
                                }
                                onChange={(e) =>
                                    setBusquedaCliente(
                                        e.target.value
                                    )
                                }
                                placeholder="Buscar cliente por nombre, teléfono o correo..."
                                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] py-3 pl-11 pr-4 text-sm outline-none transition focus:border-[var(--color-primary)] focus:ring-4 focus:ring-blue-100"
                            />

                        </div>

                        {cargandoClientes && (
                            <div className="mt-2 rounded-xl border border-blue-100 bg-blue-50 p-3 text-sm text-blue-700">
                                Buscando clientes...
                            </div>
                        )}

                        {!cargandoClientes &&
                            clientes.length >
                            0 && (
                                <div className="absolute left-0 right-0 z-30 mt-2 overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-xl">

                                    {clientes.map(
                                        (
                                            cliente
                                        ) => (
                                            <button
                                                key={
                                                    cliente.id
                                                }
                                                type="button"
                                                onClick={() =>
                                                    seleccionarCliente(
                                                        cliente
                                                    )
                                                }
                                                className="w-full border-b border-[var(--color-border)] px-4 py-3 text-left transition last:border-b-0 hover:bg-slate-50"
                                            >

                                                <div className="flex items-center justify-between gap-4">

                                                    <div>

                                                        <p className="font-semibold text-[var(--color-text)]">
                                                            {
                                                                cliente.nombre
                                                            }
                                                        </p>

                                                        <div className="mt-1 flex flex-wrap gap-3 text-xs text-[var(--color-text-secondary)]">

                                                            {cliente.telefono && (
                                                                <span>
                                                                    📞{" "}
                                                                    {
                                                                        cliente.telefono
                                                                    }
                                                                </span>
                                                            )}

                                                            {cliente.email && (
                                                                <span>
                                                                    ✉️{" "}
                                                                    {
                                                                        cliente.email
                                                                    }
                                                                </span>
                                                            )}

                                                        </div>

                                                    </div>

                                                    <span className="text-xs font-semibold text-blue-600">
                                                        Seleccionar
                                                    </span>

                                                </div>

                                            </button>
                                        )
                                    )}

                                </div>
                            )}

                    </div>
                )}

            </div>

            {/* MENSAJE ESCÁNER */}

            {(mensajeEscaner ||
                escaneando) && (
                    <div
                        className={`rounded-2xl border p-4 ${escaneando
                            ? "border-blue-200 bg-blue-50"
                            : mensajeEscaner.startsWith(
                                "✓"
                            )
                                ? "border-green-200 bg-green-50"
                                : "border-red-200 bg-red-50"
                            }`}
                    >

                        <div className="flex items-center gap-3">

                            <span className="text-xl">
                                {escaneando
                                    ? "🔎"
                                    : mensajeEscaner.startsWith(
                                        "✓"
                                    )
                                        ? "✅"
                                        : "⚠️"}
                            </span>

                            <p
                                className={`text-sm font-medium ${escaneando
                                    ? "text-blue-700"
                                    : mensajeEscaner.startsWith(
                                        "✓"
                                    )
                                        ? "text-green-700"
                                        : "text-red-700"
                                    }`}
                            >
                                {escaneando
                                    ? "Procesando código..."
                                    : mensajeEscaner}
                            </p>

                        </div>

                    </div>
                )}

            {/* ÁREA PRINCIPAL */}

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_420px]">

                {/* BUSCADOR */}

                <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">

                    <div className="mb-5">

                        <h2 className="text-lg font-semibold text-[var(--color-text)]">
                            Productos
                        </h2>

                        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                            Busca un producto, categoría o escanea su código de barras desde cualquier parte de la pantalla.
                        </p>

                    </div>

                    <BuscadorProductos
                        sucursalId={
                            sucursalId
                        }
                        negocioId={
                            negocioId
                        }
                        onAgregarProducto={
                            agregarProducto
                        }
                    />

                </div>

                {/* CARRITO */}

                <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">

                    <CarritoVenta
                        items={carrito}
                        onAumentar={
                            aumentarCantidad
                        }
                        onDisminuir={
                            disminuirCantidad
                        }
                        onEliminar={
                            eliminarProducto
                        }
                        onCobrar={
                            cobrarVenta
                        }
                    />

                </div>

            </div>

            {/* INFORMACIÓN DESARROLLO */}

            <div className="hidden">

                <span>
                    {sesionId}
                </span>

                <span>
                    {cajaId}
                </span>

                <span>
                    {sucursalId}
                </span>

                <span>
                    {usuarioId}
                </span>

                <span>
                    {negocioId}
                </span>

                <span>
                    {
                        clienteSeleccionado?.id ??
                        null
                    }
                </span>

                <span>
                    {total}
                </span>

            </div>

            {/* VENTA REALIZADA */}

            {mensajeVenta && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">

                    <div className="w-full max-w-md rounded-2xl bg-[var(--color-surface)] p-6 shadow-2xl">

                        <div className="text-center">

                            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-3xl">
                                ✓
                            </div>

                            <h2 className="mt-4 text-2xl font-bold text-[var(--color-text)]">
                                Venta realizada
                            </h2>

                            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                                La venta se registró correctamente.
                            </p>

                        </div>

                        <div className="mt-6 space-y-3 rounded-xl bg-slate-50 p-4">

                            <div className="flex justify-between">

                                <span className="text-sm text-slate-500">
                                    Folio
                                </span>

                                <span className="font-bold text-blue-700">
                                    #
                                    {
                                        mensajeVenta.folio
                                    }
                                </span>

                            </div>

                            <div className="flex justify-between">

                                <span className="text-sm text-slate-500">
                                    Total
                                </span>

                                <span className="font-bold text-slate-800">
                                    $
                                    {mensajeVenta.total.toFixed(
                                        2
                                    )}
                                </span>

                            </div>

                            <div className="flex justify-between">

                                <span className="text-sm text-slate-500">
                                    Cambio
                                </span>

                                <span className="font-bold text-green-700">
                                    $
                                    {mensajeVenta.cambio.toFixed(
                                        2
                                    )}
                                </span>

                            </div>

                        </div>

                        {/* ESTADO IMPRESIÓN */}

                        <div
                            className={`mt-4 rounded-xl border p-4 ${mensajeVenta.impresion
                                ? "border-green-200 bg-green-50"
                                : "border-amber-200 bg-amber-50"
                                }`}
                        >

                            <div className="flex items-start gap-3">

                                <span className="text-xl">
                                    {mensajeVenta.impresion
                                        ? "🖨️"
                                        : "⚠️"}
                                </span>

                                <div>

                                    <p
                                        className={`text-sm font-semibold ${mensajeVenta.impresion
                                            ? "text-green-800"
                                            : "text-amber-800"
                                            }`}
                                    >
                                        {mensajeVenta.impresion
                                            ? "Tickets enviados a impresora local"
                                            : "No se pudieron enviar los tickets"}
                                    </p>

                                    <p
                                        className={`mt-1 text-xs ${mensajeVenta.impresion
                                            ? "text-green-700"
                                            : "text-amber-700"
                                            }`}
                                    >
                                        {mensajeVenta.impresion
                                            ? "La venta quedó registrada y las copias fueron enviadas al servicio local de impresión."
                                            : "La venta sí quedó registrada. Puedes revisar la impresora y continuar con la siguiente venta."}
                                    </p>

                                </div>

                            </div>

                        </div>

                        <button
                            type="button"
                            onClick={() =>
                                setMensajeVenta(
                                    null
                                )
                            }
                            className="mt-6 w-full rounded-xl bg-[var(--color-primary)] px-4 py-3 font-semibold text-white transition hover:bg-[var(--color-primary-hover)]"
                        >
                            Nueva venta
                        </button>

                    </div>

                </div>
            )}

            {/* COBRAR */}

            <ModalCobro
                abierto={
                    modalCobroAbierto
                }
                total={total}
                clienteSeleccionado={
                    clienteSeleccionado
                }
                onCerrar={() =>
                    setModalCobroAbierto(
                        false
                    )
                }
                onConfirmar={
                    confirmarCobro
                }
            />

            {/* MENSAJES */}

            <ModalMensaje
                abierto={
                    modalMensaje.abierto
                }
                tipo={
                    modalMensaje.tipo
                }
                titulo={
                    modalMensaje.titulo
                }
                mensaje={
                    modalMensaje.mensaje
                }
                textoBoton="Aceptar"
                onCerrar={() =>
                    setModalMensaje(
                        (actual) => ({
                            ...actual,
                            abierto:
                                false,
                        })
                    )
                }
            />

        </div>
    );
}