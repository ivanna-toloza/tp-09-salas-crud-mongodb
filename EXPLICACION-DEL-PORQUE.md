# Por qué se hizo así · TP 09 – CRUD de reservas con MongoDB

Esta guía explica el razonamiento del trabajo: qué problema había, qué decidimos y qué resuelve cada archivo. El detalle línea por línea está en los comentarios del código y en `EXPLICACION-LINEA-POR-LINEA.md`.

> Las razones salen del código y del README. No tuve acceso a tu PDF ni a la consigna: si alguna decisión la pidió el profesor, decilo así, porque "lo pedía la consigna" es una respuesta válida. Marqué con **(verificar con la consigna)** lo que es una deducción mía.

---

## 1. La idea en un minuto

Hicimos un sistema de reservas de salas de estudio. Hasta el TP 08 una reserva se podía crear y consultar, pero después quedaba fija: si cambiaba la cantidad de personas o había que eliminarla, no había forma de hacerlo. El TP 09 resuelve eso y completa el CRUD con tres operaciones: reemplazar una reserva (PUT), cambiar una parte (PATCH) y eliminarla (DELETE).

No tuvimos que rehacer el proyecto. Como ya estaba separado en capas, agregamos un validador nuevo y extendimos las rutas, el controlador y el servicio. El arranque, la configuración y las vistas quedaron como estaban.

Modificar y borrar es más delicado que crear, porque se puede dañar información que ya existe. Por eso pusimos el mayor cuidado en los casos que salen mal: un dato inválido no llega a guardarse, un ID inexistente da 404 y no crea nada, y si la base falla el cliente recibe un error genérico sin datos internos.

---

## 2. De dónde venimos

| TP | Qué se hizo | Qué problema dejaba resuelto |
| --- | --- | --- |
| TP 07 | Sitio Express con reservas en memoria y primer laboratorio con MongoDB | Empezar a guardar datos que no se pierdan al apagar el servidor |
| TP 08 | API JSON y sitio sobre MongoDB: crear, listar, filtrar y consultar | Otros programas ya podían crear y leer reservas |
| TP 09 | Reemplazar, cambiar y eliminar | Una reserva ya se puede corregir y retirar |

**Por qué una carpeta y una base nuevas.** Copiamos el TP 08 en vez de seguir sobre él para dejarlo intacto. La base `reservas_salas_u9` empezó vacía porque en este TP las pruebas modifican y borran: así ninguna prueba podía dañar los datos de los trabajos anteriores.

---

## 3. La decisión que ordena todo: separar en capas

Se podría haber escrito todo en un solo archivo: una ruta que lee el cuerpo, valida, consulta MongoDB y responde. Funcionaría, pero cada cambio tocaría todo y no se podría probar nada por separado. Por eso cada capa responde **una sola pregunta**:

| Capa | Pregunta que responde | En una oficina de reservas |
| --- | --- | --- |
| Router | ¿Quién atiende este método y esta dirección? | El cartel que indica a qué ventanilla ir |
| Middleware de validación | ¿Esta solicitud se puede aceptar? | Quien revisa el formulario antes de dejarte pasar |
| Controlador | ¿Qué le contesto al cliente? | El empleado de la ventanilla |
| Servicio | ¿Cómo se hace esto en la base? | El archivista, el único que toca los registros |
| Modelo | ¿Qué es una reserva válida? | El reglamento |
| Manejador de errores | ¿Qué hago si algo falló? | La mesa de reclamos |

Qué ganamos con esto:

- **Un cambio toca un solo lugar.** Si cambia una regla de negocio, se toca el modelo; si cambia la base, solo el servicio.
- **Cada parte se puede probar sola.** Probamos las reglas sin conectarnos a la base y simulamos una base caída sin tocar Atlas.
- **Los errores se resuelven una sola vez**, en un único archivo, en lugar de repetirse en cada ruta.

**La prueba de que sirvió** es lo que pasó al agregar tres operaciones nuevas:

