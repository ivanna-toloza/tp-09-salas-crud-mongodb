# Explicación línea por línea · TP 09 – CRUD de reservas con MongoDB

Guía de estudio para la exposición. Explica cada línea del código del proyecto `tp-09-salas-crud-mongodb` (commit `61b426b`). **Los números de línea (L1, L2…) corresponden al código sin comentarios** (commit `61b426b`). Ahora cada archivo tiene la misma explicación como comentario arriba de cada línea, así que es más largo: para ubicarte, guiate por el código citado y no por el número.

- **Orden:** los archivos siguen el camino de una petición. Primero cómo arranca el programa, después cómo entra una solicitud, por qué capas pasa y cómo sale la respuesta.
- **[NUEVO TP09]** marca lo que se agregó en este TP (PUT, PATCH y DELETE).
- **En una frase:** cada archivo empieza con lo que conviene decir en voz alta antes de entrar en el detalle.

**Contenido**

0. Mapa general
1. Conceptos que se repiten
2. `package.json`
3. `src/index.js`
4. `src/config/entorno.js`
5. `src/config/base-datos.js`
6. `src/app.js`
7. `src/middleware/solicitudes.js`
8. `src/rutas/reservas-api.js` [NUEVO TP09]
9. `src/rutas/reservas.js`
10. `src/middleware/reservas.js`
11. `src/middleware/cambios-reservas.js` [NUEVO TP09]
12. `src/controladores/reservas.js` [NUEVO TP09]
13. `src/servicios/reservas-mongo.js` [NUEVO TP09]
14. `src/modelos/reserva.js`
15. `src/middleware/errores.js` [NUEVO TP09]
16. Vistas EJS
17. Scripts de terminal
18. Archivos de apoyo
19. Preguntas probables en la exposición

---

## 0. Mapa general

```
node --env-file=.env src/index.js
  └─ index.js: lee configuración → conecta MongoDB → crea servicio → crea app → abre el puerto

Solicitud HTTP
  └─ app.js: middleware globales (morgan, id de solicitud, duración, layouts, archivos estáticos, lectura del cuerpo)
       ├─ /api/reservas → rutas/reservas-api.js → validación → controlador → servicio → modelo → MongoDB Atlas
       ├─ /reservas     → rutas/reservas.js     → validación → controlador → servicio → modelo → MongoDB Atlas
       ├─ ninguna ruta coincide → 404
       └─ algo lanzó un error   → middleware/errores.js → 400 (culpa del cliente) o 500 (fallo nuestro)
```

### Las tres operaciones nuevas, paso a paso

| Paso | PUT `/api/reservas/:id` | PATCH `/api/reservas/:id` | DELETE `/api/reservas/:id` |
| --- | --- | --- | --- |
| Router | `router.put` | `router.patch` | `router.delete` |
| Validación del cuerpo | `validarCambioReserva`: exige los 7 campos | `validarCambioReserva`: solo `personas` y/o `estado` | No hay cuerpo |
| Controlador | `reemplazarApi` | `actualizarApi` | `eliminarApi` |
| Servicio | `reemplazar` → `findOneAndReplace` | `actualizar` → `findOneAndUpdate` con `$set` | `eliminar` → `deleteOne` |
| Respuesta si sale bien | 200 + reserva nueva | 200 + reserva modificada | 204 sin cuerpo |
| ID válido pero inexistente | 404 | 404 | 404 |
| ID mal formado | 400 | 400 | 400 |

### Qué hace cada capa

| Capa | Archivo | Responsabilidad |
| --- | --- | --- |
| Configuración | `config/` | Leer variables de entorno y abrir/cerrar la conexión. |
| Modelo | `modelos/reserva.js` | Define la forma de una reserva y sus reglas. Es la última barrera antes de guardar. |
| Servicio | `servicios/reservas-mongo.js` | Habla con MongoDB. No sabe nada de HTTP ni de Express. |
| Middleware | `middleware/` | Revisa la solicitud antes de que llegue al controlador. |
| Controlador | `controladores/reservas.js` | Llama al servicio y decide qué responder (200, 201, 204, 404, vista HTML). |
| Router | `rutas/` | Une cada método + dirección con su validación y su controlador. |
| App | `app.js` | Arma todo: motor de vistas, middleware, routers, 404 y errores. |

---

## 1. Conceptos que se repiten

Estas ideas aparecen en casi todos los archivos. Si las tenés claras, el resto se explica solo.

- **`require(...)` y `module.exports` (CommonJS).** Cada archivo es un módulo. Lo que pone en `module.exports` es lo único que otros archivos pueden usar; `require("./ruta")` devuelve ese objeto.
- **Desestructuración.** `const { a, b } = objeto;` crea las variables `a` y `b` con las propiedades del mismo nombre. Se usa para importar solo lo necesario y para leer parámetros: `function crearApp({ servicioReservas, formatoRegistro })`.
- **Propiedades abreviadas.** `{ puerto, formatoRegistro }` es lo mismo que `{ puerto: puerto, formatoRegistro: formatoRegistro }`.
- **Función fábrica.** Una función que construye y devuelve algo (un objeto o una función): `crearApp`, `crearServicioReservasMongo`, `crearControladorReservas`, `crearRouterReservasApi`. Las dependencias se le pasan como parámetro (**inyección de dependencias**). Gracias a eso, `scripts/simular-fallo-servicio.js` puede crear la misma app con un servicio falso.
- **Clausura (closure).** Una función definida dentro de otra recuerda las variables de la de afuera aunque esta ya haya terminado. Así el controlador "recuerda" `servicioReservas` y el middleware de solicitudes recuerda su contador.
- **Middleware.** Función `(req, res, next)` que Express ejecuta en orden. Puede **responder** (y la cadena se corta ahí) o llamar a **`next()`** para pasar al siguiente.
- **Middleware de errores.** Tiene **cuatro** parámetros `(error, req, res, next)`. Express lo reconoce justamente por tener cuatro.
- **`req` y `res`.** `req` es lo que llega: `req.params` (partes de la dirección, como `:id`), `req.query` (lo que va después de `?`), `req.body` (el cuerpo), `req.method` (GET, POST...). `res` es lo que se responde: `res.status()`, `res.json()`, `res.render()`, `res.redirect()`, `res.end()`.
- **`res.locals`.** Un objeto que vive mientras dura la solicitud. Lo que se guarda ahí lo pueden leer los middleware siguientes y **todas las vistas EJS** sin pasarlo a mano.
- **`async` / `await`.** Las operaciones con MongoDB tardan (viajan por la red) y devuelven una **promesa**. `await` espera el resultado sin bloquear el servidor. Solo se puede usar dentro de una función `async`.
- **Express 5 y los errores asíncronos.** Si una función `async` usada como controlador lanza un error (o una promesa que espera se rechaza), Express 5 lo envía solo al middleware de errores. Por eso los controladores **no tienen `try/catch`**.
- **`??` (fusión de nulos).** `a ?? b` devuelve `b` solo si `a` es `null` o `undefined`.
- **`?.` (encadenamiento opcional).** `a?.b` devuelve `undefined` en lugar de lanzar un error si `a` es `null` o `undefined`.
- **Plantillas literales.** Texto entre comillas invertidas que permite insertar valores con `${...}`, por ejemplo `` `Reserva de ${reserva.estudiante}` ``.
- **Códigos HTTP del TP.** 200 OK · 201 Creado · 204 Sin contenido · 302 Redirección · 400 Solicitud inválida (culpa del cliente) · 404 No encontrado · 500 Error interno (culpa del servidor).

---

## 2. `package.json`

**En una frase:** es la ficha del proyecto: cómo se llama, con qué comandos se ejecuta y qué librerías necesita.

> JSON no admite comentarios; por eso este archivo se explica acá y no dentro del propio archivo.

```json
{
  "name": "tp-07-salas-mongodb",
  "version": "1.0.0",
  "description": "Reservas de salas de estudio: sitio Express en memoria y laboratorio de persistencia con MongoDB",
  "main": "src/index.js",
```

- **L1** `{` abre el objeto JSON que ocupa todo el archivo.
- **L2** `name`: nombre del paquete. Conserva `tp-07-...` porque el proyecto se copió del TP 08, que a su vez venía del TP 07, y no se quiso tocar el manifiesto (README §1).
- **L3** `version`: versión del proyecto con formato *mayor.menor.parche*.
- **L4** `description`: descripción libre.
- **L5** `main`: el archivo de entrada del proyecto, `src/index.js`.

```json
  "scripts": {
    "start": "node src/index.js",
    "start:local": "node --env-file=.env src/index.js",
    "format": "prettier --write src scripts",
    "format:check": "prettier --check src scripts",
    "lint": "eslint src scripts",
    "check": "npm run format:check && npm run lint"
  },
```

- **L6** `scripts`: atajos que se ejecutan con `npm run <nombre>` (`start` también con `npm start`).
- **L7** `start`: arranca la app con Node **sin** cargar `.env`. Sirve cuando las variables ya están definidas en el entorno (por ejemplo, en un servicio de hosting).
- **L8** `start:local`: igual, pero `--env-file=.env` le pide a Node que lea el archivo `.env` y cargue sus variables en `process.env`. No hace falta la librería `dotenv`.
- **L9** `format`: Prettier **reescribe** el formato (sangría, comillas, comas) de `src` y `scripts`.
- **L10** `format:check`: Prettier solo **revisa**; falla si algo no está formateado, sin modificar nada.
- **L11** `lint`: ESLint busca errores probables (variables sin usar, variables no definidas...).
- **L12** `check`: ejecuta los dos controles. `&&` hace que `lint` corra solo si `format:check` salió bien.
- **L13** cierra `scripts`.

```json
  "keywords": [],
  "author": "",
  "license": "ISC",
  "type": "commonjs",
```

- **L14–16** `keywords`, `author` y `license`: datos descriptivos que deja `npm init` (ISC es la licencia por defecto).
- **L17** `type: "commonjs"`: los `.js` usan `require` / `module.exports`, no `import` / `export`.

```json
  "dependencies": {
    "ejs": "^6.0.1",
    "express": "^5.2.1",
    "express-ejs-layouts": "^2.5.1",
    "mongoose": "9.10.3",
    "morgan": "^1.12.1"
  },
```

- **L18** `dependencies`: librerías necesarias para **ejecutar** la aplicación.
- **L19** `ejs`: motor de plantillas que genera el HTML de las vistas. El `^` acepta actualizaciones menores y de parche (6.x.x) pero nunca una 7.
- **L20** `express`: el framework web. La versión 5 importa: maneja solos los errores de funciones `async` y deja `req.body` en `undefined` si no hay cuerpo.
- **L21** `express-ejs-layouts`: permite tener un diseño común (`layouts/main.ejs`) que envuelve todas las páginas.
- **L22** `mongoose`: ODM para MongoDB (esquemas, validación, consultas). Está **sin `^`**: versión exacta 9.10.3, así todos instalan exactamente la misma.
- **L23** `morgan`: registra en consola cada solicitud HTTP.
- **L24** cierra `dependencies`.

```json
  "devDependencies": {
    "@eslint/js": "^10.0.1",
    "eslint": "^10.12.0",
    "prettier": "^3.9.10"
  },
  "engines": {
    "node": ">=22.13.0"
  }
}
```

- **L25** `devDependencies`: herramientas que se usan solo mientras se **desarrolla**, no para ejecutar.
- **L26** `@eslint/js`: el conjunto de reglas recomendadas de ESLint.
- **L27** `eslint`: el analizador de código.
- **L28** `prettier`: el formateador.
- **L29** cierra `devDependencies`.
- **L30–32** `engines`: versión mínima de Node con la que se garantiza que el proyecto funciona (22.13 o superior).
- **L33** `}` cierra el objeto.

---

## 3. `src/index.js`

**En una frase:** es el punto de entrada. Lee la configuración, se conecta a MongoDB **antes** de abrir el puerto, arma la aplicación y prepara un cierre ordenado con Ctrl+C.

### Líneas 1–7 · Importaciones

```js
const { leerConfiguracion } = require("./config/entorno");
const {
  conectarBaseDatos,
  desconectarBaseDatos,
} = require("./config/base-datos");
const { crearServicioReservasMongo } = require("./servicios/reservas-mongo");
const { crearApp } = require("./app");
```

- **L1** Carga `config/entorno.js` y toma solo la función `leerConfiguracion` (desestructuración). La ruta es relativa a este archivo y la extensión `.js` se puede omitir.
- **L2–5** Carga `config/base-datos.js` y toma las dos funciones que abren y cierran la conexión con MongoDB. Está en varias líneas solo por el formato de Prettier.
- **L6** Trae la fábrica que crea el **servicio** de reservas que trabaja con MongoDB.
- **L7** Trae la fábrica que crea la **aplicación Express**.
- **L8** Línea en blanco para separar importaciones del código.

### Líneas 9–13 · Arranque

```js
async function main() {
  const { puerto, formatoRegistro } = leerConfiguracion();
  await conectarBaseDatos();
  const servicioReservas = crearServicioReservasMongo();
  const app = crearApp({ servicioReservas, formatoRegistro });
```

- **L9** Declara `main` como `async` para poder usar `await` adentro. Agrupa todo el arranque en una sola función.
- **L10** Lee la configuración y desestructura el resultado: `puerto` (número) y `formatoRegistro` (`"dev"` o `"combined"` para morgan). Si `PORT` es inválido, `leerConfiguracion` lanza un error y el arranque se detiene.
- **L11** **Conecta con MongoDB y espera.** Se hace antes de abrir el puerto a propósito: así el servidor nunca atiende solicitudes sin base de datos. Si la conexión falla, el error salta al `.catch` de la línea 47.
- **L12** Crea el servicio: un objeto con las funciones `listar`, `obtenerPorId`, `contar`, `crear`, `reemplazar`, `actualizar` y `eliminar`.
- **L13** Crea la app **inyectándole** el servicio y el formato de registro. La app no crea su propio servicio: lo recibe.
- **L14** Línea en blanco.

### Líneas 15–25 · Abrir el puerto

```js
  const servidor = app.listen(puerto, (error) => {
    if (error) {
      console.error("No se pudo escuchar el puerto:", error.code);
      process.exitCode = 1;
      desconectarBaseDatos().catch((fallo) => {
        console.error("Error al cerrar:", fallo.name);
      });
      return;
    }
    console.log(`Aplicación disponible en http://localhost:${puerto}`);
  });
