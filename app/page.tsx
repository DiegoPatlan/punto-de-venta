import Card from "./components/Card";

export default function Home() {
  return (
    <div className="space-y-6">

      <div>
        <h1 className="text-2xl font-bold text-[var(--color-text)] sm:text-3xl">
          Dashboard
        </h1>

        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Resumen general de tu negocio.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">

        <Card className="p-5">
          <p className="text-sm text-[var(--color-text-secondary)]">
            Ventas de hoy
          </p>

          <p className="mt-2 text-2xl font-bold text-[var(--color-text)]">
            $0.00
          </p>
        </Card>

        <Card className="p-5">
          <p className="text-sm text-[var(--color-text-secondary)]">
            Productos
          </p>

          <p className="mt-2 text-2xl font-bold text-[var(--color-text)]">
            0
          </p>
        </Card>

        <Card className="p-5">
          <p className="text-sm text-[var(--color-text-secondary)]">
            Clientes
          </p>

          <p className="mt-2 text-2xl font-bold text-[var(--color-text)]">
            0
          </p>
        </Card>

        <Card className="p-5">
          <p className="text-sm text-[var(--color-text-secondary)]">
            Stock bajo
          </p>

          <p className="mt-2 text-2xl font-bold text-[var(--color-text)]">
            0
          </p>
        </Card>

      </div>

      <Card className="p-6">
        <h2 className="text-lg font-bold text-[var(--color-text)]">
          Bienvenido al sistema
        </h2>

        <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
          Desde aquí podrás administrar ventas, productos,
          inventario, compras, clientes y las diferentes
          operaciones de tu negocio.
        </p>
      </Card>

    </div>
  );
}