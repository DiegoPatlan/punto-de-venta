PRAGMA foreign_keys = ON;

-- ============================================================
-- 001_initial.sql
-- SQLite local - Punto de Venta v1.5.0
-- ============================================================

-- ============================================================
-- NEGOCIO
-- ============================================================

CREATE TABLE IF NOT EXISTS negocios (
    id TEXT PRIMARY KEY,
    nombre TEXT NOT NULL,
    tipo_negocio TEXT,
    telefono TEXT,
    email TEXT,
    direccion TEXT,
    logo_url TEXT,
    activo INTEGER NOT NULL DEFAULT 1,
    impuestos_activos INTEGER NOT NULL DEFAULT 0,
    iva_porcentaje NUMERIC NOT NULL DEFAULT 16.00,
    recargo_tarjeta_activo INTEGER NOT NULL DEFAULT 0,
    recargo_tarjeta_porcentaje NUMERIC NOT NULL DEFAULT 3.50,
    created_at TEXT NOT NULL
);

-- ============================================================
-- SUCURSALES
-- ============================================================

CREATE TABLE IF NOT EXISTS sucursales (
    id TEXT PRIMARY KEY,
    negocio_id TEXT NOT NULL,
    nombre TEXT NOT NULL,
    direccion TEXT,
    telefono TEXT,
    activo INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,

    FOREIGN KEY (negocio_id)
        REFERENCES negocios(id)
);

CREATE INDEX IF NOT EXISTS idx_sucursales_negocio
    ON sucursales(negocio_id);

-- ============================================================
-- USUARIOS
-- ============================================================

CREATE TABLE IF NOT EXISTS usuarios (
    id TEXT PRIMARY KEY,
    auth_user_id TEXT,
    negocio_id TEXT NOT NULL,
    nombre TEXT NOT NULL,
    rol TEXT NOT NULL,
    activo INTEGER NOT NULL DEFAULT 1,
    sucursal_id TEXT,
    foto_url TEXT,
    created_at TEXT NOT NULL,

    FOREIGN KEY (negocio_id)
        REFERENCES negocios(id),

    FOREIGN KEY (sucursal_id)
        REFERENCES sucursales(id)
);

CREATE INDEX IF NOT EXISTS idx_usuarios_negocio
    ON usuarios(negocio_id);

CREATE INDEX IF NOT EXISTS idx_usuarios_sucursal
    ON usuarios(sucursal_id);

-- ============================================================
-- USUARIO - SUCURSALES
-- ============================================================

CREATE TABLE IF NOT EXISTS usuario_sucursales (
    id TEXT PRIMARY KEY,
    usuario_id TEXT NOT NULL,
    sucursal_id TEXT NOT NULL,
    created_at TEXT NOT NULL,

    FOREIGN KEY (usuario_id)
        REFERENCES usuarios(id),

    FOREIGN KEY (sucursal_id)
        REFERENCES sucursales(id),

    UNIQUE(usuario_id, sucursal_id)
);

CREATE INDEX IF NOT EXISTS idx_usuario_sucursales_usuario
    ON usuario_sucursales(usuario_id);

CREATE INDEX IF NOT EXISTS idx_usuario_sucursales_sucursal
    ON usuario_sucursales(sucursal_id);

-- ============================================================
-- CAJAS
-- ============================================================

CREATE TABLE IF NOT EXISTS cajas (
    id TEXT PRIMARY KEY,
    sucursal_id TEXT NOT NULL,
    nombre TEXT NOT NULL,
    activo INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,

    FOREIGN KEY (sucursal_id)
        REFERENCES sucursales(id)
);

CREATE INDEX IF NOT EXISTS idx_cajas_sucursal
    ON cajas(sucursal_id);

-- ============================================================
-- USUARIO - CAJAS
-- ============================================================

CREATE TABLE IF NOT EXISTS usuario_cajas (
    id TEXT PRIMARY KEY,
    usuario_id TEXT NOT NULL,
    caja_id TEXT NOT NULL,
    created_at TEXT NOT NULL,

    FOREIGN KEY (usuario_id)
        REFERENCES usuarios(id),

    FOREIGN KEY (caja_id)
        REFERENCES cajas(id),

    UNIQUE(usuario_id, caja_id)
);

CREATE INDEX IF NOT EXISTS idx_usuario_cajas_usuario
    ON usuario_cajas(usuario_id);

CREATE INDEX IF NOT EXISTS idx_usuario_cajas_caja
    ON usuario_cajas(caja_id);

-- ============================================================
-- CATEGORIAS
-- ============================================================

CREATE TABLE IF NOT EXISTS categorias (
    id TEXT PRIMARY KEY,
    negocio_id TEXT NOT NULL,
    nombre TEXT NOT NULL,
    descripcion TEXT,
    activo INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,

    FOREIGN KEY (negocio_id)
        REFERENCES negocios(id)
);

CREATE INDEX IF NOT EXISTS idx_categorias_negocio
    ON categorias(negocio_id);

-- ============================================================
-- PRODUCTOS
-- ============================================================

