import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/*
 * ==========================================
 * SESIÓN ADMINISTRATIVA
 * ==========================================
 *
 * La administración utiliza sessionStorage
 * para que cada pestaña tenga su propia sesión.
 *
 * Ejemplo:
 *
 * Pestaña 1 → Admin A → Negocio A
 * Pestaña 2 → Admin B → Negocio B
 *
 * Cerrar sesión en una pestaña NO afecta
 * la sesión administrativa de otra pestaña.
 */
export const supabaseAdmin = createClient(
    supabaseUrl,
    supabaseKey,
    {
        auth: {
            storageKey: "pos-admin-auth",
            storage:
                typeof window !== "undefined"
                    ? window.sessionStorage
                    : undefined,
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
        },
    }
);

/*
 * ==========================================
 * SESIÓN DEL PUNTO DE VENTA
 * ==========================================
 *
 * El POS utiliza sessionStorage para que
 * cada pestaña del navegador tenga su propia
 * sesión de cajero.
 *
 * Pestaña 1 → Diego
 * Pestaña 2 → Uriel
 *
 * Cerrar sesión de uno no afecta al otro.
 */
export const supabasePOS = createClient(
    supabaseUrl,
    supabaseKey,
    {
        auth: {
            storageKey: "pos-cajero-auth",
            storage:
                typeof window !== "undefined"
                    ? window.sessionStorage
                    : undefined,
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
        },
    }
);

/*
 * ==========================================
 * COMPATIBILIDAD
 * ==========================================
 *
 * Lo administrativo continúa usando
 * supabaseAdmin.
 */
export const supabase = supabaseAdmin;