const mongoose = require("mongoose");

const SALAS = ["Sala Norte", "Sala Sur", "Sala Multimedia"];
const TURNOS = ["Mañana", "Tarde", "Noche"];
const ESTADOS = ["pendiente", "confirmada"];

const reservaSchema = new mongoose.Schema(
  {
    estudiante: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, match: /@/ },
    sala: { type: String, required: true, enum: SALAS },
    fecha: { type: String, required: true, trim: true },
    turno: { type: String, required: true, enum: TURNOS },
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

const Reserva = mongoose.model("Reserva", reservaSchema);

module.exports = { Reserva, SALAS, TURNOS, ESTADOS };
