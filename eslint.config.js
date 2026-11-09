// =============================================================================
// ARCHIVO: eslint.config.js · CONFIGURACIÓN DE ESLINT
// -----------------------------------------------------------------------------
// ESLint analiza el código y avisa errores probables (variables sin usar,
// variables no definidas...). Se ejecuta con npm run lint.
// Usa el formato "flat config": se exporta un ARREGLO de configuraciones.
// =============================================================================

// Trae las configuraciones oficiales de ESLint (incluye las reglas recomendadas).
const js = require("@eslint/js");

// Exporta el arreglo de configuraciones.
module.exports = [
  // Única configuración del arreglo.
  {
    // A qué archivos se aplica: todos los .js de src y de scripts, en cualquier
    // subcarpeta (** significa "cualquier cantidad de carpetas").
    files: ["src/**/*.js", "scripts/**/*.js"],
    // El spread (...) copia dentro de este objeto las reglas recomendadas.
    ...js.configs.recommended,
    // Opciones del lenguaje.
    languageOptions: {
      // El código usa CommonJS (require / module.exports).
      sourceType: "commonjs",
      // Variables globales que existen en Node aunque no se declaren. Sin esto,
      // ESLint las marcaría como "no definidas". "readonly": se pueden usar
      // pero no reasignar.
      globals: {
        // Carpeta del archivo actual.
        __dirname: "readonly",
        // Consola (console.log, console.error...).
        console: "readonly",
        // Función para hacer solicitudes HTTP (la usa simular-fallo-servicio).
        fetch: "readonly",
        // Objeto del módulo actual (module.exports).
        module: "readonly",
        // Información del proceso (process.env, process.exitCode...).
        process: "readonly",
        // Función para importar módulos.
        require: "readonly",
        // Cierra globals.
      },
      // Cierra languageOptions.
    },
    // Cierra la configuración.
  },
  // Cierra el arreglo.
];
