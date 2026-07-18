import { RivalPlayer } from './RivalPlayer.js';
import { nationalityByCode } from '../data/names.js';
import { strengthFor } from '../data/countries.js';

// nombres de club: mismo patrón prefijo+sufijo en todos los países, con
// vocabulario propio de la petanca de cada uno (pétanque/boule/bocce/...)
const CLUB_WORDS = {
  ES: {
    prefixes: ['PEÑA', 'CLUB', 'SOCIEDAD', 'AGRUPACIÓN', 'CÍRCULO'],
    names: ['EL BOLICHE', 'LA BOINA', 'SAN ISIDRO', 'EL PROGRESO', 'LA AMISTAD',
      'EL CASINO', 'SANTA RITA', 'LOS AMIGOS', 'EL RECREO', 'LA UNIÓN', 'EL LABRADOR', 'LA FRATERNAL'],
  },
  FR: {
    prefixes: ['PÉTANQUE CLUB', 'BOULE CLUB', 'AMICALE', 'ASSOCIATION SPORTIVE', 'LA BOULE'],
    names: ['DU VIEUX PORT', 'LYONNAISE', 'TOULOUSAINE', 'PROVENÇALE', 'DES PLATANES',
      'DE LA CANEBIÈRE', 'DU MIDI', 'MARSEILLAISE', 'DU MISTRAL', 'SAINT-JEAN', 'DE LA GARONNE', 'DU RHÔNE'],
  },
  IT: {
    prefixes: ['BOCCE CLUB', 'CIRCOLO', 'SOCIETÀ', 'UNIONE SPORTIVA', 'ASSOCIAZIONE'],
    names: ['DEL PONTE', 'TOSCANA', 'ROMANA', 'PIEMONTESE', 'DEL CORSO', 'SAN MARCO',
      'DEI CASTAGNI', 'DELLA VALLE', 'DEL LAGO', 'TRASTEVERE', 'DEL FARO', 'SAN LORENZO'],
  },
  BE: {
    prefixes: ['PÉTANQUE CLUB', 'JEU DE BOULES', 'KONINKLIJKE', 'SPORTVERENIGING', 'CERCLE'],
    names: ['DE GAND', 'VALLONNE', 'DU CENTRE', 'DES FLANDRES', 'SAINT-GILLES',
      'DE LA MEUSE', 'BRUXELLOISE', 'DU PARC', 'LIÉGEOISE', 'DU CANAL'],
  },
  CH: {
    prefixes: ['PÉTANQUE CLUB', 'BOULE CLUB', 'SPORTCLUB', 'CERCLE', 'SOCIÉTÉ'],
    names: ['DU LÉMAN', 'DES ALPES', 'BERNOISE', 'ZURICHOISE', 'DU LAC',
      'GENEVOISE', 'DE LA VIEILLE VILLE', 'DU GLACIER', 'HELVÉTIQUE', 'DU RHIN'],
  },
  PT: {
    prefixes: ['CLUBE', 'GRUPO DESPORTIVO', 'ASSOCIAÇÃO', 'SOCIEDADE', 'CÍRCULO'],
    names: ['DO PORTO', 'LISBOETA', 'DO DOURO', 'DO TEJO', 'DOS COIMBRÕES',
      'ATLÂNTICO', 'DA RIBEIRA', 'DO CASTELO', 'DO MONDEGO', 'DAS SETE COLINAS'],
  },
};

// dinero base de un club IA, escalado por nivel de liga (1 Albacete .. 8
// Madrid): los clubes de ligas altas son entidades más grandes y arrancan
// con más caja, lo que alimenta la economía del mercado (quien puede
// permitirse comprar, compra más arriba).
function baseMoneyFor(levelAvg) {
  return Math.round(150 + levelAvg * 60 + Math.random() * 80);
}