```

- **L15** `app.listen(puerto, callback)` crea el servidor HTTP y empieza a escuchar en ese puerto. Devuelve el objeto servidor, que se guarda en `servidor` para poder cerrarlo después (línea 32). En Express 5 el callback recibe un `error` si no se pudo abrir el puerto.
- **L16** Si hubo error al abrir el puerto...
- **L17** ...muestra solo su código, por ejemplo `EADDRINUSE` (el puerto ya está en uso por otro programa).
- **L18** `process.exitCode = 1` marca que el programa terminó con error, pero **sin cortarlo de golpe** como haría `process.exit(1)`: deja que termine lo pendiente.
- **L19** Como MongoDB ya estaba conectado (línea 11), hay que cerrar esa conexión; si no, el proceso quedaría vivo. Este callback no es `async`, así que en lugar de `await` se usa `.catch(...)` para atrapar un posible fallo al cerrar.
- **L20** Si cerrar falla, muestra solo el nombre del error.
- **L21** Cierra el `.catch`.
- **L22** `return` sale del callback para no mostrar el mensaje de éxito.
- **L23** Cierra el `if`.
- **L24** Si todo salió bien, avisa la dirección. Es una plantilla literal: `${puerto}` se reemplaza por el número.
- **L25** Cierra el callback y la llamada a `listen`.
- **L26** Línea en blanco.

### Líneas 27–44 · Cierre ordenado (Ctrl+C)

```js
  let cerrando = false;
  function cerrar() {
    if (cerrando) return;
    cerrando = true;
    console.log("Cerrando el servidor...");
    servidor.close(async () => {
      try {
        await desconectarBaseDatos();
        console.log("Conexión con MongoDB cerrada.");
      } catch (error) {
        console.error("Error al cerrar:", error.name);
        process.exitCode = 1;
      }
    });
  }

  process.once("SIGINT", cerrar);
  process.once("SIGTERM", cerrar);
}
```

- **L27** Bandera que indica si ya se empezó a cerrar. Es `let` porque cambia de valor.
- **L28** Función que se ejecuta cuando llega una señal de apagado.
- **L29** Si ya se estaba cerrando, no hace nada. Evita cerrar dos veces si llegan dos señales.
- **L30** Marca que el cierre empezó.
- **L31** Avisa en consola.
- **L32** `servidor.close(callback)`: deja de aceptar conexiones nuevas, **espera a que terminen las solicitudes en curso** y recién ahí ejecuta el callback. El callback es `async` para poder usar `await`.
- **L33** `try`: intenta cerrar la base.
- **L34** Cierra la conexión con MongoDB y espera a que termine.
- **L35** Confirma el cierre.
- **L36** Si cerrar la base falla...
- **L37** ...muestra solo el nombre del error...
- **L38** ...y marca la salida como fallida.
- **L39–41** Cierran el `catch`, el callback de `close` y la función `cerrar`.
- **L42** Línea en blanco.
- **L43** `SIGINT` es la señal que envía **Ctrl+C** en la terminal. `once` registra el manejador una sola vez: si se aprieta Ctrl+C de nuevo, Node cierra de inmediato (salida de emergencia).
- **L44** `SIGTERM` es la señal de "terminá" que envían el sistema operativo o las plataformas de hosting al detener un servicio. Se maneja igual.
- **L45** Cierra `main`.
- **L46** Línea en blanco.

### Líneas 47–59 · Si el arranque falla

```js
main().catch(async (error) => {
  console.error("No se pudo iniciar la aplicación:", error.name);
  if (error.name === "ErrorDeConfiguracion") {
    console.error(error.message);
  }
  console.error("Revisar entorno, DNS, red, acceso de Atlas y puerto.");
  process.exitCode = 1;
  try {
    await desconectarBaseDatos();
  } catch (fallo) {
    console.error("Error al cerrar:", fallo.name);
  }
});
```

- **L47** Ejecuta `main()`. Como es `async`, devuelve una promesa; si algo adentro lanzó un error (configuración inválida, Atlas inaccesible), la promesa se rechaza y lo atrapa `.catch`. El callback es `async` para poder esperar el cierre de la base.
- **L48** Muestra solo el **nombre** del error (por ejemplo `MongooseServerSelectionError`), no el mensaje completo: los mensajes de MongoDB pueden incluir datos del servidor o de la URI, y no se quieren filtrar.
- **L49** Si es un error de configuración propio...
- **L50** ...sí muestra el mensaje, porque lo escribimos nosotros y no tiene secretos (por ejemplo, `Falta MONGODB_URI en el entorno.`).
- **L51** Cierra el `if`.
- **L52** Lista de cosas para revisar.
- **L53** Marca la salida con código 1 (error).
- **L54–55** Intenta cerrar la conexión por si llegó a abrirse. Si no había conexión, `disconnect` no hace nada.
- **L56–57** Si cerrar falla, muestra solo el nombre.
- **L58–59** Cierran el `try/catch` y el `.catch`.

---

## 4. `src/config/entorno.js`

**En una frase:** lee y valida las variables de entorno (`PORT`, `NODE_ENV`, `MONGODB_URI`) para que la app falle temprano y con un mensaje claro si falta o está mal algo.

### Líneas 1–12 · Puerto y formato de registro

```js
function leerConfiguracion(entorno = process.env) {
  const puerto = Number(entorno.PORT ?? 3000);

  if (!Number.isInteger(puerto) || puerto < 1 || puerto > 65535) {
    throw new Error("PORT debe ser un entero entre 1 y 65535");
  }

  const formatoRegistro =
    entorno.NODE_ENV === "production" ? "combined" : "dev";

  return { puerto, formatoRegistro };
}
```

- **L1** Parámetro con valor por defecto: si no se pasa nada, usa `process.env` (las variables de entorno reales). Permite probar la función pasándole un objeto inventado. En `process.env` todos los valores son **texto**.
- **L2** `entorno.PORT ?? 3000`: si `PORT` no está definido, usa 3000. `Number(...)` convierte el texto `"3000"` en el número `3000`; un texto no numérico da `NaN`.
- **L3** Línea en blanco.
- **L4** Valida el puerto: tiene que ser entero (`Number.isInteger` rechaza `NaN` y decimales) y estar entre 1 y 65535, el rango válido de puertos TCP. `||` significa "o": alcanza con que falle una condición.
- **L5** Si no es válido, **lanza** un error y corta la ejecución. *Detalle:* es un `Error` común (no un `ErrorDeConfiguracion`), así que `index.js` muestra solo su nombre, `Error`, y no este mensaje.
- **L6** Cierra el `if`.
- **L7** Línea en blanco.
- **L8–9** Operador ternario (`condición ? siVerdadero : siFalso`): en producción morgan usa `"combined"` (formato estándar y completo, como los servidores Apache); en desarrollo, `"dev"` (corto y con colores).
- **L10** Línea en blanco.
- **L11** Devuelve un objeto con las dos configuraciones (propiedades abreviadas).
- **L12** Cierra la función.

### Líneas 14–18 · Error de configuración con nombre propio

```js
function crearErrorDeConfiguracion(mensaje) {
  const error = new Error(mensaje);
  error.name = "ErrorDeConfiguracion";
  return error;
}
```

- **L14** Función auxiliar que fabrica errores de configuración.
- **L15** Crea un `Error` con el mensaje recibido.
- **L16** Le cambia el nombre. Así, en `index.js` y en los scripts se puede preguntar `error.name === "ErrorDeConfiguracion"` y saber que el mensaje es seguro de mostrar.
- **L17** Lo **devuelve** (no lo lanza): quien la llama decide hacer `throw`.
- **L18** Cierra la función.

### Líneas 20–36 · URI de MongoDB

```js
function leerUriMongo(entorno = process.env) {
  const uri = entorno.MONGODB_URI?.trim();

  if (!uri) {
    throw crearErrorDeConfiguracion("Falta MONGODB_URI en el entorno.");
  }

  if (!uri.startsWith("mongodb://") && !uri.startsWith("mongodb+srv://")) {
    throw crearErrorDeConfiguracion(
      "MONGODB_URI debe comenzar con mongodb:// o mongodb+srv://.",
    );
  }

  return uri;
}

module.exports = { leerConfiguracion, leerUriMongo };
```

- **L20** Igual que antes, recibe el entorno con `process.env` por defecto.
- **L21** `?.` evita un error si `MONGODB_URI` no existe (daría `undefined` en vez de fallar al llamar `.trim()`). `.trim()` quita espacios y saltos de línea de los extremos, muy comunes al copiar y pegar.
- **L22** Línea en blanco.
- **L23** `!uri` es verdadero si la URI es `undefined` o texto vacío.
- **L24** Lanza el error de configuración con un mensaje claro.
- **L25** Cierra el `if`.
- **L26** Línea en blanco.
- **L27** Comprueba el formato: tiene que empezar con `mongodb://` (conexión directa a un servidor) **o** con `mongodb+srv://` (el formato de Atlas, que busca los servidores mediante un registro DNS). `&&` exige que fallen las dos para rechazar.
- **L28–30** Lanza el error con el mensaje del formato esperado.
- **L31** Cierra el `if`.
- **L32** Línea en blanco.
- **L33** Si pasó las dos comprobaciones, devuelve la URI limpia.
- **L34** Cierra la función.
- **L35** Línea en blanco.
- **L36** Exporta las dos funciones públicas. `crearErrorDeConfiguracion` no se exporta: es de uso interno.

---

## 5. `src/config/base-datos.js`

**En una frase:** concentra en un solo lugar cómo se abre y se cierra la conexión con MongoDB; la usan tanto la app como los scripts.

```js
const mongoose = require("mongoose");
const { leerUriMongo } = require("./entorno");

async function conectarBaseDatos() {
  await mongoose.connect(leerUriMongo(), {
    serverSelectionTimeoutMS: 5000,
  });
}

async function desconectarBaseDatos() {
  await mongoose.disconnect();
}

module.exports = { conectarBaseDatos, desconectarBaseDatos };
```

- **L1** Carga Mongoose, la librería que conecta Node con MongoDB y maneja esquemas y modelos.
- **L2** Trae la función que lee y valida la URI.
- **L3** Línea en blanco.
- **L4** Función `async` que abre la conexión.
- **L5** `mongoose.connect(uri, opciones)` se conecta a la base y devuelve una promesa; `await` espera a que la conexión quede lista. La URI se lee **en este momento**, así un error de configuración aparece al conectar.
- **L6** `serverSelectionTimeoutMS: 5000`: si en 5 segundos no encuentra un servidor disponible, falla (por defecto esperaría 30). Sirve para enterarse rápido de un problema de red, de IP no autorizada o de DNS.
- **L7** Cierra el objeto de opciones y la llamada.
- **L8** Cierra la función.
- **L9** Línea en blanco.
- **L10** Función `async` que cierra la conexión.
- **L11** `mongoose.disconnect()` cierra todas las conexiones abiertas. Sin esto, el proceso de Node quedaría vivo.
- **L12** Cierra la función.
- **L13** Línea en blanco.
- **L14** Exporta las dos funciones.

---

## 6. `src/app.js`

**En una frase:** arma la aplicación Express: configura las vistas, registra los middleware globales en orden, monta las rutas del sitio y de la API, y al final agrega el 404 y el manejador de errores.

### Líneas 1–15 · Importaciones

```js
const express = require("express");
const expressLayouts = require("express-ejs-layouts");
const morgan = require("morgan");
const path = require("node:path");
const {
  crearIdentificadorSolicitud,
  medirDuracion,
} = require("./middleware/solicitudes");
const {
  crearManejadorErrores,
  esSolicitudJson,
} = require("./middleware/errores");
const { crearControladorReservas } = require("./controladores/reservas");
const { crearRouterReservas } = require("./rutas/reservas");
const { crearRouterReservasApi } = require("./rutas/reservas-api");
```

- **L1** Carga Express, el framework web.
- **L2** Carga el middleware de layouts para EJS.
- **L3** Carga morgan, el registrador de solicitudes.
- **L4** Carga el módulo `path` de Node para armar rutas de carpetas. El prefijo `node:` deja claro que es un módulo propio de Node y no una librería instalada.
- **L5–8** Trae los dos middleware de solicitudes: el que asigna un identificador y el que mide la duración.
- **L9–12** Trae la fábrica del manejador de errores y la función que decide si una solicitud espera JSON.
- **L13** Trae la fábrica del controlador.
- **L14** Trae la fábrica del router del sitio HTML.
- **L15** Trae la fábrica del router de la API JSON.
- **L16** Línea en blanco.

### Líneas 17–19 · La fábrica de la app

```js
function crearApp({ servicioReservas, formatoRegistro }) {
  const app = express();
  const controlador = crearControladorReservas(servicioReservas);
```

- **L17** `crearApp` recibe un objeto y lo desestructura en sus dos dependencias: el servicio y el formato de registro. No las crea: se las pasan (inyección de dependencias). Por eso un script puede crear la app con un servicio falso.
- **L18** `express()` crea la aplicación.
- **L19** Crea el controlador entregándole el servicio. El controlador solo conoce el servicio, nunca a MongoDB directamente.
- **L20** Línea en blanco.

### Líneas 21–23 · Configuración de vistas

```js
  app.set("view engine", "ejs");
  app.set("views", path.join(__dirname, "..", "views"));
  app.set("layout", "layouts/main");
```

- **L21** Define EJS como motor de vistas. Así `res.render("inicio")` busca el archivo `inicio.ejs`.
- **L22** Indica dónde están las vistas. `__dirname` es la carpeta de este archivo (`src`); `".."` sube un nivel y `"views"` entra en la carpeta de vistas. `path.join` arma una ruta absoluta y correcta en cualquier sistema operativo, sin importar desde dónde se ejecute el comando.
- **L23** Define el layout por defecto para `express-ejs-layouts`: `views/layouts/main.ejs`.
- **L24** Línea en blanco.

### Líneas 25–31 · Middleware globales (el orden importa)

```js
  app.use(morgan(formatoRegistro));
  app.use(crearIdentificadorSolicitud());
  app.use(medirDuracion);
  app.use(expressLayouts);
  app.use(express.static(path.join(__dirname, "..", "public")));
  app.use(express.urlencoded({ extended: false }));
  app.use(express.json());
```

`app.use(...)` registra un middleware que corre en **todas** las solicitudes, en el orden en que se registran.

- **L25** morgan va primero para registrar todas las solicitudes, incluso las de archivos estáticos. Usa el formato elegido en `entorno.js`.
- **L26** Asigna un identificador a cada solicitud (`BIB-0001`, `BIB-0002`...). Lleva paréntesis porque `crearIdentificadorSolicitud` es una **fábrica**: al llamarla devuelve el middleware.
- **L27** Mide cuánto tarda cada solicitud. Va **sin** paréntesis porque `medirDuracion` ya es el middleware. Está después del identificador para poder mostrarlo en el registro.
- **L28** Activa los layouts: cada `res.render` se inserta dentro de `layouts/main.ejs`.
- **L29** `express.static` sirve los archivos de la carpeta `public` tal como están: `/css/estilos.css`, `/img/sala.svg`, `/js/app.js`. Si encuentra el archivo, responde y la cadena termina ahí.
- **L30** Lee el cuerpo de los **formularios HTML** (`application/x-www-form-urlencoded`) y lo deja en `req.body`. `extended: false` usa el lector simple, que no arma objetos anidados (no hacen falta).
- **L31** Lee el cuerpo **JSON** (lo que manda Postman con `Content-Type: application/json`) y lo deja en `req.body`. Si el JSON está mal escrito, genera un error con `type: "entity.parse.failed"` que el manejador de errores convierte en 400. En Express 5, si no hay cuerpo, `req.body` queda en `undefined`.
- **L32** Línea en blanco.

### Líneas 33–40 · Rutas

```js
  app.get("/", (req, res) => {
    res.render("inicio", {
      titulo: "Gestión de Salas de Estudio",
    });
  });
  app.get("/estado", controlador.mostrarEstado);
  app.use("/api/reservas", crearRouterReservasApi(controlador));
  app.use("/reservas", crearRouterReservas(controlador));
```

- **L33** Ruta GET de la página de inicio, con una función flecha como manejador.
- **L34** Renderiza la vista `inicio.ejs`...
- **L35** ...pasándole la variable `titulo`, que la vista y el layout muestran.
- **L36–37** Cierran el objeto, `render` y la ruta.
- **L38** `GET /estado` usa el controlador `mostrarEstado`: devuelve JSON con la cantidad de reservas.
- **L39** **Monta** el router de la API en `/api/reservas`: todas las rutas definidas en ese router quedan debajo de ese prefijo (su `"/"` pasa a ser `/api/reservas`, su `"/:id"` pasa a ser `/api/reservas/:id`). Se le entrega el mismo controlador.
- **L40** Monta el router del sitio HTML en `/reservas`. Sitio y API comparten el mismo controlador y, por lo tanto, el mismo servicio y la misma base.
- **L41** Línea en blanco.

### Líneas 42–51 · Página no encontrada (404)

```js
  app.use((req, res) => {
    if (esSolicitudJson(req)) {
      return res.status(404).json({ error: "Ruta no encontrada." });
    }

    res.status(404).render("no-encontrado", {
      titulo: "Página no encontrada",
      mensaje: "La dirección solicitada no existe.",
    });
  });
```

