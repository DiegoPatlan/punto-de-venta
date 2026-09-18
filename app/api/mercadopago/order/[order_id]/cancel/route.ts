import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

type Params = {
    params: Promise<{
        order_id: string;
    }>;
};

export async function POST(
    _request: NextRequest,
    { params }: Params
) {
    try {
        const accessToken =
            process.env.MERCADOPAGO_ACCESS_TOKEN;

        if (!accessToken) {
            return NextResponse.json(
                {
                    ok: false,
                    error:
                        "MERCADOPAGO_ACCESS_TOKEN no está configurado.",
                },
                { status: 500 }
            );
        }

        const { order_id } = await params;

        if (!order_id) {
            return NextResponse.json(
                {
                    ok: false,
                    error: "Falta el order_id.",
                },
                { status: 400 }
            );
        }

        const idempotencyKey = crypto.randomUUID();

        console.log("========================================");
        console.log("MERCADO PAGO - CANCELANDO ORDER");
        console.log("========================================");
        console.log("Order ID:", order_id);
        console.log("Idempotency Key:", idempotencyKey);

        const response = await fetch(
            `https://api.mercadopago.com/v1/orders/${order_id}/cancel`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${accessToken}`,
                    "X-Idempotency-Key": idempotencyKey,
                },
                cache: "no-store",
            }
        );

        const data = await response.json().catch(() => null);

        console.log("HTTP Status:", response.status);
        console.log("Respuesta Mercado Pago:", data);

        if (!response.ok) {
            console.error(
                "❌ ERROR CANCELANDO ORDER MERCADO PAGO:",
                data
            );

            return NextResponse.json(
                {
                    ok: false,
                    status: response.status,
                    error: data,
                    order_id,
                },
                {
                    status: response.status,
                }
            );
        }

        console.log("✅ ORDER CANCELADA CORRECTAMENTE");

        return NextResponse.json(
            {
                ok: true,
                mensaje:
                    "Order de Mercado Pago cancelada correctamente.",
                order_id: data?.id ?? order_id,
                status: data?.status ?? "canceled",
                status_detail:
                    data?.status_detail ?? null,
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