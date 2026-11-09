// =============================================================================
// ARCHIVO: src/app.js · ARMADO DE LA APLICACIÓN EXPRESS
// -----------------------------------------------------------------------------
// Configura las vistas, registra los middleware globales en orden, monta las
// rutas del sitio HTML y de la API JSON, y al final agrega el 404 y el
// manejador de errores. No abre el puerto: eso lo hace index.js.
//
// TEORÍA
// - Express: framework web de Node. "app" es la aplicación.
// - Middleware: función (req, res, next) que Express ejecuta EN ORDEN para
//   cada solicitud. Puede responder (y la cadena se corta) o llamar a next()
//   para pasar al siguiente. app.use() registra un middleware.
// - Router: un "mini-app" con sus propias rutas que se monta bajo un prefijo.
// - Función fábrica: crearApp construye y devuelve la app con las
//   dependencias que recibe (servicio y formato de registro).
// =============================================================================

// Carga Express.
const express = require("express");
// Carga express-ejs-layouts: permite un diseño común para todas las páginas.
const expressLayouts = require("express-ejs-layouts");
// Carga morgan: registra en la consola cada solicitud HTTP.
const morgan = require("morgan");
// Carga el módulo path de Node para armar rutas de carpetas. El prefijo node:
// indica que es un módulo propio de Node y no una librería instalada.
const path = require("node:path");
// Importa los middleware de solicitudes: el que asigna un identificador a cada
// solicitud y el que mide cuánto tarda.
const {
  crearIdentificadorSolicitud,
  medirDuracion,
} = require("./middleware/solicitudes");
// Importa la fábrica del manejador de errores y la función que decide si una
// solicitud espera una respuesta JSON.
const {
  crearManejadorErrores,
  esSolicitudJson,
} = require("./middleware/errores");
// Importa la fábrica del controlador de reservas.
const { crearControladorReservas } = require("./controladores/reservas");
// Importa la fábrica del router del sitio HTML (/reservas).
const { crearRouterReservas } = require("./rutas/reservas");
// Importa la fábrica del router de la API JSON (/api/reservas).
const { crearRouterReservasApi } = require("./rutas/reservas-api");

// Fábrica de la app. Recibe un objeto y lo desestructura en sus dos
// dependencias. Como se las pasan, un script puede usar un servicio falso.
function crearApp({ servicioReservas, formatoRegistro }) {
  // express() crea la aplicación.
  const app = express();
  // Crea el controlador entregándole el servicio. El controlador solo conoce
  // al servicio, nunca a MongoDB directamente.
  const controlador = crearControladorReservas(servicioReservas);

  // --- Configuración de vistas -----------------------------------------------
  // Define EJS como motor de vistas: res.render("inicio") busca inicio.ejs.
  app.set("view engine", "ejs");
  // Carpeta de vistas. __dirname es la carpeta de este archivo (src); ".." sube
  // un nivel y "views" entra en la carpeta de vistas. path.join arma una ruta
  // absoluta válida en cualquier sistema operativo y desde cualquier carpeta.
  app.set("views", path.join(__dirname, "..", "views"));
  // Layout por defecto de express-ejs-layouts: views/layouts/main.ejs.
  app.set("layout", "layouts/main");

  // --- Middleware globales: corren en TODAS las solicitudes, en este ORDEN ----
  // morgan va primero para registrar todas las solicitudes, incluso las de
  // archivos estáticos. Usa el formato elegido en config/entorno.js.
  app.use(morgan(formatoRegistro));
  // Asigna un identificador a cada solicitud (BIB-0001, BIB-0002...). Lleva
  // paréntesis porque crearIdentificadorSolicitud es una FÁBRICA: al llamarla
  // devuelve el middleware.
  app.use(crearIdentificadorSolicitud());
  // Mide la duración de cada solicitud. Va SIN paréntesis porque medirDuracion
  // ya es el middleware. Está después del identificador para poder mostrarlo.
  app.use(medirDuracion);
  // Activa los layouts: cada res.render se inserta dentro de layouts/main.ejs.
  app.use(expressLayouts);
  // Sirve los archivos de la carpeta public tal como están (/css/estilos.css,
  // /img/sala.svg, /js/app.js). Si encuentra el archivo, responde y termina.
  app.use(express.static(path.join(__dirname, "..", "public")));
  // Lee el cuerpo de los formularios HTML (application/x-www-form-urlencoded)
  // y lo deja en req.body. extended: false usa el lector simple, sin objetos
  // anidados (no hacen falta).
  app.use(express.urlencoded({ extended: false }));
  // Lee el cuerpo JSON (Content-Type: application/json, lo que manda Postman)
  // y lo deja en req.body. Si el JSON está mal escrito genera un error con
  // type "entity.parse.failed" (termina en 400). En Express 5, si no llegó
  // cuerpo, req.body queda en undefined.
  app.use(express.json());

  // --- Rutas -----------------------------------------------------------------
  // GET / (página de inicio). El manejador es una función flecha (req, res).
  app.get("/", (req, res) => {
    // Renderiza la vista views/inicio.ejs pasándole variables en un objeto.
    res.render("inicio", {
      // Variable titulo que muestran la vista y el layout.
      titulo: "Gestión de Salas de Estudio",
      // Cierra el objeto y la llamada a render.
    });
    // Cierra el manejador y la ruta.
  });
  // GET /estado → controlador.mostrarEstado: JSON con la cantidad de reservas.
  app.get("/estado", controlador.mostrarEstado);
  // MONTA el router de la API en /api/reservas: su "/" pasa a ser
  // /api/reservas y su "/:id" pasa a ser /api/reservas/:id.
  app.use("/api/reservas", crearRouterReservasApi(controlador));
  // Monta el router del sitio HTML en /reservas. Sitio y API comparten el
  // mismo controlador, el mismo servicio y la misma base.
  app.use("/reservas", crearRouterReservas(controlador));

  // --- 404: middleware sin ruta, registrado DESPUÉS de todas las rutas -------
  // Solo se llega acá si ninguna ruta respondió.
  app.use((req, res) => {
    // Si la solicitud era de la API o de /estado...
    if (esSolicitudJson(req)) {
      // ...responde 404 en JSON. return corta la función: no responde dos veces.
      return res.status(404).json({ error: "Ruta no encontrada." });
      // Cierra el if.
    }

    // Si era una página del sitio, responde 404 con la vista no-encontrado.ejs.
    res.status(404).render("no-encontrado", {
      // Título de la página de error.
      titulo: "Página no encontrada",
      // Mensaje explicativo.
      mensaje: "La dirección solicitada no existe.",
      // Cierra el objeto y la llamada a render.
    });
    // Cierra el middleware 404.
  });

  // --- Manejador de errores: siempre va AL FINAL -----------------------------
  // Recibe los errores lanzados en cualquier middleware o controlador
  // (incluidas las funciones async, gracias a Express 5).
  app.use(
    // Se crea con una fábrica que recibe qué vista mostrar si falla la
    // validación del formulario y con qué título.
    crearManejadorErrores({
      // Vista que se vuelve a mostrar: views/reservas/nueva.ejs.
      vistaFormulario: "reservas/nueva",
      // Título de esa vista.
      tituloFormulario: "Registrar nueva reserva",
      // Cierra el objeto y la llamada a la fábrica.
    }),
    // Cierra app.use.
  );

  // Devuelve la app armada. Todavía no escucha ningún puerto.
  return app;
  // Cierra la función crearApp.
}

// Exporta la fábrica.
module.exports = { crearApp };