- **L42** Un middleware sin ruta, registrado **después** de todas las rutas: solo se llega acá si ninguna respondió. Sirve como "atrapa todo" para el 404.
- **L43** Pregunta si la solicitud era de la API (o `/estado`)...
- **L44** ...y si lo era, responde 404 en JSON. `return` corta la función para no responder dos veces.
- **L45–46** Cierra el `if` y deja una línea en blanco.
- **L47** Si era una página del sitio, responde 404 con la vista `no-encontrado.ejs`...
- **L48–49** ...pasándole título y mensaje.
- **L50–51** Cierran el objeto, `render` y el middleware.
- **L52** Línea en blanco.

### Líneas 53–63 · Manejador de errores, retorno y exportación

```js
  app.use(
    crearManejadorErrores({
      vistaFormulario: "reservas/nueva",
      tituloFormulario: "Registrar nueva reserva",
    }),
  );

  return app;
}

module.exports = { crearApp };
```

- **L53–54** Registra el manejador de errores, que siempre va **al final**. Se crea con una fábrica para indicarle...
- **L55** ...qué vista volver a mostrar si falla la validación del formulario...
- **L56** ...y con qué título.
- **L57–58** Cierran el objeto, la llamada a la fábrica y `app.use`.
- **L59** Línea en blanco.
- **L60** Devuelve la app armada. Todavía no escucha ningún puerto: eso lo hace `index.js`.
- **L61** Cierra la función.
- **L62** Línea en blanco.
- **L63** Exporta la fábrica.

---

## 7. `src/middleware/solicitudes.js`

**En una frase:** dos middleware de observación: uno numera cada solicitud y el otro registra cuánto tardó en responderse.

### Líneas 1–9 · Identificador de solicitud

```js
function crearIdentificadorSolicitud() {
  let numeroDeSolicitud = 0;

  return function identificarSolicitud(req, res, next) {
    numeroDeSolicitud += 1;
    res.locals.solicitudId = `BIB-${String(numeroDeSolicitud).padStart(4, "0")}`;
    next();
  };
}
```

- **L1** Fábrica que crea el middleware.
- **L2** Contador que arranca en 0. Vive dentro de la fábrica: nadie de afuera lo puede tocar, pero el middleware lo recuerda entre solicitudes (clausura).
- **L3** Línea en blanco.
- **L4** Devuelve el middleware. Tiene nombre (`identificarSolicitud`) para que aparezca así en los mensajes de error.
- **L5** Suma 1 en cada solicitud.
- **L6** Arma el identificador y lo guarda en `res.locals`. `String(...)` convierte el número en texto y `padStart(4, "0")` lo completa con ceros a la izquierda: 7 → `"0007"`, resultado `BIB-0007`. Al estar en `res.locals`, lo puede mostrar el pie de página y lo puede usar el registro de errores.
- **L7** `next()` pasa al siguiente middleware.
- **L8–9** Cierran el middleware y la fábrica.
- **L10** Línea en blanco.

### Líneas 11–23 · Duración de la solicitud

```js
function medirDuracion(req, res, next) {
  const inicio = process.hrtime.bigint();
  res.on("finish", () => {
    const fin = process.hrtime.bigint();
    const milisegundos = Number(fin - inicio) / 1_000_000;
    console.log(
      `[${res.locals.solicitudId}] ${req.method} ${req.originalUrl} ${res.statusCode} ${milisegundos.toFixed(2)} ms`,
    );
  });
  next();
}

module.exports = { crearIdentificadorSolicitud, medirDuracion };
```

- **L11** Middleware común (no es fábrica).
- **L12** Toma la hora de inicio con alta precisión, en **nanosegundos**, como `BigInt` (un tipo de número entero muy grande).
- **L13** `res.on("finish", ...)` registra una función que se ejecutará **cuando la respuesta termine de enviarse**, no ahora.
- **L14** Toma la hora de fin.
- **L15** Resta fin menos inicio (nanosegundos), lo convierte a número común y lo divide por un millón para pasarlo a milisegundos. El `_` en `1_000_000` es solo un separador visual.
- **L16–18** Muestra una línea como `[BIB-0003] PATCH /api/reservas/... 200 12.34 ms`: identificador, método, dirección original, código de estado y duración con dos decimales (`toFixed(2)`).
- **L19** Cierra el callback de `finish`.
- **L20** Llama a `next()` **enseguida**: no espera a que termine la solicitud; la medición se completa sola al final.
- **L21** Cierra la función.
- **L22** Línea en blanco.
- **L23** Exporta los dos middleware.

---

## 8. `src/rutas/reservas-api.js` [NUEVO TP09]

**En una frase:** el mapa de la API JSON. A cada método HTTP sobre `/api/reservas` le asigna su validación (si la necesita) y su función del controlador. En este TP se agregaron PUT, PATCH y DELETE.

```js
const express = require("express");
const { validarReserva } = require("../middleware/reservas");
const { validarCambioReserva } = require("../middleware/cambios-reservas");

function crearRouterReservasApi(controlador) {
  const router = express.Router();

  router.get("/", controlador.listarApi);
  router.get("/:id", controlador.obtenerApi);
  router.post("/", validarReserva, controlador.crearApi);
  router.put("/:id", validarCambioReserva, controlador.reemplazarApi);
  router.patch("/:id", validarCambioReserva, controlador.actualizarApi);
  router.delete("/:id", controlador.eliminarApi);

  return router;
}

module.exports = { crearRouterReservasApi };
```

- **L1** Carga Express para usar `express.Router()`.
- **L2** Trae el validador de **creación** (POST), el mismo que usa el formulario HTML.
- **L3** **[NUEVO]** Trae el validador de **cambios** (PUT y PATCH).
- **L4** Línea en blanco.
- **L5** Fábrica que recibe el controlador y devuelve el router.
- **L6** `express.Router()` crea un "mini-app" con sus propias rutas, que después se monta en `/api/reservas` (en `app.js`, línea 39).
- **L7** Línea en blanco.
- **L8** `GET /api/reservas` → `listarApi`: devuelve el arreglo de reservas (acepta `?sala=`).
- **L9** `GET /api/reservas/:id` → `obtenerApi`. `:id` es un **parámetro de ruta**: lo que vaya en esa posición queda en `req.params.id`.
- **L10** `POST /api/reservas` → primero `validarReserva`, después `crearApi`. Se pueden encadenar varias funciones: si el validador rechaza, responde 400 y no llama a `next()`, así que el controlador nunca se ejecuta.
- **L11** **[NUEVO]** `PUT /api/reservas/:id` → `validarCambioReserva` (exige los 7 campos) → `reemplazarApi`.
- **L12** **[NUEVO]** `PATCH /api/reservas/:id` → el **mismo** validador, que detecta el método y para PATCH admite solo `personas` y `estado` → `actualizarApi`.
- **L13** **[NUEVO]** `DELETE /api/reservas/:id` → `eliminarApi`. No lleva validador de cuerpo porque DELETE no tiene cuerpo; el ID lo revisa el servicio.
- **L14** Línea en blanco.
- **L15** Devuelve el router.
- **L16** Cierra la función.
- **L17** Línea en blanco.
- **L18** Exporta la fábrica.

> Si llega un método que no está definido (por ejemplo `POST /api/reservas/:id`), ninguna ruta coincide y responde el 404 JSON de `app.js`.

---

## 9. `src/rutas/reservas.js`

**En una frase:** el mapa del sitio HTML: listado, formulario, detalle y envío del formulario. No cambió en este TP.

```js
const express = require("express");
const {
  prepararAreaReservas,
  validarReserva,
} = require("../middleware/reservas");

function crearRouterReservas(controlador) {
  const router = express.Router();

  router.use(prepararAreaReservas);
  router.get("/", controlador.listar);
  router.get("/nueva", controlador.mostrarFormulario);
  router.get("/:id", controlador.mostrarDetalle);
  router.post("/", validarReserva, controlador.crear);

  return router;
}

module.exports = { crearRouterReservas };
```

- **L1** Carga Express.
- **L2–5** Trae dos middleware: el que prepara datos para las vistas y el validador de creación.
- **L6** Línea en blanco.
- **L7** Fábrica que recibe el controlador.
- **L8** Crea el router (se monta en `/reservas`).
- **L9** Línea en blanco.
- **L10** `router.use(...)` sin ruta: `prepararAreaReservas` corre en **todas** las rutas de este router, antes que cualquier otra cosa. Carga en `res.locals` la sección y las listas de salas y turnos para las vistas.
- **L11** `GET /reservas` → listado.
- **L12** `GET /reservas/nueva` → formulario. **Tiene que ir antes que `/:id`**: si estuviera después, Express tomaría la palabra `nueva` como si fuera un ID.
- **L13** `GET /reservas/:id` → detalle de una reserva.
- **L14** `POST /reservas` (lo que envía el formulario) → validar → crear.
- **L15** Línea en blanco.
- **L16** Devuelve el router.
- **L17** Cierra la función.
- **L18** Línea en blanco.
- **L19** Exporta la fábrica.

---

## 10. `src/middleware/reservas.js`

**En una frase:** valida los datos para **crear** una reserva (formulario y POST de la API). Si algo está mal responde 400; si todo está bien deja los datos limpios en `req.reservaValidada`.

### Líneas 1–8 · Preparar datos para las vistas

```js
const { SALAS, TURNOS } = require("../modelos/reserva");

function prepararAreaReservas(req, res, next) {
  res.locals.seccion = "Reservas de salas";
  res.locals.salasPermitidas = SALAS;
  res.locals.turnosPermitidos = TURNOS;
  next();
}
```

- **L1** Trae las listas de salas y turnos **desde el modelo**: hay una sola fuente de verdad. Si se agrega una sala en el modelo, se actualizan solos el esquema, la validación y el formulario.
- **L2** Línea en blanco.
- **L3** Middleware que corre en todas las rutas del sitio de reservas.
- **L4** Guarda el nombre de la sección; las vistas lo muestran como etiqueta.
- **L5** Guarda la lista de salas; `nueva.ejs` la usa para armar las opciones del `<select>`.
- **L6** Lo mismo con los turnos.
- **L7** Pasa al siguiente.
- **L8** Cierra la función.
- **L9** Línea en blanco.

### Líneas 10–19 · Funciones auxiliares de lectura

```js
function leerTexto(valor) {
  return typeof valor === "string" ? valor.trim() : "";
}

function leerPersonas(valor) {
  const tipoValido =
    typeof valor === "number" ||
    (typeof valor === "string" && valor.trim() !== "");
  return tipoValido ? Number(valor) : NaN;
}
```

- **L10** Lee un campo de texto de forma segura.
- **L11** Si es texto, lo devuelve sin espacios en los extremos; si es cualquier otra cosa (número, arreglo, `undefined`), devuelve `""`, que después se rechaza como vacío.
- **L12** Cierra la función.
- **L13** Línea en blanco.
- **L14** Lee la cantidad de personas.
- **L15–17** Solo acepta como punto de partida un **número** o un **texto no vacío**. Esto es importante porque `Number("")` da 0, `Number(true)` da 1 y `Number([3])` da 3: sin este filtro, esos valores raros pasarían como números.
- **L18** Si el tipo es válido lo convierte con `Number` (`"4"` → `4`); si no, devuelve `NaN`, que nunca pasa la validación.
- **L19** Cierra la función.
- **L20** Línea en blanco.

### Líneas 21–38 · Leer y revisar cada campo

```js
function validarReserva(req, res, next) {
  const valores = req.body ?? {};
  const estudiante = leerTexto(valores.estudiante);
  const email = leerTexto(valores.email);
  const sala = leerTexto(valores.sala);
  const fecha = leerTexto(valores.fecha);
  const turno = leerTexto(valores.turno);
  const personas = leerPersonas(valores.personas);

  const campos = [];
  if (!estudiante) campos.push("estudiante");
  if (!email.includes("@")) campos.push("email");
  if (!SALAS.includes(sala)) campos.push("sala");
  if (!fecha) campos.push("fecha");
  if (!TURNOS.includes(turno)) campos.push("turno");
  if (!Number.isInteger(personas) || personas < 1 || personas > 6) {
    campos.push("personas");
  }
```

- **L21** El middleware validador de creación.
- **L22** Toma el cuerpo. `?? {}` es necesario porque en Express 5 `req.body` es `undefined` si no llegó cuerpo; así no falla al leer sus propiedades.
- **L23–27** Lee los cinco campos de texto con `leerTexto` (ya recortados).
- **L28** Lee `personas` con su función especial.
- **L29** Línea en blanco.
- **L30** Arreglo donde se anotan los campos inválidos. Se revisan **todos** para informar todos los errores juntos, no solo el primero.
- **L31** Estudiante vacío → inválido.
- **L32** Email sin `@` → inválido.
- **L33** Sala que no está en la lista permitida → inválida.
- **L34** Fecha vacía → inválida.
- **L35** Turno fuera de la lista → inválido.
- **L36–38** Personas tiene que ser entero (descarta `NaN` y decimales) y estar entre 1 y 6.
- **L39** Línea en blanco.

### Líneas 40–52 · Si hay errores, responder 400

```js
  if (campos.length > 0) {
    const mensaje = "Por favor, completá todos los campos con datos válidos.";

    if (req.baseUrl === "/api/reservas") {
      return res.status(400).json({ error: mensaje, campos });
    }

    return res.status(400).render("reservas/nueva", {
      titulo: "Registrar nueva reserva",
      error: mensaje,
      valores,
    });
  }
```

- **L40** Si se anotó al menos un campo inválido...
- **L41** ...prepara el mensaje.
- **L42** Línea en blanco.
- **L43** `req.baseUrl` es el prefijo donde está montado el router. Como este mismo middleware se usa en la API y en el sitio, así sabe quién lo llamó.
- **L44** Si es la API: 400 en JSON con el mensaje y la lista de campos inválidos.
- **L45–46** Cierra el `if` y deja una línea en blanco.
- **L47** Si es el sitio: 400 y vuelve a mostrar el formulario...
- **L48** ...con su título...
- **L49** ...el mensaje de error...
- **L50** ...y los `valores` que se habían escrito, para que el usuario no tenga que tipear todo de nuevo.
- **L51–52** Cierran el `render` y el `if`. Al responder con `return` no se llama a `next()`: **el controlador no se ejecuta y la base no se toca**.
- **L53** Línea en blanco.

### Líneas 54–66 · Datos limpios y continuar

```js
  req.reservaValidada = {
    estudiante,
    email,
    sala,
    fecha,
    turno,
    personas,
  };

  next();
}

module.exports = { prepararAreaReservas, validarReserva };
```

- **L54** Si todo es válido, arma un objeto nuevo y lo guarda en `req.reservaValidada` para que lo use el controlador.
- **L55–60** Copia **solo** los seis campos, ya limpios (propiedades abreviadas). Si el cliente mandó `estado` o `_id`, se pierden acá: por eso toda reserva nace `pendiente` y con el `_id` que genera MongoDB.
- **L61** Cierra el objeto.
- **L62** Línea en blanco.
- **L63** Pasa al controlador.
- **L64** Cierra la función.
- **L65** Línea en blanco.
- **L66** Exporta los dos middleware.

---

## 11. `src/middleware/cambios-reservas.js` [NUEVO TP09]

**En una frase:** es el validador nuevo para PUT y PATCH. Revisa que el cuerpo sea un objeto, que solo traiga campos permitidos para ese método, que en PUT estén todos, y que cada valor sea válido. Si algo falla responde 400 **sin llegar a la base**; si todo está bien deja los datos limpios en `req.cambiosValidos`.

### Líneas 1–12 · Listas de campos permitidos

```js
const { SALAS, TURNOS, ESTADOS } = require("../modelos/reserva");

const CAMPOS_PUT = [
  "estudiante",
  "email",
  "sala",
  "fecha",
  "turno",
  "personas",
  "estado",
];
const CAMPOS_PATCH = ["personas", "estado"];
```

