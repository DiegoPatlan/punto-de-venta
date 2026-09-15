"use client";

import {
    FormEvent,
    useEffect,
    useMemo,
    useState,
} from "react";

import { useRouter } from "next/navigation";

import {
    obtenerUsuarioPOS,
    UsuarioPOS,
} from "../../../../lib/usuarioPOS";

import { supabasePOS } from "../../../../lib/supabase";

import ModalMensaje from "../../../components/ModalMensaje";

interface Cliente {
    id: string;
    nombre: string;
    telefono: string | null;
    email: string | null;
    direccion: string | null;
    rfc: string | null;
    limite_credito: number;
    saldo_credito: number;
    activo: boolean;
    created_at: string;
}

interface FormularioCliente {
    nombre: string;
    telefono: string;
    email: string;
    direccion: string;
    rfc: string;
    limite_credito: string;
}

interface FormularioAbono {
    monto: string;
    metodo_pago: "efectivo" | "tarjeta" | "transferencia";
    referencia: string;
    notas: string;
}

type TipoModal =
    | "exito"
    | "error"
    | "confirmacion"
    | "info";

interface ModalEstado {
    abierto: boolean;
    tipo: TipoModal;
    titulo: string;
    mensaje: string;
}

const formularioInicial: FormularioCliente = {
    nombre: "",
    telefono: "",
    email: "",
    direccion: "",
    rfc: "",
    limite_credito: "0",
};

const formularioAbonoInicial: FormularioAbono = {
    monto: "",
    metodo_pago: "efectivo",
    referencia: "",
    notas: "",
};