CREATE TABLE IF NOT EXISTS productos (
    id TEXT PRIMARY KEY,
    negocio_id TEXT NOT NULL,
    categoria_id TEXT,
    codigo_barras TEXT,
    sku TEXT,
    nombre TEXT NOT NULL,
    descripcion TEXT,
    precio_compra NUMERIC NOT NULL DEFAULT 0,
    precio_venta NUMERIC NOT NULL DEFAULT 0,
    unidad TEXT NOT NULL DEFAULT 'pieza',
    imagen_url TEXT,
    stock_minimo NUMERIC NOT NULL DEFAULT 0,
    activo INTEGER NOT NULL DEFAULT 1,
    precio_base NUMERIC,
    created_at TEXT NOT NULL,
    updated_at TEXT,

    FOREIGN KEY (negocio_id)
        REFERENCES negocios(id),

    FOREIGN KEY (categoria_id)
        REFERENCES categorias(id),

    UNIQUE(negocio_id, codigo_barras)
);

CREATE INDEX IF NOT EXISTS idx_productos_negocio
    ON productos(negocio_id);

CREATE INDEX IF NOT EXISTS idx_productos_categoria
    ON productos(categoria_id);

CREATE INDEX IF NOT EXISTS idx_productos_codigo_barras
    ON productos(codigo_barras);

CREATE INDEX IF NOT EXISTS idx_productos_sku
    ON productos(sku);

-- ============================================================
-- INVENTARIO
-- ============================================================

CREATE TABLE IF NOT EXISTS inventario (
    id TEXT PRIMARY KEY,
    producto_id TEXT NOT NULL,
    sucursal_id TEXT NOT NULL,
    stock NUMERIC NOT NULL DEFAULT 0,
    stock_reservado NUMERIC NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT,

    FOREIGN KEY (producto_id)
        REFERENCES productos(id),

    FOREIGN KEY (sucursal_id)
        REFERENCES sucursales(id),

    UNIQUE(producto_id, sucursal_id)
);

CREATE INDEX IF NOT EXISTS idx_inventario_producto
    ON inventario(producto_id);

CREATE INDEX IF NOT EXISTS idx_inventario_sucursal
    ON inventario(sucursal_id);

-- ============================================================
-- CLIENTES
-- ============================================================

CREATE TABLE IF NOT EXISTS clientes (
    id TEXT PRIMARY KEY,
    negocio_id TEXT NOT NULL,
    nombre TEXT NOT NULL,
    telefono TEXT,
    email TEXT,
    direccion TEXT,
    rfc TEXT,
    limite_credito NUMERIC NOT NULL DEFAULT 0,
    saldo_credito NUMERIC NOT NULL DEFAULT 0,
    activo INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,

    FOREIGN KEY (negocio_id)
        REFERENCES negocios(id)
);

CREATE INDEX IF NOT EXISTS idx_clientes_negocio
    ON clientes(negocio_id);

-- ============================================================
-- SESIONES DE CAJA
-- ============================================================

CREATE TABLE IF NOT EXISTS sesiones_caja (
    id TEXT PRIMARY KEY,
    caja_id TEXT NOT NULL,
    usuario_apertura_id TEXT NOT NULL,
    usuario_cierre_id TEXT,
    monto_inicial NUMERIC NOT NULL DEFAULT 0,
    monto_esperado NUMERIC NOT NULL DEFAULT 0,
    monto_real NUMERIC,
    diferencia NUMERIC,
    estado TEXT NOT NULL DEFAULT 'abierta',
    fecha_apertura TEXT NOT NULL,
    fecha_cierre TEXT,

    FOREIGN KEY (caja_id)
        REFERENCES cajas(id),

    FOREIGN KEY (usuario_apertura_id)
        REFERENCES usuarios(id),

    FOREIGN KEY (usuario_cierre_id)
        REFERENCES usuarios(id)
);

CREATE INDEX IF NOT EXISTS idx_sesiones_caja_caja
    ON sesiones_caja(caja_id);

CREATE INDEX IF NOT EXISTS idx_sesiones_caja_usuario
    ON sesiones_caja(usuario_apertura_id);

CREATE INDEX IF NOT EXISTS idx_sesiones_caja_estado
    ON sesiones_caja(estado);

-- ============================================================
-- VENTAS
-- ============================================================

CREATE TABLE IF NOT EXISTS ventas (
    id TEXT PRIMARY KEY,
    negocio_id TEXT NOT NULL,
    sucursal_id TEXT NOT NULL,
    caja_id TEXT NOT NULL,
    sesion_caja_id TEXT NOT NULL,
    usuario_id TEXT NOT NULL,
    cliente_id TEXT,
    subtotal NUMERIC NOT NULL DEFAULT 0,
    descuento NUMERIC NOT NULL DEFAULT 0,
    impuesto NUMERIC NOT NULL DEFAULT 0,
    total NUMERIC NOT NULL DEFAULT 0,
    metodo_pago TEXT NOT NULL,
    estado TEXT NOT NULL,
    referencia TEXT,
    notas TEXT,
    created_at TEXT NOT NULL,
    folio INTEGER,

    FOREIGN KEY (negocio_id)
        REFERENCES negocios(id),

    FOREIGN KEY (sucursal_id)
        REFERENCES sucursales(id),

    FOREIGN KEY (caja_id)
        REFERENCES cajas(id),

    FOREIGN KEY (sesion_caja_id)
        REFERENCES sesiones_caja(id),

    FOREIGN KEY (usuario_id)
        REFERENCES usuarios(id),

    FOREIGN KEY (cliente_id)
        REFERENCES clientes(id)
);

