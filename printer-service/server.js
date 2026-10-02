const http = require("http");
const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");
const { promisify } = require("util");
const sharp = require("sharp");
const printer = require("@ssxv/node-printer");

const execFileAsync = promisify(execFile);

const PORT = 9100;
const HOST = "127.0.0.1";

const LOGO_PATH = path.join(__dirname, "logo.png");
const PRINTER_CONFIG_PATH = path.join(
    __dirname,
    "printer-config.json"
);

const LOGO_MARKER = "{{LOGO_SOPORTE_TI}}";

// Ancho máximo del logo para la impresora térmica.
const LOGO_WIDTH = 160;

// Impresora actualmente seleccionada.
let impresoraActual = null;

// Cola de impresión.
// Esto evita que copia cliente y copia tienda
// se envíen físicamente al mismo tiempo.
let colaImpresion = Promise.resolve();


// ============================================================
// CORS
// ============================================================

function aplicarCORS(res, origin) {
    const origenesPermitidos = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://punto-ventasit.vercel.app",
];

    if (origenesPermitidos.includes(origin)) {
        res.setHeader(
            "Access-Control-Allow-Origin",
            origin
        );
    }

    res.setHeader(
        "Vary",
        "Origin"
    );

    res.setHeader(
        "Access-Control-Allow-Methods",
        "GET,POST,OPTIONS"
    );

    res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type"
    );
}


// ============================================================
// RESPUESTA JSON
// ============================================================

function responderJSON(res, statusCode, datos) {
    if (res.headersSent) {
        return;
    }

    res.writeHead(
        statusCode,
        {
            "Content-Type":
                "application/json; charset=utf-8",
        }
    );

    res.end(
        JSON.stringify(datos)
    );
}


// ============================================================
// LEER BODY
// ============================================================

function leerBody(req) {
    return new Promise(
        (resolve, reject) => {
            let body = "";

            req.on(
                "data",
                (chunk) => {
                    body += chunk.toString();
                }
            );

            req.on(
                "end",
                () => {
                    resolve(body);
                }
            );

            req.on(
                "error",
                reject
            );
        }
    );
}


// ============================================================
// CONFIGURACIÓN DE IMPRESORA
// ============================================================

function leerConfiguracionImpresora() {
    try {
        if (
            !fs.existsSync(
                PRINTER_CONFIG_PATH
            )
        ) {
            return {};
        }

        const contenido =
            fs.readFileSync(
                PRINTER_CONFIG_PATH,
                "utf8"
            );

        if (!contenido.trim()) {
            return {};
        }

        return JSON.parse(
            contenido
        );
    } catch (error) {
        console.error(
            "❌ Error leyendo configuración de impresora:",
            error.message
        );

        return {};
    }
}


function guardarConfiguracionImpresora(nombre) {
    fs.writeFileSync(
        PRINTER_CONFIG_PATH,
        JSON.stringify(
            {
                printer: nombre,
            },
            null,
            2
        ),
        "utf8"
    );
}


// ============================================================
// DETECCIÓN DE IMPRESORAS WINDOWS
// ============================================================

async function obtenerImpresorasWindows() {
    const script = [
        "$printers = @(Get-Printer | Select-Object Name, PrinterStatus, Default, DriverName, PortName)",
        "$printers | ConvertTo-Json -Compress",
    ].join("; ");

    try {
        const { stdout } =
            await execFileAsync(
                "powershell.exe",
                [
                    "-NoProfile",
                    "-NonInteractive",
                    "-ExecutionPolicy",
                    "Bypass",
                    "-Command",
                    script,
                ],
                {
                    windowsHide: true,
                    maxBuffer:
                        1024 * 1024,
                }
            );

        const salida =
            stdout.trim();

        if (!salida) {
            return [];
        }

        const datos =
            JSON.parse(salida);

        if (Array.isArray(datos)) {
            return datos;
        }

        return [datos];
    } catch (error) {
        console.error(
            "❌ Error obteniendo impresoras de Windows:",
            error.message
        );

        return [];
    }
}


// ============================================================
// OBTENER IMPRESORA SELECCIONADA
// ============================================================