- **L1** Trae las tres listas de valores permitidos desde el modelo (misma fuente de verdad que el esquema).
- **L2** Línea en blanco.
- **L3–11** `CAMPOS_PUT`: los **siete** campos editables. PUT reemplaza la reserva completa, así que los exige todos, incluido `estado`.
- **L12** `CAMPOS_PATCH`: PATCH es un cambio parcial y solo admite `personas` y `estado`.
- **L13** Línea en blanco.

### Líneas 14–39 · `leerCampo`: limpiar y validar un valor

Devuelve el valor listo para guardar o `undefined` si es inválido.

```js
function leerCampo(campo, valor) {
  if (campo === "personas") {
    const tipoValido =
      typeof valor === "number" ||
      (typeof valor === "string" && valor.trim() !== "");
    const numero = tipoValido ? Number(valor) : NaN;
    if (
      !Number.isFinite(numero) ||
      !Number.isInteger(numero) ||
      numero < 1 ||
      numero > 6
    ) {
      return undefined;
    }
    return numero;
  }
```

- **L14** Recibe el nombre del campo y el valor enviado.
- **L15** Caso especial: `personas`, que es numérico.
- **L16–18** Igual que en el validador de creación: solo acepta un número o un texto no vacío. Así `true`, `[3]`, `{}` y `""` quedan afuera aunque `Number()` pudiera convertirlos.
- **L19** Si el tipo sirve lo convierte a número; si no, `NaN`.
- **L20** Rechaza si se cumple cualquiera de estas condiciones:
- **L21** No es finito. `1e999` en un JSON se lee como `Infinity`. *(En rigor `Number.isInteger(Infinity)` ya da `false`; esta comprobación deja explícita la intención.)*
- **L22** No es entero (`2.5`).
- **L23** Es menor que 1.
- **L24** Es mayor que 6.
- **L25** Cierra la condición.
- **L26** Si falla alguna, devuelve `undefined` = inválido.
- **L27** Cierra el `if`.
- **L28** Devuelve el **número** ya convertido: si llegó `"4"`, se guarda `4` como número.
- **L29** Cierra el caso `personas`.

```js
  if (typeof valor !== "string") return undefined;
  const texto = valor.trim();

  if (campo === "sala") return SALAS.includes(texto) ? texto : undefined;
  if (campo === "turno") return TURNOS.includes(texto) ? texto : undefined;
  if (campo === "estado") return ESTADOS.includes(texto) ? texto : undefined;
  if (campo === "email") return texto.includes("@") ? texto : undefined;
  return texto || undefined;
}
```

- **L30** Línea en blanco.
- **L31** Todos los demás campos tienen que ser **texto**. `true` o `5` como estado se rechazan.
- **L32** Quita espacios de los extremos.
- **L33** Línea en blanco.
- **L34** `sala`: solo si está en la lista (`Sala Norte`, `Sala Sur`, `Sala Multimedia`).
- **L35** `turno`: solo `Mañana`, `Tarde` o `Noche`.
- **L36** `estado`: solo `pendiente` o `confirmada`. `"cancelada"` se rechaza.
- **L37** `email`: tiene que contener `@`.
- **L38** Los que quedan (`estudiante`, `fecha`): el texto si no está vacío. `"" || undefined` da `undefined`.
- **L39** Cierra la función.
- **L40** Línea en blanco.

### Líneas 41–50 · Comienzo del middleware y cuerpo inválido

```js
function validarCambioReserva(req, res, next) {
  const cuerpo = req.body;
  const rechazar = (campos) =>
    res
      .status(400)
      .json({ error: "Revisá los campos de la actualización.", campos });

  if (!cuerpo || typeof cuerpo !== "object" || Array.isArray(cuerpo)) {
    return rechazar([]);
  }
```

- **L41** El middleware que usan PUT y PATCH.
- **L42** Toma el cuerpo de la solicitud.
- **L43–46** `rechazar` es una función flecha auxiliar que responde 400 con un mensaje fijo y la lista de campos con problemas. Evita repetir esa respuesta en dos lugares.
- **L47** Línea en blanco.
- **L48** Rechaza el cuerpo entero si: no existe (Body none o `text/plain` dejan `req.body` en `undefined`), no es un objeto, o es un arreglo. Hace falta `Array.isArray` porque `typeof []` también da `"object"`.
- **L49** Responde 400 con lista vacía: el problema es el cuerpo completo, no un campo.
- **L50** Cierra el `if`.
- **L51** Línea en blanco.

### Líneas 52–61 · Campos no permitidos y campos faltantes

```js
  const esPut = req.method === "PUT";
  const permitidos = esPut ? CAMPOS_PUT : CAMPOS_PATCH;
  const claves = Object.keys(cuerpo);

  const campos = claves.filter((clave) => !permitidos.includes(clave));
  if (esPut) {
    for (const campo of CAMPOS_PUT) {
      if (!Object.hasOwn(cuerpo, campo)) campos.push(campo);
    }
  }
```

- **L52** ¿Es PUT? (Si no, es PATCH.)
- **L53** Elige la lista de campos permitidos según el método.
- **L54** `Object.keys` devuelve los nombres de las propiedades enviadas, por ejemplo `["personas", "estado"]`.
- **L55** Línea en blanco.
- **L56** `filter` se queda con las claves que **no** están permitidas: campos desconocidos, `_id`, o operadores como `$set` y `$inc`. Esas claves ya cuentan como errores. Así el cliente nunca puede cambiar el `_id` ni mandar operadores de MongoDB.
- **L57** Solo para PUT...
- **L58** ...recorre los siete campos obligatorios...
- **L59** ...y anota los que **faltan**. `Object.hasOwn(cuerpo, campo)` pregunta si el objeto tiene esa propiedad propia, aunque su valor sea "falso" (como `0`). Un PUT incompleto no se completa con valores por defecto: se rechaza.
- **L60–61** Cierran el `for` y el `if`.
- **L62** Línea en blanco.

### Líneas 63–82 · Validar cada valor y continuar

```js
  const datos = {};
  for (const campo of claves) {
    if (!permitidos.includes(campo)) continue;
    const valor = leerCampo(campo, cuerpo[campo]);
    if (valor === undefined) {
      campos.push(campo);
    } else {
      datos[campo] = valor;
    }
  }

  if (claves.length === 0 || campos.length > 0) {
    return rechazar(campos);
  }

  req.cambiosValidos = datos;
  next();
}

module.exports = { validarCambioReserva };
```

- **L63** Objeto vacío donde se van a copiar solo los valores válidos y limpios.
- **L64** Recorre cada clave enviada.
- **L65** Si no está permitida, la salta con `continue` (ya se anotó como error en la línea 56).
- **L66** Limpia y valida el valor con `leerCampo`. `cuerpo[campo]` lee la propiedad cuyo nombre está en la variable `campo`.
- **L67–68** Si es inválido, anota el campo como error...
- **L69–70** ...si es válido, lo copia en `datos`.
- **L71–72** Cierran el `if/else` y el `for`.
- **L73** Línea en blanco.
- **L74** Rechaza si el objeto llegó **vacío** (`{}`) o si hubo **algún** campo con problemas.
- **L75** Responde 400 con la lista de campos rechazados. Al no llamar a `next()`, el controlador y la base ni se enteran.
- **L76** Cierra el `if`.
- **L77** Línea en blanco.
- **L78** Deja los datos validados en `req.cambiosValidos` para el controlador.
- **L79** Pasa al controlador.
- **L80** Cierra la función.
- **L81** Línea en blanco.
- **L82** Exporta el middleware. `leerCampo` y las listas no se exportan: son internas.

---

## 12. `src/controladores/reservas.js` [NUEVO TP09]

**En una frase:** el controlador recibe la solicitud ya validada, le pide el trabajo al servicio y decide la respuesta: una vista HTML, un JSON con 200 o 201, un 204 sin cuerpo o un 404. No sabe nada de MongoDB. En este TP se agregaron `reemplazarApi`, `actualizarApi` y `eliminarApi`.

> Todas las funciones que usan el servicio son `async` y **esperan** (`await`) su resultado. No tienen `try/catch`: si el servicio lanza un error, Express 5 lo manda solo a `middleware/errores.js`.

### Líneas 1–9 · Fábrica y estado del servicio

```js
function crearControladorReservas(servicioReservas) {
  async function mostrarEstado(req, res) {
    const reservas = await servicioReservas.contar();
    res.json({
      servicio: "activo",
      reservas,
      solicitudId: res.locals.solicitudId,
    });
  }
```

- **L1** Fábrica que recibe el servicio. Todas las funciones de adentro lo recuerdan (clausura) sin recibirlo como parámetro.
- **L2** `mostrarEstado` atiende `GET /estado`.
- **L3** Pide al servicio la cantidad de reservas y espera el número (en MongoDB es `countDocuments()`).
- **L4** `res.json(...)` responde con un objeto convertido a JSON (estado 200 por defecto)...
- **L5** ...que indica que el servicio está activo...
- **L6** ...la cantidad de reservas...
- **L7** ...y el identificador de esta solicitud (lo puso el middleware de solicitudes en `res.locals`).
- **L8–9** Cierran el objeto y la función.
- **L10** Línea en blanco.

### Líneas 11–25 · Listado y formulario del sitio

```js
  async function listar(req, res) {
    const reservas = await servicioReservas.listar();
    res.render("reservas/lista", {
      titulo: "Listado de reservas",
      reservas,
    });
  }

  function mostrarFormulario(req, res) {
    res.render("reservas/nueva", {
      titulo: "Registrar nueva reserva",
      error: null,
      valores: {},
    });
  }
```

- **L11** `listar` atiende `GET /reservas` (sitio HTML).
- **L12** Pide todas las reservas (sin filtro) y espera el arreglo.
- **L13** Renderiza `views/reservas/lista.ejs`...
- **L14** ...con el título...
- **L15** ...y el arreglo de reservas para que la vista arme las tarjetas.
- **L16–17** Cierran el `render` y la función.
- **L18** Línea en blanco.
- **L19** `mostrarFormulario` atiende `GET /reservas/nueva`. **No** es `async` porque no consulta la base.
- **L20** Renderiza el formulario...
- **L21** ...con su título...
- **L22** ...`error: null` porque todavía no hay errores que mostrar...
- **L23** ...y `valores: {}` porque los campos empiezan vacíos. La vista siempre espera estas dos variables.
- **L24–25** Cierran el `render` y la función.
- **L26** Línea en blanco.

### Líneas 27–46 · Detalle y creación desde el sitio

```js
  async function mostrarDetalle(req, res) {
    const reserva = await servicioReservas.obtenerPorId(req.params.id);

    if (!reserva) {
      return res.status(404).render("no-encontrado", {
        titulo: "Reserva no encontrada",
        mensaje: "No existe una reserva registrada con ese identificador.",
      });
    }

    res.render("reservas/detalle", {
      titulo: `Reserva de ${reserva.estudiante}`,
      reserva,
    });
  }

  async function crear(req, res) {
    await servicioReservas.crear(req.reservaValidada);
    res.redirect("/reservas");
  }
```

- **L27** `mostrarDetalle` atiende `GET /reservas/:id`.
- **L28** Busca la reserva con el ID de la dirección (`req.params.id`). Si el ID está mal formado, el servicio lanza un error y termina en un 400.
- **L29** Línea en blanco.
- **L30** Si el servicio devolvió `null` (el ID es válido pero no existe)...
- **L31** ...responde 404 con la vista de error. `return` evita seguir y responder dos veces.
- **L32–33** Título y mensaje de la página de error.
- **L34–35** Cierran el `render` y el `if`.
- **L36** Línea en blanco.
- **L37** Si existe, renderiza la vista de detalle...
- **L38** ...con un título armado con plantilla literal (`Reserva de Ana Ejemplo`)...
- **L39** ...y la reserva completa.
- **L40–41** Cierran el `render` y la función.
- **L42** Línea en blanco.
- **L43** `crear` atiende `POST /reservas` (el formulario).
- **L44** Le pasa al servicio los datos que dejó limpios el middleware en `req.reservaValidada` y espera que se guarden.
- **L45** Redirige al listado (código 302). Es el patrón **Post/Redirect/Get**: si el usuario recarga la página, no se reenvía el formulario ni se duplica la reserva.
- **L46** Cierra la función.
- **L47** Línea en blanco.

### Líneas 48–66 · API: listar, consultar y crear

```js
  async function listarApi(req, res) {
    const reservas = await servicioReservas.listar(req.query.sala);
    res.json(reservas);
  }

  async function obtenerApi(req, res) {
    const reserva = await servicioReservas.obtenerPorId(req.params.id);

    if (!reserva) {
      return res.status(404).json({ error: "Reserva no encontrada." });
    }

    res.json(reserva);
  }

  async function crearApi(req, res) {
    const reserva = await servicioReservas.crear(req.reservaValidada);
    res.location(`/api/reservas/${reserva.id}`).status(201).json(reserva);
  }
```

- **L48** `listarApi` atiende `GET /api/reservas`.
- **L49** `req.query.sala` es el valor de `?sala=...` en la dirección (o `undefined` si no vino). Se lo pasa al servicio, que filtra si corresponde.
- **L50** Responde el **arreglo** de reservas en JSON.
- **L51** Cierra la función.
- **L52** Línea en blanco.
- **L53** `obtenerApi` atiende `GET /api/reservas/:id`.
- **L54** Busca por ID.
- **L55** Línea en blanco.
- **L56–57** Si no existe, 404 en JSON.
- **L58** Cierra el `if`.
- **L59** Línea en blanco.
- **L60** Si existe, responde la reserva (200).
- **L61** Cierra la función.
- **L62** Línea en blanco.
- **L63** `crearApi` atiende `POST /api/reservas`.
- **L64** Crea la reserva con los datos validados y recibe la reserva guardada (ya con su `id`).
- **L65** Encadena tres cosas: `res.location(...)` agrega el encabezado `Location` con la dirección del recurso nuevo; `.status(201)` indica **Creado**; `.json(reserva)` envía la reserva. Es lo que pide REST al crear.
- **L66** Cierra la función.
- **L67** Línea en blanco.

### Líneas 68–92 · [NUEVO] PUT y PATCH

```js
  async function reemplazarApi(req, res) {
    const reserva = await servicioReservas.reemplazar(
      req.params.id,
      req.cambiosValidos,
    );

    if (!reserva) {
      return res.status(404).json({ error: "Reserva no encontrada." });
    }

    res.json(reserva);
  }

  async function actualizarApi(req, res) {
    const reserva = await servicioReservas.actualizar(
      req.params.id,
      req.cambiosValidos,
    );

    if (!reserva) {
      return res.status(404).json({ error: "Reserva no encontrada." });
    }

    res.json(reserva);
  }
```

- **L68** **[NUEVO]** `reemplazarApi` atiende `PUT /api/reservas/:id`.
- **L69** Llama a `servicioReservas.reemplazar` y espera...
- **L70** ...pasándole el ID de la dirección...
- **L71** ...y los siete campos que validó `validarCambioReserva` (`req.cambiosValidos`).
- **L72** Cierra la llamada.
- **L73** Línea en blanco.
- **L74–75** Si el servicio devolvió `null`, el ID no existe: 404 en JSON. **No se crea nada nuevo.**
- **L76** Cierra el `if`.
- **L77** Línea en blanco.
- **L78** Si salió bien, responde 200 con la reserva **ya reemplazada** (mismo ID, valores nuevos).
- **L79** Cierra la función.
- **L80** Línea en blanco.
- **L81** **[NUEVO]** `actualizarApi` atiende `PATCH /api/reservas/:id`.
- **L82–85** Igual que PUT, pero llama a `servicioReservas.actualizar`, que cambia solo los campos enviados (`personas` y/o `estado`).
- **L86** Línea en blanco.
- **L87–89** ID inexistente → 404.
- **L90** Línea en blanco.
- **L91** Responde 200 con la reserva modificada; los campos que no se enviaron quedan como estaban.
- **L92** Cierra la función.
- **L93** Línea en blanco.

