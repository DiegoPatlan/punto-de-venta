
# 🛒 Sistema de Punto de Venta Multi-Negocios — Soporte IT

Sistema de punto de venta desarrollado para facilitar la administración y operación de negocios mediante herramientas de gestión comercial, control de inventario y seguimiento de operaciones.

La plataforma cuenta con un panel administrativo y un módulo de Punto de Venta (POS), con interfaces adaptables a diferentes dispositivos.

🌐 **Aplicación web:** https://punto-de-ventasit.vercel.app/admin/login

---

## 🚀 Características principales

- Gestión de productos, categorías y proveedores.
- Registro y administración de ventas y compras.
- Control de inventario y movimientos de mercancía.
- Administración de clientes y ventas a crédito.
- Gestión de cajas y movimientos de efectivo.
- Administración de usuarios y roles.
- Control de sucursales y traspasos.
- Gestión de devoluciones y gastos.
- Configuración fiscal e impuestos.
- Consulta de reportes y cuentas por pagar.
- Configuración de impresoras para tickets de compra.
- Personalización de la apariencia del sistema.

## 🏗️ Arquitectura del sistema

El proyecto utiliza una arquitectura web basada en Next.js y Supabase, separando la interfaz de usuario de los servicios de autenticación y almacenamiento de información.

**Componentes principales:**

- **Frontend:** Next.js, React y TypeScript.
- **Backend y servicios:** Supabase.
- **Base de datos:** PostgreSQL.
- **Autenticación:** Supabase Auth.
- **Control de acceso:** Roles y permisos de usuario.
- **Despliegue:** Vercel.

El sistema está organizado en dos módulos principales:

- **Panel de Administración:** permite gestionar y supervisar las operaciones del negocio.
- **Punto de Venta (POS):** permite realizar ventas y administrar las operaciones cotidianas de caja.

La aplicación contempla la separación de información por negocio y el control de acceso a los datos mediante mecanismos de seguridad de Supabase.

## 🛠️ Tecnologías utilizadas

### Frontend

<table>
  <tr>
    <td align="center" width="120">
      <img src="https://skillicons.dev/icons?i=nextjs" width="40"><br>
      <b>Next.js</b>
    </td>
    <td align="center" width="120">
      <img src="https://skillicons.dev/icons?i=react" width="40"><br>
      <b>React</b>
    </td>
    <td align="center" width="120">
      <img src="https://skillicons.dev/icons?i=ts" width="40"><br>
      <b>TypeScript</b>
    </td>
    <td align="center" width="120">
      <img src="https://skillicons.dev/icons?i=js" width="40"><br>
      <b>JavaScript</b>
    </td>
    <td align="center" width="120">
      <img src="https://skillicons.dev/icons?i=tailwind" width="40"><br>
      <b>Tailwind CSS</b>
    </td>
  </tr>
</table>

### Backend y base de datos

<table>
  <tr>
    <td align="center" width="120">
      <img src="https://skillicons.dev/icons?i=supabase" width="40"><br>
      <b>Supabase</b>
    </td>
    <td align="center" width="120">
      <img src="https://skillicons.dev/icons?i=postgres" width="40"><br>
      <b>PostgreSQL</b>
    </td>
  </tr>
</table>

### Herramientas y despliegue

<table>
  <tr>
    <td align="center" width="120">
      <img src="https://skillicons.dev/icons?i=git" width="40"><br>
      <b>Git</b>
    </td>
    <td align="center" width="120">
      <img src="https://skillicons.dev/icons?i=github" width="40"><br>
      <b>GitHub</b>
    </td>
    <td align="center" width="120">
      <img src="https://skillicons.dev/icons?i=vercel" width="40"><br>
      <b>Vercel</b>
    </td>
  </tr>
</table>

### Librerías

- ExcelJS
- XLSX

## 🎯 Objetivo del proyecto

Desarrollar una plataforma que permita administrar las principales operaciones de un negocio desde una interfaz intuitiva, adaptable y fácil de utilizar, integrando herramientas de gestión comercial, inventario, ventas y administración.

## 👨‍💻 Desarrollador

Proyecto desarrollado como iniciativa personal para aplicar y fortalecer conocimientos en desarrollo de software, diseño de interfaces, integración de servicios backend y gestión de bases de datos.

---

## 🔐 Accesos de demostración

La aplicación cuenta con dos módulos independientes:

**🛡️ Panel de Administración**

https://punto-ventasit.vercel.app/admin/login

Permite explorar las herramientas de administración y configuración del negocio.

**🛒 Punto de Venta (POS)**

https://punto-ventasit.vercel.app/pos/login

Permite explorar las funciones de venta, clientes, productos y operaciones de caja.

> **Nota:** Los accesos de demostración se pueden solicitar directamente al desarrollador.

---

# 🖥️ Panel de Administración

El panel administrativo permite gestionar y supervisar las diferentes operaciones del negocio desde una plataforma centralizada.

## 🔐 Acceso al sistema