async function obtenerImpresoraSeleccionada() {
    const impresoras =
        await obtenerImpresorasWindows();

    if (!impresoras.length) {
        throw new Error(
            "No se encontraron impresoras instaladas en Windows."
        );
    }

    const configuracion =
        leerConfiguracionImpresora();

    // 1. Impresora guardada.
    if (configuracion.printer) {
        const guardada =
            impresoras.find(
                (impresora) =>
                    impresora.Name ===
                    configuracion.printer
            );

        if (guardada) {
            console.log(
                `🖨️ Impresora guardada encontrada: ${guardada.Name} `
            );

            return guardada.Name;
        }

        console.log(
            `⚠️ La impresora guardada no está disponible: ${configuracion.printer} `
        );
    }

    // 2. Buscar HPRT MPT-II.
    const hprt =
        impresoras.find(
            (impresora) =>
                String(
                    impresora.Name
                )
                    .toLowerCase()
                    .includes(
                        "hprt mpt-ii"
                    )
        );

    if (hprt) {
        console.log(
            `🔄 Fallback HPRT: ${hprt.Name} `
        );

        return hprt.Name;
    }

    // 3. Impresora predeterminada.
    const predeterminada =
        impresoras.find(
            (impresora) =>
                impresora.Default === true ||
                impresora.Default === "True" ||
                impresora.Default === 1
        );

    if (predeterminada) {
        console.log(
            `🔄 Impresora predeterminada: ${predeterminada.Name} `
        );

        return predeterminada.Name;
    }

    // 4. Primera disponible.
    console.log(
        `🔄 Primera impresora disponible: ${impresoras[0].Name} `
    );

    return impresoras[0].Name;
}


// ============================================================
// VALIDAR IMPRESORA
// ============================================================

async function validarImpresora(nombreImpresora) {
    const impresoras =
        await obtenerImpresorasWindows();

    return impresoras.some(
        (impresora) =>
            impresora.Name ===
            nombreImpresora
    );
}


// ============================================================
// GENERAR LOGO ESC/POS
// ============================================================

async function generarLogoESCPos() {
    if (
        !fs.existsSync(
            LOGO_PATH
        )
    ) {
        throw new Error(
            `No se encontró el logo en: ${LOGO_PATH} `
        );
    }

    console.log(
        "🖼️ GENERANDO LOGO PARA ESC/POS"
    );

    console.log(
        `📂 Archivo: ${LOGO_PATH} `
    );

    const metadata =
        await sharp(
            LOGO_PATH
        ).metadata();

    console.log(
        `📐 Dimensiones originales: ${metadata.width}x${metadata.height} `
    );

    console.log(
        `🎨 Formato original: ${metadata.format} `
    );

    console.log(
        `🧩 Canales originales: ${metadata.channels} `
    );

    const procesada =
        await sharp(
            LOGO_PATH
        )
            .resize({
                width:
                    LOGO_WIDTH,
                withoutEnlargement:
                    true,
            })
            .grayscale()
            .raw()
            .toBuffer({
                resolveWithObject:
                    true,
            });

    const {
        data,
        info,
    } = procesada;

    const width =
        info.width;

    const height =
        info.height;

    console.log(
        `📐 Dimensiones procesadas: ${width}x${height} `
    );

    const bytesPorFila =
        Math.ceil(
            width / 8
        );

    const bitmap =
        Buffer.alloc(
            bytesPorFila *
            height
        );

    // ========================================================
    // CONVERTIR IMAGEN A 1 BIT
    // ========================================================

    for (
        let y = 0;
        y < height;
        y++
    ) {
        for (
            let x = 0;
            x < width;
            x++
        ) {
            const indice =
                y * width + x;

            const valor =
                data[indice];

            // Umbral.
            const negro =
                valor < 180;

            if (negro) {
                const byteIndex =
                    y *
                    bytesPorFila +
                    Math.floor(
                        x / 8
                    );

                const bit =
                    7 -
                    (x % 8);

                bitmap[
                    byteIndex
                ] |=
                    1 << bit;
            }
        }
    }

    // ========================================================
    // ESC/POS GS v 0
    // ========================================================

    const encabezado =
        Buffer.from([
            // Inicializar
            0x1b,
            0x40,

            // Centrar
            0x1b,
            0x61,
            0x01,

            // GS v 0
            0x1d,
            0x76,
            0x30,
            0x00,

            // xL
            bytesPorFila &
            0xff,

            // xH
            (bytesPorFila >>
                8) &
            0xff,

            // yL
            height &
            0xff,

            // yH
            (height >>
                8) &
            0xff,
        ]);

    const pie =
        Buffer.from([
            // Alinear izquierda
            0x1b,
            0x61,
            0x00,
        ]);

    const resultado =
        Buffer.concat([
            encabezado,
            bitmap,
            pie,
        ]);

    console.log(
        `📄 Bytes totales del logo: ${resultado.length} `
    );

    return resultado;
}


