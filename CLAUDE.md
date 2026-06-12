@AGENTS.md
# Contexto y Rol
Actúa como un desarrollador Senior (Full-Stack Mobile) experto en React Native, Expo Router (usando la última versión), TypeScript y bases de datos locales. 

Tu tarea es desarrollar desde cero una aplicación móvil de gestión financiera personal llamada "Mis Finanzas". Quiero que escribas el código, me guíes paso a paso para probarla primero en Expo Go y, cuando todo funcione perfecto, me des las instrucciones exactas para generar el archivo `.apk` para instalarlo en mi móvil Android.

# Arquitectura y Base de Datos
- **Almacenamiento 100% Local:** Todo debe guardarse en el dispositivo usando `expo-sqlite`. No habrá backend externo ni bases de datos en la nube.
- **Relaciones de Base de Datos:** Debes diseñar un esquema relacional impecable entre `Cuentas`, `Transacciones` (Ingresos/Gastos), `Categorias`, e `Inversiones`.
- **Lógica de "Cuenta Base":** Debe existir un estado global (o consulta rápida a SQLite) para saber cuál es la "Cuenta de Banco Base". Cuando se registre un nuevo ingreso o gasto genérico, el saldo debe sumarse o restarse automáticamente de esta cuenta específica.

# Navegación (Bottom Tab Navigator)
La aplicación debe usar un enrutamiento por pestañas en la parte inferior de la pantalla (`Tabs` de Expo Router). Cada pestaña debe tener un icono representativo. Las pestañas son:

1. **Agregar** (Icono de suma/resta) -> Esta debe ser la pantalla inicial que ves cuando abres la aplicación
2. **Balance** (Icono de lista o calendario)
3. **Cuentas** (Icono de banco)
4. **Patrimonio** (Icono de gráfico de tarta/pie chart)
5. **Inversiones** (Icono de línea de crecimiento o bolsa)
6. **Ajustes** (Icono de engranaje)

---

# Especificaciones Detalladas por Pantalla

### 1. Pantalla: Agregar (Gastos e Ingresos)
- **Sección Gastos:** 
  - Input de texto/numérico para la cantidad.
  - Dropdown o selector visual para elegir la Categoría del gasto (ej: Ocio, Supermercado, etc.) Las categorías se pueden agregar manualmente desde ajustes.
  - Botón "Agregar Gasto".
- **Sección Ingresos:**
  - Input de texto/numérico para la cantidad.
  - Dropdown o selector visual para elegir el tipo de ingreso. Los tipos de ingreso se pueden agregar manualmente desde ajustes.
  - Botón "Agregar Ingreso".
- *Comportamiento:* Al pulsar cualquiera de los botones de agregar, la transacción se guarda en SQLite y el importe afecta inmediatamente al saldo de la "Cuenta de Banco Base" definida en los Ajustes.

### 2. Pantalla: Balance
- **Filtro de Tiempo:** Un selector en la parte superior para cambiar la vista entre "Mensual" y "Anual".
- **Resumen:** Debe mostrar el Balance Total del periodo seleccionado (Ingresos - Gastos).
- **Listados:** 
  - Una lista clara con todos los ingresos del periodo.
  - Una lista clara con todos los gastos del periodo.

### 3. Pantalla: Cuentas
- **Listado de Cuentas:** Muestra todas las cuentas bancarias existentes (ej: Santander, Trade Republic, MyInvestor) con el saldo disponible al lado de cada una.
- **Transferencias Internas:** Un botón o sección debajo de las cuentas que permita hacer una transferencia (mover dinero) de una cuenta a otra. Esto no es un gasto, es un traspaso que resta en una y suma en la otra.
- **Nueva Cuenta:** Un botón al final del todo ("Nueva Cuenta de Banco") para registrar una cuenta adicional y establecer su saldo inicial.

### 4. Pantalla: Patrimonio
- **Visualización Principal:** Un gráfico circular (Pie Chart) que desglose visualmente dónde está repartido todo mi dinero.
- **Total:** Debajo del gráfico, un texto grande con el "Patrimonio Total" (Suma de cuentas bancarias + Inversiones).
- **Desglose numérico:**
  - Una sección detallando el total de dinero en efectivo (Suma de todas las Cuentas).
  - Una sección detallando el total de dinero invertido (Suma del valor actual de Inversiones).

### 5. Pantalla: Inversiones
- **Listado Jerárquico:** El dinero debe aparecer desglosado por categorías: 
  - *Fondos* -> Lista de fondos (ej: S&P 500) con su dinero actual.
  - *ETFs* -> Lista de ETFs.
  - *Acciones* -> Lista de acciones.