export default function ClientesPage() {
    const router = useRouter();

    const [usuarioActual, setUsuarioActual] =
        useState<UsuarioPOS | null>(null);

    const [clientes, setClientes] =
        useState<Cliente[]>([]);

    const [cargando, setCargando] =
        useState(true);

    const [guardando, setGuardando] =
        useState(false);

    const [guardandoAbono, setGuardandoAbono] =
        useState(false);

    const [busqueda, setBusqueda] =
        useState("");

    // -----------------------------
    // FORMULARIO CLIENTE
    // -----------------------------

    const [mostrarFormulario, setMostrarFormulario] =
        useState(false);

    const [formulario, setFormulario] =
        useState<FormularioCliente>(
            formularioInicial
        );

    const [clienteSeleccionado, setClienteSeleccionado] =
        useState<Cliente | null>(null);

    // -----------------------------
    // FORMULARIO ABONO
    // -----------------------------

    const [mostrarAbono, setMostrarAbono] =
        useState(false);

    const [clienteAbono, setClienteAbono] =
        useState<Cliente | null>(null);

    const [formularioAbono, setFormularioAbono] =
        useState<FormularioAbono>(
            formularioAbonoInicial
        );

    // -----------------------------
    // MODAL MENSAJES
    // -----------------------------

    const [modal, setModal] =
        useState<ModalEstado>({
            abierto: false,
            tipo: "info",
            titulo: "",
            mensaje: "",
        });

    // =========================================================
    // MODAL
    // =========================================================

    const mostrarModal = (
        tipo: TipoModal,
        titulo: string,
        mensaje: string
    ) => {
        setModal({
            abierto: true,
            tipo,
            titulo,
            mensaje,
        });
    };

    const cerrarModal = () => {
        setModal((actual) => ({
            ...actual,
            abierto: false,
        }));
    };

    // =========================================================
    // CARGAR CLIENTES
    // =========================================================

    const cargarClientes = async (
        negocioId: string
    ) => {
        try {
            setCargando(true);

            const { data, error } =
                await supabasePOS
                    .from("clientes")
                    .select(`
id,
    nombre,
    telefono,
    email,
    direccion,
    rfc,
    limite_credito,
    saldo_credito,
    activo,
    created_at
        `)
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

            if (error) {
                console.error(
                    "Error cargando clientes:",
                    error
                );

                mostrarModal(
                    "error",
                    "Error",
                    "No fue posible cargar los clientes."
                );

                return;
            }

            setClientes(
                (data as Cliente[]) ?? []
            );
        } catch (error) {
            console.error(error);

            mostrarModal(
                "error",
                "Error",
                "Ocurrió un error al cargar los clientes."
            );
        } finally {
            setCargando(false);
        }
    };

    // =========================================================
    // INICIALIZAR
    // =========================================================

    useEffect(() => {
        const inicializar = async () => {
            try {
                const usuario =
                    await obtenerUsuarioPOS();

                if (!usuario) {
                    router.replace(
                        "/pos/login"
                    );
                    return;
                }

                setUsuarioActual(usuario);

                if (!usuario.negocio_id) {
                    mostrarModal(
                        "error",
                        "Error",
                        "El usuario no tiene un negocio asignado."
                    );

                    return;
                }

                await cargarClientes(
                    usuario.negocio_id
                );
            } catch (error) {
                console.error(error);

                mostrarModal(
                    "error",
                    "Error",
                    "No fue posible inicializar la pantalla de clientes."
                );
            }
        };

        inicializar();
    }, [router]);

    // =========================================================
    // FILTRAR CLIENTES
    // =========================================================

    const clientesFiltrados = useMemo(() => {
        const texto = busqueda
            .trim()
            .toLowerCase();

        if (!texto) {
            return clientes;
        }

        return clientes.filter(
            (cliente) => {
                return (
                    cliente.nombre
                        .toLowerCase()
                        .includes(texto) ||
                    cliente.telefono
                        ?.toLowerCase()
                        .includes(texto) ||
                    cliente.email
                        ?.toLowerCase()
                        .includes(texto) ||
                    cliente.rfc
                        ?.toLowerCase()
                        .includes(texto)
                );
            }
        );
    }, [clientes, busqueda]);

    // =========================================================
    // RESUMEN
    // =========================================================

    const totalClientes =
        clientes.length;

    const clientesConCredito =
        clientes.filter(
            (cliente) =>
                Number(
                    cliente.saldo_credito || 0
                ) > 0
        ).length;

    const saldoTotalCredito =
        clientes.reduce(
            (total, cliente) =>
                total +
                Number(
                    cliente.saldo_credito || 0
                ),
            0
        );

    const limiteTotalCredito =
        clientes.reduce(
            (total, cliente) =>
                total +
                Number(
                    cliente.limite_credito || 0
                ),
            0
        );

    // =========================================================
    // FORMULARIO CLIENTE
    // =========================================================

    const abrirNuevoCliente = () => {
        setClienteSeleccionado(null);

        setFormulario({
            ...formularioInicial,
        });

        setMostrarFormulario(true);
    };

    const editarCliente = (
        cliente: Cliente
    ) => {
        setClienteSeleccionado(cliente);

        setFormulario({
            nombre: cliente.nombre,
            telefono:
                cliente.telefono ?? "",
            email:
                cliente.email ?? "",
            direccion:
                cliente.direccion ?? "",
            rfc:
                cliente.rfc ?? "",
            limite_credito:
                String(
                    cliente.limite_credito ?? 0
                ),
        });

        setMostrarFormulario(true);
    };

    const cerrarFormulario = () => {
        if (guardando) return;

        setMostrarFormulario(false);
        setClienteSeleccionado(null);

        setFormulario({
            ...formularioInicial,
        });
    };

    const manejarCambio = (
        campo: keyof FormularioCliente,
        valor: string
    ) => {
        setFormulario((actual) => ({
            ...actual,
            [campo]: valor,
        }));
    };

    // =========================================================
    // GUARDAR CLIENTE
    // =========================================================

    const guardarCliente = async (
        event: FormEvent<HTMLFormElement>
    ) => {
        event.preventDefault();

        if (!usuarioActual?.negocio_id) {
            mostrarModal(
                "error",
                "Error",
                "No se pudo identificar el negocio."
            );

            return;
        }

        const nombre =
            formulario.nombre.trim();

        if (!nombre) {
            mostrarModal(
                "error",
                "Datos incompletos",
                "El nombre del cliente es obligatorio."
            );

            return;
        }

        const limiteCredito =
            Number(
                formulario.limite_credito
            );

        if (
            !Number.isFinite(
                limiteCredito
            ) ||
            limiteCredito < 0
        ) {
            mostrarModal(
                "error",
                "Límite de crédito inválido",
                "El límite de crédito debe ser un número mayor o igual a cero."
            );

            return;
        }

        try {
            setGuardando(true);

            if (clienteSeleccionado) {
                const { error } =
                    await supabasePOS
                        .from("clientes")
                        .update({
                            nombre,
                            telefono:
                                formulario.telefono.trim() ||
                                null,
                            email:
                                formulario.email.trim() ||
                                null,
                            direccion:
                                formulario.direccion.trim() ||
                                null,
                            rfc:
                                formulario.rfc.trim() ||
                                null,
                            limite_credito:
                                limiteCredito,
                        })
                        .eq(
                            "id",
                            clienteSeleccionado.id
                        )
                        .eq(
                            "negocio_id",
                            usuarioActual.negocio_id
                        );

                if (error) {
                    console.error(
                        "Error actualizando cliente:",
                        error
                    );

                    mostrarModal(
                        "error",
                        "Error",
                        "No fue posible actualizar el cliente."
                    );

                    return;
                }

                mostrarModal(
                    "exito",
                    "Cliente actualizado",
                    "Los datos del cliente fueron actualizados correctamente."
                );
            } else {
                const { error } =
                    await supabasePOS
                        .from("clientes")
                        .insert({
                            negocio_id:
                                usuarioActual.negocio_id,
                            nombre,
                            telefono:
                                formulario.telefono.trim() ||
                                null,
                            email:
                                formulario.email.trim() ||
                                null,
                            direccion:
                                formulario.direccion.trim() ||
                                null,
                            rfc:
                                formulario.rfc.trim() ||
                                null,
                            limite_credito:
                                limiteCredito,
                            saldo_credito: 0,
                            activo: true,
                        });

                if (error) {
                    console.error(
                        "Error creando cliente:",
                        error
                    );

                    mostrarModal(
                        "error",
                        "Error",
                        "No fue posible crear el cliente."
                    );

                    return;
                }

                mostrarModal(
                    "exito",
                    "Cliente creado",
                    "El cliente fue registrado correctamente."
                );
            }

            cerrarFormulario();

            await cargarClientes(
                usuarioActual.negocio_id
            );
        } catch (error) {
            console.error(error);

            mostrarModal(
                "error",
                "Error",
                "Ocurrió un error al guardar el cliente."
            );
        } finally {
            setGuardando(false);
        }
    };

    // =========================================================
    // ABONOS
    // =========================================================

    const abrirAbono = (
        cliente: Cliente
    ) => {
        if (
            Number(
                cliente.saldo_credito || 0
            ) <= 0
        ) {
            mostrarModal(
                "info",
                "Sin saldo pendiente",
                "Este cliente no tiene saldo pendiente por pagar."
            );

            return;
        }

        setClienteAbono(cliente);

        setFormularioAbono({
            ...formularioAbonoInicial,
        });

        setMostrarAbono(true);
    };

    const cerrarAbono = () => {
        if (guardandoAbono) return;

        setMostrarAbono(false);
        setClienteAbono(null);

        setFormularioAbono({
            ...formularioAbonoInicial,
        });
    };

    const manejarCambioAbono = (
        campo: keyof FormularioAbono,
        valor: string
    ) => {
        setFormularioAbono(
            (actual) => ({
                ...actual,
                [campo]: valor,
            })
        );
    };

    // =========================================================
    // REGISTRAR ABONO
    // =========================================================

    const registrarAbono = async (
        event: FormEvent<HTMLFormElement>
    ) => {
        event.preventDefault();

        if (!usuarioActual?.negocio_id) {
            mostrarModal(
                "error",
                "Error",
                "No se pudo identificar el negocio."
            );

            return;
        }

        if (!clienteAbono) {
            mostrarModal(
                "error",
                "Error",
                "No se seleccionó ningún cliente."
            );

            return;
        }

        const monto =
            Number(
                formularioAbono.monto
            );

        const saldoActual =
            Number(
                clienteAbono.saldo_credito ||
                0
            );

        if (
            !Number.isFinite(monto) ||
            monto <= 0
        ) {
            mostrarModal(
                "error",
                "Monto inválido",
                "El monto del abono debe ser mayor a cero."
            );

            return;
        }

        if (monto > saldoActual) {
            mostrarModal(
                "error",
                "Monto excedido",
                `El abono no puede ser mayor al saldo pendiente de ${formatearMoneda(
                    saldoActual
                )
                }.`
            );

            return;
        }

        if (
            formularioAbono.metodo_pago !==
            "efectivo" &&
            !formularioAbono.referencia.trim()
        ) {
            mostrarModal(
                "error",
                "Referencia requerida",
                "Debes capturar la referencia del pago cuando el método sea tarjeta o transferencia."
            );

            return;
        }

        try {
            setGuardandoAbono(true);

            // -------------------------------------------------
            // BUSCAR LA SESIÓN DE CAJA ABIERTA DEL USUARIO
            // -------------------------------------------------

            const {
                data: sesion,
                error: errorSesion,
            } = await supabasePOS
                .from("sesiones_caja")
                .select(`
id,
    estado,
    usuario_apertura_id
        `)
                .eq(
                    "usuario_apertura_id",
                    usuarioActual.id
                )
                .eq(
                    "estado",
                    "abierta"
                )
                .order(
                    "fecha_apertura",
                    {
                        ascending: false,
                    }
                )
                .limit(1)
                .maybeSingle();

            if (errorSesion) {
                console.error(
                    "Error buscando sesión:",
                    errorSesion
                );

                mostrarModal(
                    "error",
                    "Error de caja",
                    "No fue posible consultar la sesión de caja."
                );

                return;
            }

            if (!sesion) {
                mostrarModal(
                    "error",
                    "Caja cerrada",
                    "No tienes una sesión de caja abierta. Abre tu caja antes de registrar un abono."
                );

                return;
            }

            // -------------------------------------------------
            // LLAMAR RPC
            // -------------------------------------------------

            const {
                data,
                error,
            } = await supabasePOS.rpc(
                "registrar_abono_cliente",
                {
                    p_cliente_id:
                        clienteAbono.id,

                    p_sesion_caja_id:
                        sesion.id,

                    p_monto:
                        monto,

                    p_metodo_pago:
                        formularioAbono.metodo_pago,

                    p_referencia:
                        formularioAbono.referencia.trim() ||
                        null,

                    p_notas:
                        formularioAbono.notas.trim() ||
                        null,
                }
            );

            if (error) {
                console.error(
                    "Error registrando abono:",
                    error
                );

                mostrarModal(
                    "error",
                    "No se pudo registrar",
                    error.message ||
                    "Ocurrió un error al registrar el abono."
                );

                return;
            }

            console.log(
                "Resultado registrar_abono_cliente:",
                data
            );

            const resultado =
                data as {
                    ok?: boolean;
                    saldo_nuevo?: number;
                    monto_abono?: number;
                };

            // -------------------------------------------------
            // ACTUALIZAR CLIENTE EN PANTALLA
            // -------------------------------------------------

            if (
                typeof resultado.saldo_nuevo ===
                "number"
            ) {
                setClientes(
                    (actuales) =>
                        actuales.map(
                            (cliente) =>
                                cliente.id ===
                                    clienteAbono.id
                                    ? {
                                        ...cliente,
                                        saldo_credito:
                                            resultado.saldo_nuevo ??
                                            0,
                                    }
                                    : cliente
                        )
                );
            } else {
                await cargarClientes(
                    usuarioActual.negocio_id
                );
            }

            const nombreCliente =
                clienteAbono.nombre;

            const montoRegistrado =
                resultado.monto_abono ??
                monto;

            cerrarAbono();

            mostrarModal(
                "exito",
                "Abono registrado",
                `Se registró correctamente un abono de ${formatearMoneda(
                    montoRegistrado
                )
                } para ${nombreCliente}.`
            );
        } catch (error) {
            console.error(error);

            mostrarModal(
                "error",
                "Error",
                "Ocurrió un error inesperado al registrar el abono."
            );
        } finally {
            setGuardandoAbono(false);
        }
    };

    // =========================================================
    // FORMATEAR MONEDA
    // =========================================================

    const formatearMoneda = (
        valor: number
    ) => {
        return new Intl.NumberFormat(
            "es-MX",
            {
                style: "currency",
                currency: "MXN",
            }
        ).format(valor || 0);
    };

    // =========================================================
    // ESTILOS REUTILIZABLES
    // =========================================================

    const inputClass =
        "w-full rounded-xl border px-4 py-3 text-sm outline-none transition focus:ring-2";

    const inputStyle = {
        backgroundColor:
            "var(--color-surface)",
        color: "var(--color-text)",
        borderColor:
            "var(--color-border)",
    };

    // =========================================================
    // RENDER
    // =========================================================

    return (
        <div
            className="min-h-screen p-4 md:p-6"
            style={{
                backgroundColor:
                    "var(--color-background)",
                color:
                    "var(--color-text)",
            }}
        >
            <div className="mx-auto max-w-7xl space-y-6">

                {/* HEADER */}

                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                        <h1
                            className="text-2xl font-bold"
                            style={{
                                color:
                                    "var(--color-text)",
                            }}
                        >
                            Clientes
                        </h1>

                        <p
                            className="mt-1 text-sm"
                            style={{
                                color:
                                    "var(--color-text-secondary)",
                            }}
                        >
                            Administra tus clientes y sus
                            cuentas de crédito.
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={
                            abrirNuevoCliente
                        }
                        className="rounded-xl px-5 py-3 text-sm font-semibold text-white shadow-sm transition active:scale-[0.98]"
                        style={{
                            backgroundColor:
                                "var(--color-primary)",
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor =
                                "var(--color-primary-hover)";
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor =
                                "var(--color-primary)";
                        }}
                    >
                        + Nuevo cliente
                    </button>
                </div>

                {/* RESUMEN */}

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">

                    <div
                        className="rounded-2xl border p-5 shadow-sm"
                        style={{
                            backgroundColor:
                                "var(--color-surface)",
                            borderColor:
                                "var(--color-border)",
                        }}
                    >
                        <p
                            className="text-sm"
                            style={{
                                color:
                                    "var(--color-text-secondary)",
                            }}
                        >
                            Total clientes
                        </p>

                        <p
                            className="mt-2 text-2xl font-bold"
                            style={{
                                color:
                                    "var(--color-text)",
                            }}
                        >
                            {totalClientes}
                        </p>
                    </div>

                    <div
                        className="rounded-2xl border p-5 shadow-sm"
                        style={{
                            backgroundColor:
                                "var(--color-surface)",
                            borderColor:
                                "var(--color-border)",
                        }}
                    >
                        <p
                            className="text-sm"
                            style={{
                                color:
                                    "var(--color-text-secondary)",
                            }}
                        >
                            Con saldo pendiente
                        </p>

                        <p
                            className="mt-2 text-2xl font-bold"
                            style={{
                                color:
                                    "var(--color-warning)",
                            }}
                        >
                            {clientesConCredito}
                        </p>
                    </div>

                    <div
                        className="rounded-2xl border p-5 shadow-sm"
                        style={{
                            backgroundColor:
                                "var(--color-surface)",
                            borderColor:
                                "var(--color-border)",
                        }}
                    >
                        <p
                            className="text-sm"
                            style={{
                                color:
                                    "var(--color-text-secondary)",
                            }}
                        >
                            Saldo por cobrar
                        </p>

                        <p
                            className="mt-2 text-2xl font-bold"
                            style={{
                                color:
                                    "var(--color-danger)",
                            }}
                        >
                            {formatearMoneda(
                                saldoTotalCredito
                            )}
                        </p>
                    </div>

                    <div
                        className="rounded-2xl border p-5 shadow-sm"
                        style={{
                            backgroundColor:
                                "var(--color-surface)",
                            borderColor:
                                "var(--color-border)",
                        }}
                    >
                        <p
                            className="text-sm"
                            style={{
                                color:
                                    "var(--color-text-secondary)",
                            }}
                        >
                            Límite de crédito
                        </p>

                        <p
                            className="mt-2 text-2xl font-bold"
                            style={{
                                color:
                                    "var(--color-success)",
                            }}
                        >
                            {formatearMoneda(
                                limiteTotalCredito
                            )}
                        </p>
                    </div>
                </div>

                {/* BÚSQUEDA */}

                <div
                    className="rounded-2xl border p-4 shadow-sm"
                    style={{
                        backgroundColor:
                            "var(--color-surface)",
                        borderColor:
                            "var(--color-border)",
                    }}
                >
                    <input
                        type="text"
                        value={busqueda}
                        onChange={(e) =>
                            setBusqueda(
                                e.target.value
                            )
                        }
                        placeholder="Buscar por nombre, teléfono, correo o RFC..."
                        className={`${inputClass} focus: border - [var(--color - primary)]focus: ring - [var(--color - primary)]/20`}
                        style={inputStyle}
                    />
                </div >

                {/* LISTA */}

                < div className="space-y-4" >

                    {
                        cargando ? (
                            <div
                                className="rounded-2xl border p-10 text-center text-sm shadow-sm"
                                style={{
                                    backgroundColor:
                                        "var(--color-surface)",
                                    borderColor:
                                        "var(--color-border)",
                                    color:
                                        "var(--color-text-secondary)",
                                }}
                            >
                                Cargando clientes...
                            </div >
                        ) : clientesFiltrados.length ===
                            0 ? (
                            <div
                                className="rounded-2xl border p-10 text-center shadow-sm"
                                style={{
                                    backgroundColor:
                                        "var(--color-surface)",
                                    borderColor:
                                        "var(--color-border)",
                                }}
                            >
                                <p
                                    className="text-lg font-semibold"
                                    style={{
                                        color:
                                            "var(--color-text)",
                                    }}
                                >
                                    No hay clientes
                                </p>

                                <p
                                    className="mt-1 text-sm"
                                    style={{
                                        color:
                                            "var(--color-text-secondary)",
                                    }}
                                >
                                    {busqueda
                                        ? "No encontramos clientes con esa búsqueda."
                                        : "Aún no tienes clientes registrados."}
                                </p>
                            </div>
                        ) : (
                            clientesFiltrados.map(
                                (cliente) => {
                                    const saldo =
                                        Number(
                                            cliente.saldo_credito ||
                                            0
                                        );

                                    const limite =
                                        Number(
                                            cliente.limite_credito ||
                                            0
                                        );

                                    const disponible =
                                        Math.max(
                                            limite -
                                            saldo,
                                            0
                                        );

                                    return (
                                        <div
                                            key={
                                                cliente.id
                                            }
                                            className="rounded-2xl border p-5 shadow-sm transition"
                                            style={{
                                                backgroundColor:
                                                    "var(--color-surface)",
                                                borderColor:
                                                    "var(--color-border)",
                                            }}
                                        >
                                            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">

                                                {/* DATOS */}

                                                <div className="min-w-0 flex-1">

                                                    <div className="flex flex-wrap items-center gap-2">

                                                        <h2
                                                            className="text-lg font-bold"
                                                            style={{
                                                                color:
                                                                    "var(--color-text)",
                                                            }}
                                                        >
                                                            {
                                                                cliente.nombre
                                                            }
                                                        </h2>

                                                        {saldo >
                                                            0 && (
                                                                <span
                                                                    className="rounded-full px-2.5 py-1 text-xs font-semibold"
                                                                    style={{
                                                                        backgroundColor:
                                                                            "color-mix(in srgb, var(--color-warning) 12%, transparent)",
                                                                        color:
                                                                            "var(--color-warning)",
                                                                    }}
                                                                >
                                                                    Crédito pendiente
                                                                </span>
                                                            )}
                                                    </div>

                                                    <div
                                                        className="mt-2 space-y-1 text-sm"
                                                        style={{
                                                            color:
                                                                "var(--color-text-secondary)",
                                                        }}
                                                    >
                                                        {cliente.telefono && (
                                                            <p>
                                                                📞{" "}
                                                                {
                                                                    cliente.telefono
                                                                }
                                                            </p>
                                                        )}

                                                        {cliente.email && (
                                                            <p>
                                                                ✉️{" "}
                                                                {
                                                                    cliente.email
                                                                }
                                                            </p>
                                                        )}

                                                        {cliente.rfc && (
                                                            <p>
                                                                RFC:{" "}
                                                                {
                                                                    cliente.rfc
                                                                }
                                                            </p>
                                                        )}

                                                        {cliente.direccion && (
                                                            <p>
                                                                📍{" "}
                                                                {
                                                                    cliente.direccion
                                                                }
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* CRÉDITO */}

                                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:min-w-[430px]">

                                                    <div
                                                        className="rounded-xl p-3"
                                                        style={{
                                                            backgroundColor:
                                                                "var(--color-background)",
                                                            border:
                                                                "1px solid var(--color-border)",
                                                        }}
                                                    >
                                                        <p
                                                            className="text-xs"
                                                            style={{
                                                                color:
                                                                    "var(--color-text-secondary)",
                                                            }}
                                                        >
                                                            Límite
                                                        </p>

                                                        <p
                                                            className="mt-1 font-bold"
                                                            style={{
                                                                color:
                                                                    "var(--color-text)",
                                                            }}
                                                        >
                                                            {formatearMoneda(
                                                                limite
                                                            )}
                                                        </p>
                                                    </div>

                                                    <div
                                                        className="rounded-xl p-3"
                                                        style={{
                                                            backgroundColor:
                                                                "var(--color-danger-soft)",
                                                        }}
                                                    >
                                                        <p
                                                            className="text-xs"
                                                            style={{
                                                                color:
                                                                    "var(--color-danger)",
                                                            }}
                                                        >
                                                            Saldo
                                                        </p>

                                                        <p
                                                            className="mt-1 font-bold"
                                                            style={{
                                                                color:
                                                                    "var(--color-danger)",
                                                            }}
                                                        >
                                                            {formatearMoneda(
                                                                saldo
                                                            )}
                                                        </p>
                                                    </div>

                                                    <div
                                                        className="rounded-xl p-3"
                                                        style={{
                                                            backgroundColor:
                                                                "color-mix(in srgb, var(--color-success) 8%, var(--color-surface))",
                                                        }}
                                                    >
                                                        <p
                                                            className="text-xs"
                                                            style={{
                                                                color:
                                                                    "var(--color-success)",
                                                            }}
                                                        >
                                                            Disponible
                                                        </p>

                                                        <p
                                                            className="mt-1 font-bold"
                                                            style={{
                                                                color:
                                                                    "var(--color-success)",
                                                            }}
                                                        >
                                                            {formatearMoneda(
                                                                disponible
                                                            )}
                                                        </p>
                                                    </div>
                                                </div>

                                                {/* ACCIONES */}

                                                <div className="flex flex-wrap items-center justify-end gap-2">

                                                    {saldo >
                                                        0 && (
                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    abrirAbono(
                                                                        cliente
                                                                    )
                                                                }
                                                                className="rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition active:scale-[0.98]"
                                                                style={{
                                                                    backgroundColor:
                                                                        "var(--color-success)",
                                                                }}
                                                                onMouseEnter={(
                                                                    e
                                                                ) => {
                                                                    e.currentTarget.style.filter =
                                                                        "brightness(0.92)";
                                                                }}
                                                                onMouseLeave={(
                                                                    e
                                                                ) => {
                                                                    e.currentTarget.style.filter =
                                                                        "none";
                                                                }}
                                                            >
                                                                Abonar
                                                            </button>
                                                        )}

                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            editarCliente(
                                                                cliente
                                                            )
                                                        }
                                                        className="rounded-xl border px-4 py-2.5 text-sm font-semibold transition active:scale-[0.98]"
                                                        style={{
                                                            backgroundColor:
                                                                "var(--color-surface)",
                                                            borderColor:
                                                                "var(--color-border)",
                                                            color:
                                                                "var(--color-text)",
                                                        }}
                                                        onMouseEnter={(
                                                            e
                                                        ) => {
                                                            e.currentTarget.style.backgroundColor =
                                                                "var(--color-background)";
                                                        }}
                                                        onMouseLeave={(
                                                            e
                                                        ) => {
                                                            e.currentTarget.style.backgroundColor =
                                                                "var(--color-surface)";
                                                        }}
                                                    >
                                                        Editar
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                }
                            )
                        )}
                </div >
            </div >

            {/* =====================================================
                MODAL CLIENTE
            ===================================================== */}

            {
                mostrarFormulario && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">

                        <div
                            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl shadow-2xl"
                            style={{
                                backgroundColor:
                                    "var(--color-surface)",
                                color:
                                    "var(--color-text)",
                            }}
                        >
                            <div
                                className="flex items-center justify-between border-b px-6 py-4"
                                style={{
                                    borderColor:
                                        "var(--color-border)",
                                }}
                            >
                                <div>
                                    <h2
                                        className="text-lg font-bold"
                                        style={{
                                            color:
                                                "var(--color-text)",
                                        }}
                                    >
                                        {clienteSeleccionado
                                            ? "Editar cliente"
                                            : "Nuevo cliente"}
                                    </h2>

                                    <p
                                        className="mt-1 text-sm"
                                        style={{
                                            color:
                                                "var(--color-text-secondary)",
                                        }}
                                    >
                                        Captura la información del cliente.
                                    </p>
                                </div>

                                <button
                                    type="button"
                                    onClick={
                                        cerrarFormulario
                                    }
                                    disabled={
                                        guardando
                                    }
                                    className="rounded-lg p-2 text-lg transition disabled:opacity-50"
                                    style={{
                                        color:
                                            "var(--color-text-secondary)",
                                    }}
                                    onMouseEnter={(
                                        e
                                    ) => {
                                        e.currentTarget.style.backgroundColor =
                                            "var(--color-background)";
                                        e.currentTarget.style.color =
                                            "var(--color-text)";
                                    }}
                                    onMouseLeave={(
                                        e
                                    ) => {
                                        e.currentTarget.style.backgroundColor =
                                            "transparent";
                                        e.currentTarget.style.color =
                                            "var(--color-text-secondary)";
                                    }}
                                >
                                    ✕
                                </button>
                            </div>

                            <form
                                onSubmit={
                                    guardarCliente
                                }
                                className="space-y-5 p-6"
                            >
                                <div>
                                    <label
                                        className="mb-1.5 block text-sm font-semibold"
                                        style={{
                                            color:
                                                "var(--color-text)",
                                        }}
                                    >
                                        Nombre *
                                    </label>

                                    <input
                                        type="text"
                                        value={
                                            formulario.nombre
                                        }
                                        onChange={(e) =>
                                            manejarCambio(
                                                "nombre",
                                                e.target.value
                                            )
                                        }
                                        className={`${inputClass} focus:border-[var(--color-primary)] focus:ring-[var(--color-primary)]/20`}
                                        style={
                                            inputStyle
                                        }
                                        required
                                    />
                                </div>

                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">

                                    <div>
                                        <label
                                            className="mb-1.5 block text-sm font-semibold"
                                            style={{
                                                color:
                                                    "var(--color-text)",
                                            }}
                                        >
                                            Teléfono
                                        </label>

                                        <input
                                            type="text"
                                            value={
                                                formulario.telefono
                                            }
                                            onChange={(
                                                e
                                            ) =>
                                                manejarCambio(
                                                    "telefono",
                                                    e.target.value
                                                )
                                            }
                                            className={`${inputClass} focus:border-[var(--color-primary)] focus:ring-[var(--color-primary)]/20`}
                                            style={
                                                inputStyle
                                            }
                                        />
                                    </div>

                                    <div>
                                        <label
                                            className="mb-1.5 block text-sm font-semibold"
                                            style={{
                                                color:
                                                    "var(--color-text)",
                                            }}
                                        >
                                            Correo
                                        </label>

                                        <input
                                            type="email"
                                            value={
                                                formulario.email
                                            }
                                            onChange={(
                                                e
                                            ) =>
                                                manejarCambio(
                                                    "email",
                                                    e.target.value
                                                )
                                            }
                                            className={`${inputClass} focus:border-[var(--color-primary)] focus:ring-[var(--color-primary)]/20`}
                                            style={
                                                inputStyle
                                            }
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label
                                        className="mb-1.5 block text-sm font-semibold"
                                        style={{
                                            color:
                                                "var(--color-text)",
                                        }}
                                    >
                                        Dirección
                                    </label>

                                    <textarea
                                        value={
                                            formulario.direccion
                                        }
                                        onChange={(e) =>
                                            manejarCambio(
                                                "direccion",
                                                e.target.value
                                            )
                                        }
                                        rows={3}
                                        className={`${inputClass} focus:border-[var(--color-primary)] focus:ring-[var(--color-primary)]/20`}
                                        style={
                                            inputStyle
                                        }
                                    />
                                </div>

                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">

                                    <div>
                                        <label
                                            className="mb-1.5 block text-sm font-semibold"
                                            style={{
                                                color:
                                                    "var(--color-text)",
                                            }}
                                        >
                                            RFC
                                        </label>

                                        <input
                                            type="text"
                                            value={
                                                formulario.rfc
                                            }
                                            onChange={(e) =>
                                                manejarCambio(
                                                    "rfc",
                                                    e.target.value.toUpperCase()
                                                )
                                            }
                                            className={`${inputClass} focus:border-[var(--color-primary)] focus:ring-[var(--color-primary)]/20`}
                                            style={
                                                inputStyle
                                            }
                                        />
                                    </div>

                                    <div>
                                        <label
                                            className="mb-1.5 block text-sm font-semibold"
                                            style={{
                                                color:
                                                    "var(--color-text)",
                                            }}
                                        >
                                            Límite de crédito
                                        </label>

                                        <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={
                                                formulario.limite_credito
                                            }
                                            onChange={(
                                                e
                                            ) =>
                                                manejarCambio(
                                                    "limite_credito",
                                                    e.target.value
                                                )
                                            }
                                            className={`${inputClass} focus:border-[var(--color-primary)] focus:ring-[var(--color-primary)]/20`}
                                            style={
                                                inputStyle
                                            }
                                        />
                                    </div>
                                </div>

                                <div
                                    className="flex flex-col-reverse justify-end gap-3 border-t pt-5 sm:flex-row"
                                    style={{
                                        borderColor:
                                            "var(--color-border)",
                                    }}
                                >
                                    <button
                                        type="button"
                                        onClick={
                                            cerrarFormulario
                                        }
                                        disabled={
                                            guardando
                                        }
                                        className="rounded-xl border px-5 py-3 text-sm font-semibold transition disabled:opacity-50"
                                        style={{
                                            backgroundColor:
                                                "var(--color-surface)",
                                            borderColor:
                                                "var(--color-border)",
                                            color:
                                                "var(--color-text)",
                                        }}
                                    >
                                        Cancelar
                                    </button>

                                    <button
                                        type="submit"
                                        disabled={
                                            guardando
                                        }
                                        className="rounded-xl px-5 py-3 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50"
                                        style={{
                                            backgroundColor:
                                                "var(--color-primary)",
                                        }}
                                    >
                                        {guardando
                                            ? "Guardando..."
                                            : clienteSeleccionado
                                                ? "Guardar cambios"
                                                : "Crear cliente"}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }

            {/* =====================================================
                MODAL ABONO
            ===================================================== */}

            {
                mostrarAbono &&
                clienteAbono && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">

                        <div
                            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl shadow-2xl"
                            style={{
                                backgroundColor:
                                    "var(--color-surface)",
                                color:
                                    "var(--color-text)",
                            }}
                        >
                            <div
                                className="flex items-center justify-between border-b px-6 py-4"
                                style={{
                                    borderColor:
                                        "var(--color-border)",
                                }}
                            >
                                <div>
                                    <h2
                                        className="text-lg font-bold"
                                        style={{
                                            color:
                                                "var(--color-text)",
                                        }}
                                    >
                                        Registrar abono
                                    </h2>

                                    <p
                                        className="mt-1 text-sm"
                                        style={{
                                            color:
                                                "var(--color-text-secondary)",
                                        }}
                                    >
                                        {
                                            clienteAbono.nombre
                                        }
                                    </p>
                                </div>

                                <button
                                    type="button"
                                    onClick={
                                        cerrarAbono
                                    }
                                    disabled={
                                        guardandoAbono
                                    }
                                    className="rounded-lg p-2 text-lg transition disabled:opacity-50"
                                    style={{
                                        color:
                                            "var(--color-text-secondary)",
                                    }}
                                    onMouseEnter={(
                                        e
                                    ) => {
                                        e.currentTarget.style.backgroundColor =
                                            "var(--color-background)";
                                        e.currentTarget.style.color =
                                            "var(--color-text)";
                                    }}
                                    onMouseLeave={(
                                        e
                                    ) => {
                                        e.currentTarget.style.backgroundColor =
                                            "transparent";
                                        e.currentTarget.style.color =
                                            "var(--color-text-secondary)";
                                    }}
                                >
                                    ✕
                                </button>
                            </div>

                            <form
                                onSubmit={
                                    registrarAbono
                                }
                                className="space-y-5 p-6"
                            >
                                {/* SALDO ACTUAL */}

                                <div
                                    className="rounded-2xl p-5"
                                    style={{
                                        backgroundColor:
                                            "var(--color-danger-soft)",
                                    }}
                                >
                                    <p
                                        className="text-sm font-medium"
                                        style={{
                                            color:
                                                "var(--color-danger)",
                                        }}
                                    >
                                        Saldo pendiente
                                    </p>

                                    <p
                                        className="mt-1 text-3xl font-bold"
                                        style={{
                                            color:
                                                "var(--color-danger)",
                                        }}
                                    >
                                        {formatearMoneda(
                                            Number(
                                                clienteAbono.saldo_credito ||
                                                0
                                            )
                                        )}
                                    </p>
                                </div>

                                {/* MONTO */}

                                <div>
                                    <label
                                        className="mb-1.5 block text-sm font-semibold"
                                        style={{
                                            color:
                                                "var(--color-text)",
                                        }}
                                    >
                                        Monto del abono *
                                    </label>

                                    <div className="relative">
                                        <span
                                            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2"
                                            style={{
                                                color:
                                                    "var(--color-text-secondary)",
                                            }}
                                        >
                                            $
                                        </span>

                                        <input
                                            type="number"
                                            min="0.01"
                                            max={Number(
                                                clienteAbono.saldo_credito ||
                                                0
                                            )}
                                            step="0.01"
                                            value={
                                                formularioAbono.monto
                                            }
                                            onChange={(
                                                e
                                            ) =>
                                                manejarCambioAbono(
                                                    "monto",
                                                    e.target.value
                                                )
                                            }
                                            placeholder="0.00"
                                            className={`${inputClass} pl-8 pr-4 text-lg font-semibold focus:border-[var(--color-primary)] focus:ring-[var(--color-primary)]/20`}
                                            style={
                                                inputStyle
                                            }
                                            required
                                        />
                                    </div>

                                    <p
                                        className="mt-1 text-xs"
                                        style={{
                                            color:
                                                "var(--color-text-secondary)",
                                        }}
                                    >
                                        Máximo:{" "}
                                        {formatearMoneda(
                                            Number(
                                                clienteAbono.saldo_credito ||
                                                0
                                            )
                                        )}
                                    </p>
                                </div>

                                {/* MÉTODO */}

                                <div>
                                    <label
                                        className="mb-1.5 block text-sm font-semibold"
                                        style={{
                                            color:
                                                "var(--color-text)",
                                        }}
                                    >
                                        Método de pago *
                                    </label>

                                    <select
                                        value={
                                            formularioAbono.metodo_pago
                                        }
                                        onChange={(e) =>
                                            manejarCambioAbono(
                                                "metodo_pago",
                                                e.target
                                                    .value as FormularioAbono["metodo_pago"]
                                            )
                                        }
                                        className={`${inputClass} focus:border-[var(--color-primary)] focus:ring-[var(--color-primary)]/20`}
                                        style={
                                            inputStyle
                                        }
                                    >
                                        <option value="efectivo">
                                            Efectivo
                                        </option>

                                        <option value="tarjeta">
                                            Tarjeta
                                        </option>

                                        <option value="transferencia">
                                            Transferencia
                                        </option>
                                    </select>
                                </div>

                                {/* REFERENCIA */}

                                <div>
                                    <label
                                        className="mb-1.5 block text-sm font-semibold"
                                        style={{
                                            color:
                                                "var(--color-text)",
                                        }}
                                    >
                                        Referencia{" "}
                                        {formularioAbono.metodo_pago !==
                                            "efectivo" &&
                                            "*"}
                                    </label>

                                    <input
                                        type="text"
                                        value={
                                            formularioAbono.referencia
                                        }
                                        onChange={(e) =>
                                            manejarCambioAbono(
                                                "referencia",
                                                e.target.value
                                            )
                                        }
                                        placeholder={
                                            formularioAbono.metodo_pago ===
                                                "efectivo"
                                                ? "Opcional"
                                                : "Número de autorización / referencia"
                                        }
                                        className={`${inputClass} focus:border-[var(--color-primary)] focus:ring-[var(--color-primary)]/20`}
                                        style={
                                            inputStyle
                                        }
                                        required={
                                            formularioAbono.metodo_pago !==
                                            "efectivo"
                                        }
                                    />
                                </div>

                                {/* NOTAS */}

                                <div>
                                    <label
                                        className="mb-1.5 block text-sm font-semibold"
                                        style={{
                                            color:
                                                "var(--color-text)",
                                        }}
                                    >
                                        Notas
                                    </label>

                                    <textarea
                                        value={
                                            formularioAbono.notas
                                        }
                                        onChange={(e) =>
                                            manejarCambioAbono(
                                                "notas",
                                                e.target.value
                                            )
                                        }
                                        rows={3}
                                        placeholder="Observaciones del abono..."
                                        className={`${inputClass} focus:border-[var(--color-primary)] focus:ring-[var(--color-primary)]/20`}
                                        style={
                                            inputStyle
                                        }
                                    />
                                </div>

                                {/* AVISO EFECTIVO */}

                                {formularioAbono.metodo_pago ===
                                    "efectivo" && (
                                        <div
                                            className="rounded-xl p-4 text-sm"
                                            style={{
                                                backgroundColor:
                                                    "color-mix(in srgb, var(--color-success) 8%, var(--color-surface))",
                                                color:
                                                    "var(--color-success)",
                                            }}
                                        >
                                            El abono en efectivo se
                                            registrará como una entrada
                                            en la caja actual y aumentará
                                            el monto esperado de la sesión.
                                        </div>
                                    )}

                                {formularioAbono.metodo_pago !==
                                    "efectivo" && (
                                        <div
                                            className="rounded-xl p-4 text-sm"
                                            style={{
                                                backgroundColor:
                                                    "color-mix(in srgb, var(--color-primary) 8%, var(--color-surface))",
                                                color:
                                                    "var(--color-primary)",
                                            }}
                                        >
                                            Este abono se registrará en
                                            la cuenta del cliente. Al ser
                                            un pago no efectivo, no
                                            aumentará el efectivo esperado
                                            de la caja.
                                        </div>
                                    )}

                                {/* BOTONES */}

                                <div
                                    className="flex flex-col-reverse justify-end gap-3 border-t pt-5 sm:flex-row"
                                    style={{
                                        borderColor:
                                            "var(--color-border)",
                                    }}
                                >
                                    <button
                                        type="button"
                                        onClick={
                                            cerrarAbono
                                        }
                                        disabled={
                                            guardandoAbono
                                        }
                                        className="rounded-xl border px-5 py-3 text-sm font-semibold transition disabled:opacity-50"
                                        style={{
                                            backgroundColor:
                                                "var(--color-surface)",
                                            borderColor:
                                                "var(--color-border)",
                                            color:
                                                "var(--color-text)",
                                        }}
                                    >
                                        Cancelar
                                    </button>

                                    <button
                                        type="submit"
                                        disabled={
                                            guardandoAbono
                                        }
                                        className="rounded-xl px-5 py-3 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50"
                                        style={{
                                            backgroundColor:
                                                "var(--color-success)",
                                        }}
                                    >
                                        {guardandoAbono
                                            ? "Registrando..."
                                            : "Registrar abono"}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }

            {/* =====================================================
                MODAL MENSAJE
            ===================================================== */}

            <ModalMensaje
                abierto={modal.abierto}
                tipo={modal.tipo}
                titulo={modal.titulo}
                mensaje={modal.mensaje}
                onCerrar={cerrarModal}
            />
        </div >
    );
}