<table>
  <tr>
    <td align="center">
      <a href="screenshots/loginadmin.png">
        <img src="screenshots/loginadmin.png" width="320" alt="Inicio de sesión administrativo">
      </a>
      <br><sub><b>Inicio de sesión administrativo</b></sub>
    </td>
    <td align="center">
      <a href="screenshots/dashboardadmin.png">
        <img src="screenshots/dashboardadmin.png" width="320" alt="Dashboard administrativo">
      </a>
      <br><sub><b>Dashboard principal</b></sub>
    </td>
  </tr>
</table>

## 📦 Gestión comercial

Administración del catálogo de productos, categorías, clientes y proveedores.

<table>
  <tr>
    <td align="center">
      <a href="screenshots/productosadmin.png">
        <img src="screenshots/productosadmin.png" width="320" alt="Productos">
      </a>
      <br><sub><b>Productos</b></sub>
    </td>
    <td align="center">
      <a href="screenshots/categoriasadmin.png">
        <img src="screenshots/categoriasadmin.png" width="320" alt="Categorías">
      </a>
      <br><sub><b>Categorías</b></sub>
    </td>
  </tr>
  <tr>
    <td align="center">
      <a href="screenshots/clientesadmin.png">
        <img src="screenshots/clientesadmin.png" width="320" alt="Clientes">
      </a>
      <br><sub><b>Clientes</b></sub>
    </td>
    <td align="center">
      <a href="screenshots/proveedoresadmin.png">
        <img src="screenshots/proveedoresadmin.png" width="320" alt="Proveedores">
      </a>
      <br><sub><b>Proveedores</b></sub>
    </td>
  </tr>
</table>

## 💰 Operaciones comerciales

Módulos para administrar las operaciones de venta, compras, devoluciones y gastos.

<table>
  <tr>
    <td align="center">
      <a href="screenshots/ventasadmin.png">
        <img src="screenshots/ventasadmin.png" width="320" alt="Ventas">
      </a>
      <br><sub><b>Ventas</b></sub>
    </td>
    <td align="center">
      <a href="screenshots/comprasadmin.png">
        <img src="screenshots/comprasadmin.png" width="320" alt="Compras">
      </a>
      <br><sub><b>Compras</b></sub>
    </td>
  </tr>
  <tr>
    <td align="center">
      <a href="screenshots/devolucionesadmin.png">
        <img src="screenshots/devolucionesadmin.png" width="320" alt="Devoluciones">
      </a>
      <br><sub><b>Devoluciones</b></sub>
    </td>
    <td align="center">
      <a href="screenshots/gastosadmin.png">
        <img src="screenshots/gastosadmin.png" width="320" alt="Gastos">
      </a>
      <br><sub><b>Gastos</b></sub>
    </td>
  </tr>
</table>

## 📋 Control de inventario

Herramientas para consultar existencias, registrar movimientos y gestionar traspasos de mercancía.

<table>
  <tr>
    <td align="center">
      <a href="screenshots/inventarioadmin.png">
        <img src="screenshots/inventarioadmin.png" width="320" alt="Inventario">
      </a>
      <br><sub><b>Inventario</b></sub>
    </td>
    <td align="center">
      <a href="screenshots/movimientosinventarioadmin.png">
        <img src="screenshots/movimientosinventarioadmin.png" width="320" alt="Movimientos de inventario">
      </a>
      <br><sub><b>Movimientos de inventario</b></sub>
    </td>
  </tr>
  <tr>
    <td align="center" colspan="2">
      <a href="screenshots/transpasosadmin.png">
        <img src="screenshots/transpasosadmin.png" width="320" alt="Traspasos">
      </a>
      <br><sub><b>Traspasos</b></sub>
    </td>
  </tr>
</table>

## 🏢 Administración del negocio

Gestión de cajas, sucursales y usuarios del sistema.

<table>
  <tr>
    <td align="center">
      <a href="screenshots/cajasadmin.png">
        <img src="screenshots/cajasadmin.png" width="320" alt="Cajas">
      </a>
      <br><sub><b>Cajas</b></sub>
    </td>
    <td align="center">
      <a href="screenshots/sucursalesadmin.png">
        <img src="screenshots/sucursalesadmin.png" width="320" alt="Sucursales">
      </a>
      <br><sub><b>Sucursales</b></sub>
    </td>
  </tr>
  <tr>
    <td align="center" colspan="2">
      <a href="screenshots/usuariosadmin.png">
        <img src="screenshots/usuariosadmin.png" width="320" alt="Usuarios">
      </a>
      <br><sub><b>Usuarios y roles</b></sub>
    </td>
  </tr>
</table>

## 📈 Finanzas y reportes

Consulta y seguimiento de información financiera y operativa.

