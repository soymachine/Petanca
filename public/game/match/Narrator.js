import { rnd } from '../core/utils.js';

const pick = (arr) => arr[Math.floor(rnd(0, arr.length))];

const WEATHER_TAG = {
  LLUVIA: 'con el suelo encharcado',
  VIENTO: 'con el viento moviendo hasta las boinas',
  CALOR: 'a pleno sol y sudando la gota gorda',
  NIEBLA: 'sin apenas ver el boliche',
  HELADA: 'con la tierra dura como una piedra',
  TORMENTA: 'en pleno diluvio',
};

// Comentarista de barra de bar: una línea de color tras cada mano. Además
// del ganador y los puntos, tiene en cuenta el clima, si el partido está a
// tiro de sentencia (match point) y si es derbi o némesis, para no sonar
// siempre igual pase lo que pase.
export class Narrator {
  static line(type, ctx) {
    const { me, riv, points, weather, isDerby, isNemesis, scoreP, scoreA, target } = ctx;
    const wTag = weather && WEATHER_TAG[weather] ? ` ${WEATHER_TAG[weather]}` : '';
    const matchPointP = type === 'manoP' && target && scoreP >= target;
    const matchPointA = type === 'manoA' && target && scoreA >= target;

    if (matchPointP) {
      return pick([
        `¡SE ACABÓ! ${me} cierra el partido${wTag}. ${points} puntos y a recoger las bolas.`,
        `¡PUNTO Y PARTIDO! ${me} sentencia ante ${riv}.`,
        `Última mano para ${me}: ${points} puntos que valen el partido entero.`,
      ]);
    }
    if (matchPointA) {
      return pick([
        `${riv} cierra el partido. Se acabó por hoy.`,
        `Mano y partido para ${riv}. Toca tragar saliva.`,
      ]);
    }

    const rivalryTag = isDerby ? ' — esto es EL DERBI, aquí no valen medias tintas' : isNemesis ? ' — contra el némesis, cada punto sabe distinto' : '';

    switch (type) {
      case 'manoP':
        if (points >= 2) {
          return pick([
            `¡${points} puntos de golpe! En el bar ya invitan a chatos en tu nombre${rivalryTag}.`,
            `${me} se sacude el polvo de la boina. ${points} puntos y silencio en la grada.`,
            `Mano redonda de ${me}: ${points} puntos${wTag} y el rival se queda mirando al suelo.`,
            `${points} puntos de un tirón. ${riv} no se lo esperaba${wTag}.`,
          ]);
        }
        return pick([
          `Punto para ${me}. ${riv} mira el boliche como si le debiera dinero${rivalryTag}.`,
          `Arrime fino de ${me}. Alguien murmura: "eso no se enseña".`,
          `${me} anota. La grada de jubilados asiente con la cabeza.`,
          `Punto justo${wTag}. ${me} no se complica la vida.`,
          `${me} se arrima al boliche como si lo llevara imantado.`,
        ]);
      case 'manoA':
        return pick([
          `${riv} se apunta la mano. Aprieta el partido${rivalryTag}.`,
          `Punto para ${riv}. Se oye un "¡uy!" colectivo desde el banco.`,
          `${riv} sonríe bajo la boina. Esto no está sentenciado.`,
          `${riv} responde${wTag}. La cosa sigue igualada.`,
          `Se le complica a ${me}: mano para ${riv}.`,
        ]);
      case 'golpe':
        return pick([
          '¡PETARDAZO! Bola apartada de un tiro seco. El clásico "te la quito".',
          'Choque de acero. Las bolas cambian de sitio y alguien aplaude.',
          '¡Seco y limpio! Ni el boliche se movió, pero la bola rival ya no está.',
          'Tiro de castigo: la bola sale disparada y deja el hueco libre.',
        ]);
      case 'nula':
        return pick([
          'Mano nula. Los dos se miran y fingen que era lo que querían.',
          'Nadie se lleva la mano. Empate técnico y a la siguiente.',
        ]);
      default:
        return '';
    }
  }

  // "el boliche es tuyo": línea al colocarlo, según quién elige y qué
  // distancia — corta favorece el arrime, larga favorece el brazo
  static jackPlaced(dist, byPlayer, riv) {
    if (dist === 'corta') {
      return byPlayer
        ? pick(['Boliche corto: aquí se juega a arrimar, avisa a tu pulso.', 'Lo dejas cerca. Terreno de finura.'])
        : pick([`${riv} lo deja corto: busca el arrime fino.`, `${riv} coloca el boliche cerca. Aquí no vale pegar fuerte.`]);
    }
    if (dist === 'larga') {
      return byPlayer
        ? pick(['Boliche largo: aquí manda quien más llegue y más pegue.', 'Lo mandas lejos. Que hable el brazo.'])
        : pick([`${riv} lo manda lejos: busca que decida la potencia.`, `${riv} coloca el boliche largo. Va a hacer falta brazo.`]);
    }
    return byPlayer
      ? pick(['Boliche a media distancia: terreno neutral, gana quien juegue mejor.', 'Lo dejas a media pista. Nada de trampas.'])
      : pick([`${riv} lo deja a media distancia. Terreno neutral.`]);
  }
}
