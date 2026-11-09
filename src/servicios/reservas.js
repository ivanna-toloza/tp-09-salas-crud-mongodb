// =============================================================================
// ARCHIVO: src/servicios/reservas.js · SERVICIO EN MEMORIA (TP07, NO SE USA)
// -----------------------------------------------------------------------------
// Versión anterior del servicio, que guardaba las reservas en un arreglo.
// Se conserva como referencia y NINGÚN archivo lo importa.
//
// PARA COMPARAR CON reservas-mongo.js
// - Acá las funciones son SINCRÓNICAS: los datos están en la memoria.
// - Al reiniciar el servidor, los datos se PIERDEN.
// - En reservas-mongo.js las funciones son async porque cada operación viaja
//   por la red hasta Atlas, y los datos PERSISTEN aunque se apague el servidor.
// =============================================================================

// Fábrica que recibía un arreglo inicial de reservas.
function crearServicioReservas(reservasIniciales) {
  // Copia cada objeto con { ...reserva } (spread) para no modificar el arreglo
  // original. Los paréntesis hacen que la flecha devuelva un objeto.
  const reservas = reservasIniciales.map((reserva) => ({ ...reserva }));

  // Devuelve todas las reservas.
  function listar() {
    // Devuelve una COPIA del arreglo ([...reservas]) para que nadie de afuera
    // lo modifique.
    return [...reservas];
    // Cierra la función.
  }

  // Busca una reserva por ID.
  function buscarPorId(id) {
    // find devuelve la primera que cumple la condición, o undefined si no hay;
    // ?? null lo convierte en null.
    return reservas.find((reserva) => reserva.id === id) ?? null;
    // Cierra la función.
  }

  // Cuenta las reservas.
  function contar() {
    // El largo del arreglo.
    return reservas.length;
    // Cierra la función.
  }

  // Agrega una reserva.
  function crear(datosValidados) {
    // reduce recorre el arreglo acumulando un valor: acá, el ID más alto.
    // Empieza en 0 (segundo argumento) y en cada paso se queda con el mayor
    // entre el acumulado y el ID actual (Math.max).
    const ultimoId = reservas.reduce(
      (mayorId, reserva) => Math.max(mayorId, reserva.id),
      0,
    );
    // La nueva reserva tiene ID = el mayor + 1 y los datos validados (spread).
    const nueva = { id: ultimoId + 1, ...datosValidados };
    // La agrega al final del arreglo.
    reservas.push(nueva);
    // La devuelve.
    return nueva;
    // Cierra la función.
  }

  // Devuelve el servicio con sus cuatro operaciones.
  return { listar, buscarPorId, contar, crear };
  // Cierra la fábrica.
}

// Exporta la fábrica.
module.exports = { crearServicioReservas };