> PUT y PATCH tienen el mismo código en el controlador. La diferencia está en **qué valida el middleware** (7 campos o solo 2) y en **qué hace el servicio** (reemplazar todo o `$set` de algunos campos).

### Líneas 94–102 · [NUEVO] DELETE

```js
  async function eliminarApi(req, res) {
    const eliminada = await servicioReservas.eliminar(req.params.id);

    if (!eliminada) {
      return res.status(404).json({ error: "Reserva no encontrada." });
    }

    res.status(204).end();
  }
```

- **L94** **[NUEVO]** `eliminarApi` atiende `DELETE /api/reservas/:id`.
- **L95** El servicio devuelve un **booleano**: `true` si borró un documento, `false` si no había ninguno con ese ID.
- **L96** Línea en blanco.
- **L97–98** Si no borró nada, 404 en JSON.
- **L99** Cierra el `if`.
- **L100** Línea en blanco.
- **L101** Si borró, responde **204 No Content**: éxito **sin cuerpo**. `.end()` cierra la respuesta sin enviar datos (no hay nada que devolver porque el recurso ya no existe).
- **L102** Cierra la función.
- **L103** Línea en blanco.

### Líneas 104–119 · El objeto controlador

```js
  return {
    mostrarEstado,
    listar,
    mostrarFormulario,
    mostrarDetalle,
    crear,
    listarApi,
    obtenerApi,
    crearApi,
    reemplazarApi,
    actualizarApi,
    eliminarApi,
  };
}

module.exports = { crearControladorReservas };
```

- **L104** La fábrica devuelve un objeto con todas las funciones...
- **L105–115** ...`mostrarEstado` y las cuatro del sitio (L105–109), y las seis de la API (L110–115), de las cuales las tres últimas son nuevas. Los routers las usan como `controlador.listarApi`, `controlador.eliminarApi`, etc.
- **L116** Cierra el objeto.
- **L117** Cierra la fábrica.
- **L118** Línea en blanco.
- **L119** Exporta la fábrica.

---

## 13. `src/servicios/reservas-mongo.js` [NUEVO TP09]

**En una frase:** es la única capa que habla con MongoDB a través del modelo `Reserva`. Revisa el ID, arma las consultas con listas de campos admitidos (nunca confía en lo que le pasan) y devuelve un objeto, `null` o un booleano. No sabe nada de Express ni de HTTP. En este TP se agregaron `comprobarId`, `reemplazar`, `actualizar` y `eliminar`.

### Líneas 1–15 · Importaciones y representación pública

```js
const mongoose = require("mongoose");
const { Reserva } = require("../modelos/reserva");

function representarReserva(documento) {
  return {
    id: documento._id.toString(),
    estudiante: documento.estudiante,
    email: documento.email,
    sala: documento.sala,
    fecha: documento.fecha,
    turno: documento.turno,
    personas: documento.personas,
    estado: documento.estado,
  };
}
```

- **L1** Carga Mongoose (se usa para validar el formato del ID).
- **L2** Trae el modelo `Reserva`, con el que se hacen las consultas.
- **L3** Línea en blanco.
- **L4** Convierte un documento de MongoDB en el objeto que ve el cliente.
- **L5** Devuelve un objeto nuevo...
- **L6** ...con `id` como **texto**: `_id` es un `ObjectId` (un tipo especial de MongoDB) y `toString()` lo pasa a su forma de 24 caracteres hexadecimales.
- **L7–13** ...y copia los siete campos de la reserva.
- **L14–15** Cierran el objeto y la función.

Así la API **no expone** detalles internos de la base, como `_id` o `__v`, y responde siempre con la misma forma, venga de donde venga el documento.

- **L16** Línea en blanco.

### Líneas 17–27 · Errores de entrada y validación del ID

```js
function crearErrorDeEntrada(mensaje, codigo) {
  const error = new Error(mensaje);
  error.codigo = codigo;
  return error;
}

function comprobarId(id) {
  if (!mongoose.isObjectIdOrHexString(id)) {
    throw crearErrorDeEntrada("Identificador inválido", "ID_INVALIDO");
  }
}
```

- **L17** Fabrica errores causados por datos del cliente.
- **L18** Crea el `Error` con su mensaje.
- **L19** Le agrega una propiedad propia, `codigo` (por ejemplo `"ID_INVALIDO"`). El manejador de errores la lee para responder 400 en lugar de 500.
- **L20–21** Lo devuelve y cierra la función.
- **L22** Línea en blanco.
- **L23** `comprobarId` revisa el ID antes de consultar.
- **L24** `mongoose.isObjectIdOrHexString(id)` es verdadero solo si el ID es un `ObjectId` o un texto de **24 caracteres hexadecimales** (0–9, a–f).
- **L25** Si no lo es (por ejemplo `abc`), lanza `ID_INVALIDO`, que termina en un 400 con un mensaje claro. Sin esto, Mongoose lanzaría un `CastError` menos explicativo.
- **L26–27** Cierran el `if` y la función.
- **L28** Línea en blanco.

### Líneas 29–42 · `listar`

```js
function crearServicioReservasMongo() {
  async function listar(sala) {
    const filtro = {};

    if (sala !== undefined) {
      if (typeof sala !== "string" || !sala.trim()) {
        throw crearErrorDeEntrada("Sala inválida", "FILTRO_INVALIDO");
      }
      filtro.sala = sala.trim();
    }

    const documentos = await Reserva.find(filtro).lean();
    return documentos.map(representarReserva);
  }
```

- **L29** Fábrica del servicio. Devuelve un objeto con todas las operaciones.
- **L30** `listar` recibe, opcionalmente, una sala para filtrar.
- **L31** Filtro vacío `{}`: en MongoDB significa "todos los documentos".
- **L32** Línea en blanco.
- **L33** Si vino el parámetro `sala`...
- **L34** ...tiene que ser texto y no estar vacío. Si se mandó `?sala=` vacío o `?sala=A&sala=B` (eso llega como arreglo), no es válido...
- **L35** ...y lanza `FILTRO_INVALIDO` (termina en 400).
- **L36** Cierra el `if` interno.
- **L37** Agrega la sala al filtro: queda `{ sala: "Sala Norte" }`.
- **L38** Cierra el `if`.
- **L39** Línea en blanco.
- **L40** `Reserva.find(filtro)` busca los documentos que coinciden. `.lean()` pide objetos JavaScript simples en vez de documentos completos de Mongoose: son más livianos y alcanzan porque solo se van a leer. `await` espera el resultado.
- **L41** `map` convierte cada documento con `representarReserva` y devuelve el arreglo.
- **L42** Cierra la función.
- **L43** Línea en blanco.

### Líneas 44–53 · `obtenerPorId` y `contar`

```js
  async function obtenerPorId(id) {
    comprobarId(id);

    const documento = await Reserva.findById(id).lean();
    return documento ? representarReserva(documento) : null;
  }

  async function contar() {
    return Reserva.countDocuments();
  }
```

- **L44** Busca una reserva por su ID.
- **L45** Primero revisa el formato del ID; si es inválido, lanza y no consulta la base.
- **L46** Línea en blanco.
- **L47** `findById(id)` busca el documento con ese `_id`; `.lean()` lo devuelve como objeto simple. Si no existe devuelve `null`.
- **L48** Ternario: si lo encontró, lo representa; si no, devuelve `null`. El servicio **no decide** el 404: eso lo hace el controlador al ver `null`.
- **L49** Cierra la función.
- **L50** Línea en blanco.
- **L51** Cuenta cuántas reservas hay.
- **L52** `countDocuments()` sin filtro cuenta todos los documentos de la colección. Devuelve una promesa con el número.
- **L53** Cierra la función.
- **L54** Línea en blanco.

### Líneas 55–65 · `crear`

```js
  async function crear(datos) {
    const documento = await Reserva.create({
      estudiante: datos.estudiante,
      email: datos.email,
      sala: datos.sala,
      fecha: datos.fecha,
      turno: datos.turno,
      personas: datos.personas,
    });
    return representarReserva(documento);
  }
```

- **L55** Crea una reserva nueva.
- **L56** `Reserva.create(...)` arma el documento, **lo valida con el esquema** y lo inserta en la colección. Espera a que termine.
- **L57–62** Copia uno por uno **solo** los seis campos. Aunque `datos` traiga `estado` o `_id`, no se copian: `estado` toma el valor por defecto `"pendiente"` y MongoDB genera el `_id`. El servicio no confía en quien lo llama.
- **L63** Cierra el objeto y la llamada.
- **L64** Devuelve la reserva guardada en su forma pública (ya con su `id`).
- **L65** Cierra la función.
- **L66** Línea en blanco.

### Líneas 67–85 · [NUEVO] `reemplazar` (PUT)

```js
  async function reemplazar(id, datos) {
    comprobarId(id);

    const reemplazo = {
      estudiante: datos.estudiante,
      email: datos.email,
      sala: datos.sala,
      fecha: datos.fecha,
      turno: datos.turno,
      personas: datos.personas,
      estado: datos.estado,
    };
    const documento = await Reserva.findOneAndReplace({ _id: id }, reemplazo, {
      runValidators: true,
      returnDocument: "after",
      upsert: false,
    });
    return documento ? representarReserva(documento) : null;
  }
```

- **L67** **[NUEVO]** Reemplaza una reserva completa.
- **L68** Revisa el ID (400 si está mal formado).
- **L69** Línea en blanco.
- **L70** Arma el documento de reemplazo copiando...
- **L71–77** ...los **siete** campos editables. **Nunca** incluye `_id`: el ID de la reserva no cambia.
- **L78** Cierra el objeto.
- **L79** `findOneAndReplace(filtro, reemplazo, opciones)` busca el documento con ese `_id` y lo **reemplaza entero** por `reemplazo` (conserva solo el `_id`).
- **L80** `runValidators: true`: el esquema **vuelve a validar** el reemplazo. Por defecto Mongoose no valida en las actualizaciones; con esta opción sí.
- **L81** `returnDocument: "after"`: devuelve el documento **después** del cambio, para responder con los valores nuevos y no con los viejos.
- **L82** `upsert: false`: si no encuentra el ID, **no inserta** uno nuevo. Actualizar un ID inexistente no crea nada.
- **L83** Cierra las opciones y la llamada.
- **L84** Si encontró y reemplazó, devuelve la reserva representada; si no, `null` (el controlador responde 404).
- **L85** Cierra la función.
- **L86** Línea en blanco.

### Líneas 87–104 · [NUEVO] `actualizar` (PATCH)

```js
  async function actualizar(id, datos) {
    comprobarId(id);

    const cambios = {};
    for (const campo of ["personas", "estado"]) {
      if (Object.hasOwn(datos, campo)) cambios[campo] = datos[campo];
    }
    if (Object.keys(cambios).length === 0) {
      throw crearErrorDeEntrada("Actualización vacía", "ENTRADA_INVALIDA");
    }

    const documento = await Reserva.findOneAndUpdate(
      { _id: id },
      { $set: cambios },
      { runValidators: true, returnDocument: "after", upsert: false },
    );
    return documento ? representarReserva(documento) : null;
  }
```

- **L87** **[NUEVO]** Cambia algunos campos de una reserva.
- **L88** Revisa el ID.
- **L89** Línea en blanco.
- **L90** Objeto vacío para los cambios.
- **L91** Recorre los **únicos** dos campos que se pueden cambiar con PATCH.
- **L92** Si `datos` trae ese campo, lo copia. Se usa `Object.hasOwn` y no `if (datos[campo])` porque este último ignoraría valores "falsos" como `0`; acá importa si el campo **está**, no si su valor es verdadero.
- **L93** Cierra el `for`.
- **L94** Si no quedó ningún cambio...
- **L95** ...lanza `ENTRADA_INVALIDA` (400). No tiene sentido mandar una actualización vacía a la base.
- **L96** Cierra el `if`.
- **L97** Línea en blanco.
- **L98** `findOneAndUpdate` busca y modifica un documento...
- **L99** ...el que tiene ese `_id`...
- **L100** ...con el operador `$set`, que **cambia solo los campos indicados** y deja el resto como estaba. El `$set` lo escribe el servidor: el cliente nunca puede mandar operadores (el middleware los rechaza).
- **L101** Las mismas tres opciones que en PUT: validar con el esquema, devolver la versión nueva y no crear si no existe.
- **L102** Cierra la llamada.
- **L103** Devuelve la reserva modificada o `null`.
- **L104** Cierra la función.
- **L105** Línea en blanco.

### Líneas 106–111 · [NUEVO] `eliminar` (DELETE)

```js
  async function eliminar(id) {
    comprobarId(id);

    const resultado = await Reserva.deleteOne({ _id: id });
    return resultado.deletedCount === 1;
  }
```

- **L106** **[NUEVO]** Elimina una reserva.
- **L107** Revisa el ID.
- **L108** Línea en blanco.
- **L109** `deleteOne` borra **un solo** documento con ese `_id` (borrado **físico**: deja de existir). Devuelve un resultado como `{ acknowledged: true, deletedCount: 1 }`.
- **L110** Devuelve `true` si se borró exactamente un documento y `false` si no había ninguno. Que la consulta termine sin error **no significa** que haya borrado algo; por eso se mira `deletedCount`.
- **L111** Cierra la función.
- **L112** Línea en blanco.

### Líneas 113–124 · El objeto servicio

```js
  return {
    listar,
    obtenerPorId,
    contar,
    crear,
    reemplazar,
    actualizar,
    eliminar,
  };
}

module.exports = { crearServicioReservasMongo };
```

- **L113** La fábrica devuelve el servicio con sus siete operaciones.
- **L114–120** Las cuatro anteriores y las tres nuevas (`reemplazar`, `actualizar`, `eliminar`). El servicio falso de `scripts/simular-fallo-servicio.js` tiene **los mismos nombres**, por eso la app funciona igual con cualquiera de los dos.
- **L121** Cierra el objeto.
- **L122** Cierra la fábrica.
- **L123** Línea en blanco.
- **L124** Exporta la fábrica. `representarReserva`, `crearErrorDeEntrada` y `comprobarId` son internas.

---

## 14. `src/modelos/reserva.js`

**En una frase:** define con un esquema de Mongoose qué forma tiene una reserva y qué reglas tiene que cumplir. Es la última barrera: aunque alguien saltee el middleware, el esquema rechaza los datos inválidos.

### Líneas 1–5 · Listas de valores permitidos

```js
const mongoose = require("mongoose");

const SALAS = ["Sala Norte", "Sala Sur", "Sala Multimedia"];
const TURNOS = ["Mañana", "Tarde", "Noche"];
const ESTADOS = ["pendiente", "confirmada"];
```

- **L1** Carga Mongoose.
- **L2** Línea en blanco.
- **L3** Las tres salas válidas.
- **L4** Los tres turnos válidos.
- **L5** Los dos estados válidos. En este TP se empezó a exportar porque lo necesita el validador de PUT y PATCH.
- **L6** Línea en blanco.

Están en mayúsculas porque son **constantes** que no cambian, y se definen acá para que el esquema, los middleware y las vistas usen exactamente las mismas listas.

### Líneas 7–27 · El esquema

```js
const reservaSchema = new mongoose.Schema(
  {
    estudiante: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, match: /@/ },
    sala: { type: String, required: true, enum: SALAS },
    fecha: { type: String, required: true, trim: true },
    turno: { type: String, required: true, enum: TURNOS },
```

