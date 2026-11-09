// =============================================================================
// ARCHIVO: src/rutas/reservas.js · RUTAS DEL SITIO HTML
// -----------------------------------------------------------------------------
// Mapa del sitio: listado, formulario, detalle y envío del formulario.
// No cambió en el TP09.
//
// TEORÍA
// - Express prueba las rutas EN ORDEN y usa la primera que coincide.
// - router.use(fn) sin ruta ejecuta fn en todas las rutas de este router.
// =============================================================================

// Carga Express.
const express = require("express");
// Importa el middleware que prepara datos para las vistas y el validador de
// creación (el mismo que usa la API). Cuatro líneas por el formato de Prettier.
const {
  prepararAreaReservas,
  validarReserva,
} = require("../middleware/reservas");

// Fábrica: recibe el controlador y devuelve el router.
function crearRouterReservas(controlador) {
  // Crea el router. En app.js se monta en /reservas.
  const router = express.Router();

  // Corre ANTES que cualquier ruta de este router: carga en res.locals la
  // sección y las listas de salas y turnos que usan las vistas.
  router.use(prepararAreaReservas);
  // GET /reservas → listado de reservas.
  router.get("/", controlador.listar);
  // GET /reservas/nueva → formulario. TIENE que ir antes que "/:id": si no,
  // Express tomaría la palabra "nueva" como si fuera un ID.
  router.get("/nueva", controlador.mostrarFormulario);
  // GET /reservas/:id → detalle de una reserva.
  router.get("/:id", controlador.mostrarDetalle);
  // POST /reservas (lo que envía el formulario) → validar → crear → redirigir.
  router.post("/", validarReserva, controlador.crear);

  // Devuelve el router.
  return router;
  // Cierra la función.
}

// Exporta la fábrica.
module.exports = { crearRouterReservas };
