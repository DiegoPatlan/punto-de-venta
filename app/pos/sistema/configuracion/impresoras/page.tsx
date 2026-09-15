"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ModalMensaje from "@/app/components/ModalMensaje";

const PRINTER_SERVICE_URL = "http://localhost:9100";

type Impresora = {
  Name: string;
  PrinterStatus: number;
  Default: boolean | null;
  DriverName: string;
  PortName: string;
};

type Configuracion = {
  printer?: string | null;
  impresoraSeleccionada?: string | null;
  impresora?: string | null;
};

export default function ImpresorasPage() {
  const router = useRouter();
  const [impresoras, setImpresoras] = useState<Impresora[]>([]);
  const [impresoraSeleccionada, setImpresoraSeleccionada] =
    useState<string>("");
  const [configuracion, setConfiguracion] =
    useState<Configuracion | null>(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [probando, setProbando] = useState(false);
  const [probandoLogo, setProbandoLogo] = useState(false);
  const [servicioConectado, setServicioConectado] = useState(false);

  const [modal, setModal] = useState<{
    abierto: boolean;
    tipo: "info" | "error" | "exito" | "confirmacion";
    titulo: string;
    mensaje: string;
  }>({
    abierto: false,
    tipo: "info",
    titulo: "",
    mensaje: "",
  });

  const mostrarMensaje = (
    tipo: "info" | "error" | "exito" | "confirmacion",
    titulo: string,
    mensaje: string
  ) => {
    setModal({
      abierto: true,
      tipo,
      titulo,
      mensaje,
    });
  };

  const cerrarModal = () => {
    setModal((prev) => ({
      ...prev,
      abierto: false,
    }));
  };

  useEffect(() => {
    cargarTodo();
  }, []);

  // =========================================================
  // CARGAR TODO
  // =========================================================

  async function cargarTodo() {
    setCargando(true);
    setServicioConectado(false);

    try {
      const [configOk, impresorasOk] = await Promise.all([
        cargarConfiguracion(),
        cargarImpresoras(),
      ]);

      if (configOk || impresorasOk) {
        setServicioConectado(true);
      }
    } finally {
      setCargando(false);
    }
  }

  // =========================================================
  // CARGAR CONFIGURACIÓN GUARDADA
  // =========================================================

  async function cargarConfiguracion(): Promise<boolean> {
    try {
      const respuesta = await fetch(
        `${PRINTER_SERVICE_URL}/config`,
        {
          cache: "no-store",
        }
      );

      if (!respuesta.ok) {
        throw new Error(
          "No se pudo obtener la configuración de la impresora."
        );
      }

      const data = await respuesta.json();

      console.log("📌 Configuración recibida:", data);

      /*
       * printer-service actualmente guarda:
       *
       * {
       *   printer: "HPRT MPT-II"
       * }
       *
       * También aceptamos nombres anteriores por compatibilidad.
       */

      const impresoraGuardada =
        data?.printer ??
        data?.impresoraSeleccionada ??
        data?.impresora ??
        null;

      console.log(
        "🖨️ Impresora guardada:",
        impresoraGuardada
      );

      /*
       * Normalizamos la configuración para que toda la interfaz
       * pueda trabajar siempre con impresoraSeleccionada.
       */

      setConfiguracion({
        ...data,
        impresoraSeleccionada: impresoraGuardada,
      });

      if (impresoraGuardada) {
        setImpresoraSeleccionada(impresoraGuardada);
      } else {
        setImpresoraSeleccionada("");
      }

      return true;
    } catch (error) {
      console.error(
        "Error cargando configuración:",
        error
      );

      return false;
    }
  }

  // =========================================================
  // CARGAR IMPRESORAS INSTALADAS
  // =========================================================

  async function cargarImpresoras(): Promise<boolean> {
    try {
      const respuesta = await fetch(
        `${PRINTER_SERVICE_URL}/printers`,
        {
          cache: "no-store",
        }
      );

      if (!respuesta.ok) {
        throw new Error(
          "No se pudieron obtener las impresoras."
        );
      }

      const data = await respuesta.json();

      console.log(
        "🖨️ Impresoras disponibles:",
        data
      );

      setImpresoras(data?.impresoras ?? []);

      /*
       * IMPORTANTE:
       *
       * NO hacemos:
       *
       * setImpresoraSeleccionada(data.seleccionada)
       *
       * porque /printers puede devolver una impresora fallback.
       *
       * La selección real debe venir de /config.
       */

      return true;
    } catch (error) {
      console.error(
        "Error cargando impresoras:",
        error
      );

      return false;
    }
  }

  // =========================================================
  // GUARDAR IMPRESORA
  // =========================================================

  async function guardarImpresora() {
    if (!impresoraSeleccionada) {
      mostrarMensaje(
        "info",
        "Selecciona una impresora",
        "Debes seleccionar una impresora antes de guardar."
      );

      return;
    }

    setGuardando(true);

    try {
      const respuesta = await fetch(
        `${PRINTER_SERVICE_URL}/config/printer`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            printer: impresoraSeleccionada,
          }),
        }
      );

      const data = await respuesta.json();

      if (!respuesta.ok || data?.ok === false) {
        throw new Error(
          data?.error ||
          "No se pudo guardar la impresora."
        );
      }

      /*
       * Si el servicio devuelve la impresora guardada,
       * usamos esa. De lo contrario usamos la selección actual.
       */

      const impresoraGuardada =
        data?.printer ??
        data?.impresoraSeleccionada ??
        impresoraSeleccionada;

      setImpresoraSeleccionada(
        impresoraGuardada
      );

      setConfiguracion((prev) => ({
        ...(prev ?? {}),
        printer: impresoraGuardada,
        impresoraSeleccionada: impresoraGuardada,
      }));

      mostrarMensaje(
        "exito",
        "Configuración guardada",
        `La impresora "${impresoraGuardada}" quedó configurada correctamente.`
      );
    } catch (error) {
      console.error(
        "Error guardando impresora:",
        error
      );

      mostrarMensaje(
        "error",
        "No se pudo guardar",
        error instanceof Error
          ? error.message
          : "Ocurrió un error al guardar la impresora."
      );
    } finally {
      setGuardando(false);
    }
  }

  // =========================================================
  // PRUEBA DE IMPRESIÓN
  // =========================================================

  async function probarImpresion() {
    setProbando(true);

    try {
      const respuesta = await fetch(
        `${PRINTER_SERVICE_URL}/test`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      const data = await respuesta.json();

      if (!respuesta.ok || data?.ok === false) {
        throw new Error(
          data?.error ||
          "La prueba de impresión falló."
        );
      }

      mostrarMensaje(
        "exito",
        "Prueba enviada",
        "La prueba de impresión fue enviada correctamente a la impresora."
      );
    } catch (error) {
      console.error(
        "Error en prueba de impresión:",
        error
      );

      mostrarMensaje(
        "error",
        "Error de impresión",
        error instanceof Error
          ? error.message
          : "No se pudo realizar la prueba de impresión."
      );
    } finally {
      setProbando(false);
    }
  }

  // =========================================================
  // PRUEBA DE IMPRESIÓN CON LOGO
  // =========================================================

  async function probarLogo() {
    setProbandoLogo(true);

    try {
      const respuesta = await fetch(
        `${PRINTER_SERVICE_URL}/test-logo`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      const data = await respuesta.json();

      if (!respuesta.ok || data?.ok === false) {
        throw new Error(
          data?.error ||
          "La prueba del logo falló."
        );
      }

      mostrarMensaje(
        "exito",
        "Prueba enviada",
        "La prueba con el logo de Soporte IT fue enviada correctamente."
      );
    } catch (error) {
      console.error(
        "Error en prueba de logo:",
        error
      );

      mostrarMensaje(
        "error",
        "Error de impresión",
        error instanceof Error
          ? error.message
          : "No se pudo realizar la prueba con logo."
      );
    } finally {
      setProbandoLogo(false);
    }
  }

  // =========================================================
  // IMPRESORA ACTUAL
  // =========================================================

  const impresoraActual =
    impresoras.find(
      (impresora) =>
        impresora.Name ===
        impresoraSeleccionada
    ) ?? null;

  // =========================================================
  // RENDER
  // =========================================================

  return (
    <>
      <div className="min-h-screen bg-[var(--color-background)] p-4 md:p-6">
        <div className="mx-auto max-w-5xl">

          {/* ================================================= */}
          {/* ENCABEZADO */}
          {/* ================================================= */}

          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <button
                type="button"
                onClick={() =>
                  router.push(
                    "/pos/sistema/configuracion"
                  )
                }
                className="
                                mb-3
                                text-sm
                                font-medium
                                text-[var(--color-text-secondary)]
                                transition
                                hover:text-[var(--color-primary)]
                            "
              >
                ← Volver a Configuración
              </button>

              <h1 className="text-2xl font-bold tracking-tight text-[var(--color-text)] md:text-3xl">
                Impresoras
              </h1>

              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                Configura y prueba la impresora utilizada
                para los tickets.
              </p>
            </div>

            {/* ESTADO DEL SERVICIO */}

            <div
              className={`
                            inline-flex
                            items-center
                            gap-2
                            self-start
                            rounded-full
                            border
                            px-4
                            py-2
                            text-sm
                            font-semibold
                            ${servicioConectado
                  ? "border-[var(--color-success)] bg-[color-mix(in_srgb,var(--color-success)_10%,var(--color-surface))] text-[var(--color-success)]"
                  : "border-[var(--color-danger)] bg-[color-mix(in_srgb,var(--color-danger)_10%,var(--color-surface))] text-[var(--color-danger)]"
                }
                        `}
            >
              <span
                className={`
                                h-2.5
                                w-2.5
                                rounded-full
                                ${servicioConectado
                    ? "bg-[var(--color-success)]"
                    : "bg-[var(--color-danger)]"
                  }
                            `}
              />

              {servicioConectado
                ? "Servicio conectado"
                : "Servicio desconectado"}
            </div>
          </div>

          {/* ================================================= */}
          {/* CONTENIDO */}
          {/* ================================================= */}

          {cargando ? (
            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8 text-center shadow-sm">
              <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-border)] border-t-[var(--color-primary)]" />

              <p className="text-sm text-[var(--color-text-secondary)]">
                Cargando configuración de impresoras...
              </p>
            </div>
          ) : (
            <div className="space-y-5">

              {/* ================================================= */}
              {/* IMPRESORA SELECCIONADA */}
              {/* ================================================= */}

              <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-sm md:p-6">
                <div className="mb-5">
                  <h2 className="text-lg font-semibold text-[var(--color-text)]">
                    Impresora para tickets
                  </h2>

                  <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                    Selecciona la impresora que utilizará
                    el punto de venta.
                  </p>
                </div>

                {impresoras.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-background)] p-6 text-center">
                    <div className="mb-2 text-4xl">
                      🖨️
                    </div>

                    <p className="font-medium text-[var(--color-text)]">
                      No se encontraron impresoras
                    </p>

                    <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                      Verifica que la impresora esté
                      instalada en Windows y que el
                      servicio de impresión esté
                      ejecutándose.
                    </p>

                    <button
                      type="button"
                      onClick={cargarTodo}
                      className="
                                            mt-4
                                            rounded-xl
                                            bg-[var(--color-primary)]
                                            px-4
                                            py-2
                                            text-sm
                                            font-semibold
                                            text-white
                                            transition
                                            hover:bg-[var(--color-primary-hover)]
                                            focus:outline-none
                                            focus:ring-2
                                            focus:ring-[var(--color-primary)]
                                            focus:ring-offset-2
                                            focus:ring-offset-[var(--color-surface)]
                                        "
                    >
                      Actualizar
                    </button>
                  </div>
                ) : (
                  <>
                    {/* SELECT */}

                    <select
                      value={impresoraSeleccionada}
                      onChange={(e) =>
                        setImpresoraSeleccionada(
                          e.target.value
                        )
                      }
                      className="
                                            w-full
                                            rounded-xl
                                            border
                                            border-[var(--color-border)]
                                            bg-[var(--color-surface)]
                                            px-4
                                            py-3
                                            text-sm
                                            text-[var(--color-text)]
                                            outline-none
                                            transition
                                            focus:border-[var(--color-primary)]
                                            focus:ring-2
                                            focus:ring-[var(--color-primary)]
                                            focus:ring-opacity-20
                                        "
                    >
                      <option value="">
                        Selecciona una impresora
                      </option>

                      {impresoras.map(
                        (impresora) => (
                          <option
                            key={`${impresora.Name}-${impresora.PortName}`}
                            value={impresora.Name}
                          >
                            {impresora.Name}
                          </option>
                        )
                      )}
                    </select>

                    {/* INFORMACIÓN DE IMPRESORA */}

                    {impresoraActual && (
                      <div className="mt-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] p-4">
                        <div className="flex items-start gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-xl shadow-sm">
                            🖨️
                          </div>

                          <div className="min-w-0">
                            <p className="font-semibold text-[var(--color-text)]">
                              {
                                impresoraActual.Name
                              }
                            </p>

                            <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                              Puerto:{" "}
                              {
                                impresoraActual.PortName
                              }
                            </p>

                            <p className="text-xs text-[var(--color-text-secondary)]">
                              Driver:{" "}
                              {
                                impresoraActual.DriverName
                              }
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* BOTONES */}

                    <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                      <button
                        type="button"
                        onClick={guardarImpresora}
                        disabled={
                          guardando ||
                          !impresoraSeleccionada
                        }
                        className="
                                                rounded-xl
                                                bg-[var(--color-primary)]
                                                px-5
                                                py-3
                                                text-sm
                                                font-semibold
                                                text-white
                                                transition
                                                hover:bg-[var(--color-primary-hover)]
                                                focus:outline-none
                                                focus:ring-2
                                                focus:ring-[var(--color-primary)]
                                                focus:ring-offset-2
                                                focus:ring-offset-[var(--color-surface)]
                                                disabled:cursor-not-allowed
                                                disabled:opacity-50
                                            "
                      >
                        {guardando
                          ? "Guardando..."
                          : "Guardar impresora"}
                      </button>

                      <button
                        type="button"
                        onClick={cargarTodo}
                        disabled={cargando}
                        className="
                                                rounded-xl
                                                border
                                                border-[var(--color-border)]
                                                bg-[var(--color-surface)]
                                                px-5
                                                py-3
                                                text-sm
                                                font-semibold
                                                text-[var(--color-text)]
                                                transition
                                                hover:border-[var(--color-primary)]
                                                hover:text-[var(--color-primary)]
                                                disabled:cursor-not-allowed
                                                disabled:opacity-50
                                            "
                      >
                        Actualizar impresoras
                      </button>
                    </div>
                  </>
                )}
              </section>

              {/* ================================================= */}
              {/* CONFIGURACIÓN ACTUAL */}
              {/* ================================================= */}

              <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-sm md:p-6">
                <h2 className="text-lg font-semibold text-[var(--color-text)]">
                  Configuración actual
                </h2>

                <div className="mt-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-secondary)]">
                        Impresora configurada
                      </p>

                      <p className="mt-1 font-semibold text-[var(--color-text)]">
                        {configuracion?.impresoraSeleccionada ||
                          "No configurada"}
                      </p>
                    </div>

                    <span
                      className={`
                                            inline-flex
                                            w-fit
                                            rounded-full
                                            border
                                            px-3
                                            py-1
                                            text-xs
                                            font-semibold
                                            ${configuracion?.impresoraSeleccionada
                          ? "border-[var(--color-success)] bg-[color-mix(in_srgb,var(--color-success)_10%,var(--color-surface))] text-[var(--color-success)]"
                          : "border-[var(--color-warning)] bg-[color-mix(in_srgb,var(--color-warning)_10%,var(--color-surface))] text-[var(--color-warning)]"
                        }
                                        `}
                    >
                      {configuracion?.impresoraSeleccionada
                        ? "Configurada"
                        : "Pendiente"}
                    </span>
                  </div>
                </div>
              </section>

              {/* ================================================= */}
              {/* PRUEBAS */}
              {/* ================================================= */}

              <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-sm md:p-6">
                <div className="mb-5">
                  <h2 className="text-lg font-semibold text-[var(--color-text)]">
                    Pruebas de impresión
                  </h2>

                  <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                    Comprueba que la impresora configurada
                    funciona correctamente.
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">

                  {/* PRUEBA NORMAL */}

                  <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
                    <div className="mb-4 flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] text-xl">
                        🧾
                      </div>

                      <div>
                        <h3 className="font-semibold text-[var(--color-text)]">
                          Ticket de prueba
                        </h3>

                        <p className="text-xs text-[var(--color-text-secondary)]">
                          Imprime un ticket de prueba.
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={probarImpresion}
                      disabled={
                        probando ||
                        !servicioConectado
                      }
                      className="
                                            w-full
                                            rounded-xl
                                            bg-[var(--color-primary)]
                                            px-4
                                            py-3
                                            text-sm
                                            font-semibold
                                            text-white
                                            transition
                                            hover:bg-[var(--color-primary-hover)]
                                            focus:outline-none
                                            focus:ring-2
                                            focus:ring-[var(--color-primary)]
                                            focus:ring-offset-2
                                            focus:ring-offset-[var(--color-surface)]
                                            disabled:cursor-not-allowed
                                            disabled:opacity-50
                                        "
                    >
                      {probando
                        ? "Imprimiendo..."
                        : "Imprimir prueba"}
                    </button>
                  </div>

                  {/* PRUEBA CON LOGO */}

                  <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
                    <div className="mb-4 flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] text-xl">
                        🏷️
                      </div>

                      <div>
                        <h3 className="font-semibold text-[var(--color-text)]">
                          Ticket con logo
                        </h3>

                        <p className="text-xs text-[var(--color-text-secondary)]">
                          Comprueba la impresión del logo.
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={probarLogo}
                      disabled={
                        probandoLogo ||
                        !servicioConectado
                      }
                      className="
                                            w-full
                                            rounded-xl
                                            bg-[var(--color-primary)]
                                            px-4
                                            py-3
                                            text-sm
                                            font-semibold
                                            text-white
                                            transition
                                            hover:bg-[var(--color-primary-hover)]
                                            focus:outline-none
                                            focus:ring-2
                                            focus:ring-[var(--color-primary)]
                                            focus:ring-offset-2
                                            focus:ring-offset-[var(--color-surface)]
                                            disabled:cursor-not-allowed
                                            disabled:opacity-50
                                        "
                    >
                      {probandoLogo
                        ? "Imprimiendo..."
                        : "Imprimir con logo"}
                    </button>
                  </div>
                </div>
              </section>

              {/* ================================================= */}
              {/* INFORMACIÓN */}
              {/* ================================================= */}

              <section className="rounded-2xl border border-[var(--color-primary)] bg-[color-mix(in_srgb,var(--color-primary)_8%,var(--color-surface))] p-5">
                <div className="flex gap-3">
                  <div className="text-xl">
                    ℹ️
                  </div>

                  <div>
                    <h3 className="font-semibold text-[var(--color-primary)]">
                      Servicio de impresión
                    </h3>

                    <p className="mt-1 text-sm leading-6 text-[var(--color-text-secondary)]">
                      El punto de venta utiliza un servicio local de impresión para enviar
                      los tickets directamente a la impresora conectada a esta computadora.
                      El servicio{" "}
                      <strong className="text-[var(--color-text)]">
                        PrinterService
                      </strong>{" "}
                      se inicia automáticamente con Windows,
                      por lo que no es necesario abrirlo ni ejecutar ningún programa manualmente.
                    </p>
                  </div>
                </div>
              </section>
            </div>
          )}
        </div>
      </div>

      {/* ===================================================== */}
      {/* MODAL */}
      {/* ===================================================== */}

      <ModalMensaje
        abierto={modal.abierto}
        tipo={modal.tipo}
        titulo={modal.titulo}
        mensaje={modal.mensaje}
        onCerrar={cerrarModal}
      />
    </>
  );
}
