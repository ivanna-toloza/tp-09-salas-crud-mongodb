// =============================================================================
// ARCHIVO: scripts/crear-reserva.js · CREA UNA RESERVA DE PRUEBA
// -----------------------------------------------------------------------------
// Se ejecuta con: node --env-file=.env scripts/crear-reserva.js
// Conecta, crea UNA reserva con datos ficticios y cierra. Cada ejecución crea
// una reserva nueva. Usa el modelo directamente, sin Express ni servicio.
//
// TEORÍA
// - Model.create(datos): arma el documento, lo valida con el esquema y lo
//   inserta en la colección.
// - Si la validación falla, Mongoose lanza un ValidationError cuya propiedad
//   errors tiene una clave por cada campo inválido.
// =============================================================================

// Importa las funciones de conexión (cuatro líneas por el formato de Prettier).
const {
  conectarBaseDatos,
  desconectarBaseDatos,
} = require("../src/config/base-datos");
// Importa el modelo Reserva.
const { Reserva } = require("../src/modelos/reserva");

// Función principal.
async function main() {
  // try: el bloque que puede fallar.
  try {
    // Conecta y espera.
    await conectarBaseDatos();
    // Crea la reserva: valida con el esquema e inserta un documento.
    const reserva = await Reserva.create({
      // Datos ficticios (email @example.com, nunca datos reales).
      estudiante: "Lucas Gómez",
      // Email de prueba.
      email: "lucas@example.com",
      // Sala válida.
      sala: "Sala Norte",
      // Fecha en formato AAAA-MM-DD.
      fecha: "2026-10-26",
      // Turno válido.
      turno: "Mañana",
      // Cantidad de personas. estado no se manda: queda "pendiente".
      personas: 3,
      // Cierra el objeto y la llamada a create.
    });
    // Muestra el _id que generó MongoDB, pasado a texto con toString().
    console.log("Reserva guardada. _id:", reserva._id.toString());
    // finally: se ejecuta siempre...
  } finally {
    // ...y cierra la conexión.
    await desconectarBaseDatos();
    // Cierra el finally.
  }
  // Cierra main.
}

// Ejecuta main y atrapa cualquier error.
main().catch((error) => {
  // Muestra solo el nombre del error.
  console.error("No se pudo crear la reserva:", error.name);
  // Si es un error de configuración propio...
  if (error.name === "ErrorDeConfiguracion") {
    // ...muestra el mensaje, que es seguro.
    console.error(error.message);
    // Cierra el if.
  }
  // Si el error trae "errors" (es un ValidationError)...
  if (error.errors) {
    // ...muestra los nombres de los campos inválidos unidos con comas.
    console.error("Campos a revisar:", Object.keys(error.errors).join(", "));
    // Cierra el if.
  }
  // Sugerencia de qué revisar.
  console.error("Revisar datos, configuración y disponibilidad de MongoDB.");
  // Marca la salida con error.
  process.exitCode = 1;
  // Cierra el .catch().
});
