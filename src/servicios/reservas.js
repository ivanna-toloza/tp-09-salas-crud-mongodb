function crearServicioReservas(reservasIniciales) {
  const reservas = reservasIniciales.map((reserva) => ({ ...reserva }));

  function listar() {
    return [...reservas];
  }

  function buscarPorId(id) {
    return reservas.find((reserva) => reserva.id === id) ?? null;
  }

  function contar() {
    return reservas.length;
  }

  function crear(datosValidados) {
    const ultimoId = reservas.reduce(
      (mayorId, reserva) => Math.max(mayorId, reserva.id),
      0,
    );
    const nueva = { id: ultimoId + 1, ...datosValidados };
    reservas.push(nueva);
    return nueva;
  }

  return { listar, buscarPorId, contar, crear };
}

module.exports = { crearServicioReservas };
