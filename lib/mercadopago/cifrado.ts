import "server-only";

import crypto from "crypto";

function obtenerClave(): Buffer {
    const clave = process.env.MERCADOPAGO_TOKEN_ENCRYPTION_KEY;

    if (!clave) {
        throw new Error(
            "Falta configurar MERCADOPAGO_TOKEN_ENCRYPTION_KEY."
        );
    }

    const buffer = Buffer.from(clave, "base64");

    if (buffer.length !== 32) {
        throw new Error(
            "La clave de cifrado debe contener 32 bytes."
        );
    }

    return buffer;
}

export function cifrarToken(token: string): string {
    const clave = obtenerClave();
    const iv = crypto.randomBytes(12);

    const cipher = crypto.createCipheriv(
        "aes-256-gcm",
        clave,
        iv
    );

    const cifrado = Buffer.concat([
        cipher.update(token, "utf8"),
        cipher.final(),
    ]);

    const tag = cipher.getAuthTag();

    return [
        iv.toString("base64"),
        tag.toString("base64"),
        cifrado.toString("base64"),
    ].join(".");
}

export function descifrarToken(valor: string): string {
    const clave = obtenerClave();
    const partes = valor.split(".");

    if (partes.length !== 3) {
        throw new Error("El token cifrado tiene un formato inválido.");
    }

    const [ivBase64, tagBase64, contenidoBase64] = partes;

    const iv = Buffer.from(ivBase64, "base64");
    const tag = Buffer.from(tagBase64, "base64");
    const contenido = Buffer.from(contenidoBase64, "base64");

    if (iv.length !== 12 || tag.length !== 16) {
        throw new Error("El token cifrado está dañado.");
    }

    const decipher = crypto.createDecipheriv(
        "aes-256-gcm",
        clave,
        iv
    );

    decipher.setAuthTag(tag);

    const descifrado = Buffer.concat([
        decipher.update(contenido),
        decipher.final(),
    ]);

    return descifrado.toString("utf8");
}