// ============================================================
// CACHE DEL LOGO
// ============================================================

let logoESCPosCache = null;

async function obtenerLogoESCPos() {
    if (logoESCPosCache) {
        return logoESCPosCache;
    }

    logoESCPosCache =
        await generarLogoESCPos();

    console.log(
        "🖼️ Logo ESC/POS generado y almacenado en caché."
    );

    return logoESCPosCache;
}


// ============================================================
// PROCESAR {{LOGO_SOPORTE_TI}}
// ============================================================
//
// IMPORTANTE:
//
// El POS genera:
//
// Punto de Venta por
// {{LOGO_SOPORTE_TI}}
//
// ÚNICAMENTE el ticket cliente lleva el marcador.
//
// El ticket tienda NO lo lleva.
//
// Aquí reemplazamos el marcador por el logo.
// ============================================================

async function procesarLogoEnTicket(
    contenido
) {
    const texto =
        Buffer.isBuffer(contenido)
            ? contenido.toString(
                "binary"
            )
            : String(
                contenido
            );

    const posicion =
        texto.indexOf(
            LOGO_MARKER
        );

    // --------------------------------------------------------
    // NO HAY MARCADOR
    // --------------------------------------------------------
    //
    // Esto significa que es un ticket normal,
    // por ejemplo COPIA TIENDA.
    //
    // NO agregamos ningún logo.
    // --------------------------------------------------------

    if (posicion === -1) {
        console.log(
            "🧾 Ticket sin marcador de logo. Se imprimirá SIN logo."
        );

        return Buffer.from(
            texto,
            "binary"
        );
    }

    console.log(
        "🖼️ Marcador {{LOGO_SOPORTE_TI}} encontrado."
    );

    console.log(
        "🖼️ Se insertará el logo exactamente en esa posición."
    );

    const antes =
        texto.substring(
            0,
            posicion
        );

    const despues =
        texto.substring(
            posicion +
            LOGO_MARKER.length
        );

    const bufferAntes =
        Buffer.from(
            antes,
            "binary"
        );

    const bufferDespues =
        Buffer.from(
            despues,
            "binary"
        );

    const logo =
        await obtenerLogoESCPos();

    return Buffer.concat([
        bufferAntes,
        logo,
        bufferDespues,
    ]);
}


// ============================================================
// ELIMINAR CORTES EXISTENTES
// ============================================================

function eliminarCortesFinales(
    buffer
) {
    let resultado =
        Buffer.from(buffer);

    let eliminados = 0;

    // --------------------------------------------------------
    // Quitar saltos de línea finales.
    // --------------------------------------------------------

    while (
        resultado.length > 0 &&
        (
            resultado[
            resultado.length - 1
            ] === 0x0a ||
            resultado[
            resultado.length - 1
            ] === 0x0d
        )
    ) {
        resultado =
            resultado.subarray(
                0,
                resultado.length - 1
            );
    }

    let continuar = true;

    while (continuar) {
        continuar = false;

        // GS V 0
        if (
            resultado.length >= 3 &&
            resultado[
            resultado.length - 3
            ] === 0x1d &&
            resultado[
            resultado.length - 2
            ] === 0x56 &&
            resultado[
            resultado.length - 1
            ] === 0x00
        ) {
            resultado =
                resultado.subarray(
                    0,
                    resultado.length - 3
                );

            eliminados++;
            continuar = true;

            continue;
        }

        // GS V 1
        if (
            resultado.length >= 3 &&
            resultado[
            resultado.length - 3
            ] === 0x1d &&
            resultado[
            resultado.length - 2
            ] === 0x56 &&
            resultado[
            resultado.length - 1
            ] === 0x01
        ) {
            resultado =
                resultado.subarray(
                    0,
                    resultado.length - 3
                );

            eliminados++;
            continuar = true;

            continue;
        }

        // GS V B 0
        if (
            resultado.length >= 4 &&
            resultado[
            resultado.length - 4
            ] === 0x1d &&
            resultado[
            resultado.length - 3
            ] === 0x56 &&
            resultado[
            resultado.length - 2
            ] === 0x42 &&
            resultado[
            resultado.length - 1
            ] === 0x00
        ) {
            resultado =
                resultado.subarray(
                    0,
                    resultado.length - 4
                );

            eliminados++;
            continuar = true;

            continue;
        }
    }

    return {
        buffer: resultado,
        eliminados,
    };
}


