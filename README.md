# Trabajo práctico 09 - Actualización y eliminación de reservas de salas

Laura Ivanna Toloza

## 1. Punto de partida

Esta carpeta, `tp-09-salas-crud-mongodb`, es una copia de la rama `main` del TP 08 (`tp-08-salas-http-mongodb`), que quedó intacto. La copia se hizo con `git archive main`, así que no trae `.git`, `node_modules` ni `.env`. Después se ejecutó `npm ci` con el mismo `package.json` y `package-lock.json`, sin agregar ni actualizar dependencias. Por eso el manifiesto conserva el nombre `tp-07-salas-mongodb`, igual que en el TP 08.

En el TP 08 la API creaba y leía reservas. En este TP se completa el **CRUD**: se agregan el **reemplazo completo (PUT)**, el **cambio parcial (PATCH)** y la **eliminación física (DELETE)** de una reserva por su ID. La creación, el listado simple, el detalle y el sitio HTML se conservan sin cambios de contrato. El sitio y la API siguen usando la misma base y el mismo servicio asíncrono.

## 2. Versiones

| Componente | Versión |
| --- | --- |
| Node.js | 22.13 o superior (probado con 24.11.1) |
| Express | 5.2.1 |
| Mongoose | 9.10.3 (exacta) |
| EJS / express-ejs-layouts / Morgan | 6.0.1 / 2.5.1 / 1.12.1 |
| ESLint / Prettier | 10.12.0 / 3.9.10 |

Se verifica con `npm ls express mongoose`. Se mantiene CommonJS.

## 3. Preparación de Atlas

1. Se reutiliza el mismo clúster **Atlas Free (M0)**, el mismo usuario de base de datos (con permiso de lectura y escritura, que no es la cuenta de Atlas) y la misma IP autorizada en **Network Access**. No se habilitó el acceso desde cualquier dirección.
2. La base de este TP es **`reservas_salas_u9`**, colección **`reservas`**. No se crea desde el panel: aparece al guardar la primera reserva. Empezó **vacía**: la copia de la carpeta no copia datos, y las bases de los TP anteriores (`reservas_salas_u7`, `reservas_salas_u8`) no se tocaron, no se migraron y no se borraron.
3. Las pruebas de PUT, PATCH y DELETE se hicieron solo sobre reservas ficticias creadas para este ejercicio en `reservas_salas_u9`.

## 4. Entorno y DNS

En `.env.example` solo cambió el nombre de la base. Copiarlo como `.env` y reemplazar `USUARIO`, `CLAVE` y `HOST` por los datos reales (codificar los caracteres reservados de la contraseña, por ejemplo `@` → `%40`):

```env
PORT=3000
NODE_ENV=development
MONGODB_URI=mongodb+srv://USUARIO:CLAVE@HOST/reservas_salas_u9?retryWrites=true&w=majority
```

`HOST` es un marcador: con la plantilla tal cual **no** se puede conectar. `.env` está en `.gitignore` y no se entrega.

**DNS:** no hizo falta ajustarlo, igual que en el TP 08. En la red usada, la resolución SRV de `mongodb+srv://` funcionó sin cambios (`node --env-file=.env scripts/comprobar-conexion.js` → `Conexión con MongoDB establecida.`). `src/config/base-datos.js` no se modificó. Si en otra red aparece `querySrv ECONNREFUSED`, la corrección acordada en clase es agregar en ese archivo, antes de conectar y una sola vez, `require("node:dns").setServers(["8.8.8.8", "1.1.1.1"])`, siempre que esos resolutores estén autorizados en la red.

## 5. Comandos

Desde la raíz del proyecto:

```bash
npm install                                          # o npm ci: respeta el lockfile
node --env-file=.env scripts/comprobar-conexion.js   # conecta y cierra; no crea nada

node --env-file=.env src/index.js                    # inicia el sitio y la API
npm run start:local                                  # equivalente (carga .env)

npm run format                                       # Prettier sobre src y scripts
npm run check                                        # format:check + ESLint
```

