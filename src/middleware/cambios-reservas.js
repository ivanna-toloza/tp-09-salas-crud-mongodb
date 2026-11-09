// =============================================================================
// ARCHIVO: src/middleware/cambios-reservas.js · VALIDACIÓN DE PUT Y PATCH
// [NUEVO TP09]
// -----------------------------------------------------------------------------
// Revisa el cuerpo de PUT y PATCH ANTES de llegar a la base:
//   1) que sea un objeto (no vacío, no arreglo);
//   2) que solo traiga campos permitidos para ese método (rechaza _id, $set...);
//   3) que en PUT estén los 7 campos;
//   4) que cada valor sea válido.
// Si algo falla responde 400 y no llama a next(). Si todo está bien deja los
// datos limpios en req.cambiosValidos.
//
// TEORÍA
// - PUT = reemplazo COMPLETO (exige todos los campos editables).
// - PATCH = cambio PARCIAL (acá, solo personas y/o estado).
// - Lista blanca: en vez de buscar lo prohibido, se acepta solo lo permitido.
//   Así el cliente nunca puede cambiar el _id ni mandar operadores de MongoDB.
// - Object.keys(obj): arreglo con los nombres de las propiedades de obj.
// - Object.hasOwn(obj, "x"): ¿obj tiene la propiedad propia "x"? (aunque su
//   valor sea "falso", como 0).
// =============================================================================

// Trae las listas de valores permitidos desde el modelo (misma fuente de verdad
// que el esquema).
const { SALAS, TURNOS, ESTADOS } = require("../modelos/reserva");

// Los SIETE campos editables. PUT reemplaza la reserva completa, así que los
// exige todos, incluido estado.
const CAMPOS_PUT = [
  // Nombre del estudiante.
  "estudiante",
  // Correo electrónico.
  "email",
  // Sala.
  "sala",
  // Fecha.
  "fecha",
  // Turno.
  "turno",
  // Cantidad de personas.
  "personas",
  // Estado (pendiente o confirmada).
  "estado",
  // Cierra el arreglo.
];
// PATCH es un cambio parcial: solo admite personas y estado.
const CAMPOS_PATCH = ["personas", "estado"];

// Limpia y valida UN valor. Devuelve el valor listo para guardar, o undefined
// si es inválido.
function leerCampo(campo, valor) {
  // Caso especial: personas es numérico.
  if (campo === "personas") {
    // Solo acepta un número o un texto no vacío (las tres líneas son una sola
    // condición). Así true, [3], {} y "" quedan afuera aunque Number() pudiera
    // convertirlos.
    const tipoValido =
      typeof valor === "number" ||
      (typeof valor === "string" && valor.trim() !== "");
    // Si el tipo sirve lo convierte a número; si no, NaN.
    const numero = tipoValido ? Number(valor) : NaN;
    // Rechaza si se cumple CUALQUIERA de estas condiciones (una por línea):
    //   - no es finito: 1e999 en un JSON se lee como Infinity (en rigor
    //     Number.isInteger(Infinity) ya da false; esto deja clara la intención);
    //   - no es entero: 2.5;
    //   - es menor que 1;
    //   - es mayor que 6.
    if (
      !Number.isFinite(numero) ||
      !Number.isInteger(numero) ||
      numero < 1 ||
      numero > 6
    ) {
      // Inválido.
      return undefined;
      // Cierra el if.
    }
    // Devuelve el NÚMERO ya convertido: si llegó "4", se guarda 4.
    return numero;
    // Cierra el caso personas.
  }

  // Los demás campos tienen que ser TEXTO: true o 5 como estado se rechazan.
  if (typeof valor !== "string") return undefined;
  // Quita espacios de los extremos.
  const texto = valor.trim();

  // sala: solo si está en la lista (Sala Norte, Sala Sur, Sala Multimedia).
  if (campo === "sala") return SALAS.includes(texto) ? texto : undefined;
  // turno: solo Mañana, Tarde o Noche.
  if (campo === "turno") return TURNOS.includes(texto) ? texto : undefined;
  // estado: solo pendiente o confirmada ("cancelada" se rechaza).
  if (campo === "estado") return ESTADOS.includes(texto) ? texto : undefined;
  // email: tiene que contener @.
  if (campo === "email") return texto.includes("@") ? texto : undefined;
  // Los que quedan (estudiante, fecha): el texto si no está vacío.
  // "" || undefined da undefined.
  return texto || undefined;
  // Cierra la función.
}