- **L7** `new mongoose.Schema(definición, opciones)` crea el esquema.
- **L8** Abre el objeto con la definición de los campos.
- **L9** `estudiante`: texto (`type: String`), obligatorio (`required: true`) y con `trim: true`, que quita espacios de los extremos **antes** de validar. Así `"   "` queda vacío y se rechaza por `required`.
- **L10** `email`: texto obligatorio, recortado, y `match: /@/`: una **expresión regular** que exige que contenga `@`.
- **L11** `sala`: texto obligatorio; `enum: SALAS` solo admite valores de esa lista.
- **L12** `fecha`: texto obligatorio y recortado. Se guarda como texto (`"2026-10-28"`, lo que envía el `<input type="date">`), no como tipo fecha.
- **L13** `turno`: texto obligatorio dentro de la lista `TURNOS`.

```js
    personas: {
      type: Number,
      required: true,
      min: 1,
      max: 6,
      validate: {
        validator: Number.isInteger,
        message: "personas debe ser un número entero",
      },
    },
    estado: { type: String, enum: ESTADOS, default: "pendiente" },
  },
  { collection: "reservas" },
);
```

- **L14** `personas` se define en varias líneas porque tiene más reglas.
- **L15** Es un número. Mongoose **convierte** el texto `"4"` en `4`; si no puede convertir (`"abc"`), da un `CastError`.
- **L16** Obligatorio.
- **L17** Mínimo 1.
- **L18** Máximo 6.
- **L19** `validate` agrega una regla personalizada...
- **L20** ...la función validadora es `Number.isInteger`: recibe el valor y devuelve `true` o `false`. Rechaza `2.5`.
- **L21** Mensaje que se usa si falla esta regla.
- **L22** Cierra `validate`.
- **L23** Cierra `personas`.
- **L24** `estado`: texto dentro de `ESTADOS`, con `default: "pendiente"`. No es `required` porque, si no se manda, Mongoose usa el valor por defecto al crear.
- **L25** Cierra la definición de campos.
- **L26** Opciones del esquema: `collection: "reservas"` fija el nombre exacto de la colección en MongoDB, sin depender de cómo Mongoose arma el plural a partir del nombre del modelo.
- **L27** Cierra la llamada a `Schema`.
- **L28** Línea en blanco.

### Líneas 29–31 · El modelo

```js
const Reserva = mongoose.model("Reserva", reservaSchema);

module.exports = { Reserva, SALAS, TURNOS, ESTADOS };
```

- **L29** `mongoose.model(nombre, esquema)` "compila" el esquema y crea el **modelo** `Reserva`: el objeto con el que se hacen las consultas (`find`, `findById`, `create`, `findOneAndReplace`, `findOneAndUpdate`, `deleteOne`, `countDocuments`).
- **L30** Línea en blanco.
- **L31** Exporta el modelo y las tres listas.

---

## 15. `src/middleware/errores.js` [NUEVO TP09]

**En una frase:** es el destino de cualquier error. Si fue culpa del cliente (datos inválidos, ID mal formado, JSON roto) responde 400; si fue un fallo inesperado responde 500 con un mensaje genérico, sin mostrar trazas ni secretos. Responde en JSON para la API y con una página HTML para el sitio. En este TP se agregaron `CastError` y `ENTRADA_INVALIDA` como errores 400.

### Líneas 1–7 · ¿La solicitud espera JSON?

```js
function esSolicitudJson(req) {
  return (
    req.path === "/api" ||
    req.path.startsWith("/api/") ||
    req.path === "/estado"
  );
}
```

- **L1** Función que decide si se debe responder en JSON.
- **L2** Devuelve el resultado de la condición de las líneas siguientes:
- **L3** la dirección es exactamente `/api`...
- **L4** ...o empieza con `/api/`...
- **L5** ...o es `/estado`. Con que se cumpla una (`||`), es JSON.
- **L6–7** Cierran el `return` y la función. La usan el 404 de `app.js` y este manejador.
- **L8** Línea en blanco.

### Líneas 9–23 · Clasificar el error: ¿400 o 500?

```js
function crearManejadorErrores({ vistaFormulario, tituloFormulario }) {
  return function manejarErrores(error, req, res, next) {
    if (res.headersSent) {
      return next(error);
    }

    const esValidacion = error.name === "ValidationError";
    const esEntrada =
      esValidacion ||
      error.name === "CastError" ||
      error.codigo === "ENTRADA_INVALIDA" ||
      error.codigo === "ID_INVALIDO" ||
      error.codigo === "FILTRO_INVALIDO" ||
      error.type === "entity.parse.failed";
    const estado = esEntrada ? 400 : 500;
```

- **L9** Fábrica que recibe qué vista y qué título usar si falla el formulario.
- **L10** Devuelve el manejador. Tiene **cuatro parámetros**: por eso Express sabe que es un manejador de errores, aunque `next` casi no se use.
- **L11** `res.headersSent` es verdadero si ya se empezó a enviar la respuesta...
- **L12** ...en ese caso no se puede mandar otra, así que se delega al manejador por defecto de Express, que corta la conexión.
- **L13** Cierra el `if`.
- **L14** Línea en blanco.
- **L15** ¿Es un error de validación del esquema de Mongoose?
- **L16** `esEntrada`: ¿el error lo causó el cliente? Es verdadero si se da cualquiera de estos casos:
- **L17** error de validación del esquema;
- **L18** **[NUEVO]** `CastError`: un valor que no se puede convertir al tipo del esquema (por ejemplo, `personas: "abc"` en una actualización);
- **L19** **[NUEVO]** `ENTRADA_INVALIDA`: la actualización vacía que lanza el servicio;
- **L20** `ID_INVALIDO`: ID con formato incorrecto;
- **L21** `FILTRO_INVALIDO`: el parámetro `sala` mal enviado;
- **L22** `entity.parse.failed`: JSON mal escrito (lo marca `express.json()`).
- **L23** Si es culpa del cliente, 400; si no, 500.
- **L24** Línea en blanco.

### Líneas 25–35 · Mensaje y registro en consola

```js
    let mensaje = esEntrada
      ? "Revisá los datos enviados."
      : "No se pudo completar la operación.";
    if (error.codigo === "ID_INVALIDO") {
      mensaje = "El identificador debe tener 24 caracteres hexadecimales.";
    }
    if (error.codigo === "FILTRO_INVALIDO") {
      mensaje = "El parámetro sala debe enviarse una sola vez y con texto.";
    }

    console.error("Solicitud fallida:", res.locals.solicitudId, error.name);
```

- **L25–27** Mensaje genérico según el tipo de error. Es `let` porque puede cambiar en las líneas siguientes. En el 500 **no** se dice qué falló por dentro.
- **L28–30** Si fue un ID inválido, un mensaje más preciso que explica el formato correcto.
- **L31–33** Si fue el filtro de sala, otro mensaje preciso.
- **L34** Línea en blanco.
- **L35** Registra en la consola del servidor solo el identificador de solicitud y el **nombre** del error. No registra el mensaje ni la traza, que podrían contener la URI o datos sensibles.
- **L36** Línea en blanco.

### Líneas 37–60 · Responder según quién preguntó

```js
    if (esSolicitudJson(req)) {
      return res.status(estado).json({
        error: mensaje,
        campos: esValidacion ? Object.keys(error.errors) : [],
      });
    }

    if (esValidacion && req.method === "POST") {
      return res.status(400).render(vistaFormulario, {
        titulo: tituloFormulario,
        error: mensaje,
        valores: req.body ?? {},
      });
    }

    return res.status(estado).render("no-encontrado", {
      titulo: esEntrada ? "Solicitud inválida" : "Error del servicio",
      mensaje,
      codigo: estado,
    });
  };
}

module.exports = { crearManejadorErrores, esSolicitudJson };
```

- **L37** Si es una solicitud de la API o de `/estado`...
- **L38** ...responde con el estado calculado (400 o 500) en JSON...
- **L39** ...con el mensaje...
- **L40** ...y la lista de campos que fallaron. En un `ValidationError`, `error.errors` es un objeto cuyas claves son los nombres de los campos inválidos; `Object.keys` las saca en un arreglo. Si no es de validación, lista vacía.
- **L41–42** Cierran el objeto y el `if`.
- **L43** Línea en blanco.
- **L44** Si es un error de validación del esquema al enviar el **formulario** (POST del sitio)...
- **L45** ...vuelve a mostrar el formulario con 400...
- **L46** ...con su título...
- **L47** ...el mensaje...
- **L48** ...y los valores enviados (o `{}` si no hay cuerpo), para no perder lo que se escribió.
- **L49–50** Cierran el `render` y el `if`.
- **L51** Línea en blanco.
- **L52** En cualquier otro caso del sitio, muestra la página `no-encontrado.ejs` con el estado calculado...
- **L53** ...con un título según el tipo de error...
- **L54** ...el mensaje...
- **L55** ...y el código, que la vista muestra como `ERROR 400` o `ERROR 500`.
- **L56** Cierra el `render`.
- **L57** Cierra el manejador.
- **L58** Cierra la fábrica.
- **L59** Línea en blanco.
- **L60** Exporta la fábrica y `esSolicitudJson` (la usa también `app.js`).

---

## 16. Vistas EJS (`views/`)

**En una frase:** son las plantillas que generan el HTML del sitio. Un layout común envuelve cada página, y dos parciales (encabezado y pie) se repiten en todas. No cambiaron en este TP, salvo el texto del pie.

**Las tres etiquetas de EJS**

| Etiqueta | Qué hace | Ejemplo |
| --- | --- | --- |
| `<%= ... %>` | Imprime el valor **escapado**: convierte `<`, `>` y `&` en texto seguro. Evita que alguien inyecte HTML o JavaScript (XSS) escribiendo, por ejemplo, `<script>` como nombre. | `<%= reserva.estudiante %>` |
| `<%- ... %>` | Imprime **sin escapar**. Solo se usa con HTML que genera la propia app (parciales y el cuerpo de la página). | `<%- body %>` |
| `<% ... %>` | Ejecuta JavaScript **sin imprimir nada** (condiciones y ciclos). | `<% if (error) { %>` |

Las variables que usan las vistas llegan por dos caminos: el objeto que se pasa en `res.render(...)` (por ejemplo `titulo`, `reservas`) y `res.locals` (por ejemplo `solicitudId`, `seccion`, `salasPermitidas`).

### `views/layouts/main.ejs` · el layout

```html
<!doctype html>
<html lang="es">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>
        <%= titulo %> | Salas de Estudio
    </title>
    <link rel="stylesheet" href="/css/estilos.css">
    <script src="/js/app.js" defer></script>
</head>
<body>
    <%- include("../partials/encabezado") %>
        <main class="contenedor">
            <%- body %>
        </main>
        <%- include("../partials/pie") %>
</body>
</html>
```

- **L1** Declara que el documento es HTML5.
- **L2** Abre el HTML e indica que el idioma es español (lo usan el navegador y los lectores de pantalla).
- **L3** Abre la cabecera del documento.
- **L4** Codificación UTF-8, para que se vean bien las tildes y la ñ.
- **L5** Adapta el ancho de la página a la pantalla (celulares).
- **L6–8** Título de la pestaña: el `titulo` de cada página más `| Salas de Estudio`.
- **L9** Carga la hoja de estilos. La entrega `express.static` desde `public/css/estilos.css`.
- **L10** Carga el JavaScript del navegador. `defer` hace que se ejecute recién cuando terminó de leerse el HTML.
- **L11** Cierra la cabecera.
- **L12** Abre el cuerpo.
- **L13** Inserta el parcial del encabezado. La ruta es relativa al layout. Usa `<%-` porque es HTML propio.
- **L14** Abre el contenido principal.
- **L15** `body` es el HTML de la vista que se renderizó (`inicio`, `lista`, `detalle`...). Lo inserta `express-ejs-layouts`.
- **L16** Cierra el contenido principal.
- **L17** Inserta el parcial del pie.
- **L18–19** Cierran el cuerpo y el documento.

### `views/partials/encabezado.ejs`

```html
<header class="encabezado">
    <a class="marca" href="/">
        <img src="/img/sala.svg" alt="" width="40" height="40">
        <span>Salas de Estudio</span>
    </a>
    <nav aria-label="Navegación principal">
        <a href="/">Inicio</a>
        <a href="/reservas">Reservas</a>
        <a href="/reservas/nueva">Nueva Reserva</a>
        <a href="/estado">Estado API</a>
    </nav>
</header>
```

- **L1** Abre el encabezado de la página.
- **L2** Enlace con la marca que lleva al inicio.
- **L3** Ícono de la sala. `alt=""` indica que es decorativo (los lectores de pantalla lo saltean); `width` y `height` reservan su lugar para que la página no "salte" al cargar.
- **L4** Nombre del sitio.
- **L5** Cierra el enlace.
- **L6** Menú de navegación. `aria-label` le da un nombre para los lectores de pantalla.
- **L7–10** Enlaces a inicio, listado, formulario y el JSON de `/estado`.
- **L11–12** Cierran el menú y el encabezado.

### `views/partials/pie.ejs`

```html
<footer class="pie">
    <p>Laura Ivanna Toloza &mdash; TP09 CRUD con MongoDB</p>
    <p><small>Solicitud ID: <strong>
                <%= solicitudId %>
            </strong></small></p>
</footer>
```

- **L1** Abre el pie de página.
- **L2** Autora y nombre del TP. `&mdash;` es la entidad HTML de la raya (—).
- **L3–5** Muestra el identificador de la solicitud (`BIB-0001`...). Viene de `res.locals.solicitudId`, que pone el middleware de solicitudes en **todas** las solicitudes.
- **L6** Cierra el pie.

### `views/inicio.ejs`

```html
<section class="hero">
    <p class="etiqueta">SISTEMA DE RESERVAS</p>
    <h1>
        <%= titulo %>
    </h1>
    <p>Gestión eficiente de espacios de trabajo y salas de estudio grupal.</p>
    <div class="acciones">
        <a class="boton" href="/reservas">Ver reservas activas</a>
        <a class="boton secundario" href="/reservas/nueva">Reservar una sala</a>
    </div>
</section>
```

- **L1** Sección de presentación de la portada.
- **L2** Etiqueta pequeña sobre el título.
- **L3–5** Título principal, el que envía la ruta `/` en `app.js`.
- **L6** Descripción del sistema.
- **L7** Contenedor de los botones.
- **L8** Botón al listado.
- **L9** Botón al formulario, con un estilo secundario.
- **L10–11** Cierran el contenedor y la sección.

### `views/no-encontrado.ejs`

```html
<section class="estado">
    <p class="etiqueta">ERROR <%= locals.codigo ?? 404 %></p>
    <h1>
        <%= titulo %>
    </h1>
    <p>
        <%= mensaje %>
    </p>
    <a class="boton" href="/reservas">Volver al catálogo</a>
</section>
```

- **L1** Sección del mensaje de error.
- **L2** Muestra el código. `locals` es el objeto con todas las variables de la vista: escribir `locals.codigo` en vez de `codigo` evita un error si no se pasó esa variable (el 404 de `app.js` no la pasa). `?? 404` usa 404 por defecto. El manejador de errores sí la pasa (400 o 500).
- **L3–5** Título del error.
- **L6–8** Mensaje explicativo.
- **L9** Botón para volver al listado.
- **L10** Cierra la sección.

### `views/reservas/lista.ejs`

```html
<header class="cabecera-pagina">
    <div>
        <p class="etiqueta">
            <%= seccion %>
        </p>
        <h1>
            <%= titulo %>
        </h1>
    </div>
    <a class="boton" href="/reservas/nueva">Nueva Reserva</a>
</header>
```

- **L1** Cabecera de la página del listado.
- **L2** Agrupa etiqueta y título.
- **L3–5** Muestra `seccion` ("Reservas de salas"), que cargó `prepararAreaReservas` en `res.locals`.
- **L6–8** Título que envía el controlador `listar`.
- **L9** Cierra el grupo.
- **L10** Botón para crear una reserva.
- **L11** Cierra la cabecera.
- **L12** Línea en blanco.