Para detener el servidor: **Ctrl+C**. Deja de aceptar conexiones, espera las solicitudes activas y recién entonces cierra MongoDB (`Cerrando el servidor...` → `Conexión con MongoDB cerrada.`).

Scripts de terminal (abren la conexión, hacen una tarea y la cierran):

```bash
node --env-file=.env scripts/listar-reservas.js      # solo lee
node --env-file=.env scripts/crear-reserva.js        # crea UNA reserva por ejecución
node scripts/validar-reserva.js                      # valida el modelo sin conectar
node scripts/simular-fallo-servicio.js               # simula una base caída (sin conectar)
```

## 6. Estructura por capas

```
tp-09-salas-crud-mongodb/
  src/
    index.js                    (sin cambios) conecta antes de escuchar; cierre ordenado
    app.js                      (sin cambios) middleware, rutas HTML y API, 404 y errores
    config/                     (sin cambios) entorno y conexión
    modelos/reserva.js          mismas reglas; ahora también exporta ESTADOS
    servicios/
      reservas-mongo.js         + comprobarId, reemplazar, actualizar, eliminar
      reservas.js               referencia en memoria del TP 07, no se importa
    controladores/reservas.js   + reemplazarApi, actualizarApi, eliminarApi
    rutas/
      reservas.js               (sin cambios) router HTML
      reservas-api.js           + PUT, PATCH y DELETE sobre /:id
    middleware/
      cambios-reservas.js       NUEVO: valida y prepara el cuerpo de PUT y PATCH
      reservas.js               (sin cambios) valida la creación (POST y formulario)
      errores.js                reconoce también CastError y ENTRADA_INVALIDA como 400
      solicitudes.js            (sin cambios)
  scripts/simular-fallo-servicio.js   el servicio falso suma las tres operaciones nuevas
  postman/                      colección del TP 09
  evidencias/                   registro de las pruebas (registro-pruebas.txt)
  views/  public/               sin cambios (salvo el pie: "TP09 CRUD con MongoDB")
```

Recorrido de un PATCH:

```
PATCH /api/reservas/:id
  → rutas/reservas-api.js        reconoce el método y el :id
  → middleware/cambios-reservas  revisa el cuerpo; si está mal, 400 y se corta acá
  → controladores/reservas.js    actualizarApi: llama al servicio y decide 200 o 404
  → servicios/reservas-mongo.js  actualizar: arma $set y escribe con findOneAndUpdate
  → modelos/reserva.js           runValidators: el esquema vuelve a validar
```

| Capa | Responsabilidad |
| --- | --- |
| Modelo | Valida y persiste. Con `runValidators: true`, también valida en las actualizaciones. |
| Servicio | Arma el reemplazo o el `$set` con listas de campos admitidos y devuelve un objeto, `null` o un booleano. No conoce Express ni HTTP. |
| Middleware | Decide si la entrada HTTP es aceptable antes de llegar al controlador. Deja los datos limpios en `req.cambiosValidos`. |
| Controlador | Espera al servicio y decide la respuesta: 200 con la reserva, 204 sin cuerpo o 404. |
| Router | Asocia cada método con su validación y su controlador. |
| Manejador de errores | Entrada inválida → 400; fallo inesperado → 500 sin detalles internos. |

## 7. Reglas de validación

### Campos

| Campo | Regla (middleware y esquema) |
| --- | --- |
| `estudiante` | Texto obligatorio, `trim` |
| `email` | Texto obligatorio, `trim`, debe contener `@` |
| `sala` | `Sala Norte`, `Sala Sur` o `Sala Multimedia` |
| `fecha` | Texto obligatorio, `trim` |
| `turno` | `Mañana`, `Tarde` o `Noche` |
| `personas` | Número entero entre 1 y 6 |
| `estado` | `pendiente` o `confirmada`; `default: "pendiente"` al crear |

### Qué admite cada método

