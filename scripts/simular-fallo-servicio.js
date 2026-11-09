// =============================================================================
// ARCHIVO: scripts/simular-fallo-servicio.js · SIMULA UNA BASE CAÍDA
// [NUEVO TP09: el servicio falso suma reemplazar, actualizar y eliminar]
// -----------------------------------------------------------------------------
// Se ejecuta con: node scripts/simular-fallo-servicio.js (no toca Atlas)
// Crea la MISMA app con un servicio falso cuyas siete operaciones fallan, le
// hace solicitudes y comprueba que responda 500 SIN mostrar detalles internos.
//
// TEORÍA
// - Inyección de dependencias: como crearApp recibe el servicio, se le puede
//   pasar uno falso para probar sin base de datos.
// - Puerto 0: le pide al sistema operativo cualquier puerto libre.
// - fetch: función incluida en Node para hacer solicitudes HTTP.
// - Promesa a partir de eventos: new Promise((resolve, reject) => ...) permite
//   esperar con await algo que avisa mediante eventos.
// =============================================================================

// Trae la fábrica de la app (la misma de siempre).
const { crearApp } = require("../src/app");

// Fábrica de un servicio FALSO.
function crearServicioQueFalla() {
  // Una función async que siempre falla.
  async function fallar() {
    // Crea un error con un mensaje "interno" que NUNCA debería llegar al cliente.
    const error = new Error("Fallo simulado: base inaccesible");
    // Le pone el nombre del error real de MongoDB cuando no encuentra el servidor.
    error.name = "MongoServerSelectionError";
    // Lo lanza. Al ser async, devuelve una promesa rechazada, igual que una
    // consulta fallida de verdad.
    throw error;
    // Cierra la función.
  }

  // Devuelve un objeto con LOS MISMOS siete nombres que el servicio real,
  // todos apuntando a fallar.
  return {
    // Listar.
    listar: fallar,
    // Buscar por ID.
    obtenerPorId: fallar,
    // Contar.
    contar: fallar,
    // Crear.
    crear: fallar,
    // [NUEVO] Reemplazar (PUT).
    reemplazar: fallar,
    // [NUEVO] Actualizar (PATCH).
    actualizar: fallar,
    // [NUEVO] Eliminar (DELETE).
    eliminar: fallar,
    // Cierra el objeto.
  };
  // Cierra la fábrica.
}

// Lista de solicitudes de prueba: método, dirección y cuerpo opcional.
const solicitudes = [
  // Listar por la API.
  { metodo: "GET", ruta: "/api/reservas" },
  // Consultar un ID. 24 ceros tiene formato válido; acá el servicio falso
  // falla igual, que es lo que se quiere probar.
  { metodo: "GET", ruta: "/api/reservas/000000000000000000000000" },
  // POST con los seis campos válidos: pasa el middleware y llega al servicio.
  {
    // Método.
    metodo: "POST",
    // Dirección.
    ruta: "/api/reservas",
    // Cuerpo con los seis campos válidos.
    cuerpo: {
      // Nombre.
      estudiante: "Ana Ejemplo",
      // Email.
      email: "ana@example.com",
      // Sala.
      sala: "Sala Norte",
      // Fecha.
      fecha: "2026-10-28",
      // Turno.
      turno: "Mañana",
      // Personas.
      personas: 2,
      // Cierra el cuerpo.
    },
    // Cierra la solicitud.
  },
  // [NUEVO] PUT con los siete campos válidos, para que pase validarCambioReserva
  // y llegue al servicio.
  {
    // Método.
    metodo: "PUT",
    // Dirección con un ID de formato válido.
    ruta: "/api/reservas/000000000000000000000000",
    // Cuerpo con los siete campos.
    cuerpo: {
      // Nombre.
      estudiante: "Ana Ejemplo",
      // Email.
      email: "ana@example.com",
      // Sala.
      sala: "Sala Norte",
      // Fecha.
      fecha: "2026-10-28",
      // Turno.
      turno: "Mañana",
      // Personas.
      personas: 2,
      // Estado (en PUT es obligatorio).
      estado: "confirmada",
      // Cierra el cuerpo.
    },
    // Cierra la solicitud.
  },
  // [NUEVO] PATCH con un cambio parcial válido.
  {
    // Método.
    metodo: "PATCH",
    // Dirección.
    ruta: "/api/reservas/000000000000000000000000",
    // Solo cambia personas.
    cuerpo: { personas: 3 },
    // Cierra la solicitud.
  },
  // [NUEVO] DELETE (sin cuerpo).
  { metodo: "DELETE", ruta: "/api/reservas/000000000000000000000000" },
  // /estado (responde JSON).
  { metodo: "GET", ruta: "/estado" },
  // Sitio HTML: comprueba que el error se muestre como página.
  { metodo: "GET", ruta: "/reservas" },
  // Cierra el arreglo.
];

