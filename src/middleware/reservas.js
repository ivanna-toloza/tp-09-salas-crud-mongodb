const { SALAS, TURNOS } = require("../modelos/reserva");

function prepararAreaReservas(req, res, next) {
  res.locals.seccion = "Reservas de salas";
  res.locals.salasPermitidas = SALAS;
  res.locals.turnosPermitidos = TURNOS;
  next();
}

function leerTexto(valor) {
  return typeof valor === "string" ? valor.trim() : "";
}

function leerPersonas(valor) {
  const tipoValido =
    typeof valor === "number" ||
    (typeof valor === "string" && valor.trim() !== "");
  return tipoValido ? Number(valor) : NaN;
}

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
