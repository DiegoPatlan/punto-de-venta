import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";


/*
 * ==========================================
 * CLIENTE ADMINISTRADOR DE SUPABASE
 * ==========================================
 *
 * Este cliente SOLO existe en el servidor.
 *
 * NUNCA utilizar SUPABASE_SERVICE_ROLE_KEY
 * en componentes "use client".
 */

const supabaseAdmin =
    createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
            auth: {
                autoRefreshToken: false,
                persistSession: false,
            },
        }
    );


export async function POST(
    request: Request
) {

    let authUserId: string | null = null;
    let usuarioCreadoId: string | null = null;


    try {

        /*
         * ==========================================
         * 1. OBTENER TOKEN DEL USUARIO ACTUAL
         * ==========================================
         */

        const authorization =
            request.headers.get(
                "authorization"
            );


        if (
            !authorization ||
            !authorization.startsWith(
                "Bearer "
            )
        ) {

            return NextResponse.json(
                {
                    error:
                        "No se encontró la sesión del usuario.",
                },
                {
                    status: 401,
                }
            );
        }


        const accessToken =
            authorization.replace(
                "Bearer ",
                ""
            );


        /*
         * ==========================================
         * 2. VALIDAR TOKEN
         * ==========================================
         */

        const {
            data: authData,
            error: authError,
        } =
            await supabaseAdmin.auth.getUser(
                accessToken
            );


        if (
            authError ||
            !authData.user
        ) {

            return NextResponse.json(
                {
                    error:
                        "La sesión no es válida o ha expirado.",
                },
                {
                    status: 401,
                }
            );
        }


        authUserId =
            authData.user.id;


        /*
         * ==========================================
         * 3. OBTENER USUARIO ADMINISTRADOR
         * ==========================================
         */

        const {
            data: administrador,
            error: administradorError,
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
                    authUserId
                )
                .eq(
                    "activo",
                    true
                )
                .single();


        if (
            administradorError ||
            !administrador
        ) {

            return NextResponse.json(
                {
                    error:
                        "No se encontró el usuario actual en el sistema.",
                },
                {
                    status: 403,
                }
            );
        }


        /*
         * ==========================================
         * 4. VALIDAR ROL
         * ==========================================
         */

        if (
            administrador.rol !==
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
         * 5. OBTENER DATOS DEL FORMULARIO
         * ==========================================
         */

        const body =
            await request.json();


        const {
            nombre,
            email,
            password,
            rol,
            sucursales = [],
            cajas = [],
        } = body;


        /*
         * ==========================================
         * 6. VALIDACIONES
         * ==========================================
         */

        if (
            typeof nombre !== "string" ||
            !nombre.trim()
        ) {

            return NextResponse.json(
                {
                    error:
                        "El nombre es obligatorio.",
                },
                {
                    status: 400,
                }
            );
        }


        if (
            typeof email !== "string" ||
            !email.trim()
        ) {

            return NextResponse.json(
                {
                    error:
                        "El correo electrónico es obligatorio.",
                },
                {
                    status: 400,
                }
            );
        }


        if (
            typeof password !== "string" ||
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


        if (
            ![
                "admin",
                "encargado",
                "cajero",
            ].includes(rol)
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


        if (
            !Array.isArray(sucursales) ||
            !Array.isArray(cajas)
        ) {

            return NextResponse.json(
                {
                    error:
                        "Las sucursales y cajas no tienen un formato válido.",
                },
                {
                    status: 400,
                }
            );
        }


        const negocioId =
            administrador.negocio_id;


        /*
         * ==========================================
         * 7. VALIDAR SUCURSALES
         * ==========================================
         *
         * Todas las sucursales seleccionadas
         * DEBEN pertenecer al negocio del admin.
         */

        if (
            sucursales.length > 0
        ) {

            const {
                data:
                sucursalesValidas,
                error:
                sucursalesError,
            } =
                await supabaseAdmin
                    .from("sucursales")
                    .select(
                        "id"
                    )
                    .eq(
                        "negocio_id",
                        negocioId
                    )
                    .in(
                        "id",
                        sucursales
                    );


            if (
                sucursalesError
            ) {

                console.error(
                    "Error validando sucursales:",
                    sucursalesError
                );

                return NextResponse.json(
                    {
                        error:
                            "No se pudieron validar las sucursales.",
                    },
                    {
                        status: 500,
                    }
                );
            }


            if (
                sucursalesValidas.length !==
                sucursales.length
            ) {

                return NextResponse.json(
                    {
                        error:
                            "Una o más sucursales no pertenecen a tu negocio.",
                    },
                    {
                        status: 403,
                    }
                );
            }
        }


        /*
         * ==========================================
         * 8. VALIDAR CAJAS
         * ==========================================
         *
         * Las cajas deben:
         *
         * 1. Existir.
         * 2. Pertenecer al negocio.
         * 3. Pertenecer a una sucursal seleccionada.
         */

        if (
            cajas.length > 0
        ) {

            const {
                data:
                cajasValidas,
                error:
                cajasError,
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
                        "sucursales.negocio_id",
                        negocioId
                    )
                    .in(
                        "id",
                        cajas
                    );


            if (
                cajasError
            ) {

                console.error(
                    "Error validando cajas:",
                    cajasError
                );

                return NextResponse.json(
                    {
                        error:
                            "No se pudieron validar las cajas.",
                    },
                    {
                        status: 500,
                    }
                );
            }


            if (
                cajasValidas.length !==
                cajas.length
            ) {

                return NextResponse.json(
                    {
                        error:
                            "Una o más cajas no pertenecen a tu negocio.",
                    },
                    {
                        status: 403,
                    }
                );
            }


            /*
             * Verificar que cada caja
             * pertenezca a una sucursal
             * seleccionada.
             */

            const sucursalesSeleccionadas =
                new Set(
                    sucursales
                );


            const cajaFueraDeSucursal =
                cajasValidas.some(
                    (
                        caja: any
                    ) =>
                        !sucursalesSeleccionadas.has(
                            caja.sucursal_id
                        )
                );


            if (
                cajaFueraDeSucursal
            ) {

                return NextResponse.json(
                    {
                        error:
                            "Una o más cajas pertenecen a sucursales que no fueron seleccionadas.",
                    },
                    {
                        status: 400,
                    }
                );
            }
        }


        /*
         * ==========================================
         * 9. CREAR USUARIO EN SUPABASE AUTH
         * ==========================================
         */

        const {
            data: nuevoAuth,
            error: authCreateError,
        } =
            await supabaseAdmin.auth.admin.createUser(
                {
                    email:
                        email.trim().toLowerCase(),

                    password:
                        password,

                    email_confirm:
                        true,
                }
            );


        if (
            authCreateError ||
            !nuevoAuth.user
        ) {

            console.error(
                "Error creando usuario Auth:",
                authCreateError
            );

            return NextResponse.json(
                {
                    error:
                        authCreateError?.message ||
                        "No se pudo crear la cuenta.",
                },
                {
                    status: 400,
                }
            );
        }


        authUserId =
            nuevoAuth.user.id;


        /*
         * ==========================================
         * 10. CREAR REGISTRO EN usuarios
         * ==========================================
         */

        const {
            data: nuevoUsuario,
            error: usuarioError,
        } =
            await supabaseAdmin
                .from("usuarios")
                .insert({
                    auth_user_id:
                        authUserId,

                    negocio_id:
                        negocioId,

                    nombre:
                        nombre.trim(),

                    rol:
                        rol,

                    activo:
                        true,
                })
                .select(`
                    id,
                    auth_user_id,
                    negocio_id,
                    nombre,
                    rol,
                    activo,
                    created_at
                `)
                .single();


        if (
            usuarioError ||
            !nuevoUsuario
        ) {

            console.error(
                "Error creando usuario:",
                usuarioError
            );


            /*
             * Rollback Auth.
             */

            await supabaseAdmin.auth.admin.deleteUser(
                authUserId
            );


            return NextResponse.json(
                {
                    error:
                        usuarioError?.message ||
                        "No se pudo crear el usuario.",
                },
                {
                    status: 400,
                }
            );
        }


        usuarioCreadoId =
            nuevoUsuario.id;


        /*
         * ==========================================
         * 11. ASIGNAR SUCURSALES
         * ==========================================
         */

        if (
            sucursales.length > 0
        ) {

            const registrosSucursales =
                sucursales.map(
                    (
                        sucursalId: string
                    ) => ({
                        usuario_id:
                            nuevoUsuario.id,

                        sucursal_id:
                            sucursalId,
                    })
                );


            const {
                error:
                errorAsignandoSucursales,
            } =
                await supabaseAdmin
                    .from(
                        "usuario_sucursales"
                    )
                    .insert(
                        registrosSucursales
                    );


            if (
                errorAsignandoSucursales
            ) {

                throw new Error(
                    errorAsignandoSucursales.message
                );
            }
        }


        /*
         * ==========================================
         * 12. ASIGNAR CAJAS
         * ==========================================
         */

        if (
            cajas.length > 0
        ) {

            const registrosCajas =
                cajas.map(
                    (
                        cajaId: string
                    ) => ({
                        usuario_id:
                            nuevoUsuario.id,

                        caja_id:
                            cajaId,
                    })
                );


            const {
                error:
                errorAsignandoCajas,
            } =
                await supabaseAdmin
                    .from(
                        "usuario_cajas"
                    )
                    .insert(
                        registrosCajas
                    );


            if (
                errorAsignandoCajas
            ) {

                throw new Error(
                    errorAsignandoCajas.message
                );
            }
        }


        /*
         * ==========================================
         * 13. RESPUESTA
         * ==========================================
         */

        return NextResponse.json(
            {
                success: true,

                usuario:
                    nuevoUsuario,
            },
            {
                status: 201,
            }
        );


    } catch (error) {

        console.error(
            "❌ Error creando usuario:",
            error
        );


        /*
         * ==========================================
         * ROLLBACK
         * ==========================================
         *
         * Si algo falla después de crear
         * el usuario, intentamos limpiar
         * todo lo que ya se haya creado.
         */

        if (
            usuarioCreadoId
        ) {

            await supabaseAdmin
                .from(
                    "usuario_cajas"
                )
                .delete()
                .eq(
                    "usuario_id",
                    usuarioCreadoId
                );


            await supabaseAdmin
                .from(
                    "usuario_sucursales"
                )
                .delete()
                .eq(
                    "usuario_id",
                    usuarioCreadoId
                );


            await supabaseAdmin
                .from("usuarios")
                .delete()
                .eq(
                    "id",
                    usuarioCreadoId
                );
        }


        if (
            authUserId
        ) {

            await supabaseAdmin.auth.admin.deleteUser(
                authUserId
            );
        }


        return NextResponse.json(
            {
                error:
                    error instanceof Error
                        ? error.message
                        : "Ocurrió un error inesperado al crear el usuario.",
            },
            {
                status: 500,
            }
        );
    }
}