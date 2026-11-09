// =============================================================================
// ARCHIVO: src/middleware/reservas.js · VALIDACIÓN DE CREACIÓN
// -----------------------------------------------------------------------------
// Valida los datos para CREAR una reserva, tanto desde el formulario HTML como
// desde POST /api/reservas. Si algo está mal responde 400; si todo está bien
// deja los datos limpios en req.reservaValidada y llama a next().
//
// TEORÍA
// - Validar en el servidor es obligatorio: las validaciones del navegador
//   (required, min, max) se pueden saltear, por ejemplo con Postman.
// - typeof devuelve el tipo de un valor: "string", "number", "object"...
// - Una sola fuente de verdad: las listas SALAS y TURNOS vienen del modelo.
// =============================================================================

// Trae las listas de salas y turnos desde el modelo. Si se agrega una sala en
// el modelo, se actualizan solos el esquema, esta validación y el formulario.
const { SALAS, TURNOS } = require("../modelos/reserva");

// Middleware que corre en todas las rutas del sitio de reservas.
function prepararAreaReservas(req, res, next) {
  // Nombre de la sección; las vistas lo muestran como etiqueta.
  res.locals.seccion = "Reservas de salas";
  // Lista de salas; nueva.ejs la usa para armar las opciones del <select>.
  res.locals.salasPermitidas = SALAS;
  // Lista de turnos, con el mismo fin.
  res.locals.turnosPermitidos = TURNOS;
  // Pasa al siguiente middleware o ruta.
  next();
  // Cierra la función.
}

// Lee un campo de texto de forma segura.
function leerTexto(valor) {
  // Si es texto, lo devuelve sin espacios en los extremos (trim). Si es otra
  // cosa (número, arreglo, undefined), devuelve "" y después se rechaza.
  return typeof valor === "string" ? valor.trim() : "";
  // Cierra la función.
}

// Lee la cantidad de personas.
function leerPersonas(valor) {
  // Solo acepta como punto de partida un NÚMERO o un TEXTO NO VACÍO (las tres
  // líneas forman una sola condición). Importa porque Number("") da 0,
  // Number(true) da 1 y Number([3]) da 3: sin este filtro pasarían.
  const tipoValido =
    typeof valor === "number" ||
    (typeof valor === "string" && valor.trim() !== "");
  // Si el tipo sirve lo convierte con Number ("4" → 4); si no, devuelve NaN,
  // que nunca pasa la validación.
  return tipoValido ? Number(valor) : NaN;
  // Cierra la función.
}

// Middleware validador de creación (POST).
function validarReserva(req, res, next) {
  // Toma el cuerpo. ?? {} hace falta porque en Express 5 req.body es undefined
  // si no llegó cuerpo; así no falla al leer sus propiedades.
  const valores = req.body ?? {};
  // Lee el nombre del estudiante, ya recortado.
  const estudiante = leerTexto(valores.estudiante);
  // Lee el email.
  const email = leerTexto(valores.email);
  // Lee la sala.
  const sala = leerTexto(valores.sala);
  // Lee la fecha.
  const fecha = leerTexto(valores.fecha);
  // Lee el turno.
  const turno = leerTexto(valores.turno);
  // Lee la cantidad de personas con su función especial.
  const personas = leerPersonas(valores.personas);

  // Arreglo donde se anotan los campos inválidos. Se revisan TODOS para
  // informar todos los errores juntos, no solo el primero.
  const campos = [];
  // Estudiante vacío → inválido.
  if (!estudiante) campos.push("estudiante");
  // Email sin @ → inválido.
  if (!email.includes("@")) campos.push("email");
  // Sala que no está en la lista permitida → inválida.
  if (!SALAS.includes(sala)) campos.push("sala");
  // Fecha vacía → inválida.
  if (!fecha) campos.push("fecha");
  // Turno fuera de la lista → inválido.
  if (!TURNOS.includes(turno)) campos.push("turno");
  // Personas tiene que ser entero (descarta NaN y decimales) y estar entre 1 y 6.
  if (!Number.isInteger(personas) || personas < 1 || personas > 6) {
    // Si no cumple, se anota.
    campos.push("personas");
    // Cierra el if.
  }

  // Si se anotó al menos un campo inválido...
  if (campos.length > 0) {
    // ...prepara el mensaje para el usuario.
    const mensaje = "Por favor, completá todos los campos con datos válidos.";

    // req.baseUrl es el prefijo donde está montado el router. Como este
    // middleware se usa en la API y en el sitio, así sabe quién lo llamó.
    if (req.baseUrl === "/api/reservas") {
      // API: 400 en JSON con el mensaje y la lista de campos inválidos.
      return res.status(400).json({ error: mensaje, campos });
      // Cierra el if.
    }

    // Sitio: 400 y vuelve a mostrar el formulario...
    return res.status(400).render("reservas/nueva", {
      // ...con su título...
      titulo: "Registrar nueva reserva",
      // ...el mensaje de error...
      error: mensaje,
      // ...y los valores escritos, para no tener que tipear todo de nuevo.
      valores,
      // Cierra el objeto y la llamada a render.
    });
    // Cierra el if. Al responder con return NO se llama a next(): el
    // controlador no se ejecuta y la base no se toca.
  }

  // Todo es válido: arma un objeto NUEVO y lo deja en req.reservaValidada para
  // el controlador. Copia SOLO los seis campos ya limpios (propiedades
  // abreviadas). Si el cliente mandó estado o _id, se pierden acá: por eso la
  // reserva nace "pendiente" y con el _id que genera MongoDB.
  req.reservaValidada = {
    // Nombre del estudiante.
    estudiante,
    // Email.
    email,
    // Sala.
    sala,
    // Fecha.
    fecha,
    // Turno.
    turno,
    // Cantidad de personas (ya como número).
    personas,
    // Cierra el objeto.
  };

  // Pasa al controlador.
  next();
  // Cierra la función.
}

// Exporta los dos middleware.
module.exports = { prepararAreaReservas, validarReserva };
