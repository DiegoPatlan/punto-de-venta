"use client";

import Card from "../../components/Card";

export default function ConfiguracionPage() {
    return (
        <div className="space-y-6">
            {/* ==================================
                ENCABEZADO
            ================================== */}

            <div>
                <h1 className="text-2xl font-bold text-[var(--color-text)] sm:text-3xl">
                    Configuración
                </h1>

                <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                    Administra las opciones generales de tu punto de venta.
                </p>
            </div>

            {/* ==================================
                APARTADOS
            ================================== */}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {/* ==================================
                    FISCAL
                ================================== */}

                <button
                    type="button"
                    onClick={() => {
                        window.location.href =
                            "/admin/configuracion/fiscal";
                    }}
                    className="text-left"
                >
                    <Card className="p-5 transition hover:-translate-y-0.5 hover:shadow-md">
                        <div className="flex items-center gap-4">
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-primary)] text-2xl text-white">
                                🧾
                            </div>

                            <div className="min-w-0 flex-1">
                                <h2 className="font-semibold text-[var(--color-text)]">
                                    Configuración fiscal
                                </h2>

                                <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                                    Impuestos, IVA y precios de productos.
                                </p>
                            </div>

                            <span className="text-xl text-[var(--color-text-secondary)]">
                                →
                            </span>
                        </div>
                    </Card>
                </button>

                {/* ==================================
                    MERCADO PAGO
                ================================== */}

                <button
                    type="button"
                    onClick={() => {
                        window.location.href =
                            "/admin/configuracion/mercadopago";
                    }}
                    className="text-left"
                >
                    <Card className="p-5 transition hover:-translate-y-0.5 hover:shadow-md">
                        <div className="flex items-center gap-4">
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-primary)] text-2xl text-white">
                                💳
                            </div>

                            <div className="min-w-0 flex-1">
                                <h2 className="font-semibold text-[var(--color-text)]">
                                    Mercado Pago
                                </h2>

                                <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                                    Terminales, pagos con tarjeta y recargo por
                                    pago con tarjeta.
                                </p>
                            </div>

                            <span className="text-xl text-[var(--color-text-secondary)]">
                                →
                            </span>
                        </div>
                    </Card>
                </button>

                {/* ==================================
                    DATOS DEL NEGOCIO
                ================================== */}

                <button
                    type="button"
                    disabled
                    className="text-left opacity-60"
                >
                    <Card className="p-5">
                        <div className="flex items-center gap-4">
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-2xl">
                                🏪
                            </div>

                            <div className="min-w-0 flex-1">
                                <h2 className="font-semibold text-[var(--color-text)]">
                                    Datos del negocio
                                </h2>

                                <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                                    Nombre, teléfono, dirección y datos
                                    generales.
                                </p>
                            </div>

                            <span className="text-xs font-medium text-[var(--color-text-secondary)]">
                                Próximamente
                            </span>
                        </div>
                    </Card>
                </button>

                {/* ==================================
                    APARIENCIA
                ================================== */}

                <button
                    type="button"
                    onClick={() => {
                        window.location.href =
                            "/admin/configuracion/apariencia";
                    }}
                    className="text-left"
                >
                    <Card className="p-5 transition hover:-translate-y-0.5 hover:shadow-md">
                        <div className="flex items-center gap-4">
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-primary)] text-2xl text-white">
                                🎨
                            </div>

                            <div className="min-w-0 flex-1">
                                <h2 className="font-semibold text-[var(--color-text)]">
                                    Apariencia
                                </h2>

                                <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                                    Logo, colores y personalización del
                                    sistema.
                                </p>
                            </div>

                            <span className="text-xl text-[var(--color-text-secondary)]">
                                →
                            </span>
                        </div>
                    </Card>
                </button>

                {/* ==================================
                    SUCURSALES
                ================================== */}

                <button
                    type="button"
                    disabled
                    className="text-left opacity-60"
                >
                    <Card className="p-5">
                        <div className="flex items-center gap-4">
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-2xl">
                                🏬
                            </div>

                            <div className="min-w-0 flex-1">
                                <h2 className="font-semibold text-[var(--color-text)]">
                                    Sucursales
                                </h2>

                                <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                                    Administración de sucursales y cajas.
                                </p>
                            </div>

                            <span className="text-xs font-medium text-[var(--color-text-secondary)]">
                                Próximamente
                            </span>
                        </div>
                    </Card>
                </button>
            </div>
        </div>
    );
}