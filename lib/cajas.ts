import { supabasePOS } from "./supabase";

/*
 * ============================================
 * TIPOS
 * ============================================
 */

export interface CajaAsignada {
    id: string;
    nombre: string;
    sucursal_id: string;
    sucursal_nombre: string | null;
    activa: boolean;
}

/*
 * ============================================
 * OBTENER CAJAS ASIGNADAS AL USUARIO
 * ============================================
 *
 * REGLAS:
 *
 * 1. El usuario debe pertenecer al negocio.
 * 2. El usuario debe estar activo.
 * 3. La caja debe estar activa.
 * 4. La sucursal debe estar activa.
 * 5. La sucursal debe pertenecer al negocio.
 * 6. La caja debe estar asignada al usuario.
 *
 * IMPORTANTE:
 *
 * La consulta se realiza por pasos para evitar
 * problemas con relaciones anidadas de Supabase
 * y facilitar el diagnóstico de RLS.
 */

export async function obtenerCajasAsignadas(
    negocioId: string,
    usuarioId: string
) {

    /*
     * ============================================
     * VALIDACIONES INICIALES
     * ============================================
     */

    if (!negocioId) {
        return {
            data: [],
            error: new Error(
                "No se recibió el negocio_id."
            ),
        };
    }

    if (!usuarioId) {
        return {
            data: [],
            error: new Error(
                "No se recibió el usuarioId."
            ),
        };
    }

    try {
        /*
         * ============================================
         * 1. VALIDAR USUARIO
         * ============================================
         */


        const {
            data: usuarioData,
            error: usuarioError,
        } = await supabasePOS
            .from("usuarios")
            .select(
                "id, negocio_id, activo"
            )
            .eq("id", usuarioId)
            .eq("negocio_id", negocioId)
            .eq("activo", true)
            .maybeSingle();


        if (usuarioError) {
            console.error(
                "❌ ERROR EN CONSULTA USUARIO:",
                usuarioError.message,
                usuarioError.code,
                usuarioError.details,
                usuarioError.hint
            );

            return {
                data: [],
                error: usuarioError,
            };
        }

        if (!usuarioData) {
            return {
                data: [],
                error: new Error(
                    "El usuario no pertenece al negocio indicado o está inactivo."
                ),
            };
        }

        /*
         * ============================================
         * 2. OBTENER ASIGNACIONES
         * ============================================
         *
         * Aquí NO hacemos todavía la relación con
         * cajas y sucursales.
         *
         * Primero obtenemos solamente las cajas que
         * están asignadas al usuario.
         */


        const {
            data: asignaciones,
            error: asignacionesError,
        } = await supabasePOS
            .from("usuario_cajas")
            .select(
                "id, usuario_id, caja_id"
            )
            .eq(
                "usuario_id",
                usuarioId
            );


        if (asignacionesError) {
            console.error(
                "❌ ERROR EN usuario_cajas:",
                asignacionesError.message,
                asignacionesError.code,
                asignacionesError.details,
                asignacionesError.hint
            );

            return {
                data: [],
                error: asignacionesError,
            };
        }

        /*
         * ============================================
         * 3. SI NO TIENE ASIGNACIONES
         * ============================================
         */

        if (
            !asignaciones ||
            asignaciones.length === 0
        ) {

            return {
                data: [],
                error: null,
            };
        }

        /*
         * ============================================
         * 4. OBTENER IDs DE LAS CAJAS
         * ============================================
         */

        const idsCajas = asignaciones
            .map(
                (asignacion) =>
                    asignacion.caja_id
            )
            .filter(Boolean);



        if (idsCajas.length === 0) {
            return {
                data: [],
                error: null,
            };
        }

        /*
         * ============================================
         * 5. OBTENER CAJAS
         * ============================================
         */



        const {
            data: cajasData,
            error: cajasError,
        } = await supabasePOS
            .from("cajas")
            .select(
                "id, sucursal_id, nombre, activo"
            )
            .in(
                "id",
                idsCajas
            )
            .eq(
                "activo",
                true
            );



        if (cajasError) {
            console.error(
                "❌ ERROR EN cajas:",
                cajasError.message,
                cajasError.code,
                cajasError.details,
                cajasError.hint
            );

            return {
                data: [],
                error: cajasError,
            };
        }

        if (
            !cajasData ||
            cajasData.length === 0
        ) {

            return {
                data: [],
                error: null,
            };
        }

        /*
         * ============================================
         * 6. OBTENER SUCURSALES
         * ============================================
         */

        const idsSucursales = [
            ...new Set(
                cajasData
                    .map(
                        (caja) =>
                            caja.sucursal_id
                    )
                    .filter(Boolean)
            ),
        ];


        if (
            idsSucursales.length === 0
        ) {
            return {
                data: [],
                error: null,
            };
        }

        const {
            data: sucursalesData,
            error: sucursalesError,
        } = await supabasePOS
            .from("sucursales")
            .select(
                "id, nombre, negocio_id, activo"
            )
            .in(
                "id",
                idsSucursales
            )
            .eq(
                "negocio_id",
                negocioId
            )
            .eq(
                "activo",
                true
            );


        if (sucursalesError) {
            console.error(
                "❌ ERROR EN sucursales:",
                sucursalesError.message,
                sucursalesError.code,
                sucursalesError.details,
                sucursalesError.hint
            );

            return {
                data: [],
                error: sucursalesError,
            };
        }

        /*
         * ============================================
         * 7. CREAR MAPA DE SUCURSALES
         * ============================================
         */

        const mapaSucursales =
            new Map(
                (
                    sucursalesData ?? []
                ).map(
                    (sucursal) => [
                        sucursal.id,
                        sucursal,
                    ]
                )
            );

        /*
         * ============================================
         * 8. CONSTRUIR CAJAS FINALES
         * ============================================
         */

        const cajas: CajaAsignada[] =
            cajasData
                .map((caja) => {
                    const sucursal =
                        mapaSucursales.get(
                            caja.sucursal_id
                        );

                    /*
                     * Si la sucursal no pertenece
                     * al negocio o está inactiva,
                     * descartamos la caja.
                     */

                    if (!sucursal) {
                        return null;
                    }

                    return {
                        id: caja.id,
                        nombre: caja.nombre,
                        sucursal_id:
                            caja.sucursal_id,
                        sucursal_nombre:
                            sucursal.nombre ??
                            null,
                        activa:
                            caja.activo === true,
                    };
                })
                .filter(
                    (
                        caja
                    ): caja is CajaAsignada =>
                        caja !== null
                );

        /*
         * ============================================
         * 9. RESULTADO FINAL
         * ============================================
         */



        return {
            data: cajas,
            error: null,
        };
    } catch (error) {
        console.error(
            "❌ ERROR INESPERADO OBTENIENDO CAJAS:",
            error
        );

        return {
            data: [],
            error,
        };
    }
}