"use client";

import { useEffect } from "react";

import { supabase } from "../../lib/supabase";

import { obtenerUsuarioActual } from "../../lib/auth/roleGuard";

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

const valoresPorDefecto: ConfiguracionApariencia = {
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

function aplicarTema(
    config: ConfiguracionApariencia
) {
    const root = document.documentElement;

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

    root.dataset.theme = config.modo;
}

function obtenerTemaLocal(
    negocioId: string
) {
    try {
        const guardado =
            localStorage.getItem(
                `apariencia_${negocioId}`
            );

        if (!guardado) {
            return null;
        }

        return JSON.parse(
            guardado
        ) as ConfiguracionApariencia;
    } catch (error) {
        console.error(
            "Error leyendo apariencia local:",
            error
        );

        return null;
    }
}

function guardarTemaLocal(
    negocioId: string,
    config: ConfiguracionApariencia
) {
    try {
        localStorage.setItem(
            `apariencia_${negocioId}`,
            JSON.stringify(config)
        );
    } catch (error) {
        console.error(
            "Error guardando apariencia local:",
            error
        );
    }
}

export default function ThemeProvider({
    children,
}: {
    children: React.ReactNode;
}) {
    /*
     * Aplicamos inmediatamente el último tema conocido
     * antes de consultar Supabase.
     *
     * Esto evita que aparezca momentáneamente el azul
     * predeterminado al cambiar entre módulos.
     */
    useEffect(() => {
        let cancelado = false;

        async function cargarTema() {
            try {
                const usuario =
                    await obtenerUsuarioActual();

                if (
                    cancelado ||
                    !usuario?.negocio_id
                ) {
                    return;
                }

                const negocioId =
                    usuario.negocio_id;

                /*
                 * 1. Aplicar inmediatamente
                 * el tema guardado localmente.
                 */
                const temaLocal =
                    obtenerTemaLocal(
                        negocioId
                    );

                if (
                    temaLocal &&
                    !cancelado
                ) {
                    aplicarTema(
                        {
                            ...valoresPorDefecto,
                            ...temaLocal,
                        }
                    );
                }

                /*
                 * 2. Consultar Supabase para
                 * comprobar la configuración real.
                 */
                const {
                    data,
                    error,
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
                        negocioId
                    )
                    .maybeSingle();

                if (error) {
                    console.error(
                        "Error cargando configuración de apariencia:",
                        error
                    );

                    return;
                }

                if (
                    cancelado ||
                    !data
                ) {
                    return;
                }

                const configuracion = {
                    ...valoresPorDefecto,
                    ...data,
                } as ConfiguracionApariencia;

                /*
                 * 3. Aplicar configuración
                 * definitiva de Supabase.
                 */
                aplicarTema(
                    configuracion
                );

                /*
                 * 4. Guardarla localmente para
                 * futuros cambios de módulo.
                 */
                guardarTemaLocal(
                    negocioId,
                    configuracion
                );
            } catch (error) {
                console.error(
                    "Error cargando tema global:",
                    error
                );
            }
        }

        cargarTema();

        return () => {
            cancelado = true;
        };
    }, []);

    return <>{children}</>;
}