| Método | Cuerpo admitido |
| --- | --- |
| `POST` (sin cambios) | Los **seis** campos originales. `estado` y `_id` enviados por el cliente **se ignoran**: el middleware y el servicio copian solo los seis campos, así que la reserva nace siempre `pendiente` y con el `_id` que genera MongoDB. |
| `PUT` | Los **siete** campos editables, incluido `estado`. Si falta uno, 400: el rechazo **no** se completa con un default. |
| `PATCH` | Solo `personas` y/o `estado`, con al menos uno presente. |

### Qué rechaza `middleware/cambios-reservas.js` (400 JSON, sin llegar a la base)

- Cuerpo ausente (`Body none`), cuerpo que no es objeto (`text/plain` deja `req.body` en `undefined`), arreglos y objetos vacíos.
- Campos desconocidos, `_id` y operadores enviados por el cliente (`$set`, `$inc`...): cualquier clave fuera de la lista del método.
- En PUT, la ausencia de cualquiera de los siete campos.
- `personas`: se acepta solo un número o un texto numérico no vacío (`"4"`). Después se convierte con `Number` y se comprueban **finitud** (`Number.isFinite`, rechaza `1e999`, que al leer el JSON es `Infinity`), **integridad** (`Number.isInteger`, rechaza `2.5`) y **rango** (1 a 6). `true`, `[3]`, `{...}` y `""` se rechazan aunque `Number()` pudiera convertirlos.
- `estado`, `sala` y `turno`: tienen que ser texto y estar en su lista. `"false"` o `true` no son estados.

La respuesta es `{ "error": "Revisá los campos de la actualización.", "campos": [...] }`, con la lista de campos rechazados (vacía si el problema es el cuerpo entero). Si el middleware rechaza, no llama a `next()`: el controlador y la base ni se enteran.

### Dos niveles compatibles

El servicio no confía en quien lo llama: vuelve a copiar solo los campos admitidos y escribe con `runValidators: true`, de modo que el esquema valida también el reemplazo y el `$set`. Se comprobó llamando al servicio **sin** el middleware (registro, sección L): `personas 9` y `2.5`, `estado "cancelada"` y `sala "Sala Este"` → `ValidationError`; `personas "abc"` → `CastError`; un `$set` sin campos permitidos → error `ENTRADA_INVALIDA`. Las reglas del middleware y las del esquema son las mismas, así que nunca uno acepta lo que el otro rechaza.

No se agregan validaciones de calendario, disponibilidad de sala, solapamiento, cupo compartido ni unicidad. Cambiar `estado` a `confirmada` es una **decisión explícita** del cliente: no comprueba ninguna de esas condiciones.

## 8. Contrato HTTP

### API JSON

| Método y dirección | Resultado |
| --- | --- |
| `POST /api/reservas` | 201, la reserva y `Location: /api/reservas/<id>`; `estado: "pendiente"` |
| `GET /api/reservas` | 200 y **arreglo** de reservas (igual que en el TP 08, sin metadatos; acepta `?sala=`) |
| `GET /api/reservas/:id` | 200 y la reserva, o 404 |
| `PUT /api/reservas/:id` | 200 y la reserva reemplazada, con el **mismo ID** |
| `PATCH /api/reservas/:id` | 200 y la reserva con los cambios; los campos omitidos se conservan |
| `DELETE /api/reservas/:id` | **204 sin cuerpo** si eliminó un documento |
| ID mal formado (en cualquier método) | 400 JSON `{"error":"El identificador debe tener 24 caracteres hexadecimales.","campos":[]}` |
| ID válido ausente al consultar, modificar o borrar | 404 JSON `{"error":"Reserva no encontrada."}` |
| Entrada inválida o JSON mal formado | 400 JSON, sin modificación |
| Ruta API inexistente (incluye métodos no definidos, como `POST /api/reservas/:id`) | 404 JSON `{"error":"Ruta no encontrada."}` |
| Fallo inesperado | 500 JSON `{"error":"No se pudo completar la operación."}`, sin traza ni secretos |

Cómo lo resuelve el servicio:

