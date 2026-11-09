// =============================================================================
// ARCHIVO: src/servicios/reservas-mongo.js · SERVICIO DE RESERVAS (MONGODB)
// [NUEVO TP09: comprobarId, reemplazar, actualizar y eliminar]
// -----------------------------------------------------------------------------
// Es la ÚNICA capa que habla con MongoDB, a través del modelo Reserva.
// Revisa el ID, arma las consultas copiando solo los campos admitidos (no
// confía en quien lo llama) y devuelve un objeto, null o un booleano.
// No sabe nada de Express ni de HTTP: el controlador decide los códigos.
//
// TEORÍA
// - ObjectId: tipo de identificador de MongoDB (_id). En texto son 24
//   caracteres hexadecimales (0-9, a-f).
// - Consultas del modelo: find, findById, create, findOneAndReplace,
//   findOneAndUpdate, deleteOne, countDocuments. Todas devuelven promesas.
// - $set: operador de MongoDB que cambia solo los campos indicados.
// - Opciones de escritura usadas en PUT y PATCH:
//     runValidators: true    → el esquema valida también al actualizar;
//     returnDocument:"after" → devuelve el documento ya modificado;
//     upsert: false          → si el ID no existe, NO crea uno nuevo.
// =============================================================================

// Carga Mongoose (se usa para validar el formato del ID).
const mongoose = require("mongoose");
// Trae el modelo Reserva, con el que se hacen las consultas.
const { Reserva } = require("../modelos/reserva");

// Convierte un documento de MongoDB en el objeto que ve el cliente. Así la API
// no expone detalles internos (_id, __v) y responde siempre con la misma forma.
function representarReserva(documento) {
  // Devuelve un objeto nuevo...
  return {
    // ...con id como TEXTO: _id es un ObjectId y toString() lo pasa a su forma
    // de 24 caracteres hexadecimales...
    id: documento._id.toString(),
    // ...y copia los siete campos de la reserva.
    estudiante: documento.estudiante,
    // Email.
    email: documento.email,
    // Sala.
    sala: documento.sala,
    // Fecha.
    fecha: documento.fecha,
    // Turno.
    turno: documento.turno,
    // Cantidad de personas.
    personas: documento.personas,
    // Estado.
    estado: documento.estado,
    // Cierra el objeto.
  };
  // Cierra la función.
}

// Fabrica errores causados por datos del cliente.
function crearErrorDeEntrada(mensaje, codigo) {
  // Crea el Error con su mensaje.
  const error = new Error(mensaje);
  // Le agrega una propiedad propia, codigo (por ejemplo "ID_INVALIDO"). El
  // manejador de errores la lee para responder 400 en lugar de 500.
  error.codigo = codigo;
  // Lo devuelve (quien la llama hace throw).
  return error;
  // Cierra la función.
}

// Revisa el formato del ID antes de consultar.
function comprobarId(id) {
  // isObjectIdOrHexString es verdadero solo si el ID es un ObjectId o un texto
  // de 24 caracteres hexadecimales.
  if (!mongoose.isObjectIdOrHexString(id)) {
    // Si no lo es (por ejemplo "abc"), lanza ID_INVALIDO → 400 con un mensaje
    // claro. Sin esto, Mongoose lanzaría un CastError menos explicativo.
    throw crearErrorDeEntrada("Identificador inválido", "ID_INVALIDO");
    // Cierra el if.
  }
  // Cierra la función.
}

