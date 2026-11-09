// =============================================================================
// ARCHIVO: src/middleware/solicitudes.js · OBSERVACIÓN DE SOLICITUDES
// -----------------------------------------------------------------------------
// Dos middleware: uno numera cada solicitud (BIB-0001...) y el otro registra
// en la consola cuánto tardó en responderse.
//
// TEORÍA
// - Clausura (closure): una función definida dentro de otra recuerda las
//   variables de la de afuera aunque esta ya haya terminado. Así el contador
//   sobrevive entre solicitudes y nadie de afuera lo puede modificar.
// - res.locals: objeto que vive mientras dura la solicitud. Lo leen los
//   middleware siguientes y TODAS las vistas EJS (el pie muestra solicitudId).
// - Eventos: res.on("finish", fn) ejecuta fn cuando la respuesta se terminó
//   de enviar, no en este momento.
// =============================================================================

// Fábrica que crea el middleware identificador.
function crearIdentificadorSolicitud() {
  // Contador que arranca en 0. Vive dentro de la fábrica (clausura).
  let numeroDeSolicitud = 0;

  // Devuelve el middleware. Tiene nombre para que aparezca así en los errores.
  return function identificarSolicitud(req, res, next) {
    // Suma 1 en cada solicitud.
    numeroDeSolicitud += 1;
    // Arma el identificador y lo guarda en res.locals. String() convierte el
    // número en texto y padStart(4, "0") lo completa con ceros a la izquierda:
    // 7 → "0007", resultado "BIB-0007". Es una plantilla literal.
    res.locals.solicitudId = `BIB-${String(numeroDeSolicitud).padStart(4, "0")}`;
    // Pasa el control al siguiente middleware.
    next();
    // Cierra el middleware devuelto.
  };
  // Cierra la fábrica.
}

// Middleware común (no es fábrica): mide cuánto tarda cada solicitud.
function medirDuracion(req, res, next) {
  // Hora de inicio con alta precisión, en NANOSEGUNDOS, como BigInt (un tipo de
  // número entero muy grande).
  const inicio = process.hrtime.bigint();
  // Registra una función que se ejecutará cuando la respuesta termine de
  // enviarse (evento "finish"), no ahora.
  res.on("finish", () => {
    // Hora de fin.
    const fin = process.hrtime.bigint();
    // Resta fin - inicio (nanosegundos), lo pasa a número común y lo divide por
    // un millón para obtener milisegundos. El _ de 1_000_000 es solo visual.
    const milisegundos = Number(fin - inicio) / 1_000_000;
    // Muestra [identificador] MÉTODO dirección código duración, por ejemplo
    // "[BIB-0003] PATCH /api/reservas/... 200 12.34 ms". toFixed(2) deja dos
    // decimales. La plantilla literal es la línea del medio.
    console.log(
      `[${res.locals.solicitudId}] ${req.method} ${req.originalUrl} ${res.statusCode} ${milisegundos.toFixed(2)} ms`,
    );
    // Cierra el callback del evento "finish".
  });
  // Llama a next() ENSEGUIDA: no espera a que termine la solicitud; la
  // medición se completa sola cuando se dispara "finish".
  next();
  // Cierra la función.
}

// Exporta los dos middleware.
module.exports = { crearIdentificadorSolicitud, medirDuracion };
