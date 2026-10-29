const { crearApp } = require("../src/app");

function crearServicioQueFalla() {
  async function fallar() {
    const error = new Error("Fallo simulado: base inaccesible");
    error.name = "MongoServerSelectionError";
    throw error;
  }

  return {
    listar: fallar,
    obtenerPorId: fallar,
    contar: fallar,
    crear: fallar,
    reemplazar: fallar,
    actualizar: fallar,
    eliminar: fallar,
  };
}

const solicitudes = [
  { metodo: "GET", ruta: "/api/reservas" },
  { metodo: "GET", ruta: "/api/reservas/000000000000000000000000" },
  {
    metodo: "POST",
    ruta: "/api/reservas",
    cuerpo: {
      estudiante: "Ana Ejemplo",
      email: "ana@example.com",
      sala: "Sala Norte",
      fecha: "2026-10-28",
      turno: "Mañana",
      personas: 2,
    },
  },
  {
    metodo: "PUT",
    ruta: "/api/reservas/000000000000000000000000",
    cuerpo: {
      estudiante: "Ana Ejemplo",
      email: "ana@example.com",
      sala: "Sala Norte",
      fecha: "2026-10-28",
      turno: "Mañana",
      personas: 2,
      estado: "confirmada",
    },
  },
  {
    metodo: "PATCH",
    ruta: "/api/reservas/000000000000000000000000",
    cuerpo: { personas: 3 },
  },
  { metodo: "DELETE", ruta: "/api/reservas/000000000000000000000000" },
  { metodo: "GET", ruta: "/estado" },
  { metodo: "GET", ruta: "/reservas" },
];

async function main() {
  const app = crearApp({
    servicioReservas: crearServicioQueFalla(),
    formatoRegistro: "tiny",
  });
  const servidor = app.listen(0);
  await new Promise((resolve, reject) => {
    servidor.once("listening", resolve);
    servidor.once("error", reject);
  });
  const { port } = servidor.address();

  try {
    for (const { metodo, ruta, cuerpo } of solicitudes) {
      const respuesta = await fetch(`http://localhost:${port}${ruta}`, {
        method: metodo,
        headers: cuerpo ? { "Content-Type": "application/json" } : {},
        body: cuerpo ? JSON.stringify(cuerpo) : undefined,
      });
      const texto = await respuesta.text();
      const filtraDetalles =
        texto.includes("Fallo simulado") || texto.includes("    at ");
      console.log(
        `${metodo} ${ruta} -> ${respuesta.status} ${respuesta.headers.get("content-type")} | detalles internos: ${filtraDetalles ? "SÍ" : "no"}`,
      );
    }
  } finally {
    servidor.close();
  }
}

main().catch((error) => {
  console.error("No se pudo completar la simulación:", error.name);
  process.exitCode = 1;
});