- **PUT → `reemplazar(id, datos)`**: arma un objeto nuevo con los siete campos (nunca `_id`) y usa `Reserva.findOneAndReplace({ _id: id }, reemplazo, { runValidators: true, returnDocument: "after", upsert: false })`.
- **PATCH → `actualizar(id, datos)`**: parte de `{}` y copia solo `personas` y `estado` si están presentes (`Object.hasOwn`, así un valor como `false` o `0` no se pierde por ser "falso"). Si no queda ningún cambio, lanza `ENTRADA_INVALIDA`. Escribe con `Reserva.findOneAndUpdate({ _id: id }, { $set: cambios }, { ...mismas opciones })`. `$set` lo escribe el servidor: el cliente nunca manda operadores.
- **DELETE → `eliminar(id)`**: `Reserva.deleteOne({ _id: id })` y devuelve `resultado.deletedCount === 1`. Que la consulta termine sin error no significa que haya borrado algo.
- Las tres llaman antes a `comprobarId(id)` (la misma comprobación que ya usaba `obtenerPorId`).

Las opciones, de una en una:

- `runValidators: true`: el esquema valida también en las actualizaciones (por defecto Mongoose no lo hace). En PATCH valida los campos del `$set`.
- `returnDocument: "after"`: devuelve el documento **después** del cambio, para responder con los valores nuevos y no con los viejos.
- `upsert: false`: si no hay coincidencia, **no** inserta. Actualizar un ID ausente no crea nada: el servicio devuelve `null` y el controlador responde 404.

### Sitio HTML (sin cambios)

| Dirección | Resultado |
| --- | --- |
| `GET /` | Inicio |
| `GET /reservas` | Listado desde MongoDB (arreglo) |
| `GET /reservas/nueva` | Formulario |
| `POST /reservas` | Válido: 302 a `/reservas`. Inválido: 400 y conserva los valores |
| `GET /reservas/:id` | Detalle (id, personas y estado actuales); ID mal formado 400, inexistente 404 |
| `GET /estado` | JSON `{ servicio, reservas, solicitudId }`; `reservas` es `countDocuments()` en MongoDB |

No se agregaron formularios de edición ni `method-override`: las operaciones nuevas se prueban con Postman y sus resultados se ven en las páginas existentes (el detalle muestra el estado y las personas actualizados; una reserva eliminada desaparece del listado y su detalle da 404).

### JSON de ejemplo (datos ficticios, IDs observados en las pruebas)

`PUT /api/reservas/6ae3d0342e7f273418e9de1c`:

```json
{
  "estudiante": "Ana Ejemplo",
  "email": "ana@example.com",
  "sala": "Sala Norte",
  "fecha": "2026-10-28",
  "turno": "Mañana",
  "personas": 2,
  "estado": "confirmada"
}
```

Respuesta `200`:

```json
{
  "id": "6ae3d0342e7f273418e9de1c",
  "estudiante": "Ana Ejemplo",
  "email": "ana@example.com",
  "sala": "Sala Norte",
  "fecha": "2026-10-28",
  "turno": "Mañana",
  "personas": 2,
  "estado": "confirmada"
}
```

`PATCH` con `{ "personas": 3 }` → `200` con `"personas": 3` y `"estado": "confirmada"` conservado.

`PUT` sin `estado` → `400`:

```json
{ "error": "Revisá los campos de la actualización.", "campos": ["estado"] }
```

`DELETE` → `204 No Content`, sin cuerpo (0 bytes).

## 9. Criterio de borrado: eliminar no es cambiar el estado

| | `PATCH { "estado": "pendiente" }` | `DELETE /api/reservas/:id` |
| --- | --- | --- |
| Qué hace | Cambia un dato de la reserva | Retira el documento de la colección (**borrado físico**) |
| El documento | Sigue existiendo, con el mismo ID | Ya no existe |
| GET posterior | 200 con el estado nuevo | 404 |
| ¿Se puede deshacer? | Sí, con otro PATCH | No: un POST nuevo crea **otro** ID |
| Listado y `/estado` | La cantidad no cambia | La cantidad baja en uno |

