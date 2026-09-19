import { NextRequest, NextResponse } from "next/server";

import crypto from "crypto";

import { createClient } from "@supabase/supabase-js";

import { descifrarToken } from "../../../../../../lib/mercadopago/cifrado";

type Params = {
    params: Promise<{
        order_id: string;
    }>;
};

function obtenerSupabaseAdmin() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
        throw new Error(
            "Las variables de entorno de Supabase no están configuradas."
        );
    }

    return createClient(
        supabaseUrl,
        serviceRoleKey,
        {
            auth: {
                persistSession: false,
                autoRefreshToken: false,
            },
        }
    );
}

export async function POST(
    request: NextRequest,
    { params }: Params
) {
    try {
        const { order_id } = await params;

        if (!order_id) {
            return NextResponse.json(
                {
                    ok: false,
                    error: "Falta el order_id.",
                },
                {
                    status: 400,
                }
            );
        }

        // ============================================================
        // 1. AUTENTICAR USUARIO
        // ============================================================

        const authorization =
            request.headers.get("authorization");

        if (!authorization) {
            return NextResponse.json(
                {
                    ok: false,
                    error: "No autorizado.",
                },
                {
                    status: 401,
                }
            );
        }

        const [tipo, accessTokenUsuario] =
            authorization.split(" ");

        if (
            tipo !== "Bearer" ||
            !accessTokenUsuario
        ) {
            return NextResponse.json(
                {
                    ok: false,
                    error: "Token de autorización inválido.",
                },
                {
                    status: 401,
                }
            );
        }

        const supabaseAdmin =
            obtenerSupabaseAdmin();

        const {
            data: {
                user,
            },
            error: errorUsuario,
        } =
            await supabaseAdmin.auth.getUser(
                accessTokenUsuario
            );

        if (
            errorUsuario ||
            !user
        ) {
            console.error(
                "Error validando usuario:",
                errorUsuario
            );

            return NextResponse.json(
                {
                    ok: false,
                    error: "No autorizado.",
                },
                {
                    status: 401,
                }
            );
        }

        // ============================================================
        // 2. OBTENER USUARIO Y NEGOCIO
        // ============================================================

        const {
            data: usuario,
            error: errorUsuarioDB,
        } =
            await supabaseAdmin
                .from("usuarios")
                .select(
                    "id, negocio_id, activo"
                )
                .eq(
                    "auth_user_id",
                    user.id
                )
                .maybeSingle();

        if (
            errorUsuarioDB ||
            !usuario
        ) {
            console.error(
                "Error obteniendo usuario:",
                errorUsuarioDB
            );

            return NextResponse.json(
                {
                    ok: false,
                    error:
                        "No se pudo validar el usuario.",
                },
                {
                    status: 403,
                }
            );
        }

        if (!usuario.activo) {
            return NextResponse.json(
                {
                    ok: false,
                    error:
                        "El usuario está inactivo.",
                },
                {
                    status: 403,
                }
            );
        }

        if (!usuario.negocio_id) {
            return NextResponse.json(
                {
                    ok: false,
                    error:
                        "El usuario no tiene un negocio asociado.",
                },
                {
                    status: 403,
                }
            );
        }

        const negocioId =
            usuario.negocio_id;

        // ============================================================
        // 3. BUSCAR LA ORDER LOCAL
        // ============================================================

        const {
            data: ordenLocal,
            error: errorOrden,
        } =
            await supabaseAdmin
                .from("mercado_pago_orders")
                .select(
                    `
                    id,
                    negocio_id,
                    order_id,
                    external_reference,
                    monto,
                    estado,
                    estado_detalle
                    `
                )
                .eq(
                    "order_id",
                    order_id
                )
                .maybeSingle();

        if (errorOrden) {
            console.error(
                "Error buscando order local:",
                errorOrden
            );

            return NextResponse.json(
                {
                    ok: false,
                    error:
                        "No se pudo consultar la orden de Mercado Pago.",
                },
                {
                    status: 500,
                }
            );
        }

        if (!ordenLocal) {
            return NextResponse.json(
                {
                    ok: false,
                    error:
                        "La orden de Mercado Pago no existe.",
                    order_id,
                },
                {
                    status: 404,
                }
            );
        }

        // ============================================================
        // 4. VALIDAR QUE LA ORDER PERTENECE AL NEGOCIO
        // ============================================================

        if (
            ordenLocal.negocio_id !==
            negocioId
        ) {
            console.error(
                "Intento de cancelar order de otro negocio.",
                {
                    order_id,
                    negocioUsuario: negocioId,
                    negocioOrden:
                        ordenLocal.negocio_id,
                }
            );

            return NextResponse.json(
                {
                    ok: false,
                    error:
                        "La orden no pertenece al negocio del usuario.",
                },
                {
                    status: 403,
                }
            );
        }

        // ============================================================
        // 5. OBTENER CREDENCIALES OAUTH DEL NEGOCIO
        // ============================================================

        const {
            data: credenciales,
            error: errorCredenciales,
        } =
            await supabaseAdmin
                .from(
                    "mercado_pago_credenciales"
                )
                .select(
                    `
                    access_token_encrypted,
                    expires_at
                    `
                )
                .eq(
                    "negocio_id",
                    negocioId
                )
                .maybeSingle();

        if (errorCredenciales) {
            console.error(
                "Error obteniendo credenciales de Mercado Pago:",
                errorCredenciales
            );

            return NextResponse.json(
                {
                    ok: false,
                    error:
                        "No se pudieron obtener las credenciales de Mercado Pago.",
                },
                {
                    status: 500,
                }
            );
        }

        if (!credenciales) {
            return NextResponse.json(
                {
                    ok: false,
                    error:
                        "Este negocio no tiene Mercado Pago conectado.",
                },
                {
                    status: 400,
                }
            );
        }

        // ============================================================
        // 6. VALIDAR EXPIRACIÓN DEL TOKEN
        // ============================================================

        if (
            credenciales.expires_at
        ) {
            const expiresAt =
                new Date(
                    credenciales.expires_at
                ).getTime();

            if (
                Number.isFinite(
                    expiresAt
                ) &&
                expiresAt <= Date.now()
            ) {
                return NextResponse.json(
                    {
                        ok: false,
                        error:
                            "La conexión con Mercado Pago ha expirado. Es necesario reconectar la cuenta.",
                    },
                    {
                        status: 401,
                    }
                );
            }
        }

        // ============================================================
        // 7. DESCIFRAR ACCESS TOKEN
        // ============================================================

        let accessToken: string;

        try {
            accessToken =
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
                        "No se pudo obtener de forma segura la conexión con Mercado Pago.",
                },
                {
                    status: 500,
                }
            );
        }

        // ============================================================
        // 8. GENERAR IDEMPOTENCY KEY
        // ============================================================

        const idempotencyKey =
            crypto.randomUUID();

        console.log(
            "========================================"
        );

        console.log(
            "MERCADO PAGO - CANCELANDO ORDER"
        );

        console.log(
            "========================================"
        );

        console.log(
            "Order ID:",
            order_id
        );

        console.log(
            "Negocio ID:",
            negocioId
        );

        console.log(
            "Idempotency Key:",
            idempotencyKey
        );

        // ============================================================
        // 9. CANCELAR ORDER EN MERCADO PAGO
        // ============================================================

        const response =
            await fetch(
                `https://api.mercadopago.com/v1/orders/${order_id}/cancel`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json",

                        Authorization:
                            `Bearer ${accessToken}`,

                        "X-Idempotency-Key":
                            idempotencyKey,
                    },

                    cache: "no-store",
                }
            );

        const data =
            await response
                .json()
                .catch(
                    () => null
                );

        console.log(
            "HTTP Status:",
            response.status
        );

        console.log(
            "Respuesta Mercado Pago:",
            data
        );

        // ============================================================
        // 10. ERROR DE MERCADO PAGO
        // ============================================================

        if (!response.ok) {
            console.error(
                "❌ ERROR CANCELANDO ORDER MERCADO PAGO:",
                data
            );

            return NextResponse.json(
                {
                    ok: false,
                    status:
                        response.status,
                    error: data,
                    order_id,
                },
                {
                    status:
                        response.status,
                }
            );
        }

        // ============================================================
        // 11. ACTUALIZAR ORDER LOCAL
        // ============================================================

        const nuevoEstado =
            data?.status ??
            "canceled";

        const nuevoEstadoDetalle =
            data?.status_detail ??
            null;

        const {
            error: errorActualizacion,
        } =
            await supabaseAdmin
                .from(
                    "mercado_pago_orders"
                )
                .update(
                    {
                        estado:
                            nuevoEstado,
                        estado_detalle:
                            nuevoEstadoDetalle,
                    }
                )
                .eq(
                    "id",
                    ordenLocal.id
                )
                .eq(
                    "negocio_id",
                    negocioId
                );

        if (errorActualizacion) {
            console.error(
                "⚠️ Order cancelada en Mercado Pago, pero no se pudo actualizar el registro local:",
                errorActualizacion
            );
        }

        console.log(
            "✅ ORDER CANCELADA CORRECTAMENTE"
        );

        // ============================================================
        // 12. RESPUESTA
        // ============================================================

        return NextResponse.json(
            {
                ok: true,

                mensaje:
                    "Order de Mercado Pago cancelada correctamente.",

                order_id:
                    data?.id ??
                    order_id,

                status:
                    data?.status ??
                    "canceled",

                status_detail:
                    data?.status_detail ??
                    null,

                data,
            },
            {
                status: 200,
            }
        );
    } catch (error) {
        console.error(
            "❌ ERROR INTERNO CANCELANDO ORDER MERCADO PAGO:",
            error
        );

        return NextResponse.json(
            {
                ok: false,
                error:
                    "Error interno al comunicarse con Mercado Pago.",
            },
            {
                status: 500,
            }
        );
    }
}