<table>
  <tr>
    <td align="center">
      <a href="screenshots/cuentasporpagaradmin.png">
        <img src="screenshots/cuentasporpagaradmin.png" width="320" alt="Cuentas por pagar">
      </a>
      <br><sub><b>Cuentas por pagar</b></sub>
    </td>
    <td align="center">
      <a href="screenshots/reportesadmin.png">
        <img src="screenshots/reportesadmin.png" width="320" alt="Reportes">
      </a>
      <br><sub><b>Reportes</b></sub>
    </td>
  </tr>
</table>

## ⚙️ Configuración del sistema

El sistema incluye opciones para adaptar diferentes parámetros de funcionamiento del negocio:

- Configuración fiscal e impuestos.
- Integración y configuración de terminales de Mercado Pago.
- Personalización de la apariencia e identidad visual del negocio.

<table>
  <tr>
    <td align="center">
      <a href="screenshots/configuracionadmin.png">
        <img src="screenshots/configuracionadmin.png" width="320" alt="Configuración administrativa">
      </a>
      <br><sub><b>Configuración del sistema</b></sub>
    </td>
  </tr>
</table>

---

# 🛒 Punto de Venta (POS)

Módulo diseñado para realizar las operaciones comerciales del negocio, permitiendo gestionar ventas, clientes, productos y movimientos de caja desde una interfaz intuitiva.

## 🔐 Acceso al sistema

<table>
  <tr>
    <td align="center">
      <a href="screenshots/loginpos.png">
        <img src="screenshots/loginpos.png" width="320" alt="Inicio de sesión POS">
      </a>
      <br><sub><b>Inicio de sesión POS</b></sub>
    </td>
    <td align="center">
      <a href="screenshots/puntodeventapos.png">
        <img src="screenshots/puntodeventapos.png" width="320" alt="Pantalla principal de ventas">
      </a>
      <br><sub><b>Pantalla principal de ventas</b></sub>
    </td>
  </tr>
</table>

## 📦 Productos y clientes

Consulta de productos disponibles y administración de clientes del negocio.

<table>
  <tr>
    <td align="center">
      <a href="screenshots/productospos.png">
        <img src="screenshots/productospos.png" width="320" alt="Productos POS">
      </a>
      <br><sub><b>Productos</b></sub>
    </td>
    <td align="center">
      <a href="screenshots/clientespos.png">
        <img src="screenshots/clientespos.png" width="320" alt="Clientes POS">
      </a>
      <br><sub><b>Clientes y crédito</b></sub>
    </td>
  </tr>
</table>

El módulo de clientes permite registrar nuevos clientes, consultar su información y gestionar aquellos que realizan compras mediante crédito.

## 🧾 Historial de ventas y devoluciones

Consulta de las ventas realizadas y gestión de devoluciones de productos.

<table>
  <tr>
    <td align="center">
      <a href="screenshots/historialdeventaspos.png">
        <img src="screenshots/historialdeventaspos.png" width="320" alt="Historial de ventas">
      </a>
      <br><sub><b>Historial de ventas</b></sub>
    </td>
    <td align="center">
      <a href="screenshots/devolucionespos.png">
        <img src="screenshots/devolucionespos.png" width="320" alt="Devoluciones POS">
      </a>
      <br><sub><b>Devoluciones</b></sub>
    </td>
  </tr>
</table>

## 💵 Gestión de caja

Herramientas para supervisar las operaciones y movimientos relacionados con la caja.

<table>
  <tr>
    <td align="center">
      <a href="screenshots/infodecajapos.png">
        <img src="screenshots/infodecajapos.png" width="320" alt="Información de caja">
      </a>
      <br><sub><b>Información y movimientos</b></sub>
    </td>
    <td align="center">
      <a href="screenshots/resumendecajapos.png">
        <img src="screenshots/resumendecajapos.png" width="320" alt="Resumen de caja">
      </a>
      <br><sub><b>Resumen de caja</b></sub>
    </td>
  </tr>
  <tr>
    <td align="center" colspan="2">
      <a href="screenshots/cierredecajapos.png">
        <img src="screenshots/cierredecajapos.png" width="320" alt="Cierre de caja">
      </a>
      <br><sub><b>Cierre de caja</b></sub>
    </td>
  </tr>
</table>

## ⚙️ Configuración del POS

El módulo cuenta con opciones para adaptar el funcionamiento y la apariencia de la interfaz.

Entre sus funcionalidades se encuentran:

- Configuración de impresoras para la impresión de tickets de compra.
- Personalización de la apariencia de la interfaz.
- Configuración de opciones del punto de venta.

<table>
  <tr>
    <td align="center">
      <a href="screenshots/configuracionpos.png">
        <img src="screenshots/configuracionpos.png" width="320" alt="Configuración del POS">
      </a>
      <br><sub><b>Configuración del POS</b></sub>
    </td>
  </tr>
</table>

---

## 🖥️ Versión de escritorio

Se contempla una versión de escritorio desarrollada con **Tauri**, actualmente en desarrollo.

## 📌 Estado del proyecto

La aplicación web se encuentra desplegada y disponible para demostración.

La versión de escritorio continúa en desarrollo.