| Cambió | No cambió |
| --- | --- |
| `middleware/cambios-reservas.js` (nuevo) | `index.js` y `app.js` |
| `rutas/reservas-api.js` (+3 rutas) | `config/` |
| `controladores/reservas.js` (+3 funciones) | `rutas/reservas.js` |
| `servicios/reservas-mongo.js` (+3 operaciones y la revisión del ID) | `middleware/reservas.js` y `solicitudes.js` |
| `middleware/errores.js` (+2 casos de error 400) | Las vistas (salvo el texto del pie) |
| `modelos/reserva.js` (solo exporta `ESTADOS`) | La creación y las consultas siguen respondiendo igual |

---

## 4. El flujo del trabajo

### 4.1 Cuando arranca el programa

El orden de `index.js` es una decisión, y cada paso depende del anterior:

1. **Lee la configuración.** Si falta algo, conviene enterarse antes de intentar nada.
2. **Se conecta a MongoDB.** Va antes de abrir el puerto para que el servidor nunca atienda solicitudes que no podría resolver.
3. **Crea el servicio** y se lo entrega a la app al crearla.
4. **Abre el puerto.** Recién acá la aplicación está disponible.
5. **Prepara el cierre.** Con Ctrl+C deja de aceptar solicitudes nuevas, termina las que están en curso y recién entonces cierra MongoDB, para no cortar una escritura a la mitad.

### 4.2 Cuando llega una solicitud: cambiar una reserva a 3 personas

1. Postman envía `PATCH /api/reservas/<id>` con `{ "personas": 3 }`.
2. Los middleware generales le asignan un número a la solicitud, empiezan a medir el tiempo y convierten el JSON en un objeto.
3. `app.js` ve el prefijo `/api/reservas` y la pasa al router de la API.
4. El router ve que es PATCH sobre un ID y define el recorrido: primero validar, después el controlador.
5. El validador comprueba que el cuerpo sea un objeto, que solo traiga campos permitidos y que 3 sea un entero entre 1 y 6. Si algo falla, responde 400 y la solicitud termina ahí.
6. El controlador le pide el cambio al servicio y espera.
7. El servicio revisa el formato del ID, arma el cambio y se lo envía a MongoDB en una sola operación.
8. El esquema vuelve a validar el dato antes de escribir.
9. MongoDB actualiza el documento y devuelve la versión nueva.
10. El servicio la convierte al formato público y el controlador responde 200.

### 4.3 Cada problema se detiene en un lugar distinto

Esta tabla resume el criterio del trabajo: frenar cada problema lo antes posible.

| Qué pasa | Dónde se detiene | Respuesta | ¿Se escribe algo? |
| --- | --- | --- | --- |
| JSON mal escrito | Lector de JSON de `app.js` | 400 | No |
| Campo no permitido, valor inválido o PUT incompleto | `cambios-reservas.js` | 400 | No |
| ID mal formado (`abc`) | Servicio, antes de consultar | 400 | No |
| ID válido que no existe | Servicio devuelve `null`; responde el controlador | 404 | No |
| Dato inválido que se saltea el middleware | Esquema, con `runValidators` | 400 | No |
| Ruta o método inexistente | 404 de `app.js` | 404 | No |
| La base falla | Manejador de errores | 500 sin detalles | No |

---

## 5. Archivo por archivo: por qué existe cada uno

### `src/index.js` · el arranque

- **Por qué existe:** alguien tiene que poner en marcha el programa y ocuparse de lo que depende del entorno real: la base, el puerto y las señales de apagado.
- **Qué soluciona:** un inicio en orden y un cierre que no deja solicitudes ni conexiones colgadas.
- **Por qué de esa manera:** está separado de `app.js` a propósito. Así la aplicación se puede crear sin base y sin puerto, que es lo que permite simular fallos.

### `src/app.js` · el armado

- **Por qué existe:** es el único lugar donde se ve cómo se conecta todo.
- **Qué soluciona:** el orden, que en Express cambia el comportamiento.
- **Por qué de esa manera:** primero lo que prepara la solicitud, después las rutas, luego el 404 (solo se llega si ninguna ruta respondió) y al final los errores. Recibe el servicio como parámetro en lugar de crearlo, para poder entregarle uno falso en las pruebas.

### `src/config/entorno.js` · las variables de entorno