```html
<% if (reservas.length===0) { %>
    <p class="estado-vacio">No hay reservas registradas en este momento.</p>
    <% } else { %>
        <section class="grilla" aria-label="Lista de reservas">
            <% reservas.forEach((reserva)=> { %>
                <article class="tarjeta">
                    <p class="etiqueta">
                        <%= reserva.sala %>
                    </p>
                    <h2>
                        <%= reserva.estudiante %>
                    </h2>
                    <p><strong>Fecha:</strong>
                        <%= reserva.fecha %> (<%= reserva.turno %>)
                    </p>
                    <p><strong>Personas:</strong>
                        <%= reserva.personas %>
                    </p>
                    <a href="/reservas/<%= reserva.id %>">Ver detalle</a>
                </article>
                <% }) %>
        </section>
        <% } %>
```

- **L13** JavaScript sin imprimir: si el arreglo de reservas está vacío...
- **L14** ...muestra un mensaje de lista vacía.
- **L15** Si no está vacío (`else`)...
- **L16** ...abre la grilla de tarjetas.
- **L17** `forEach` recorre las reservas: todo el HTML hasta la línea 33 se repite **una vez por reserva**.
- **L18** Abre la tarjeta.
- **L19–21** Sala como etiqueta.
- **L22–24** Nombre del estudiante como título.
- **L25–27** Fecha y, entre paréntesis, el turno.
- **L28–30** Cantidad de personas.
- **L31** Enlace al detalle, armado con el `id` de la reserva: `/reservas/6ae3d03...`.
- **L32** Cierra la tarjeta.
- **L33** Cierra el `forEach`.
- **L34** Cierra la grilla.
- **L35** Cierra el `if/else`.

### `views/reservas/detalle.ejs`

```html
<article class="detalle">
    <p class="etiqueta">
        <%= seccion %> | <%= reserva.sala %>
    </p>
    <h1>
        <%= titulo %>
    </h1>

    <ul class="datos-detalle">
        <li><strong>Identificador:</strong>
            <code><%= reserva.id %></code>
        </li>
```

- **L1** Abre el artículo del detalle.
- **L2–4** Etiqueta con la sección y la sala.
- **L5–7** Título que arma el controlador: `Reserva de <nombre>`.
- **L8** Línea en blanco.
- **L9** Lista con los datos.
- **L10–12** El identificador, dentro de `<code>` para que se vea con letra de código.

```html
        <li><strong>Estudiante:</strong>
            <%= reserva.estudiante %>
        </li>
        <li><strong>Email de contacto:</strong>
            <%= reserva.email %>
        </li>
        <li><strong>Sala asignada:</strong>
            <%= reserva.sala %>
        </li>
        <li><strong>Fecha:</strong>
            <%= reserva.fecha %>
        </li>
        <li><strong>Turno:</strong>
            <%= reserva.turno %>
        </li>
        <li><strong>Cantidad de personas:</strong>
            <%= reserva.personas %>
        </li>
        <li><strong>Estado:</strong>
            <%= reserva.estado %>
        </li>
    </ul>

    <a class="boton" href="/reservas">Volver a las reservas</a>
</article>
```

- **L13–33** Un `<li>` por campo, cada uno de tres líneas (rótulo, valor, cierre): estudiante, email, sala, fecha, turno, personas y estado. Como lee siempre de la base, después de un PUT o PATCH muestra los valores **actualizados**.
- **L34** Cierra la lista.
- **L35** Línea en blanco.
- **L36** Botón para volver al listado.
- **L37** Cierra el artículo.

### `views/reservas/nueva.ejs` · el formulario

```html
<section class="panel-formulario">
    <p class="etiqueta">
        <%= seccion %>
    </p>
    <h1>
        <%= titulo %>
    </h1>

    <% if (error) { %>
        <p class="error" role="alert">
            <%= error %>
        </p>
        <% } %>
```

- **L1** Abre el panel del formulario.
- **L2–4** Etiqueta de la sección.
- **L5–7** Título.
- **L8** Línea en blanco.
- **L9** Si hay un mensaje de error (cuando la validación falló)...
- **L10** ...lo muestra. `role="alert"` hace que los lectores de pantalla lo anuncien enseguida.
- **L11–12** El mensaje.
- **L13** Cierra el `if`.
- **L14** Línea en blanco.

```html
            <form action="/reservas" method="post" class="formulario">
                <label for="estudiante">Nombre del estudiante</label>
                <input id="estudiante" name="estudiante" value="<%= valores.estudiante ?? '' %>" required>

                <label for="email">Correo electrónico</label>
                <input id="email" name="email" type="email" value="<%= valores.email ?? '' %>" required>
```

- **L15** El formulario envía los datos a `POST /reservas`. El navegador los manda como `application/x-www-form-urlencoded`, que lee `express.urlencoded`.
- **L16** Rótulo del campo. `for="estudiante"` lo une con el `input` de `id="estudiante"`: al hacer clic en el texto se activa el campo.
- **L17** Campo de texto. `name="estudiante"` es la **clave** con la que llega en `req.body`. `value` muestra lo que se había escrito si el formulario volvió con error (o `''` la primera vez). `required` hace que el navegador no deje enviarlo vacío.
- **L18** Línea en blanco.
- **L19** Rótulo del email.
- **L20** `type="email"`: el navegador revisa que tenga formato de correo.

```html
                <label for="sala">Sala de estudio</label>
                <select id="sala" name="sala" required>
                    <option value="">Seleccione una sala</option>
                    <% salasPermitidas.forEach((s)=> { %>
                        <option value="<%= s %>" <%=valores.sala===s ? 'selected' : '' %>><%= s %>
                        </option>
                        <% }) %>
                </select>
```

- **L21** Línea en blanco.
- **L22** Rótulo de la sala.
- **L23** Lista desplegable obligatoria.
- **L24** Primera opción con valor vacío: obliga a elegir una sala de verdad.
- **L25** Recorre `salasPermitidas` (viene del modelo a través de `res.locals`).
- **L26** Una opción por sala. Si coincide con la que se había elegido, imprime `selected` para dejarla marcada.
- **L27** Cierra la opción.
- **L28** Cierra el `forEach`.
- **L29** Cierra la lista.

```html
                <label for="fecha">Fecha</label>
                <input id="fecha" name="fecha" type="date" value="<%= valores.fecha ?? '' %>" required>

                <label for="turno">Turno</label>
                <select id="turno" name="turno" required>
                    <option value="">Seleccione un turno</option>
                    <% turnosPermitidos.forEach((t)=> { %>
                        <option value="<%= t %>" <%=valores.turno===t ? 'selected' : '' %>><%= t %>
                        </option>
                        <% }) %>
                </select>
```

- **L30** Línea en blanco.
- **L31** Rótulo de la fecha.
- **L32** `type="date"` muestra un calendario y envía la fecha como texto `AAAA-MM-DD`.
- **L33** Línea en blanco.
- **L34–41** El turno funciona igual que la sala, recorriendo `turnosPermitidos`.

```html
                <label for="personas">Cantidad de personas (1 a 6)</label>
                <input id="personas" name="personas" type="number" min="1" max="6" value="<%= valores.personas ?? '' %>"
                    required>

                <button type="submit">Confirmar Reserva</button>
            </form>
</section>
```

- **L42** Línea en blanco.
- **L43** Rótulo de personas.
- **L44–45** Campo numérico con `min="1"` y `max="6"`.
- **L46** Línea en blanco.
- **L47** Botón que envía el formulario.
- **L48–49** Cierran el formulario y la sección.

> Las validaciones del navegador (`required`, `type`, `min`, `max`) solo ayudan al usuario: **se pueden saltear** (con Postman o las herramientas del navegador). Por eso el servidor vuelve a validar todo en el middleware y en el esquema.

---

## 17. Scripts de terminal (`scripts/`)

**En una frase:** programas cortos que se ejecutan con `node` para probar cosas por separado: la conexión, crear y listar reservas, las reglas del modelo y cómo responde la app si la base falla.

Los tres primeros siguen el mismo patrón: **conectar → hacer una tarea → desconectar siempre**.

### `scripts/comprobar-conexion.js`

```js
const {
  conectarBaseDatos,
  desconectarBaseDatos,
} = require("../src/config/base-datos");

async function main() {
  try {
    await conectarBaseDatos();
    console.log("Conexión con MongoDB establecida.");
  } finally {
    await desconectarBaseDatos();
  }
}

main().catch((error) => {
  console.error("No se pudo completar la conexión:", error.name);
  if (error.name === "ErrorDeConfiguracion") {
    console.error(error.message);
  }
  console.error(
    "Revisar MONGODB_URI, clúster de Atlas, IP permitida y usuario.",
  );
  process.exitCode = 1;
});
```

- **L1–4** Trae las funciones de conexión. La ruta empieza con `../src/` porque el script está en otra carpeta.
- **L5** Línea en blanco.
- **L6** Función principal `async`.
- **L7** `try`: el bloque que puede fallar.
- **L8** Intenta conectar.
- **L9** Si conectó, lo avisa. No crea ni lee nada.
- **L10** `finally` se ejecuta **siempre**, haya salido bien o mal...
- **L11** ...y cierra la conexión, para que el script termine.
- **L12–13** Cierran el `finally` y `main`.
- **L14** Línea en blanco.
- **L15** Si `main` falló (el error sigue de largo después del `finally`), lo atrapa acá.
- **L16** Muestra solo el nombre del error.
- **L17–19** Si es de configuración, muestra el mensaje (es seguro).
- **L20–22** Lista de cosas para revisar.
- **L23** Marca la salida con error.
- **L24** Cierra el `.catch`.

### `scripts/crear-reserva.js`

```js
const {
  conectarBaseDatos,
  desconectarBaseDatos,
} = require("../src/config/base-datos");
const { Reserva } = require("../src/modelos/reserva");

async function main() {
  try {
    await conectarBaseDatos();
    const reserva = await Reserva.create({
      estudiante: "Lucas Gómez",
      email: "lucas@example.com",
      sala: "Sala Norte",
      fecha: "2026-10-26",
      turno: "Mañana",
      personas: 3,
    });
    console.log("Reserva guardada. _id:", reserva._id.toString());
  } finally {
    await desconectarBaseDatos();
  }
}
```

- **L1–4** Funciones de conexión (igual que el script anterior).
- **L5** Trae el modelo: este script usa `Reserva` directamente, sin pasar por el servicio ni por Express.
- **L6** Línea en blanco.
- **L7–9** `main`, `try` y conexión, como antes.
- **L10** `Reserva.create(...)` valida con el esquema e inserta un documento.
- **L11–16** Datos ficticios (email `@example.com`). Cada ejecución crea **una** reserva nueva.
- **L17** Cierra el objeto y la llamada.
- **L18** Muestra el `_id` que generó MongoDB, pasado a texto.
- **L19–22** `finally` con el cierre de la conexión, y fin de `main`.

```js
main().catch((error) => {
  console.error("No se pudo crear la reserva:", error.name);
  if (error.name === "ErrorDeConfiguracion") {
    console.error(error.message);
  }
  if (error.errors) {
    console.error("Campos a revisar:", Object.keys(error.errors).join(", "));
  }
  console.error("Revisar datos, configuración y disponibilidad de MongoDB.");
  process.exitCode = 1;
});
```

- **L23** Línea en blanco.
- **L24–28** Manejo del error, igual que antes.
- **L29** Si el error trae `errors` (es un `ValidationError`)...
- **L30** ...muestra los nombres de los campos inválidos, unidos con comas (`join(", ")`).
- **L31** Cierra el `if`.
- **L32** Sugerencia.
- **L33–34** Salida con error y cierre del `.catch`.

### `scripts/listar-reservas.js`

```js
const {
  conectarBaseDatos,
  desconectarBaseDatos,
} = require("../src/config/base-datos");
const { Reserva } = require("../src/modelos/reserva");

async function main() {
  try {
    await conectarBaseDatos();
    const reservas = await Reserva.find({});
    console.table(
      reservas.map((reserva) => ({
        id: reserva._id.toString(),
        estudiante: reserva.estudiante,
        sala: reserva.sala,
        fecha: reserva.fecha,
        turno: reserva.turno,
        personas: reserva.personas,
        estado: reserva.estado,
      })),
    );
    console.log("Total de reservas:", reservas.length);
  } finally {
    await desconectarBaseDatos();
  }
}
```

- **L1–9** Igual que `crear-reserva.js`: importaciones, `main`, `try` y conexión.
- **L10** `Reserva.find({})` trae **todos** los documentos (filtro vacío). Solo lee.
- **L11** `console.table` muestra un arreglo de objetos como tabla en la terminal.
- **L12** `map` arma, por cada reserva, un objeto con las columnas que se quieren ver. Los paréntesis alrededor de `{ ... }` indican que la función flecha **devuelve un objeto**.
- **L13** `id` pasado a texto.
- **L14–19** El resto de las columnas (sin el email).
- **L20–21** Cierran el `map` y `console.table`.
- **L22** Muestra la cantidad total.
- **L23–26** `finally` con el cierre y fin de `main`.
- **L27–35** El `.catch` con el mismo patrón que los anteriores.

### `scripts/validar-reserva.js`

**Valida el modelo sin conectarse a la base:** prueba casos buenos y malos y muestra cuáles acepta el esquema.

```js
const { Reserva } = require("../src/modelos/reserva");

const reservaValida = {
  estudiante: "Ana Ejemplo",
  email: "ana@example.com",
  sala: "Sala Norte",
  fecha: "2026-10-21",
  turno: "Mañana",
  personas: 2,
};
```

- **L1** Trae solo el modelo. No importa la conexión: no hace falta.
- **L2** Línea en blanco.
- **L3–10** Una reserva **válida** que sirve de base para todos los casos.
- **L11** Línea en blanco.

```js
const casos = [
  ["Reserva válida", {}],
  ["Personas como texto numérico", { personas: "4" }],
  ["Estudiante vacío", { estudiante: "   " }],
  ["Email sin @", { email: "ana.example.com" }],
  ["Sala no permitida", { sala: "Sala Este" }],
  ["Turno no permitido", { turno: "Madrugada" }],
  ["Fecha vacía", { fecha: "" }],
  ["Personas 0", { personas: 0 }],
  ["Personas 7", { personas: 7 }],
  ["Personas 2.5", { personas: 2.5 }],
  ['Personas "abc"', { personas: "abc" }],
  ["Estado no permitido", { estado: "cancelada" }],
];
```

- **L12** Arreglo de casos. Cada caso es un par `[nombre, cambios]`: qué campo se modifica respecto de la reserva válida.
- **L13** Sin cambios: debe aceptarse.
- **L14** `"4"` como texto: Mongoose lo convierte a número y se acepta.
- **L15** Solo espacios: `trim` lo deja vacío y `required` lo rechaza.
- **L16** Sin `@`: lo rechaza `match`.
- **L17** Sala fuera de la lista: lo rechaza `enum`.
- **L18** Turno fuera de la lista: `enum`.
- **L19** Fecha vacía: `required`.
- **L20** 0: lo rechaza `min`.
- **L21** 7: lo rechaza `max`.
- **L22** 2.5: lo rechaza el validador `Number.isInteger`.
- **L23** `"abc"`: no se puede convertir a número (error de conversión).
- **L24** Estado `cancelada`: `enum`.
- **L25** Cierra el arreglo.
- **L26** Línea en blanco.

```js
async function main() {
  for (const [nombre, cambios] of casos) {
    const reserva = new Reserva({ ...reservaValida, ...cambios });
    try {
      await reserva.validate();
      console.log(
        `${nombre}: aceptada (personas: ${reserva.personas}, estado: ${reserva.estado})`,
      );
    } catch (error) {
      if (!error.errors) throw error;
      console.log(
        `${nombre}: rechazada (${Object.keys(error.errors).join(", ")})`,
      );
    }
  }
}

main().catch((error) => {
  console.error("No se pudo completar la validación:", error.name);
  process.exitCode = 1;
});
```

