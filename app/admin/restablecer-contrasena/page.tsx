"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { supabase } from "../../../lib/supabase";
import Logo from "../../components/Logo";
import Button from "../../components/Button";
import Card from "../../components/Card";
import ModalMensaje from "../../components/ModalMensaje";

export default function RestablecerContrasenaPage() {
    const router = useRouter();

    const [nuevaPassword, setNuevaPassword] = useState("");
    const [confirmarPassword, setConfirmarPassword] = useState("");
    const [cargando, setCargando] = useState(true);
    const [guardando, setGuardando] = useState(false);
    const [sesionValida, setSesionValida] = useState(false);

    const [modal, setModal] = useState({
        abierto: false,
        tipo: "info" as "exito" | "error" | "confirmacion" | "info",
        titulo: "",
        mensaje: "",
    });

    function mostrarModal(
        tipo: "exito" | "error" | "confirmacion" | "info",
        titulo: string,
        mensaje: string
    ) {
        setModal({
            abierto: true,
            tipo,
            titulo,
            mensaje,
        });
    }

    function cerrarModal() {
        setModal((prev) => ({
            ...prev,
            abierto: false,
        }));
    }

    useEffect(() => {
        let montado = true;

        async function verificarSesion() {
            try {
                const {
                    data: { session },
                } = await supabase.auth.getSession();

                if (!montado) return;

                if (session) {
                    setSesionValida(true);
                    setCargando(false);
                    return;
                }

                setSesionValida(false);
                setCargando(false);

                mostrarModal(
                    "error",
                    "Enlace no válido",
                    "El enlace de recuperación no es válido o ya expiró. Solicita un nuevo enlace para restablecer tu contraseña."
                );
            } catch (error) {
                console.error(
                    "Error al verificar sesión de recuperación:",
                    error
                );

                if (!montado) return;

                setSesionValida(false);
                setCargando(false);

                mostrarModal(
                    "error",
                    "No se pudo verificar",
                    "No fue posible verificar el enlace de recuperación. Solicita uno nuevo e inténtalo nuevamente."
                );
            }
        }

        verificarSesion();

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((event, session) => {
            if (!montado) return;

            if (
                event === "PASSWORD_RECOVERY" ||
                event === "SIGNED_IN"
            ) {
                if (session) {
                    setSesionValida(true);
                    setCargando(false);
                }
            }
        });

        return () => {
            montado = false;
            subscription.unsubscribe();
        };
    }, []);

    async function cambiarPassword(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();

        if (guardando) return;

        if (!sesionValida) {
            mostrarModal(
                "error",
                "Sesión no válida",
                "El enlace de recuperación no es válido o ya expiró. Solicita uno nuevo."
            );
            return;
        }

        if (!nuevaPassword) {
            mostrarModal(
                "error",
                "Contraseña requerida",
                "Escribe tu nueva contraseña."
            );
            return;
        }

        if (nuevaPassword.length < 6) {
            mostrarModal(
                "error",
                "Contraseña demasiado corta",
                "La contraseña debe tener al menos 6 caracteres."
            );
            return;
        }

        if (!confirmarPassword) {
            mostrarModal(
                "error",
                "Confirma tu contraseña",
                "Escribe nuevamente la nueva contraseña."
            );
            return;
        }

        if (nuevaPassword !== confirmarPassword) {
            mostrarModal(
                "error",
                "Las contraseñas no coinciden",
                "La nueva contraseña y su confirmación deben ser iguales."
            );
            return;
        }

        setGuardando(true);

        try {
            const { error } = await supabase.auth.updateUser({
                password: nuevaPassword,
            });

            if (error) {
                console.error(
                    "Error al actualizar contraseña:",
                    error
                );

                mostrarModal(
                    "error",
                    "No se pudo cambiar la contraseña",
                    error.message ||
                    "Ocurrió un problema al actualizar la contraseña. Solicita un nuevo enlace e inténtalo nuevamente."
                );

                return;
            }

            setNuevaPassword("");
            setConfirmarPassword("");

            mostrarModal(
                "exito",
                "Contraseña actualizada",
                "Tu contraseña se cambió correctamente. Ahora podrás iniciar sesión con tu nueva contraseña."
            );
        } catch (error) {
            console.error(
                "Error inesperado al cambiar contraseña:",
                error
            );

            mostrarModal(
                "error",
                "Error inesperado",
                "Ocurrió un problema al cambiar la contraseña. Inténtalo nuevamente."
            );
        } finally {
            setGuardando(false);
        }
    }

    async function continuarAlLogin() {
        cerrarModal();

        await supabase.auth.signOut();

        router.replace("/admin/login");
    }

    return (
        <main className="min-h-screen bg-[var(--color-background)] flex items-center justify-center px-4 py-8">
            <div className="w-full max-w-md">
                <div className="mt-4 flex justify-center">
                    <img
                        src="/logo.png"
                        alt="Soporte TI"
                        className="h-55 w-auto object-contain"
                    />
                </div>

                <Card className="p-6 sm:p-8">
                    {cargando ? (
                        <div className="py-8 text-center">
                            <p className="text-sm text-[var(--color-text-secondary)]">
                                Verificando enlace de recuperación...
                            </p>
                        </div>
                    ) : !sesionValida ? (
                        <div className="text-center">
                            <h1 className="text-2xl font-bold text-[var(--color-text)]">
                                Enlace no disponible
                            </h1>

                            <p className="mt-3 text-sm leading-relaxed text-[var(--color-text-secondary)]">
                                El enlace de recuperación no es válido o
                                ya expiró.
                            </p>

                            <div className="mt-6 space-y-3">
                                <Button
                                    type="button"
                                    onClick={() =>
                                        router.push(
                                            "/admin/recuperar-contrasena"
                                        )
                                    }
                                    className="w-full"
                                >
                                    Solicitar nuevo enlace
                                </Button>

                                <button
                                    type="button"
                                    onClick={() =>
                                        router.push("/admin/login")
                                    }
                                    className="
                                        w-full
                                        text-sm
                                        font-medium
                                        text-[var(--color-primary)]
                                        transition
                                        hover:underline
                                    "
                                >
                                    Volver al inicio de sesión
                                </button>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="mb-6">
                                <h1 className="text-2xl font-bold text-[var(--color-text)]">
                                    Nueva contraseña
                                </h1>

                                <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-secondary)]">
                                    Escribe una nueva contraseña para tu
                                    cuenta de administrador.
                                </p>
                            </div>

                            <form
                                onSubmit={cambiarPassword}
                                className="space-y-5"
                            >
                                <div>
                                    <label
                                        htmlFor="nueva-password"
                                        className="mb-2 block text-sm font-medium text-[var(--color-text)]"
                                    >
                                        Nueva contraseña
                                    </label>

                                    <input
                                        id="nueva-password"
                                        name="new-password"
                                        type="password"
                                        autoComplete="new-password"
                                        value={nuevaPassword}
                                        onChange={(e) =>
                                            setNuevaPassword(
                                                e.target.value
                                            )
                                        }
                                        placeholder="Mínimo 6 caracteres"
                                        disabled={guardando}
                                        className="
                                            w-full
                                            rounded-xl
                                            border
                                            border-[var(--color-border)]
                                            bg-[var(--color-surface)]
                                            px-4
                                            py-3
                                            text-[var(--color-text)]
                                            outline-none
                                            transition
                                            placeholder:text-[var(--color-text-secondary)]
                                            focus:border-[var(--color-primary)]
                                            focus:ring-2
                                            focus:ring-[var(--color-primary)]/20
                                            disabled:cursor-not-allowed
                                            disabled:opacity-60
                                        "
                                    />
                                </div>

                                <div>
                                    <label
                                        htmlFor="confirmar-password"
                                        className="mb-2 block text-sm font-medium text-[var(--color-text)]"
                                    >
                                        Confirmar contraseña
                                    </label>

                                    <input
                                        id="confirmar-password"
                                        name="confirm-password"
                                        type="password"
                                        autoComplete="new-password"
                                        value={confirmarPassword}
                                        onChange={(e) =>
                                            setConfirmarPassword(
                                                e.target.value
                                            )
                                        }
                                        placeholder="Repite tu contraseña"
                                        disabled={guardando}
                                        className="
                                            w-full
                                            rounded-xl
                                            border
                                            border-[var(--color-border)]
                                            bg-[var(--color-surface)]
                                            px-4
                                            py-3
                                            text-[var(--color-text)]
                                            outline-none
                                            transition
                                            placeholder:text-[var(--color-text-secondary)]
                                            focus:border-[var(--color-primary)]
                                            focus:ring-2
                                            focus:ring-[var(--color-primary)]/20
                                            disabled:cursor-not-allowed
                                            disabled:opacity-60
                                        "
                                    />
                                </div>

                                <Button
                                    type="submit"
                                    disabled={guardando}
                                    className="w-full"
                                >
                                    {guardando
                                        ? "Guardando..."
                                        : "Cambiar contraseña"}
                                </Button>
                            </form>
                        </>
                    )}
                </Card>
            </div>

            <ModalMensaje
                abierto={modal.abierto}
                tipo={modal.tipo}
                titulo={modal.titulo}
                mensaje={modal.mensaje}
                textoBoton={
                    modal.tipo === "exito"
                        ? "Ir al inicio de sesión"
                        : "Aceptar"
                }
                onCerrar={() => {
                    if (modal.tipo === "exito") {
                        continuarAlLogin();
                    } else {
                        cerrarModal();
                    }
                }}
            />
        </main>
    );
}