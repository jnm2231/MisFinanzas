# Mis Finanzas 💶

Aplicación móvil de **gestión financiera personal** para Android, 100% local y sin cuentas en la nube: todos los datos viven en una base de datos SQLite dentro del propio dispositivo.

Construida con **React Native + Expo (SDK 54)**, **Expo Router** (navegación por pestañas) y **TypeScript**.

**Versión actual: 0.5**

---

## Índice

1. [Qué hace la app](#qué-hace-la-app)
2. [Pantallas](#pantallas)
3. [Arquitectura y diseño](#arquitectura-y-diseño)
4. [Base de datos](#base-de-datos)
5. [Lógica de negocio clave](#lógica-de-negocio-clave)
6. [Cotizaciones online](#cotizaciones-online)
7. [Copias de seguridad](#copias-de-seguridad)
8. [Estructura del proyecto](#estructura-del-proyecto)
9. [Desarrollo: cómo ejecutarla](#desarrollo-cómo-ejecutarla)
10. [Generar el APK](#generar-el-apk)
11. [Historial de versiones](#historial-de-versiones)

---

## Qué hace la app

- Registra **gastos e ingresos** en segundos contra una "Cuenta Base" configurable.
- Gestiona varias **cuentas bancarias** con su saldo y **transferencias internas** entre ellas.
- Muestra el **balance** por día, mes o año, con desglose por categorías y un calendario que enseña el neto de cada día/mes/año.
- Calcula el **patrimonio total** (efectivo + inversiones) con gráfico circular de reparto y gráfico de líneas con su evolución histórica.
- Gestiona **inversiones** (fondos indexados, ETFs y acciones) con cotización automática vía internet o valor manual.
- Permite **exportar e importar** todos los datos (CSV o JSON) para no perder nada al cambiar de móvil.

## Pantallas

La app se organiza en 6 pestañas inferiores. **Agregar** es la pantalla inicial.

### ➕ Agregar
Registro rápido de movimientos. Dos tarjetas independientes:

- **Gasto**: importe + categoría (chips seleccionables) + botón rojo "Agregar Gasto".
- **Ingreso**: importe + tipo de ingreso + botón verde "Agregar Ingreso".

Al guardar, el importe se **suma o resta automáticamente del saldo de la Cuenta Base** (la cuenta marcada en Ajustes). Un banner superior muestra cuál es la Cuenta Base y su saldo en todo momento. Las categorías y tipos de ingreso se administran desde Ajustes.

### 📋 Balance
Análisis de movimientos por periodo, con tres modos: **Día / Mensual / Anual**.

- **Selector de periodo**: flechas para avanzar/retroceder, o toca la etiqueta del periodo para abrir el **calendario emergente**:
  - *Modo día*: cuadrícula del mes con todos sus días; cada día muestra su balance neto (verde/rojo).
  - *Modo mes*: los 12 meses del año, cada uno con su neto.
  - *Modo año*: todos los años con movimientos, cada uno con su neto.
  - Tocando el título del calendario subes de nivel (junio 2026 → 2026 → años) y tocando una celda bajas de nivel o seleccionas el periodo.
- **Resumen**: ingresos, gastos y balance (ingresos − gastos) del periodo.
- **Desglose por categoría**: barras horizontales con la cantidad y el porcentaje de cada categoría, tanto de gastos como de ingresos.
- **Listados**: en modo día/mensual se listan los movimientos individuales (con papelera para eliminarlos, revirtiendo el saldo); en modo anual se muestra un **resumen agrupado por mes** (ingresos, gastos y neto de cada mes).

### 🏦 Cuentas
- Listado de todas las cuentas con su saldo (la Cuenta Base lleva distintivo). Pulsación larga para eliminar una cuenta (solo si no tiene movimientos ni inversiones asociadas).
- **Transferencia interna**: mueve dinero de una cuenta a otra. No es un gasto ni un ingreso: resta en origen y suma en destino.
- **Nueva Cuenta de Banco**: crea una cuenta con nombre y saldo inicial.

### 🥧 Patrimonio
- **Gráfico circular** con el reparto de todo el dinero: una porción por cada cuenta con saldo y una por cada tipo de inversión (Fondos / ETFs / Acciones), con leyenda de importes y porcentajes.
- **Patrimonio Total** en grande: suma de efectivo + valor actual de las inversiones.
- **Evolución del Patrimonio**: gráfico de líneas con el histórico. La app guarda una "foto" diaria del patrimonio cada vez que se abre; si el histórico abarca varios meses, el gráfico se agrupa por mes.
- Desglose numérico: efectivo por cuenta y valor actual por inversión.

### 📈 Inversiones
- **Listado jerárquico** por tipo: Fondos, ETFs y Acciones, con subtotal por sección. Cada inversión muestra: plataforma, símbolo (o "valor manual"), capital aportado, valor actual y rentabilidad (€ y %).
- **Cotización automática**: al entrar en la pestaña (y con el botón "Cotizaciones") se consulta el precio actual de los activos con símbolo y se recalcula su valor. Si la API no responde, en lugar de la rentabilidad aparece un aviso amarillo "API no disponible" y se conserva el último valor conocido — sin alertas ni pantallas en blanco.
- **Edición integral (lápiz)**: cambiar nombre, símbolo, plataforma o valor actual sin perder el capital aportado. Al cambiar la plataforma, el capital se devuelve a la cuenta antigua y se descuenta de la nueva (que debe tener saldo suficiente).
- **Nueva Inversión**: crear un activo nuevo (nombre, tipo, plataforma, símbolo opcional, importe) o hacer una **aportación** a una inversión existente. El importe siempre sale del saldo de la cuenta plataforma.
- Pulsación larga sobre una inversión: **vender** (eliminar devolviendo su valor actual a la cuenta) o eliminar sin devolver.

### ⚙️ Ajustes
- **Cuenta Base**: selector de la cuenta sobre la que operan los movimientos rápidos de Agregar.
- **Categorías de gasto** y **tipos de ingreso**: añadir y eliminar (los movimientos antiguos de una categoría borrada pasan a "Sin categoría").
- **Copia de seguridad**: exportar todo a CSV o JSON e importar un backup para restaurar (ver [Copias de seguridad](#copias-de-seguridad)).
- **Zona peligrosa**: borrar todos los datos y empezar de cero.
- **Acerca de**: versión actual de la aplicación.

---

## Arquitectura y diseño

### Principios

- **100% local**: sin backend, sin login, sin nube. La única conexión a internet es la consulta de cotizaciones (opcional) y es de solo lectura.
- **SQLite como única fuente de verdad**: no hay estado global en memoria (Redux, etc.). Cada pantalla relee sus datos de la base de datos al recibir el foco (`useFocusEffect`), de modo que cualquier cambio hecho en una pestaña se refleja al instante en las demás.
- **Operaciones atómicas**: todo lo que toca más de una tabla o más de un saldo (transferencias, inversiones, importación de backups...) se ejecuta dentro de una transacción SQL (`withTransactionAsync`). O se aplica todo, o no se aplica nada.
- **Tema claro/oscuro automático** según el sistema, con una paleta común definida en `constants/theme.ts`.
- **Gráficos propios**: el gráfico circular, el de líneas y las barras por categoría están dibujados a mano con `react-native-svg` y Views, sin librerías de gráficos pesadas.

### Flujo de datos

```
Pantalla (React) ──llama──▶ db/queries.ts ──SQL──▶ SQLite (expo-sqlite)
      ▲                                                  │
      └────────── recarga con useFocusEffect ◀───────────┘
```

- `app/_layout.tsx` monta `SQLiteProvider`, que abre la base de datos `mis-finanzas.db`, ejecuta `initDatabase` (creación de tablas + datos semilla) y registra la foto diaria del patrimonio.
- Las pantallas obtienen la conexión con `useSQLiteContext()` y solo hablan con la capa `db/queries.ts`; nunca escriben SQL directamente.

---

## Base de datos

Esquema relacional en SQLite (`db/database.ts`):

```
accounts ◀──────────────┐
  id, name, balance     │
      ▲  ▲              │
      │  │ account_id / to_account_id
      │  │              │
      │  transactions ──┘        categories
      │    id, type ('gasto'|'ingreso'|'transferencia'),
      │    amount, category_id ──────▶ id, name,
      │    note, date                  type ('gasto'|'ingreso')
      │
      │ platform_account_id
      │
  investments                       settings
    id, name, type ('fondo'|          key, value
    'etf'|'accion'), symbol,          └─ 'base_account_id'
    invested, units,
    current_value, last_updated     net_worth_snapshots
                                      date (PK), cash,
                                      invested, total
```

| Tabla | Qué guarda |
|---|---|
| `accounts` | Cuentas bancarias con su saldo actual. |
| `categories` | Categorías de gasto y tipos de ingreso (campo `type` las distingue). |
| `transactions` | Gastos, ingresos y transferencias. En transferencias, `account_id` es el origen y `to_account_id` el destino. |
| `investments` | Activos de inversión ligados a una cuenta plataforma. |
| `settings` | Pares clave/valor; aquí vive el id de la Cuenta Base. |
| `net_worth_snapshots` | Foto diaria del patrimonio (efectivo, invertido, total) para el gráfico de evolución. |

Detalles de diseño:

- Las **fechas** se guardan como texto ISO local (`2026-06-12T18:30:00`), lo que permite filtrar por año/mes/día con un simple `LIKE 'prefijo%'` y agrupar con `substr()`.
- `transactions.category_id` tiene `ON DELETE SET NULL`: borrar una categoría no borra sus movimientos.
- Al primer arranque se crean datos semilla: la cuenta "Cuenta Principal" (marcada como Base) y categorías habituales.

## Lógica de negocio clave

- **Cuenta Base**: los gastos/ingresos de la pestaña Agregar siempre se aplican a la cuenta indicada en `settings.base_account_id`. Cambiarla en Ajustes no altera movimientos pasados.
- **Eliminación con reversión**: borrar un movimiento revierte su efecto en los saldos (un gasto borrado devuelve el dinero; una transferencia borrada deshace ambos apuntes).
- **El dinero invertido sale del efectivo**: crear una inversión o aportar a ella descuenta el importe del saldo de su cuenta plataforma. Así, el Patrimonio Total (efectivo + invertido) no se duplica: invertir solo mueve dinero de una columna a otra. Por coherencia, se valida que la cuenta tenga saldo suficiente.
- **Participaciones (`units`)**: si una inversión tiene símbolo, al crearla se calcula `units = importe / precio`. El valor actual es siempre `units × precio de mercado`. Las aportaciones compran participaciones al precio del momento, lo que equivale a promediar el precio de compra.
- **Snapshot diario**: como el valor de las inversiones no puede reconstruirse hacia atrás, la evolución del patrimonio se construye con fotos diarias (`INSERT OR REPLACE`, máximo una por día) tomadas al abrir la app y al visitar Patrimonio.

## Cotizaciones online

- **Fuente**: la API pública de gráficos de Yahoo Finance (`query1.finance.yahoo.com/v8/finance/chart/<símbolo>`). No requiere clave de API; se lee el campo `regularMarketPrice`.
- **Símbolos**: usa el ticker de una bolsa en euros para evitar mezclar divisas (la app no convierte): `VWCE.DE` (Xetra), `SAN.MC` (Madrid), `CSPX.AS` (Ámsterdam)... Las acciones americanas (`AAPL`) cotizan en USD: el número será correcto en USD pero se mostrará con €.
- **Fondos indexados españoles**: muchos no tienen ticker público. En ese caso deja el símbolo vacío y ajusta el valor a mano con el lápiz.
- **Tolerancia a fallos**: si la API no responde, la inversión muestra "API no disponible" en amarillo y conserva el último valor conocido. Nada se bloquea ni aparecen alertas.

## Copias de seguridad

En Ajustes → Copia de seguridad (`lib/backup.ts`):

- **Exportar**: genera un único archivo `mis-finanzas-backup-AAAA-MM-DD.csv` (o `.json`) con **todas** las tablas y abre el diálogo de compartir de Android para guardarlo (Drive, descargas, email...).
  - El CSV usa secciones `#TABLE <nombre>`, cada una con su cabecera de columnas, y entrecomillado estándar RFC 4180.
  - El JSON es un objeto con un array por tabla.
- **Importar**: selecciona un archivo CSV o JSON exportado por la app. Tras mostrar un resumen y pedir confirmación, **reemplaza por completo** los datos actuales conservando los ids originales (las relaciones entre tablas quedan intactas).

Para cambiar de móvil: exporta en el viejo → pasa el archivo (Drive, cable...) → instala la app en el nuevo → importa.

## Estructura del proyecto

```
expo-app/
├── app/
│   ├── _layout.tsx           # Raíz: SQLiteProvider + Stack
│   └── (tabs)/
│       ├── _layout.tsx       # Definición de las 6 pestañas
│       ├── index.tsx         # Agregar (pantalla inicial)
│       ├── balance.tsx       # Balance (día/mes/año + calendario)
│       ├── cuentas.tsx       # Cuentas y transferencias
│       ├── patrimonio.tsx    # Pie chart + evolución
│       ├── inversiones.tsx   # Inversiones y cotizaciones
│       └── ajustes.tsx       # Configuración y backup
├── db/
│   ├── database.ts           # Esquema, semilla, tipos
│   └── queries.ts            # Toda la capa de acceso a datos
├── lib/
│   ├── format.ts             # Moneda, fechas, parseo de importes
│   ├── quotes.ts             # Cliente de Yahoo Finance
│   └── backup.ts             # Export/import CSV y JSON
├── components/
│   ├── pie-chart.tsx         # Gráfico circular (SVG)
│   ├── line-chart.tsx        # Gráfico de líneas (SVG)
│   ├── category-bars.tsx     # Barras por categoría
│   ├── period-calendar.tsx   # Calendario día/mes/año con netos
│   └── select-modal.tsx      # Desplegable genérico
└── constants/theme.ts        # Paleta clara/oscura
```

## Desarrollo: cómo ejecutarla

Requisitos: Node.js LTS y la app **Expo Go** en el móvil (misma WiFi que el PC).

```bash
npm install
npx expo start
```

Escanea el QR con Expo Go (Android) o la cámara (iOS). Comprobaciones de calidad:

```bash
npx tsc --noEmit   # tipos
npm run lint       # eslint
```

## Generar el APK

La compilación se hace en la nube con **EAS Build** (gratuito con cuenta de Expo). El perfil `preview` de `eas.json` genera un `.apk` instalable directamente:

```bash
# 1. Inicia sesión (cuenta gratuita en https://expo.dev)
npx eas-cli login

# 2. Vincula el proyecto a tu cuenta (solo la primera vez)
npx eas-cli init

# 3. Lanza la compilación del APK
npx eas-cli build --platform android --profile preview
```

Al terminar (10-20 min), EAS muestra un enlace y un QR para descargar el `.apk`.

**Instalación en el móvil**: descarga el APK desde el enlace/QR, ábrelo y acepta "instalar aplicaciones de origen desconocido" cuando Android lo pida. Como la app no viene de Google Play, es el comportamiento normal.

Para subir versión en el futuro: cambia `version` (visible en Ajustes) e incrementa `android.versionCode` (entero interno de Android) en `app.json`, y vuelve a compilar.

## Historial de versiones

| Versión | Cambios |
|---|---|
| **0.5** | Primera versión instalable. 6 pantallas completas, base de datos SQLite local, cotizaciones online, calendario de balances, evolución del patrimonio y backup CSV/JSON. |
