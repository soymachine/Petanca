// Mejoras del descampado (terreno de entrenamiento): inversión con retorno
// permanente para toda la plantilla, no solo para un abuelo. Cada mejora
// tiene varios niveles: se empieza barato y limitado, y se puede seguir
// invirtiendo más adelante para estirar el efecto.
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
  { id: 'gimnasio', name: 'RINCÓN DE PESAS', levels: [
    { price: 550, statBonus: 2, desc: 'Un par de mancuernas oxidadas: los entrenamientos superados dan +2 de stat en vez de +1.' },
    { price: 1100, statBonus: 3, desc: 'Banco y barra de verdad: los entrenamientos superados dan +3 de stat.' },
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