- **Por qué existe:** la contraseña y la dirección de la base no pueden estar escritas en el código, así que llegan desde afuera y hay que revisarlas.
- **Qué soluciona:** sin este archivo, una variable faltante terminaría en un error confuso de MongoDB. Con él, el mensaje dice `Falta MONGODB_URI en el entorno.`
- **Por qué de esa manera:** el error propio tiene un nombre especial para saber que su mensaje se puede mostrar sin revelar secretos.

### `src/config/base-datos.js` · la conexión

- **Por qué existe:** conectarse y desconectarse hace falta en la app y en tres scripts.
- **Qué soluciona:** evita repetir ese código en cuatro lugares.
- **Por qué de esa manera:** espera 5 segundos en lugar de los 30 que usa por defecto, para enterarse rápido si hay un problema de red o de permisos.

### `src/modelos/reserva.js` · qué es una reserva

- **Por qué existe:** las reglas de una reserva tienen que estar definidas en un solo lugar.
- **Qué soluciona:** es la última barrera: aunque alguien se saltee las rutas, un dato inválido no se guarda.
- **Por qué de esa manera:** las listas de salas, turnos y estados se exportan desde acá. El esquema, los validadores y el formulario usan las mismas, y agregar una sala se hace en una sola línea. La fecha se guarda como texto porque el proyecto no hace cálculos con fechas.

### `src/servicios/reservas-mongo.js` · el trabajo con la base

- **Por qué existe:** una sola capa tiene que conocer MongoDB.
- **Qué soluciona:** si cambiara la base de datos, se reescribiría este archivo y el resto seguiría igual.
- **Por qué de esa manera:** no sabe nada de HTTP. Devuelve la reserva, `null` o `true`/`false`, y otro decide qué significa eso para el cliente. Además, convierte cada documento a un formato propio para que la API no exponga cómo se guardan los datos por dentro.

### `src/servicios/reservas.js` · la versión vieja

- **Por qué existe:** es el servicio en memoria del TP 07, guardado como referencia.
- **Qué soluciona:** hoy nada, porque ningún archivo lo usa. Sirve para comparar: acá los datos se perdían al reiniciar, y en MongoDB persisten.
- **Si te preguntan:** se podría borrar sin afectar la aplicación.

### `src/controladores/reservas.js` · la respuesta

- **Por qué existe:** alguien tiene que traducir entre el mundo HTTP y el servicio.
- **Qué soluciona:** concentra las decisiones sobre qué responder: 200, 201, 204, 404, una página o un JSON.
- **Por qué de esa manera:** el sitio y la API comparten el controlador y el servicio porque el trabajo es el mismo; solo cambia el formato de la respuesta.

### `src/rutas/reservas-api.js` y `src/rutas/reservas.js` · los mapas

- **Por qué existen:** para ver de un vistazo qué operaciones ofrece el sistema y por qué pasos pasa cada una.
- **Qué solucionan:** separan a dos tipos de cliente con necesidades distintas: programas que esperan JSON y personas que usan páginas.
- **Por qué de esa manera:** en el sitio, `/nueva` va antes que `/:id` porque Express prueba las rutas en orden, y si no tomaría la palabra `nueva` como un ID.

### `src/middleware/reservas.js` · validar la creación

- **Por qué existe:** una reserva inválida no debería llegar ni a intentar guardarse.
- **Qué soluciona:** rechaza los datos malos con un mensaje claro y, en el formulario, conserva lo que la persona ya había escrito.
- **Por qué de esa manera:** lo usan el sitio y la API para que las reglas sean las mismas. Copia solo los seis campos permitidos, y por eso toda reserva nace `pendiente` aunque el cliente mande otro estado.

### `src/middleware/cambios-reservas.js` · validar PUT y PATCH (nuevo)

- **Por qué existe:** modificar tiene reglas distintas que crear.
- **Qué soluciona:** impide cambios incompletos o con campos que el cliente no debe tocar, como el `_id`.
- **Por qué de esa manera:** es un archivo nuevo para no arriesgar la creación, que ya funcionaba. PUT y PATCH lo comparten porque las reglas de cada campo son las mismas; solo cambia qué campos se admiten.

### `src/middleware/errores.js` · cuando algo falla

- **Por qué existe:** los errores pueden aparecer en cualquier capa, y tratarlos en cada una sería repetir código.
- **Qué soluciona:** distingue los errores del cliente (400) de los fallos del servidor (500), y responde en JSON o en HTML según quién preguntó.
- **Por qué de esa manera:** nunca envía el mensaje interno ni la traza, y en la consola registra solo el número de solicitud y el nombre del error. Así no se filtra la dirección de la base ni la contraseña.

