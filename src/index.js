const { leerConfiguracion } = require("./config/entorno");
const {
  conectarBaseDatos,
  desconectarBaseDatos,
} = require("./config/base-datos");
const { crearServicioReservasMongo } = require("./servicios/reservas-mongo");
const { crearApp } = require("./app");

async function main() {
  const { puerto, formatoRegistro } = leerConfiguracion();
  await conectarBaseDatos();
  const servicioReservas = crearServicioReservasMongo();
  const app = crearApp({ servicioReservas, formatoRegistro });

  const servidor = app.listen(puerto, (error) => {
    if (error) {
      console.error("No se pudo escuchar el puerto:", error.code);
      process.exitCode = 1;
      desconectarBaseDatos().catch((fallo) => {
        console.error("Error al cerrar:", fallo.name);
      });
      return;
    }
    console.log(`Aplicación disponible en http://localhost:${puerto}`);
  });

  let cerrando = false;
  function cerrar() {
    if (cerrando) return;
    cerrando = true;
    console.log("Cerrando el servidor...");
    servidor.close(async () => {
      try {
        await desconectarBaseDatos();
        console.log("Conexión con MongoDB cerrada.");
      } catch (error) {
        console.error("Error al cerrar:", error.name);
        process.exitCode = 1;
      }
    });
  }

  process.once("SIGINT", cerrar);
  process.once("SIGTERM", cerrar);
}

main().catch(async (error) => {
  console.error("No se pudo iniciar la aplicación:", error.name);
  if (error.name === "ErrorDeConfiguracion") {
    console.error(error.message);
  }
  console.error("Revisar entorno, DNS, red, acceso de Atlas y puerto.");
  process.exitCode = 1;
  try {
    await desconectarBaseDatos();
  } catch (fallo) {
    console.error("Error al cerrar:", fallo.name);
  }
});