// Un equipo de la liga: 2 jugadores IA, o 3 si le tocó tener excedente (el
// tercero sale marcado `forSale` y alimenta el Mercado global). El club "TU
// PEÑA" es un marcador especial cuya plantilla real vive en player.roster
// (no aquí).
export class Club {
  constructor(id, name, levelAvg, isPlayer = false, nationalityCode = null) {
    this.id = id;
    this.name = name;
    this.isPlayer = isPlayer;
    this.country = nationalityCode || 'ES';
    // cada club ficha SIEMPRE de su propia nacionalidad (forzada), nunca
    // una mezcla — así un club español nunca saca a un extranjero y
    // viceversa; el nivel efectivo se escala por el "prestigio" del país
    // (España es la referencia, 1.0 — ver data/countries.js)
    const forceNat = nationalityByCode(this.country);
    const effLevel = levelAvg * strengthFor(this.country);
    // cada club tiene al menos 2 jugadores; un 50% de los clubes tiene un
    // 3º, su excedente, que sale a la venta en el Mercado global
    const size = isPlayer ? 0 : (Math.random() < 0.5 ? 3 : 2);
    const usedNames = new Set();
    this.players = Array.from({ length: size }, (_, i) => {
      const p = RivalPlayer.generate(effLevel, forceNat, usedNames);
      usedNames.add(p.name);
      p.clubId = id;
      if (i === 2) p.forSale = true; // el excedente, no necesariamente el peor
      return p;
    });
    this.money = isPlayer ? 0 : baseMoneyFor(levelAvg);
    this.pts = 0; this.played = 0; this.won = 0; this.lost = 0;
    // arquetipo del capitán (ver data/rivalArchetypes.js): no se muestra de
    // serie, se destapa jugando contra este club una vez (ver Career.js)
    this.seenArchetype = false;
  }

  static randomName(usedNames, country = 'ES') {
    const { prefixes, names } = CLUB_WORDS[country] || CLUB_WORDS.ES;
    let name;
    do {
      const pre = prefixes[Math.floor(Math.random() * prefixes.length)];
      const suf = names[Math.floor(Math.random() * names.length)];
      name = `${pre} ${suf}`;
    } while (usedNames.has(name));
    usedNames.add(name);
    return name;
  }

  get captain() {
    if (!this.players.length) return null;
    return this.players.reduce((best, p) => (p.avgSkill > best.avgSkill ? p : best), this.players[0]);
  }

  avgSkill(externalRoster) {
    if (this.isPlayer) {
      if (!externalRoster || !externalRoster.ids.length) return 5;
      const vals = externalRoster.ids.map((id) => {
        const s = externalRoster.get(id);
        return (s.getStat('pulso') + s.getStat('brazo') + s.getStat('mana') + s.getStat('temple') + s.getStat('aguante')) / 5;
      });
      return vals.reduce((a, b) => a + b, 0) / vals.length;
    }
    return this.players.reduce((a, p) => a + p.avgSkill, 0) / this.players.length;
  }

  recordResult(won) {
    this.played++;
    if (won) { this.won++; this.pts += 3; } else this.lost++;
  }

  toJSON() {
    return {
      id: this.id, name: this.name, isPlayer: this.isPlayer, country: this.country,
      money: this.money, seenArchetype: this.seenArchetype,
      pts: this.pts, played: this.played, won: this.won, lost: this.lost,
      players: this.players.map((p) => ({
        id: p.id, name: p.name, nationality: p.nationality, stats: p.stats, age: p.age,
        forSale: !!p.forSale, discovered: !!p.discovered, levelRange: p.levelRange, statsRevealed: !!p.statsRevealed,
      })),
    };
  }

  static fromJSON(json) {
    const c = new Club(json.id, json.name, 5, json.isPlayer, json.country && json.country !== 'ES' ? json.country : null);
    c.pts = json.pts; c.played = json.played; c.won = json.won; c.lost = json.lost;
    c.money = json.money ?? baseMoneyFor(5);
    c.seenArchetype = json.seenArchetype ?? false;
    c.players = (json.players || []).map((pd) => {
      const p = new RivalPlayer({
        id: pd.id, name: pd.name, nationality: pd.nationality, stats: pd.stats, age: pd.age,
        discovered: pd.discovered, levelRange: pd.levelRange, statsRevealed: pd.statsRevealed,
      });
      p.clubId = json.id;
      p.forSale = !!pd.forSale;
      return p;
    });
    return c;
  }
}