### `src/middleware/solicitudes.js` · saber qué pasó

- **Por qué existe:** cuando algo falla, hay que poder identificar qué solicitud fue.
- **Qué soluciona:** cada solicitud tiene un número que aparece en el registro de errores y en el pie de página, y se puede ver cuánto tardó.
- **Por qué de esa manera:** es un middleware general para no repetirlo en cada ruta.

### Vistas y archivos públicos (`views/`, `public/`)

| Archivo | Por qué existe |
| --- | --- |
| `layouts/main.ejs` | La estructura de todas las páginas se escribe una sola vez |
| `partials/encabezado.ejs` y `pie.ejs` | El menú y el pie se repiten en todas las páginas |
| `inicio.ejs` | Punto de entrada del sitio |
| `reservas/lista.ejs` | Ver todas las reservas |
| `reservas/detalle.ejs` | Ver una reserva; en este TP permite comprobar los cambios de PUT y PATCH |
| `reservas/nueva.ejs` | Crear una reserva sin usar Postman |
| `no-encontrado.ejs` | Una sola página para los errores 404, 400 y 500 |
| `public/` | Estilos, imagen y JavaScript que el navegador pide directamente |

**Por qué no hay pantallas para editar o borrar:** los formularios HTML solo envían GET y POST. Usar PUT, PATCH o DELETE desde el sitio habría requerido sumar `method-override` o JavaScript. Dejamos esas operaciones en la API, las probamos con Postman y comprobamos el resultado en las páginas que ya existían.

### Scripts de terminal (`scripts/`)

| Script | Qué pregunta responde | Por qué hace falta |
| --- | --- | --- |
| `comprobar-conexion.js` | ¿Llego a Atlas? | Separa un problema de red o permisos de un error de la app |
| `crear-reserva.js` | ¿Se guarda una reserva? | Prueba el modelo y la base sin Express |
| `listar-reservas.js` | ¿Qué hay guardado? | Permite ver los datos sin levantar el servidor |
| `validar-reserva.js` | ¿Las reglas funcionan? | Prueba el esquema sin conectarse a la base |
| `simular-fallo-servicio.js` | ¿Qué ve el cliente si la base se cae? | Prueba un fallo difícil de provocar en Atlas y confirma que no se filtran datos internos |

### Archivos de apoyo

| Archivo | Qué soluciona |
| --- | --- |
| `package.json` y `package-lock.json` | Cualquiera instala las mismas versiones y usa los mismos comandos |
| `.env` | Mantiene la contraseña fuera del código |
| `.env.example` | Indica qué hay que completar, sin revelar secretos |
| `.gitignore` | Evita subir la contraseña y las librerías instaladas |
| `eslint.config.js` y Prettier | Detectan errores probables y mantienen un formato uniforme |
| `postman/` | Permite repetir las mismas pruebas en orden |
| `evidencias/registro-pruebas.txt` | Demuestra lo observado: cada rechazo va seguido de una consulta que confirma que el dato no cambió |
| `README.md` | Explica cómo instalar, probar y qué resultados se obtuvieron |

---

## 6. Por qué lo hicimos de esa manera y no de otra

**¿Por qué PUT y PATCH por separado?**
Responden a dos necesidades. PUT es "esta es la reserva completa de ahora en adelante". PATCH es "cambiá solo esto". Sin PATCH, para cambiar la cantidad de personas el cliente tendría que reenviar los siete campos y arriesgarse a pisar alguno.

**¿Por qué PUT exige los siete campos en vez de completar los que faltan?**
Si el estado faltara y se completara con el valor por defecto, una reserva confirmada volvería a `pendiente` sin que nadie lo pidiera. Preferimos rechazar el pedido antes que cambiar datos que el cliente no mencionó.

**¿Por qué PATCH solo admite `personas` y `estado`?**
Son los datos que normalmente cambian en una reserva ya hecha. Cambiar la sala o la fecha es prácticamente otra reserva, y para eso está PUT. **(verificar con la consigna)**