`estado` solo dice si la reserva está pendiente o confirmada; no es una marca de borrado. Este TP **no** implementa borrado lógico (conservar el documento marcado como eliminado y ocultarlo), ni una ruta para vaciar la colección: `DELETE` borra **un solo** documento, el del ID de la dirección.

## 10. Errores

- Los controladores son `async` y **esperan** cada operación del servicio. Con Express 5, un rechazo de esa promesa llega solo al middleware de errores.
- `src/middleware/errores.js` clasifica como **400**: `ValidationError` de Mongoose, `CastError` (un valor que no se puede convertir al tipo del esquema), los códigos propios `ID_INVALIDO`, `FILTRO_INVALIDO` y `ENTRADA_INVALIDA` (actualización vacía), y el JSON mal formado (`entity.parse.failed`). Cualquier otro error es **500** con mensaje genérico.
- En consola se registra solo el id de solicitud y el nombre del error, sin URI, contraseñas ni trazas.

**Simulación de un fallo inesperado:** `node scripts/simular-fallo-servicio.js` crea la app con un servicio cuyas siete operaciones fallan como si la base estuviera caída, sin tocar Atlas. Salida obtenida:

```
GET /api/reservas -> 500 application/json; charset=utf-8 | detalles internos: no
GET /api/reservas/000000000000000000000000 -> 500 application/json; charset=utf-8 | detalles internos: no
POST /api/reservas -> 500 application/json; charset=utf-8 | detalles internos: no
PUT /api/reservas/000000000000000000000000 -> 500 application/json; charset=utf-8 | detalles internos: no
PATCH /api/reservas/000000000000000000000000 -> 500 application/json; charset=utf-8 | detalles internos: no
DELETE /api/reservas/000000000000000000000000 -> 500 application/json; charset=utf-8 | detalles internos: no
GET /estado -> 500 application/json; charset=utf-8 | detalles internos: no
GET /reservas -> 500 text/html; charset=utf-8 | detalles internos: no
```

## 11. Pruebas con Postman

Iniciar el servidor con `node --env-file=.env src/index.js` y dejarlo corriendo. En GET y DELETE, **Body: none**. En POST, PUT y PATCH, **Body → raw → JSON** y comprobar `Content-Type: application/json` en los Headers de la solicitud.

Opcional: importar `postman/tp-09-reservas.postman_collection.json` (**File → Import**). Trae 35 solicitudes en orden, la variable `baseUrl` (`http://localhost:3000`) y dos variables que se completan solas: `idReserva` (la guarda el POST de la carpeta 1) e `idEliminar` (la guarda el POST de la carpeta 5). Enviar **de a una** con **Send**; no usar el Runner, porque hay escrituras y una eliminación.

| # | Método | URL | Body | Respuesta esperada |
| --- | --- | --- | --- | --- |
| 1 | GET | `/api/reservas` | none | 200 y arreglo. Anotar la cantidad |
| 2 | POST | `/api/reservas` | raw JSON: los seis campos (§8) | 201, `estado: "pendiente"`, `Location` en los **Headers de la respuesta**. Copiar el `id` |
| 3 | GET | `/api/reservas/ID_RECIBIDO` | none | 200, mismo recurso |
| 4 | PUT | `/api/reservas/ID_RECIBIDO` | los seis campos + `"estado": "confirmada"` | 200, mismo ID y los siete valores |
| 5 | PATCH | igual | `{ "personas": 3 }` | 200, personas 3; estado y el resto conservados |
| 6 | PATCH | igual | `{ "estado": "pendiente" }` | 200, personas 3 conservado |
| 7 | PUT | igual | los seis campos, **sin** estado | 400 `campos: ["estado"]`; repetir el GET 3: sin cambios |
| 8 | PATCH | igual | `{}`, `{"estudiante":"Otro"}`, `{"_id":"..."}`, `{"$set":{"personas":1}}` (de a uno) | 400 cada uno, sin cambios |
| 9 | PATCH | igual | `personas` 0, 7, 2.5, true, `[3]`, `{...}` (de a uno) | 400 cada uno, sin cambios |
| 10 | PATCH | igual | `{ "estado": "cancelada" }` | 400, sin cambios |
| 11 | PATCH | igual | none, o `{"personas": }` (mal formado) | 400 JSON |
| 12 | PATCH | `/api/reservas/abc` | `{ "personas": 3 }` | 400 |
| 13 | PUT | `/api/reservas/000000000000000000000000` | siete campos válidos | 404; el listado no aumenta |
| 14 | POST | `/api/reservas` | otra reserva ficticia, para eliminar | 201. Copiar su `id` y verificarlo con GET |
| 15 | DELETE | `/api/reservas/ID_A_ELIMINAR` | none | **204** y cuerpo vacío |
| 16 | GET / DELETE | `/api/reservas/ID_A_ELIMINAR` | none | 404 y 404 |
| 17 | GET | `/api/reservas` | none | Una reserva menos; la reserva del paso 2 sigue |
| 18 | GET | `/estado` | none | `reservas` igual a la cantidad del paso 17 |

