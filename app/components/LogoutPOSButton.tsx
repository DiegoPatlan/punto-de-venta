"use client";

import { useState } from "react";
import { supabasePOS } from "../../lib/supabase";
import Button from "./Button";

export default function LogoutPOSButton() {
    const [cargando, setCargando] = useState(false);

    async function cerrarSesion() {
        if (cargando) return;

        setCargando(true);

        try {
            await supabasePOS.auth.signOut();

            // Limpiar explícitamente la sesión del cajero
            if (typeof window !== "undefined") {
                localStorage.removeItem("pos-cajero-auth");
            }
            // Regresar completamente al login
            window.location.replace("/pos/login");
        } catch (error) {
            console.error(
                "❌ Error al cerrar sesión del POS:",
                error
            );

            setCargando(false);
        }
    }

    return (
        <Button
            type="button"
            variant="ghost"
            size="small"
            onClick={cerrarSesion}
            disabled={cargando}
            className="
                w-full
                justify-start
                text-red-600
                hover:bg-red-50
                hover:text-red-700
            "
        >
            {cargando
                ? "Cerrando sesión..."
                : "Cerrar sesión"}
        </Button>
    );
}