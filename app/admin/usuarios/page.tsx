"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import Card from "../../components/Card";
import Button from "../../components/Button";
import ModalMensaje from "../../components/ModalMensaje";

import { supabase } from "../../../lib/supabase";
import {
    verificarRol,
    obtenerUsuarioActual,
} from "../../../lib/auth/roleGuard";

interface Usuario {
    id: string;
    nombre: string;
    rol: string;
    activo: boolean;
    negocio_id: string;
    auth_user_id: string;
}

interface UsuarioActual {
    id: string;
    negocio_id: string;
    nombre: string;
    rol: string;
}

interface Sucursal {
    id: string;
    nombre: string;
    activo: boolean;
}

interface Caja {
    id: string;
    sucursal_id: string;
    nombre: string;
    activo: boolean;
}

type TipoMensaje =
    | "exito"
    | "error"
    | "confirmacion"
    | "info";

type AccionPendiente =
    | {
        tipo: "estado";
        usuario: Usuario;
    }
    | {
        tipo: "eliminar";
        usuario: Usuario;
    }
    | null;

export default function UsuariosPage() {
    const router = useRouter();

    // =====================================================
    // PROTECCIÓN
    // =====================================================

    useEffect(() => {
        async function protegerUsuarios() {
            const resultado = await verificarRol(["admin"]);

            if (!resultado.autorizado) {
                if (resultado.motivo === "no_autenticado") {
                    router.replace("/admin/login");
                    return;
                }

                router.replace("/caja");
            }
        }

        protegerUsuarios();
    }, [router]);

    // =====================================================
    // ESTADOS
    // =====================================================

    const [usuarioActual, setUsuarioActual] =
        useState<UsuarioActual | null>(null);

    const [usuarios, setUsuarios] = useState<Usuario[]>([]);
    const [sucursales, setSucursales] = useState<Sucursal[]>([]);
    const [cajas, setCajas] = useState<Caja[]>([]);

    const [sucursalesSeleccionadas, setSucursalesSeleccionadas] =
        useState<string[]>([]);

    const [cajasSeleccionadas, setCajasSeleccionadas] =
        useState<string[]>([]);

    const [cargando, setCargando] = useState(true);
    const [creando, setCreando] = useState(false);
    const [guardandoEdicion, setGuardandoEdicion] =
        useState(false);
    const [procesandoAccion, setProcesandoAccion] =
        useState(false);

    const [nombre, setNombre] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [rol, setRol] = useState("cajero");

    // =====================================================
    // EDICIÓN
    // =====================================================

    const [modalEdicionAbierto, setModalEdicionAbierto] =
        useState(false);

    const [usuarioEditando, setUsuarioEditando] =
        useState<Usuario | null>(null);

    const [nombreEdicion, setNombreEdicion] = useState("");
    const [rolEdicion, setRolEdicion] = useState("cajero");

    const [sucursalesEdicion, setSucursalesEdicion] =
        useState<string[]>([]);

    const [cajasEdicion, setCajasEdicion] =
        useState<string[]>([]);

    // =====================================================
    // MODAL DE MENSAJES
    // =====================================================

    const [modalMensajeAbierto, setModalMensajeAbierto] =
        useState(false);

    const [tipoMensaje, setTipoMensaje] =
        useState<TipoMensaje>("info");

    const [tituloMensaje, setTituloMensaje] =
        useState("");

    const [textoMensaje, setTextoMensaje] =
        useState("");

    const [accionPendiente, setAccionPendiente] =
        useState<AccionPendiente>(null);

    function mostrarMensaje(
        tipo: TipoMensaje,
        titulo: string,
        texto: string
    ) {
        setTipoMensaje(tipo);
        setTituloMensaje(titulo);
        setTextoMensaje(texto);
        setModalMensajeAbierto(true);
    }

    function cerrarModalMensaje() {
        if (procesandoAccion) return;

        setModalMensajeAbierto(false);
        setAccionPendiente(null);
    }

    // =====================================================
    // CARGAR DATOS
    // =====================================================

    async function cargarDatos() {
        try {
            setCargando(true);

            // -------------------------------------------------
            // USUARIO ACTUAL
            // -------------------------------------------------

            const actual = await obtenerUsuarioActual();

            if (!actual) {
                mostrarMensaje(
                    "error",
                    "Error",
                    "No se pudo obtener el usuario actual."
                );

                return;
            }

            const usuario =
                actual as unknown as UsuarioActual;

            setUsuarioActual(usuario);

            // -------------------------------------------------
            // SUCURSALES
            // -------------------------------------------------

            const {
                data: sucursalesData,
                error: sucursalesError,
            } = await supabase
                .from("sucursales")
                .select("id, nombre, activo")
                .eq(
                    "negocio_id",
                    usuario.negocio_id
                )
                .eq("activo", true)
                .order("nombre", {
                    ascending: true,
                });

            if (sucursalesError) {
                console.error(
                    "Error cargando sucursales:",
                    sucursalesError
                );

                mostrarMensaje(
                    "error",
                    "Error",
                    "No se pudieron cargar las sucursales."
                );

                return;
            }

            setSucursales(
                (sucursalesData ?? []) as Sucursal[]
            );

            // -------------------------------------------------
            // CAJAS
            // -------------------------------------------------

            const {
                data: cajasData,
                error: cajasError,
            } = await supabase
                .from("cajas")
                .select(
                    "id, sucursal_id, nombre, activo"
                )
                .eq("activo", true)
                .order("nombre", {
                    ascending: true,
                });

            if (cajasError) {
                console.error(
                    "Error cargando cajas:",
                    cajasError
                );

                mostrarMensaje(
                    "error",
                    "Error",
                    "No se pudieron cargar las cajas."
                );

                return;
            }

            // -------------------------------------------------
            // SOLO CAJAS DEL NEGOCIO
            // -------------------------------------------------

            const sucursalIds =
                (sucursalesData ?? []).map(
                    (sucursal) => sucursal.id
                );

            const cajasDelNegocio =
                (cajasData ?? []).filter(
                    (caja) =>
                        sucursalIds.includes(
                            caja.sucursal_id
                        )
                );

            setCajas(
                cajasDelNegocio as Caja[]
            );

            // -------------------------------------------------
            // USUARIOS
            // -------------------------------------------------

            const {
                data: usuariosData,
                error: usuariosError,
            } = await supabase
                .from("usuarios")
                .select(
                    `
                        id,
                        nombre,
                        rol,
                        activo,
                        negocio_id,
                        auth_user_id,
                        created_at
                    `
                )
                .eq(
                    "negocio_id",
                    usuario.negocio_id
                )
                .order("created_at", {
                    ascending: false,
                });

            if (usuariosError) {
                console.error(
                    "Error cargando usuarios:",
                    usuariosError
                );

                mostrarMensaje(
                    "error",
                    "Error",
                    "No se pudieron cargar los usuarios."
                );

                return;
            }

            setUsuarios(
                (usuariosData ?? []) as Usuario[]
            );
        } catch (error) {
            console.error(
                "Error cargando datos:",
                error
            );

            mostrarMensaje(
                "error",
                "Error inesperado",
                "Ocurrió un error al cargar la información."
            );
        } finally {
            setCargando(false);
        }
    }

    // =====================================================
    // INICIO
    // =====================================================

    useEffect(() => {
        cargarDatos();
    }, []);

    // =====================================================
    // CAMBIAR SUCURSAL
    // =====================================================

    function cambiarSucursal(
        sucursalId: string
    ) {
        const seleccionada =
            sucursalesSeleccionadas.includes(
                sucursalId
            );

        if (seleccionada) {
            setSucursalesSeleccionadas(
                (actuales) =>
                    actuales.filter(
                        (id) =>
                            id !== sucursalId
                    )
            );

            const cajasDeSucursal =
                cajas
                    .filter(
                        (caja) =>
                            caja.sucursal_id ===
                            sucursalId
                    )
                    .map(
                        (caja) =>
                            caja.id
                    );

            setCajasSeleccionadas(
                (actuales) =>
                    actuales.filter(
                        (id) =>
                            !cajasDeSucursal.includes(
                                id
                            )
                    )
            );
        } else {
            setSucursalesSeleccionadas(
                (actuales) => [
                    ...actuales,
                    sucursalId,
                ]
            );
        }
    }

    // =====================================================
    // CAMBIAR CAJA
    // =====================================================

    function cambiarCaja(
        cajaId: string
    ) {
        const seleccionada =
            cajasSeleccionadas.includes(
                cajaId
            );

        if (seleccionada) {
            setCajasSeleccionadas(
                (actuales) =>
                    actuales.filter(
                        (id) =>
                            id !== cajaId
                    )
            );
        } else {
            setCajasSeleccionadas(
                (actuales) => [
                    ...actuales,
                    cajaId,
                ]
            );
        }
    }

    // =====================================================
    // CREAR USUARIO
    // =====================================================

    async function crearUsuario(
        e: FormEvent
    ) {
        e.preventDefault();

        if (
            !nombre.trim() ||
            !email.trim() ||
            !password ||
            !rol
        ) {
            mostrarMensaje(
                "error",
                "Datos incompletos",
                "Completa todos los campos."
            );

            return;
        }

        if (password.length < 6) {
            mostrarMensaje(
                "error",
                "Contraseña inválida",
                "La contraseña debe tener al menos 6 caracteres."
            );

            return;
        }

        if (
            rol !== "admin" &&
            sucursalesSeleccionadas.length === 0
        ) {
            mostrarMensaje(
                "error",
                "Sucursal requerida",
                "Selecciona al menos una sucursal."
            );

            return;
        }

        if (
            rol === "cajero" &&
            cajasSeleccionadas.length === 0
        ) {
            mostrarMensaje(
                "error",
                "Caja requerida",
                "Selecciona al menos una caja para el cajero."
            );

            return;
        }

        try {
            setCreando(true);

            // -------------------------------------------------
            // VALIDAR SESIÓN
            // -------------------------------------------------

            const {
                data: sessionData,
                error: sessionError,
            } =
                await supabase.auth.getSession();

            if (
                sessionError ||
                !sessionData.session
            ) {
                mostrarMensaje(
                    "error",
                    "Sesión inválida",
                    "Tu sesión no es válida. Vuelve a iniciar sesión."
                );

                return;
            }

            // -------------------------------------------------
            // CREAR USUARIO
            // -------------------------------------------------

            const {
                data,
                error: functionError,
            } =
                await supabase.functions.invoke(
                    "crear-usuario",
                    {
                        body: {
                            email:
                                email.trim(),
                            password,
                            nombre:
                                nombre.trim(),
                            rol,
                            sucursal_ids:
                                sucursalesSeleccionadas,
                            caja_ids:
                                cajasSeleccionadas,
                        },
                    }
                );

            if (functionError) {
                console.error(
                    "Error creando usuario:",
                    functionError
                );

                mostrarMensaje(
                    "error",
                    "No se pudo crear",
                    functionError.message ||
                    "No se pudo crear el usuario."
                );

                return;
            }

            if (data?.error) {
                mostrarMensaje(
                    "error",
                    "No se pudo crear",
                    data.error
                );

                return;
            }

            // -------------------------------------------------
            // LIMPIAR FORMULARIO
            // -------------------------------------------------

            setNombre("");
            setEmail("");
            setPassword("");
            setRol("cajero");
            setSucursalesSeleccionadas([]);
            setCajasSeleccionadas([]);

            await cargarDatos();

            mostrarMensaje(
                "exito",
                "Usuario creado",
                "El usuario se creó correctamente."
            );
        } catch (error) {
            console.error(
                "Error creando usuario:",
                error
            );

            mostrarMensaje(
                "error",
                "Error",
                "Ocurrió un error al crear el usuario."
            );
        } finally {
            setCreando(false);
        }
    }

    // =====================================================
    // ABRIR EDICIÓN
    // =====================================================

    async function abrirEditarUsuario(
        usuario: Usuario
    ) {
        try {
            setGuardandoEdicion(true);

            setUsuarioEditando(usuario);
            setNombreEdicion(usuario.nombre);
            setRolEdicion(usuario.rol);

            // -------------------------------------------------
            // CARGAR SUCURSALES ASIGNADAS
            // -------------------------------------------------

            const {
                data: relacionesSucursales,
                error: sucursalesError,
            } = await supabase
                .from("usuario_sucursales")
                .select("sucursal_id")
                .eq(
                    "usuario_id",
                    usuario.id
                );

            if (sucursalesError) {
                console.error(
                    "Error cargando sucursales del usuario:",
                    sucursalesError
                );

                mostrarMensaje(
                    "error",
                    "No se pudo abrir la edición",
                    "No se pudieron cargar las sucursales asignadas al usuario."
                );

                setUsuarioEditando(null);

                return;
            }

            const sucursalesAsignadas =
                (
                    relacionesSucursales ?? []
                ).map(
                    (relacion) =>
                        relacion.sucursal_id
                );

            setSucursalesEdicion(
                sucursalesAsignadas
            );

            // -------------------------------------------------
            // CARGAR CAJAS ASIGNADAS
            // -------------------------------------------------

            const {
                data: relacionesCajas,
                error: cajasError,
            } = await supabase
                .from("usuario_cajas")
                .select("caja_id")
                .eq(
                    "usuario_id",
                    usuario.id
                );

            if (cajasError) {
                console.error(
                    "Error cargando cajas del usuario:",
                    cajasError
                );

                mostrarMensaje(
                    "error",
                    "No se pudo abrir la edición",
                    "No se pudieron cargar las cajas asignadas al usuario."
                );

                setUsuarioEditando(null);

                return;
            }

            const cajasAsignadas =
                (
                    relacionesCajas ?? []
                ).map(
                    (relacion) =>
                        relacion.caja_id
                );

            setCajasEdicion(
                cajasAsignadas
            );

            setModalEdicionAbierto(true);
        } catch (error) {
            console.error(
                "Error abriendo edición:",
                error
            );

            mostrarMensaje(
                "error",
                "Error",
                "Ocurrió un error al cargar los datos del usuario."
            );

            setUsuarioEditando(null);
        } finally {
            setGuardandoEdicion(false);
        }
    }

    // =====================================================
    // CERRAR EDICIÓN
    // =====================================================

    function cerrarEdicion() {
        if (guardandoEdicion) return;

        setModalEdicionAbierto(false);
        setUsuarioEditando(null);

        setNombreEdicion("");
        setRolEdicion("cajero");

        setSucursalesEdicion([]);
        setCajasEdicion([]);
    }

    // =====================================================
    // CAMBIAR SUCURSAL EDICIÓN
    // =====================================================

    function cambiarSucursalEdicion(
        sucursalId: string
    ) {
        const seleccionada =
            sucursalesEdicion.includes(
                sucursalId
            );

        if (seleccionada) {
            setSucursalesEdicion(
                (actuales) =>
                    actuales.filter(
                        (id) =>
                            id !== sucursalId
                    )
            );

            const cajasDeSucursal =
                cajas
                    .filter(
                        (caja) =>
                            caja.sucursal_id ===
                            sucursalId
                    )
                    .map(
                        (caja) =>
                            caja.id
                    );

            setCajasEdicion(
                (actuales) =>
                    actuales.filter(
                        (id) =>
                            !cajasDeSucursal.includes(
                                id
                            )
                    )
            );
        } else {
            setSucursalesEdicion(
                (actuales) => [
                    ...actuales,
                    sucursalId,
                ]
            );
        }
    }

    // =====================================================
    // CAMBIAR CAJA EDICIÓN
    // =====================================================

    function cambiarCajaEdicion(
        cajaId: string
    ) {
        const seleccionada =
            cajasEdicion.includes(
                cajaId
            );

        if (seleccionada) {
            setCajasEdicion(
                (actuales) =>
                    actuales.filter(
                        (id) =>
                            id !== cajaId
                    )
            );
        } else {
            setCajasEdicion(
                (actuales) => [
                    ...actuales,
                    cajaId,
                ]
            );
        }
    }

    // =====================================================
    // GUARDAR EDICIÓN
    // =====================================================

    async function guardarEdicion() {
        if (!usuarioEditando) return;

        if (!nombreEdicion.trim()) {
            mostrarMensaje(
                "error",
                "Nombre requerido",
                "El nombre del usuario es obligatorio."
            );

            return;
        }

        if (
            rolEdicion !== "admin" &&
            sucursalesEdicion.length === 0
        ) {
            mostrarMensaje(
                "error",
                "Sucursal requerida",
                "Selecciona al menos una sucursal."
            );

            return;
        }

        if (
            rolEdicion === "cajero" &&
            cajasEdicion.length === 0
        ) {
            mostrarMensaje(
                "error",
                "Caja requerida",
                "Selecciona al menos una caja para el cajero."
            );

            return;
        }

        // -------------------------------------------------
        // VALIDAR QUE LAS CAJAS SEAN DE LAS SUCURSALES
        // SELECCIONADAS
        // -------------------------------------------------

        const cajasSeleccionadasValidas =
            cajasEdicion.filter(
                (cajaId) => {
                    const caja =
                        cajas.find(
                            (item) =>
                                item.id ===
                                cajaId
                        );

                    return (
                        caja &&
                        sucursalesEdicion.includes(
                            caja.sucursal_id
                        )
                    );
                }
            );

        if (
            cajasSeleccionadasValidas.length !==
            cajasEdicion.length
        ) {
            mostrarMensaje(
                "error",
                "Asignación inválida",
                "Una o más cajas seleccionadas no pertenecen a las sucursales seleccionadas."
            );

            return;
        }

        try {
            setGuardandoEdicion(true);

            // -------------------------------------------------
            // ACTUALIZAR USUARIO
            // -------------------------------------------------

            const {
                error: updateError,
            } = await supabase
                .from("usuarios")
                .update({
                    nombre:
                        nombreEdicion.trim(),
                    rol:
                        rolEdicion,
                })
                .eq(
                    "id",
                    usuarioEditando.id
                )
                .eq(
                    "negocio_id",
                    usuarioActual?.negocio_id
                );

            if (updateError) {
                console.error(
                    "Error actualizando usuario:",
                    updateError
                );

                mostrarMensaje(
                    "error",
                    "No se pudo actualizar",
                    "No se pudo actualizar la información del usuario."
                );

                return;
            }

            // -------------------------------------------------
            // ELIMINAR RELACIONES ANTERIORES
            // -------------------------------------------------

            const {
                error:
                eliminarSucursalesError,
            } = await supabase
                .from("usuario_sucursales")
                .delete()
                .eq(
                    "usuario_id",
                    usuarioEditando.id
                );

            if (
                eliminarSucursalesError
            ) {
                console.error(
                    "Error eliminando asignaciones de sucursal:",
                    eliminarSucursalesError
                );

                mostrarMensaje(
                    "error",
                    "Error de asignaciones",
                    "No se pudieron actualizar las sucursales del usuario."
                );

                return;
            }

            const {
                error:
                eliminarCajasError,
            } = await supabase
                .from("usuario_cajas")
                .delete()
                .eq(
                    "usuario_id",
                    usuarioEditando.id
                );

            if (eliminarCajasError) {
                console.error(
                    "Error eliminando asignaciones de caja:",
                    eliminarCajasError
                );

                mostrarMensaje(
                    "error",
                    "Error de asignaciones",
                    "No se pudieron actualizar las cajas del usuario."
                );

                return;
            }

            // -------------------------------------------------
            // INSERTAR NUEVAS SUCURSALES
            // -------------------------------------------------

            if (
                sucursalesEdicion.length > 0
            ) {
                const relacionesSucursales =
                    sucursalesEdicion.map(
                        (sucursal_id) => ({
                            usuario_id:
                                usuarioEditando.id,
                            sucursal_id,
                        })
                    );

                const {
                    error:
                    insertarSucursalesError,
                } = await supabase
                    .from(
                        "usuario_sucursales"
                    )
                    .insert(
                        relacionesSucursales
                    );

                if (
                    insertarSucursalesError
                ) {
                    console.error(
                        "Error insertando sucursales:",
                        insertarSucursalesError
                    );

                    mostrarMensaje(
                        "error",
                        "Error de asignaciones",
                        "No se pudieron guardar las sucursales del usuario."
                    );

                    return;
                }
            }

            // -------------------------------------------------
            // INSERTAR NUEVAS CAJAS
            // -------------------------------------------------

            if (
                cajasSeleccionadasValidas.length >
                0
            ) {
                const relacionesCajas =
                    cajasSeleccionadasValidas.map(
                        (caja_id) => ({
                            usuario_id:
                                usuarioEditando.id,
                            caja_id,
                        })
                    );

                const {
                    error:
                    insertarCajasError,
                } = await supabase
                    .from(
                        "usuario_cajas"
                    )
                    .insert(
                        relacionesCajas
                    );

                if (
                    insertarCajasError
                ) {
                    console.error(
                        "Error insertando cajas:",
                        insertarCajasError
                    );

                    mostrarMensaje(
                        "error",
                        "Error de asignaciones",
                        "No se pudieron guardar las cajas del usuario."
                    );

                    return;
                }
            }

            // -------------------------------------------------
            // ÉXITO
            // -------------------------------------------------

            cerrarEdicion();

            await cargarDatos();

            mostrarMensaje(
                "exito",
                "Usuario actualizado",
                "Los datos y permisos del usuario se actualizaron correctamente."
            );
        } catch (error) {
            console.error(
                "Error actualizando usuario:",
                error
            );

            mostrarMensaje(
                "error",
                "Error",
                "Ocurrió un error al actualizar el usuario."
            );
        } finally {
            setGuardandoEdicion(false);
        }
    }

    // =====================================================
    // SOLICITAR CAMBIO DE ESTADO
    // =====================================================

    function solicitarCambioEstado(
        usuario: Usuario
    ) {
        if (
            usuarioActual?.id ===
            usuario.id
        ) {
            mostrarMensaje(
                "info",
                "Acción no permitida",
                "No puedes desactivar tu propio usuario."
            );

            return;
        }

        setAccionPendiente({
            tipo: "estado",
            usuario,
        });

        setTipoMensaje(
            "confirmacion"
        );

        setTituloMensaje(
            usuario.activo
                ? "Desactivar usuario"
                : "Activar usuario"
        );

        setTextoMensaje(
            usuario.activo
                ? `¿Deseas desactivar al usuario "${usuario.nombre}"? Ya no podrá utilizar el sistema mientras permanezca inactivo.`
                : `¿Deseas activar nuevamente al usuario "${usuario.nombre}"?`
        );

        setModalMensajeAbierto(
            true
        );
    }

    // =====================================================
    // SOLICITAR ELIMINACIÓN
    // =====================================================

    function solicitarEliminarUsuario(
        usuario: Usuario
    ) {
        if (
            usuarioActual?.id ===
            usuario.id
        ) {
            mostrarMensaje(
                "info",
                "Acción no permitida",
                "No puedes eliminar tu propio usuario."
            );

            return;
        }

        setAccionPendiente({
            tipo: "eliminar",
            usuario,
        });

        setTipoMensaje(
            "confirmacion"
        );

        setTituloMensaje(
            "Eliminar usuario"
        );

        setTextoMensaje(
            `¿Estás seguro de eliminar al usuario "${usuario.nombre}"? Esta acción eliminará su cuenta y sus permisos de acceso al sistema.`
        );

        setModalMensajeAbierto(
            true
        );
    }

    // =====================================================
    // CONFIRMAR ACCIÓN
    // =====================================================

    async function confirmarAccion() {
        if (!accionPendiente) return;

        const accion =
            accionPendiente;

        setModalMensajeAbierto(false);
        setProcesandoAccion(true);

        try {
            // -------------------------------------------------
            // CAMBIAR ESTADO
            // -------------------------------------------------

            if (
                accion.tipo ===
                "estado"
            ) {
                const nuevoEstado =
                    !accion.usuario.activo;

                const {
                    error: updateError,
                } =
                    await supabase
                        .from(
                            "usuarios"
                        )
                        .update({
                            activo:
                                nuevoEstado,
                        })
                        .eq(
                            "id",
                            accion.usuario.id
                        )
                        .eq(
                            "negocio_id",
                            usuarioActual?.negocio_id
                        );

                if (updateError) {
                    console.error(
                        "Error cambiando estado:",
                        updateError
                    );

                    mostrarMensaje(
                        "error",
                        "No se pudo actualizar",
                        "No se pudo cambiar el estado del usuario."
                    );

                    return;
                }

                await cargarDatos();

                mostrarMensaje(
                    "exito",
                    nuevoEstado
                        ? "Usuario activado"
                        : "Usuario desactivado",
                    nuevoEstado
                        ? "El usuario fue activado correctamente."
                        : "El usuario fue desactivado correctamente."
                );

                return;
            }

            // -------------------------------------------------
            // ELIMINAR
            // -------------------------------------------------

            if (
                accion.tipo ===
                "eliminar"
            ) {
                /*
                 * IMPORTANTE:
                 *
                 * La eliminación definitiva de auth.users
                 * se realizará mediante la Edge Function
                 * "eliminar-usuario".
                 *
                 * NO usamos SERVICE_ROLE_KEY desde el
                 * navegador.
                 */

                const {
                    data,
                    error:
                    functionError,
                } =
                    await supabase.functions.invoke(
                        "eliminar-usuario",
                        {
                            body: {
                                usuario_id:
                                    accion
                                        .usuario
                                        .id,
                            },
                        }
                    );

                if (functionError) {
                    console.error(
                        "Error eliminando usuario:",
                        functionError
                    );

                    mostrarMensaje(
                        "error",
                        "No se pudo eliminar",
                        functionError.message ||
                        "No se pudo eliminar el usuario."
                    );

                    return;
                }

                if (data?.error) {
                    mostrarMensaje(
                        "error",
                        "No se pudo eliminar",
                        data.error
                    );

                    return;
                }

                await cargarDatos();

                mostrarMensaje(
                    "exito",
                    "Usuario eliminado",
                    "El usuario fue eliminado correctamente."
                );
            }
        } catch (error) {
            console.error(
                "Error procesando acción:",
                error
            );

            mostrarMensaje(
                "error",
                "Error",
                "Ocurrió un error al procesar la acción."
            );
        } finally {
            setProcesandoAccion(false);
            setAccionPendiente(null);
        }
    }

    // =====================================================
    // CARGANDO
    // =====================================================

    if (cargando) {
        return (
            <div className="flex min-h-[50vh] items-center justify-center">
                <p className="text-sm text-[var(--color-text-secondary)]">
                    Cargando usuarios...
                </p>
            </div>
        );
    }

    // =====================================================
    // ACCESO RESTRINGIDO
    // =====================================================

    if (
        usuarioActual &&
        usuarioActual.rol !== "admin"
    ) {
        return (
            <div className="space-y-6">
                <Card className="p-6">
                    <h1 className="text-xl font-bold text-[var(--color-text)]">
                        Acceso restringido
                    </h1>

                    <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
                        Solo un administrador puede
                        administrar los usuarios del
                        negocio.
                    </p>
                </Card>
            </div>
        );
    }

    // =====================================================
    // INTERFAZ
    // =====================================================

    return (
        <div className="space-y-6">
            {/* =================================================
                ENCABEZADO
            ================================================= */}

            <div>
                <h1 className="text-2xl font-bold text-[var(--color-text)] sm:text-3xl">
                    Usuarios y permisos
                </h1>

                <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                    Administra las personas que tienen
                    acceso al punto de venta.
                </p>
            </div>

            {/* =================================================
                CREAR USUARIO
            ================================================= */}

            <Card className="p-4 sm:p-6">
                <div className="mb-6">
                    <h2 className="text-lg font-bold text-[var(--color-text)]">
                        Crear usuario
                    </h2>

                    <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                        Crea una cuenta y define dónde
                        podrá trabajar.
                    </p>
                </div>

                <form
                    onSubmit={crearUsuario}
                    className="space-y-6"
                >
                    {/* DATOS PRINCIPALES */}

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        {/* NOMBRE */}

                        <div>
                            <label
                                htmlFor="nombre"
                                className="mb-2 block text-sm font-semibold text-[var(--color-text)]"
                            >
                                Nombre
                            </label>

                            <input
                                id="nombre"
                                type="text"
                                value={nombre}
                                onChange={(e) =>
                                    setNombre(
                                        e.target.value
                                    )
                                }
                                placeholder="Nombre del usuario"
                                disabled={creando}
                                required
                                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[var(--color-primary)]/10 disabled:opacity-60"
                            />
                        </div>

                        {/* CORREO */}

                        <div>
                            <label
                                htmlFor="email"
                                className="mb-2 block text-sm font-semibold text-[var(--color-text)]"
                            >
                                Correo electrónico
                            </label>

                            <input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) =>
                                    setEmail(
                                        e.target.value
                                    )
                                }
                                placeholder="usuario@correo.com"
                                disabled={creando}
                                required
                                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[var(--color-primary)]/10 disabled:opacity-60"
                            />
                        </div>

                        {/* PASSWORD */}

                        <div>
                            <label
                                htmlFor="password"
                                className="mb-2 block text-sm font-semibold text-[var(--color-text)]"
                            >
                                Contraseña inicial
                            </label>

                            <input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) =>
                                    setPassword(
                                        e.target.value
                                    )
                                }
                                placeholder="Mínimo 6 caracteres"
                                disabled={creando}
                                required
                                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[var(--color-primary)]/10 disabled:opacity-60"
                            />
                        </div>

                        {/* ROL */}

                        <div>
                            <label
                                htmlFor="rol"
                                className="mb-2 block text-sm font-semibold text-[var(--color-text)]"
                            >
                                Rol
                            </label>

                            <select
                                id="rol"
                                value={rol}
                                onChange={(e) =>
                                    setRol(
                                        e.target.value
                                    )
                                }
                                disabled={creando}
                                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[var(--color-primary)]/10 disabled:opacity-60"
                            >
                                <option value="cajero">
                                    Cajero
                                </option>

                                <option value="encargado">
                                    Encargado
                                </option>

                                <option value="admin">
                                    Administrador
                                </option>
                            </select>
                        </div>
                    </div>

                    {/* =================================================
                        SUCURSALES
                    ================================================= */}

                    <div>
                        <div className="mb-3">
                            <h3 className="text-sm font-semibold text-[var(--color-text)]">
                                Sucursales
                            </h3>

                            <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                                Selecciona las sucursales donde
                                podrá trabajar.
                            </p>
                        </div>

                        <div className="rounded-2xl border border-[var(--color-border)] p-3">
                            {sucursales.length ===
                                0 ? (
                                <p className="p-3 text-sm text-[var(--color-text-secondary)]">
                                    No hay sucursales disponibles.
                                </p>
                            ) : (
                                <div className="space-y-2">
                                    {sucursales.map(
                                        (sucursal) => {
                                            const seleccionada =
                                                sucursalesSeleccionadas.includes(
                                                    sucursal.id
                                                );

                                            return (
                                                <label
                                                    key={
                                                        sucursal.id
                                                    }
                                                    className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition ${seleccionada
                                                        ? "border-[var(--color-primary)] bg-[var(--color-primary)]/10"
                                                        : "border-transparent"
                                                        }`}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={
                                                            seleccionada
                                                        }
                                                        disabled={
                                                            creando
                                                        }
                                                        onChange={() =>
                                                            cambiarSucursal(
                                                                sucursal.id
                                                            )
                                                        }
                                                        className="h-4 w-4"
                                                    />

                                                    <div>
                                                        <p className="text-sm font-semibold text-[var(--color-text)]">
                                                            {
                                                                sucursal.nombre
                                                            }
                                                        </p>

                                                        <p className="text-xs text-[var(--color-text-secondary)]">
                                                            Sucursal activa
                                                        </p>
                                                    </div>
                                                </label>
                                            );
                                        }
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* =================================================
                        CAJAS
                    ================================================= */}

                    <div>
                        <div className="mb-3">
                            <h3 className="text-sm font-semibold text-[var(--color-text)]">
                                Cajas permitidas
                            </h3>

                            <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                                Selecciona las cajas que podrá
                                utilizar este usuario.
                            </p>
                        </div>

                        <div className="rounded-2xl border border-[var(--color-border)] p-3">
                            {sucursalesSeleccionadas.length ===
                                0 ? (
                                <p className="p-3 text-sm text-[var(--color-text-secondary)]">
                                    Primero selecciona una sucursal.
                                </p>
                            ) : (
                                <div className="space-y-2">
                                    {cajas
                                        .filter(
                                            (caja) =>
                                                sucursalesSeleccionadas.includes(
                                                    caja.sucursal_id
                                                )
                                        )
                                        .map(
                                            (caja) => {
                                                const seleccionada =
                                                    cajasSeleccionadas.includes(
                                                        caja.id
                                                    );

                                                const sucursal =
                                                    sucursales.find(
                                                        (item) =>
                                                            item.id ===
                                                            caja.sucursal_id
                                                    );

                                                return (
                                                    <label
                                                        key={
                                                            caja.id
                                                        }
                                                        className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition ${seleccionada
                                                            ? "border-[var(--color-primary)] bg-[var(--color-primary)]/10"
                                                            : "border-transparent"
                                                            }`}
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={
                                                                seleccionada
                                                            }
                                                            disabled={
                                                                creando
                                                            }
                                                            onChange={() =>
                                                                cambiarCaja(
                                                                    caja.id
                                                                )
                                                            }
                                                            className="h-4 w-4"
                                                        />

                                                        <div>
                                                            <p className="text-sm font-semibold text-[var(--color-text)]">
                                                                {
                                                                    caja.nombre
                                                                }
                                                            </p>

                                                            <p className="text-xs text-[var(--color-text-secondary)]">
                                                                {sucursal?.nombre ??
                                                                    "Sucursal desconocida"}
                                                            </p>
                                                        </div>
                                                    </label>
                                                );
                                            }
                                        )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* AVISO */}

                    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
                        <p className="text-sm font-semibold text-[var(--color-text)]">
                            Sobre los permisos
                        </p>

                        <p className="mt-1 text-sm leading-5 text-[var(--color-text-secondary)]">
                            El rol determina qué partes del
                            sistema podrá utilizar el usuario.
                            Las sucursales y cajas determinan
                            dónde podrá trabajar.
                        </p>
                    </div>

                    {/* BOTÓN */}

                    <div className="flex justify-end">
                        <Button
                            type="submit"
                            size="large"
                            disabled={creando}
                        >
                            {creando
                                ? "Creando usuario..."
                                : "Crear usuario"}
                        </Button>
                    </div>
                </form>
            </Card>

            {/* =================================================
                LISTADO
            ================================================= */}

            <Card className="overflow-hidden">
                <div className="border-b border-[var(--color-border)] p-4 sm:p-6">
                    <h2 className="text-lg font-bold text-[var(--color-text)]">
                        Usuarios registrados
                    </h2>

                    <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                        {usuarios.length} usuario
                        {usuarios.length === 1
                            ? ""
                            : "s"}{" "}
                        registrado
                        {usuarios.length === 1
                            ? ""
                            : "s"}
                    </p>
                </div>

                {usuarios.length === 0 ? (
                    <div className="p-8 text-center">
                        <p className="text-sm text-[var(--color-text-secondary)]">
                            No hay usuarios registrados.
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[900px]">
                            <thead>
                                <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface)] text-left">
                                    <th className="px-4 py-4 text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)] sm:px-6">
                                        Usuario
                                    </th>

                                    <th className="px-4 py-4 text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)] sm:px-6">
                                        Rol
                                    </th>

                                    <th className="px-4 py-4 text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)] sm:px-6">
                                        Estado
                                    </th>

                                    <th className="px-4 py-4 text-right text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)] sm:px-6">
                                        Acciones
                                    </th>
                                </tr>
                            </thead>

                            <tbody>
                                {usuarios.map(
                                    (usuario) => {
                                        const esActual =
                                            usuarioActual?.id ===
                                            usuario.id;

                                        return (
                                            <tr
                                                key={
                                                    usuario.id
                                                }
                                                className="border-b border-[var(--color-border)] last:border-0"
                                            >
                                                {/* USUARIO */}

                                                <td className="px-4 py-4 sm:px-6">
                                                    <div className="flex items-center gap-3">
                                                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)] font-bold text-white">
                                                            {usuario.nombre
                                                                .charAt(
                                                                    0
                                                                )
                                                                .toUpperCase()}
                                                        </div>

                                                        <div>
                                                            <p className="font-semibold text-[var(--color-text)]">
                                                                {
                                                                    usuario.nombre
                                                                }
                                                            </p>

                                                            <p className="text-xs text-[var(--color-text-secondary)]">
                                                                {esActual
                                                                    ? "Usuario actual"
                                                                    : "Usuario del sistema"}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </td>

                                                {/* ROL */}

                                                <td className="px-4 py-4 sm:px-6">
                                                    <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1 text-xs font-semibold text-[var(--color-text)]">
                                                        {usuario.rol ===
                                                            "admin"
                                                            ? "Administrador"
                                                            : usuario.rol ===
                                                                "encargado"
                                                                ? "Encargado"
                                                                : "Cajero"}
                                                    </span>
                                                </td>

                                                {/* ESTADO */}

                                                <td className="px-4 py-4 sm:px-6">
                                                    <span className="rounded-full border border-[var(--color-border)] px-3 py-1 text-xs font-semibold text-[var(--color-text)]">
                                                        {usuario.activo
                                                            ? "Activo"
                                                            : "Inactivo"}
                                                    </span>
                                                </td>

                                                {/* ACCIONES */}

                                                <td className="px-4 py-4 sm:px-6">
                                                    <div className="flex flex-wrap justify-end gap-2">
                                                        {/* EDITAR */}

                                                        <Button
                                                            type="button"
                                                            size="small"
                                                            variant="secondary"
                                                            onClick={() =>
                                                                abrirEditarUsuario(
                                                                    usuario
                                                                )
                                                            }
                                                            disabled={
                                                                procesandoAccion ||
                                                                guardandoEdicion
                                                            }
                                                        >
                                                            Editar
                                                        </Button>

                                                        {/* ACTIVAR / DESACTIVAR */}

                                                        <Button
                                                            type="button"
                                                            size="small"
                                                            variant={
                                                                usuario.activo
                                                                    ? "danger"
                                                                    : "secondary"
                                                            }
                                                            onClick={() =>
                                                                solicitarCambioEstado(
                                                                    usuario
                                                                )
                                                            }
                                                            disabled={
                                                                esActual ||
                                                                procesandoAccion
                                                            }
                                                        >
                                                            {usuario.activo
                                                                ? "Desactivar"
                                                                : "Activar"}
                                                        </Button>

                                                        {/* ELIMINAR */}

                                                        <Button
                                                            type="button"
                                                            size="small"
                                                            variant="danger"
                                                            onClick={() =>
                                                                solicitarEliminarUsuario(
                                                                    usuario
                                                                )
                                                            }
                                                            disabled={
                                                                esActual ||
                                                                procesandoAccion
                                                            }
                                                        >
                                                            Eliminar
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    }
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>

            {/* =================================================
                MODAL EDITAR USUARIO
            ================================================= */}

            {modalEdicionAbierto &&
                usuarioEditando && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                        <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl">
                            {/* HEADER */}

                            <div className="flex items-start justify-between border-b border-[var(--color-border)] p-5 sm:p-6">
                                <div>
                                    <h2 className="text-lg font-bold text-[var(--color-text)]">
                                        Editar usuario
                                    </h2>

                                    <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                                        Modifica los datos y permisos
                                        del usuario.
                                    </p>
                                </div>

                                <button
                                    type="button"
                                    onClick={
                                        cerrarEdicion
                                    }
                                    disabled={
                                        guardandoEdicion
                                    }
                                    className="rounded-lg px-3 py-2 text-xl text-[var(--color-text-secondary)] transition hover:bg-[var(--color-primary)]/10 disabled:opacity-50"
                                    aria-label="Cerrar"
                                >
                                    ×
                                </button>
                            </div>

                            {/* CONTENIDO */}

                            <div className="space-y-6 p-5 sm:p-6">
                                {/* NOMBRE */}

                                <div>
                                    <label
                                        htmlFor="nombre-edicion"
                                        className="mb-2 block text-sm font-semibold text-[var(--color-text)]"
                                    >
                                        Nombre
                                    </label>

                                    <input
                                        id="nombre-edicion"
                                        type="text"
                                        value={
                                            nombreEdicion
                                        }
                                        onChange={(e) =>
                                            setNombreEdicion(
                                                e.target.value
                                            )
                                        }
                                        disabled={
                                            guardandoEdicion
                                        }
                                        className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[var(--color-primary)]/10 disabled:opacity-60"
                                    />
                                </div>

                                {/* ROL */}

                                <div>
                                    <label
                                        htmlFor="rol-edicion"
                                        className="mb-2 block text-sm font-semibold text-[var(--color-text)]"
                                    >
                                        Rol
                                    </label>

                                    <select
                                        id="rol-edicion"
                                        value={
                                            rolEdicion
                                        }
                                        onChange={(e) =>
                                            setRolEdicion(
                                                e.target.value
                                            )
                                        }
                                        disabled={
                                            guardandoEdicion
                                        }
                                        className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[var(--color-primary)]/10 disabled:opacity-60"
                                    >
                                        <option value="cajero">
                                            Cajero
                                        </option>

                                        <option value="encargado">
                                            Encargado
                                        </option>

                                        <option value="admin">
                                            Administrador
                                        </option>
                                    </select>
                                </div>

                                {/* SUCURSALES */}

                                <div>
                                    <div className="mb-3">
                                        <h3 className="text-sm font-semibold text-[var(--color-text)]">
                                            Sucursales
                                        </h3>

                                        <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                                            Selecciona las sucursales
                                            permitidas.
                                        </p>
                                    </div>

                                    <div className="space-y-2 rounded-2xl border border-[var(--color-border)] p-3">
                                        {sucursales.length ===
                                            0 ? (
                                            <p className="p-2 text-sm text-[var(--color-text-secondary)]">
                                                No hay sucursales
                                                disponibles.
                                            </p>
                                        ) : (
                                            sucursales.map(
                                                (
                                                    sucursal
                                                ) => {
                                                    const seleccionada =
                                                        sucursalesEdicion.includes(
                                                            sucursal.id
                                                        );

                                                    return (
                                                        <label
                                                            key={
                                                                sucursal.id
                                                            }
                                                            className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition ${seleccionada
                                                                ? "border-[var(--color-primary)] bg-[var(--color-primary)]/10"
                                                                : "border-transparent"
                                                                }`}
                                                        >
                                                            <input
                                                                type="checkbox"
                                                                checked={
                                                                    seleccionada
                                                                }
                                                                disabled={
                                                                    guardandoEdicion
                                                                }
                                                                onChange={() =>
                                                                    cambiarSucursalEdicion(
                                                                        sucursal.id
                                                                    )
                                                                }
                                                                className="h-4 w-4"
                                                            />

                                                            <div>
                                                                <p className="text-sm font-semibold text-[var(--color-text)]">
                                                                    {
                                                                        sucursal.nombre
                                                                    }
                                                                </p>

                                                                <p className="text-xs text-[var(--color-text-secondary)]">
                                                                    Sucursal activa
                                                                </p>
                                                            </div>
                                                        </label>
                                                    );
                                                }
                                            )
                                        )}
                                    </div>
                                </div>

                                {/* CAJAS */}

                                <div>
                                    <div className="mb-3">
                                        <h3 className="text-sm font-semibold text-[var(--color-text)]">
                                            Cajas permitidas
                                        </h3>

                                        <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                                            Selecciona las cajas que
                                            podrá utilizar.
                                        </p>
                                    </div>

                                    <div className="space-y-2 rounded-2xl border border-[var(--color-border)] p-3">
                                        {sucursalesEdicion.length ===
                                            0 ? (
                                            <p className="p-2 text-sm text-[var(--color-text-secondary)]">
                                                Primero selecciona
                                                una sucursal.
                                            </p>
                                        ) : (
                                            cajas
                                                .filter(
                                                    (
                                                        caja
                                                    ) =>
                                                        sucursalesEdicion.includes(
                                                            caja.sucursal_id
                                                        )
                                                )
                                                .map(
                                                    (
                                                        caja
                                                    ) => {
                                                        const seleccionada =
                                                            cajasEdicion.includes(
                                                                caja.id
                                                            );

                                                        const sucursal =
                                                            sucursales.find(
                                                                (
                                                                    item
                                                                ) =>
                                                                    item.id ===
                                                                    caja.sucursal_id
                                                            );

                                                        return (
                                                            <label
                                                                key={
                                                                    caja.id
                                                                }
                                                                className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition ${seleccionada
                                                                    ? "border-[var(--color-primary)] bg-[var(--color-primary)]/10"
                                                                    : "border-transparent"
                                                                    }`}
                                                            >
                                                                <input
                                                                    type="checkbox"
                                                                    checked={
                                                                        seleccionada
                                                                    }
                                                                    disabled={
                                                                        guardandoEdicion
                                                                    }
                                                                    onChange={() =>
                                                                        cambiarCajaEdicion(
                                                                            caja.id
                                                                        )
                                                                    }
                                                                    className="h-4 w-4"
                                                                />

                                                                <div>
                                                                    <p className="text-sm font-semibold text-[var(--color-text)]">
                                                                        {
                                                                            caja.nombre
                                                                        }
                                                                    </p>

                                                                    <p className="text-xs text-[var(--color-text-secondary)]">
                                                                        {sucursal?.nombre ??
                                                                            "Sucursal desconocida"}
                                                                    </p>
                                                                </div>
                                                            </label>
                                                        );
                                                    }
                                                )
                                        )}
                                    </div>
                                </div>

                                {/* INFORMACIÓN */}

                                <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
                                    <p className="text-sm font-semibold text-[var(--color-text)]">
                                        Permisos
                                    </p>

                                    <p className="mt-1 text-sm leading-5 text-[var(--color-text-secondary)]">
                                        El rol determina los permisos
                                        generales. Las sucursales y
                                        cajas determinan dónde puede
                                        trabajar el usuario.
                                    </p>
                                </div>
                            </div>

                            {/* FOOTER */}

                            <div className="flex flex-col-reverse gap-3 border-t border-[var(--color-border)] p-5 sm:flex-row sm:justify-end sm:p-6">
                                <Button
                                    type="button"
                                    variant="secondary"
                                    onClick={
                                        cerrarEdicion
                                    }
                                    disabled={
                                        guardandoEdicion
                                    }
                                >
                                    Cancelar
                                </Button>

                                <Button
                                    type="button"
                                    onClick={
                                        guardarEdicion
                                    }
                                    disabled={
                                        guardandoEdicion
                                    }
                                >
                                    {guardandoEdicion
                                        ? "Guardando..."
                                        : "Guardar cambios"}
                                </Button>
                            </div>
                        </div>
                    </div>
                )}

            {/* =================================================
                MODAL MENSAJES
            ================================================= */}

            <ModalMensaje
                abierto={
                    modalMensajeAbierto
                }
                tipo={
                    tipoMensaje
                }
                titulo={
                    tituloMensaje
                }
                mensaje={
                    textoMensaje
                }
                textoBoton={
                    tipoMensaje ===
                        "confirmacion"
                        ? "Confirmar"
                        : "Aceptar"
                }
                textoCancelar="Cancelar"
                onCerrar={
                    cerrarModalMensaje
                }
                onConfirmar={
                    tipoMensaje ===
                        "confirmacion"
                        ? confirmarAccion
                        : undefined
                }
            />
        </div>
    );
}