- **Conexión a Internet (Cotizaciones):** La app debe conectarse a una API pública/gratuita de finanzas (de esto no se mucho así que estudia tu la viabilidad de hacer esto y como hacerlo) para obtener la rentabilidad/precio actual de esos activos. Si metí 500€ y ha subido, la app debe calcular e imprimir el valor actual automáticamente sin que yo lo actualice a mano.
- **Ajuste Manual:** Un botón de edición rápida (icono de lápiz) junto a cada inversión por si la API falla o quiero ajustar el valor manualmente.
- **Botón "Nueva Inversión":**
  - Permite elegir Plataforma (MyInvestor, Trade Republic...etc. Las plataformas deben de ser cuentas de banco previamente creadas).
  - Permite elegir Tipo (Fondo Indexado, ETF, Acción).
  - **Aportaciones:** Debe dar la opción de crear un activo nuevo, o seleccionar una "Inversión ya existente" (ej: seleccionar S&P 500) y añadirle 500€ más, recalculando su precio medio o sumando el capital.

### 6. Pantalla: Ajustes (Configuración)
- **Selector de Cuenta Base:** La funcionalidad principal aquí es un selector que me permita elegir cuál de mis Cuentas Bancarias actúa como la "Cuenta Base" para las operaciones rápidas de la pestaña Agregar.
- Introducir más ajustes que se puedan considerar necesarios o relevantes.



---

# Plan de Ejecución Solicitado
Sigue este orden:

1. **Paso 1: Diseño de la Base de Datos.** Muéstrame el código para inicializar SQLite y la estructura de las tablas (`CREATE TABLE`). Espera mi confirmación.
2. **Paso 2: Estructura Base.** Creación de la navegación principal (Bottom Tabs) y archivos en Expo Router.
3. **Paso 3: Desarrollo iterativo.** Ve programando pantalla por pantalla.

-- Una vez terminado el paso 3, parate y avísame para que pueda probar la app con Expo Go, aquí te pediré realizar cambios si son necesarios. Cuando te diga procederemos con el paso 4 --
**Paso 3.5: 
Por favor, añade las siguientes funcionalidades y correcciones a las especificaciones que te he dado. Actualiza tu mapa mental del proyecto para integrarlas:

### Añadido para la Pantalla 2: Balance
- **Desglose visual por Categoría:** Además de las listas de gastos e ingresos, quiero un resumen visual (gráfico de barras horizontales) que me indique qué porcentaje o cantidad de dinero he gastado en cada categoría durante ese periodo seleccionado y los ingresos.
- **Gastos e ingresos anuales:** Cuando se seleccione el balance anual, debe de mostrase tanto los ingresos como los gastos agrupados por mes, no se deben mostrar todos los gastos unitarios totales.
- **Gastos diarios y seleccion de intervalo**: Quiero que puedas tambier ver en balance los gastos concretos de un solo día, y además, para hacer la seleccion, de tanto el mes como el día como el año, quiero que se haga con un pop up de un calendario donde se pueda seleccionar el día. El calendario debe tener modo día donde se ve un mes con todos los días del mes, modo mes donde se ve un año con todos los meses del año, y modo año donde se ven todos los años. En el modo día, en cada cuadrado de día debe verse el balance total de ingresos + gastos de ese día, lo mismo para el modo mes y lo mismo para el modo año.

### Añadido para la Pantalla 4: Patrimonio
- **Gráfico de Evolución Temporal:** Debe haber un gráfico de líneas sencillo que muestre el histórico de cómo ha ido creciendo (o bajando) mi Patrimonio Total a lo largo de los meses y o años.

### Añadidos para la Pantalla 5: Inversiones
- **Edición Integral de la Inversión:** No quiero tener que borrar una inversión si me equivoco. Debe haber un menú o botón para editar la inversión completa: cambiar su Nombre, modificar el Ticker (símbolo) y cambiar la Plataforma asignada (esto estudiarlo, para que no se pueda hacer que hagan inversiones con una cuenta que no tenga dinero y de error), sin perder el historial de aportaciones.
- **Manejo Visual de Errores de API (UI):** Si la conexión con la API de cotizaciones falla, NO quiero alertas nativas, pop-ups molestos ni que la pantalla se quede en blanco. Simplemente, en el hueco de la interfaz donde debería ir el porcentaje de rentabilidad, debe aparecer un texto o icono en color amarillo (ej: "Error de conexión" o "API no disponible").

### Añadido para la Pantalla 6: Ajustes (Sistema de Backup)
- **Importación y Exportación Completa:** Para garantizar que no pierdo mis datos si cambio de móvil, el sistema 100% local requiere un backup bidireccional. Debe permitir exportar la base de datos a un archivo CSV/JSON, y lo más importante: **debe permitir recibir/importar un archivo CSV** para cargar o restaurar toda la base de datos directamente desde ese archivo.

-- Una vez terminado el paso 3.5, parate y avísame para que pueda probar la app con Expo Go, aquí te pediré realizar cambios si son necesarios. Cuando te diga procederemos con el paso 4 --
4. **Paso 4: Realiza toda la documentación de la apllicación en el readme.md
5. **Paso 5: Compilación.** Configuración de `eas.json` para sacar el APK.
