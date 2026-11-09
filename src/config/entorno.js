// =============================================================================
// ARCHIVO: src/config/entorno.js · LECTURA DE VARIABLES DE ENTORNO
// -----------------------------------------------------------------------------
// Lee y valida PORT, NODE_ENV y MONGODB_URI. Si falta algo o está mal, falla
// temprano y con un mensaje claro, antes de abrir el puerto.
//
// TEORÍA
// - process.env: objeto de Node con las variables de entorno. Todos sus
//   valores son TEXTO (string). Con node --env-file=.env se cargan desde .env.
// - Parámetro por defecto: function f(x = valor) usa "valor" si no se pasa x.
// - ?? (fusión de nulos): a ?? b devuelve b solo si a es null o undefined.
// - ?. (encadenamiento opcional): a?.b() da undefined en vez de un error si a
//   es null o undefined.
// - throw: lanza un error y corta la ejecución hasta el catch más cercano.
// =============================================================================

// Lee el puerto y el formato de registro. Por defecto usa process.env; recibir
// el entorno como parámetro permite probar la función con un objeto inventado.
function leerConfiguracion(entorno = process.env) {
  // Si PORT no está definido usa 3000. Number() convierte el texto "3000" en el
  // número 3000; un texto no numérico da NaN (Not a Number).
  const puerto = Number(entorno.PORT ?? 3000);

  // Valida el puerto: tiene que ser entero (descarta NaN y decimales) y estar
  // entre 1 y 65535, el rango válido de puertos TCP. || significa "o".
  if (!Number.isInteger(puerto) || puerto < 1 || puerto > 65535) {
    // Lanza un Error común (no ErrorDeConfiguracion): por eso index.js muestra
    // solo su nombre, "Error", y no este mensaje.
    throw new Error("PORT debe ser un entero entre 1 y 65535");
    // Cierra el if.
  }

  // Operador ternario (condición ? siVerdadero : siFalso): en producción morgan
  // usa "combined" (formato estándar y completo); si no, "dev" (corto y con
  // colores). La sentencia ocupa dos líneas por el formato de Prettier.
  const formatoRegistro =
    entorno.NODE_ENV === "production" ? "combined" : "dev";

  // Devuelve un objeto con propiedades abreviadas: { puerto } equivale a
  // { puerto: puerto }.
  return { puerto, formatoRegistro };
  // Cierra la función.
}

// Fabrica un error de configuración con nombre propio. Es interna: no se exporta.
function crearErrorDeConfiguracion(mensaje) {
  // Crea un objeto Error con el mensaje recibido.
  const error = new Error(mensaje);
  // Le cambia el nombre. Así index.js y los scripts pueden preguntar
  // error.name === "ErrorDeConfiguracion" y saber que el mensaje es seguro.
  error.name = "ErrorDeConfiguracion";
  // Lo DEVUELVE, no lo lanza: quien la llama decide hacer throw.
  return error;
  // Cierra la función.
}

// Lee y valida la URI de conexión a MongoDB.
function leerUriMongo(entorno = process.env) {
  // ?. evita un error si MONGODB_URI no existe (da undefined). .trim() quita
  // espacios y saltos de línea de los extremos, comunes al copiar y pegar.
  const uri = entorno.MONGODB_URI?.trim();

  // !uri es verdadero si la URI es undefined o un texto vacío.
  if (!uri) {
    // Lanza el error de configuración con un mensaje claro.
    throw crearErrorDeConfiguracion("Falta MONGODB_URI en el entorno.");
    // Cierra el if.
  }

  // Revisa el formato: tiene que empezar con mongodb:// (conexión directa) o
  // con mongodb+srv:// (formato de Atlas, que busca los servidores por DNS).
  // && exige que fallen las dos comprobaciones para rechazar.
  if (!uri.startsWith("mongodb://") && !uri.startsWith("mongodb+srv://")) {
    // Lanza el error indicando el formato esperado (tres líneas por Prettier).
    throw crearErrorDeConfiguracion(
      "MONGODB_URI debe comenzar con mongodb:// o mongodb+srv://.",
    );
    // Cierra el if.
  }

  // Pasó las dos comprobaciones: devuelve la URI limpia.
  return uri;
  // Cierra la función.
}

// Exporta las dos funciones públicas para que otros archivos las usen.
module.exports = { leerConfiguracion, leerUriMongo };