- **L27** Función principal.
- **L28** Recorre los casos desestructurando cada par en `nombre` y `cambios`.
- **L29** Crea un documento **en memoria** (no lo guarda). `{ ...reservaValida, ...cambios }` copia la reserva válida y encima pisa los campos del caso.
- **L30** `try`.
- **L31** `reserva.validate()` ejecuta todas las reglas del esquema sin tocar la base.
- **L32–34** Si pasó, lo informa, mostrando `personas` (para ver que `"4"` quedó como `4`) y `estado` (para ver el valor por defecto `pendiente`).
- **L35** Si falló...
- **L36** ...y el error **no** es de validación (no tiene `errors`), es inesperado: se vuelve a lanzar.
- **L37–39** Si es de validación, muestra qué campos rechazó.
- **L40–42** Cierran el `catch`, el `for` y `main`.
- **L43** Línea en blanco.
- **L44–47** Manejo de un error inesperado.

### `scripts/simular-fallo-servicio.js`

**Simula que la base está caída** (sin tocar Atlas) para comprobar que la app responde 500 sin mostrar detalles internos. En este TP se le sumaron las tres operaciones nuevas.

```js
const { crearApp } = require("../src/app");

function crearServicioQueFalla() {
  async function fallar() {
    const error = new Error("Fallo simulado: base inaccesible");
    error.name = "MongoServerSelectionError";
    throw error;
  }

  return {
    listar: fallar,
    obtenerPorId: fallar,
    contar: fallar,
    crear: fallar,
    reemplazar: fallar,
    actualizar: fallar,
    eliminar: fallar,
  };
}
```

- **L1** Trae la fábrica de la app (la misma de siempre).
- **L2** Línea en blanco.
- **L3** Fábrica de un servicio **falso**.
- **L4** Una función `async` que siempre falla.
- **L5** Crea un error con un mensaje "interno" que **no** debería llegar nunca al cliente.
- **L6** Le pone el nombre del error real de MongoDB cuando no encuentra el servidor.
- **L7** Lo lanza. Como la función es `async`, esto devuelve una promesa rechazada, igual que una consulta fallida de verdad.
- **L8** Cierra la función.
- **L9** Línea en blanco.
- **L10–18** Devuelve un objeto con **los mismos siete nombres** que el servicio real, todos apuntando a `fallar`. Las tres últimas (`reemplazar`, `actualizar`, `eliminar`) son nuevas.
- **L19** Cierra la fábrica.
- **L20** Línea en blanco.

```js
const solicitudes = [
  { metodo: "GET", ruta: "/api/reservas" },
  { metodo: "GET", ruta: "/api/reservas/000000000000000000000000" },
  {
    metodo: "POST",
    ruta: "/api/reservas",
    cuerpo: { ... seis campos válidos ... },
  },
  {
    metodo: "PUT",
    ruta: "/api/reservas/000000000000000000000000",
    cuerpo: { ... siete campos válidos ... },
  },
  {
    metodo: "PATCH",
    ruta: "/api/reservas/000000000000000000000000",
    cuerpo: { personas: 3 },
  },
  { metodo: "DELETE", ruta: "/api/reservas/000000000000000000000000" },
  { metodo: "GET", ruta: "/estado" },
  { metodo: "GET", ruta: "/reservas" },
];
```

*(Los cuerpos están resumidos; en el archivo están completos en las líneas 27–34 y 39–47.)*

- **L21** Lista de solicitudes de prueba: método, dirección y cuerpo opcional.
- **L22** Listar por la API.
- **L23** Consultar un ID. `000...000` (24 ceros) tiene **formato válido**, así que con el servicio real no daría 400. Acá el servicio falso falla igual, que es lo que se quiere probar.
- **L24–35** POST con los seis campos válidos: pasa el middleware y llega al servicio, que falla.
- **L36–48** **[NUEVO]** PUT con los siete campos válidos, para que pase `validarCambioReserva` y llegue al servicio.
- **L49–53** **[NUEVO]** PATCH con `{ personas: 3 }`.
- **L54** **[NUEVO]** DELETE.
- **L55** `/estado` (JSON).
- **L56** `/reservas` (sitio HTML), para comprobar que el error se muestra como página.
- **L57** Cierra el arreglo.
- **L58** Línea en blanco.

```js
async function main() {
  const app = crearApp({
    servicioReservas: crearServicioQueFalla(),
    formatoRegistro: "tiny",
  });
  const servidor = app.listen(0);
  await new Promise((resolve, reject) => {
    servidor.once("listening", resolve);
    servidor.once("error", reject);
  });
  const { port } = servidor.address();
```

- **L59** Función principal.
- **L60–63** Crea la app **inyectándole el servicio falso**. Es la ventaja de la fábrica: la app es la misma, solo cambia la dependencia. `"tiny"` es el formato más corto de morgan.
- **L64** `listen(0)`: el puerto 0 le pide al sistema operativo un puerto libre cualquiera. No choca con el servidor real en el 3000.
- **L65** Convierte los eventos del servidor en una promesa para poder esperarla con `await`...
- **L66** ...se resuelve cuando el servidor está escuchando...
- **L67** ...o se rechaza si hubo un error.
- **L68** Cierra la promesa.
- **L69** Lee qué puerto le asignaron.
- **L70** Línea en blanco.

```js
  try {
    for (const { metodo, ruta, cuerpo } of solicitudes) {
      const respuesta = await fetch(`http://localhost:${port}${ruta}`, {
        method: metodo,
        headers: cuerpo ? { "Content-Type": "application/json" } : {},
        body: cuerpo ? JSON.stringify(cuerpo) : undefined,
      });
      const texto = await respuesta.text();
      const filtraDetalles =
        texto.includes("Fallo simulado") || texto.includes("    at ");
      console.log(
        `${metodo} ${ruta} -> ${respuesta.status} ${respuesta.headers.get("content-type")} | detalles internos: ${filtraDetalles ? "SÍ" : "no"}`,
      );
    }
  } finally {
    servidor.close();
  }
}

main().catch((error) => {
  console.error("No se pudo completar la simulación:", error.name);
  process.exitCode = 1;
});
```

- **L71** `try`.
- **L72** Recorre las solicitudes desestructurando cada objeto.
- **L73** `fetch` (incluido en Node) hace la solicitud HTTP a la app que se acaba de levantar.
- **L74** Método.
- **L75** Si hay cuerpo, avisa que es JSON con el encabezado `Content-Type`.
- **L76** Convierte el cuerpo a texto JSON con `JSON.stringify`, o no manda cuerpo.
- **L77** Cierra las opciones.
- **L78** Lee la respuesta como texto.
- **L79–80** Revisa si la respuesta **filtró** detalles internos: el mensaje del error o una línea de traza (las trazas tienen líneas que empiezan con `    at `).
- **L81–83** Muestra método, dirección, código, tipo de contenido y si filtró detalles. Lo esperado: `500` y `detalles internos: no` en todas.
- **L84** Cierra el `for`.
- **L85–86** `finally`: cierra el servidor siempre, para que el script termine.
- **L87–88** Cierran el `finally` y `main`.
- **L89** Línea en blanco.
- **L90–93** Manejo de un error inesperado de la simulación.

---

## 18. Archivos de apoyo

### `.env.example`

```env
PORT=3000
NODE_ENV=development
MONGODB_URI=mongodb+srv://USUARIO:CLAVE@HOST/reservas_salas_u9?retryWrites=true&w=majority
```

Es la **plantilla** del `.env` real: se copia como `.env` y se completan los datos. Este sí se sube al repositorio porque no tiene secretos.

- **L1** Puerto donde escucha el servidor.
- **L2** Entorno: `development` hace que morgan use el formato `dev`.
- **L3** URI de conexión. `USUARIO`, `CLAVE` y `HOST` son marcadores. `reservas_salas_u9` es el nombre de la base de este TP. `retryWrites=true` reintenta una escritura una vez si falla por un corte de red momentáneo; `w=majority` espera a que la mayoría de los servidores del clúster confirme la escritura.

### `.gitignore`

```
node_modules/
.env
```

- **L1** No sube `node_modules`: es pesado y se regenera con `npm install` o `npm ci`.
- **L2** No sube `.env`: tiene la contraseña real de la base.

### `eslint.config.js`

```js
const js = require("@eslint/js");

module.exports = [
  {
    files: ["src/**/*.js", "scripts/**/*.js"],
    ...js.configs.recommended,
    languageOptions: {
      sourceType: "commonjs",
      globals: {
        __dirname: "readonly",
        console: "readonly",
        fetch: "readonly",
        module: "readonly",
        process: "readonly",
        require: "readonly",
      },
    },
  },
];
```

- **L1** Trae las configuraciones oficiales de ESLint.
- **L2** Línea en blanco.
- **L3** Exporta un **arreglo** de configuraciones (formato "flat config" de ESLint).
- **L4** Abre la única configuración.
- **L5** A qué archivos se aplica: todos los `.js` de `src` y `scripts`, en cualquier subcarpeta (`**`).
- **L6** `...` copia dentro de este objeto las **reglas recomendadas**.
- **L7** Opciones del lenguaje.
- **L8** El código usa CommonJS (`require` / `module.exports`).
- **L9** Variables globales que existen en Node aunque no se declaren...
- **L10–15** ...`__dirname`, `console`, `fetch`, `module`, `process` y `require`. `"readonly"` significa que se pueden usar pero no reasignar. Sin esto, ESLint las marcaría como "no definidas".
- **L16–19** Cierran los objetos y el arreglo.

### `public/js/app.js`

```js
"use strict";
console.log("Modulo JS cliente cargado correctamente.");
```

- **L1** Activa el modo estricto de JavaScript, que convierte algunos descuidos en errores.
- **L2** Mensaje en la consola **del navegador** (no de Node), que confirma que los archivos estáticos se sirven bien.

> `public/css/estilos.css` y `public/img/sala.svg` son solo presentación (estilos e ícono); no tienen lógica.

### `src/servicios/reservas.js` · versión en memoria del TP 07 (no se usa)

Se conserva como referencia y **ningún archivo lo importa**. Sirve para comparar con el servicio de MongoDB.

```js
function crearServicioReservas(reservasIniciales) {
  const reservas = reservasIniciales.map((reserva) => ({ ...reserva }));

  function listar() {
    return [...reservas];
  }

  function buscarPorId(id) {
    return reservas.find((reserva) => reserva.id === id) ?? null;
  }

  function contar() {
    return reservas.length;
  }

  function crear(datosValidados) {
    const ultimoId = reservas.reduce(
      (mayorId, reserva) => Math.max(mayorId, reserva.id),
      0,
    );
    const nueva = { id: ultimoId + 1, ...datosValidados };
    reservas.push(nueva);
    return nueva;
  }

  return { listar, buscarPorId, contar, crear };
}

module.exports = { crearServicioReservas };
```

- **L1** Fábrica que recibía un arreglo inicial de reservas.
- **L2** Copia cada objeto con `{ ...reserva }` para no modificar el arreglo original.
- **L3** Línea en blanco.
- **L4–6** `listar` devuelve una **copia** del arreglo (`[...reservas]`), para que nadie de afuera lo modifique.
- **L7** Línea en blanco.
- **L8–10** `buscarPorId` usa `find`; como `find` devuelve `undefined` si no encuentra, `?? null` lo convierte en `null`.
- **L11** Línea en blanco.
- **L12–14** `contar` devuelve el largo del arreglo.
- **L15** Línea en blanco.
- **L16** `crear` agrega una reserva.
- **L17–20** `reduce` recorre el arreglo buscando el ID más alto (empieza en 0).
- **L21** La nueva reserva tiene ID = el mayor + 1 y los datos validados.
- **L22** La agrega al arreglo.
- **L23** La devuelve.
- **L24** Cierra la función.
- **L25** Línea en blanco.
- **L26** Devuelve el servicio.
- **L27** Cierra la fábrica.
- **L28** Línea en blanco.
- **L29** Exporta la fábrica.

**Para comparar en la exposición:** aquí las funciones son **sincrónicas** y los datos se pierden al reiniciar. En `reservas-mongo.js` son `async` porque cada operación viaja por la red hasta Atlas, y los datos **persisten** aunque se apague el servidor.

---

## 19. Preguntas probables en la exposición

**¿Qué diferencia hay entre PUT y PATCH?**
PUT **reemplaza** la reserva completa: exige los siete campos y, si falta uno, responde 400. PATCH **cambia solo algunos campos** (`personas` y/o `estado`) y conserva el resto. En el servicio, PUT usa `findOneAndReplace` y PATCH usa `findOneAndUpdate` con `$set`.

**¿Por qué DELETE responde 204 y no 200?**
204 significa "salió bien y no hay nada que devolver". La reserva ya no existe, así que la respuesta no lleva cuerpo (`res.status(204).end()`).

**¿Qué hacen `runValidators`, `returnDocument` y `upsert`?**
`runValidators: true` hace que el esquema valide también en las actualizaciones (por defecto Mongoose no lo hace). `returnDocument: "after"` devuelve el documento ya modificado. `upsert: false` evita que se cree un documento nuevo si el ID no existe: en ese caso se devuelve `null` y el controlador responde 404.

**¿Por qué se valida dos veces, en el middleware y en el esquema?**
El middleware rechaza rápido y con un mensaje claro antes de tocar la base. El esquema es la última barrera: protege los datos aunque alguien llame al servicio sin pasar por el middleware (por ejemplo, desde un script). Las reglas son las mismas en los dos niveles.

**¿Qué pasa con un ID mal formado y con uno que no existe?**
Mal formado (`abc`): `comprobarId` lanza `ID_INVALIDO` → **400**. Formato válido pero inexistente: el servicio devuelve `null` o `false` → el controlador responde **404**.

**¿Por qué los controladores no tienen `try/catch`?**
Porque Express 5 atrapa solo los errores de las funciones `async` y los manda al middleware de errores, que decide entre 400 y 500.

**¿Cómo se evita que el cliente cambie el `_id` o mande `$set`?**
El middleware solo acepta las claves de la lista del método (`CAMPOS_PUT` o `CAMPOS_PATCH`); cualquier otra (`_id`, `$set`, `$inc`) se rechaza con 400. Además, el servicio arma su propio objeto copiando solo los campos permitidos, y el `$set` lo escribe el servidor.

**¿Por qué `Object.hasOwn` y no `if (datos.personas)`?**
Porque importa si el campo **está presente**, no si su valor es "verdadero". Con `if`, un valor como `0` se ignoraría en silencio.

**¿Borrar es lo mismo que cambiar el estado?**
No. DELETE es un **borrado físico**: el documento desaparece, el GET da 404 y no se puede deshacer. Cambiar `estado` con PATCH modifica un dato y la reserva sigue existiendo con el mismo ID. Este TP no implementa borrado lógico.

**¿Por qué se conecta a MongoDB antes de `app.listen`?**
Para no aceptar solicitudes que no se podrían atender. Si la conexión falla, el servidor ni siquiera abre el puerto.

**¿Qué es `.lean()`?**
Hace que Mongoose devuelva objetos JavaScript simples en vez de documentos completos. Son más livianos y alcanzan cuando solo se leen datos.

**¿Para qué sirve `representarReserva`?**
Para que la API responda siempre con la misma forma: `id` como texto y los siete campos, sin exponer detalles internos de MongoDB como `_id` o `__v`.

**¿Por qué `/reservas/nueva` está antes que `/reservas/:id`?**
Porque Express prueba las rutas en orden. Si `/:id` estuviera primero, tomaría la palabra `nueva` como si fuera un ID.

**¿Qué es `res.locals`?**
Un objeto que dura lo que dura la solicitud. Lo que se guarda ahí (el identificador de solicitud, las listas de salas y turnos) lo pueden leer los middleware siguientes y todas las vistas.