// ============================================================
// IMPRIMIR
// ============================================================

async function imprimir(
    contenido
) {
    let nombreImpresora =
        impresoraActual;

    // --------------------------------------------------------
    // Detectar solamente si no tenemos impresora en memoria.
    // --------------------------------------------------------

    if (!nombreImpresora) {
        nombreImpresora =
            await obtenerImpresoraSeleccionada();

        impresoraActual =
            nombreImpresora;
    }

    console.log(
        `🖨️ Enviando impresión a: ${nombreImpresora} `
    );

    let bufferContenido;

    if (
        Buffer.isBuffer(
            contenido
        )
    ) {
        bufferContenido =
            Buffer.from(
                contenido
            );
    } else {
        bufferContenido =
            Buffer.from(
                String(contenido),
                "binary"
            );
    }

    // --------------------------------------------------------
    // Eliminar cortes que pueda haber enviado el POS.
    // Nosotros agregamos solamente uno al final.
    // --------------------------------------------------------

    const limpieza =
        eliminarCortesFinales(
            bufferContenido
        );

    bufferContenido =
        limpieza.buffer;

    if (
        limpieza.eliminados > 0
    ) {
        console.log(
            `✂️ Se eliminaron ${limpieza.eliminados} comando(s) de corte existentes.`
        );
    }

    // --------------------------------------------------------
    // Saltos finales.
    // --------------------------------------------------------

    const saltosAntesDelCorte =
        Buffer.from(
            "\n\n\n\n",
            "binary"
        );

    // --------------------------------------------------------
    // Corte.
    // --------------------------------------------------------

    const comandoCorte =
        Buffer.from([
            0x1d,
            0x56,
            0x00,
        ]);

    const datosFinales =
        Buffer.concat([
            bufferContenido,
            saltosAntesDelCorte,
            comandoCorte,
        ]);

    console.log(
        `📦 Bytes enviados: ${datosFinales.length} `
    );

    // ========================================================
    // API CORRECTA DE @ssxv/node-printer
    // ========================================================

    if (
        !printer ||
        !printer.default ||
        !printer.default.jobs ||
        typeof
        printer.default.jobs.printRaw !==
        "function"
    ) {
        throw new Error(
            "La función printer.default.jobs.printRaw no está disponible."
        );
    }

    const resultado =
        await printer.default.jobs.printRaw(
            {
                printer:
                    nombreImpresora,

                data:
                    datosFinales,

                type: "RAW",
            }
        );

    console.log(
        "✅ Trabajo de impresión enviado correctamente."
    );

    return {
        impresora:
            nombreImpresora,

        resultado,
    };
}


// ============================================================
// COLA DE IMPRESIÓN
// ============================================================

function agregarAColaImpresion(
    trabajo,
    descripcion
) {
    const trabajoActual =
        colaImpresion.then(
            async () => {
                try {
                    console.log(
                        `🖨️ Procesando: ${descripcion} `
                    );

                    await trabajo();

                    console.log(
                        `✅ Finalizado: ${descripcion} `
                    );
                } catch (error) {
                    console.error(
                        `❌ Error en ${descripcion}: `,
                        error
                    );

                    // Si algo ocurrió con la impresora,
                    // permitimos que el siguiente trabajo
                    // vuelva a detectarla.
                    impresoraActual =
                        null;
                }
            }
        );

    colaImpresion =
        trabajoActual.catch(
            () => { }
        );

    return trabajoActual;
}


// ============================================================
// TICKET DE PRUEBA
// ============================================================

