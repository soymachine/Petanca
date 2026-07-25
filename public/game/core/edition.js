// Edición de esta build: 'full' (todo el contenido, la que se envuelve
// para Steam) o 'demo' (solo España, sin Copa de Europa ni el resto de
// países — ver tools/build-editions.mjs). En desarrollo (`npm run dev`)
// y en cualquier build que no pase por ese script, vale SIEMPRE 'full'.
//
// El script de build sobrescribe este archivo justo antes de generar la
// build demo y restaura este mismo valor al terminar (try/finally), así
// que el árbol de trabajo nunca se queda con 'demo' guardado por error.
// No es una constante inyectada por un bundler (este proyecto no bundlea
// public/game a propósito, ver package.json) — es lo más simple que
// funciona con ese diseño: un archivo de verdad distinto por edición, no
// un valor leído en caliente de un JSON.
export const EDITION = 'full';
