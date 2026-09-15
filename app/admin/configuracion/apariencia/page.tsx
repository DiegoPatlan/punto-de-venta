"use client";

import {
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";

import Card from "../../../components/Card";

import { supabase } from "../../../../lib/supabase";

import { obtenerUsuarioActual } from "../../../../lib/auth/roleGuard";

interface UsuarioActual {
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
 * LOGO DEL NEGOCIO
 */
const LOGO_BUCKET = "logos-negocios";
const LOGO_PATH = "logo";
const LOGO_MAX_SIZE = 3 * 1024 * 1024;

const TIPOS_LOGO_PERMITIDOS = [
    "image/jpeg",
    "image/png",
    "image/webp",
];

/*
 * FOTO DEL USUARIO
 */
const FOTO_BUCKET = "fotos-usuarios";
const FOTO_PATH = "foto";
const FOTO_MAX_SIZE = 3 * 1024 * 1024;

const TIPOS_FOTO_PERMITIDOS = [
    "image/jpeg",
    "image/png",
    "image/webp",
];

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
            Math.min(255, Math.round(valor))
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
        rgb1.r + (rgb2.r - rgb1.r) * p,
        rgb1.g + (rgb2.g - rgb1.g) * p,
        rgb1.b + (rgb2.b - rgb1.b) * p
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

function generarConfiguracion(
    colorPrincipal: string
): ConfiguracionApariencia {
    const primary =
        colorPrincipal.toUpperCase();

    const hover = oscurecerColor(
        primary,
        0.22
    );

    const secondary = oscurecerColor(
        primary,
        0.48
    );

    const background = aclararColor(
        primary,
        0.965
    );

    const surface = "#ffffff";

    const border = aclararColor(
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

export default function AparienciaPage() {
    const [usuario, setUsuario] =
        useState<UsuarioActual | null>(null);

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
     * ============================================================
     * LOGO DEL NEGOCIO
     * ============================================================
     */

    const [logoUrl, setLogoUrl] =
        useState<string | null>(null);

    const [logoPreview, setLogoPreview] =
        useState<string | null>(null);

    const [logoArchivo, setLogoArchivo] =
        useState<File | null>(null);

    const [subiendoLogo, setSubiendoLogo] =
        useState(false);

    const [eliminandoLogo, setEliminandoLogo] =
        useState(false);

    const [confirmandoEliminarLogo, setConfirmandoEliminarLogo] =
        useState(false);

    const inputLogoRef =
        useRef<HTMLInputElement | null>(null);

    /*
     * ============================================================
     * FOTO DEL USUARIO
     * ============================================================
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
     * ============================================================
     * CONFIGURACIÓN PREVIEW
     * ============================================================
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
     * ============================================================
     * CARGAR CONFIGURACIÓN
     * ============================================================
     */

    useEffect(() => {
        let cancelado = false;

        async function cargarConfiguracion() {
            setCargando(true);
            setError("");

            try {
                const datosUsuario =
                    (await obtenerUsuarioActual()) as
                    | UsuarioActual
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
                 * ====================================================
                 * CARGAR CONFIGURACIÓN DE APARIENCIA
                 * ====================================================
                 */

                const {
                    data,
                    error: errorConfiguracion,
                } = await supabase
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
                 * ====================================================
                 * CARGAR LOGO DEL NEGOCIO
                 * ====================================================
                 */

                const {
                    data: negocio,
                    error: errorNegocio,
                } = await supabase
                    .from("negocios")
                    .select("logo_url")
                    .eq(
                        "id",
                        datosUsuario.negocio_id
                    )
                    .maybeSingle();

                if (errorNegocio) {
                    console.error(
                        "Error cargando logo del negocio:",
                        errorNegocio
                    );
                } else if (
                    negocio?.logo_url
                ) {
                    setLogoUrl(
                        negocio.logo_url
                    );

                    setLogoPreview(
                        negocio.logo_url
                    );
                } else {
                    setLogoUrl(null);
                    setLogoPreview(null);
                }

                /*
                 * ====================================================
                 * CARGAR FOTO DEL USUARIO
                 * ====================================================
                 */

                const {
                    data: usuarioFoto,
                    error: errorFoto,
                } = await supabase
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
     * ============================================================
     * ACTUALIZAR VISTA PREVIA DE COLORES
     * ============================================================
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
     * ============================================================
     * LIMPIAR URL TEMPORAL DEL LOGO
     * ============================================================
     */

    useEffect(() => {
        return () => {
            if (
                logoPreview &&
                logoPreview.startsWith(
                    "blob:"
                )
            ) {
                URL.revokeObjectURL(
                    logoPreview
                );
            }
        };
    }, [logoPreview]);

    /*
     * ============================================================
     * LIMPIAR URL TEMPORAL DE FOTO
     * ============================================================
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
     * ============================================================
     * COLORES
     * ============================================================
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
     * ============================================================
     * SELECCIONAR LOGO
     * ============================================================
     */

    function seleccionarLogo(
        archivo: File | null
    ) {
        setError("");
        setMensajeExito("");

        if (!archivo) {
            return;
        }

        if (
            !TIPOS_LOGO_PERMITIDOS.includes(
                archivo.type
            )
        ) {
            setError(
                "El logo debe estar en formato PNG, JPG, JPEG o WEBP."
            );

            if (inputLogoRef.current) {
                inputLogoRef.current.value =
                    "";
            }

            return;
        }

        if (
            archivo.size >
            LOGO_MAX_SIZE
        ) {
            setError(
                "El logo no puede superar los 3 MB."
            );

            if (inputLogoRef.current) {
                inputLogoRef.current.value =
                    "";
            }

            return;
        }

        if (
            logoPreview &&
            logoPreview.startsWith(
                "blob:"
            )
        ) {
            URL.revokeObjectURL(
                logoPreview
            );
        }

        const nuevaPreview =
            URL.createObjectURL(
                archivo
            );

        setLogoArchivo(archivo);

        setLogoPreview(
            nuevaPreview
        );
    }

    /*
     * ============================================================
     * SUBIR LOGO
     * ============================================================
     */

    async function subirLogo() {
        if (
            subiendoLogo ||
            eliminandoLogo ||
            !usuario?.negocio_id ||
            !logoArchivo
        ) {
            return;
        }

        setSubiendoLogo(true);
        setError("");
        setMensajeExito("");

        try {
            const negocioId =
                usuario.negocio_id;

            const rutaLogo =
                `${negocioId}/${LOGO_PATH}`;

            const {
                error: errorUpload,
            } = await supabase.storage
                .from(LOGO_BUCKET)
                .upload(
                    rutaLogo,
                    logoArchivo,
                    {
                        upsert: true,
                        contentType:
                            logoArchivo.type,
                        cacheControl:
                            "3600",
                    }
                );

            if (errorUpload) {
                console.error(
                    "Error subiendo logo:",
                    errorUpload
                );

                setError(
                    errorUpload.message ||
                    "No se pudo subir el logo del negocio."
                );

                return;
            }

            const {
                data: publicUrlData,
            } = supabase.storage
                .from(LOGO_BUCKET)
                .getPublicUrl(
                    rutaLogo
                );

            if (
                !publicUrlData?.publicUrl
            ) {
                setError(
                    "El logo fue subido, pero no se pudo obtener su URL pública."
                );

                return;
            }

            const nuevaUrl =
                `${publicUrlData.publicUrl}?v=${Date.now()}`;

            const {
                error: errorNegocio,
            } = await supabase
                .from("negocios")
                .update({
                    logo_url:
                        nuevaUrl,
                })
                .eq(
                    "id",
                    negocioId
                );

            if (errorNegocio) {
                console.error(
                    "Error guardando logo en negocio:",
                    errorNegocio
                );

                setError(
                    errorNegocio.message ||
                    "El logo fue subido, pero no se pudo guardar en el negocio."
                );

                return;
            }

            setLogoUrl(nuevaUrl);
            setLogoPreview(nuevaUrl);
            setLogoArchivo(null);

            if (inputLogoRef.current) {
                inputLogoRef.current.value =
                    "";
            }

            if (
                typeof window !==
                "undefined"
            ) {
                window.dispatchEvent(
                    new CustomEvent(
                        "negocio-logo-actualizado",
                        {
                            detail: {
                                logoUrl:
                                    nuevaUrl,
                            },
                        }
                    )
                );
            }

            setMensajeExito(
                "El logo del negocio fue actualizado correctamente."
            );

            setTimeout(() => {
                setMensajeExito("");
            }, 5000);
        } catch (error) {
            console.error(
                "Error inesperado subiendo logo:",
                error
            );

            setError(
                "Ocurrió un error al actualizar el logo del negocio."
            );
        } finally {
            setSubiendoLogo(false);
        }
    }

    /*
     * ============================================================
     * ELIMINAR LOGO
     * ============================================================
     */

    async function eliminarLogo() {
        if (
            eliminandoLogo ||
            subiendoLogo ||
            !usuario?.negocio_id
        ) {
            return;
        }

        if (!logoUrl) {
            return;
        }

        setEliminandoLogo(true);
        setError("");
        setMensajeExito("");

        try {
            const negocioId =
                usuario.negocio_id;

            const rutaLogo =
                `${negocioId}/${LOGO_PATH}`;

            const {
                error: errorStorage,
            } = await supabase.storage
                .from(LOGO_BUCKET)
                .remove([
                    rutaLogo,
                ]);

            if (errorStorage) {
                console.error(
                    "Error eliminando logo del Storage:",
                    errorStorage
                );

                setError(
                    errorStorage.message ||
                    "No se pudo eliminar el archivo del logo."
                );

                return;
            }

            const {
                error: errorNegocio,
            } = await supabase
                .from("negocios")
                .update({
                    logo_url: null,
                })
                .eq(
                    "id",
                    negocioId
                );

            if (errorNegocio) {
                console.error(
                    "Error eliminando referencia del logo:",
                    errorNegocio
                );

                setError(
                    errorNegocio.message ||
                    "El archivo fue eliminado, pero no se pudo actualizar el negocio."
                );

                return;
            }

            setLogoUrl(null);
            setLogoPreview(null);
            setLogoArchivo(null);
            setConfirmandoEliminarLogo(
                false
            );

            if (inputLogoRef.current) {
                inputLogoRef.current.value =
                    "";
            }

            if (
                typeof window !==
                "undefined"
            ) {
                window.dispatchEvent(
                    new CustomEvent(
                        "negocio-logo-actualizado",
                        {
                            detail: {
                                logoUrl:
                                    null,
                            },
                        }
                    )
                );
            }

            setMensajeExito(
                "El logo del negocio fue eliminado correctamente."
            );

            setTimeout(() => {
                setMensajeExito("");
            }, 5000);
        } catch (error) {
            console.error(
                "Error inesperado eliminando logo:",
                error
            );

            setError(
                "Ocurrió un error al eliminar el logo del negocio."
            );
        } finally {
            setEliminandoLogo(false);
        }
    }

    /*
     * ============================================================
     * SELECCIONAR FOTO DEL USUARIO
     * ============================================================
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
                "La foto debe estar en formato PNG, JPG, JPEG o WEBP."
            );

            if (inputFotoRef.current) {
                inputFotoRef.current.value =
                    "";
            }

            return;
        }

        if (
            archivo.size >
            FOTO_MAX_SIZE
        ) {
            setError(
                "La foto no puede superar los 3 MB."
            );

            if (inputFotoRef.current) {
                inputFotoRef.current.value =
                    "";
            }

            return;
        }

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

        const nuevaPreview =
            URL.createObjectURL(
                archivo
            );

        setFotoArchivo(archivo);

        setFotoPreview(
            nuevaPreview
        );

        setConfirmandoEliminarFoto(
            false
        );
    }

    /*
     * ============================================================
     * SUBIR FOTO DEL USUARIO
     * ============================================================
     */

    async function subirFoto() {
        if (
            subiendoFoto ||
            eliminandoFoto ||
            !usuario?.id ||
            !fotoArchivo
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
             * Subir/reemplazar foto.
             */

            const {
                error: errorUpload,
            } = await supabase.storage
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

            if (errorUpload) {
                console.error(
                    "Error subiendo foto:",
                    errorUpload
                );

                setError(
                    errorUpload.message ||
                    "No se pudo subir la foto del usuario."
                );

                return;
            }

            /*
             * Obtener URL pública.
             */

            const {
                data: publicUrlData,
            } = supabase.storage
                .from(FOTO_BUCKET)
                .getPublicUrl(
                    rutaFoto
                );

            if (
                !publicUrlData?.publicUrl
            ) {
                setError(
                    "La foto fue subida, pero no se pudo obtener su URL pública."
                );

                return;
            }

            /*
             * Cache bust.
             */

            const nuevaUrl =
                `${publicUrlData.publicUrl}?v=${Date.now()}`;

            /*
             * Guardar URL en usuarios.
             */

            const {
                error: errorUsuario,
            } = await supabase
                .from("usuarios")
                .update({
                    foto_url:
                        nuevaUrl,
                })
                .eq(
                    "id",
                    usuarioId
                );

            if (errorUsuario) {
                console.error(
                    "Error guardando foto del usuario:",
                    errorUsuario
                );

                setError(
                    errorUsuario.message ||
                    "La foto fue subida, pero no se pudo guardar en el usuario."
                );

                return;
            }

            /*
             * Actualizar estado.
             */

            setFotoUrl(nuevaUrl);
            setFotoPreview(nuevaUrl);
            setFotoArchivo(null);

            if (inputFotoRef.current) {
                inputFotoRef.current.value =
                    "";
            }

            /*
             * Avisar al resto del sistema.
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
                                    nuevaUrl,
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
                "Ocurrió un error al actualizar tu foto de perfil."
            );
        } finally {
            setSubiendoFoto(false);
        }
    }

    /*
     * ============================================================
     * ELIMINAR FOTO DEL USUARIO
     * ============================================================
     */

    async function eliminarFoto() {
        if (
            eliminandoFoto ||
            subiendoFoto ||
            !usuario?.id
        ) {
            return;
        }

        if (!fotoUrl) {
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
                error: errorStorage,
            } = await supabase.storage
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
             * Eliminar referencia de usuarios.
             */

            const {
                error: errorUsuario,
            } = await supabase
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
     * ============================================================
     * GUARDAR CONFIGURACIÓN DE COLORES
     * ============================================================
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
                error: errorUpdate,
            } = await supabase
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
     * ============================================================
     * RESTAURAR CONFIGURACIÓN
     * ============================================================
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
     * ============================================================
     * CARGANDO
     * ============================================================
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
     * ============================================================
     * RENDER
     * ============================================================
     */

    return (
        <div className="space-y-6">
            {/*
             * ======================================================
             * MENSAJES
             * ======================================================
             */}

            {mensajeExito && (
                <div className="fixed right-4 top-4 z-[100] w-[calc(100%-2rem)] max-w-md">
                    <div className="rounded-2xl border border-green-200 bg-white p-4 shadow-2xl">
                        <div className="flex items-start gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-100 text-lg">
                                ✓
                            </div>

                            <div className="min-w-0 flex-1">
                                <p className="font-semibold text-green-800">
                                    Apariencia
                                    actualizada
                                </p>

                                <p className="mt-1 text-sm leading-5 text-green-700">
                                    {mensajeExito}
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={() =>
                                    setMensajeExito(
                                        ""
                                    )
                                }
                                className="rounded-lg px-2 py-1 text-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                            >
                                ×
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {error && (
                <div className="fixed right-4 top-4 z-[100] w-[calc(100%-2rem)] max-w-md">
                    <div className="rounded-2xl border border-red-200 bg-white p-4 shadow-2xl">
                        <div className="flex items-start gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-lg">
                                !
                            </div>

                            <div className="min-w-0 flex-1">
                                <p className="font-semibold text-red-800">
                                    Ocurrió un
                                    error
                                </p>

                                <p className="mt-1 text-sm leading-5 text-red-700">
                                    {error}
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={() =>
                                    setError(
                                        ""
                                    )
                                }
                                className="rounded-lg px-2 py-1 text-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                            >
                                ×
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/*
             * ======================================================
             * ENCABEZADO
             * ======================================================
             */}

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

            {/*
             * ======================================================
             * FOTO DEL USUARIO
             * ======================================================
             *
             * Solo admin y encargado.
             */}

            {(usuario?.rol === "admin" ||
                usuario?.rol ===
                "encargado") && (
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
                            {/*
                         * PREVISUALIZACIÓN
                         */}

                            <div className="flex h-32 w-32 shrink-0 items-center justify-center overflow-hidden rounded-full border-4 border-[var(--color-border)] bg-[var(--color-background)] shadow-sm">
                                {fotoPreview ? (
                                    <img
                                        src={
                                            fotoPreview
                                        }
                                        alt={`Foto de ${usuario?.nombre || "usuario"}`}
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

                            {/*
                         * CONTROLES
                         */}

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
                                        <button
                                            type="button"
                                            onClick={() => {
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

                                                setFotoArchivo(
                                                    null
                                                );

                                                setFotoPreview(
                                                    fotoUrl
                                                );

                                                if (
                                                    inputFotoRef.current
                                                ) {
                                                    inputFotoRef.current.value =
                                                        "";
                                                }

                                                setError(
                                                    ""
                                                );
                                            }}
                                            disabled={
                                                subiendoFoto ||
                                                eliminandoFoto
                                            }
                                            className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm font-semibold text-[var(--color-text)] transition hover:bg-[var(--color-background)] disabled:cursor-not-allowed disabled:opacity-60"
                                        >
                                            Cancelar
                                        </button>
                                    )}

                                    {fotoUrl &&
                                        !fotoArchivo &&
                                        !confirmandoEliminarFoto && (
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setConfirmandoEliminarFoto(
                                                        true
                                                    )
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
                                    ref={
                                        inputFotoRef
                                    }
                                    type="file"
                                    accept="image/png,image/jpeg,image/webp"
                                    className="hidden"
                                    onChange={(e) =>
                                        seleccionarFoto(
                                            e
                                                .target
                                                .files?.[0] ||
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

                                            <button
                                                type="button"
                                                onClick={
                                                    subirFoto
                                                }
                                                disabled={
                                                    subiendoFoto ||
                                                    eliminandoFoto
                                                }
                                                className="w-full rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                                                style={{
                                                    background:
                                                        `linear-gradient(135deg, ${configuracionPreview.color_primary}, ${configuracionPreview.color_primary_hover})`,
                                                }}
                                            >
                                                {subiendoFoto
                                                    ? "Subiendo..."
                                                    : "Guardar foto"}
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/*
                             * CONFIRMACIÓN DE ELIMINACIÓN
                             */}

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
                                                className="rounded-xl bg-[var(--color-danger)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                                            >
                                                {eliminandoFoto
                                                    ? "Eliminando..."
                                                    : "Sí, eliminar foto"}
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
                )}

            {/*
             * ======================================================
             * LOGO DEL NEGOCIO
             * ======================================================
             */}

            <Card className="p-5 sm:p-6">
                <div>
                    <h2 className="text-lg font-bold text-[var(--color-text)]">
                        Logo del negocio
                    </h2>

                    <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                        Este logo aparecerá en
                        el encabezado del sistema
                        junto al nombre de tu
                        negocio.
                    </p>
                </div>

                <div className="mt-6 flex flex-col gap-6 md:flex-row md:items-center">
                    {/*
                     * PREVISUALIZACIÓN
                     */}

                    <div className="flex h-32 w-32 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)] shadow-sm">
                        {logoPreview ? (
                            <img
                                src={
                                    logoPreview
                                }
                                alt={`Logo de ${usuario?.nombre ||
                                    "negocio"
                                    }`}
                                className="h-full w-full object-contain p-2"
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
                                    "N"}
                            </div>
                        )}
                    </div>

                    {/*
                     * CONTROLES
                     */}

                    <div className="min-w-0 flex-1">
                        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                            <button
                                type="button"
                                onClick={() =>
                                    inputLogoRef.current?.click()
                                }
                                disabled={
                                    subiendoLogo ||
                                    eliminandoLogo
                                }
                                className="rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
                                style={{
                                    background:
                                        `linear-gradient(135deg, ${configuracionPreview.color_primary}, ${configuracionPreview.color_primary_hover})`,
                                }}
                            >
                                {logoArchivo
                                    ? "Cambiar imagen"
                                    : logoUrl
                                        ? "Cambiar logo"
                                        : "Seleccionar logo"}
                            </button>

                            {logoArchivo && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (
                                            logoPreview &&
                                            logoPreview.startsWith(
                                                "blob:"
                                            )
                                        ) {
                                            URL.revokeObjectURL(
                                                logoPreview
                                            );
                                        }

                                        setLogoArchivo(
                                            null
                                        );

                                        setLogoPreview(
                                            logoUrl
                                        );

                                        if (
                                            inputLogoRef.current
                                        ) {
                                            inputLogoRef.current.value =
                                                "";
                                        }

                                        setError(
                                            ""
                                        );
                                    }}
                                    disabled={
                                        subiendoLogo ||
                                        eliminandoLogo
                                    }
                                    className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm font-semibold text-[var(--color-text)] transition hover:bg-[var(--color-background)] disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    Cancelar
                                </button>
                            )}

                            {logoUrl &&
                                !logoArchivo &&
                                !confirmandoEliminarLogo && (
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setConfirmandoEliminarLogo(
                                                true
                                            )
                                        }
                                        disabled={
                                            subiendoLogo ||
                                            eliminandoLogo
                                        }
                                        className="rounded-xl border border-red-200 bg-white px-4 py-3 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        Eliminar logo
                                    </button>
                                )}
                        </div>

                        <input
                            ref={
                                inputLogoRef
                            }
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            className="hidden"
                            onChange={(e) =>
                                seleccionarLogo(
                                    e
                                        .target
                                        .files?.[0] ||
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

                        {logoArchivo && (
                            <div className="mt-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] p-3">
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-semibold text-[var(--color-text)]">
                                            {
                                                logoArchivo.name
                                            }
                                        </p>

                                        <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                                            {(
                                                logoArchivo.size /
                                                1024 /
                                                1024
                                            ).toFixed(
                                                2
                                            )}{" "}
                                            MB
                                        </p>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={
                                            subirLogo
                                        }
                                        disabled={
                                            subiendoLogo ||
                                            eliminandoLogo
                                        }
                                        className="w-full rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                                        style={{
                                            background:
                                                `linear-gradient(135deg, ${configuracionPreview.color_primary}, ${configuracionPreview.color_primary_hover})`,
                                        }}
                                    >
                                        {subiendoLogo
                                            ? "Subiendo..."
                                            : "Guardar logo"}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/*
                         * CONFIRMACIÓN DE ELIMINACIÓN
                         */}

                        {confirmandoEliminarLogo && (
                            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4">
                                <p className="text-sm font-semibold text-red-800">
                                    ¿Eliminar el logo
                                    del negocio?
                                </p>

                                <p className="mt-1 text-sm leading-5 text-red-700">
                                    El logo se
                                    eliminará
                                    permanentemente
                                    del negocio.
                                </p>

                                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                                    <button
                                        type="button"
                                        onClick={
                                            eliminarLogo
                                        }
                                        disabled={
                                            eliminandoLogo
                                        }
                                        className="rounded-xl bg-[var(--color-danger)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        {eliminandoLogo
                                            ? "Eliminando..."
                                            : "Sí, eliminar logo"}
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() =>
                                            setConfirmandoEliminarLogo(
                                                false
                                            )
                                        }
                                        disabled={
                                            eliminandoLogo
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

            {/*
             * ======================================================
             * PALETAS
             * ======================================================
             */}

            <Card className="p-5 sm:p-6">
                <div>
                    <h2 className="text-lg font-bold text-[var(--color-text)]">
                        Elige el color de tu
                        negocio
                    </h2>

                    <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                        Selecciona una paleta
                        prediseñada o utiliza
                        cualquier color
                        personalizado.
                    </p>
                </div>

                <div className="mt-6 grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-9">
                    {PALETAS.map(
                        (paleta) => {
                            const seleccionada =
                                colorPrincipal.toLowerCase() ===
                                paleta.color.toLowerCase();

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
                                    disabled={
                                        guardando
                                    }
                                    className="group flex flex-col items-center gap-2 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    <span
                                        className={`relative flex h-14 w-14 items-center justify-center rounded-2xl shadow-sm transition duration-200 group-hover:scale-105 group-hover:shadow-md ${seleccionada
                                            ? "ring-4 ring-[var(--color-primary)] ring-offset-2"
                                            : ""
                                            }`}
                                        style={{
                                            background:
                                                `linear-gradient(135deg, ${paleta.color}, ${oscurecerColor(
                                                    paleta.color,
                                                    0.25
                                                )})`,
                                        }}
                                    >
                                        {seleccionada && (
                                            <span className="text-xl font-bold text-white">
                                                ✓
                                            </span>
                                        )}
                                    </span>

                                    <span className="text-xs font-medium text-[var(--color-text-secondary)]">
                                        {
                                            paleta.nombre
                                        }
                                    </span>
                                </button>
                            );
                        }
                    )}
                </div>
            </Card>

            {/*
             * ======================================================
             * COLOR PERSONALIZADO
             * ======================================================
             */}

            <Card className="p-5 sm:p-6">
                <div>
                    <h2 className="text-lg font-bold text-[var(--color-text)]">
                        Color personalizado
                    </h2>

                    <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                        Utiliza el color exacto de
                        la identidad de tu
                        negocio.
                    </p>
                </div>

                <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-center">
                    <input
                        type="color"
                        value={
                            /^#[0-9A-Fa-f]{6}$/.test(
                                colorPrincipal
                            )
                                ? colorPrincipal
                                : "#2563eb"
                        }
                        onChange={(e) =>
                            seleccionarColor(
                                e.target.value
                            )
                        }
                        disabled={
                            guardando
                        }
                        className="h-14 w-20 cursor-pointer rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-1"
                    />

                    <div className="flex-1">
                        <label className="mb-2 block text-sm font-semibold text-[var(--color-text)]">
                            Código HEX
                        </label>

                        <input
                            type="text"
                            value={
                                colorPrincipal
                            }
                            onChange={(e) =>
                                cambiarColorPersonalizado(
                                    e.target.value
                                )
                            }
                            maxLength={7}
                            disabled={
                                guardando
                            }
                            className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm font-medium uppercase text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20 sm:max-w-xs"
                            placeholder="#2563EB"
                        />
                    </div>

                    <div
                        className="h-14 w-full rounded-xl shadow-sm sm:w-32"
                        style={{
                            background:
                                `linear-gradient(135deg, ${configuracionPreview.color_primary}, ${configuracionPreview.color_primary_hover})`,
                        }}
                    />
                </div>
            </Card>

            {/*
             * ======================================================
             * VISTA PREVIA
             * ======================================================
             */}

            <Card className="overflow-hidden p-0">
                <div className="border-b border-[var(--color-border)] p-5 sm:p-6">
                    <h2 className="text-lg font-bold text-[var(--color-text)]">
                        Vista previa
                    </h2>

                    <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                        Así se verá aproximadamente
                        la identidad visual del
                        sistema.
                    </p>
                </div>

                <div
                    className="p-5 sm:p-8"
                    style={{
                        background:
                            configuracionPreview.color_background,
                    }}
                >
                    <div
                        className="mx-auto max-w-3xl overflow-hidden rounded-3xl border shadow-md"
                        style={{
                            background:
                                configuracionPreview.color_surface,
                            borderColor:
                                configuracionPreview.color_border,
                        }}
                    >
                        {/*
                         * HEADER PREVIEW
                         */}

                        <div
                            className="flex items-center gap-3 border-b p-4 sm:p-5"
                            style={{
                                borderColor:
                                    configuracionPreview.color_border,
                            }}
                        >
                            <div
                                className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl text-lg font-bold text-white"
                                style={{
                                    background:
                                        `linear-gradient(135deg, ${configuracionPreview.color_primary}, ${configuracionPreview.color_primary_hover})`,
                                }}
                            >
                                {logoPreview ? (
                                    <img
                                        src={
                                            logoPreview
                                        }
                                        alt="Vista previa del logo"
                                        className="h-full w-full object-contain"
                                    />
                                ) : (
                                    "T"
                                )}
                            </div>

                            <div>
                                <p
                                    className="font-bold"
                                    style={{
                                        color:
                                            configuracionPreview.color_text,
                                    }}
                                >
                                    Tienda Demo
                                </p>

                                <p
                                    className="text-xs"
                                    style={{
                                        color:
                                            configuracionPreview.color_text_secondary,
                                    }}
                                >
                                    Punto de
                                    venta
                                </p>
                            </div>
                        </div>

                        {/*
                         * BODY PREVIEW
                         */}

                        <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
                            <div
                                className="rounded-2xl border p-5"
                                style={{
                                    borderColor:
                                        configuracionPreview.color_border,
                                    background:
                                        configuracionPreview.color_surface,
                                }}
                            >
                                <p
                                    className="text-sm"
                                    style={{
                                        color:
                                            configuracionPreview.color_text_secondary,
                                    }}
                                >
                                    Ventas del día
                                </p>

                                <p
                                    className="mt-2 text-2xl font-bold"
                                    style={{
                                        color:
                                            configuracionPreview.color_text,
                                    }}
                                >
                                    $2,784.98
                                </p>

                                <div className="mt-5 flex flex-wrap gap-2">
                                    <button
                                        type="button"
                                        className="rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                                        style={{
                                            background:
                                                `linear-gradient(135deg, ${configuracionPreview.color_primary}, ${configuracionPreview.color_primary_hover})`,
                                        }}
                                    >
                                        Nueva
                                        venta
                                    </button>

                                    <button
                                        type="button"
                                        className="rounded-xl border px-4 py-3 text-sm font-semibold transition hover:-translate-y-0.5"
                                        style={{
                                            borderColor:
                                                configuracionPreview.color_border,
                                            color:
                                                configuracionPreview.color_text,
                                            background:
                                                configuracionPreview.color_surface,
                                        }}
                                    >
                                        Ver ventas
                                    </button>
                                </div>
                            </div>

                            <div
                                className="rounded-2xl p-5"
                                style={{
                                    background:
                                        aclararColor(
                                            configuracionPreview.color_primary,
                                            0.92
                                        ),
                                }}
                            >
                                <p
                                    className="text-sm font-medium"
                                    style={{
                                        color:
                                            configuracionPreview.color_secondary,
                                    }}
                                >
                                    Identidad del
                                    negocio
                                </p>

                                <p
                                    className="mt-2 text-sm leading-6"
                                    style={{
                                        color:
                                            configuracionPreview.color_text_secondary,
                                    }}
                                >
                                    El color elegido
                                    genera
                                    automáticamente
                                    los tonos
                                    secundarios,
                                    fondos,
                                    bordes y
                                    degradados.
                                </p>

                                <div className="mt-5 flex items-center gap-2">
                                    <span
                                        className="h-8 w-8 rounded-lg"
                                        style={{
                                            background:
                                                configuracionPreview.color_primary,
                                        }}
                                    />

                                    <span
                                        className="h-8 w-8 rounded-lg"
                                        style={{
                                            background:
                                                configuracionPreview.color_primary_hover,
                                        }}
                                    />

                                    <span
                                        className="h-8 w-8 rounded-lg"
                                        style={{
                                            background:
                                                configuracionPreview.color_secondary,
                                        }}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </Card>

            {/*
             * ======================================================
             * BOTONES
             * ======================================================
             */}

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
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
                    className="w-full rounded-xl px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
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