// Fábrica del servicio. Devuelve un objeto con todas las operaciones.
function crearServicioReservasMongo() {
  // Lista las reservas; opcionalmente filtra por sala.
  async function listar(sala) {
    // Filtro vacío {}: en MongoDB significa "todos los documentos".
    const filtro = {};

    // Si vino el parámetro sala...
    if (sala !== undefined) {
      // ...tiene que ser texto y no estar vacío. ?sala= vacío o ?sala=A&sala=B
      // (eso llega como arreglo) no son válidos...
      if (typeof sala !== "string" || !sala.trim()) {
        // ...y lanza FILTRO_INVALIDO (termina en 400).
        throw crearErrorDeEntrada("Sala inválida", "FILTRO_INVALIDO");
        // Cierra el if interno.
      }
      // Agrega la sala al filtro: queda { sala: "Sala Norte" }.
      filtro.sala = sala.trim();
      // Cierra el if.
    }

    // find(filtro) busca los documentos que coinciden. lean() pide objetos
    // JavaScript simples en vez de documentos completos de Mongoose: son más
    // livianos y alcanzan porque solo se van a leer.
    const documentos = await Reserva.find(filtro).lean();
    // map convierte cada documento con representarReserva y devuelve el arreglo.
    return documentos.map(representarReserva);
    // Cierra la función.
  }

  // Busca una reserva por su ID.
  async function obtenerPorId(id) {
    // Primero revisa el formato; si es inválido lanza y no consulta la base.
    comprobarId(id);

    // findById busca el documento con ese _id; lean() lo devuelve como objeto
    // simple. Si no existe devuelve null.
    const documento = await Reserva.findById(id).lean();
    // Si lo encontró lo representa; si no, null. El servicio NO decide el 404:
    // eso lo hace el controlador al ver null.
    return documento ? representarReserva(documento) : null;
    // Cierra la función.
  }

  // Cuenta cuántas reservas hay.
  async function contar() {
    // countDocuments() sin filtro cuenta todos los documentos de la colección.
    return Reserva.countDocuments();
    // Cierra la función.
  }

  // Crea una reserva nueva.
  async function crear(datos) {
    // create() arma el documento, lo VALIDA con el esquema y lo inserta en la
    // colección. Copia uno por uno SOLO los seis campos: aunque datos traiga
    // estado o _id, no se copian. estado toma el valor por defecto "pendiente"
    // y MongoDB genera el _id.
    const documento = await Reserva.create({
      // Nombre del estudiante.
      estudiante: datos.estudiante,
      // Email.
      email: datos.email,
      // Sala.
      sala: datos.sala,
      // Fecha.
      fecha: datos.fecha,
      // Turno.
      turno: datos.turno,
      // Cantidad de personas.
      personas: datos.personas,
      // Cierra el objeto y la llamada a create.
    });
    // Devuelve la reserva guardada en su forma pública (ya con su id).
    return representarReserva(documento);
    // Cierra la función.
  }

  // [NUEVO] PUT: reemplaza una reserva completa.
  async function reemplazar(id, datos) {
    // Revisa el ID (400 si está mal formado).
    comprobarId(id);

    // Arma el documento de reemplazo con los SIETE campos editables. NUNCA
    // incluye _id: el ID de la reserva no cambia.
    const reemplazo = {
      // Nombre del estudiante.
      estudiante: datos.estudiante,
      // Email.
      email: datos.email,
      // Sala.
      sala: datos.sala,
      // Fecha.
      fecha: datos.fecha,
      // Turno.
      turno: datos.turno,
      // Cantidad de personas.
      personas: datos.personas,
      // Estado (en PUT sí se puede cambiar).
      estado: datos.estado,
      // Cierra el objeto.
    };
    // findOneAndReplace(filtro, reemplazo, opciones) busca el documento con ese
    // _id y lo REEMPLAZA entero por "reemplazo" (conserva solo el _id).
    const documento = await Reserva.findOneAndReplace({ _id: id }, reemplazo, {
      // El esquema vuelve a validar el reemplazo (por defecto no lo haría).
      runValidators: true,
      // Devuelve el documento DESPUÉS del cambio, con los valores nuevos.
      returnDocument: "after",
      // Si no encuentra el ID, NO inserta uno nuevo.
      upsert: false,
      // Cierra las opciones y la llamada.
    });
    // Si reemplazó, devuelve la reserva representada; si no, null (→ 404).
    return documento ? representarReserva(documento) : null;
    // Cierra la función.
  }

  // [NUEVO] PATCH: cambia algunos campos de una reserva.
  async function actualizar(id, datos) {
    // Revisa el ID.
    comprobarId(id);

    // Objeto vacío para los cambios.
    const cambios = {};
    // Recorre los ÚNICOS dos campos que se pueden cambiar con PATCH.
    for (const campo of ["personas", "estado"]) {
      // Si datos trae ese campo, lo copia. Se usa Object.hasOwn y no
      // if (datos[campo]) porque este último ignoraría valores "falsos" como 0:
      // acá importa si el campo ESTÁ, no si su valor es verdadero.
      if (Object.hasOwn(datos, campo)) cambios[campo] = datos[campo];
      // Cierra el for.
    }
    // Si no quedó ningún cambio...
    if (Object.keys(cambios).length === 0) {
      // ...lanza ENTRADA_INVALIDA (400): no tiene sentido una actualización vacía.
      throw crearErrorDeEntrada("Actualización vacía", "ENTRADA_INVALIDA");
      // Cierra el if.
    }

    // findOneAndUpdate(filtro, actualización, opciones) busca y modifica.
    const documento = await Reserva.findOneAndUpdate(
      // Filtro: el documento con ese _id.
      { _id: id },
      // $set cambia SOLO los campos indicados y deja el resto como estaba. El
      // $set lo escribe el servidor: el cliente nunca manda operadores.
      { $set: cambios },
      // Las mismas tres opciones que en PUT: validar, devolver la versión
      // nueva y no crear si no existe.
      { runValidators: true, returnDocument: "after", upsert: false },
      // Cierra la llamada.
    );
    // Devuelve la reserva modificada o null (→ 404).
    return documento ? representarReserva(documento) : null;
    // Cierra la función.
  }

  // [NUEVO] DELETE: elimina una reserva.
  async function eliminar(id) {
    // Revisa el ID.
    comprobarId(id);

    // deleteOne borra UN solo documento con ese _id (borrado FÍSICO: deja de
    // existir). Devuelve algo como { acknowledged: true, deletedCount: 1 }.
    const resultado = await Reserva.deleteOne({ _id: id });
    // true si borró exactamente uno, false si no había ninguno. Que la consulta
    // termine sin error NO significa que haya borrado algo.
    return resultado.deletedCount === 1;
    // Cierra la función.
  }

  // Devuelve el servicio con sus siete operaciones. El servicio falso de
  // scripts/simular-fallo-servicio.js tiene los mismos nombres.
  return {
    // Listar (con filtro opcional por sala).
    listar,
    // Buscar por ID.
    obtenerPorId,
    // Contar.
    contar,
    // Crear.
    crear,
    // [NUEVO] Reemplazar (PUT).
    reemplazar,
    // [NUEVO] Actualizar (PATCH).
    actualizar,
    // [NUEVO] Eliminar (DELETE).
    eliminar,
    // Cierra el objeto.
  };
  // Cierra la fábrica.
}

// Exporta la fábrica. representarReserva, crearErrorDeEntrada y comprobarId
// son internas.
module.exports = { crearServicioReservasMongo };
