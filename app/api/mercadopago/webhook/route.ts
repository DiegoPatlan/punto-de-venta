import { NextRequest, NextResponse } from "next/server";

import crypto from "crypto";

import { createClient } from "@supabase/supabase-js";

import { descifrarToken } from "../../../../lib/mercadopago/cifrado";

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

// ============================================================
// VALIDAR FIRMA DEL WEBHOOK DE MERCADO PAGO
// ============================================================

function validarFirmaWebhook(
    request: NextRequest,
    dataId: string
): boolean {
    const secret =
        process.env.MERCADOPAGO_WEBHOOK_SECRET;

    if (!secret) {
        throw new Error(
            "Falta configurar MERCADOPAGO_WEBHOOK_SECRET."
        );
    }

    const xSignature =
        request.headers.get("x-signature");

    const xRequestId =
        request.headers.get("x-request-id");

    if (!xSignature || !xRequestId) {
        return false;
    }

    const partesFirma =
        xSignature.split(",");

    let ts: string | null = null;
    let v1: string | null = null;

    for (const parte of partesFirma) {
        const [clave, valor] =
            parte.split("=");

        if (!clave || !valor) {
            continue;
        }

        if (clave.trim() === "ts") {
            ts = valor.trim();
        }

        if (clave.trim() === "v1") {
            v1 = valor.trim();
        }
    }

    if (!ts || !v1) {
        return false;
    }

    const manifest =
        `id:${dataId};request-id:${xRequestId};ts:${ts};`;

    const firmaEsperada =
        crypto
            .createHmac(
                "sha256",
                secret
            )
            .update(manifest)
            .digest("hex");

    const firmaRecibida =
        v1.toLowerCase();

    if (
        firmaEsperada.length !==
        firmaRecibida.length
    ) {
        return false;
    }

    return crypto.timingSafeEqual(
        Buffer.from(
            firmaEsperada,
            "utf8"
        ),
        Buffer.from(
            firmaRecibida,
            "utf8"
        )
    );
}

// ============================================================
// POST WEBHOOK
// ============================================================

