import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export async function POST(request: NextRequest) {
    try {
        // =========================================================
        // 1. OBTENER ACCESS TOKEN
        // =========================================================

        const accessToken =
            process.env.MERCADOPAGO_ACCESS_TOKEN;

        if (!accessToken) {
            return NextResponse.json(
                {
                    ok: false,
                    error:
                        "MERCADOPAGO_ACCESS_TOKEN no está configurado en las variables de entorno.",
                },
                { status: 500 }
            );
        }

        // =========================================================
        // 2. RECIBIR DATOS DEL POS
        // =========================================================

        const body = await request.json();

        const monto = Number(body?.monto);

        if (!Number.isFinite(monto) || monto <= 0) {
            return NextResponse.json(
                {
                    ok: false,
                    error:
                        "El monto debe ser un número mayor que 0.",
                },
                { status: 400 }
            );
        }

        // =========================================================
        // 3. TERMINAL DE PRUEBA
        // =========================================================
        //
        // Esta es la terminal virtual de sandbox que ya utilizamos
        // correctamente en las pruebas anteriores.
        //
        // IMPORTANTE:
        // Para producción posteriormente utilizaremos el terminal_id
        // real de la terminal compatible con integración PDV.
        //

        const terminalId =
            process.env.MERCADOPAGO_TERMINAL_ID ||
            "NEWLAND_N950__SBX0000001";

        // =========================================================
        // 4. REFERENCIA EXTERNA
        // =========================================================
        //
        // Debe ser única para cada Order.
        //

        const externalReference =
            `pos-${Date.now()}-${crypto
                .randomBytes(4)
                .toString("hex")}`;

        // =========================================================
        // 5. IDEMPOTENCY KEY
        // =========================================================
        //
        // Evita crear dos Orders iguales accidentalmente si la
        // petición se repite.
        //

        const idempotencyKey = crypto.randomUUID();

        // =========================================================
        // 6. BODY PARA MERCADO PAGO
        // =========================================================

        const orderBody = {
            type: "point",

            external_reference: externalReference,

            expiration_time: "PT15M",

            transactions: {
                payments: [
                    {
                        amount: monto.toFixed(2),
                    },
                ],
            },

            config: {
                point: {
                    terminal_id: terminalId,
                    print_on_terminal: "no_ticket",
                },
            },

            description:
                "Punto de Venta Soporte IT - Cobro con tarjeta",
        };

        console.log(
            "========================================"
        );
        console.log(
            "MERCADO PAGO - CREANDO ORDER"
        );
        console.log(
            "========================================"
        );
        console.log(
            "Monto:",
            monto.toFixed(2)
        );
        console.log(
            "Terminal:",
            terminalId
        );
        console.log(
            "External Reference:",
            externalReference
        );

        // =========================================================
        // 7. CREAR ORDER
        // =========================================================

        const response = await fetch(
            "https://api.mercadopago.com/v1/orders",
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

                body: JSON.stringify(orderBody),

                cache: "no-store",
            }
        );

        // =========================================================
        // 8. LEER RESPUESTA
        // =========================================================

        const data = await response.json();

        // =========================================================
        // 9. ERROR DE MERCADO PAGO
        // =========================================================

        if (!response.ok) {
            console.error(
                "Mercado Pago error creando Order:",
                data
            );

            return NextResponse.json(
                {
                    ok: false,

                    status: response.status,

                    error:
                        data,

                    external_reference:
                        externalReference,

                    terminal_id:
                        terminalId,
                },
                {
                    status:
                        response.status,
                }
            );
        }

        // =========================================================
        // 10. RESPUESTA EXITOSA
        // =========================================================

        console.log(
            "Order creada correctamente:"
        );

        console.log(
            "Order ID:",
            data.id
        );

        console.log(
            "Status:",
            data.status
        );

        return NextResponse.json(
            {
                ok: true,

                mensaje:
                    "Order de Mercado Pago creada correctamente.",

                order_id:
                    data.id,

                status:
                    data.status,

                status_detail:
                    data.status_detail ??
                    null,

                external_reference:
                    data.external_reference ??
                    externalReference,

                terminal_id:
                    terminalId,

                monto:
                    monto.toFixed(2),

                expiration_time:
                    data.expiration_time ??
                    "PT15M",

                data,
            },
            {
                status: 201,
            }
        );
    } catch (error) {
        // =========================================================
        // ERROR GENERAL
        // =========================================================

        console.error(
            "Error creando Order de Mercado Pago:",
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