CREATE INDEX IF NOT EXISTS idx_ventas_negocio
    ON ventas(negocio_id);

CREATE INDEX IF NOT EXISTS idx_ventas_sucursal
    ON ventas(sucursal_id);

CREATE INDEX IF NOT EXISTS idx_ventas_sesion
    ON ventas(sesion_caja_id);

CREATE INDEX IF NOT EXISTS idx_ventas_usuario
    ON ventas(usuario_id);

CREATE INDEX IF NOT EXISTS idx_ventas_folio
    ON ventas(folio);

-- ============================================================
-- DETALLE DE VENTAS
-- ============================================================

CREATE TABLE IF NOT EXISTS detalle_ventas (
    id TEXT PRIMARY KEY,
    venta_id TEXT NOT NULL,
    producto_id TEXT NOT NULL,
    cantidad NUMERIC NOT NULL,
    precio_unitario NUMERIC NOT NULL,
    descuento NUMERIC NOT NULL DEFAULT 0,
    impuesto NUMERIC NOT NULL DEFAULT 0,
    subtotal NUMERIC NOT NULL DEFAULT 0,
    total NUMERIC NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,

    FOREIGN KEY (venta_id)
        REFERENCES ventas(id),

    FOREIGN KEY (producto_id)
        REFERENCES productos(id)
);

CREATE INDEX IF NOT EXISTS idx_detalle_ventas_venta
    ON detalle_ventas(venta_id);

CREATE INDEX IF NOT EXISTS idx_detalle_ventas_producto
    ON detalle_ventas(producto_id);

-- ============================================================
-- PAGOS
-- ============================================================

CREATE TABLE IF NOT EXISTS pagos (
    id TEXT PRIMARY KEY,
    venta_id TEXT NOT NULL,
    metodo_pago TEXT NOT NULL,
    monto NUMERIC NOT NULL,
    monto_recibido NUMERIC,
    cambio NUMERIC NOT NULL DEFAULT 0,
    referencia TEXT,
    created_at TEXT NOT NULL,

    FOREIGN KEY (venta_id)
        REFERENCES ventas(id)
);

CREATE INDEX IF NOT EXISTS idx_pagos_venta
    ON pagos(venta_id);

-- ============================================================
-- MOVIMIENTOS DE CAJA
-- ============================================================

CREATE TABLE IF NOT EXISTS movimientos_caja (
    id TEXT PRIMARY KEY,
    sesion_caja_id TEXT NOT NULL,
    usuario_id TEXT NOT NULL,
    tipo TEXT NOT NULL,
    concepto TEXT,
    monto NUMERIC NOT NULL,
    referencia_id TEXT,
    created_at TEXT NOT NULL,
    usuario_autorizacion_id TEXT,
    usuario_autorizador_id TEXT,

    FOREIGN KEY (sesion_caja_id)
        REFERENCES sesiones_caja(id),

    FOREIGN KEY (usuario_id)
        REFERENCES usuarios(id),

    FOREIGN KEY (usuario_autorizacion_id)
        REFERENCES usuarios(id),

    FOREIGN KEY (usuario_autorizador_id)
        REFERENCES usuarios(id)
);

CREATE INDEX IF NOT EXISTS idx_movimientos_caja_sesion
    ON movimientos_caja(sesion_caja_id);

CREATE INDEX IF NOT EXISTS idx_movimientos_caja_usuario
    ON movimientos_caja(usuario_id);

CREATE INDEX IF NOT EXISTS idx_movimientos_caja_referencia
    ON movimientos_caja(referencia_id);

-- ============================================================
-- MOVIMIENTOS DE INVENTARIO
-- ============================================================

CREATE TABLE IF NOT EXISTS movimientos_inventario (
    id TEXT PRIMARY KEY,
    inventario_id TEXT NOT NULL,
    usuario_id TEXT,
    tipo TEXT NOT NULL,
    cantidad NUMERIC NOT NULL,
    stock_anterior NUMERIC NOT NULL,
    stock_nuevo NUMERIC NOT NULL,
    referencia_id TEXT NOT NULL,
    motivo TEXT,
    created_at TEXT NOT NULL,

    FOREIGN KEY (inventario_id)
        REFERENCES inventario(id),

    FOREIGN KEY (usuario_id)
        REFERENCES usuarios(id)
);

CREATE INDEX IF NOT EXISTS idx_movimientos_inventario_inventario
    ON movimientos_inventario(inventario_id);

CREATE INDEX IF NOT EXISTS idx_movimientos_inventario_usuario
    ON movimientos_inventario(usuario_id);

CREATE INDEX IF NOT EXISTS idx_movimientos_inventario_referencia
    ON movimientos_inventario(referencia_id);
