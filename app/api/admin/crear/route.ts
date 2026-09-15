import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL!;

const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabaseServiceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY!;


/*
 * Cliente para validar al usuario que
 * está realizando la operación.
 */
const supabaseAuth = createClient(
    supabaseUrl,
    supabaseAnonKey
);


/*
 * Cliente administrativo.
 *
 * IMPORTANTE:
 * Esta clave solamente existe
 * en el servidor.
 */
const supabaseAdmin = createClient(
    supabaseUrl,
    supabaseServiceRoleKey
);


export async function POST(
    request: NextRequest
) {

    let usuarioCreadoAuthId: string | null = null;

    try {

        /*
         * ==========================================
         * VALIDAR CONFIGURACIÓN
         * ==========================================
         */

        if (
            !supabaseUrl ||
            !supabaseAnonKey ||
            !supabaseServiceRoleKey
        ) {

            return NextResponse.json(
                {
                    error:
                        "Faltan variables de entorno de Supabase.",
                },
                {
                    status: 500,
                }
            );
        }


        /*
         * ==========================================
         * OBTENER TOKEN
         * ==========================================
         */

        const authorization =
            request.headers.get(
                "authorization"
            );

        if (!authorization) {

            return NextResponse.json(
                {
                    error:
                        "No autorizado.",
                },
                {
                    status: 401,
                }
            );
        }


        const token =
            authorization.replace(
                "Bearer ",
                ""
            );


        if (!token) {

            return NextResponse.json(
                {
                    error:
                        "Token inválido.",
                },
                {
                    status: 401,
                }
            );
        }


        /*
         * ==========================================
         * OBTENER USUARIO AUTENTICADO
         * ==========================================
         */

        const {
            data: {
                user,
            },
            error: errorAuth,
        } =
            await supabaseAuth.auth.getUser(
                token
            );


        if (
            errorAuth ||
            !user
        ) {

            return NextResponse.json(
                {
                    error:
                        "La sesión no es válida.",
                },
                {
                    status: 401,
                }
            );
        }


        /*
         * ==========================================
         * OBTENER PERFIL DEL USUARIO
         * ==========================================
         */

        const {
            data: usuarioActual,
            error: errorUsuario,
        } =
            await supabaseAdmin
                .from("usuarios")
                .select(`
                    id,
                    negocio_id,
                    nombre,
                    rol,
                    activo
                `)
                .eq(
                    "auth_user_id",
                    user.id
                )
                .single();


        if (
            errorUsuario ||
            !usuarioActual
        ) {

            return NextResponse.json(
                {
                    error:
                        "No se encontró el usuario actual.",
                },
                {
                    status: 403,
                }
            );
        }


        /*
         * ==========================================
         * SOLO ADMINISTRADORES
         * ==========================================
         */

        if (
            usuarioActual.rol !==
            "admin"
        ) {

            return NextResponse.json(
                {
                    error:
                        "No tienes permisos para crear usuarios.",
                },
                {
                    status: 403,
                }
            );
        }


        /*
         * ==========================================
         * LEER DATOS
         * ==========================================
         */

        const body =
            await request.json();

        const {
            nombre,
            email,
            password,
            rol,
            sucursales,
            cajas,
        } = body;


        /*
         * ==========================================
         * VALIDACIONES
         * ==========================================
         */

        if (
            !nombre ||
            !email ||
            !password ||
            !rol
        ) {

            return NextResponse.json(
                {
                    error:
                        "Nombre, correo, contraseña y rol son obligatorios.",
                },
                {
                    status: 400,
                }
            );
        }


        if (
            password.length < 6
        ) {

            return NextResponse.json(
                {
                    error:
                        "La contraseña debe tener al menos 6 caracteres.",
                },
                {
                    status: 400,
                }
            );
        }


        const rolesPermitidos = [
            "admin",
            "encargado",
            "cajero",
        ];


        if (
            !rolesPermitidos.includes(
                rol
            )
        ) {

            return NextResponse.json(
                {
                    error:
                        "El rol seleccionado no es válido.",
                },
                {
                    status: 400,
                }
            );
        }


        const sucursalesSeleccionadas:
            string[] =
            Array.isArray(
                sucursales
            )
                ? sucursales
                : [];


        const cajasSeleccionadas:
            string[] =
            Array.isArray(
                cajas
            )
                ? cajas
                : [];


        /*
         * ==========================================
         * VALIDAR SUCURSALES
         * ==========================================
         */

        if (
            sucursalesSeleccionadas.length === 0
        ) {

            return NextResponse.json(
                {
                    error:
                        "Debes seleccionar al menos una sucursal.",
                },
                {
                    status: 400,
                }
            );
        }


        const {
            data: sucursalesValidas,
            error: errorSucursales,
        } =
            await supabaseAdmin
                .from("sucursales")
                .select("id")
                .eq(
                    "negocio_id",
                    usuarioActual.negocio_id
                )
                .eq(
                    "activo",
                    true
                )
                .in(
                    "id",
                    sucursalesSeleccionadas
                );


        if (
            errorSucursales
        ) {

            throw new Error(
                "No se pudieron validar las sucursales."
            );
        }


        if (
            (sucursalesValidas?.length ?? 0) !==
            sucursalesSeleccionadas.length
        ) {

            return NextResponse.json(
                {
                    error:
                        "Una o más sucursales no pertenecen a este negocio.",
                },
                {
                    status: 400,
                }
            );
        }


        /*
         * ==========================================
         * VALIDAR CAJAS
         * ==========================================
         */

        if (
            cajasSeleccionadas.length > 0
        ) {

            const {
                data: cajasValidas,
                error: errorCajas,
            } =
                await supabaseAdmin
                    .from("cajas")
                    .select(`
                        id,
                        sucursal_id,
                        sucursales!inner(
                            negocio_id
                        )
                    `)
                    .eq(
                        "activo",
                        true
                    )
                    .in(
                        "id",
                        cajasSeleccionadas
                    );


            if (
                errorCajas
            ) {

                throw new Error(
                    "No se pudieron validar las cajas."
                );
            }


            if (
                (cajasValidas?.length ?? 0) !==
                cajasSeleccionadas.length
            ) {

                return NextResponse.json(
                    {
                        error:
                            "Una o más cajas no son válidas.",
                    },
                    {
                        status: 400,
                    }
                );
            }


            /*
             * Verificar que cada caja
             * pertenezca al negocio.
             */

            const cajaPerteneceAlNegocio =
                cajasValidas.every(
                    (caja: any) =>
                        caja.sucursales
                            ?.negocio_id ===
                        usuarioActual.negocio_id
                );


            if (
                !cajaPerteneceAlNegocio
            ) {

                return NextResponse.json(
                    {
                        error:
                            "Una o más cajas pertenecen a otro negocio.",
                    },
                    {
                        status: 400,
                    }
                );
            }


            /*
             * Verificar que las cajas
             * pertenezcan a las sucursales
             * seleccionadas.
             */

            const cajaPerteneceSucursal =
                cajasValidas.every(
                    (caja: any) =>
                        sucursalesSeleccionadas.includes(
                            caja.sucursal_id
                        )
                );


            if (
                !cajaPerteneceSucursal
            ) {

                return NextResponse.json(
                    {
                        error:
                            "Una o más cajas no pertenecen a las sucursales seleccionadas.",
                    },
                    {
                        status: 400,
                    }
                );
            }
        }


        /*
         * ==========================================
         * CREAR CUENTA EN SUPABASE AUTH
         * ==========================================
         */

        const {
            data: nuevoAuth,
            error: errorCrearAuth,
        } =
            await supabaseAdmin.auth.admin.createUser(
                {
                    email:
                        email.trim().toLowerCase(),

                    password,

                    email_confirm:
                        true,

                    user_metadata: {
                        nombre,
                    },
                }
            );


        if (
            errorCrearAuth ||
            !nuevoAuth.user
        ) {

            return NextResponse.json(
                {
                    error:
                        errorCrearAuth?.message ??
                        "No se pudo crear la cuenta.",
                },
                {
                    status: 400,
                }
            );
        }


        usuarioCreadoAuthId =
            nuevoAuth.user.id;


        /*
         * ==========================================
         * CREAR PERFIL EN usuarios
         * ==========================================
         */

        const {
            data: nuevoUsuario,
            error: errorInsertUsuario,
        } =
            await supabaseAdmin
                .from("usuarios")
                .insert({
                    auth_user_id:
                        nuevoAuth.user.id,

                    negocio_id:
                        usuarioActual.negocio_id,

                    nombre:
                        nombre.trim(),

                    rol,

                    activo:
                        true,
                })
                .select(
                    "id"
                )
                .single();


        if (
            errorInsertUsuario ||
            !nuevoUsuario
        ) {

            throw new Error(
                errorInsertUsuario?.message ??
                "No se pudo crear el perfil del usuario."
            );
        }


        /*
         * ==========================================
         * ASIGNAR SUCURSALES
         * ==========================================
         */

        const relacionesSucursales =
            sucursalesSeleccionadas.map(
                (sucursalId) => ({
                    usuario_id:
                        nuevoUsuario.id,

                    sucursal_id:
                        sucursalId,
                })
            );


        const {
            error:
            errorAsignarSucursales,
        } =
            await supabaseAdmin
                .from("usuario_sucursales")
                .insert(
                    relacionesSucursales
                );


        if (
            errorAsignarSucursales
        ) {

            throw new Error(
                errorAsignarSucursales.message
            );
        }


        /*
         * ==========================================
         * ASIGNAR CAJAS
         * ==========================================
         */

        if (
            cajasSeleccionadas.length > 0
        ) {

            const relacionesCajas =
                cajasSeleccionadas.map(
                    (cajaId) => ({
                        usuario_id:
                            nuevoUsuario.id,

                        caja_id:
                            cajaId,
                    })
                );


            const {
                error:
                errorAsignarCajas,
            } =
                await supabaseAdmin
                    .from("usuario_cajas")
                    .insert(
                        relacionesCajas
                    );


            if (
                errorAsignarCajas
            ) {

                throw new Error(
                    errorAsignarCajas.message
                );
            }
        }


        /*
         * ==========================================
         * ÉXITO
         * ==========================================
         */

        return NextResponse.json(
            {
                ok: true,

                usuario: {
                    id:
                        nuevoUsuario.id,

                    auth_user_id:
                        nuevoAuth.user.id,

                    nombre:
                        nombre.trim(),

                    rol,

                    sucursales:
                        sucursalesSeleccionadas.length,

                    cajas:
                        cajasSeleccionadas.length,
                },
            },
            {
                status: 201,
            }
        );


    } catch (error: any) {

        console.error(
            "Error creando usuario:",
            error
        );


        /*
         * ==========================================
         * ROLLBACK AUTH
         * ==========================================
         *
         * Si ya creamos la cuenta Auth pero
         * algo posterior falló, la eliminamos
         * para evitar usuarios incompletos.
         */

        if (
            usuarioCreadoAuthId
        ) {

            try {

                await supabaseAdmin.auth.admin.deleteUser(
                    usuarioCreadoAuthId
                );

            } catch (
            errorRollback
            ) {

                console.error(
                    "Error haciendo rollback:",
                    errorRollback
                );
            }
        }


        return NextResponse.json(
            {
                error:
                    error?.message ??
                    "Ocurrió un error creando el usuario.",
            },
            {
                status: 500,
            }
        );
    }
}