En el navegador: `/reservas` y `/reservas/ID_RECIBIDO` muestran el estado y las personas actualizados; `/reservas/ID_A_ELIMINAR` da 404.

## 12. Matriz de resultados observados

Resultados observados el 29/10/2026 con el servidor local (`node --env-file=.env src/index.js`, puerto 3000) y la base `reservas_salas_u9`, que estaba **vacía** al comenzar. El registro completo está en [`evidencias/registro-pruebas.txt`](evidencias/registro-pruebas.txt): cada paso numerado muestra método, URL, `Content-Type`, cuerpo enviado, estado y respuesta. Cada rechazo de escritura va seguido de un **GET de control** del mismo ID (compara con el último estado válido) y de la **cantidad** del listado. Recursos usados: reserva de trabajo `6ae3d0342e7f273418e9de1c` (Ana Ejemplo) y reserva eliminada `6ae3d0342e7f273418e9de1d` (Carla Ejemplo).

| Caso | Esperado | Observado | Cantidad antes → después | Registro |
| --- | --- | --- | --- | --- |
| Listado inicial (base nueva) | 200, arreglo | 200, `[]` | 0 | paso 1 |
| POST válido | 201, Location, pendiente | 201, `Location: /api/reservas/6ae3d0342e7f273418e9de1c`, `estado: "pendiente"`; GET a Location 200 con el mismo recurso | 0 → 1 | pasos 2-3 |
| POST con `estado: "confirmada"` y `_id` del cliente | No los asigna | 201, `estado: "pendiente"`, `id` `…de1d` (no el `000…001` enviado) | 1 → 2 | pasos 4-5 |
| PUT completo | 200, mismo ID, siete campos | 200, mismo ID, `estado: "confirmada"`; el GET posterior coincide | 2 → 2 | pasos 6-8 |
| PATCH personas 3 | 200, omitidos conservados | 200, personas 3, `estado: "confirmada"` y los otros cinco campos conservados | 2 → 2 | paso 9 |
| PATCH estado pendiente | 200, omitidos conservados | 200, estado pendiente, personas 3 conservado | — | paso 10 |
| PATCH personas `"4"` (texto numérico) + estado | 200 | 200, `personas: 4` guardado como **número**, estado confirmada | — | pasos 11-12 |
| PUT incompleto (sin estado / sin fecha) | 400, recurso intacto | 400 `campos: ["estado"]` / `["fecha"]`; GET de control intacto | 2 → 2 | pasos 13-18 |
| PUT estado `"cancelada"` / sala `"Sala Este"` / email sin @ | 400 sin modificación | 400 `["estado"]` / `["sala"]` / `["email"]`; intacto | 2 → 2 | pasos 19-27 |
| PUT con `_id` extra | 400 sin modificación | 400 `["_id"]`; intacto | 2 → 2 | pasos 28-30 |
| PATCH vacío `{}` | 400 sin modificación | 400 `campos: []`; intacto | 2 → 2 | pasos 31-33 |
| PATCH campo extra (`estudiante`) / `_id` / `$set` | 400 sin modificación | 400 `["estudiante"]` / `["_id"]` / `["$set"]`; intacto | 2 → 2 | pasos 34-42 |
| personas 0, 7, 2.5, true, `[3]`, objeto | 400 sin modificación | 400 `["personas"]` en los seis casos; intacto | 2 → 2 | pasos 43-60 |
| personas `""` y `1e999` (Infinity) | 400 | 400 `["personas"]`; intacto | 2 → 2 | pasos 61-66 |
| estado `"cancelada"` / `true` | 400 sin modificación | 400 `["estado"]`; intacto | 2 → 2 | pasos 67-72 |
| Cuerpo arreglo | 400 | 400 JSON; intacto | 2 → 2 | pasos 73-75 |
| PATCH sin cuerpo (Body none) | 400 JSON | 400 JSON; intacto | 2 → 2 | pasos 76-78 |
| PATCH `text/plain` | 400 JSON | 400 JSON; intacto | 2 → 2 | pasos 79-81 |
| JSON mal formado `{"personas": }` | 400 JSON | 400 `{"error":"Revisá los datos enviados.","campos":[]}`, sin traza; intacto | 2 → 2 | pasos 82-84 |
| ID mal formado (`abc`) en PATCH, PUT, DELETE y GET | 400 | 400 JSON en los cuatro | — | pasos 85-88 |
| ID válido ausente en PUT / PATCH / DELETE / GET | 404 sin creación | 404 JSON en los cuatro | 2 → 2 | pasos 89-94 |
| GET del objetivo antes de borrar | 200 | 200 (Carla Ejemplo) | — | paso 95 |
| DELETE existente | 204 sin cuerpo; una menos | 204, cuerpo de 0 bytes, sin `Content-Type` | 2 → 1 | pasos 96-97, 101 |
| GET posterior / DELETE repetido / PATCH al eliminado | 404 | 404, 404 y 404 | — | pasos 98-100 |
| La otra reserva se conserva | Intacta | Ana Ejemplo intacta | — | paso 102 |
| Listado API | Arreglo, sin metadatos | 200, arreglo | 1 | paso 103 |
| Filtro `sala=Sala Norte` | Solo coincidencias | 200, 1 resultado | — | paso 104 |
| Ruta API inexistente / método no definido | 404 JSON | 404 `{"error":"Ruta no encontrada."}` en los dos | — | pasos 105-106 |
| Inicio, CSS y ruta inexistente | 200, 200 y 404 | 200, 200 y 404 HTML | — | pasos 107-109 |
| Listado HTML | Refleja la API | 200; muestra a Ana y **no** a Carla (eliminada) | — | paso 110 |
| Detalle HTML de la reserva modificada | Refleja PUT/PATCH | 200; muestra estado confirmada y 4 personas | — | paso 111 |
| Detalle HTML de la reserva eliminada | 404 | 404 HTML | — | paso 112 |
| Formulario válido | 302 | 302 a `/reservas`; aparece en el listado HTML | 1 → 2 | pasos 113-116 |
| Formulario inválido (9 personas) | 400, conserva valores | 400; el formulario vuelve con los valores enviados | 2 → 2 | pasos 117-118 |
| `/estado` | Cantidad real de MongoDB | 200 `{"servicio":"activo","reservas":2,...}`, igual a la API | 2 | paso 119 |
| Reiniciar después de actualizar y eliminar | Cambios persistidos | Ana igual que antes de apagar; Carla sigue en 404 | 2 y 2 | pasos 120-126 |
| Cierre ordenado (Ctrl+C) | Cierra servidor y MongoDB | `Cerrando el servidor...` → `Conexión con MongoDB cerrada.`, código 0 | — | sección J |
| Arranque sin `MONGODB_URI` | No abre el puerto | `ErrorDeConfiguracion` / `Falta MONGODB_URI en el entorno.`, código 1, sin `Aplicación disponible` | — | sección K |
| Colección en Atlas | Mismo `_id`, eliminada ausente | 2 documentos; `_id` de tipo `ObjectId` con los valores posteriores; `findOne` de Carla → `null` | 2 | sección L |
| Servicio sin middleware | El esquema rechaza | `ValidationError` (personas 9 y 2.5, estado, sala), `CastError` (personas "abc"), `ENTRADA_INVALIDA` | — | sección L |
| Fallo inesperado simulado | 500 sin secretos | 500 en las ocho rutas probadas; JSON en la API y `/estado`, HTML en el sitio; sin detalles internos | — | sección M |

