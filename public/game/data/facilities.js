// Mejoras del descampado (terreno de entrenamiento): inversión con retorno
// permanente para toda la plantilla, no solo para un abuelo. Cada mejora
// tiene varios niveles: se empieza barato y limitado, y se puede seguir
// invirtiendo más adelante para estirar el efecto.

// qué instalación gobierna el premio de cada stat de entreno — ver
// FacilityManager.trainingStatBonus() y data/trainingDrills.js
export const TRAINING_FACILITY_FOR = {
  pulso: 'diana', brazo: 'gimnasio', mana: 'efecto', temple: 'graderio', aguante: 'resistencia',
};

export const FACILITIES = [
  { id: 'luz', name: 'ILUMINACIÓN', levels: [
    { price: 300, staSaved: 10, desc: 'Focos para entrenar de noche: los entrenamientos cuestan 10 STA menos.' },
    { price: 650, staSaved: 18, desc: 'Focos de xenón y horario ampliado: los entrenamientos cuestan 18 STA menos.' },
  ] },
  { id: 'cobertizo', name: 'COBERTIZO', levels: [
    { price: 450, recovery: 8, desc: 'Techo y bancos: toda la peña recupera +8 STA extra al volver de cada torneo.' },
    { price: 900, recovery: 14, desc: 'Cobertizo ampliado con catres: +14 STA extra al volver de cada torneo.' },
  ] },
  { id: 'marcador', name: 'MARCADOR DE VERDAD', levels: [
    { price: 250, sweetBonus: 0.02, desc: 'Un marcador de madera pintado a mano: el punto dulce de la potencia es un poco más ancho.' },
    { price: 550, sweetBonus: 0.045, desc: 'Marcador electromecánico casero: el punto dulce de la potencia es notablemente más ancho.' },
  ] },
  // instalaciones de entreno, una por stat (antes era un único "gimnasio"
  // que multiplicaba el premio de CUALQUIER entrenamiento por igual): así
  // el jugador elige en qué especializar el club, no solo cuánto invertir
  { id: 'diana', name: 'DIANA DE PRECISIÓN', levels: [
    { price: 500, statBonus: 2, desc: 'Una diana pintada a mano junto al boliche: ARRIME da +2 de pulso en vez de +1.' },
    { price: 1000, statBonus: 3, desc: 'Diana de competición con marcas de distancia: ARRIME da +3 de pulso.' },
  ] },
  { id: 'gimnasio', name: 'RINCÓN DE PESAS', levels: [
    { price: 550, statBonus: 2, desc: 'Un par de mancuernas oxidadas: TIRO da +2 de brazo en vez de +1.' },
    { price: 1100, statBonus: 3, desc: 'Banco y barra de verdad: TIRO da +3 de brazo.' },
  ] },
  { id: 'efecto', name: 'CARRIL DE EFECTO', levels: [
    { price: 500, statBonus: 2, desc: 'Una bola fija para practicar el rodeo: EFECTO da +2 de maña en vez de +1.' },
    { price: 1000, statBonus: 3, desc: 'Carril con obstáculos en ángulos distintos: EFECTO da +3 de maña.' },
  ] },
  { id: 'graderio', name: 'GRADERÍO DE PRESIÓN', levels: [
    { price: 500, statBonus: 2, desc: 'Cuatro bancos donde se sienta quien pasaba por ahí: PRESIÓN da +2 de temple en vez de +1.' },
    { price: 1000, statBonus: 3, desc: 'Graderío con megafonía casera para meter más ruido: PRESIÓN da +3 de temple.' },
  ] },
  { id: 'resistencia', name: 'PISTA DE RESISTENCIA', levels: [
    { price: 500, statBonus: 2, desc: 'Marcas cada 10 tiradas para no perder la cuenta: FONDO da +2 de aguante en vez de +1.' },
    { price: 1000, statBonus: 3, desc: 'Pista ampliada para tandas más largas: FONDO da +3 de aguante.' },
  ] },
  { id: 'grada', name: 'GRADA DE MADERA', levels: [
    { price: 500, moneyMult: 1.15, desc: 'Sitio para que se siente el pueblo a mirar: la taquilla deja un 15% más de premio en los partidos ganados.' },
    { price: 950, moneyMult: 1.30, desc: 'Grada cubierta con más aforo: la taquilla deja un 30% más de premio en los partidos ganados.' },
  ] },
  { id: 'cartel', name: 'CARTEL EN LA FACHADA', levels: [
    { price: 350, sponsorMult: 1.25, desc: 'Publicidad bien a la vista de todo el que pase: los patrocinadores pagan un 25% más por el trato.' },
    { price: 700, sponsorMult: 1.50, desc: 'Cartel luminoso en la fachada: los patrocinadores pagan un 50% más por el trato.' },
  ] },
  { id: 'botiquin', name: 'BOTIQUÍN DEL HOGAR', levels: [
    { price: 400, eventMult: 0.6, desc: 'Vendas, árnica y buenos consejos a mano: baja bastante la probabilidad de contratiempos físicos.' },
    { price: 800, eventMult: 0.35, desc: 'Botiquín surtido con fisio de confianza: la probabilidad de contratiempos físicos baja aún más.' },
  ] },
];
