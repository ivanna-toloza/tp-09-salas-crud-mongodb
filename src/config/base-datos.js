// =============================================================================
// ARCHIVO: src/config/base-datos.js · CONEXIÓN CON MONGODB
// -----------------------------------------------------------------------------
// Concentra en un solo lugar cómo se abre y se cierra la conexión. La usan
// index.js y los scripts de terminal.
//
// TEORÍA
// - Mongoose es un ODM (Object Document Mapper): conecta Node con MongoDB y
//   permite definir esquemas, validar datos y consultar mediante modelos.
// - Una conexión abierta mantiene vivo el proceso de Node: hay que cerrarla
//   para que el programa termine.
// =============================================================================

// Carga la librería Mongoose.
const mongoose = require("mongoose");
// Importa la función que lee y valida la URI desde el entorno.
const { leerUriMongo } = require("./entorno");

// Abre la conexión. Es async porque conectar tarda y devuelve una promesa.
async function conectarBaseDatos() {
  // mongoose.connect(uri, opciones) se conecta y await espera a que esté lista.
  // La URI se lee en este momento: un error de configuración aparece acá.
  await mongoose.connect(leerUriMongo(), {
    // Si en 5 segundos no encuentra un servidor disponible, falla (por defecto
    // esperaría 30). Sirve para detectar rápido problemas de red, IP o DNS.
    serverSelectionTimeoutMS: 5000,
    // Cierra el objeto de opciones y la llamada a connect.
  });
  // Cierra la función.
}

// Cierra la conexión. También es async.
async function desconectarBaseDatos() {
  // Cierra todas las conexiones abiertas de Mongoose y espera a que terminen.
  await mongoose.disconnect();
  // Cierra la función.
}

// Exporta las dos funciones.
module.exports = { conectarBaseDatos, desconectarBaseDatos };
