const {
  conectarBaseDatos,
  desconectarBaseDatos,
} = require("../src/config/base-datos");

async function main() {
  try {
    await conectarBaseDatos();
    console.log("Conexión con MongoDB establecida.");
  } finally {
    await desconectarBaseDatos();
  }
}

main().catch((error) => {
  console.error("No se pudo completar la conexión:", error.name);
  if (error.name === "ErrorDeConfiguracion") {
    console.error(error.message);
  }
  console.error(
    "Revisar MONGODB_URI, clúster de Atlas, IP permitida y usuario.",
  );
  process.exitCode = 1;
});
