export const CLIMAS = {
  SOL:     { icon: '☼', color: '#ffe14d', label: 'SOL' },
  LLUVIA:  { icon: '☂', color: '#6fb6e8', label: 'LLUVIA' },
  VIENTO:  { icon: '≋', color: '#9fd8e8', label: 'VENDAVAL' },
  CALOR:   { icon: '♨', color: '#ff9c5b', label: 'CALOR EXTREMO' },
  NIEBLA:  { icon: '≡', color: '#a8b0b0', label: 'NIEBLA CERRADA' },
  HELADA:  { icon: '❄', color: '#cfe8f5', label: 'HELADA' },
  TORMENTA:{ icon: '⚡', color: '#c8a0e8', label: 'TORMENTA' },
};

export function isRainy(w) { return w === 'LLUVIA' || w === 'TORMENTA'; }
export function isWindy(w) { return w === 'VIENTO' || w === 'TORMENTA'; }

export function avisoClima(t) {
  return {
    LLUVIA: 'Se están poniendo negras las nubes... huele a tierra mojada.',
    VIENTO: 'Los plátanos del paseo empiezan a agitarse. Viene aire.',
    CALOR: 'No corre ni gota de aire. Esto va a ser un horno.',
    NIEBLA: 'Una bruma espesa empieza a tragarse el fondo de la pista.',
    HELADA: 'El relente cuaja en la tierra. Esto va a estar resbaladizo.',
    TORMENTA: 'El cielo se ha puesto negro de golpe. Esto pinta muy mal.',
    SOL: 'Parece que abre. El cielo se despeja.',
  }[t];
}

export function cambioClima(t) {
  return {
    LLUVIA: 'Los paraguas brotan en la grada. Cuesta ver las bolas al fondo.',
    VIENTO: 'Las boinas vuelan. Los tiros bombeados serán una lotería.',
    CALOR: 'El albero quema. La stamina se va a derretir.',
    NIEBLA: 'No se ve ni el boliche. Habrá que tirar a ciegas.',
    HELADA: 'La tierra suena a hueco. Las bolas van a rodar el doble.',
    TORMENTA: '¡Diluvia y sopla a la vez! Esto ya es otra cosa.',
    SOL: 'Vuelve la calma. Petanca de manual.',
  }[t];
}
