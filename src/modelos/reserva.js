// =============================================================================
// ARCHIVO: src/modelos/reserva.js · MODELO Y ESQUEMA DE RESERVA
// -----------------------------------------------------------------------------
// Define con un esquema de Mongoose qué forma tiene una reserva y qué reglas
// debe cumplir. Es la ÚLTIMA barrera: aunque alguien saltee el middleware, el
// esquema rechaza los datos inválidos antes de guardarlos.
//
// TEORÍA
// - Esquema (Schema): describe los campos, su tipo y sus validaciones.
// - Modelo (model): se crea a partir del esquema y es el objeto con el que se
//   consulta la colección (find, create, deleteOne...).
// - Validadores incluidos: required, enum, min, max, match. También se puede
//   agregar uno propio con validate.
// - Conversión (cast): Mongoose convierte "4" en 4 para un campo Number; si
//   no puede ("abc"), da un CastError.
// - Constantes en MAYÚSCULAS: valores que no cambian; se exportan para que
//   esquema, middleware y vistas usen exactamente las mismas listas.
// =============================================================================

// Carga Mongoose.
const mongoose = require("mongoose");

// Las tres salas válidas.
const SALAS = ["Sala Norte", "Sala Sur", "Sala Multimedia"];
// Los tres turnos válidos.
const TURNOS = ["Mañana", "Tarde", "Noche"];
// Los dos estados válidos. En el TP09 se exporta porque lo usa el validador
// de PUT y PATCH.
const ESTADOS = ["pendiente", "confirmada"];

// new mongoose.Schema(definición, opciones) crea el esquema.
const reservaSchema = new mongoose.Schema(
  // Primer argumento: la definición de los campos.
  {
    // estudiante: texto obligatorio. trim quita espacios de los extremos ANTES
    // de validar: "   " queda vacío y lo rechaza required.
    estudiante: { type: String, required: true, trim: true },
    // email: texto obligatorio y recortado. match: /@/ es una expresión regular
    // que exige que contenga @.
    email: { type: String, required: true, trim: true, match: /@/ },
    // sala: texto obligatorio; enum solo admite valores de la lista SALAS.
    sala: { type: String, required: true, enum: SALAS },
    // fecha: texto obligatorio y recortado. Se guarda como texto "AAAA-MM-DD"
    // (lo que envía el <input type="date">), no como tipo fecha.
    fecha: { type: String, required: true, trim: true },
    // turno: texto obligatorio dentro de la lista TURNOS.
    turno: { type: String, required: true, enum: TURNOS },
    // personas tiene varias reglas, por eso ocupa varias líneas.
    personas: {
      // Es un número: "4" se convierte en 4; "abc" da CastError.
      type: Number,
      // Obligatorio.
      required: true,
      // Mínimo 1.
      min: 1,
      // Máximo 6.
      max: 6,
      // Validación personalizada...
      validate: {
        // ...la función validadora recibe el valor y devuelve true o false.
        // Number.isInteger rechaza decimales como 2.5.
        validator: Number.isInteger,
        // Mensaje que se usa si falla esta regla.
        message: "personas debe ser un número entero",
        // Cierra validate.
      },
      // Cierra personas.
    },
    // estado: texto dentro de ESTADOS, con valor por defecto "pendiente". No es
    // required porque, si no se manda, Mongoose usa el default al crear.
    estado: { type: String, enum: ESTADOS, default: "pendiente" },
    // Cierra la definición de campos.
  },
  // Segundo argumento: opciones del esquema. collection fija el nombre exacto
  // de la colección en MongoDB, sin depender del plural automático.
  { collection: "reservas" },
  // Cierra la llamada a Schema.
);

// mongoose.model(nombre, esquema) "compila" el esquema y crea el MODELO
// Reserva: el objeto con el que se consulta y modifica la colección.
const Reserva = mongoose.model("Reserva", reservaSchema);

// Exporta el modelo y las tres listas.
module.exports = { Reserva, SALAS, TURNOS, ESTADOS };
