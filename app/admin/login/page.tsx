"use client";

import { useState } from "react";
import Link from "next/link";

import { supabase } from "../../../lib/supabase";
import { obtenerUsuarioActual } from "../../../lib/auth/roleGuard";

import Button from "../../components/Button";
import Card from "../../components/Card";

export default function AdminLoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [cargando, setCargando] = useState(false);
    const [error, setError] = useState("");

    async function iniciarSesion(
        e: React.FormEvent<HTMLFormElement>
    ) {
        e.preventDefault();

        if (cargando) return;

        setError("");
        setCargando(true);

        try {
            await supabase.auth.signOut();

            const { error: loginError } =
                await supabase.auth.signInWithPassword({
                    email,
                    password,
                });

            if (loginError) {
                setError("Correo o contraseña incorrectos.");
                return;
            }

            const usuario = await obtenerUsuarioActual();

            if (!usuario) {
                await supabase.auth.signOut();

                setError(
                    "No fue posible obtener la información del usuario."
                );

                return;
            }

            console.log("Usuario autenticado:", usuario);
            console.log("Rol:", usuario.rol);

            if (usuario.rol !== "admin") {
                await supabase.auth.signOut();

                if (usuario.rol === "cajero") {
                    setError(
                        "Esta cuenta corresponde a un cajero. Utiliza el acceso de Punto de Venta."
                    );
                } else if (usuario.rol === "encargado") {
                    setError(
                        "Esta cuenta corresponde a un encargado. No tienes acceso al panel de administración."
                    );
                } else {
                    setError(
                        "Tu cuenta no tiene permisos para acceder al panel de administración."
                    );
                }

                return;
            }

            window.location.href = "/admin";
        } catch (err) {
            console.error("Error al iniciar sesión:", err);
            setError("Ocurrió un error al iniciar sesión.");
        } finally {
            setCargando(false);
        }
    }

    return (
        <main
            className="min-h-screen flex items-center justify-center px-4 py-5"
            style={{
                backgroundColor: "var(--color-background)",
            }}
        >
            <div className="w-full max-w-md">

                {/* Encabezado */}
                <div className="text-center mb-4">

                    <div className="mt-4 flex justify-center">
                        <img
                            src="/logo.png"
                            alt="Soporte TI"
                            className="h-45 w-auto object-contain"
                        />
                    </div>

                    <h1
                        className="text-2xl sm:text-3xl font-bold tracking-tight"
                        style={{
                            color: "var(--color-text)",
                        }}
                    >
                        Punto de Venta
                    </h1>

                    <p
                        className="mt-0.5 text-sm"
                        style={{
                            color: "var(--color-text-secondary)",
                        }}
                    >
                        Sistema de gestión para negocios
                    </p>
                </div>

                {/* Tarjeta de acceso */}
                <Card className="overflow-hidden">

                    <div className="p-5 sm:p-6">

                        <div className="mb-5">
                            <h2
                                className="text-xl font-semibold"
                                style={{
                                    color: "var(--color-text)",
                                }}
                            >
                                Bienvenido
                            </h2>

                            <p
                                className="mt-1 text-sm"
                                style={{
                                    color:
                                        "var(--color-text-secondary)",
                                }}
                            >
                                Ingresa tus credenciales para continuar.
                            </p>
                        </div>

                        <form
                            onSubmit={iniciarSesion}
                            className="space-y-4"
                        >

                            {/* Correo */}
                            <div>
                                <label
                                    htmlFor="email"
                                    className="mb-1.5 block text-sm font-medium"
                                    style={{
                                        color:
                                            "var(--color-text)",
                                    }}
                                >
                                    Correo electrónico
                                </label>

                                <input
                                    id="email"
                                    type="email"
                                    value={email}
                                    onChange={(e) =>
                                        setEmail(e.target.value)
                                    }
                                    placeholder="correo@ejemplo.com"
                                    autoComplete="email"
                                    required
                                    disabled={cargando}
                                    className="
                                        w-full
                                        rounded-xl
                                        border
                                        px-4
                                        py-2.5
                                        text-sm
                                        outline-none
                                        transition
                                        focus:ring-2
                                        disabled:cursor-not-allowed
                                        disabled:opacity-60
                                    "
                                    style={{
                                        backgroundColor:
                                            "var(--color-surface)",
                                        borderColor:
                                            "var(--color-border)",
                                        color:
                                            "var(--color-text)",
                                    }}
                                />
                            </div>

                            {/* Contraseña */}
                            <div>
                                <div className="mb-1.5 flex items-center justify-between gap-3">

                                    <label
                                        htmlFor="password"
                                        className="block text-sm font-medium"
                                        style={{
                                            color:
                                                "var(--color-text)",
                                        }}
                                    >
                                        Contraseña
                                    </label>

                                    <Link
                                        href="/admin/recuperar-contrasena"
                                        className="
                                            text-xs
                                            font-medium
                                            transition
                                            hover:underline
                                        "
                                        style={{
                                            color:
                                                "var(--color-primary)",
                                        }}
                                    >
                                        ¿Olvidaste tu contraseña?
                                    </Link>
                                </div>

                                <input
                                    id="password"
                                    type="password"
                                    value={password}
                                    onChange={(e) =>
                                        setPassword(e.target.value)
                                    }
                                    placeholder="Ingresa tu contraseña"
                                    autoComplete="current-password"
                                    required
                                    disabled={cargando}
                                    className="
                                        w-full
                                        rounded-xl
                                        border
                                        px-4
                                        py-2.5
                                        text-sm
                                        outline-none
                                        transition
                                        focus:ring-2
                                        disabled:cursor-not-allowed
                                        disabled:opacity-60
                                    "
                                    style={{
                                        backgroundColor:
                                            "var(--color-surface)",
                                        borderColor:
                                            "var(--color-border)",
                                        color:
                                            "var(--color-text)",
                                    }}
                                />
                            </div>

                            {/* Error */}
                            {error && (
                                <div
                                    className="rounded-xl border px-4 py-2.5"
                                    style={{
                                        backgroundColor:
                                            "var(--color-danger-soft)",
                                        borderColor:
                                            "var(--color-danger)",
                                    }}
                                    role="alert"
                                >
                                    <div className="flex items-start gap-3">

                                        <div
                                            className="
                                                mt-0.5
                                                flex
                                                h-5
                                                w-5
                                                shrink-0
                                                items-center
                                                justify-center
                                                rounded-full
                                                text-xs
                                                font-bold
                                            "
                                            style={{
                                                backgroundColor:
                                                    "var(--color-danger)",
                                                color:
                                                    "var(--color-surface)",
                                            }}
                                        >
                                            !
                                        </div>

                                        <p
                                            className="text-sm leading-5"
                                            style={{
                                                color:
                                                    "var(--color-danger)",
                                            }}
                                        >
                                            {error}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Botón */}
                            <div className="pt-0.5">
                                <Button
                                    type="submit"
                                    variant="primary"
                                    size="large"
                                    disabled={cargando}
                                    className="w-full"
                                >
                                    {cargando
                                        ? "Iniciando sesión..."
                                        : "Iniciar sesión"}
                                </Button>
                            </div>
                        </form>
                    </div>

                    {/* Pie de tarjeta */}
                    <div
                        className="
                            border-t
                            px-5
                            py-3
                            text-center
                            sm:px-6
                        "
                        style={{
                            borderColor:
                                "var(--color-border)",
                            backgroundColor:
                                "var(--color-background)",
                        }}
                    >
                        <p
                            className="text-xs"
                            style={{
                                color:
                                    "var(--color-text-secondary)",
                            }}
                        >
                            Acceso seguro al sistema
                        </p>
                    </div>
                </Card>

                {/* Firma */}
                <div className="mt-3 text-center">
                    <p
                        className="text-xs"
                        style={{
                            color:
                                "var(--color-text-secondary)",
                        }}
                    >
                        Gestión y control para tu negocio
                    </p>
                </div>
            </div>
        </main>
    );
}