function generarTicketPrueba() {
    let ticket = "";

    ticket +=
        "\x1B\x40";

    ticket +=
        "\x1B\x61\x01";

    ticket +=
        "PUNTO DE VENTA\n";

    ticket +=
        "SOPORTE IT\n";

    ticket +=
        "\x1B\x61\x00";

    ticket +=
        "--------------------------------\n";

    ticket +=
        "PRUEBA DE IMPRESION\n";

    ticket +=
        "Servicio funcionando correctamente\n";

    ticket +=
        "--------------------------------\n";

    ticket +=
        "\n";

    return Buffer.from(
        ticket,
        "binary"
    );
}


// ============================================================
// SERVIDOR HTTP
// ============================================================

const server =
    http.createServer(
        async (req, res) => {
            try {
                // ====================================================
                // CORS
                // ====================================================

                aplicarCORS(
                    res,
                    req.headers.origin
                );

                // ====================================================
                // PREFLIGHT
                // ====================================================

                if (
                    req.method ===
                    "OPTIONS"
                ) {
                    res.writeHead(
                        204
                    );

                    res.end();

                    return;
                }


                // ====================================================
                // GET /
                // ====================================================

                if (
                    req.method ===
                    "GET" &&
                    req.url === "/"
                ) {
                    responderJSON(
                        res,
                        200,
                        {
                            ok: true,

                            mensaje:
                                "Printer Service funcionando.",

                            impresora:
                                impresoraActual,

                            puerto:
                                PORT,

                            host:
                                HOST,
                        }
                    );

                    return;
                }


                // ====================================================
                // GET /printers
                // ====================================================

                if (
                    req.method ===
                    "GET" &&
                    req.url ===
                    "/printers"
                ) {
                    console.log(
                        "🔎 Buscando impresoras instaladas..."
                    );

                    const impresoras =
                        await obtenerImpresorasWindows();

                    responderJSON(
                        res,
                        200,
                        {
                            ok: true,

                            seleccionada:
                                impresoraActual,

                            impresoras,
                        }
                    );

                    return;
                }


                // ====================================================
                // GET /config
                // ====================================================

                if (
                    req.method ===
                    "GET" &&
                    req.url ===
                    "/config"
                ) {
                    const configuracion =
                        leerConfiguracionImpresora();

                    responderJSON(
                        res,
                        200,
                        {
                            ok: true,

                            ...configuracion,

                            impresora:
                                impresoraActual,
                        }
                    );

                    return;
                }


                // ====================================================
                // POST /config/printer
                // ====================================================

                if (
                    req.method ===
                    "POST" &&
                    req.url ===
                    "/config/printer"
                ) {
                    const body =
                        await leerBody(
                            req
                        );

                    let datos = {};

                    try {
                        datos =
                            body
                                ? JSON.parse(
                                    body
                                )
                                : {};
                    } catch {
                        responderJSON(
                            res,
                            400,
                            {
                                ok: false,

                                error:
                                    "El cuerpo de la solicitud no contiene JSON válido.",
                            }
                        );

                        return;
                    }

                    const nombre =
                        datos.printer ||
                        datos.nombre ||
                        datos.impresora;

                    if (!nombre) {
                        responderJSON(
                            res,
                            400,
                            {
                                ok: false,

                                error:
                                    "No se recibió el nombre de la impresora.",
                            }
                        );

                        return;
                    }

                    const existe =
                        await validarImpresora(
                            nombre
                        );

                    if (!existe) {
                        responderJSON(
                            res,
                            404,
                            {
                                ok: false,

                                error:
                                    "La impresora seleccionada no está instalada o disponible en Windows.",
                            }
                        );

                        return;
                    }

                    guardarConfiguracionImpresora(
                        nombre
                    );

                    impresoraActual =
                        nombre;

                    console.log(
                        `🖨️ Impresora guardada: ${nombre} `
                    );

                    responderJSON(
                        res,
                        200,
                        {
                            ok: true,

                            impresora:
                                impresoraActual,

                            printer:
                                impresoraActual,
                        }
                    );

                    return;
                }


                // ====================================================
                // POST /test-minimal
                // ====================================================

                if (
                    req.method ===
                    "POST" &&
                    req.url ===
                    "/test-minimal"
                ) {
                    const contenido =
                        Buffer.from(
                            "PRUEBA MINIMAL\n",
                            "binary"
                        );

                    const resultado =
                        await imprimir(
                            contenido
                        );

                    responderJSON(
                        res,
                        200,
                        {
                            ok: true,

                            mensaje:
                                "Prueba mínima enviada.",

                            ...resultado,
                        }
                    );

                    return;
                }


                // ====================================================
                // POST /test-texto-escpos
                // ====================================================

                if (
                    req.method ===
                    "POST" &&
                    req.url ===
                    "/test-texto-escpos"
                ) {
                    let texto = "";

                    texto +=
                        "\x1B\x40";

                    texto +=
                        "\x1B\x61\x01";

                    texto +=
                        "PRUEBA ESC/POS\n";

                    texto +=
                        "SOPORTE IT\n";

                    texto +=
                        "\x1B\x61\x00";

                    texto +=
                        "--------------------------------\n";

                    texto +=
                        "Texto enviado directamente\n";

                    texto +=
                        "desde Printer Service\n";

                    texto +=
                        "--------------------------------\n";

                    const resultado =
                        await imprimir(
                            Buffer.from(
                                texto,
                                "binary"
                            )
                        );

                    responderJSON(
                        res,
                        200,
                        {
                            ok: true,

                            mensaje:
                                "Prueba de texto ESC/POS enviada.",

                            ...resultado,
                        }
                    );

                    return;
                }


                // ====================================================
                // POST /test-raster-minimo
                // ====================================================

                if (
                    req.method ===
                    "POST" &&
                    req.url ===
                    "/test-raster-minimo"
                ) {
                    const buffer =
                        Buffer.from([
                            0x1b,
                            0x40,

                            0x1b,
                            0x61,
                            0x01,

                            0x1d,
                            0x76,
                            0x30,
                            0x00,

                            0x01,
                            0x00,

                            0x01,
                            0x00,

                            0x80,

                            0x00,
                        ]);

                    const resultado =
                        await imprimir(
                            buffer
                        );

                    responderJSON(
                        res,
                        200,
                        {
                            ok: true,

                            mensaje:
                                "Prueba raster mínima enviada.",

                            ...resultado,
                        }
                    );

                    return;
                }


                // ====================================================
                // POST /test-raster-mediano
                // ====================================================

                if (
                    req.method ===
                    "POST" &&
                    req.url ===
                    "/test-raster-mediano"
                ) {
                    const width = 160;
                    const height = 80;

                    const bytesPorFila =
                        Math.ceil(
                            width / 8
                        );

                    const bitmap =
                        Buffer.alloc(
                            bytesPorFila *
                            height
                        );

                    for (
                        let y = 0;
                        y < height;
                        y++
                    ) {
                        for (
                            let x = 0;
                            x < width;
                            x++
                        ) {
                            const borde =
                                x === 0 ||
                                x ===
                                width -
                                1 ||
                                y === 0 ||
                                y ===
                                height -
                                1;

                            const diagonal =
                                x ===
                                y * 2 ||
                                x ===
                                width -
                                1 -
                                y * 2;

                            if (
                                borde ||
                                diagonal
                            ) {
                                const byteIndex =
                                    y *
                                    bytesPorFila +
                                    Math.floor(
                                        x / 8
                                    );

                                const bit =
                                    7 -
                                    (x %
                                        8);

                                bitmap[
                                    byteIndex
                                ] |=
                                    1 <<
                                    bit;
                            }
                        }
                    }

                    const encabezado =
                        Buffer.from([
                            0x1b,
                            0x40,

                            0x1b,
                            0x61,
                            0x01,

                            0x1d,
                            0x76,
                            0x30,
                            0x00,

                            bytesPorFila &
                            0xff,

                            (bytesPorFila >>
                                8) &
                            0xff,

                            height &
                            0xff,

                            (height >>
                                8) &
                            0xff,
                        ]);

                    const pie =
                        Buffer.from([
                            0x1b,
                            0x61,
                            0x00,
                        ]);

                    const buffer =
                        Buffer.concat([
                            encabezado,
                            bitmap,
                            pie,
                        ]);

                    const resultado =
                        await imprimir(
                            buffer
                        );

                    responderJSON(
                        res,
                        200,
                        {
                            ok: true,

                            mensaje:
                                "Prueba raster mediana enviada.",

                            ...resultado,
                        }
                    );

                    return;
                }


                // ====================================================
                // POST /test-logo-sin-corte
                // ====================================================

                if (
                    req.method ===
                    "POST" &&
                    req.url ===
                    "/test-logo-sin-corte"
                ) {
                    console.log(
                        `🧪 PRUEBA LOGO SIN CORTE en: ${impresoraActual} `
                    );

                    const logo =
                        await obtenerLogoESCPos();

                    const resultado =
                        await imprimir(
                            logo
                        );

                    responderJSON(
                        res,
                        200,
                        {
                            ok: true,

                            mensaje:
                                "Prueba de logo sin corte enviada.",

                            impresora:
                                resultado.impresora,
                        }
                    );

                    return;
                }


                // ====================================================
                // POST /test-logo
                // ====================================================

                if (
                    req.method ===
                    "POST" &&
                    req.url ===
                    "/test-logo"
                ) {
                    const logo =
                        await obtenerLogoESCPos();

                    const texto =
                        Buffer.from(
                            "\n" +
                            "\x1B\x61\x01" +
                            "PUNTO DE VENTA\n" +
                            "\x1B\x61\x00" +
                            "\n",
                            "binary"
                        );

                    const ticket =
                        Buffer.concat([
                            logo,
                            texto,
                        ]);

                    const resultado =
                        await imprimir(
                            ticket
                        );

                    responderJSON(
                        res,
                        200,
                        {
                            ok: true,

                            mensaje:
                                "Prueba con logo enviada.",

                            ...resultado,
                        }
                    );

                    return;
                }


                // ====================================================
                // POST /test
                // ====================================================

                if (
                    req.method ===
                    "POST" &&
                    req.url === "/test"
                ) {
                    const ticket =
                        generarTicketPrueba();

                    const resultado =
                        await imprimir(
                            ticket
                        );

                    responderJSON(
                        res,
                        200,
                        {
                            ok: true,

                            mensaje:
                                "Prueba de impresión enviada.",

                            ...resultado,
                        }
                    );

                    return;
                }


                // ====================================================
                // POST /print
                // ====================================================

                if (
                    req.method ===
                    "POST" &&
                    req.url === "/print"
                ) {
                    const body =
                        await leerBody(
                            req
                        );

                    let datos = {};

                    try {
                        datos =
                            body
                                ? JSON.parse(
                                    body
                                )
                                : {};
                    } catch {
                        responderJSON(
                            res,
                            400,
                            {
                                ok: false,

                                error:
                                    "El cuerpo de la solicitud no contiene JSON válido.",
                            }
                        );

                        return;
                    }

                    let contenido =
                        datos.contenido ??
                        datos.texto ??
                        "";

                    if (
                        typeof contenido !==
                        "string" &&
                        !Buffer.isBuffer(
                            contenido
                        )
                    ) {
                        contenido =
                            String(
                                contenido
                            );
                    }

                    // ------------------------------------------------
                    // IMPORTANTE:
                    //
                    // Aquí NO agregamos logo automáticamente.
                    //
                    // El POS decide si el ticket contiene:
                    //
                    // {{LOGO_SOPORTE_TI}}
                    //
                    // Si existe:
                    //    → se inserta logo.
                    //
                    // Si no existe:
                    //    → ticket sin logo.
                    // ------------------------------------------------

                    const contenidoRecibido =
                        Buffer.isBuffer(
                            contenido
                        )
                            ? Buffer.from(
                                contenido
                            )
                            : String(
                                contenido
                            );

                    const esTicketCliente =
                        (
                            Buffer.isBuffer(
                                contenidoRecibido
                            )
                                ? contenidoRecibido.toString(
                                    "binary"
                                )
                                : contenidoRecibido
                        ).includes(
                            LOGO_MARKER
                        );

                    console.log(
                        "🧾 Solicitud /print recibida."
                    );

                    console.log(
                        `🧾 Tipo detectado: ${esTicketCliente
                            ? "CLIENTE (con logo)"
                            : "TIENDA (sin logo)"
                        } `
                    );

                    // ------------------------------------------------
                    // Agregar a cola.
                    // ------------------------------------------------

                    agregarAColaImpresion(
                        async () => {
                            const ticketProcesado =
                                await procesarLogoEnTicket(
                                    contenidoRecibido
                                );

                            await imprimir(
                                ticketProcesado
                            );
                        },
                        esTicketCliente
                            ? "ticket CLIENTE"
                            : "ticket TIENDA"
                    );

                    // ------------------------------------------------
                    // Respuesta inmediata al POS.
                    // ------------------------------------------------

                    responderJSON(
                        res,
                        202,
                        {
                            ok: true,

                            mensaje:
                                "Ticket recibido y enviado a la cola de impresión.",

                            enSegundoPlano:
                                true,

                            tipo:
                                esTicketCliente
                                    ? "cliente"
                                    : "tienda",

                            impresora:
                                impresoraActual,
                        }
                    );

                    return;
                }


                // ====================================================
                // RUTA NO ENCONTRADA
                // ====================================================

                responderJSON(
                    res,
                    404,
                    {
                        ok: false,

                        error:
                            "Ruta no encontrada.",
                    }
                );
            } catch (error) {
                console.error(
                    "❌ ERROR EN SERVIDOR:",
                    error
                );

                if (
                    !res.headersSent
                ) {
                    responderJSON(
                        res,
                        500,
                        {
                            ok: false,

                            error:
                                error.message ||
                                "Error interno del servicio de impresión.",
                        }
                    );
                }
            }
        }
    );