// El middleware que usan PUT y PATCH.
function validarCambioReserva(req, res, next) {
  // Toma el cuerpo de la solicitud.
  const cuerpo = req.body;
  // Función flecha auxiliar: responde 400 con un mensaje fijo y la lista de
  // campos con problemas. Evita repetir la misma respuesta en dos lugares.
  // Las cuatro líneas son una sola sentencia encadenada: res.status().json().
  const rechazar = (campos) =>
    res
      .status(400)
      .json({ error: "Revisá los campos de la actualización.", campos });

  // Rechaza el cuerpo entero si: no existe (Body none o text/plain dejan
  // req.body en undefined), no es un objeto, o es un arreglo. Hace falta
  // Array.isArray porque typeof [] también da "object".
  if (!cuerpo || typeof cuerpo !== "object" || Array.isArray(cuerpo)) {
    // 400 con lista vacía: el problema es el cuerpo completo, no un campo.
    return rechazar([]);
    // Cierra el if.
  }

  // ¿Es PUT? (si no, es PATCH).
  const esPut = req.method === "PUT";
  // Elige la lista de campos permitidos según el método.
  const permitidos = esPut ? CAMPOS_PUT : CAMPOS_PATCH;
  // Nombres de las propiedades enviadas, por ejemplo ["personas", "estado"].
  const claves = Object.keys(cuerpo);

  // filter se queda con las claves NO permitidas (campos desconocidos, _id,
  // $set, $inc...). Esas claves ya cuentan como errores.
  const campos = claves.filter((clave) => !permitidos.includes(clave));
  // Solo para PUT...
  if (esPut) {
    // ...recorre los siete campos obligatorios...
    for (const campo of CAMPOS_PUT) {
      // ...y anota los que FALTAN. Un PUT incompleto no se completa con
      // valores por defecto: se rechaza.
      if (!Object.hasOwn(cuerpo, campo)) campos.push(campo);
      // Cierra el for.
    }
    // Cierra el if.
  }

  // Objeto donde se copian SOLO los valores válidos y limpios.
  const datos = {};
  // Recorre cada clave enviada.
  for (const campo of claves) {
    // Si no está permitida la salta (ya se anotó como error con filter).
    if (!permitidos.includes(campo)) continue;
    // Limpia y valida el valor. cuerpo[campo] lee la propiedad cuyo nombre
    // está guardado en la variable campo.
    const valor = leerCampo(campo, cuerpo[campo]);
    // Si es inválido...
    if (valor === undefined) {
      // ...anota el campo como error.
      campos.push(campo);
      // Si es válido...
    } else {
      // ...lo copia en datos.
      datos[campo] = valor;
      // Cierra el if/else.
    }
    // Cierra el for.
  }

  // Rechaza si el objeto llegó VACÍO ({}) o si hubo ALGÚN campo con problemas.
  if (claves.length === 0 || campos.length > 0) {
    // 400 con la lista de campos rechazados. Sin next(): el controlador y la
    // base ni se enteran.
    return rechazar(campos);
    // Cierra el if.
  }

  // Deja los datos validados para el controlador.
  req.cambiosValidos = datos;
  // Pasa al controlador.
  next();
  // Cierra la función.
}

// Exporta el middleware. leerCampo y las listas son internas.
module.exports = { validarCambioReserva };
