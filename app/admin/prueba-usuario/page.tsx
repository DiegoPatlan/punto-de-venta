"use client";

import { supabase } from "../../../lib/supabase";

export default function PruebaUsuarioPage() {
    async function probar() {
        const {
            data: { session },
        } = await supabase.auth.getSession();

        if (!session?.access_token) {
            console.error("No hay sesión activa.");
            return;
        }

        const { data, error } =
            await supabase.functions.invoke("crear-usuario", {
                body: {
                    email: "prueba@soporteti.com",
                    password: "Prueba12345",
                    nombre: "Usuario Prueba",
                    rol: "cajero",
                },
                headers: {
                    Authorization: `Bearer ${session.access_token}`,
                },
            });

        if (error) {
            alert(
                "Error: " +
                (error.message || "Error desconocido")
            );
            return;
        }

        alert(
            "Respuesta: " +
            JSON.stringify(data)
        );
    }

    return (
        <main className="p-8">
            <h1 className="mb-4 text-2xl font-bold">
                Prueba crear usuario
            </h1>

            <button
                type="button"
                onClick={probar}
                className="rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white"
            >
                Probar creación
            </button>
        </main>
    );
}