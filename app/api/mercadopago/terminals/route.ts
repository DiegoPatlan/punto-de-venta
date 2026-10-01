import { NextRequest, NextResponse } from "next/server";

import { createClient } from "@supabase/supabase-js";

import { descifrarToken } from "../../../../lib/mercadopago/cifrado";

function crearSupabaseAdmin() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
        throw new Error(
            "Faltan las variables de entorno de Supabase."
        );
    }

    return createClient(
        supabaseUrl,
        serviceRoleKey,
        {
            auth: {
                autoRefreshToken: false,
                persistSession: false,
            },
        }
    );
}

export async function GET(
    request: NextRequest
) {
    try {
        /*
        ==========================================
        1. VALIDAR CONFIGURACIÓN
        ==========================================
        */

        const supabaseAdmin =
            crearSupabaseAdmin();

        /*
        ==========================================
        2. OBTENER TOKEN DEL USUARIO ACTUAL
        ==========================================
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
                    ok: false,
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
        ==========================================
        3. VALIDAR SESIÓN SUPABASE
        ==========================================
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
            console.error(
                "Error validando sesión Supabase:",
                authError
            );

            return NextResponse.json(
                {
                    ok: false,
                    error:
                        "La sesión no es válida o ha expirado.",
                },
                {
                    status: 401,
                }
            );
        }

        /*
        ==========================================
        4. OBTENER USUARIO DEL SISTEMA
        ==========================================
        */

        const {
            data: usuario,
            error: usuarioError,
        } =
            await supabaseAdmin
                .from("usuarios")
                .select(
                    `
                    id,
                    negocio_id,
                    nombre,
                    rol,
                    activo
                    `
                )
                .eq(
                    "auth_user_id",
                    authData.user.id
                )
                .eq(
                    "activo",
                    true
                )
                .single();

        if (
            usuarioError ||
            !usuario
        ) {
            console.error(
                "Error obteniendo usuario:",
                usuarioError
            );

            return NextResponse.json(
                {
                    ok: false,
                    error:
                        "No se encontró el usuario actual en el sistema.",
                },
                {
                    status: 403,
                }
            );
        }

        /*
        ==========================================
        5. VALIDAR ROL
        ==========================================
        */

        if (
            usuario.rol !== "admin"
        ) {
            return NextResponse.json(
                {
                    ok: false,
                    error:
                        "Solo un administrador puede consultar las terminales de Mercado Pago.",
                },
                {
                    status: 403,
                }
            );
        }

        /*
        ==========================================
        6. VALIDAR NEGOCIO
        ==========================================
        */

        if (!usuario.negocio_id) {
            return NextResponse.json(
                {
                    ok: false,
                    error:
                        "El usuario no tiene un negocio asociado.",
                },
                {
                    status: 400,
                }
            );
        }

        /*
        ==========================================
        7. OBTENER CREDENCIALES
        ==========================================
        */

        const {
            data: credenciales,
            error: credencialesError,
        } =
            await supabaseAdmin
                .from(
                    "mercado_pago_credenciales"
                )
                .select(
                    `
                    access_token_encrypted,
                    expires_at,
                    usuario_mercado_pago_id
                    `
                )
                .eq(
                    "negocio_id",
                    usuario.negocio_id
                )
                .maybeSingle();

        if (
            credencialesError
        ) {
            console.error(
                "Error obteniendo credenciales de Mercado Pago:",
                credencialesError
            );

            return NextResponse.json(
                {
                    ok: false,
                    error:
                        "No se pudieron consultar las credenciales de Mercado Pago.",
                },
                {
                    status: 500,
                }
            );
        }

        if (
            !credenciales
        ) {
            return NextResponse.json(
                {
                    ok: false,
                    error:
                        "El negocio todavía no está conectado con Mercado Pago.",
                },
                {
                    status: 400,
                }
            );
        }

        /*
        ==========================================
        8. DESCIFRAR ACCESS TOKEN
        ==========================================
        */

        let mercadoPagoAccessToken: string;

        try {
            mercadoPagoAccessToken =
                descifrarToken(
                    credenciales.access_token_encrypted
                );
        } catch (error) {
            console.error(
                "Error descifrando Access Token de Mercado Pago:",
                error
            );

            return NextResponse.json(
                {
                    ok: false,
                    error:
                        "No se pudo acceder de forma segura a las credenciales de Mercado Pago.",
                },
                {
                    status: 500,
                }
            );
        }

        /*
        ==========================================
        9. CONSULTAR TERMINALES
        ==========================================
        */

        const terminalesResponse =
            await fetch(
                "https://api.mercadopago.com/terminals/v1/list?limit=50&offset=0",
                {
                    method: "GET",
                    headers: {
                        "Content-Type":
                            "application/json",
                        Authorization:
                            `Bearer ${mercadoPagoAccessToken}`,
                    },
                    cache: "no-store",
                }
            );

        const terminalesData =
            await terminalesResponse
                .json()
                .catch(
                    () => null
                );

        /*
        ==========================================
        10. MOSTRAR RESPUESTA REAL EN SERVIDOR
        ==========================================
        */

        console.log(
            "========================================"
        );

        console.log(
            "MERCADO PAGO - CONSULTANDO TERMINALES"
        );

        console.log(
            "========================================"
        );

        console.log(
            "Negocio ID:",
            usuario.negocio_id
        );

        console.log(
            "HTTP Status:",
            terminalesResponse.status
        );

        console.log(
            "Respuesta Mercado Pago:",
            terminalesData
        );

        /*
        ==========================================
        11. VALIDAR RESPUESTA
        ==========================================
        */

        if (
            !terminalesResponse.ok
        ) {
            console.error(
                "Mercado Pago devolvió error al consultar terminales:",
                {
                    status:
                        terminalesResponse.status,
                    response:
                        terminalesData,
                }
            );

            if (
                terminalesResponse.status ===
                401
            ) {
                return NextResponse.json(
                    {
                        ok: false,
                        error:
                            "La autorización de Mercado Pago expiró o ya no es válida.",
                    },
                    {
                        status: 401,
                    }
                );
            }

            return NextResponse.json(
                {
                    ok: false,
                    error:
                        "Mercado Pago no pudo consultar las terminales.",
                    detalle:
                        terminalesData,
                },
                {
                    status:
                        terminalesResponse.status,
                }
            );
        }

        /*
        ==========================================
        12. EXTRAER TERMINALES
        ==========================================
        */

        const terminalesMercadoPago =
            Array.isArray(
                terminalesData?.data
                    ?.terminals
            )
                ? terminalesData.data.terminals
                : [];

        /*
        ==========================================
        13. NORMALIZAR TERMINALES
        ==========================================
        */

        const terminales =
            terminalesMercadoPago.map(
                (terminal: {
                    id?: string;
                    pos_id?: number | string;
                    store_id?: number | string;
                    external_pos_id?: string;
                    operating_mode?: string;
                }) => {
                    const id =
                        terminal.id ??
                        "";

                    const partesId =
                        id.split("__");

                    const terminalType =
                        partesId[0] ??
                        null;

                    const serialNumber =
                        partesId.length > 1
                            ? partesId
                                .slice(1)
                                .join("__")
                            : null;

                    let modelo =
                        "Point";

                    if (
                        terminalType ===
                        "NEWLAND_N950"
                    ) {
                        modelo =
                            "Point Smart 2";
                    } else if (
                        terminalType ===
                        "PAX_A910"
                    ) {
                        modelo =
                            "Point Smart";
                    }

                    return {
                        id,

                        /*
                        Campo original de Mercado Pago
                        */
                        terminal_id: id,

                        /*
                        Información de identificación
                        */
                        terminal_type:
                            terminalType,

                        serial_number:
                            serialNumber,

                        modelo,

                        nombre:
                            serialNumber
                                ? `${modelo} - ${serialNumber}`
                                : modelo,

                        /*
                        Información de Mercado Pago
                        */
                        pos_id:
                            terminal.pos_id ??
                            null,

                        store_id:
                            terminal.store_id ??
                            null,

                        external_pos_id:
                            terminal.external_pos_id ??
                            null,

                        operating_mode:
                            terminal.operating_mode ??
                            "UNDEFINED",

                        /*
                        Estado amigable para el frontend
                        */
                        estado:
                            terminal.operating_mode ===
                                "PDV"
                                ? "integrada"
                                : terminal.operating_mode ===
                                    "STANDALONE"
                                    ? "independiente"
                                    : "no_configurada",
                    };
                }
            );

        /*
        ==========================================
        14. LOG DE TERMINALES ENCONTRADAS
        ==========================================
        */

        console.log(
            "Terminales encontradas:",
            terminales
        );

        /*
        ==========================================
        15. RESPUESTA
        ==========================================
        */

        return NextResponse.json(
            {
                ok: true,
                terminales,
                total:
                    terminales.length,

                /*
                Información adicional
                para diagnóstico.
                */

                terminales_originales:
                    terminalesMercadoPago,
            },
            {
                status: 200,
            }
        );
    } catch (error) {
        console.error(
            "Error consultando terminales de Mercado Pago:",
            error
        );

        return NextResponse.json(
            {
                ok: false,
                error:
                    "No se pudieron consultar las terminales de Mercado Pago.",
            },
            {
                status: 500,
            }
        );
    }
}