"use client";

import { useRouter } from "next/navigation";

export default function ConfiguracionPage() {
    const router = useRouter();
    return (
        <div className="min-h-screen bg-[var(--color-background)] p-4 md:p-6">
            <div className="mx-auto max-w-5xl">

                {/* ENCABEZADO */}
                <div className="mb-7">
                    <h1 className="text-2xl font-bold tracking-tight text-[var(--color-text)] md:text-3xl">
                        Configuración
                    </h1>

                    <p className="mt-1.5 text-sm text-[var(--color-text-secondary)]">
                        Administra las opciones de configuración del punto de venta.
                    </p>
                </div>

                {/* OPCIONES */}
                <div className="grid gap-5 md:grid-cols-2">

                    {/* IMPRESORAS */}
                    <button
                        type="button"
                        onClick={() =>
                            router.push("/pos/sistema/configuracion/impresoras")
                        }
                        className="
                        group
                        rounded-2xl
                        border border-[var(--color-border)]
                        bg-[var(--color-surface)]
                        p-5
                        text-left
                        shadow-sm
                        transition-all
                        duration-200
                        hover:-translate-y-0.5
                        hover:shadow-md
                        active:translate-y-0
                        focus:outline-none
                        focus:ring-2
                        focus:ring-[var(--color-primary)]
                        focus:ring-offset-2
                        focus:ring-offset-[var(--color-background)]
                    "
                    >
                        <div className="flex items-center gap-4">

                            <div
                                className="
                                flex h-14 w-14 shrink-0
                                items-center justify-center
                                rounded-xl
                                border border-[var(--color-border)]
                                bg-[var(--color-background)]
                                text-3xl
                                transition-colors
                                group-hover:border-[var(--color-primary)]
                            "
                            >
                                🖨️
                            </div>

                            <div className="min-w-0 flex-1">
                                <h2 className="text-lg font-semibold text-[var(--color-text)]">
                                    Impresoras
                                </h2>

                                <p className="mt-1 text-sm leading-5 text-[var(--color-text-secondary)]">
                                    Configuración y pruebas de impresión de tickets.
                                </p>
                            </div>

                            <div
                                className="
                                shrink-0
                                text-xl
                                text-[var(--color-text-secondary)]
                                transition-all
                                duration-200
                                group-hover:translate-x-1
                                group-hover:text-[var(--color-primary)]
                            "
                                aria-hidden="true"
                            >
                                →
                            </div>
                        </div>
                    </button>

                    {/* APARIENCIA */}
                    <button
                        type="button"
                        onClick={() =>
                            router.push("/pos/sistema/configuracion/apariencia")
                        }
                        className="
                        group
                        rounded-2xl
                        border border-[var(--color-border)]
                        bg-[var(--color-surface)]
                        p-5
                        text-left
                        shadow-sm
                        transition-all
                        duration-200
                        hover:-translate-y-0.5
                        hover:shadow-md
                        active:translate-y-0
                        focus:outline-none
                        focus:ring-2
                        focus:ring-[var(--color-primary)]
                        focus:ring-offset-2
                        focus:ring-offset-[var(--color-background)]
                    "
                    >
                        <div className="flex items-center gap-4">

                            <div
                                className="
                                flex h-14 w-14 shrink-0
                                items-center justify-center
                                rounded-xl
                                border border-[var(--color-border)]
                                bg-[var(--color-background)]
                                text-3xl
                                transition-colors
                                group-hover:border-[var(--color-primary)]
                            "
                            >
                                🎨
                            </div>

                            <div className="min-w-0 flex-1">
                                <h2 className="text-lg font-semibold text-[var(--color-text)]">
                                    Apariencia
                                </h2>

                                <p className="mt-1 text-sm leading-5 text-[var(--color-text-secondary)]">
                                    Personaliza los colores, botones, tarjetas y apariencia del POS.
                                </p>
                            </div>

                            <div
                                className="
                                shrink-0
                                text-xl
                                text-[var(--color-text-secondary)]
                                transition-all
                                duration-200
                                group-hover:translate-x-1
                                group-hover:text-[var(--color-primary)]
                            "
                                aria-hidden="true"
                            >
                                →
                            </div>
                        </div>
                    </button>

                </div>
            </div>
        </div>
    );
}
