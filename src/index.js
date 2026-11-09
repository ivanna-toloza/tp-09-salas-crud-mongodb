// =============================================================================
// ARCHIVO: src/index.js · PUNTO DE ENTRADA DE LA APLICACIÓN
// -----------------------------------------------------------------------------
// Es el primer archivo que ejecuta Node (node --env-file=.env src/index.js).
// Orden del arranque: 1) leer la configuración, 2) conectar con MongoDB,
// 3) crear el servicio, 4) crear la app Express, 5) abrir el puerto.
// Se conecta ANTES de abrir el puerto para no atender solicitudes sin base.
// También prepara un cierre ordenado cuando se aprieta Ctrl+C.
//
// TEORÍA
// - CommonJS: cada archivo es un módulo. require() devuelve lo que el otro
//   archivo puso en module.exports.
// - Desestructuración: const { a } = objeto crea la variable "a" con la
//   propiedad del mismo nombre. Así se importa solo lo que se necesita.
// - async/await: conectar con MongoDB tarda (viaja por la red) y devuelve una
//   promesa. await espera el resultado sin bloquear a Node.
// - Inyección de dependencias: la app no crea su servicio; se lo pasan.
// =============================================================================

// Importa solo la función leerConfiguracion del módulo config/entorno.js.
// La ruta es relativa a este archivo y la extensión .js se puede omitir.
const { leerConfiguracion } = require("./config/entorno");
// Importa las dos funciones que abren y cierran la conexión con MongoDB.
// Ocupa cuatro líneas solo por el formato de Prettier (no entra en una).
const {
  conectarBaseDatos,
  desconectarBaseDatos,
} = require("./config/base-datos");
// Importa la fábrica que crea el servicio de reservas que trabaja con MongoDB.
const { crearServicioReservasMongo } = require("./servicios/reservas-mongo");
// Importa la fábrica que crea la aplicación Express.
const { crearApp } = require("./app");

// main agrupa todo el arranque. Es async para poder usar await adentro.
async function main() {
  // Lee la configuración y desestructura el resultado: puerto (número) y
  // formatoRegistro ("dev" o "combined" para morgan). Si PORT es inválido,
  // lanza un error y el arranque se corta (lo atrapa el .catch del final).
  const { puerto, formatoRegistro } = leerConfiguracion();
  // Conecta con MongoDB y ESPERA a que la conexión esté lista. Si falla,
  // lanza un error y el servidor nunca llega a abrir el puerto.
  await conectarBaseDatos();
  // Crea el servicio: un objeto con listar, obtenerPorId, contar, crear,
  // reemplazar, actualizar y eliminar.
  const servicioReservas = crearServicioReservasMongo();
  // Crea la app inyectándole sus dependencias: el servicio y el formato de
  // registro. La app no crea su propio servicio: lo recibe.
  const app = crearApp({ servicioReservas, formatoRegistro });

  // app.listen(puerto, callback) crea el servidor HTTP y empieza a escuchar.
  // Devuelve el objeto servidor, que se guarda para poder cerrarlo después.
  // En Express 5 el callback recibe "error" si no se pudo abrir el puerto.
  const servidor = app.listen(puerto, (error) => {
    // Si hubo un error al abrir el puerto...
    if (error) {
      // ...muestra solo su código, por ejemplo EADDRINUSE (puerto ocupado).
      console.error("No se pudo escuchar el puerto:", error.code);
      // Marca que el programa terminará con error (código 1) sin cortarlo de
      // golpe como haría process.exit(1): deja terminar lo pendiente.
      process.exitCode = 1;
      // MongoDB ya estaba conectado: hay que cerrarlo para que Node termine.
      // Este callback no es async, así que en vez de await se usa .catch().
      desconectarBaseDatos().catch((fallo) => {
        // Si cerrar falla, muestra solo el nombre del error.
        console.error("Error al cerrar:", fallo.name);
        // Cierra el callback de .catch() y la llamada.
      });
      // Sale del callback para no mostrar el mensaje de éxito.
      return;
      // Cierra el if.
    }
    // Todo salió bien: avisa la dirección. Es una plantilla literal (comillas
    // invertidas): ${puerto} se reemplaza por el valor de la variable.
    console.log(`Aplicación disponible en http://localhost:${puerto}`);
    // Cierra el callback y la llamada a app.listen.
  });

  // Bandera que indica si ya empezó el cierre. Es let porque cambia de valor.
  let cerrando = false;
  // Función que se ejecuta cuando llega una señal de apagado (Ctrl+C).
  function cerrar() {
    // Si ya se estaba cerrando, no hace nada: evita cerrar dos veces.
    if (cerrando) return;
    // Marca que el cierre empezó.
    cerrando = true;
    // Avisa en la consola.
    console.log("Cerrando el servidor...");
    // servidor.close(callback): deja de aceptar conexiones nuevas, ESPERA a que
    // terminen las solicitudes en curso y recién ahí ejecuta el callback.
    // El callback es async para poder usar await adentro.
    servidor.close(async () => {
      // try/catch: intenta algo que puede fallar y atrapa el error si falla.
      try {
        // Cierra la conexión con MongoDB y espera a que termine.
        await desconectarBaseDatos();
        // Confirma que se cerró.
        console.log("Conexión con MongoDB cerrada.");
        // Si cerrar la base falló, se ejecuta el bloque catch.
      } catch (error) {
        // Muestra solo el nombre del error (el mensaje podría tener datos).
        console.error("Error al cerrar:", error.name);
        // Marca la salida del programa como fallida.
        process.exitCode = 1;
        // Cierra el catch.
      }
      // Cierra el callback de servidor.close.
    });
    // Cierra la función cerrar.
  }

  // SIGINT es la señal que envía Ctrl+C en la terminal. once registra el
  // manejador una sola vez: un segundo Ctrl+C cierra Node de inmediato.
  process.once("SIGINT", cerrar);
  // SIGTERM es la señal de "terminá" que envían el sistema operativo o las
  // plataformas de hosting al detener un servicio. Se maneja igual.
  process.once("SIGTERM", cerrar);
  // Cierra la función main.
}

// Ejecuta main(). Como es async devuelve una promesa: si algo adentro lanzó
// un error (configuración inválida, Atlas inaccesible), la promesa se rechaza
// y la atrapa .catch(). El callback es async para poder esperar el cierre.
main().catch(async (error) => {
  // Muestra solo el NOMBRE del error (por ejemplo MongooseServerSelectionError):
  // el mensaje completo podría incluir datos del servidor o de la URI.
  console.error("No se pudo iniciar la aplicación:", error.name);
  // Si es un error de configuración propio (creado en config/entorno.js)...
  if (error.name === "ErrorDeConfiguracion") {
    // ...sí muestra el mensaje: lo escribimos nosotros y no tiene secretos.
    console.error(error.message);
    // Cierra el if.
  }
  // Lista de cosas para revisar.
  console.error("Revisar entorno, DNS, red, acceso de Atlas y puerto.");
  // Marca la salida del programa con código 1 (error).
  process.exitCode = 1;
  // Intenta cerrar la conexión por si llegó a abrirse.
  try {
    // Si no había conexión abierta, disconnect no hace nada.
    await desconectarBaseDatos();
    // Si cerrar falla...
  } catch (fallo) {
    // ...muestra solo el nombre del error.
    console.error("Error al cerrar:", fallo.name);
    // Cierra el catch.
  }
  // Cierra el callback y la llamada a .catch().
});