## 13. Prueba de persistencia y reinicio

Pasos:

1. Actualizar una reserva (PUT y PATCH) y guardar su ID y sus valores.
2. Eliminar otra reserva de ejercicio y comprobar el 404.
3. Esperar el fin de las solicitudes, detener el servidor con Ctrl+C y volver a iniciarlo con el mismo comando y la misma base.
4. Sin repetir ninguna escritura, consultar los dos ID, el detalle HTML, el listado dos veces y `/estado`.

| Paso | Observado |
| --- | --- |
| Reserva actualizada | `6ae3d0342e7f273418e9de1c`: `personas: 4`, `estado: "confirmada"` (paso 120) |
| Reserva eliminada | `6ae3d0342e7f273418e9de1d`: 404 (paso 98) |
| Cantidad antes de apagar | 2: la reserva de trabajo y la del formulario (paso 118) |
| Cierre | `Cerrando el servidor...` → `Conexión con MongoDB cerrada.`, código 0 (sección J) |
| Reserva actualizada tras reiniciar | 200, exactamente los mismos valores (paso 121) |
| Reserva eliminada tras reiniciar | 404: sigue ausente; no se recreó (paso 122) |
| Detalle HTML tras reiniciar | 200 (paso 123) |
| Cantidad tras reiniciar (dos veces) | 2 y 2 (pasos 124-125); `/estado` → 2 (paso 126) |
| Colección en Atlas | `ObjectId("6ae3d0342e7f273418e9de1c")` con `personas: 4` y `estado: "confirmada"`; el `_id` eliminado no existe (sección L) |