// Función principal.
async function main() {
  // Crea la app INYECTÁNDOLE el servicio falso. La app es la misma: solo
  // cambia la dependencia.
  const app = crearApp({
    // El servicio que siempre falla.
    servicioReservas: crearServicioQueFalla(),
    // "tiny" es el formato más corto de morgan.
    formatoRegistro: "tiny",
    // Cierra el objeto y la llamada.
  });
  // Puerto 0: el sistema operativo elige uno libre (no choca con el 3000).
  const servidor = app.listen(0);
  // Convierte los eventos del servidor en una promesa para esperarla con await.
  await new Promise((resolve, reject) => {
    // Se resuelve cuando el servidor está escuchando...
    servidor.once("listening", resolve);
    // ...o se rechaza si hubo un error.
    servidor.once("error", reject);
    // Cierra la promesa.
  });
  // Lee qué puerto le asignaron (desestructuración de port).
  const { port } = servidor.address();

  // try: las solicitudes pueden fallar.
  try {
    // Recorre las solicitudes desestructurando cada objeto.
    for (const { metodo, ruta, cuerpo } of solicitudes) {
      // Hace la solicitud HTTP a la app recién levantada y espera la respuesta.
      const respuesta = await fetch(`http://localhost:${port}${ruta}`, {
        // Método HTTP.
        method: metodo,
        // Si hay cuerpo, avisa que es JSON con el encabezado Content-Type.
        headers: cuerpo ? { "Content-Type": "application/json" } : {},
        // Convierte el cuerpo a texto JSON, o no manda cuerpo.
        body: cuerpo ? JSON.stringify(cuerpo) : undefined,
        // Cierra las opciones y la llamada a fetch.
      });
      // Lee la respuesta como texto.
      const texto = await respuesta.text();
      // ¿La respuesta FILTRÓ detalles internos? Busca el mensaje del error o
      // una línea de traza (las trazas tienen líneas que empiezan con "    at ").
      // La condición ocupa la línea siguiente.
      const filtraDetalles =
        texto.includes("Fallo simulado") || texto.includes("    at ");
      // Muestra método, dirección, código, tipo de contenido y si filtró
      // detalles. Lo esperado: 500 y "detalles internos: no" en todas.
      console.log(
        `${metodo} ${ruta} -> ${respuesta.status} ${respuesta.headers.get("content-type")} | detalles internos: ${filtraDetalles ? "SÍ" : "no"}`,
      );
      // Cierra el for.
    }
    // finally: se ejecuta siempre...
  } finally {
    // ...y cierra el servidor para que el script termine.
    servidor.close();
    // Cierra el finally.
  }
  // Cierra main.
}

// Ejecuta main y atrapa un error inesperado de la simulación.
main().catch((error) => {
  // Muestra solo el nombre del error.
  console.error("No se pudo completar la simulación:", error.name);
  // Marca la salida con error.
  process.exitCode = 1;
  // Cierra el .catch().
});
