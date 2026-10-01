import { NextRequest, NextResponse } from "next/server";

import crypto from "crypto";

import { createClient } from "@supabase/supabase-js";

import { obtenerCredencialesMercadoPago } from "../../../../../../lib/mercadopago/credenciales";

type Params = {
    params: Promise<{
        order_id: string;
    }>;
};

function obtenerSupabaseAdmin() {
    const supabaseUrl =
        process.env.NEXT_PUBLIC_SUPABASE_URL;

    const serviceRoleKey =
        process.env.SUPABASE_SERVICE_ROLE_KEY;

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
        // ============================================================
        // 1. OBTENER ORDER ID
        // ============================================================

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
        // 2. AUTENTICAR USUARIO
        // ============================================================

        const authorization =
            request.headers.get(
                "authorization"
            );

        if (
            !authorization ||
            !authorization
                .toLowerCase()
                .startsWith("bearer ")
        ) {
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

        const accessTokenUsuario =
            authorization
                .substring(7)
                .trim();

        if (!accessTokenUsuario) {
            return NextResponse.json(
                {
                    ok: false,
                    error:
                        "Token de autorización inválido.",
                },
                {
                    status: 401,
                }
            );
        }

        // ============================================================
        // 3. CLIENTE SUPABASE ADMIN
        // ============================================================

        const supabaseAdmin =
            obtenerSupabaseAdmin();

        // ============================================================
        // 4. VALIDAR SESIÓN DE SUPABASE
        // ============================================================

        const {
            data: usuarioAuth,
            error: errorAuth,
        } =
            await supabaseAdmin.auth.getUser(
                accessTokenUsuario
            );

        if (
            errorAuth ||
            !usuarioAuth?.user
        ) {
            console.error(
                "Error validando usuario:",
                errorAuth
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

        const authUserId =
            usuarioAuth.user.id;

        // ============================================================
        // 5. OBTENER USUARIO Y NEGOCIO
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
                    authUserId
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

        if (usuario.activo === false) {
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

        const negocioId =
            usuario.negocio_id;

        if (!negocioId) {
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

        // ============================================================
        // 6. BUSCAR ORDER LOCAL
        // ============================================================

        const {
            data: ordenLocal,
            error: errorOrden,
        } =
            await supabaseAdmin
                .from(
                    "mercado_pago_orders"
                )
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
        // 7. VALIDAR QUE LA ORDER PERTENEZCA AL NEGOCIO ACTUAL
        // ============================================================

        if (
            ordenLocal.negocio_id !==
            negocioId
        ) {
            console.error(
                "Intento de cancelar order de otro negocio.",
                {
                    order_id,
                    negocioUsuario:
                        negocioId,
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
        // 8. VALIDAR ESTADO LOCAL
        // ============================================================
        //
        // Si nuestro sistema ya sabe que fue aprobada,
        // no debemos intentar cancelarla como si estuviera
        // pendiente.
        //
        // Una Order ya procesada requiere un reembolso,
        // no una cancelación.
        // ============================================================

        if (
            ordenLocal.estado ===
            "aprobado"
        ) {
            return NextResponse.json(
                {
                    ok: false,
                    error:
                        "El cobro ya fue aprobado. No se puede cancelar como una Order pendiente.",
                    order_id,
                    estado:
                        ordenLocal.estado,
                },
                {
                    status: 409,
                }
            );
        }

        // ============================================================
        // 9. OBTENER CREDENCIALES DEL NEGOCIO
        // ============================================================
        //
        // IMPORTANTE:
        // Este helper:
        //
        // - busca por negocio_id
        // - descifra el token
        // - renueva automáticamente el Access Token
        //   cuando está próximo a expirar
        //
        // De esta manera nunca usamos las credenciales
        // de otro negocio.
        // ============================================================

        let credenciales;

        try {
            credenciales =
                await obtenerCredencialesMercadoPago(
                    negocioId
                );
        } catch (error) {
            console.error(
                "Error obteniendo credenciales de Mercado Pago:",
                error
            );

            return NextResponse.json(
                {
                    ok: false,
                    error:
                        "No se pudieron obtener las credenciales de Mercado Pago del negocio.",
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
        // 10. VALIDAR ACCESS TOKEN
        // ============================================================

        const accessToken =
            credenciales.accessToken;

        if (!accessToken) {
            return NextResponse.json(
                {
                    ok: false,
                    error:
                        "No se pudo obtener el Access Token de Mercado Pago.",
                },
                {
                    status: 401,
                }
            );
        }

        // ============================================================
        // 11. GENERAR IDEMPOTENCY KEY
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
        // 12. CANCELAR ORDER EN MERCADO PAGO
        // ============================================================
        //
        // Mercado Pago exige:
        //
        // POST /v1/orders/{order_id}/cancel
        //
        // Authorization
        //
        // X-Idempotency-Key
        //
        // La cancelación vía API aplica cuando la Order
        // todavía puede ser cancelada por API.
        // ============================================================

        const response =
            await fetch(
                `https://api.mercadopago.com/v1/orders/${encodeURIComponent(
                    order_id
                )}/cancel`,
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
        // 13. ERROR MERCADO PAGO
        // ============================================================

        if (!response.ok) {
            console.error(
                "Error cancelando Order Mercado Pago:",
                {
                    status:
                        response.status,
                    order_id,
                    negocioId,
                    data,
                }
            );

            // --------------------------------------------------------
            // Si Mercado Pago indica que la Order ya fue cancelada,
            // sincronizamos nuestro estado local.
            // --------------------------------------------------------

            const errorCode =
                data?.error ??
                data?.code ??
                null;

            const yaCancelada =
                errorCode ===
                "order_already_canceled" ||
                data?.status ===
                "canceled";

            if (yaCancelada) {
                const {
                    error:
                    errorActualizacion,
                } =
                    await supabaseAdmin
                        .from(
                            "mercado_pago_orders"
                        )
                        .update({
                            estado:
                                "cancelado",

                            estado_detalle:
                                data?.status_detail ??
                                "order_already_canceled",
                        })
                        .eq(
                            "id",
                            ordenLocal.id
                        )
                        .eq(
                            "negocio_id",
                            negocioId
                        );

                if (
                    errorActualizacion
                ) {
                    console.error(
                        "La Order ya estaba cancelada en Mercado Pago, pero no se pudo actualizar el registro local:",
                        errorActualizacion
                    );
                }

                return NextResponse.json(
                    {
                        ok: true,

                        ya_cancelada:
                            true,

                        mensaje:
                            "La Order de Mercado Pago ya estaba cancelada.",

                        order_id,

                        status:
                            "canceled",

                        status_detail:
                            data?.status_detail ??
                            null,
                    },
                    {
                        status: 200,
                    }
                );
            }

            // --------------------------------------------------------
            // Caso especial:
            //
            // Si la Order ya llegó a la terminal, Mercado Pago
            // puede indicar que debe cancelarse desde la terminal.
            // --------------------------------------------------------

            const noPuedeCancelarse =
                errorCode ===
                "cannot_cancel_order";

            return NextResponse.json(
                {
                    ok: false,

                    order_id,

                    status:
                        response.status,

                    error: data,

                    puede_cancelarse_por_api:
                        !noPuedeCancelarse,

                    requiere_cancelacion_en_terminal:
                        noPuedeCancelarse,
                },
                {
                    status:
                        response.status,
                }
            );
        }

        // ============================================================
        // 14. OBTENER ESTADO DEVUELTO POR MERCADO PAGO
        // ============================================================

        const nuevoEstadoMercadoPago =
            data?.status ??
            "canceled";

        const nuevoEstadoDetalle =
            data?.status_detail ??
            null;

        // ============================================================
        // 15. VALIDAR QUE REALMENTE QUEDÓ CANCELADA
        // ============================================================

        if (
            nuevoEstadoMercadoPago !==
            "canceled"
        ) {
            console.error(
                "Mercado Pago respondió correctamente, pero la Order no quedó en estado canceled:",
                {
                    order_id,
                    status:
                        nuevoEstadoMercadoPago,
                    status_detail:
                        nuevoEstadoDetalle,
                }
            );

            return NextResponse.json(
                {
                    ok: false,

                    error:
                        "Mercado Pago respondió, pero la Order no quedó cancelada.",

                    order_id,

                    status:
                        nuevoEstadoMercadoPago,

                    status_detail:
                        nuevoEstadoDetalle,

                    data,
                },
                {
                    status: 409,
                }
            );
        }

        // ============================================================
        // 16. ACTUALIZAR ORDER LOCAL
        // ============================================================
        //
        // Aquí usamos nuestro estado interno:
        //
        // Mercado Pago:
        //     canceled
        //
        // POS:
        //     cancelado
        //
        // Esto mantiene consistente la interfaz del POS.
        // ============================================================

        const {
            error: errorActualizacion,
        } =
            await supabaseAdmin
                .from(
                    "mercado_pago_orders"
                )
                .update({
                    estado:
                        "cancelado",

                    estado_detalle:
                        nuevoEstadoDetalle ??
                        "canceled",
                })
                .eq(
                    "id",
                    ordenLocal.id
                )
                .eq(
                    "negocio_id",
                    negocioId
                );

        if (
            errorActualizacion
        ) {
            console.error(
                "Order cancelada en Mercado Pago, pero no se pudo actualizar el registro local:",
                errorActualizacion
            );

            // Importante:
            // No decimos que la operación falló,
            // porque Mercado Pago ya confirmó la cancelación.
            return NextResponse.json(
                {
                    ok: true,

                    sincronizacion_local:
                        false,

                    mensaje:
                        "La Order fue cancelada en Mercado Pago, pero hubo un problema al actualizar el registro local.",

                    order_id,

                    status:
                        nuevoEstadoMercadoPago,

                    status_detail:
                        nuevoEstadoDetalle,
                },
                {
                    status: 200,
                }
            );
        }

        // ============================================================
        // 17. RESPUESTA EXITOSA
        // ============================================================

        console.log(
            "ORDER CANCELADA CORRECTAMENTE"
        );

        return NextResponse.json(
            {
                ok: true,

                sincronizacion_local:
                    true,

                mensaje:
                    "Order de Mercado Pago cancelada correctamente.",

                order_id:
                    data?.id ??
                    order_id,

                status:
                    nuevoEstadoMercadoPago,

                status_detail:
                    nuevoEstadoDetalle,

                data,
            },
            {
                status: 200,
            }
        );
    } catch (error) {
        // ============================================================
        // ERROR GENERAL
        // ============================================================

        console.error(
            "Error interno cancelando Order Mercado Pago:",
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