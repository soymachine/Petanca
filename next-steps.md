# Next steps

Dos bugs reportados, arreglados:

1. **Asignar ojeador a un país no funcionaba** — `_drawScoutAssign()` procesaba
   su propio teclado (y limpiaba `Enter`) aunque el modal de país estuviera
   abierto encima, así que `_drawAssignCountryModal()` nunca llegaba a ver la
   pulsación y la asignación se descartaba en silencio. Ahora `_drawScoutAssign()`
   corta en seco (mouse y teclado) en cuanto `this.assignCountryFor` está
   activo, igual que ya hacía `_drawMercado()` con su propio modal
   (`screens/PenyaScreen.js`).
2. **Se podía agendar un entreno en un día ya pasado** — dentro de la semana
   actual, los días anteriores a hoy (visualmente "sellados" con relleno ▓)
   seguían siendo clicables como si fueran huecos libres; un entreno agendado
   ahí no lo ejecutaba nunca nadie porque `SeasonClock` solo mira
   `trainings[day]` según el reloj avanza hacia delante. Ahora el hover lleva
   el flag `completed` y tanto el aviso "+ agendar entreno", el tooltip como
   el propio click para agendar quedan desactivados en días ya pasados
   (`screens/AgendaScreen.js`).

Este archivo queda vacío a la espera de la próxima tanda de ideas.
