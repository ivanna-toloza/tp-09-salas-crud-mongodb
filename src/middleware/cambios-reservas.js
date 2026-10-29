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

  if (typeof valor !== "string") return undefined;
  const texto = valor.trim();

  if (campo === "sala") return SALAS.includes(texto) ? texto : undefined;
  if (campo === "turno") return TURNOS.includes(texto) ? texto : undefined;
  if (campo === "estado") return ESTADOS.includes(texto) ? texto : undefined;
  if (campo === "email") return texto.includes("@") ? texto : undefined;
  return texto || undefined;
}

function validarCambioReserva(req, res, next) {
  const cuerpo = req.body;
  const rechazar = (campos) =>
    res
      .status(400)
      .json({ error: "Revisá los campos de la actualización.", campos });

  if (!cuerpo || typeof cuerpo !== "object" || Array.isArray(cuerpo)) {
    return rechazar([]);
  }

  const esPut = req.method === "PUT";
  const permitidos = esPut ? CAMPOS_PUT : CAMPOS_PATCH;
  const claves = Object.keys(cuerpo);

  const campos = claves.filter((clave) => !permitidos.includes(clave));
  if (esPut) {
    for (const campo of CAMPOS_PUT) {
      if (!Object.hasOwn(cuerpo, campo)) campos.push(campo);
    }
  }

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
