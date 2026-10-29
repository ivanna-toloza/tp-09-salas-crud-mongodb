const { Reserva } = require("../src/modelos/reserva");

const reservaValida = {
  estudiante: "Ana Ejemplo",
  email: "ana@example.com",
  sala: "Sala Norte",
  fecha: "2026-10-21",
  turno: "Mañana",
  personas: 2,
};

const casos = [
  ["Reserva válida", {}],
  ["Personas como texto numérico", { personas: "4" }],
  ["Estudiante vacío", { estudiante: "   " }],
  ["Email sin @", { email: "ana.example.com" }],
  ["Sala no permitida", { sala: "Sala Este" }],
  ["Turno no permitido", { turno: "Madrugada" }],
  ["Fecha vacía", { fecha: "" }],
  ["Personas 0", { personas: 0 }],
  ["Personas 7", { personas: 7 }],
  ["Personas 2.5", { personas: 2.5 }],
  ['Personas "abc"', { personas: "abc" }],
  ["Estado no permitido", { estado: "cancelada" }],
];

async function main() {
  for (const [nombre, cambios] of casos) {
    const reserva = new Reserva({ ...reservaValida, ...cambios });
    try {
      await reserva.validate();
      console.log(
        `${nombre}: aceptada (personas: ${reserva.personas}, estado: ${reserva.estado})`,
      );
    } catch (error) {
      if (!error.errors) throw error;
      console.log(
        `${nombre}: rechazada (${Object.keys(error.errors).join(", ")})`,
      );
    }
  }
}

main().catch((error) => {
  console.error("No se pudo completar la validación:", error.name);
  process.exitCode = 1;
});
