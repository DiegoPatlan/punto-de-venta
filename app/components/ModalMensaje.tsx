"use client";

interface ModalMensajeProps {
    abierto: boolean;
    tipo: "exito" | "error" | "confirmacion" | "info";
    titulo: string;
    mensaje: string;
    textoBoton?: string;
    textoCancelar?: string;
    onCerrar: () => void;
    onConfirmar?: () => void;
}

export default function ModalMensaje({
    abierto,
    tipo,
    titulo,
    mensaje,
    textoBoton = "Aceptar",
    textoCancelar = "Cancelar",
    onCerrar,
    onConfirmar,
}: ModalMensajeProps) {
    if (!abierto) {
        return null;
    }

    const esConfirmacion = tipo === "confirmacion";

    const icono = {
        exito: "✓",
        error: "!",
        confirmacion: "?",
        info: "i",
    }[tipo];

    const colorIcono = {
        exito: "bg-green-100 text-green-600",
        error: "bg-red-100 text-red-600",
        confirmacion: "bg-blue-100 text-blue-600",
        info: "bg-gray-100 text-gray-600",
    }[tipo];

    const colorBoton = {
        exito: "bg-green-600 hover:bg-green-700",
        error: "bg-red-600 hover:bg-red-700",
        confirmacion: "bg-blue-600 hover:bg-blue-700",
        info: "bg-gray-800 hover:bg-gray-900",
    }[tipo];

    function confirmar() {
        if (onConfirmar) {
            onConfirmar();
        } else {
            onCerrar();
        }
    }

    return (
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onMouseDown={(e) => {
                if (e.target === e.currentTarget) {
                    onCerrar();
                }
            }}
        >
            <div
                className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden"
                role="dialog"
                aria-modal="true"
                aria-labelledby="modal-mensaje-titulo"
            >
                <div className="p-6">
                    <div className="flex items-start gap-4">
                        <div
                            className={`w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold shrink-0 ${colorIcono}`}
                        >
                            {icono}
                        </div>

                        <div className="flex-1">
                            <h2
                                id="modal-mensaje-titulo"
                                className="text-xl font-bold text-gray-900"
                            >
                                {titulo}
                            </h2>

                            <p className="text-gray-600 mt-2 leading-relaxed">
                                {mensaje}
                            </p>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 mt-6">
                        {esConfirmacion && (
                            <button
                                type="button"
                                onClick={onCerrar}
                                className="px-5 py-3 rounded-xl border border-gray-300 text-gray-700 font-semibold hover:bg-gray-50 transition"
                            >
                                {textoCancelar}
                            </button>
                        )}

                        <button
                            type="button"
                            onClick={confirmar}
                            className={`px-5 py-3 rounded-xl text-white font-semibold transition ${colorBoton}`}
                        >
                            {textoBoton}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}