Detalle observado: después de un PUT, el documento guardado no tiene el campo interno `__v`, porque `findOneAndReplace` reemplaza el documento completo (salvo el `_id`) por el objeto que arma el servicio. La API nunca expone `__v`, así que no cambia ninguna respuesta.

## 14. Comparación con el TP 08

| Aspecto | TP 08 | TP 09 |
| --- | --- | --- |
| Operaciones de la API | Crear, listar, filtrar, consultar | + reemplazar (PUT), cambiar (PATCH), eliminar (DELETE) |
| Base | `reservas_salas_u8` | `reservas_salas_u9` (vacía al empezar) |
| Estado | Siempre `pendiente`; el cliente no lo puede cambiar | Nace `pendiente`; se confirma con PUT o PATCH por decisión explícita |
| Validación | Un middleware para la creación | + un middleware para PUT/PATCH; el de creación no cambia |
| Esquema en escrituras | Solo al crear (`create`) | También al actualizar (`runValidators: true`) |
| Respuestas nuevas | — | 204 sin cuerpo; 404 al modificar o borrar un ID ausente |
| Listado | Arreglo | Arreglo (sin cambios, sin metadatos) |
| Errores 400 | ValidationError, ID, filtro, JSON | + CastError y ENTRADA_INVALIDA |

## 15. Datos sensibles

El repositorio no incluye `.env`, contraseñas, la URI real, `node_modules` ni datos personales reales: `.env` y `node_modules/` están en `.gitignore`, `.env.example` solo tiene marcadores y las reservas de prueba usan datos ficticios (`@example.com`). El registro de pruebas no contiene la URI ni credenciales. Este servidor es un ejercicio de aprendizaje: no tiene autenticación ni autorización (cualquiera que llegue al puerto podría modificar o borrar reservas), por lo que no se publica en Internet. Las consultas avanzadas (paginación, orden) quedan para la unidad 10.