// ============================================================
// INICIAR SERVIDOR
// ============================================================

server.listen(
    PORT,
    HOST,
    async () => {
        console.log("");
        console.log(
            "=========================================="
        );
        console.log(
            "       PRINTER SERVICE - SOPORTE IT"
        );
        console.log(
            "=========================================="
        );

        console.log(
            `Puerto: ${PORT} `
        );

        console.log(
            `Host: ${HOST} `
        );

        console.log(
            `Logo: ${LOGO_PATH} `
        );

        console.log(
            `Marcador: ${LOGO_MARKER} `
        );

        console.log("");

        try {
            // --------------------------------------------------------
            // Logo
            // --------------------------------------------------------

            if (
                fs.existsSync(
                    LOGO_PATH
                )
            ) {
                console.log(
                    "🖼️ Logo Soporte IT: ENCONTRADO"
                );
            } else {
                console.log(
                    "⚠️ Logo Soporte IT: NO ENCONTRADO"
                );
            }

            // --------------------------------------------------------
            // Configuración
            // --------------------------------------------------------

            if (
                fs.existsSync(
                    PRINTER_CONFIG_PATH
                )
            ) {
                console.log(
                    "⚙️ Configuración de impresora: ENCONTRADA"
                );
            } else {
                console.log(
                    "⚙️ Configuración de impresora: NO ENCONTRADA"
                );
            }

            // --------------------------------------------------------
            // Detectar impresora una sola vez.
            // --------------------------------------------------------

            impresoraActual =
                await obtenerImpresoraSeleccionada();

            console.log(
                `🖨️ Impresora seleccionada: ${impresoraActual} `
            );
        } catch (error) {
            console.error(
                "❌ No se pudo seleccionar impresora:",
                error.message
            );
        }

        console.log("");

        console.log(
            "GET  http://localhost:9100/"
        );

        console.log(
            "GET  http://localhost:9100/printers"
        );

        console.log(
            "GET  http://localhost:9100/config"
        );

        console.log(
            "POST http://localhost:9100/config/printer"
        );

        console.log(
            "POST http://localhost:9100/test"
        );

        console.log(
            "POST http://localhost:9100/test-logo"
        );

        console.log(
            "POST http://localhost:9100/test-logo-sin-corte"
        );

        console.log(
            "POST http://localhost:9100/test-minimal"
        );

        console.log(
            "POST http://localhost:9100/test-texto-escpos"
        );

        console.log(
            "POST http://localhost:9100/test-raster-minimo"
        );

        console.log(
            "POST http://localhost:9100/test-raster-mediano"
        );

        console.log(
            "POST http://localhost:9100/print"
        );

        console.log("");
        console.log(
            "=========================================="
        );
        console.log("");
    }
);
