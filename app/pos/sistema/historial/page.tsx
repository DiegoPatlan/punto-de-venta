"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { obtenerUsuarioPOS } from "../../../../lib/usuarioPOS";
import { supabasePOS } from "../../../../lib/supabase";

const PRINTER_SERVICE_URL = "http://localhost:9100";

interface UsuarioActual {
    id: string;
    nombre?: string | null;
    negocio_id?: string | null;
    sucursal_id?: string | null;
    rol?: string | null;
}

interface Venta {
    id: string;
    folio: number | string | null;
    estado: string | null;
    created_at: string | null;
    cliente_id: string | null;
    negocio_id: string | null;
    sucursal_id: string | null;
    caja_id: string | null;
    sesion_caja_id: string | null;
    usuario_id: string | null;
    subtotal: number | null;
    descuento: number | null;
    impuesto: number | null;
    total: number | null;
    metodo_pago: string | null;
    referencia: string | null;
    notas: string | null;
}

interface Pago {
    id: string;
    venta_id: string;
    metodo_pago: string | null;
    monto: number | null;
    referencia: string | null;
    monto_recibido?: number | null;
    cambio?: number | null;
}

interface DetalleVenta {
    id: string;
    venta_id: string;
    producto_id: string | null;
    cantidad: number | null;
    precio_unitario: number | null;
    descuento: number | null;
    impuesto: number | null;
    subtotal: number | null;
    total: number | null;
}

interface Producto {
    id: string;
    nombre: string | null;
    codigo_barras: string | null;
    sku: string | null;
}

interface Cliente {
    id: string;
    nombre: string | null;
}

interface Negocio {
    id: string;
    nombre: string | null;
    logo_url: string | null;
}

interface Sucursal {
    id: string;
    nombre: string | null;
}

interface Caja {
    id: string;
    nombre: string | null;
}

interface UsuarioVenta {
    id: string;
    nombre: string | null;
}

interface PagoTicket {
    metodo: string;
    monto: number;
    referencia?: string | null;
    montoRecibido?: number | null;
    cambio?: number | null;
}

interface VentaHistorial {
    id: string;
    folio: number | string | null;
    estado: string | null;
    created_at: string | null;

    subtotal: number;
    descuento: number;
    impuesto: number;
    total: number;

    metodo_pago: string;
    referencia: string | null;
    notas: string | null;

    cliente: string;
    negocio: Negocio | null;
    sucursal: string;
    caja: string;
    cajero: string;

    pagos: PagoTicket[];

    detalles: Array<
        DetalleVenta & {
            producto: string;
            codigo_barras: string;
            sku: string;
        }
    >;
}

type TipoMensaje = "success" | "error" | "warning" | "info";

interface Mensaje {
    tipo: TipoMensaje;
    titulo: string;
    texto: string;
}

function normalizarMetodo(
    metodo: string | null | undefined
): string {
    return String(metodo || "")
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}

function nombreMetodo(
    metodo: string | null | undefined
): string {
    switch (normalizarMetodo(metodo)) {
        case "efectivo":
            return "Efectivo";

        case "tarjeta":
            return "Tarjeta";

        case "transferencia":
            return "Transferencia";

        case "mixto":
            return "Mixto";

        case "credito":
            return "Crédito";

        default:
            return metodo || "No especificado";
    }
}

function iconoMetodo(
    metodo: string | null | undefined
): string {
    switch (normalizarMetodo(metodo)) {
        case "efectivo":
            return "💵";

        case "tarjeta":
            return "💳";

        case "transferencia":
            return "🏦";

        case "mixto":
            return "🔀";

        case "credito":
            return "📒";

        default:
            return "💰";
    }
}

function formatearMoneda(
    valor: number | null | undefined
): string {
    return Number(valor || 0).toLocaleString("es-MX", {
        style: "currency",
        currency: "MXN",
    });
}

function formatearFecha(
    fecha: string | null | undefined
): string {
    if (!fecha) return "—";

    const date = new Date(fecha);

    if (Number.isNaN(date.getTime())) {
        return "—";
    }

    return date.toLocaleString("es-MX", {
        dateStyle: "short",
        timeStyle: "short",
    });
}

function nombreEstado(
    estado: string | null | undefined
): string {
    const e = normalizarMetodo(estado);

    if (
        e === "completada" ||
        e === "completado" ||
        e === "finalizada" ||
        e === "finalizado" ||
        e === "pagada" ||
        e === "pagado"
    ) {
        return "Completada";
    }

    if (
        e === "cancelada" ||
        e === "cancelado"
    ) {
        return "Cancelada";
    }

    return estado || "Desconocido";
}

function estadoEsCompletada(
    estado: string | null | undefined
): boolean {
    return [
        "completada",
        "completado",
        "finalizada",
        "finalizado",
        "pagada",
        "pagado",
    ].includes(normalizarMetodo(estado));
}

function estadoEsCancelada(
    estado: string | null | undefined
): boolean {
    return [
        "cancelada",
        "cancelado",
    ].includes(normalizarMetodo(estado));
}

function obtenerMontoPago(
    pago: any
): number {
    const candidatos = [
        pago?.monto,
        pago?.importe,
        pago?.total,
        pago?.cantidad,
    ];

    for (const valor of candidatos) {
        if (
            valor !== null &&
            valor !== undefined &&
            !Number.isNaN(Number(valor))
        ) {
            return Number(valor);
        }
    }

    return 0;
}

function dividirTexto(
    texto: string,
    ancho = 42
): string[] {
    const resultado: string[] = [];

    let restante = texto;

    while (restante.length > ancho) {
        resultado.push(
            restante.slice(0, ancho)
        );

        restante = restante.slice(ancho);
    }

    if (restante.length > 0) {
        resultado.push(restante);
    }

    return resultado;
}

function centrar(
    texto: string,
    ancho = 42
): string {
    if (texto.length >= ancho) {
        return texto.slice(0, ancho);
    }

    const espacios = Math.floor(
        (ancho - texto.length) / 2
    );

    return (
        " ".repeat(
            Math.max(0, espacios)
        ) + texto
    );
}

function lineaTicket(
    ancho = 42
): string {
    return "-".repeat(ancho);
}

function textoTicket(
    venta: VentaHistorial
): string {
    const ancho = 42;

    const lineas: string[] = [];

    const negocio =
        venta.negocio?.nombre ||
        "Negocio";

    lineas.push(
        centrar(negocio, ancho)
    );

    lineas.push(
        lineaTicket(ancho)
    );

    lineas.push(
        `Folio: ${String(
            venta.folio ?? venta.id
        ).padStart(6, "0")
        } `
    );

    lineas.push(
        `Fecha: ${formatearFecha(
            venta.created_at
        )
        } `
    );

    if (venta.sucursal) {
        lineas.push(
            `Sucursal: ${venta.sucursal} `
        );
    }

    if (venta.caja) {
        lineas.push(
            `Caja: ${venta.caja} `
        );
    }

    if (venta.cajero) {
        lineas.push(
            `Cajero: ${venta.cajero} `
        );
    }

    if (
        venta.cliente &&
        venta.cliente !== "Público general"
    ) {
        lineas.push(
            `Cliente: ${venta.cliente} `
        );
    }

    lineas.push(
        lineaTicket(ancho)
    );

    for (const detalle of venta.detalles) {
        const cantidad =
            Number(
                detalle.cantidad || 0
            );

        const total =
            Number(
                detalle.total || 0
            );

        const nombre =
            detalle.producto ||
            "Producto";

        lineas.push(
            ...dividirTexto(
                nombre,
                ancho
            )
        );

        lineas.push(
            `${cantidad} x ${formatearMoneda(
                detalle.precio_unitario
            )
            } `
        );

        lineas.push(
            `Subtotal: ${formatearMoneda(
                detalle.subtotal
            )
            } `
        );

        if (
            Number(detalle.impuesto || 0) > 0
        ) {
            lineas.push(
                `IVA: ${formatearMoneda(
                    detalle.impuesto
                )
                } `
            );
        }

        lineas.push(
            `Importe: ${formatearMoneda(
                total
            )
            } `
        );
    }

    lineas.push(
        lineaTicket(ancho)
    );

    lineas.push(
        `Subtotal: ${formatearMoneda(
            venta.subtotal
        )
        } `
    );

    if (
        Number(venta.descuento || 0) > 0
    ) {
        lineas.push(
            `Descuento: ${formatearMoneda(
                venta.descuento
            )
            } `
        );
    }

    if (
        Number(venta.impuesto || 0) > 0
    ) {
        lineas.push(
            `IVA: ${formatearMoneda(
                venta.impuesto
            )
            } `
        );
    }

    lineas.push(
        `TOTAL: ${formatearMoneda(
            venta.total
        )
        } `
    );

    lineas.push(
        lineaTicket(ancho)
    );

    if (venta.pagos.length > 0) {
        lineas.push("PAGOS:");

        for (
            const pago of venta.pagos
        ) {
            lineas.push(
                `${nombreMetodo(
                    pago.metodo
                )
                }: ${formatearMoneda(
                    pago.monto
                )
                } `
            );

            if (
                normalizarMetodo(
                    pago.metodo
                ) === "efectivo" &&
                pago.montoRecibido !== null &&
                pago.montoRecibido !== undefined
            ) {
                lineas.push(
                    `Recibido: ${formatearMoneda(
                        pago.montoRecibido
                    )
                    } `
                );

                if (
                    pago.cambio !== null &&
                    pago.cambio !== undefined
                ) {
                    lineas.push(
                        `Cambio: ${formatearMoneda(
                            pago.cambio
                        )
                        } `
                    );
                }
            }
        }
    } else {
        lineas.push(
            `Pago: ${nombreMetodo(
                venta.metodo_pago
            )
            } `
        );
    }

    if (
        normalizarMetodo(
            venta.metodo_pago
        ) === "credito"
    ) {
        lineas.push("");
        lineas.push(
            "Venta a crédito."
        );
    }

    if (venta.referencia) {
        lineas.push(
            `Referencia: ${venta.referencia} `
        );
    }

    lineas.push("");

    lineas.push(
        centrar(
            "¡Gracias por su compra!",
            ancho
        )
    );

    lineas.push("");

    lineas.push(
        lineaTicket(ancho)
    );

    lineas.push(
        centrar(
            "Punto de Venta por Soporte IT",
            ancho
        )
    );

    lineas.push(
        lineaTicket(ancho)
    );

    return lineas.join("\n");
}

