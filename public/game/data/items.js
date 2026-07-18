// Amuletos de la peña: uno por hueco de plantilla. Caen raros tras ganar un
// torneo, o se pueden comprar directamente en El Bar (más caros, pero sin
// esperar a la suerte). El icono de cada uno es arte ASCII generado por
// fórmula (ver data/art/itemArt.js), no un emoji — un emoji no mide lo
// mismo que una celda de la rejilla en todos los tipos de letra y
// descuadraba las columnas de la lista.
export const ITEMS = {
  petaca: { name: 'LA PETACA DE LA SUERTE', price: 220,
    desc: 'Nunca deja caer del todo el ánimo del abuelo (moral mínima −10 en vez de −20).' },
  panuelo: { name: 'EL PAÑUELO DE LA ABUELA', price: 260,
    desc: 'Le hace inmune a un clima concreto, llueva, sople o achicharre.' },
  reloj: { name: 'EL RELOJ DEL PUEBLO', price: 240,
    desc: 'La barra de potencia se mueve más despacio: más tiempo para calcular el tiro.' },
  guantes: { name: 'GUANTES DE CUERO', price: 200,
    desc: 'Menos temblor en la mano al apuntar: tiro más firme en general.' },
  botas: { name: 'LAS BOTAS DE FAENA', price: 200,
    desc: 'Mejor plantada al tirar: más margen de efecto en la bola.' },
};
export const ITEM_IDS = Object.keys(ITEMS);
