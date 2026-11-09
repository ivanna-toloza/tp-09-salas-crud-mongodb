// =============================================================================
// ARCHIVO: scripts/comprobar-conexion.js · PRUEBA DE CONEXIÓN
// -----------------------------------------------------------------------------
// Se ejecuta con: node --env-file=.env scripts/comprobar-conexion.js
// Solo conecta con MongoDB y cierra. No crea ni lee nada. Sirve para saber si
// la URI, el usuario, la IP autorizada y el DNS están bien.
//
// TEORÍA
// - try/finally: el bloque finally se ejecuta SIEMPRE, haya salido bien o
//   mal el try. Garantiza que la conexión se cierre y el script termine.
// - Si el try falla, después del finally el error sigue "de largo" y lo
//   atrapa el .catch() de main().
// =============================================================================

// Importa las funciones de conexión. La ruta empieza con ../src/ porque este
// script está en otra carpeta. Cuatro líneas por el formato de Prettier.
const {
  conectarBaseDatos,
  desconectarBaseDatos,
} = require("../src/config/base-datos");

// Función principal async para poder usar await.
async function main() {
  // try: el bloque que puede fallar.
  try {
    // Intenta conectar y espera.
    await conectarBaseDatos();
    // Si conectó, lo avisa.
    console.log("Conexión con MongoDB establecida.");
    // finally: se ejecuta siempre, haya salido bien o mal...
  } finally {
    // ...y cierra la conexión para que el script termine.
    await desconectarBaseDatos();
    // Cierra el finally.
  }
  // Cierra main.
}

// Ejecuta main y atrapa cualquier error.
main().catch((error) => {
  // Muestra solo el nombre del error (no el mensaje, que podría tener datos).
  console.error("No se pudo completar la conexión:", error.name);
  // Si es un error de configuración propio...
  if (error.name === "ErrorDeConfiguracion") {
    // ...muestra el mensaje, que es seguro.
    console.error(error.message);
    // Cierra el if.
  }
  // Lista de cosas para revisar (tres líneas por el formato de Prettier).
  console.error(
    "Revisar MONGODB_URI, clúster de Atlas, IP permitida y usuario.",
  );
  // Marca la salida con error (código 1).
  process.exitCode = 1;
  // Cierra el .catch().
});