function ModalMensaje({
    mensaje,
    cerrar,
}: {
    mensaje: Mensaje | null;
    cerrar: () => void;
}) {
    if (!mensaje) {
        return null;
    }

    const iconos = {
        success: "✅",
        error: "❌",
        warning: "⚠️",
        info: "ℹ️",
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px]">
            <div
                className="w-full max-w-md overflow-hidden rounded-2xl border shadow-2xl"
                style={{
                    backgroundColor:
                        "var(--color-surface)",
                    borderColor:
                        "var(--color-border)",
                }}
            >
                <div
                    className="border-b p-5"
                    style={{
                        borderColor:
                            "var(--color-border)",
                    }}
                >
                    <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-background)] text-xl">
                            {iconos[mensaje.tipo]}
                        </div>

                        <div className="min-w-0">
                            <h3
                                className="font-bold"
                                style={{
                                    color:
                                        "var(--color-text)",
                                }}
                            >
                                {mensaje.titulo}
                            </h3>

                            <p
                                className="mt-1 text-sm leading-relaxed"
                                style={{
                                    color:
                                        "var(--color-text-secondary)",
                                }}
                            >
                                {mensaje.texto}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex justify-end p-4">
                    <button
                        type="button"
                        onClick={cerrar}
                        className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-[0.98]"
                        style={{
                            backgroundColor:
                                "var(--color-primary)",
                        }}
                    >
                        Entendido
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function HistorialVentasPage() {
    const router = useRouter();

    const [usuario, setUsuario] =
        useState<UsuarioActual | null>(
            null
        );

    const [ventas, setVentas] =
        useState<VentaHistorial[]>([]);

    const [cargando, setCargando] =
        useState(true);

    const [busqueda, setBusqueda] =
        useState("");

    const [filtroEstado, setFiltroEstado] =
        useState("todos");

    const [filtroPago, setFiltroPago] =
        useState("todos");

    const [ventaDetalle, setVentaDetalle] =
        useState<VentaHistorial | null>(
            null
        );

    const [ventaTicket, setVentaTicket] =
        useState<VentaHistorial | null>(
            null
        );

    const [mensaje, setMensaje] =
        useState<Mensaje | null>(null);

    const [imprimiendo, setImprimiendo] =
        useState(false);

    const mostrarMensaje = (
        tipo: TipoMensaje,
        titulo: string,
        texto: string
    ) => {
        setMensaje({
            tipo,
            titulo,
            texto,
        });
    };

    async function imprimirTicket(
        venta: VentaHistorial
    ) {
        if (
            !estadoEsCompletada(
                venta.estado
            )
        ) {
            mostrarMensaje(
                "warning",
                "Venta no imprimible",
                "Solo se pueden reimprimir ventas completadas."
            );

            return;
        }

        setImprimiendo(true);

        try {
            const contenido =
                textoTicket(venta);

            const payload = {
                contenido,
                texto: contenido,

                businessLogoUrl:
                    venta.negocio?.logo_url ||
                    null,

                logoNegocio:
                    venta.negocio?.logo_url ||
                    null,

                businessLogo:
                    venta.negocio?.logo_url ||
                    null,

                business:
                    venta.negocio
                        ? {
                            id:
                                venta
                                    .negocio
                                    .id,

                            nombre:
                                venta
                                    .negocio
                                    .nombre,

                            logo_url:
                                venta
                                    .negocio
                                    .logo_url,
                        }
                        : null,

                ticket: {
                    folio:
                        venta.folio,

                    fecha:
                        venta.created_at,

                    subtotal:
                        venta.subtotal,

                    descuento:
                        venta.descuento,

                    impuesto:
                        venta.impuesto,

                    total:
                        venta.total,

                    metodo_pago:
                        venta.metodo_pago,

                    pagos:
                        venta.pagos,

                    cliente:
                        venta.cliente,

                    sucursal:
                        venta.sucursal,

                    caja:
                        venta.caja,

                    cajero:
                        venta.cajero,

                    detalles:
                        venta.detalles,
                },
            };

            const respuesta =
                await fetch(
                    `${PRINTER_SERVICE_URL}/print`,
                    {
                        method: "POST",
                        headers: {
                            "Content-Type":
                                "application/json",
                        },
                        body: JSON.stringify(
                            payload
                        ),
                    }
                );

            if (!respuesta.ok) {
                const textoError =
                    await respuesta.text();

                throw new Error(
                    `Impresora respondió ${respuesta.status}: ${textoError}`
                );
            }

            mostrarMensaje(
                "success",
                "Ticket enviado",
                `El ticket de la venta #${venta.folio ?? venta.id
                } fue enviado a impresión.`
            );
        } catch (error) {
            console.error(
                "Error imprimiendo ticket:",
                error
            );

            mostrarMensaje(
                "error",
                "No se pudo imprimir",
                "Verifica que printer-service esté ejecutándose y que exista una impresora configurada."
            );
        } finally {
            setImprimiendo(false);
        }
    }

    async function cargarHistorial() {
        setCargando(true);

        try {
            const usuarioPOS =
                (await obtenerUsuarioPOS()) as
                | UsuarioActual
                | null;

            if (!usuarioPOS) {
                router.replace(
                    "/pos/login"
                );

                return;
            }

            setUsuario(usuarioPOS);

            const {
                data: ventasData,
                error: ventasError,
            } =
                await supabasePOS
                    .from("ventas")
                    .select(
                        "id,folio,estado,created_at,cliente_id,negocio_id,sucursal_id,caja_id,sesion_caja_id,usuario_id,subtotal,descuento,impuesto,total,metodo_pago,referencia,notas"
                    )
                    .order(
                        "created_at",
                        {
                            ascending:
                                false,
                        }
                    );

            if (ventasError) {
                throw ventasError;
            }

            const ventasRaw =
                (ventasData ||
                    []) as Venta[];

            if (
                ventasRaw.length === 0
            ) {
                setVentas([]);
                return;
            }

            const ventaIds =
                ventasRaw.map(
                    (venta) =>
                        venta.id
                );

            const negocioId =
                usuarioPOS.negocio_id ||
                ventasRaw.find(
                    (venta) =>
                        Boolean(
                            venta.negocio_id
                        )
                )?.negocio_id ||
                null;

            const sucursalIds =
                Array.from(
                    new Set(
                        ventasRaw
                            .map(
                                (venta) =>
                                    venta.sucursal_id
                            )
                            .filter(
                                Boolean
                            )
                    )
                ) as string[];

            const cajaIds =
                Array.from(
                    new Set(
                        ventasRaw
                            .map(
                                (venta) =>
                                    venta.caja_id
                            )
                            .filter(
                                Boolean
                            )
                    )
                ) as string[];

            const usuarioIds =
                Array.from(
                    new Set(
                        ventasRaw
                            .map(
                                (venta) =>
                                    venta.usuario_id
                            )
                            .filter(
                                Boolean
                            )
                    )
                ) as string[];

            const clienteIds =
                Array.from(
                    new Set(
                        ventasRaw
                            .map(
                                (venta) =>
                                    venta.cliente_id
                            )
                            .filter(
                                Boolean
                            )
                    )
                ) as string[];

            const [
                pagosResult,
                detallesResult,
                clientesResult,
                negocioResult,
                sucursalesResult,
                cajasResult,
                usuariosResult,
            ] = await Promise.all([
                ventaIds.length > 0
                    ? supabasePOS
                        .from("pagos")
                        .select("*")
                        .in(
                            "venta_id",
                            ventaIds
                        )
                    : Promise.resolve({
                        data: [],
                        error: null,
                    }),

                ventaIds.length > 0
                    ? supabasePOS
                        .from(
                            "detalle_ventas"
                        )
                        .select("*")
                        .in(
                            "venta_id",
                            ventaIds
                        )
                    : Promise.resolve({
                        data: [],
                        error: null,
                    }),

                clienteIds.length > 0
                    ? supabasePOS
                        .from("clientes")
                        .select(
                            "id,nombre"
                        )
                        .in(
                            "id",
                            clienteIds
                        )
                    : Promise.resolve({
                        data: [],
                        error: null,
                    }),

                negocioId
                    ? supabasePOS
                        .from("negocios")
                        .select(
                            "id,nombre,logo_url"
                        )
                        .eq(
                            "id",
                            negocioId
                        )
                        .maybeSingle()
                    : Promise.resolve({
                        data: null,
                        error: null,
                    }),

                sucursalIds.length > 0
                    ? supabasePOS
                        .from(
                            "sucursales"
                        )
                        .select(
                            "id,nombre"
                        )
                        .in(
                            "id",
                            sucursalIds
                        )
                    : Promise.resolve({
                        data: [],
                        error: null,
                    }),

                cajaIds.length > 0
                    ? supabasePOS
                        .from("cajas")
                        .select(
                            "id,nombre"
                        )
                        .in(
                            "id",
                            cajaIds
                        )
                    : Promise.resolve({
                        data: [],
                        error: null,
                    }),

                usuarioIds.length > 0
                    ? supabasePOS
                        .from("usuarios")
                        .select(
                            "id,nombre"
                        )
                        .in(
                            "id",
                            usuarioIds
                        )
                    : Promise.resolve({
                        data: [],
                        error: null,
                    }),
            ]);

            if (
                pagosResult.error
            ) {
                console.error(
                    "Error cargando pagos:",
                    pagosResult.error
                );
            }

            if (
                detallesResult.error
            ) {
                console.error(
                    "Error cargando detalles:",
                    detallesResult.error
                );
            }

            if (
                clientesResult.error
            ) {
                console.error(
                    "Error cargando clientes:",
                    clientesResult.error
                );
            }

            if (
                negocioResult.error
            ) {
                console.error(
                    "Error cargando negocio:",
                    negocioResult.error
                );

                throw negocioResult.error;
            }

            if (
                sucursalesResult.error
            ) {
                console.error(
                    "Error cargando sucursales:",
                    sucursalesResult.error
                );
            }

            if (
                cajasResult.error
            ) {
                console.error(
                    "Error cargando cajas:",
                    cajasResult.error
                );
            }

            if (
                usuariosResult.error
            ) {
                console.error(
                    "Error cargando usuarios:",
                    usuariosResult.error
                );
            }

            const pagosRaw =
                (pagosResult.data ||
                    []) as Pago[];

            const detallesRaw =
                (detallesResult.data ||
                    []) as DetalleVenta[];

            const clientesRaw =
                (clientesResult.data ||
                    []) as Cliente[];

            const negocioRaw =
                (negocioResult.data as
                    | Negocio
                    | null) ||
                null;

            const sucursalesRaw =
                (sucursalesResult.data ||
                    []) as Sucursal[];

            const cajasRaw =
                (cajasResult.data ||
                    []) as Caja[];

            const usuariosRaw =
                (usuariosResult.data ||
                    []) as UsuarioVenta[];

            const productoIds =
                Array.from(
                    new Set(
                        detallesRaw
                            .map(
                                (detalle) =>
                                    detalle.producto_id
                            )
                            .filter(
                                Boolean
                            )
                    )
                ) as string[];

            let productosRaw: Producto[] =
                [];

            if (
                productoIds.length > 0
            ) {
                const {
                    data,
                    error,
                } =
                    await supabasePOS
                        .from("productos")
                        .select(
                            "id,nombre,codigo_barras,sku"
                        )
                        .in(
                            "id",
                            productoIds
                        );

                if (error) {
                    console.error(
                        "Error cargando productos:",
                        error
                    );
                } else {
                    productosRaw =
                        (data ||
                            []) as Producto[];
                }
            }

            const pagosPorVenta =
                new Map<
                    string,
                    Pago[]
                >();

            for (
                const pago of pagosRaw
            ) {
                const lista =
                    pagosPorVenta.get(
                        pago.venta_id
                    ) || [];

                lista.push(pago);

                pagosPorVenta.set(
                    pago.venta_id,
                    lista
                );
            }

            const detallesPorVenta =
                new Map<
                    string,
                    DetalleVenta[]
                >();

            for (
                const detalle of detallesRaw
            ) {
                const lista =
                    detallesPorVenta.get(
                        detalle.venta_id
                    ) || [];

                lista.push(detalle);

                detallesPorVenta.set(
                    detalle.venta_id,
                    lista
                );
            }

            const productosMap =
                new Map(
                    productosRaw.map(
                        (producto) => [
                            producto.id,
                            producto,
                        ]
                    )
                );

            const clientesMap =
                new Map(
                    clientesRaw.map(
                        (cliente) => [
                            cliente.id,
                            cliente,
                        ]
                    )
                );

            const sucursalesMap =
                new Map(
                    sucursalesRaw.map(
                        (sucursal) => [
                            sucursal.id,
                            sucursal,
                        ]
                    )
                );

            const cajasMap =
                new Map(
                    cajasRaw.map(
                        (caja) => [
                            caja.id,
                            caja,
                        ]
                    )
                );

            const usuariosMap =
                new Map(
                    usuariosRaw.map(
                        (usuario) => [
                            usuario.id,
                            usuario,
                        ]
                    )
                );

            const historial: VentaHistorial[] =
                ventasRaw.map(
                    (venta) => {
                        const pagosVenta =
                            pagosPorVenta.get(
                                venta.id
                            ) || [];

                        const metodos =
                            Array.from(
                                new Set(
                                    pagosVenta
                                        .map(
                                            (
                                                pago
                                            ) =>
                                                normalizarMetodo(
                                                    pago.metodo_pago
                                                )
                                        )
                                        .filter(
                                            Boolean
                                        )
                                )
                            );

                        let metodo =
                            venta.metodo_pago ||
                            "";

                        if (
                            metodos.length >
                            1
                        ) {
                            metodo =
                                "mixto";
                        } else if (
                            metodos.length ===
                            1
                        ) {
                            metodo =
                                pagosVenta[0]
                                    ?.metodo_pago ||
                                venta.metodo_pago ||
                                "";
                        }

                        const pagosTicket: PagoTicket[] =
                            pagosVenta.map(
                                (
                                    pago
                                ) => ({
                                    metodo:
                                        pago.metodo_pago ||
                                        "",

                                    monto:
                                        obtenerMontoPago(
                                            pago
                                        ),

                                    referencia:
                                        pago.referencia ||
                                        null,

                                    montoRecibido:
                                        pago.monto_recibido !==
                                            undefined &&
                                            pago.monto_recibido !==
                                            null
                                            ? Number(
                                                pago.monto_recibido
                                            )
                                            : null,

                                    cambio:
                                        pago.cambio !==
                                            undefined &&
                                            pago.cambio !==
                                            null
                                            ? Number(
                                                pago.cambio
                                            )
                                            : null,
                                })
                            );

                        const detallesVenta =
                            detallesPorVenta.get(
                                venta.id
                            ) || [];

                        return {
                            id: venta.id,

                            folio:
                                venta.folio,

                            estado:
                                venta.estado,

                            created_at:
                                venta.created_at,

                            subtotal:
                                Number(
                                    venta.subtotal ||
                                    0
                                ),

                            descuento:
                                Number(
                                    venta.descuento ||
                                    0
                                ),

                            impuesto:
                                Number(
                                    venta.impuesto ||
                                    0
                                ),

                            total:
                                Number(
                                    venta.total ||
                                    0
                                ),

                            metodo_pago:
                                metodo,

                            referencia:
                                venta.referencia ||
                                null,

                            notas:
                                venta.notas ||
                                null,

                            cliente:
                                clientesMap.get(
                                    venta.cliente_id ||
                                    ""
                                )?.nombre ||
                                "Público general",

                            negocio:
                                negocioRaw,

                            sucursal:
                                sucursalesMap.get(
                                    venta.sucursal_id ||
                                    ""
                                )?.nombre ||
                                "—",

                            caja:
                                cajasMap.get(
                                    venta.caja_id ||
                                    ""
                                )?.nombre ||
                                "—",

                            cajero:
                                usuariosMap.get(
                                    venta.usuario_id ||
                                    ""
                                )?.nombre ||
                                "—",

                            pagos:
                                pagosTicket,

                            detalles:
                                detallesVenta.map(
                                    (
                                        detalle
                                    ) => {
                                        const producto =
                                            productosMap.get(
                                                detalle.producto_id ||
                                                ""
                                            );

                                        return {
                                            ...detalle,

                                            producto:
                                                producto?.nombre ||
                                                "Producto eliminado",

                                            codigo_barras:
                                                producto?.codigo_barras ||
                                                "",

                                            sku:
                                                producto?.sku ||
                                                "",
                                        };
                                    }
                                ),
                        };
                    }
                );

            setVentas(historial);
        } catch (error) {
            console.error(
                "Error cargando historial:",
                error
            );

            mostrarMensaje(
                "error",
                "Error cargando historial",
                "No se pudo cargar el historial de ventas. Revisa la consola para obtener más detalles."
            );
        } finally {
            setCargando(false);
        }
    }

    useEffect(() => {
        cargarHistorial();
    }, []);

    const ventasFiltradas =
        useMemo(() => {
            const texto =
                busqueda
                    .trim()
                    .toLowerCase();

            return ventas.filter(
                (venta) => {
                    const coincideTexto =
                        !texto ||
                        String(
                            venta.folio ||
                            ""
                        )
                            .toLowerCase()
                            .includes(
                                texto
                            ) ||
                        String(
                            venta.cliente ||
                            ""
                        )
                            .toLowerCase()
                            .includes(
                                texto
                            ) ||
                        String(
                            venta.cajero ||
                            ""
                        )
                            .toLowerCase()
                            .includes(
                                texto
                            ) ||
                        String(
                            venta.sucursal ||
                            ""
                        )
                            .toLowerCase()
                            .includes(
                                texto
                            );

                    const coincideEstado =
                        filtroEstado ===
                        "todos" ||
                        (filtroEstado ===
                            "completadas" &&
                            estadoEsCompletada(
                                venta.estado
                            )) ||
                        (filtroEstado ===
                            "canceladas" &&
                            estadoEsCancelada(
                                venta.estado
                            ));

                    const metodoVenta =
                        normalizarMetodo(
                            venta.metodo_pago
                        );

                    const coincidePago =
                        filtroPago ===
                        "todos" ||
                        metodoVenta ===
                        normalizarMetodo(
                            filtroPago
                        );

                    return (
                        coincideTexto &&
                        coincideEstado &&
                        coincidePago
                    );
                }
            );
        }, [
            ventas,
            busqueda,
            filtroEstado,
            filtroPago,
        ]);

    const resumen =
        useMemo(() => {
            const completadas =
                ventas.filter(
                    (venta) =>
                        estadoEsCompletada(
                            venta.estado
                        )
                );

            const canceladas =
                ventas.filter(
                    (venta) =>
                        estadoEsCancelada(
                            venta.estado
                        )
                );

            const total =
                completadas.reduce(
                    (
                        suma,
                        venta
                    ) =>
                        suma +
                        Number(
                            venta.total ||
                            0
                        ),
                    0
                );

            return {
                totalVentas:
                    ventas.length,

                completadas:
                    completadas.length,

                canceladas:
                    canceladas.length,

                importe: total,
            };
        }, [ventas]);

    return (
        <div
            className="min-h-screen"
            style={{
                backgroundColor:
                    "var(--color-background)",
                color:
                    "var(--color-text)",
            }}
        >
            <div className="mx-auto max-w-7xl p-4 md:p-6">

                {/* ENCABEZADO */}
                <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <h1
                            className="text-2xl font-bold md:text-3xl"
                            style={{
                                color:
                                    "var(--color-text)",
                            }}
                        >
                            Historial de ventas
                        </h1>

                        <p
                            className="mt-1 text-sm"
                            style={{
                                color:
                                    "var(--color-text-secondary)",
                            }}
                        >
                            Consulta, revisa y reimprime tickets de ventas.
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={
                            cargarHistorial
                        }
                        disabled={cargando}
                        className="rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                        style={{
                            backgroundColor:
                                "var(--color-primary)",
                        }}
                    >
                        🔄 Actualizar
                    </button>
                </div>

                {/* RESUMEN */}
                <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">

                    <div
                        className="rounded-2xl border p-4 shadow-sm"
                        style={{
                            backgroundColor:
                                "var(--color-surface)",
                            borderColor:
                                "var(--color-border)",
                        }}
                    >
                        <div
                            className="text-xs font-medium"
                            style={{
                                color:
                                    "var(--color-text-secondary)",
                            }}
                        >
                            Ventas
                        </div>

                        <div
                            className="mt-1 text-2xl font-bold"
                            style={{
                                color:
                                    "var(--color-text)",
                            }}
                        >
                            {resumen.totalVentas}
                        </div>
                    </div>

                    <div
                        className="rounded-2xl border p-4 shadow-sm"
                        style={{
                            backgroundColor:
                                "var(--color-surface)",
                            borderColor:
                                "var(--color-border)",
                        }}
                    >
                        <div
                            className="text-xs font-medium"
                            style={{
                                color:
                                    "var(--color-text-secondary)",
                            }}
                        >
                            Completadas
                        </div>

                        <div
                            className="mt-1 text-2xl font-bold"
                            style={{
                                color:
                                    "var(--color-success)",
                            }}
                        >
                            {resumen.completadas}
                        </div>
                    </div>

                    <div
                        className="rounded-2xl border p-4 shadow-sm"
                        style={{
                            backgroundColor:
                                "var(--color-surface)",
                            borderColor:
                                "var(--color-border)",
                        }}
                    >
                        <div
                            className="text-xs font-medium"
                            style={{
                                color:
                                    "var(--color-text-secondary)",
                            }}
                        >
                            Canceladas
                        </div>

                        <div
                            className="mt-1 text-2xl font-bold"
                            style={{
                                color:
                                    "var(--color-danger)",
                            }}
                        >
                            {resumen.canceladas}
                        </div>
                    </div>

                    <div
                        className="rounded-2xl border p-4 shadow-sm"
                        style={{
                            backgroundColor:
                                "var(--color-surface)",
                            borderColor:
                                "var(--color-border)",
                        }}
                    >
                        <div
                            className="text-xs font-medium"
                            style={{
                                color:
                                    "var(--color-text-secondary)",
                            }}
                        >
                            Importe completadas
                        </div>

                        <div
                            className="mt-1 text-xl font-bold"
                            style={{
                                color:
                                    "var(--color-text)",
                            }}
                        >
                            {formatearMoneda(
                                resumen.importe
                            )}
                        </div>
                    </div>
                </div>

                {/* FILTROS */}
                <div
                    className="mb-5 rounded-2xl border p-4 shadow-sm"
                    style={{
                        backgroundColor:
                            "var(--color-surface)",
                        borderColor:
                            "var(--color-border)",
                    }}
                >
                    <div className="grid gap-3 md:grid-cols-3">

                        <input
                            type="text"
                            value={busqueda}
                            onChange={(e) =>
                                setBusqueda(
                                    e.target.value
                                )
                            }
                            placeholder="Buscar folio, cliente, cajero..."
                            className="rounded-xl border px-4 py-3 text-sm outline-none transition-all placeholder:text-[var(--color-text-secondary)]"
                            style={{
                                backgroundColor:
                                    "var(--color-background)",
                                color:
                                    "var(--color-text)",
                                borderColor:
                                    "var(--color-border)",
                            }}
                            onFocus={(e) => {
                                e.currentTarget.style.borderColor =
                                    "var(--color-primary)";
                                e.currentTarget.style.boxShadow =
                                    "0 0 0 3px color-mix(in srgb, var(--color-primary) 15%, transparent)";
                            }}
                            onBlur={(e) => {
                                e.currentTarget.style.borderColor =
                                    "var(--color-border)";
                                e.currentTarget.style.boxShadow =
                                    "none";
                            }}
                        />

                        <select
                            value={
                                filtroEstado
                            }
                            onChange={(e) =>
                                setFiltroEstado(
                                    e.target.value
                                )
                            }
                            className="rounded-xl border px-4 py-3 text-sm outline-none transition-all"
                            style={{
                                backgroundColor:
                                    "var(--color-background)",
                                color:
                                    "var(--color-text)",
                                borderColor:
                                    "var(--color-border)",
                            }}
                            onFocus={(e) => {
                                e.currentTarget.style.borderColor =
                                    "var(--color-primary)";
                                e.currentTarget.style.boxShadow =
                                    "0 0 0 3px color-mix(in srgb, var(--color-primary) 15%, transparent)";
                            }}
                            onBlur={(e) => {
                                e.currentTarget.style.borderColor =
                                    "var(--color-border)";
                                e.currentTarget.style.boxShadow =
                                    "none";
                            }}
                        >
                            <option value="todos">
                                Todos los estados
                            </option>

                            <option value="completadas">
                                Completadas
                            </option>

                            <option value="canceladas">
                                Canceladas
                            </option>
                        </select>

                        <select
                            value={
                                filtroPago
                            }
                            onChange={(e) =>
                                setFiltroPago(
                                    e.target.value
                                )
                            }
                            className="rounded-xl border px-4 py-3 text-sm outline-none transition-all"
                            style={{
                                backgroundColor:
                                    "var(--color-background)",
                                color:
                                    "var(--color-text)",
                                borderColor:
                                    "var(--color-border)",
                            }}
                            onFocus={(e) => {
                                e.currentTarget.style.borderColor =
                                    "var(--color-primary)";
                                e.currentTarget.style.boxShadow =
                                    "0 0 0 3px color-mix(in srgb, var(--color-primary) 15%, transparent)";
                            }}
                            onBlur={(e) => {
                                e.currentTarget.style.borderColor =
                                    "var(--color-border)";
                                e.currentTarget.style.boxShadow =
                                    "none";
                            }}
                        >
                            <option value="todos">
                                Todos los pagos
                            </option>

                            <option value="efectivo">
                                Efectivo
                            </option>

                            <option value="tarjeta">
                                Tarjeta
                            </option>

                            <option value="transferencia">
                                Transferencia
                            </option>

                            <option value="mixto">
                                Mixto
                            </option>

                            <option value="credito">
                                Crédito
                            </option>
                        </select>
                    </div>
                </div>

                {/* TABLA */}
                <div
                    className="overflow-hidden rounded-2xl border shadow-sm"
                    style={{
                        backgroundColor:
                            "var(--color-surface)",
                        borderColor:
                            "var(--color-border)",
                    }}
                >
                    {cargando ? (
                        <div
                            className="p-10 text-center text-sm"
                            style={{
                                color:
                                    "var(--color-text-secondary)",
                            }}
                        >
                            Cargando historial...
                        </div>
                    ) : ventasFiltradas.length ===
                        0 ? (
                        <div className="p-10 text-center">
                            <div className="text-4xl">
                                🧾
                            </div>

                            <div
                                className="mt-3 font-semibold"
                                style={{
                                    color:
                                        "var(--color-text)",
                                }}
                            >
                                No hay ventas para mostrar
                            </div>

                            <div
                                className="mt-1 text-sm"
                                style={{
                                    color:
                                        "var(--color-text-secondary)",
                                }}
                            >
                                Prueba cambiando los filtros de búsqueda.
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* DESKTOP */}
                            <div className="hidden overflow-x-auto md:block">
                                <table className="w-full text-sm">
                                    <thead
                                        className="text-left text-xs uppercase"
                                        style={{
                                            backgroundColor:
                                                "var(--color-background)",
                                            color:
                                                "var(--color-text-secondary)",
                                        }}
                                    >
                                        <tr>
                                            <th className="px-4 py-3">
                                                Folio
                                            </th>

                                            <th className="px-4 py-3">
                                                Fecha
                                            </th>

                                            <th className="px-4 py-3">
                                                Cliente
                                            </th>

                                            <th className="px-4 py-3">
                                                Pago
                                            </th>

                                            <th className="px-4 py-3">
                                                Total
                                            </th>

                                            <th className="px-4 py-3">
                                                Estado
                                            </th>

                                            <th className="px-4 py-3 text-right">
                                                Acciones
                                            </th>
                                        </tr>
                                    </thead>

                                    <tbody>
                                        {ventasFiltradas.map(
                                            (
                                                venta
                                            ) => (
                                                <tr
                                                    key={
                                                        venta.id
                                                    }
                                                    className="border-t transition-colors hover:bg-[var(--color-background)]"
                                                    style={{
                                                        borderColor:
                                                            "var(--color-border)",
                                                    }}
                                                >
                                                    <td
                                                        className="px-4 py-4 font-bold"
                                                        style={{
                                                            color:
                                                                "var(--color-text)",
                                                        }}
                                                    >
                                                        #
                                                        {
                                                            venta.folio ??
                                                            "—"
                                                        }
                                                    </td>

                                                    <td
                                                        className="px-4 py-4"
                                                        style={{
                                                            color:
                                                                "var(--color-text-secondary)",
                                                        }}
                                                    >
                                                        {formatearFecha(
                                                            venta.created_at
                                                        )}
                                                    </td>

                                                    <td className="px-4 py-4">
                                                        <div
                                                            className="font-medium"
                                                            style={{
                                                                color:
                                                                    "var(--color-text)",
                                                            }}
                                                        >
                                                            {
                                                                venta.cliente
                                                            }
                                                        </div>

                                                        <div
                                                            className="text-xs"
                                                            style={{
                                                                color:
                                                                    "var(--color-text-secondary)",
                                                            }}
                                                        >
                                                            {
                                                                venta.cajero
                                                            }
                                                        </div>
                                                    </td>

                                                    <td className="px-4 py-4">
                                                        <span
                                                            className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold"
                                                            style={{
                                                                backgroundColor:
                                                                    "var(--color-background)",
                                                                color:
                                                                    "var(--color-text)",
                                                                borderColor:
                                                                    "var(--color-border)",
                                                            }}
                                                        >
                                                            {iconoMetodo(
                                                                venta.metodo_pago
                                                            )}

                                                            {nombreMetodo(
                                                                venta.metodo_pago
                                                            )}
                                                        </span>
                                                    </td>

                                                    <td
                                                        className="px-4 py-4 font-bold"
                                                        style={{
                                                            color:
                                                                "var(--color-text)",
                                                        }}
                                                    >
                                                        {formatearMoneda(
                                                            venta.total
                                                        )}
                                                    </td>

                                                    <td className="px-4 py-4">
                                                        <span
                                                            className="rounded-full px-2.5 py-1 text-xs font-semibold"
                                                            style={
                                                                estadoEsCancelada(
                                                                    venta.estado
                                                                )
                                                                    ? {
                                                                        backgroundColor:
                                                                            "var(--color-danger-soft)",
                                                                        color:
                                                                            "var(--color-danger)",
                                                                    }
                                                                    : {
                                                                        backgroundColor:
                                                                            "color-mix(in srgb, var(--color-success) 12%, transparent)",
                                                                        color:
                                                                            "var(--color-success)",
                                                                    }
                                                            }
                                                        >
                                                            {nombreEstado(
                                                                venta.estado
                                                            )}
                                                        </span>
                                                    </td>

                                                    <td className="px-4 py-4">
                                                        <div className="flex justify-end gap-2">
                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    setVentaDetalle(
                                                                        venta
                                                                    )
                                                                }
                                                                className="rounded-lg border px-3 py-2 text-xs font-semibold transition-all hover:bg-[var(--color-background)] active:scale-[0.98]"
                                                                style={{
                                                                    color:
                                                                        "var(--color-text)",
                                                                    borderColor:
                                                                        "var(--color-border)",
                                                                    backgroundColor:
                                                                        "var(--color-surface)",
                                                                }}
                                                            >
                                                                👁️ Ver
                                                            </button>

                                                            {estadoEsCompletada(
                                                                venta.estado
                                                            ) && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() =>
                                                                            setVentaTicket(
                                                                                venta
                                                                            )
                                                                        }
                                                                        className="rounded-lg px-3 py-2 text-xs font-semibold text-white transition-all hover:opacity-90 active:scale-[0.98]"
                                                                        style={{
                                                                            backgroundColor:
                                                                                "var(--color-primary)",
                                                                        }}
                                                                    >
                                                                        🧾 Ticket
                                                                    </button>
                                                                )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            )
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* MOBILE */}
                            <div className="divide-y md:hidden">
                                {ventasFiltradas.map(
                                    (
                                        venta
                                    ) => (
                                        <div
                                            key={
                                                venta.id
                                            }
                                            className="p-4"
                                            style={{
                                                borderColor:
                                                    "var(--color-border)",
                                            }}
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <div
                                                        className="font-bold"
                                                        style={{
                                                            color:
                                                                "var(--color-text)",
                                                        }}
                                                    >
                                                        #
                                                        {
                                                            venta.folio ??
                                                            "—"
                                                        }
                                                    </div>

                                                    <div
                                                        className="mt-1 text-xs"
                                                        style={{
                                                            color:
                                                                "var(--color-text-secondary)",
                                                        }}
                                                    >
                                                        {formatearFecha(
                                                            venta.created_at
                                                        )}
                                                    </div>
                                                </div>

                                                <span
                                                    className="rounded-full px-2 py-1 text-xs font-semibold"
                                                    style={
                                                        estadoEsCancelada(
                                                            venta.estado
                                                        )
                                                            ? {
                                                                backgroundColor:
                                                                    "var(--color-danger-soft)",
                                                                color:
                                                                    "var(--color-danger)",
                                                            }
                                                            : {
                                                                backgroundColor:
                                                                    "color-mix(in srgb, var(--color-success) 12%, transparent)",
                                                                color:
                                                                    "var(--color-success)",
                                                            }
                                                    }
                                                >
                                                    {nombreEstado(
                                                        venta.estado
                                                    )}
                                                </span>
                                            </div>

                                            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                                                <div>
                                                    <div
                                                        className="text-xs"
                                                        style={{
                                                            color:
                                                                "var(--color-text-secondary)",
                                                        }}
                                                    >
                                                        Cliente
                                                    </div>

                                                    <div
                                                        className="font-medium"
                                                        style={{
                                                            color:
                                                                "var(--color-text)",
                                                        }}
                                                    >
                                                        {
                                                            venta.cliente
                                                        }
                                                    </div>
                                                </div>

                                                <div>
                                                    <div
                                                        className="text-xs"
                                                        style={{
                                                            color:
                                                                "var(--color-text-secondary)",
                                                        }}
                                                    >
                                                        Pago
                                                    </div>

                                                    <div
                                                        className="font-medium"
                                                        style={{
                                                            color:
                                                                "var(--color-text)",
                                                        }}
                                                    >
                                                        {
                                                            iconoMetodo(
                                                                venta.metodo_pago
                                                            )
                                                        }{" "}
                                                        {nombreMetodo(
                                                            venta.metodo_pago
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="mt-3 flex items-center justify-between gap-3">
                                                <div
                                                    className="text-lg font-bold"
                                                    style={{
                                                        color:
                                                            "var(--color-text)",
                                                    }}
                                                >
                                                    {formatearMoneda(
                                                        venta.total
                                                    )}
                                                </div>

                                                <div className="flex gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            setVentaDetalle(
                                                                venta
                                                            )
                                                        }
                                                        className="rounded-lg border px-3 py-2 text-xs font-semibold transition-all hover:bg-[var(--color-background)] active:scale-[0.98]"
                                                        style={{
                                                            color:
                                                                "var(--color-text)",
                                                            borderColor:
                                                                "var(--color-border)",
                                                            backgroundColor:
                                                                "var(--color-surface)",
                                                        }}
                                                    >
                                                        👁️ Ver
                                                    </button>

                                                    {estadoEsCompletada(
                                                        venta.estado
                                                    ) && (
                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    setVentaTicket(
                                                                        venta
                                                                    )
                                                                }
                                                                className="rounded-lg px-3 py-2 text-xs font-semibold text-white transition-all hover:opacity-90 active:scale-[0.98]"
                                                                style={{
                                                                    backgroundColor:
                                                                        "var(--color-primary)",
                                                                }}
                                                            >
                                                                🧾 Ticket
                                                            </button>
                                                        )}
                                                </div>
                                            </div>
                                        </div>
                                    )
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* MODAL DETALLE */}
            {ventaDetalle && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px]">
                    <div
                        className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border shadow-2xl"
                        style={{
                            backgroundColor:
                                "var(--color-surface)",
                            borderColor:
                                "var(--color-border)",
                        }}
                    >
                        <div
                            className="sticky top-0 flex items-center justify-between border-b p-4"
                            style={{
                                backgroundColor:
                                    "var(--color-surface)",
                                borderColor:
                                    "var(--color-border)",
                            }}
                        >
                            <div>
                                <h2
                                    className="text-xl font-bold"
                                    style={{
                                        color:
                                            "var(--color-text)",
                                    }}
                                >
                                    Venta #
                                    {
                                        ventaDetalle.folio ??
                                        "—"
                                    }
                                </h2>

                                <p
                                    className="text-sm"
                                    style={{
                                        color:
                                            "var(--color-text-secondary)",
                                    }}
                                >
                                    {formatearFecha(
                                        ventaDetalle.created_at
                                    )}
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={() =>
                                    setVentaDetalle(
                                        null
                                    )
                                }
                                className="rounded-lg px-3 py-2 text-xl transition-colors hover:bg-[var(--color-background)]"
                                style={{
                                    color:
                                        "var(--color-text-secondary)",
                                }}
                            >
                                ✕
                            </button>
                        </div>

                        <div className="space-y-5 p-5">

                            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                                <div>
                                    <div
                                        className="text-xs"
                                        style={{
                                            color:
                                                "var(--color-text-secondary)",
                                        }}
                                    >
                                        Cliente
                                    </div>

                                    <div
                                        className="font-semibold"
                                        style={{
                                            color:
                                                "var(--color-text)",
                                        }}
                                    >
                                        {
                                            ventaDetalle.cliente
                                        }
                                    </div>
                                </div>

                                <div>
                                    <div
                                        className="text-xs"
                                        style={{
                                            color:
                                                "var(--color-text-secondary)",
                                        }}
                                    >
                                        Sucursal
                                    </div>

                                    <div
                                        className="font-semibold"
                                        style={{
                                            color:
                                                "var(--color-text)",
                                        }}
                                    >
                                        {
                                            ventaDetalle.sucursal
                                        }
                                    </div>
                                </div>

                                <div>
                                    <div
                                        className="text-xs"
                                        style={{
                                            color:
                                                "var(--color-text-secondary)",
                                        }}
                                    >
                                        Caja
                                    </div>

                                    <div
                                        className="font-semibold"
                                        style={{
                                            color:
                                                "var(--color-text)",
                                        }}
                                    >
                                        {
                                            ventaDetalle.caja
                                        }
                                    </div>
                                </div>

                                <div>
                                    <div
                                        className="text-xs"
                                        style={{
                                            color:
                                                "var(--color-text-secondary)",
                                        }}
                                    >
                                        Cajero
                                    </div>

                                    <div
                                        className="font-semibold"
                                        style={{
                                            color:
                                                "var(--color-text)",
                                        }}
                                    >
                                        {
                                            ventaDetalle.cajero
                                        }
                                    </div>
                                </div>
                            </div>

                            <div
                                className="overflow-x-auto rounded-xl border"
                                style={{
                                    borderColor:
                                        "var(--color-border)",
                                }}
                            >
                                <table className="w-full text-sm">
                                    <thead
                                        style={{
                                            backgroundColor:
                                                "var(--color-background)",
                                            color:
                                                "var(--color-text-secondary)",
                                        }}
                                    >
                                        <tr>
                                            <th className="px-3 py-3 text-left">
                                                Producto
                                            </th>

                                            <th className="px-3 py-3 text-right">
                                                Cant.
                                            </th>

                                            <th className="px-3 py-3 text-right">
                                                Precio
                                            </th>

                                            <th className="px-3 py-3 text-right">
                                                Subtotal
                                            </th>

                                            <th className="px-3 py-3 text-right">
                                                IVA
                                            </th>

                                            <th className="px-3 py-3 text-right">
                                                Total
                                            </th>
                                        </tr>
                                    </thead>

                                    <tbody>
                                        {ventaDetalle.detalles.map(
                                            (
                                                detalle
                                            ) => (
                                                <tr
                                                    key={
                                                        detalle.id
                                                    }
                                                    className="border-t"
                                                    style={{
                                                        borderColor:
                                                            "var(--color-border)",
                                                    }}
                                                >
                                                    <td className="px-3 py-3">
                                                        <div
                                                            className="font-medium"
                                                            style={{
                                                                color:
                                                                    "var(--color-text)",
                                                            }}
                                                        >
                                                            {
                                                                detalle.producto
                                                            }
                                                        </div>

                                                        {detalle.sku && (
                                                            <div
                                                                className="text-xs"
                                                                style={{
                                                                    color:
                                                                        "var(--color-text-secondary)",
                                                                }}
                                                            >
                                                                SKU:{" "}
                                                                {
                                                                    detalle.sku
                                                                }
                                                            </div>
                                                        )}
                                                    </td>

                                                    <td
                                                        className="px-3 py-3 text-right"
                                                        style={{
                                                            color:
                                                                "var(--color-text)",
                                                        }}
                                                    >
                                                        {
                                                            detalle.cantidad
                                                        }
                                                    </td>

                                                    <td
                                                        className="px-3 py-3 text-right"
                                                        style={{
                                                            color:
                                                                "var(--color-text)",
                                                        }}
                                                    >
                                                        {formatearMoneda(
                                                            detalle.precio_unitario
                                                        )}
                                                    </td>

                                                    <td
                                                        className="px-3 py-3 text-right"
                                                        style={{
                                                            color:
                                                                "var(--color-text)",
                                                        }}
                                                    >
                                                        {formatearMoneda(
                                                            detalle.subtotal
                                                        )}
                                                    </td>

                                                    <td
                                                        className="px-3 py-3 text-right"
                                                        style={{
                                                            color:
                                                                "var(--color-text)",
                                                        }}
                                                    >
                                                        {formatearMoneda(
                                                            detalle.impuesto
                                                        )}
                                                    </td>

                                                    <td
                                                        className="px-3 py-3 text-right font-semibold"
                                                        style={{
                                                            color:
                                                                "var(--color-text)",
                                                        }}
                                                    >
                                                        {formatearMoneda(
                                                            detalle.total
                                                        )}
                                                    </td>
                                                </tr>
                                            )
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            <div className="ml-auto max-w-sm space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span
                                        style={{
                                            color:
                                                "var(--color-text-secondary)",
                                        }}
                                    >
                                        Subtotal
                                    </span>

                                    <span
                                        style={{
                                            color:
                                                "var(--color-text)",
                                        }}
                                    >
                                        {formatearMoneda(
                                            ventaDetalle.subtotal
                                        )}
                                    </span>
                                </div>

                                {ventaDetalle.descuento >
                                    0 && (
                                        <div
                                            className="flex justify-between text-sm"
                                            style={{
                                                color:
                                                    "var(--color-danger)",
                                            }}
                                        >
                                            <span>
                                                Descuento
                                            </span>

                                            <span>
                                                -
                                                {formatearMoneda(
                                                    ventaDetalle.descuento
                                                )}
                                            </span>
                                        </div>
                                    )}

                                <div className="flex justify-between text-sm">
                                    <span
                                        style={{
                                            color:
                                                "var(--color-text-secondary)",
                                        }}
                                    >
                                        IVA
                                    </span>

                                    <span
                                        style={{
                                            color:
                                                "var(--color-text)",
                                        }}
                                    >
                                        {formatearMoneda(
                                            ventaDetalle.impuesto
                                        )}
                                    </span>
                                </div>

                                <div
                                    className="flex justify-between border-t pt-2 text-lg font-bold"
                                    style={{
                                        borderColor:
                                            "var(--color-border)",
                                        color:
                                            "var(--color-text)",
                                    }}
                                >
                                    <span>
                                        Total
                                    </span>

                                    <span
                                        style={{
                                            color:
                                                "var(--color-primary)",
                                        }}
                                    >
                                        {formatearMoneda(
                                            ventaDetalle.total
                                        )}
                                    </span>
                                </div>
                            </div>

                            <div>
                                <h3
                                    className="mb-2 font-bold"
                                    style={{
                                        color:
                                            "var(--color-text)",
                                    }}
                                >
                                    Pagos
                                </h3>

                                <div className="space-y-2">
                                    {ventaDetalle.pagos.length >
                                        0 ? (
                                        ventaDetalle.pagos.map(
                                            (
                                                pago,
                                                index
                                            ) => (
                                                <div
                                                    key={`${ventaDetalle.id}-pago-${index}-${normalizarMetodo(
                                                        pago.metodo
                                                    )}`}
                                                    className="flex items-center justify-between rounded-xl border p-3"
                                                    style={{
                                                        backgroundColor:
                                                            "var(--color-background)",
                                                        borderColor:
                                                            "var(--color-border)",
                                                    }}
                                                >
                                                    <span
                                                        className="font-medium"
                                                        style={{
                                                            color:
                                                                "var(--color-text)",
                                                        }}
                                                    >
                                                        {
                                                            iconoMetodo(
                                                                pago.metodo
                                                            )
                                                        }{" "}
                                                        {
                                                            nombreMetodo(
                                                                pago.metodo
                                                            )
                                                        }
                                                    </span>

                                                    <span
                                                        className="font-bold"
                                                        style={{
                                                            color:
                                                                "var(--color-text)",
                                                        }}
                                                    >
                                                        {formatearMoneda(
                                                            pago.monto
                                                        )}
                                                    </span>
                                                </div>
                                            )
                                        )
                                    ) : (
                                        <div
                                            className="rounded-xl border p-3 text-sm"
                                            style={{
                                                backgroundColor:
                                                    "var(--color-background)",
                                                borderColor:
                                                    "var(--color-border)",
                                                color:
                                                    "var(--color-text)",
                                            }}
                                        >
                                            Método:{" "}
                                            {
                                                nombreMetodo(
                                                    ventaDetalle.metodo_pago
                                                )
                                            }
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div
                            className="flex justify-end gap-2 border-t p-4"
                            style={{
                                borderColor:
                                    "var(--color-border)",
                            }}
                        >
                            {estadoEsCompletada(
                                ventaDetalle.estado
                            ) && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setVentaTicket(
                                                ventaDetalle
                                            );

                                            setVentaDetalle(
                                                null
                                            );
                                        }}
                                        className="rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-[0.98]"
                                        style={{
                                            backgroundColor:
                                                "var(--color-primary)",
                                        }}
                                    >
                                        🧾 Ver ticket
                                    </button>
                                )}

                            <button
                                type="button"
                                onClick={() =>
                                    setVentaDetalle(
                                        null
                                    )
                                }
                                className="rounded-xl border px-4 py-2.5 text-sm font-semibold transition-all hover:bg-[var(--color-background)] active:scale-[0.98]"
                                style={{
                                    color:
                                        "var(--color-text)",
                                    borderColor:
                                        "var(--color-border)",
                                    backgroundColor:
                                        "var(--color-surface)",
                                }}
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL TICKET */}
            {ventaTicket && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-[2px]">
                    <div className="flex max-h-[95vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)] shadow-2xl">

                        <div
                            className="flex items-center justify-between border-b p-4"
                            style={{
                                backgroundColor:
                                    "var(--color-surface)",
                                borderColor:
                                    "var(--color-border)",
                            }}
                        >
                            <div>
                                <h2
                                    className="font-bold"
                                    style={{
                                        color:
                                            "var(--color-text)",
                                    }}
                                >
                                    Ticket de venta
                                </h2>

                                <p
                                    className="text-xs"
                                    style={{
                                        color:
                                            "var(--color-text-secondary)",
                                    }}
                                >
                                    Folio #
                                    {
                                        ventaTicket.folio ??
                                        "—"
                                    }
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={() =>
                                    setVentaTicket(
                                        null
                                    )
                                }
                                className="rounded-lg px-3 py-2 text-xl transition-colors hover:bg-[var(--color-background)]"
                                style={{
                                    color:
                                        "var(--color-text-secondary)",
                                }}
                            >
                                ✕
                            </button>
                        </div>

                        <div className="overflow-y-auto p-4">

                            {/* TICKET DE IMPRESIÓN */}
                            <div
                                id="ticket-print"
                                className="mx-auto w-full max-w-[380px] bg-white p-5 font-mono text-[12px] text-black shadow"
                            >
                                {ventaTicket.negocio
                                    ?.logo_url && (
                                        <div className="mb-3 flex justify-center">
                                            <img
                                                src={
                                                    ventaTicket
                                                        .negocio
                                                        .logo_url
                                                }
                                                alt="Logo del negocio"
                                                className="max-h-20 max-w-[180px] object-contain"
                                            />
                                        </div>
                                    )}

                                <div className="text-center">
                                    <div className="font-bold">
                                        {
                                            ventaTicket
                                                .negocio
                                                ?.nombre ||
                                            "Negocio"
                                        }
                                    </div>

                                    <div>
                                        Folio:{" "}
                                        {String(
                                            ventaTicket.folio ??
                                            ""
                                        ).padStart(
                                            6,
                                            "0"
                                        )}
                                    </div>

                                    <div>
                                        {formatearFecha(
                                            ventaTicket.created_at
                                        )}
                                    </div>
                                </div>

                                <div className="my-3 border-t border-dashed border-black" />

                                <div>
                                    Sucursal:{" "}
                                    {
                                        ventaTicket.sucursal
                                    }
                                </div>

                                <div>
                                    Caja:{" "}
                                    {
                                        ventaTicket.caja
                                    }
                                </div>

                                <div>
                                    Cajero:{" "}
                                    {
                                        ventaTicket.cajero
                                    }
                                </div>

                                {ventaTicket.cliente !==
                                    "Público general" && (
                                        <div>
                                            Cliente:{" "}
                                            {
                                                ventaTicket.cliente
                                            }
                                        </div>
                                    )}

                                <div className="my-3 border-t border-dashed border-black" />

                                <div className="space-y-2">
                                    {ventaTicket.detalles.map(
                                        (
                                            detalle
                                        ) => (
                                            <div
                                                key={
                                                    detalle.id
                                                }
                                            >
                                                <div className="font-semibold">
                                                    {
                                                        detalle.producto
                                                    }
                                                </div>

                                                <div className="flex justify-between">
                                                    <span>
                                                        {
                                                            detalle.cantidad
                                                        }{" "}
                                                        x{" "}
                                                        {formatearMoneda(
                                                            detalle.precio_unitario
                                                        )}
                                                    </span>

                                                    <span>
                                                        {formatearMoneda(
                                                            detalle.total
                                                        )}
                                                    </span>
                                                </div>

                                                <div className="flex justify-between text-[11px]">
                                                    <span>
                                                        Subtotal
                                                    </span>

                                                    <span>
                                                        {formatearMoneda(
                                                            detalle.subtotal
                                                        )}
                                                    </span>
                                                </div>

                                                {Number(
                                                    detalle.impuesto ||
                                                    0
                                                ) > 0 && (
                                                        <div className="flex justify-between text-[11px]">
                                                            <span>
                                                                IVA
                                                            </span>

                                                            <span>
                                                                {formatearMoneda(
                                                                    detalle.impuesto
                                                                )}
                                                            </span>
                                                        </div>
                                                    )}
                                            </div>
                                        )
                                    )}
                                </div>

                                <div className="my-3 border-t border-dashed border-black" />

                                <div className="space-y-1">
                                    <div className="flex justify-between">
                                        <span>
                                            Subtotal
                                        </span>

                                        <span>
                                            {formatearMoneda(
                                                ventaTicket.subtotal
                                            )}
                                        </span>
                                    </div>

                                    {ventaTicket.descuento >
                                        0 && (
                                            <div className="flex justify-between">
                                                <span>
                                                    Descuento
                                                </span>

                                                <span>
                                                    -
                                                    {formatearMoneda(
                                                        ventaTicket.descuento
                                                    )}
                                                </span>
                                            </div>
                                        )}

                                    {ventaTicket.impuesto >
                                        0 && (
                                            <div className="flex justify-between">
                                                <span>
                                                    IVA
                                                </span>

                                                <span>
                                                    {formatearMoneda(
                                                        ventaTicket.impuesto
                                                    )}
                                                </span>
                                            </div>
                                        )}

                                    <div className="flex justify-between text-base font-bold">
                                        <span>
                                            TOTAL
                                        </span>

                                        <span>
                                            {formatearMoneda(
                                                ventaTicket.total
                                            )}
                                        </span>
                                    </div>
                                </div>

                                <div className="my-3 border-t border-dashed border-black" />

                                <div className="space-y-1">
                                    {ventaTicket.pagos.length >
                                        0 ? (
                                        ventaTicket.pagos.map(
                                            (
                                                pago,
                                                index
                                            ) => (
                                                <div
                                                    key={`${ventaTicket.id}-ticket-pago-${index}-${normalizarMetodo(
                                                        pago.metodo
                                                    )}`}
                                                >
                                                    <div className="flex justify-between">
                                                        <span>
                                                            {nombreMetodo(
                                                                pago.metodo
                                                            )}
                                                        </span>

                                                        <span>
                                                            {formatearMoneda(
                                                                pago.monto
                                                            )}
                                                        </span>
                                                    </div>

                                                    {normalizarMetodo(
                                                        pago.metodo
                                                    ) ===
                                                        "efectivo" &&
                                                        pago.montoRecibido !==
                                                        null &&
                                                        pago.montoRecibido !==
                                                        undefined && (
                                                            <>
                                                                <div className="flex justify-between">
                                                                    <span>
                                                                        Recibido
                                                                    </span>

                                                                    <span>
                                                                        {formatearMoneda(
                                                                            pago.montoRecibido
                                                                        )}
                                                                    </span>
                                                                </div>

                                                                {pago.cambio !==
                                                                    null &&
                                                                    pago.cambio !==
                                                                    undefined && (
                                                                        <div className="flex justify-between">
                                                                            <span>
                                                                                Cambio
                                                                            </span>

                                                                            <span>
                                                                                {formatearMoneda(
                                                                                    pago.cambio
                                                                                )}
                                                                            </span>
                                                                        </div>
                                                                    )}
                                                            </>
                                                        )}
                                                </div>
                                            )
                                        )
                                    ) : (
                                        <div>
                                            Pago:{" "}
                                            {
                                                nombreMetodo(
                                                    ventaTicket.metodo_pago
                                                )
                                            }
                                        </div>
                                    )}
                                </div>

                                {normalizarMetodo(
                                    ventaTicket.metodo_pago
                                ) === "credito" && (
                                        <div className="mt-3 text-center font-bold">
                                            Venta a crédito
                                        </div>
                                    )}

                                <div className="my-4 text-center">
                                    <div className="font-bold">
                                        ¡Gracias por su compra!
                                    </div>

                                    <div className="mt-3 border-t border-dashed border-black pt-3 text-[10px]">
                                        <div className="font-bold">
                                            Soporte IT
                                        </div>

                                        <div>
                                            Punto de Venta por Soporte IT
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div
                            className="flex gap-2 border-t p-4"
                            style={{
                                backgroundColor:
                                    "var(--color-surface)",
                                borderColor:
                                    "var(--color-border)",
                            }}
                        >
                            <button
                                type="button"
                                onClick={() =>
                                    imprimirTicket(
                                        ventaTicket
                                    )
                                }
                                disabled={
                                    imprimiendo
                                }
                                className="flex-1 rounded-xl px-4 py-3 text-sm font-bold text-white transition-all hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                                style={{
                                    backgroundColor:
                                        "var(--color-primary)",
                                }}
                            >
                                {imprimiendo
                                    ? "Imprimiendo..."
                                    : "🖨️ Imprimir"}
                            </button>

                            <button
                                type="button"
                                onClick={() =>
                                    setVentaTicket(
                                        null
                                    )
                                }
                                className="rounded-xl border px-4 py-3 text-sm font-semibold transition-all hover:bg-[var(--color-background)] active:scale-[0.98]"
                                style={{
                                    color:
                                        "var(--color-text)",
                                    borderColor:
                                        "var(--color-border)",
                                    backgroundColor:
                                        "var(--color-surface)",
                                }}
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <ModalMensaje
                mensaje={mensaje}
                cerrar={() =>
                    setMensaje(null)
                }
            />
        </div>
    );
}