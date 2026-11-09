// =============================================================================
// ARCHIVO: src/middleware/errores.js · MANEJADOR DE ERRORES
// [NUEVO TP09: CastError y ENTRADA_INVALIDA ahora son errores 400]
// -----------------------------------------------------------------------------
// Es el destino de cualquier error. Si fue culpa del cliente (datos inválidos,
// ID mal formado, JSON roto) responde 400; si fue un fallo inesperado responde
// 500 con un mensaje genérico, sin trazas ni secretos. Responde en JSON para
// la API y con una página HTML para el sitio.
//
// TEORÍA
// - Un middleware de errores tiene CUATRO parámetros (error, req, res, next).
//   Express lo reconoce justamente por eso.
// - 400 Bad Request: la solicitud está mal (culpa del cliente).
//   500 Internal Server Error: algo falló en el servidor (culpa nuestra).
// - Seguridad: nunca se envía al cliente el mensaje interno ni la traza.
// =============================================================================

// Decide si la solicitud espera una respuesta JSON. La usan este archivo y app.js.
function esSolicitudJson(req) {
  // Devuelve true si se cumple CUALQUIERA de estas condiciones (una por línea):
  // la dirección es exactamente /api, empieza con /api/, o es /estado.
  return (
    req.path === "/api" ||
    req.path.startsWith("/api/") ||
    req.path === "/estado"
  );
  // Cierra la función.
}

// Fábrica: recibe qué vista y qué título usar si falla el formulario.
function crearManejadorErrores({ vistaFormulario, tituloFormulario }) {
  // Devuelve el manejador. Tiene 4 parámetros: por eso Express sabe que es de
  // errores, aunque next casi no se use.
  return function manejarErrores(error, req, res, next) {
    // Si ya se empezó a enviar la respuesta, no se puede mandar otra...
    if (res.headersSent) {
      // ...así que se delega al manejador por defecto de Express.
      return next(error);
      // Cierra el if.
    }

    // ¿Es un error de validación del esquema de Mongoose?
    const esValidacion = error.name === "ValidationError";
    // ¿El error lo causó el cliente? Es true si se da CUALQUIERA de estos casos
    // (uno por línea):
    //   - error de validación del esquema;
    //   - [NUEVO] CastError: un valor que no se puede convertir al tipo del
    //     esquema (por ejemplo personas: "abc" en una actualización);
    //   - [NUEVO] ENTRADA_INVALIDA: la actualización vacía del servicio;
    //   - ID_INVALIDO: ID con formato incorrecto;
    //   - FILTRO_INVALIDO: el parámetro sala mal enviado;
    //   - entity.parse.failed: JSON mal escrito (lo marca express.json()).
    const esEntrada =
      esValidacion ||
      error.name === "CastError" ||
      error.codigo === "ENTRADA_INVALIDA" ||
      error.codigo === "ID_INVALIDO" ||
      error.codigo === "FILTRO_INVALIDO" ||
      error.type === "entity.parse.failed";
    // Culpa del cliente → 400; si no → 500.
    const estado = esEntrada ? 400 : 500;

    // Mensaje genérico según el tipo de error (ternario en tres líneas). Es let
    // porque puede cambiar abajo. En el 500 NO se dice qué falló por dentro.
    let mensaje = esEntrada
      ? "Revisá los datos enviados."
      : "No se pudo completar la operación.";
    // Si fue un ID inválido...
    if (error.codigo === "ID_INVALIDO") {
      // ...un mensaje más preciso que explica el formato correcto.
      mensaje = "El identificador debe tener 24 caracteres hexadecimales.";
      // Cierra el if.
    }
    // Si fue el filtro de sala...
    if (error.codigo === "FILTRO_INVALIDO") {
      // ...otro mensaje preciso.
      mensaje = "El parámetro sala debe enviarse una sola vez y con texto.";
      // Cierra el if.
    }

    // Registra en la consola del servidor solo el identificador de solicitud y
    // el NOMBRE del error: no el mensaje ni la traza, que podrían tener la URI.
    console.error("Solicitud fallida:", res.locals.solicitudId, error.name);

    // Si es una solicitud de la API o de /estado...
    if (esSolicitudJson(req)) {
      // ...responde con el estado calculado (400 o 500) en JSON...
      return res.status(estado).json({
        // ...con el mensaje...
        error: mensaje,
        // ...y la lista de campos que fallaron. En un ValidationError,
        // error.errors es un objeto cuyas claves son los campos inválidos;
        // Object.keys las saca en un arreglo. Si no, lista vacía.
        campos: esValidacion ? Object.keys(error.errors) : [],
        // Cierra el objeto y la llamada a json.
      });
      // Cierra el if.
    }

    // Si es un error de validación al enviar el FORMULARIO (POST del sitio)...
    if (esValidacion && req.method === "POST") {
      // ...vuelve a mostrar el formulario con 400...
      return res.status(400).render(vistaFormulario, {
        // ...con su título...
        titulo: tituloFormulario,
        // ...el mensaje...
        error: mensaje,
        // ...y los valores enviados (o {} si no hay cuerpo).
        valores: req.body ?? {},
        // Cierra el objeto y la llamada a render.
      });
      // Cierra el if.
    }

    // Cualquier otro caso del sitio: página no-encontrado.ejs con el estado...
    return res.status(estado).render("no-encontrado", {
      // ...un título según el tipo de error...
      titulo: esEntrada ? "Solicitud inválida" : "Error del servicio",
      // ...el mensaje...
      mensaje,
      // ...y el código, que la vista muestra como "ERROR 400" o "ERROR 500".
      codigo: estado,
      // Cierra el objeto y la llamada a render.
    });
    // Cierra el manejador.
  };
  // Cierra la fábrica.
}

// Exporta la fábrica y esSolicitudJson.
module.exports = { crearManejadorErrores, esSolicitudJson };
