// =============================================================================
// ARCHIVO: src/rutas/reservas-api.js · RUTAS DE LA API JSON   [NUEVO TP09]
// -----------------------------------------------------------------------------
// Mapa de la API: a cada método HTTP sobre /api/reservas le asigna su
// validación (si la necesita) y su función del controlador. En el TP09 se
// agregaron PUT, PATCH y DELETE: con eso el CRUD queda completo.
//
// TEORÍA
// - CRUD: Create (POST), Read (GET), Update (PUT/PATCH), Delete (DELETE).
// - PUT reemplaza el recurso completo; PATCH cambia solo algunos campos.
// - Parámetro de ruta: en "/:id", lo que vaya en esa posición de la dirección
//   queda disponible en req.params.id.
// - Cadena de middleware: router.post("/", a, b) ejecuta a y, si a llama a
//   next(), ejecuta b. Si a responde (por ejemplo 400), b nunca se ejecuta.
// =============================================================================

// Carga Express para usar express.Router().
const express = require("express");
// Validador de CREACIÓN (POST), el mismo que usa el formulario HTML.
const { validarReserva } = require("../middleware/reservas");
// [NUEVO] Validador de CAMBIOS (PUT y PATCH).
const { validarCambioReserva } = require("../middleware/cambios-reservas");

// Fábrica: recibe el controlador y devuelve el router configurado.
function crearRouterReservasApi(controlador) {
  // Crea el router. En app.js se monta en /api/reservas.
  const router = express.Router();

  // GET /api/reservas → arreglo de reservas (acepta el filtro ?sala=).
  router.get("/", controlador.listarApi);
  // GET /api/reservas/:id → una reserva, o 404 si no existe.
  router.get("/:id", controlador.obtenerApi);
  // POST /api/reservas → primero valida y, si está bien, crea (201).
  router.post("/", validarReserva, controlador.crearApi);
  // [NUEVO] PUT /api/reservas/:id → valida los 7 campos y reemplaza la reserva.
  router.put("/:id", validarCambioReserva, controlador.reemplazarApi);
  // [NUEVO] PATCH /api/reservas/:id → el mismo validador detecta el método y
  // solo admite personas y/o estado; después actualiza esos campos.
  router.patch("/:id", validarCambioReserva, controlador.actualizarApi);
  // [NUEVO] DELETE /api/reservas/:id → elimina (204). No tiene cuerpo que
  // validar; el formato del ID lo revisa el servicio.
  router.delete("/:id", controlador.eliminarApi);

  // Devuelve el router. Un método no definido (por ejemplo POST /:id) no
  // coincide con ninguna ruta y termina en el 404 JSON de app.js.
  return router;
  // Cierra la función.
}

// Exporta la fábrica.
module.exports = { crearRouterReservasApi };