export async function POST(
    request: NextRequest
) {
    try {
        // ========================================================
        // 1. LEER QUERY PARAMETERS
        // ========================================================

        const url =
            new URL(request.url);

        const dataId =
            url.searchParams.get(
                "data.id"
            );

        const type =
            url.searchParams.get(
                "type"
            );

        // ========================================================
        // 2. LEER BODY
        // ========================================================

        const body =
            await request
                .json()
                .catch(() => null);

        const action =
            body?.action ??
            null;

        const bodyOrderId =
            body?.data?.id ??
            null;

        const orderId =
            dataId ??
            bodyOrderId ??
            null;

        console.log(
            "================================="
        );

        console.log(
            "MERCADO PAGO WEBHOOK RECIBIDO"
        );

        console.log(
            "================================="
        );

        console.log(
            "Type:",
            type
        );

        console.log(
            "Action:",
            action
        );

        console.log(
            "Order ID:",
            orderId
        );

        // ========================================================
        // 3. VALIDAR TIPO DE NOTIFICACIÓN
        // ========================================================

        if (
            type &&
            type !== "order"
        ) {
            console.log(
                "Webhook ignorado por tipo:",
                type
            );

            return NextResponse.json(
                {
                    ok: true,
                    received: true,
                    ignored: true,
                    reason:
                        "Tipo de notificación no utilizado por esta integración.",
                },
                {
                    status: 200,
                }
            );
        }

        if (!orderId) {
            console.error(
                "Webhook recibido sin order_id."
            );

            return NextResponse.json(
                {
                    ok: false,
                    error:
                        "La notificación no contiene order_id.",
                },
                {
                    status: 400,
                }
            );
        }

        // ========================================================
        // 4. VALIDAR FIRMA
        // ========================================================

        let firmaValida: boolean;

        try {
            firmaValida =
                validarFirmaWebhook(
                    request,
                    orderId
                );
        } catch (error) {
            console.error(
                "Error configurando validación del webhook:",
                error
            );

            return NextResponse.json(
                {
                    ok: false,
                    error:
                        "El webhook no está correctamente configurado.",
                },
                {
                    status: 500,
                }
            );
        }

        if (!firmaValida) {
            console.error(
                "❌ FIRMA DE WEBHOOK INVÁLIDA"
            );

            return NextResponse.json(
                {
                    ok: false,
                    error:
                        "Firma de webhook inválida.",
                },
                {
                    status: 401,
                }
            );
        }

        console.log(
            "✅ Firma del webhook válida."
        );

        // ========================================================
        // 5. SUPABASE ADMIN
        // ========================================================

        const supabaseAdmin =
            obtenerSupabaseAdmin();

        // ========================================================
        // 6. BUSCAR ORDER LOCAL
        // ========================================================

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
                    orderId
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
                        "No se pudo consultar la orden local.",
                },
                {
                    status: 500,
                }
            );
        }

        // ========================================================
        // 7. ORDER TODAVÍA NO REGISTRADA LOCALMENTE
        // ========================================================

        if (!ordenLocal) {
            console.warn(
                "Webhook recibido para una order que todavía no existe localmente:",
                orderId
            );

            /*
             * No creamos automáticamente una order aquí.
             *
             * La order debe originarse desde nuestro POS.
             * De esta manera evitamos que una notificación externa
             * cree registros que nuestra aplicación no inició.
             *
             * Respondemos 200 porque la notificación fue recibida
             * correctamente y no queremos generar reintentos
             * indefinidos por una order desconocida.
             */

            return NextResponse.json(
                {
                    ok: true,
                    received: true,
                    order_id: orderId,
                    estado:
                        "order_no_registrada_localmente",
                },
                {
                    status: 200,
                }
            );
        }

        const negocioId =
            ordenLocal.negocio_id;

        // ========================================================
        // 8. OBTENER CREDENCIALES OAUTH DEL NEGOCIO
        // ========================================================

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
                "Error obteniendo credenciales OAuth:",
                errorCredenciales
            );

            return NextResponse.json(
                {
                    ok: false,
                    error:
                        "No se pudieron obtener las credenciales del negocio.",
                },
                {
                    status: 500,
                }
            );
        }

        if (!credenciales) {
            console.error(
                "El negocio no tiene credenciales de Mercado Pago:",
                negocioId
            );

            return NextResponse.json(
                {
                    ok: false,
                    error:
                        "El negocio no tiene Mercado Pago conectado.",
                },
                {
                    status: 500,
                }
            );
        }

        // ========================================================
        // 9. VALIDAR EXPIRACIÓN DEL TOKEN
        // ========================================================

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
                console.error(
                    "El Access Token del negocio ha expirado:",
                    negocioId
                );

                return NextResponse.json(
                    {
                        ok: false,
                        error:
                            "La conexión con Mercado Pago ha expirado.",
                    },
                    {
                        status: 500,
                    }
                );
            }
        }

        // ========================================================
        // 10. DESCIFRAR ACCESS TOKEN
        // ========================================================

        let accessToken: string;

        try {
            accessToken =
                descifrarToken(
                    credenciales.access_token_encrypted
                );
        } catch (error) {
            console.error(
                "Error descifrando Access Token:",
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

        // ========================================================
        // 11. CONSULTAR ORDER DIRECTAMENTE A MERCADO PAGO
        // ========================================================

        console.log(
            "Consultando order en Mercado Pago:",
            orderId
        );

        const response =
            await fetch(
                `https://api.mercadopago.com/v1/orders/${orderId}`,
                {
                    method: "GET",

                    headers: {
                        Authorization:
                            `Bearer ${accessToken}`,

                        Accept:
                            "application/json",
                    },

                    cache: "no-store",
                }
            );

        const data =
            await response
                .json()
                .catch(() => null);

        console.log(
            "HTTP Status Mercado Pago:",
            response.status
        );

        if (!response.ok) {
            console.error(
                "Error consultando order en Mercado Pago:",
                data
            );

            return NextResponse.json(
                {
                    ok: false,
                    error:
                        "No se pudo consultar la order en Mercado Pago.",
                },
                {
                    status: 502,
                }
            );
        }

        // ========================================================
        // 12. EXTRAER ESTADO REAL DE MERCADO PAGO
        // ========================================================

        const estadoMercadoPago =
            data?.status ??
            null;

        const estadoDetalleMercadoPago =
            data?.status_detail ??
            null;

        if (!estadoMercadoPago) {
            console.error(
                "Mercado Pago no devolvió un estado para la order:",
                orderId
            );

            return NextResponse.json(
                {
                    ok: false,
                    error:
                        "Mercado Pago no devolvió el estado de la order.",
                },
                {
                    status: 502,
                }
            );
        }

        // ========================================================
        // 13. ACTUALIZACIÓN IDEMPOTENTE LOCAL
        // ========================================================

        const mismoEstado =
            ordenLocal.estado ===
            estadoMercadoPago &&
            ordenLocal.estado_detalle ===
            estadoDetalleMercadoPago;

        if (mismoEstado) {
            console.log(
                "Order ya se encuentra sincronizada:",
                orderId
            );
        } else {
            const {
                error:
                errorActualizacion,
            } =
                await supabaseAdmin
                    .from(
                        "mercado_pago_orders"
                    )
                    .update(
                        {
                            estado:
                                estadoMercadoPago,

                            estado_detalle:
                                estadoDetalleMercadoPago,
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
                    "Error actualizando order local:",
                    errorActualizacion
                );

                return NextResponse.json(
                    {
                        ok: false,
                        error:
                            "La order fue consultada, pero no se pudo actualizar su estado local.",
                    },
                    {
                        status: 500,
                    }
                );
            }

            console.log(
                "✅ Order local actualizada:"
            );

            console.log(
                "Estado anterior:",
                ordenLocal.estado
            );

            console.log(
                "Estado nuevo:",
                estadoMercadoPago
            );
        }

        // ========================================================
        // 14. RESPUESTA
        // ========================================================

        return NextResponse.json(
            {
                ok: true,

                received: true,

                order_id:
                    orderId,

                action,

                estado:
                    estadoMercadoPago,

                status_detail:
                    estadoDetalleMercadoPago,

                sincronizada:
                    !mismoEstado,

                data,
            },
            {
                status: 200,
            }
        );
    } catch (error) {
        console.error(
            "❌ Error procesando webhook de Mercado Pago:",
            error
        );

        return NextResponse.json(
            {
                ok: false,
                error:
                    "No se pudo procesar la notificación.",
            },
            {
                status: 500,
            }
        );
    }
}