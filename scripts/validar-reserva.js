// =============================================================================
// ARCHIVO: scripts/validar-reserva.js · PRUEBA LAS REGLAS DEL MODELO
// -----------------------------------------------------------------------------
// Se ejecuta con: node scripts/validar-reserva.js (no necesita .env)
// Valida casos buenos y malos contra el esquema SIN conectarse a la base, y
// muestra cuáles acepta y cuáles rechaza.
//
// TEORÍA
// - new Reserva(datos) crea un documento EN MEMORIA (no lo guarda).
// - documento.validate() ejecuta todas las reglas del esquema sin tocar la base.
// - Spread de objetos: { ...a, ...b } copia a y encima pisa con lo de b.
// - Desestructuración de arreglos: const [x, y] = par toma sus dos elementos.
// =============================================================================

// Trae solo el modelo. No importa la conexión: no hace falta.
const { Reserva } = require("../src/modelos/reserva");

// Una reserva VÁLIDA que sirve de base para todos los casos.
const reservaValida = {
  // Nombre.
  estudiante: "Ana Ejemplo",
  // Email con @.
  email: "ana@example.com",
  // Sala de la lista.
  sala: "Sala Norte",
  // Fecha no vacía.
  fecha: "2026-10-21",
  // Turno de la lista.
  turno: "Mañana",
  // Entero entre 1 y 6.
  personas: 2,
  // Cierra el objeto.
};

// Casos de prueba. Cada caso es un par [nombre, cambios]: qué campo se modifica
// respecto de la reserva válida.
const casos = [
  // Sin cambios: debe aceptarse.
  ["Reserva válida", {}],
  // "4" como texto: Mongoose lo convierte a número y se acepta.
  ["Personas como texto numérico", { personas: "4" }],
  // Solo espacios: trim lo deja vacío y required lo rechaza.
  ["Estudiante vacío", { estudiante: "   " }],
  // Sin @: lo rechaza match.
  ["Email sin @", { email: "ana.example.com" }],
  // Sala fuera de la lista: lo rechaza enum.
  ["Sala no permitida", { sala: "Sala Este" }],
  // Turno fuera de la lista: enum.
  ["Turno no permitido", { turno: "Madrugada" }],
  // Fecha vacía: required.
  ["Fecha vacía", { fecha: "" }],
  // 0: lo rechaza min.
  ["Personas 0", { personas: 0 }],
  // 7: lo rechaza max.
  ["Personas 7", { personas: 7 }],
  // 2.5: lo rechaza el validador Number.isInteger.
  ["Personas 2.5", { personas: 2.5 }],
  // "abc": no se puede convertir a número (error de conversión).
  ['Personas "abc"', { personas: "abc" }],
  // "cancelada": no está en ESTADOS, lo rechaza enum.
  ["Estado no permitido", { estado: "cancelada" }],
  // Cierra el arreglo.
];

// Función principal.
async function main() {
  // Recorre los casos desestructurando cada par en nombre y cambios.
  for (const [nombre, cambios] of casos) {
    // Crea un documento en memoria: copia la reserva válida y encima pisa los
    // campos del caso.
    const reserva = new Reserva({ ...reservaValida, ...cambios });
    // try: la validación puede fallar.
    try {
      // Ejecuta todas las reglas del esquema sin tocar la base.
      await reserva.validate();
      // Si pasó, lo informa mostrando personas (para ver que "4" quedó como 4)
      // y estado (para ver el valor por defecto "pendiente"). La plantilla
      // literal es la línea del medio.
      console.log(
        `${nombre}: aceptada (personas: ${reserva.personas}, estado: ${reserva.estado})`,
      );
      // Si la validación falló...
    } catch (error) {
      // ...y el error NO es de validación (no tiene errors), es inesperado: se
      // vuelve a lanzar para que lo atrape el .catch() de main.
      if (!error.errors) throw error;
      // Si es de validación, muestra qué campos rechazó.
      console.log(
        `${nombre}: rechazada (${Object.keys(error.errors).join(", ")})`,
      );
      // Cierra el catch.
    }
    // Cierra el for.
  }
  // Cierra main.
}

// Ejecuta main y atrapa un error inesperado.
main().catch((error) => {
  // Muestra solo el nombre del error.
  console.error("No se pudo completar la validación:", error.name);
  // Marca la salida con error.
  process.exitCode = 1;
  // Cierra el .catch().
});
