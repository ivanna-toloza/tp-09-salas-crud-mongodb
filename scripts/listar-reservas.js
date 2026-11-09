// =============================================================================
// ARCHIVO: scripts/listar-reservas.js · LISTA LAS RESERVAS EN UNA TABLA
// -----------------------------------------------------------------------------
// Se ejecuta con: node --env-file=.env scripts/listar-reservas.js
// Conecta, lee todas las reservas, las muestra como tabla en la terminal y
// cierra. Solo lee: no modifica nada.
//
// TEORÍA
// - Model.find({}): el filtro vacío trae TODOS los documentos.
// - console.table(arreglo): muestra un arreglo de objetos como tabla.
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
    // Trae todos los documentos de la colección.
    const reservas = await Reserva.find({});
    // Muestra una tabla...
    console.table(
      // ...armando, por cada reserva, un objeto con las columnas a mostrar. Los
      // paréntesis alrededor de { } hacen que la flecha DEVUELVA un objeto.
      reservas.map((reserva) => ({
        // id pasado a texto.
        id: reserva._id.toString(),
        // Nombre del estudiante.
        estudiante: reserva.estudiante,
        // Sala.
        sala: reserva.sala,
        // Fecha.
        fecha: reserva.fecha,
        // Turno.
        turno: reserva.turno,
        // Personas.
        personas: reserva.personas,
        // Estado.
        estado: reserva.estado,
        // Cierra el objeto, la flecha y el map.
      })),
      // Cierra console.table.
    );
    // Muestra la cantidad total (largo del arreglo).
    console.log("Total de reservas:", reservas.length);
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
  console.error("No se pudieron consultar las reservas:", error.name);
  // Si es un error de configuración propio...
  if (error.name === "ErrorDeConfiguracion") {
    // ...muestra el mensaje, que es seguro.
    console.error(error.message);
    // Cierra el if.
  }
  // Sugerencia de qué revisar.
  console.error("Revisar configuración y disponibilidad de MongoDB.");
  // Marca la salida con error.
  process.exitCode = 1;
  // Cierra el .catch().
});
