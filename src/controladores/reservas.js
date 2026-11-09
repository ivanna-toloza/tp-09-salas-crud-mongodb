// =============================================================================
// ARCHIVO: src/controladores/reservas.js · CONTROLADOR DE RESERVAS
// [NUEVO TP09: reemplazarApi, actualizarApi y eliminarApi]
// -----------------------------------------------------------------------------
// Recibe la solicitud ya validada, le pide el trabajo al servicio y decide la
// respuesta: una vista HTML, un JSON con 200 o 201, un 204 sin cuerpo o un 404.
// No sabe nada de MongoDB: solo conoce al servicio.
//
// TEORÍA
// - req: lo que llega (req.params, req.query, req.body). res: lo que se
//   responde (res.status, res.json, res.render, res.redirect, res.end).
// - Express 5 y async: si una función async lanza un error (o se rechaza una
//   promesa que espera), Express 5 lo manda solo al middleware de errores.
//   Por eso acá NO hay try/catch.
// - Códigos HTTP: 200 OK, 201 Creado, 204 Sin contenido, 302 Redirección,
//   404 No encontrado.
// - Clausura: todas las funciones de adentro recuerdan servicioReservas.
// =============================================================================

// Fábrica que recibe el servicio y devuelve un objeto con todas las funciones.
function crearControladorReservas(servicioReservas) {
  // GET /estado: informa que el servicio está activo y cuántas reservas hay.
  async function mostrarEstado(req, res) {
    // Pide la cantidad de reservas y espera el número (countDocuments en Mongo).
    const reservas = await servicioReservas.contar();
    // res.json() responde un objeto convertido a JSON (200 por defecto)...
    res.json({
      // ...que indica que el servicio está activo...
      servicio: "activo",
      // ...la cantidad de reservas (propiedad abreviada)...
      reservas,
      // ...y el identificador de esta solicitud (lo puso el middleware).
      solicitudId: res.locals.solicitudId,
      // Cierra el objeto y la llamada a json.
    });
    // Cierra la función.
  }

  // GET /reservas (sitio HTML): listado.
  async function listar(req, res) {
    // Pide todas las reservas (sin filtro) y espera el arreglo.
    const reservas = await servicioReservas.listar();
    // Renderiza views/reservas/lista.ejs...
    res.render("reservas/lista", {
      // ...con el título...
      titulo: "Listado de reservas",
      // ...y el arreglo de reservas para armar las tarjetas.
      reservas,
      // Cierra el objeto y la llamada a render.
    });
    // Cierra la función.
  }

  // GET /reservas/nueva: formulario vacío. NO es async porque no usa la base.
  function mostrarFormulario(req, res) {
    // Renderiza views/reservas/nueva.ejs...
    res.render("reservas/nueva", {
      // ...con su título...
      titulo: "Registrar nueva reserva",
      // ...error: null porque todavía no hay errores que mostrar...
      error: null,
      // ...y valores vacíos. La vista siempre espera estas dos variables.
      valores: {},
      // Cierra el objeto y la llamada a render.
    });
    // Cierra la función.
  }

  // GET /reservas/:id: detalle de una reserva en HTML.
  async function mostrarDetalle(req, res) {
    // Busca la reserva con el ID de la dirección (req.params.id). Si el ID está
    // mal formado, el servicio lanza un error que termina en un 400.
    const reserva = await servicioReservas.obtenerPorId(req.params.id);

    // Si el servicio devolvió null, el ID es válido pero no existe...
    if (!reserva) {
      // ...responde 404 con la vista de error. return evita responder dos veces.
      return res.status(404).render("no-encontrado", {
        // Título de la página de error.
        titulo: "Reserva no encontrada",
        // Mensaje explicativo.
        mensaje: "No existe una reserva registrada con ese identificador.",
        // Cierra el objeto y la llamada a render.
      });
      // Cierra el if.
    }

    // Si existe, renderiza views/reservas/detalle.ejs...
    res.render("reservas/detalle", {
      // ...con un título armado con plantilla literal ("Reserva de Ana")...
      titulo: `Reserva de ${reserva.estudiante}`,
      // ...y la reserva completa.
      reserva,
      // Cierra el objeto y la llamada a render.
    });
    // Cierra la función.
  }

  // POST /reservas (formulario HTML): crea y redirige.
  async function crear(req, res) {
    // Le pasa al servicio los datos que dejó limpios el middleware validador.
    await servicioReservas.crear(req.reservaValidada);
    // Redirige al listado (302). Patrón Post/Redirect/Get: si el usuario
    // recarga la página, no se reenvía el formulario ni se duplica la reserva.
    res.redirect("/reservas");
    // Cierra la función.
  }

  // GET /api/reservas: listado en JSON.
  async function listarApi(req, res) {
    // req.query.sala es el valor de ?sala=... (o undefined si no vino). El
    // servicio filtra si corresponde.
    const reservas = await servicioReservas.listar(req.query.sala);
    // Responde el ARREGLO de reservas en JSON.
    res.json(reservas);
    // Cierra la función.
  }

  // GET /api/reservas/:id: una reserva en JSON.
  async function obtenerApi(req, res) {
    // Busca por ID.
    const reserva = await servicioReservas.obtenerPorId(req.params.id);

    // Si no existe...
    if (!reserva) {
      // ...404 en JSON.
      return res.status(404).json({ error: "Reserva no encontrada." });
      // Cierra el if.
    }

    // Si existe, la responde (200).
    res.json(reserva);
    // Cierra la función.
  }

  // POST /api/reservas: crea y responde 201.
  async function crearApi(req, res) {
    // Crea la reserva y recibe la reserva guardada (ya con su id).
    const reserva = await servicioReservas.crear(req.reservaValidada);
    // Encadena tres cosas: location() agrega el encabezado Location con la
    // dirección del recurso nuevo; status(201) indica "Creado"; json() envía
    // la reserva. Es lo que pide REST al crear un recurso.
    res.location(`/api/reservas/${reserva.id}`).status(201).json(reserva);
    // Cierra la función.
  }

  // [NUEVO] PUT /api/reservas/:id: reemplaza la reserva completa.
  async function reemplazarApi(req, res) {
    // Llama al servicio y espera. Le pasa el ID de la dirección y los siete
    // campos que validó validarCambioReserva (req.cambiosValidos).
    const reserva = await servicioReservas.reemplazar(
      // ID tomado de la dirección.
      req.params.id,
      // Datos ya validados por el middleware.
      req.cambiosValidos,
      // Cierra la llamada.
    );

    // Si el servicio devolvió null, el ID no existe...
    if (!reserva) {
      // ...404 en JSON. No se crea nada nuevo.
      return res.status(404).json({ error: "Reserva no encontrada." });
      // Cierra el if.
    }

    // Responde 200 con la reserva ya reemplazada (mismo ID, valores nuevos).
    res.json(reserva);
    // Cierra la función.
  }

  // [NUEVO] PATCH /api/reservas/:id: cambia solo los campos enviados.
  async function actualizarApi(req, res) {
    // Igual que PUT, pero llama a actualizar, que cambia solo personas y/o
    // estado y deja el resto como estaba.
    const reserva = await servicioReservas.actualizar(
      // ID tomado de la dirección.
      req.params.id,
      // Datos ya validados por el middleware.
      req.cambiosValidos,
      // Cierra la llamada.
    );

    // ID inexistente...
    if (!reserva) {
      // ...404 en JSON.
      return res.status(404).json({ error: "Reserva no encontrada." });
      // Cierra el if.
    }

    // Responde 200 con la reserva modificada.
    res.json(reserva);
    // Cierra la función.
  }

  // [NUEVO] DELETE /api/reservas/:id: elimina la reserva.
  async function eliminarApi(req, res) {
    // El servicio devuelve un BOOLEANO: true si borró un documento, false si
    // no había ninguno con ese ID.
    const eliminada = await servicioReservas.eliminar(req.params.id);

    // Si no borró nada...
    if (!eliminada) {
      // ...404 en JSON.
      return res.status(404).json({ error: "Reserva no encontrada." });
      // Cierra el if.
    }

    // 204 No Content: éxito SIN cuerpo. end() cierra la respuesta sin enviar
    // datos: no hay nada que devolver porque el recurso ya no existe.
    res.status(204).end();
    // Cierra la función.
  }

  // Devuelve el controlador: un objeto con todas las funciones. Los routers
  // las usan como controlador.listarApi, controlador.eliminarApi, etc.
  return {
    // GET /estado.
    mostrarEstado,
    // GET /reservas.
    listar,
    // GET /reservas/nueva.
    mostrarFormulario,
    // GET /reservas/:id.
    mostrarDetalle,
    // POST /reservas.
    crear,
    // GET /api/reservas.
    listarApi,
    // GET /api/reservas/:id.
    obtenerApi,
    // POST /api/reservas.
    crearApi,
    // [NUEVO] PUT /api/reservas/:id.
    reemplazarApi,
    // [NUEVO] PATCH /api/reservas/:id.
    actualizarApi,
    // [NUEVO] DELETE /api/reservas/:id.
    eliminarApi,
    // Cierra el objeto.
  };
  // Cierra la fábrica.
}

// Exporta la fábrica.
module.exports = { crearControladorReservas };