**¿Por qué validar en el middleware y también en el esquema?**
Cumplen funciones distintas. El middleware rechaza temprano y dice qué campos fallaron. El esquema protege los datos aunque alguien use el servicio sin pasar por las rutas. Lo comprobamos llamando al servicio sin el middleware.

**¿Por qué POST ignora los campos de más, pero PUT y PATCH los rechazan?**
El comportamiento de POST venía del TP 08 y no quisimos cambiarlo. En una modificación, ignorar un campo en silencio engañaría al cliente: creería que cambió algo, como el `_id`, cuando no pasó nada.

**¿Por qué no pasar el cuerpo recibido directamente a MongoDB?**
Porque el cliente podría mandar operadores como `$inc` o cambiar el `_id`. Por eso el middleware usa una lista de campos permitidos y el `$set` lo arma el servidor.

**¿Por qué `findOneAndUpdate` y no buscar la reserva y después guardarla?**
Porque es una sola operación. Si leyéramos y guardáramos en dos pasos, otra solicitud podría cambiar la reserva en el medio. Además, devuelve directamente la versión nueva para responderle al cliente.

**¿Por qué PUT no crea la reserva si el ID no existe?**
HTTP lo permitiría, pero acá los ID los genera MongoDB, así que un ID que no existe es casi seguro un error del cliente. Por eso `upsert: false` y 404.

**¿Por qué distinguir 400 de 404?**
Le dicen cosas distintas al cliente. 400 significa "lo que mandaste está mal escrito". 404 significa "está bien escrito, pero esa reserva no existe".

**¿Por qué DELETE responde 204?**
La operación salió bien y ya no hay nada que devolver, porque el recurso no existe más.

**¿Por qué se mira cuántos documentos se borraron?**
Porque una consulta puede terminar sin error y no haber borrado nada. Sin mirar `deletedCount` responderíamos éxito cuando el ID no existía.

**¿Por qué borrar de verdad y no agregar un estado "cancelada"?**
`estado` solo indica si la reserva está pendiente o confirmada; no es una marca de borrado. Son dos acciones distintas: después de un PATCH la reserva sigue existiendo, y después de un DELETE no. El costo es que el borrado no se puede deshacer.

**¿Por qué el servicio devuelve `null` en lugar de responder 404?**
Porque 404 es un concepto de HTTP y el servicio no sabe quién lo llama. Devuelve "no lo encontré" y el controlador decide cómo decírselo al cliente.

**¿Por qué la app recibe el servicio como parámetro?**
Para poder entregarle otro. Gracias a eso, la simulación de fallos usa la misma aplicación real con un servicio que siempre falla, sin tocar Atlas.

**¿Por qué los controladores no tienen `try/catch`?**
Express 5 envía solo al manejador de errores lo que falla en una función asíncrona. Agregarlo en cada función asíncrona del controlador sería repetir lo mismo diez veces.

---

## 7. Lo que decidimos no hacer

Saber qué quedó afuera también muestra que entendimos el alcance.

| No se hizo | Consecuencia o motivo |
| --- | --- |
| Controlar calendario, disponibilidad o superposición de salas | Dos reservas pueden coincidir; confirmar una no comprueba nada de eso |
| Borrado lógico | Eliminar es definitivo |
| Vaciar toda la colección | DELETE borra una sola reserva, la del ID indicado |
| Formularios de edición | Ver sección 5, "Vistas y archivos públicos" |
| Paginación y orden | Quedan para la unidad 10 |
| Autenticación | Cualquiera que llegue al puerto podría modificar datos; por eso no se publica en Internet |

---

## 8. Detalles que pueden llamarte la atención

- **El proyecto se llama `tp-07-salas-mongodb` en `package.json`.** Se conservó el manifiesto al copiar desde los TP anteriores, sin agregar ni actualizar dependencias.
- **El prefijo `BIB-` de las solicitudes y el botón "Volver al catálogo".** No afectan el funcionamiento. Parecen restos de un ejercicio anterior sobre una biblioteca, pero en el proyecto no figura de dónde vienen: si lo sabés, tené la respuesta a mano.
- **Después de un PUT desaparece el campo interno `__v`.** Pasa porque el documento se reemplaza entero. La API nunca lo muestra, así que no cambia ninguna respuesta.
