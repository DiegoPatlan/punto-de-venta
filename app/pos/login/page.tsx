"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { supabasePOS } from "../../../lib/supabase";

export default function PosLoginPage() {
    const router = useRouter();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [cargando, setCargando] = useState(false);
    const [error, setError] = useState("");

    async function iniciarSesion(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setError("");

        if (!email.trim()) {
            setError("Introduce tu correo electrónico.");
            return;
        }

        if (!password) {
            setError("Introduce tu contraseña.");
            return;
        }

        try {
            setCargando(true);

            console.log("==========================================");
            console.log("🔐 INICIANDO SESIÓN POS");
            console.log("==========================================");

            /*
             * ========================================
             * LOGIN CON LA SESIÓN DEL POS
             * ========================================
             */

            const {
                data,
                error: loginError,
            } = await supabasePOS.auth.signInWithPassword({
                email: email.trim(),
                password,
            });

            console.log("Usuario Auth POS:", data.user);
            console.log("Error login:", loginError);

            if (loginError) {
                console.error(
                    "❌ Error iniciando sesión:",
                    loginError
                );

                setError(
                    loginError.message ||
                    "No se pudo iniciar sesión."
                );

                return;
            }

            if (!data.user) {
                setError(
                    "No se pudo obtener el usuario autenticado."
                );

                return;
            }

            /*
             * ========================================
             * VERIFICAR USUARIO EN public.usuarios
             * ========================================
             */

            const {
                data: usuario,
                error: usuarioError,
            } = await supabasePOS
                .from("usuarios")
                .select(`
                    id,
                    auth_user_id,
                    negocio_id,
                    nombre,
                    rol,
                    activo
                `)
                .eq(
                    "auth_user_id",
                    data.user.id
                )
                .eq(
                    "activo",
                    true
                )
                .maybeSingle();

            console.log("👤 Usuario POS:", usuario);
            console.log(
                "❌ Error usuario POS:",
                usuarioError
            );

            if (usuarioError) {
                console.error(
                    "❌ Error consultando usuario:",
                    usuarioError
                );

                /*
                 * Cerramos la sesión porque el
                 * usuario de Auth no está correctamente
                 * configurado para el POS.
                 */

                await supabasePOS.auth.signOut();

                setError(
                    usuarioError.message ||
                    "No se pudo verificar el usuario."
                );

                return;
            }

            if (!usuario) {
                await supabasePOS.auth.signOut();

                setError(
                    "Tu usuario de acceso no está configurado en el sistema."
                );

                return;
            }

            if (!usuario.negocio_id) {
                await supabasePOS.auth.signOut();

                setError(
                    "Tu usuario no tiene un negocio asignado."
                );

                return;
            }

            /*
             * ========================================
             * VALIDAR ROL
             * ========================================
             */

            const rolesPermitidos = [
                "admin",
                "encargado",
                "cajero",
            ];

            if (
                !rolesPermitidos.includes(
                    usuario.rol
                )
            ) {
                await supabasePOS.auth.signOut();

                setError(
                    "Tu usuario no tiene permisos para utilizar el punto de venta."
                );

                return;
            }

            console.log(
                "=========================================="
            );

            console.log(
                "✅ LOGIN POS CORRECTO"
            );

            console.log(
                "Usuario:",
                usuario.nombre
            );

            console.log(
                "Rol:",
                usuario.rol
            );

            console.log(
                "Negocio:",
                usuario.negocio_id
            );

            console.log(
                "=========================================="
            );

            /*
             * ========================================
             * IR AL PUNTO DE VENTA
             * ========================================
             */

            router.replace("/pos/caj");

        } catch (error) {
            console.error(
                "❌ Error inesperado en login:",
                error
            );

            setError(
                "Ocurrió un error al iniciar sesión."
            );
        } finally {
            setCargando(false);
        }
    }

    return (
        <main className="flex min-h-screen items-center justify-center bg-[var(--color-background)] px-4">
            <div className="w-full max-w-md">
                <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-sm sm:p-8">

                    {/* LOGO / ICONO */}

                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-3xl">
                        🏪
                    </div>

                    <h1 className="mt-5 text-center text-2xl font-bold text-[var(--color-text)]">
                        Punto de Venta
                    </h1>

                    <p className="mt-2 text-center text-sm text-[var(--color-text-secondary)]">
                        Inicia sesión para acceder al sistema
                    </p>

                    {/* ERROR */}

                    {error && (
                        <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                            {error}
                        </div>
                    )}

                    {/* FORMULARIO */}

                    <form
                        onSubmit={iniciarSesion}
                        className="mt-6 space-y-5"
                    >

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
                                placeholder="correo@ejemplo.com"
                                autoComplete="email"
                                disabled={cargando}
                                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)] focus:ring-4 focus:ring-blue-100 disabled:opacity-60"
                            />
                        </div>

                        {/* CONTRASEÑA */}

                        <div>
                            <label
                                htmlFor="password"
                                className="mb-2 block text-sm font-semibold text-[var(--color-text)]"
                            >
                                Contraseña
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
                                placeholder="••••••••"
                                autoComplete="current-password"
                                disabled={cargando}
                                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)] focus:ring-4 focus:ring-blue-100 disabled:opacity-60"
                            />
                        </div>

                        {/* BOTÓN */}

                        <button
                            type="submit"
                            disabled={
                                cargando ||
                                !email.trim() ||
                                !password
                            }
                            className="w-full rounded-xl bg-[var(--color-primary)] px-5 py-3.5 text-sm font-bold text-white transition hover:bg-[var(--color-primary-hover)] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {cargando
                                ? "Iniciando sesión..."
                                : "Iniciar sesión"}
                        </button>

                    </form>

                    {/* INFORMACIÓN */}

                    <div className="mt-6 rounded-xl bg-slate-50 p-4">
                        <p className="text-xs leading-5 text-[var(--color-text-secondary)]">
                            Utiliza las credenciales asignadas
                            por el administrador del negocio.
                        </p>
                    </div>

                </div>
            </div>
        </main>
    );
}