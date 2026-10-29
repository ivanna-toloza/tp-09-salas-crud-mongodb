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
