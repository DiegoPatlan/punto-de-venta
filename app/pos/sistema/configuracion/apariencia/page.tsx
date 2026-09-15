"use client";

import {
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";

import Card from "../../../../components/Card";
import { supabasePOS } from "../../../../../lib/supabase";
import { obtenerUsuarioPOS } from "../../../../../lib/usuarioPOS";

interface UsuarioPOS {
    id: string;
    negocio_id: string | null;
    nombre: string;
    rol: string;
    foto_url?: string | null;
}

interface ConfiguracionApariencia {
    color_primary: string;
    color_primary_hover: string;
    color_secondary: string;
    color_background: string;
    color_surface: string;
    color_text: string;
    color_text_secondary: string;
    color_border: string;
    color_danger: string;
    modo: "light" | "dark";
}

interface Paleta {
    nombre: string;
    color: string;
}

/*
 * ============================================================
 * PALETAS
 * ============================================================
 */

const PALETAS: Paleta[] = [
    {
        nombre: "Azul",
        color: "#2563eb",
    },
    {
        nombre: "Morado",
        color: "#7c3aed",
    },
    {
        nombre: "Verde",
        color: "#16a34a",
    },
    {
        nombre: "Naranja",
        color: "#ea580c",
    },
    {
        nombre: "Rojo",
        color: "#dc2626",
    },
    {
        nombre: "Rosa",
        color: "#db2777",
    },
    {
        nombre: "Turquesa",
        color: "#0891b2",
    },
    {
        nombre: "Índigo",
        color: "#4f46e5",
    },
    {
        nombre: "Negro",
        color: "#111827",
    },
];

/*
 * ============================================================
 * VALORES POR DEFECTO
 * ============================================================
 */

const VALORES_POR_DEFECTO: ConfiguracionApariencia = {
    color_primary: "#2563eb",
    color_primary_hover: "#1d4ed8",
    color_secondary: "#1e3a8a",
    color_background: "#f8fafc",
    color_surface: "#ffffff",
    color_text: "#0f172a",
    color_text_secondary: "#64748b",
    color_border: "#e2e8f0",
    color_danger: "#dc2626",
    modo: "light",
};

/*
 * ============================================================
 * FOTO DEL USUARIO
 * ============================================================
 */

const FOTO_BUCKET = "fotos-usuarios";
const FOTO_PATH = "foto";
const FOTO_MAX_SIZE = 3 * 1024 * 1024;

const TIPOS_FOTO_PERMITIDOS = [
    "image/jpeg",
    "image/png",
    "image/webp",
];

/*
 * ============================================================
 * UTILIDADES DE COLOR
 * ============================================================
 */

function hexToRgb(hex: string) {
    const limpio = hex.replace("#", "");

    if (limpio.length !== 6) {
        return null;
    }

    const numero = Number.parseInt(limpio, 16);

    if (Number.isNaN(numero)) {
        return null;
    }

    return {
        r: (numero >> 16) & 255,
        g: (numero >> 8) & 255,
        b: numero & 255,
    };
}

function rgbToHex(
    r: number,
    g: number,
    b: number
) {
    const convertir = (valor: number) =>
        Math.max(
            0,
            Math.min(
                255,
                Math.round(valor)
            )
        )
            .toString(16)
            .padStart(2, "0");

    return `#${convertir(r)}${convertir(g)}${convertir(b)}`;
}

function mezclarColores(
    color1: string,
    color2: string,
    porcentaje: number
) {
    const rgb1 = hexToRgb(color1);
    const rgb2 = hexToRgb(color2);

    if (!rgb1 || !rgb2) {
        return color1;
    }

    const p = Math.max(
        0,
        Math.min(1, porcentaje)
    );

    return rgbToHex(
        rgb1.r +
        (rgb2.r - rgb1.r) * p,

        rgb1.g +
        (rgb2.g - rgb1.g) * p,

        rgb1.b +
        (rgb2.b - rgb1.b) * p
    );
}

function oscurecerColor(
    color: string,
    cantidad = 0.2
) {
    return mezclarColores(
        color,
        "#000000",
        cantidad
    );
}

function aclararColor(
    color: string,
    cantidad = 0.9
) {
    return mezclarColores(
        color,
        "#ffffff",
        cantidad
    );
}

/*
 * ============================================================
 * GENERAR CONFIGURACIÓN
 * ============================================================
 */

function generarConfiguracion(
    colorPrincipal: string
): ConfiguracionApariencia {
    const primary =
        colorPrincipal.toUpperCase();

    const hover =
        oscurecerColor(
            primary,
            0.22
        );

    const secondary =
        oscurecerColor(
            primary,
            0.48
        );

    const background =
        aclararColor(
            primary,
            0.965
        );

    const surface = "#ffffff";

    const border =
        aclararColor(
            primary,
            0.78
        );

    return {
        color_primary: primary,
        color_primary_hover: hover,
        color_secondary: secondary,
        color_background: background,
        color_surface: surface,
        color_text: "#0f172a",
        color_text_secondary: "#64748b",
        color_border: border,
        color_danger: "#dc2626",
        modo: "light",
    };
}

/*
 * ============================================================
 * APLICAR VISTA PREVIA
 * ============================================================
 */

function aplicarVistaPrevia(
    config: ConfiguracionApariencia
) {
    const root =
        document.documentElement;

    root.style.setProperty(
        "--color-primary",
        config.color_primary
    );

    root.style.setProperty(
        "--color-primary-hover",
        config.color_primary_hover
    );

    root.style.setProperty(
        "--color-secondary",
        config.color_secondary
    );

    root.style.setProperty(
        "--color-background",
        config.color_background
    );

    root.style.setProperty(
        "--color-surface",
        config.color_surface
    );

    root.style.setProperty(
        "--color-text",
        config.color_text
    );

    root.style.setProperty(
        "--color-text-secondary",
        config.color_text_secondary
    );

    root.style.setProperty(
        "--color-border",
        config.color_border
    );

    root.style.setProperty(
        "--color-danger",
        config.color_danger
    );
}

/*
 * ============================================================
 * COMPONENTE
 * ============================================================
 */

export default function AparienciaPage() {
    const [usuario, setUsuario] =
        useState<UsuarioPOS | null>(null);

    const [colorPrincipal, setColorPrincipal] =
        useState(
            VALORES_POR_DEFECTO.color_primary
        );

    const [configOriginal, setConfigOriginal] =
        useState<
            ConfiguracionApariencia | null
        >(null);

    const [cargando, setCargando] =
        useState(true);

    const [guardando, setGuardando] =
        useState(false);

    const [error, setError] =
        useState("");

    const [mensajeExito, setMensajeExito] =
        useState("");

    /*
     * ========================================================
     * FOTO DEL USUARIO
     * ========================================================
     */

    const [fotoUrl, setFotoUrl] =
        useState<string | null>(null);

    const [fotoPreview, setFotoPreview] =
        useState<string | null>(null);

    const [fotoArchivo, setFotoArchivo] =
        useState<File | null>(null);

    const [subiendoFoto, setSubiendoFoto] =
        useState(false);

    const [eliminandoFoto, setEliminandoFoto] =
        useState(false);

    const [
        confirmandoEliminarFoto,
        setConfirmandoEliminarFoto,
    ] = useState(false);

    const inputFotoRef =
        useRef<HTMLInputElement | null>(null);

    /*
     * ========================================================
     * CONFIGURACIÓN PREVIEW
     * ========================================================
     */

    const configuracionPreview =
        useMemo(
            () =>
                generarConfiguracion(
                    colorPrincipal
                ),
            [colorPrincipal]
        );

    /*
     * ========================================================
     * CARGAR CONFIGURACIÓN
     * ========================================================
     */

    useEffect(() => {
        let cancelado = false;

        async function cargarConfiguracion() {
            setCargando(true);
            setError("");

            try {
                const datosUsuario =
                    (await obtenerUsuarioPOS()) as
                    | UsuarioPOS
                    | null;

                if (
                    cancelado ||
                    !datosUsuario?.negocio_id
                ) {
                    if (!cancelado) {
                        setError(
                            "No se encontró el negocio del usuario."
                        );

                        setCargando(false);
                    }

                    return;
                }

                setUsuario(datosUsuario);

                /*
                 * ==================================================
                 * CARGAR CONFIGURACIÓN DE APARIENCIA
                 * ==================================================
                 */

                const {
                    data,
                    error:
                    errorConfiguracion,
                } = await supabasePOS
                    .from(
                        "configuracion_apariencia"
                    )
                    .select(`
                        color_primary,
                        color_primary_hover,
                        color_secondary,
                        color_background,
                        color_surface,
                        color_text,
                        color_text_secondary,
                        color_border,
                        color_danger,
                        modo
                    `)
                    .eq(
                        "negocio_id",
                        datosUsuario.negocio_id
                    )
                    .maybeSingle();

                if (errorConfiguracion) {
                    console.error(
                        "Error cargando apariencia:",
                        errorConfiguracion
                    );

                    setError(
                        "No se pudo cargar la configuración de apariencia."
                    );

                    return;
                }

                const configuracion =
                    data
                        ? {
                            ...VALORES_POR_DEFECTO,
                            ...data,
                        }
                        : VALORES_POR_DEFECTO;

                if (cancelado) {
                    return;
                }

                setConfigOriginal(
                    configuracion
                );

                setColorPrincipal(
                    configuracion.color_primary
                );

                aplicarVistaPrevia(
                    configuracion
                );

                /*
                 * ==================================================
                 * CARGAR FOTO DEL USUARIO
                 * ==================================================
                 */

                const {
                    data: usuarioFoto,
                    error: errorFoto,
                } = await supabasePOS
                    .from("usuarios")
                    .select("foto_url")
                    .eq(
                        "id",
                        datosUsuario.id
                    )
                    .maybeSingle();

                if (errorFoto) {
                    console.error(
                        "Error cargando foto del usuario:",
                        errorFoto
                    );
                } else if (
                    usuarioFoto?.foto_url
                ) {
                    setFotoUrl(
                        usuarioFoto.foto_url
                    );

                    setFotoPreview(
                        usuarioFoto.foto_url
                    );
                } else {
                    setFotoUrl(null);
                    setFotoPreview(null);
                }
            } catch (error) {
                console.error(
                    "Error inesperado cargando apariencia:",
                    error
                );

                if (!cancelado) {
                    setError(
                        "Ocurrió un error al cargar la configuración."
                    );
                }
            } finally {
                if (!cancelado) {
                    setCargando(false);
                }
            }
        }

        cargarConfiguracion();

        return () => {
            cancelado = true;
        };
    }, []);

    /*
     * ========================================================
     * ACTUALIZAR VISTA PREVIA
     * ========================================================
     */

    useEffect(() => {
        if (cargando) {
            return;
        }

        aplicarVistaPrevia(
            configuracionPreview
        );
    }, [
        configuracionPreview,
        cargando,
    ]);

    /*
     * ========================================================
     * LIMPIAR URL TEMPORAL DE FOTO
     * ========================================================
     */

    useEffect(() => {
        return () => {
            if (
                fotoPreview &&
                fotoPreview.startsWith(
                    "blob:"
                )
            ) {
                URL.revokeObjectURL(
                    fotoPreview
                );
            }
        };
    }, [fotoPreview]);

    /*
     * ========================================================
     * COLORES
     * ========================================================
     */

    function seleccionarColor(
        color: string
    ) {
        setError("");
        setMensajeExito("");
        setColorPrincipal(color);
    }

    function cambiarColorPersonalizado(
        valor: string
    ) {
        const normalizado =
            valor.startsWith("#")
                ? valor
                : `#${valor}`;

        if (
            /^#[0-9A-Fa-f]{6}$/.test(
                normalizado
            )
        ) {
            setError("");
            setMensajeExito("");

            setColorPrincipal(
                normalizado.toUpperCase()
            );
        }
    }

    /*
     * ========================================================
     * SELECCIONAR FOTO
     * ========================================================
     */

    function seleccionarFoto(
        archivo: File | null
    ) {
        setError("");
        setMensajeExito("");

        if (!archivo) {
            return;
        }

        if (
            !TIPOS_FOTO_PERMITIDOS.includes(
                archivo.type
            )
        ) {
            setError(
                "Formato no permitido. Usa PNG, JPG, JPEG o WEBP."
            );

            return;
        }

        if (
            archivo.size >
            FOTO_MAX_SIZE
        ) {
            setError(
                "La foto no puede superar los 3 MB."
            );

            return;
        }

        if (fotoPreview?.startsWith("blob:")) {
            URL.revokeObjectURL(
                fotoPreview
            );
        }

        const preview =
            URL.createObjectURL(
                archivo
            );

        setFotoArchivo(archivo);
        setFotoPreview(preview);
    }

    /*
     * ========================================================
     * CANCELAR FOTO SELECCIONADA
     * ========================================================
     */

    function cancelarFotoSeleccionada() {
        if (
            fotoPreview &&
            fotoPreview.startsWith("blob:")
        ) {
            URL.revokeObjectURL(
                fotoPreview
            );
        }

        setFotoArchivo(null);
        setFotoPreview(
            fotoUrl
        );

        if (inputFotoRef.current) {
            inputFotoRef.current.value =
                "";
        }
    }

    /*
     * ========================================================
     * SUBIR FOTO
     * ========================================================
     */

    async function subirFoto() {
        if (
            !usuario?.id ||
            !fotoArchivo ||
            subiendoFoto ||
            eliminandoFoto
        ) {
            return;
        }

        setSubiendoFoto(true);
        setError("");
        setMensajeExito("");

        try {
            const usuarioId =
                usuario.id;

            const rutaFoto =
                `${usuarioId}/${FOTO_PATH}`;

            /*
             * Subir / reemplazar foto.
             */

            const {
                error: errorStorage,
            } = await supabasePOS.storage
                .from(FOTO_BUCKET)
                .upload(
                    rutaFoto,
                    fotoArchivo,
                    {
                        upsert: true,
                        contentType:
                            fotoArchivo.type,
                        cacheControl:
                            "3600",
                    }
                );

            if (errorStorage) {
                console.error(
                    "Error subiendo foto:",
                    errorStorage
                );

                setError(
                    errorStorage.message ||
                    "No se pudo subir la foto."
                );

                return;
            }

            /*
             * Obtener URL pública.
             */

            const {
                data: publicData,
            } =
                supabasePOS.storage
                    .from(
                        FOTO_BUCKET
                    )
                    .getPublicUrl(
                        rutaFoto
                    );

            const fotoPublica =
                publicData?.publicUrl
                    ? `${publicData.publicUrl}?v=${Date.now()}`
                    : null;

            if (!fotoPublica) {
                setError(
                    "No se pudo obtener la URL de la foto."
                );

                return;
            }

            /*
             * Actualizar usuarios.
             */

            const {
                error: errorUsuario,
            } = await supabasePOS
                .from("usuarios")
                .update({
                    foto_url:
                        fotoPublica,
                })
                .eq(
                    "id",
                    usuarioId
                );

            if (errorUsuario) {
                console.error(
                    "Error actualizando foto del usuario:",
                    errorUsuario
                );

                setError(
                    errorUsuario.message ||
                    "No se pudo actualizar la foto del usuario."
                );

                return;
            }

            setFotoUrl(
                fotoPublica
            );

            setFotoPreview(
                fotoPublica
            );

            setFotoArchivo(
                null
            );

            if (inputFotoRef.current) {
                inputFotoRef.current.value =
                    "";
            }

            /*
             * Avisar al resto del POS.
             */

            if (
                typeof window !==
                "undefined"
            ) {
                window.dispatchEvent(
                    new CustomEvent(
                        "usuario-foto-actualizada",
                        {
                            detail: {
                                usuarioId:
                                    usuarioId,
                                fotoUrl:
                                    fotoPublica,
                            },
                        }
                    )
                );
            }

            setMensajeExito(
                "Tu foto de perfil fue actualizada correctamente."
            );

            setTimeout(() => {
                setMensajeExito("");
            }, 5000);
        } catch (error) {
            console.error(
                "Error inesperado subiendo foto:",
                error
            );

            setError(
                "Ocurrió un error al subir tu foto de perfil."
            );
        } finally {
            setSubiendoFoto(false);
        }
    }

    /*
     * ========================================================
     * CONFIRMAR ELIMINACIÓN
     * ========================================================
     */

    function solicitarEliminarFoto() {
        if (
            eliminandoFoto ||
            subiendoFoto ||
            !fotoUrl
        ) {
            return;
        }

        setConfirmandoEliminarFoto(
            true
        );

        setError("");
        setMensajeExito("");
    }

    /*
     * ========================================================
     * ELIMINAR FOTO
     * ========================================================
     */

    async function eliminarFoto() {
        if (
            !usuario?.id ||
            !fotoUrl ||
            eliminandoFoto
        ) {
            return;
        }

        setEliminandoFoto(true);
        setError("");
        setMensajeExito("");

        try {
            const usuarioId =
                usuario.id;

            const rutaFoto =
                `${usuarioId}/${FOTO_PATH}`;

            /*
             * Eliminar archivo del Storage.
             */

            const {
                error:
                errorStorage,
            } = await supabasePOS.storage
                .from(FOTO_BUCKET)
                .remove([
                    rutaFoto,
                ]);

            if (errorStorage) {
                console.error(
                    "Error eliminando foto del Storage:",
                    errorStorage
                );

                setError(
                    errorStorage.message ||
                    "No se pudo eliminar el archivo de la foto."
                );

                return;
            }

            /*
             * Eliminar referencia.
             */

            const {
                error:
                errorUsuario,
            } = await supabasePOS
                .from("usuarios")
                .update({
                    foto_url: null,
                })
                .eq(
                    "id",
                    usuarioId
                );

            if (errorUsuario) {
                console.error(
                    "Error eliminando referencia de la foto:",
                    errorUsuario
                );

                setError(
                    errorUsuario.message ||
                    "La foto fue eliminada del almacenamiento, pero no se pudo actualizar el usuario."
                );

                return;
            }

            setFotoUrl(null);
            setFotoPreview(null);
            setFotoArchivo(null);

            setConfirmandoEliminarFoto(
                false
            );

            if (inputFotoRef.current) {
                inputFotoRef.current.value =
                    "";
            }

            /*
             * Avisar al resto del POS.
             */

            if (
                typeof window !==
                "undefined"
            ) {
                window.dispatchEvent(
                    new CustomEvent(
                        "usuario-foto-actualizada",
                        {
                            detail: {
                                usuarioId:
                                    usuarioId,
                                fotoUrl:
                                    null,
                            },
                        }
                    )
                );
            }

            setMensajeExito(
                "Tu foto de perfil fue eliminada correctamente."
            );

            setTimeout(() => {
                setMensajeExito("");
            }, 5000);
        } catch (error) {
            console.error(
                "Error inesperado eliminando foto:",
                error
            );

            setError(
                "Ocurrió un error al eliminar tu foto de perfil."
            );
        } finally {
            setEliminandoFoto(false);
        }
    }

    /*
     * ========================================================
     * GUARDAR CONFIGURACIÓN
     * ========================================================
     */

    async function guardarConfiguracion() {
        if (
            guardando ||
            !usuario?.negocio_id
        ) {
            return;
        }

        setGuardando(true);
        setError("");
        setMensajeExito("");

        try {
            const configuracion =
                generarConfiguracion(
                    colorPrincipal
                );

            const {
                error:
                errorUpdate,
            } = await supabasePOS
                .from(
                    "configuracion_apariencia"
                )
                .update({
                    color_primary:
                        configuracion.color_primary,

                    color_primary_hover:
                        configuracion.color_primary_hover,

                    color_secondary:
                        configuracion.color_secondary,

                    color_background:
                        configuracion.color_background,

                    color_surface:
                        configuracion.color_surface,

                    color_text:
                        configuracion.color_text,

                    color_text_secondary:
                        configuracion.color_text_secondary,

                    color_border:
                        configuracion.color_border,

                    color_danger:
                        configuracion.color_danger,

                    modo:
                        configuracion.modo,

                    updated_at:
                        new Date().toISOString(),
                })
                .eq(
                    "negocio_id",
                    usuario.negocio_id
                );

            if (errorUpdate) {
                console.error(
                    "Error guardando apariencia:",
                    errorUpdate
                );

                setError(
                    errorUpdate.message ||
                    "No se pudo guardar la configuración de apariencia."
                );

                return;
            }

            setConfigOriginal(
                configuracion
            );

            aplicarVistaPrevia(
                configuracion
            );

            setMensajeExito(
                "La apariencia del sistema fue actualizada correctamente."
            );

            setTimeout(() => {
                setMensajeExito("");
            }, 5000);
        } catch (error) {
            console.error(
                "Error inesperado guardando apariencia:",
                error
            );

            setError(
                "Ocurrió un error al guardar la configuración."
            );
        } finally {
            setGuardando(false);
        }
    }

    /*
     * ========================================================
     * RESTAURAR CONFIGURACIÓN
     * ========================================================
     */

    function restaurarConfiguracion() {
        if (guardando) {
            return;
        }

        const configuracion =
            configOriginal ||
            VALORES_POR_DEFECTO;

        setColorPrincipal(
            configuracion.color_primary
        );

        setError("");
        setMensajeExito("");
    }

    /*
     * ========================================================
     * CARGANDO
     * ========================================================
     */

    if (cargando) {
        return (
            <div className="space-y-6">
                <Card className="p-8">
                    <p className="text-center text-sm text-[var(--color-text-secondary)]">
                        Cargando configuración
                        de apariencia...
                    </p>
                </Card>
            </div>
        );
    }

    /*
     * ========================================================
     * RENDER
     * ========================================================
     */

    return (
        <div className="space-y-6">

            {/* ==================================================
                MENSAJE DE ÉXITO
            ================================================== */}

            {mensajeExito && (
                <div className="fixed right-4 top-4 z-[100] w-[calc(100%-2rem)] max-w-md">
                    <div className="rounded-2xl border border-green-200 bg-white p-4 shadow-2xl">
                        <div className="flex items-start gap-3">

                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-100 text-lg text-green-700">
                                ✓
                            </div>

                            <div className="min-w-0 flex-1">
                                <p className="text-sm font-bold text-green-800">
                                    Operación completada
                                </p>

                                <p className="mt-1 text-sm leading-5 text-green-700">
                                    {mensajeExito}
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={() =>
                                    setMensajeExito("")
                                }
                                className="rounded-lg px-2 py-1 text-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                            >
                                ×
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ==================================================
                MENSAJE DE ERROR
            ================================================== */}

            {error && (
                <div className="fixed right-4 top-4 z-[100] w-[calc(100%-2rem)] max-w-md">
                    <div className="rounded-2xl border border-red-200 bg-white p-4 shadow-2xl">
                        <div className="flex items-start gap-3">

                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-lg text-red-700">
                                !
                            </div>

                            <div className="min-w-0 flex-1">
                                <p className="text-sm font-bold text-red-800">
                                    Ocurrió un problema
                                </p>

                                <p className="mt-1 text-sm leading-5 text-red-700">
                                    {error}
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={() =>
                                    setError("")
                                }
                                className="rounded-lg px-2 py-1 text-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                            >
                                ×
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ==================================================
                ENCABEZADO
            ================================================== */}

            <div>
                <h1 className="text-2xl font-bold text-[var(--color-text)] sm:text-3xl">
                    Apariencia
                </h1>

                <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                    Personaliza los colores de
                    tu punto de venta. El
                    sistema generará
                    automáticamente una
                    combinación visual basada
                    en tu color principal.
                </p>
            </div>

            {/* ==================================================
                FOTO DE PERFIL
            ================================================== */}

            <Card className="p-5 sm:p-6">

                <div>
                    <h2 className="text-lg font-bold text-[var(--color-text)]">
                        Foto de perfil
                    </h2>

                    <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                        Agrega una foto para
                        identificar tu perfil
                        dentro del sistema.
                    </p>
                </div>

                <div className="mt-6 flex flex-col gap-6 md:flex-row md:items-center">

                    {/* PREVISUALIZACIÓN */}

                    <div className="flex h-32 w-32 shrink-0 items-center justify-center overflow-hidden rounded-full border-4 border-[var(--color-border)] bg-[var(--color-background)] shadow-sm">

                        {fotoPreview ? (
                            <img
                                src={fotoPreview}
                                alt={`Foto de ${usuario?.nombre ||
                                    "usuario"
                                    }`}
                                className="h-full w-full object-cover"
                            />
                        ) : (
                            <div
                                className="flex h-full w-full items-center justify-center text-4xl font-bold text-white"
                                style={{
                                    background:
                                        `linear-gradient(135deg, ${configuracionPreview.color_primary}, ${configuracionPreview.color_primary_hover})`,
                                }}
                            >
                                {usuario?.nombre
                                    ?.charAt(
                                        0
                                    )
                                    .toUpperCase() ||
                                    "U"}
                            </div>
                        )}
                    </div>

                    {/* CONTROLES */}

                    <div className="min-w-0 flex-1">

                        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">

                            <button
                                type="button"
                                onClick={() =>
                                    inputFotoRef.current?.click()
                                }
                                disabled={
                                    subiendoFoto ||
                                    eliminandoFoto
                                }
                                className="rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
                                style={{
                                    background:
                                        `linear-gradient(135deg, ${configuracionPreview.color_primary}, ${configuracionPreview.color_primary_hover})`,
                                }}
                            >
                                {fotoArchivo
                                    ? "Cambiar imagen"
                                    : fotoUrl
                                        ? "Cambiar foto"
                                        : "Seleccionar foto"}
                            </button>

                            {fotoArchivo && (
                                <>
                                    <button
                                        type="button"
                                        onClick={
                                            subirFoto
                                        }
                                        disabled={
                                            subiendoFoto ||
                                            eliminandoFoto
                                        }
                                        className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm font-semibold text-[var(--color-text)] transition hover:bg-[var(--color-background)] disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        {subiendoFoto
                                            ? "Guardando..."
                                            : "Guardar foto"}
                                    </button>

                                    <button
                                        type="button"
                                        onClick={
                                            cancelarFotoSeleccionada
                                        }
                                        disabled={
                                            subiendoFoto ||
                                            eliminandoFoto
                                        }
                                        className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm font-semibold text-[var(--color-text)] transition hover:bg-[var(--color-background)] disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        Cancelar
                                    </button>
                                </>
                            )}

                            {fotoUrl &&
                                !fotoArchivo && (
                                    <button
                                        type="button"
                                        onClick={
                                            solicitarEliminarFoto
                                        }
                                        disabled={
                                            subiendoFoto ||
                                            eliminandoFoto
                                        }
                                        className="rounded-xl border border-red-200 bg-white px-4 py-3 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        Eliminar foto
                                    </button>
                                )}
                        </div>

                        <input
                            ref={inputFotoRef}
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            className="hidden"
                            onChange={(e) =>
                                seleccionarFoto(
                                    e.target.files?.[0] ||
                                    null
                                )
                            }
                        />

                        <p className="mt-3 text-xs leading-5 text-[var(--color-text-secondary)]">
                            Formatos permitidos:
                            PNG, JPG, JPEG y
                            WEBP. Tamaño máximo:
                            3 MB.
                        </p>

                        {fotoArchivo && (
                            <div className="mt-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] p-3">

                                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-semibold text-[var(--color-text)]">
                                            {
                                                fotoArchivo.name
                                            }
                                        </p>

                                        <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                                            {(
                                                fotoArchivo.size /
                                                1024 /
                                                1024
                                            ).toFixed(
                                                2
                                            )}{" "}
                                            MB
                                        </p>
                                    </div>

                                    <span
                                        className="w-fit rounded-full px-3 py-1 text-xs font-semibold text-white"
                                        style={{
                                            backgroundColor:
                                                configuracionPreview.color_primary,
                                        }}
                                    >
                                        Imagen seleccionada
                                    </span>

                                </div>
                            </div>
                        )}

                        {/* CONFIRMACIÓN */}

                        {confirmandoEliminarFoto && (
                            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4">

                                <p className="text-sm font-semibold text-red-800">
                                    ¿Eliminar tu foto
                                    de perfil?
                                </p>

                                <p className="mt-1 text-sm leading-5 text-red-700">
                                    La foto se
                                    eliminará
                                    permanentemente
                                    de tu perfil.
                                </p>

                                <div className="mt-4 flex flex-col gap-2 sm:flex-row">

                                    <button
                                        type="button"
                                        onClick={
                                            eliminarFoto
                                        }
                                        disabled={
                                            eliminandoFoto
                                        }
                                        className="rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        {eliminandoFoto
                                            ? "Eliminando..."
                                            : "Sí, eliminar"}
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() =>
                                            setConfirmandoEliminarFoto(
                                                false
                                            )
                                        }
                                        disabled={
                                            eliminandoFoto
                                        }
                                        className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm font-semibold text-[var(--color-text)] transition hover:bg-[var(--color-background)] disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        Cancelar
                                    </button>

                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </Card>

            {/* ==================================================
                PALETAS
            ================================================== */}

            <Card className="p-5 sm:p-6">

                <div>
                    <h2 className="text-lg font-bold text-[var(--color-text)]">
                        Paleta de colores
                    </h2>

                    <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                        Selecciona un color
                        principal para generar
                        automáticamente el resto
                        de la combinación.
                    </p>
                </div>

                <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">

                    {PALETAS.map(
                        (paleta) => {
                            const activa =
                                colorPrincipal.toUpperCase() ===
                                paleta.color.toUpperCase();

                            return (
                                <button
                                    key={
                                        paleta.color
                                    }
                                    type="button"
                                    onClick={() =>
                                        seleccionarColor(
                                            paleta.color
                                        )
                                    }
                                    className={`group rounded-2xl border p-3 text-left transition ${activa
                                        ? "border-[var(--color-primary)] ring-2 ring-[var(--color-primary)]/20"
                                        : "border-[var(--color-border)] hover:-translate-y-0.5 hover:shadow-md"
                                        }`}
                                >
                                    <div
                                        className="h-14 w-full rounded-xl shadow-sm"
                                        style={{
                                            background:
                                                `linear-gradient(135deg, ${paleta.color}, ${oscurecerColor(paleta.color, 0.22)})`,
                                        }}
                                    />

                                    <div className="mt-3 flex items-center justify-between gap-2">
                                        <div>
                                            <p className="text-sm font-semibold text-[var(--color-text)]">
                                                {
                                                    paleta.nombre
                                                }
                                            </p>

                                            <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
                                                {
                                                    paleta.color
                                                }
                                            </p>
                                        </div>

                                        {activa && (
                                            <span
                                                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                                                style={{
                                                    backgroundColor:
                                                        configuracionPreview.color_primary,
                                                }}
                                            >
                                                ✓
                                            </span>
                                        )}
                                    </div>
                                </button>
                            );
                        }
                    )}
                </div>
            </Card>

            {/* ==================================================
                COLOR PERSONALIZADO
            ================================================== */}

            <Card className="p-5 sm:p-6">

                <div>
                    <h2 className="text-lg font-bold text-[var(--color-text)]">
                        Color personalizado
                    </h2>

                    <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                        También puedes introducir
                        directamente un color HEX.
                    </p>
                </div>

                <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-end">

                    <div className="flex-1">
                        <label
                            htmlFor="color-personalizado"
                            className="mb-2 block text-sm font-semibold text-[var(--color-text)]"
                        >
                            Código HEX
                        </label>

                        <input
                            id="color-personalizado"
                            type="text"
                            value={colorPrincipal}
                            maxLength={7}
                            onChange={(e) =>
                                cambiarColorPersonalizado(
                                    e.target.value
                                )
                            }
                            className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm font-semibold uppercase text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
                            placeholder="#2563EB"
                        />
                    </div>

                    <div className="flex items-center gap-3">

                        <div
                            className="h-12 w-12 shrink-0 rounded-xl border border-[var(--color-border)] shadow-sm"
                            style={{
                                backgroundColor:
                                    configuracionPreview.color_primary,
                            }}
                        />

                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
                                Color actual
                            </p>

                            <p className="mt-0.5 text-sm font-bold text-[var(--color-text)]">
                                {
                                    configuracionPreview.color_primary
                                }
                            </p>
                        </div>

                    </div>
                </div>
            </Card>

            {/* ==================================================
                VISTA PREVIA
            ================================================== */}

            <Card className="overflow-hidden p-0">

                <div className="border-b border-[var(--color-border)] p-5 sm:p-6">

                    <h2 className="text-lg font-bold text-[var(--color-text)]">
                        Vista previa
                    </h2>

                    <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                        Así se verá la combinación
                        de colores en tu punto de
                        venta.
                    </p>
                </div>

                <div
                    className="p-5 sm:p-8"
                    style={{
                        backgroundColor:
                            configuracionPreview.color_background,
                    }}
                >

                    <div
                        className="overflow-hidden rounded-2xl border shadow-sm"
                        style={{
                            borderColor:
                                configuracionPreview.color_border,
                            backgroundColor:
                                configuracionPreview.color_surface,
                        }}
                    >

                        {/* HEADER PREVIEW */}

                        <div
                            className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"
                            style={{
                                background:
                                    `linear-gradient(135deg, ${configuracionPreview.color_primary}, ${configuracionPreview.color_primary_hover})`,
                            }}
                        >

                            <div>
                                <p className="text-lg font-bold text-white">
                                    Punto de Venta
                                </p>

                                <p className="mt-0.5 text-sm text-white/80">
                                    Vista previa del
                                    sistema
                                </p>
                            </div>

                            <div className="flex items-center gap-3">

                                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-sm font-bold text-white">
                                    {usuario?.nombre
                                        ?.charAt(
                                            0
                                        )
                                        .toUpperCase() ||
                                        "U"}
                                </div>

                                <div>
                                    <p className="text-sm font-semibold text-white">
                                        {
                                            usuario?.nombre
                                        }
                                    </p>

                                    <p className="text-xs text-white/75">
                                        {
                                            usuario?.rol
                                        }
                                    </p>
                                </div>

                            </div>
                        </div>

                        {/* BODY PREVIEW */}

                        <div className="grid gap-4 p-5 sm:grid-cols-3">

                            <div
                                className="rounded-xl border p-4"
                                style={{
                                    borderColor:
                                        configuracionPreview.color_border,
                                    backgroundColor:
                                        configuracionPreview.color_surface,
                                }}
                            >
                                <p
                                    className="text-xs font-semibold uppercase tracking-wide"
                                    style={{
                                        color:
                                            configuracionPreview.color_text_secondary,
                                    }}
                                >
                                    Ventas
                                </p>

                                <p
                                    className="mt-2 text-2xl font-bold"
                                    style={{
                                        color:
                                            configuracionPreview.color_text,
                                    }}
                                >
                                    $2,350.00
                                </p>
                            </div>

                            <div
                                className="rounded-xl border p-4"
                                style={{
                                    borderColor:
                                        configuracionPreview.color_border,
                                    backgroundColor:
                                        configuracionPreview.color_surface,
                                }}
                            >
                                <p
                                    className="text-xs font-semibold uppercase tracking-wide"
                                    style={{
                                        color:
                                            configuracionPreview.color_text_secondary,
                                    }}
                                >
                                    Productos
                                </p>

                                <p
                                    className="mt-2 text-2xl font-bold"
                                    style={{
                                        color:
                                            configuracionPreview.color_text,
                                    }}
                                >
                                    128
                                </p>
                            </div>

                            <div
                                className="rounded-xl border p-4"
                                style={{
                                    borderColor:
                                        configuracionPreview.color_border,
                                    backgroundColor:
                                        configuracionPreview.color_surface,
                                }}
                            >
                                <p
                                    className="text-xs font-semibold uppercase tracking-wide"
                                    style={{
                                        color:
                                            configuracionPreview.color_text_secondary,
                                    }}
                                >
                                    Estado
                                </p>

                                <div className="mt-2">
                                    <span
                                        className="inline-flex rounded-full px-3 py-1 text-xs font-bold text-white"
                                        style={{
                                            backgroundColor:
                                                configuracionPreview.color_primary,
                                        }}
                                    >
                                        Activo
                                    </span>
                                </div>
                            </div>

                        </div>

                        {/* BUTTONS PREVIEW */}

                        <div className="flex flex-col gap-3 border-t p-5 sm:flex-row">
                            <button
                                type="button"
                                className="rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-sm"
                                style={{
                                    background:
                                        `linear-gradient(135deg, ${configuracionPreview.color_primary}, ${configuracionPreview.color_primary_hover})`,
                                }}
                            >
                                Acción principal
                            </button>

                            <button
                                type="button"
                                className="rounded-xl border px-4 py-3 text-sm font-semibold"
                                style={{
                                    borderColor:
                                        configuracionPreview.color_border,
                                    color:
                                        configuracionPreview.color_text,
                                    backgroundColor:
                                        configuracionPreview.color_surface,
                                }}
                            >
                                Acción secundaria
                            </button>

                            <button
                                type="button"
                                className="rounded-xl px-4 py-3 text-sm font-semibold text-white"
                                style={{
                                    backgroundColor:
                                        configuracionPreview.color_danger,
                                }}
                            >
                                Acción de riesgo
                            </button>
                        </div>
                    </div>
                </div>
            </Card>

            {/* ==================================================
                RESUMEN DE COLORES
            ================================================== */}

            <Card className="p-5 sm:p-6">

                <div>
                    <h2 className="text-lg font-bold text-[var(--color-text)]">
                        Colores generados
                    </h2>

                    <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                        El sistema genera
                        automáticamente los colores
                        complementarios a partir del
                        color principal.
                    </p>
                </div>

                <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">

                    {[
                        {
                            nombre:
                                "Principal",
                            color:
                                configuracionPreview.color_primary,
                        },
                        {
                            nombre:
                                "Principal hover",
                            color:
                                configuracionPreview.color_primary_hover,
                        },
                        {
                            nombre:
                                "Secundario",
                            color:
                                configuracionPreview.color_secondary,
                        },
                        {
                            nombre:
                                "Fondo",
                            color:
                                configuracionPreview.color_background,
                        },
                        {
                            nombre:
                                "Borde",
                            color:
                                configuracionPreview.color_border,
                        },
                    ].map(
                        (item) => (
                            <div
                                key={
                                    item.nombre
                                }
                                className="overflow-hidden rounded-xl border border-[var(--color-border)]"
                            >
                                <div
                                    className="h-16"
                                    style={{
                                        backgroundColor:
                                            item.color,
                                    }}
                                />

                                <div className="p-3">
                                    <p className="text-xs font-semibold text-[var(--color-text)]">
                                        {
                                            item.nombre
                                        }
                                    </p>

                                    <p className="mt-1 text-xs font-mono text-[var(--color-text-secondary)]">
                                        {
                                            item.color
                                        }
                                    </p>
                                </div>
                            </div>
                        )
                    )}

                </div>
            </Card>

            {/* ==================================================
                ACCIONES
            ================================================== */}

            <div className="flex flex-col gap-3 border-t border-[var(--color-border)] pt-2 sm:flex-row sm:items-center sm:justify-end">

                <button
                    type="button"
                    onClick={
                        restaurarConfiguracion
                    }
                    disabled={
                        guardando
                    }
                    className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-3 text-sm font-semibold text-[var(--color-text)] transition hover:bg-[var(--color-background)] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                >
                    Restaurar
                </button>

                <button
                    type="button"
                    onClick={
                        guardarConfiguracion
                    }
                    disabled={
                        guardando
                    }
                    className="w-full rounded-xl px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
                    style={{
                        background:
                            `linear-gradient(135deg, ${configuracionPreview.color_primary}, ${configuracionPreview.color_primary_hover})`,
                    }}
                >
                    {guardando
                        ? "Guardando..."
                        : "Guardar apariencia"}
                </button>

            </div>
        </div>
    );
}