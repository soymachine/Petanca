import { ITEMS, ITEM_IDS } from '../data/items.js';
import { rnd, clamp } from '../core/utils.js';
import { BoardObjective } from './BoardObjective.js';
import { rollWeeklyGoal } from '../data/boardObjectives.js';
import { STAT_KEYS, STAT_LABEL } from '../data/abuelos.js';
import { DIFFICULTIES } from '../data/difficulty.js';
import { Cup } from '../domain/Cup.js';
import { TransferPool } from '../domain/TransferPool.js';
import { advanceScoutingWeek, currentMarketSeedKeys } from '../domain/Scouting.js';
import { EuropeanCup } from '../domain/EuropeanCup.js';
import { rivalPersonalityLine } from '../data/rivalPersonality.js';
import { countryTag } from '../data/countries.js';
import { chemistryKey, chemistryLevel, CHEMISTRY_LEVELS } from '../domain/Chemistry.js';
import { Chronicle } from '../match/Chronicle.js';
import { composeBiography } from '../data/biografias.js';
import { boardPresidentFor, boardAdj } from '../data/boardPresident.js';

function maybeDropItem(roster, candidates) {
  const eligible = candidates.filter((i) => !roster.get(i).item);
  if (!eligible.length || Math.random() > 0.18) return null;
  const id = eligible[Math.floor(rnd(0, eligible.length))];
  const itemId = ITEM_IDS[Math.floor(rnd(0, ITEM_IDS.length))];
  const item = { id: itemId };
  if (itemId === 'panuelo') {
    const opts = ['LLUVIA', 'VIENTO', 'CALOR', 'NIEBLA', 'HELADA'];
    item.clima = opts[Math.floor(rnd(0, opts.length))];
  }
  roster.get(id).item = item;
  return { i: id, item };
}

// Cierra la jornada de liga: reparte premio, actualiza moral/roces,
// patrocinios, junta directiva, hemeroteca, amuletos y — si tocaba — el
// ascenso o descenso de temporada. Es el único sitio donde todas las
// piezas de "manager" se tocan a la vez.
export class Career {
  constructor(player, nameOf) {
    this.player = player;
    this.nameOf = nameOf; // (id) => nombre para mensajes
  }

  // Cierra el partido de liga de la jornada: premio, moral, patrocinio,
  // campaña, hemeroteca, y — si era la última jornada — ascenso/descenso.
  finishWeeklyMatch(ctx, won, finalScoreP, finalScoreA, chronicleFacts = null) {
    const p = this.player;
    const league = ctx.league;
    const opponent = ctx.opponentClub;
    const base = { xp: 60 + league.level * 25, money: 30 + league.level * 20 };
    let xp = won ? base.xp : Math.round(base.xp * 0.2);
    let money = won ? Math.round(base.money * p.facilities.matchMoneyMultiplier()) : 0;
    if (won) money += p.sponsorship.shirtWinBonus();

    let revenge = false;
    if (won && p.nemesis && p.nemesis.city === opponent.id) { xp = Math.round(xp * 1.5); revenge = true; p.nemesis = null; }
    const stormWin = won && ctx.stormPlayed;
    if (stormWin) { xp = Math.round(xp * 2); money = Math.round(money * 2); p.stormWins++; }

    // fiestas del pueblo: la peña entera se anima solo por jugar en fiestas,
    // y si encima se gana, la taquilla de feria deja bastante más dinero
    if (ctx.festival) {
      for (const id of p.roster.ids) p.roster.get(id).addMoral(5);
      if (won) money = Math.round(money * 1.4);
      p.news.push(won
        ? `${ctx.festival}: ${p.clubName} gana en fiestas, con la plaza a rebosar. La taquilla de feria deja bastante más de lo normal.`
        : `${ctx.festival}: se pierde, pero el pueblo entero anduvo en la plaza animando. Buen ambiente pese al resultado.`);
    }

    const isDerby = p.derbyClub && p.derbyClub.id === opponent.id;
    if (isDerby) {
      xp = Math.round(xp * 1.25);
      if (won) p.derbyHistory.wins++; else p.derbyHistory.losses++;
      p.news.push(won
        ? `¡EL DERBI! ${p.clubName} se lleva el partido contra su eterno rival, ${opponent.name} (${p.derbyHistory.wins}-${p.derbyHistory.losses} en el historial).`
        : `EL DERBI se lo lleva ${opponent.name}. Se aprieta los dientes hasta la próxima (${p.derbyHistory.wins}-${p.derbyHistory.losses}).`);
      if (opponent.captain) p.news.push(`DESDE ${opponent.name}: ${rivalPersonalityLine(opponent, p.publicImage)}`);
    }

    const promiseBroken = !!(p.pressPromise && p.pressPromise.opponentId === opponent.id && !won && p.pressPromise.loseBonus < 0);
    if (p.pressPromise && p.pressPromise.opponentId === opponent.id) {
      if (promiseBroken) {
        for (const id of p.roster.ids) p.roster.get(id).addMoral(p.pressPromise.loseBonus);
        p.news.push(`LA PRENSA NO OLVIDA: tras lo dicho antes del partido, la derrota sienta especialmente mal.`);
      }
      p.pressPromise = null;
    }

    {
      const mySkill = p.club.avgSkill(p.roster);
      const oppSkill = opponent.avgSkill();
      const resultMargin = finalScoreP - finalScoreA;
      p.boardConfidence = clamp(p.boardConfidence + boardConfidenceDelta(won, resultMargin, mySkill, oppSkill), 0, 100);
    }
    let ultimatum = false, crisisDemotion = false;
    if (p.boardConfidence <= 0) {
      ultimatum = true;
      p.boardUltimatums++;
      if (p.boardCrisis) {
        // segundo ultimátum en la misma temporada: la junta ya no se
        // conforma con una multa — recorta plantilla de aspiraciones y
        // os manda a la categoría inferior de un plumazo si se puede. El
        // cambio de liga en sí se aplica al final (después de resolver
        // esta misma jornada en la liga actual, no antes).
        crisisDemotion = league.level > 1;
        money -= 250;
        p.boardConfidence = 45;
        const pres = boardPresidentFor(p.clubName);
        if (crisisDemotion) {
          p.news.push(`${pres.name.toUpperCase()} YA NO AGUANTA MÁS: segundo ultimátum de la temporada. Os bajan de categoría sin miramientos, a ${cityAt(league.level - 1)}, y multa de 250€.`);
        } else {
          p.news.push(`${pres.name.toUpperCase()} YA NO AGUANTA MÁS: segundo ultimátum de la temporada. Ya no quedan categorías más abajo, pero la multa es de 250€ y la paciencia sigue bajo mínimos.`);
        }
      } else {
        p.boardCrisis = true;
        money -= 100;
        p.boardConfidence = 35;
        const pres = boardPresidentFor(p.clubName);
        p.news.push(`ULTIMÁTUM DE ${pres.name.toUpperCase()}: ${pres.tone}. La paciencia se ha agotado — multa de 100€, como vuelva a pasar esta temporada no será solo dinero.`);
      }
    }

    p.club.recordResult(won);
    opponent.seenArchetype = true; // ya te has visto las caras: el estilo de juego queda a la vista para siempre
    // marcador de hoy, para poder enseñarlo al hacer rollover sobre este
    // día ya jugado en la Agenda (ver AgendaScreen._dayEntry)
    p.matchResults[p.seasonClock.day] = { kind: 'league', scoreP: finalScoreP, scoreA: finalScoreA, won, oppName: opponent.name, isDerby };
    const resultNews = chronicleFacts
      ? Chronicle.compose(chronicleFacts, {
          won, scoreP: finalScoreP, scoreA: finalScoreA, rivalName: opponent.name,
          clubName: p.clubName, venueLabel: `la liga de ${league.cityName}`, promiseBroken,
          publicImage: p.publicImage,
        })
      : (won
          ? `${p.clubName} gana ${finalScoreP}-${finalScoreA} a ${opponent.name} en la liga de ${league.cityName}.`
          : `${opponent.name} se lleva la jornada ${finalScoreA}-${finalScoreP} frente a ${p.clubName}.`);
    if (won) {
      p.wins++;
      if (!p.citiesWon.includes(league.cityName)) p.citiesWon.push(league.cityName);
      if (revenge) p.nemesisDefeats++;
      p.news.push(resultNews);
      const winMargin = finalScoreP - finalScoreA;
      if (!p.bestMarginWin || winMargin > p.bestMarginWin.margin) {
        p.bestMarginWin = { margin: winMargin, rival: opponent.name, cityName: league.cityName };
      }
    } else {
      p.losses++;
      p.nemesis = { rival: opponent.name, rivalIdx: 0, city: opponent.id };
      p.news.push(resultNews);
    }

    // XP de participación de ESTE partido por abuelo (aparte de la de
    // calidad de tirada, que Game.js suma después desde Match.xpGain): se
    // guarda para poder enseñarla en ResultScreen, no solo aplicarla
    const xpPerAbuelo = {};
    for (const id of p.roster.ids) {
      if (ctx.usados.includes(id)) {
        if (won) p.roster.get(id).addMoral(8);
        const gained = won ? 6 + 10 : 6;
        this._grantXp(p, id, gained);
        xpPerAbuelo[id] = (xpPerAbuelo[id] || 0) + gained;
      }
      else p.roster.get(id).addMoral(-4);
    }
    this.settleDebts(p, ctx.usados, opponent.id, won);
    this.trackChemistry(p, ctx.usados, won);
    if (won) {
      for (const id of ctx.usados) {
        const streak = p.roster.get(id).formStreak;
        if (streak === 3 || streak === 5 || (streak >= 8 && streak % 4 === 0)) {
          p.news.push(`¡RACHA! ${this.nameOf(id)} encadena ${streak} victorias seguidas y llega a la mesa con otro aire.`);
        }
      }
    }
    const margin = finalScoreP - finalScoreA;
    let weeklyGoalResult = null;
    if (p.weeklyGoal) {
      const bestStreak = ctx.usados.reduce((m, id) => Math.max(m, p.roster.get(id).formStreak), 0);
      const metWeekly = p.weeklyGoal.check(won, margin, bestStreak);
      if (metWeekly) {
        money += p.weeklyGoal.reward;
        p.news.push(`OBJETIVO DE LA JUNTA CUMPLIDO: ${p.weeklyGoal.desc} +${p.weeklyGoal.reward}€.`);
      } else if (p.weeklyGoal.penalty > 0) {
        money -= p.weeklyGoal.penalty;
        p.news.push(`La junta no ve cumplido su objetivo semanal (${p.weeklyGoal.desc}). -${p.weeklyGoal.penalty}€.`);
      }
      weeklyGoalResult = { met: metWeekly, goal: p.weeklyGoal };
      p.weeklyGoal = rollWeeklyGoal();
    }

    p.roster.applyRivalryJealousy(ctx.usados);
    const diff = DIFFICULTIES.find((d) => d.id === p.difficulty) || DIFFICULTIES[1];
    const upkeep = Math.round(p.roster.totalUpkeep() * diff.wageMult);
    money -= upkeep;
    if (p.money + money < 0) {
      for (const id of p.roster.ids) p.roster.get(id).addMoral(-6);
      p.news.push(`Las arcas de ${p.clubName} están en números rojos: la nómina de ${upkeep}€ pasa factura a la moral de la peña.`);
    }
    for (const id of p.roster.ids) {
      const s = p.roster.get(id);
      s.recoverWeekly(p.facilities.extraRecoveryOnTravel());
      s.moralWeeklyDecay();
    }

    let itemDrop = null;
    if (won && league.level >= 3) {
      itemDrop = maybeDropItem(p.roster, ctx.usados);
      if (itemDrop) p.news.push(`${this.nameOf(itemDrop.i)} vuelve con ${ITEMS[itemDrop.item.id].name} bajo el brazo.`);
    }

    const betResult = ctx.settleBet(won);
    if (betResult) money += betResult.won ? betResult.amount : -betResult.amount;

    let sponsorResult = null;
    const activeDeal = p.sponsorship.currentDeal();
    if (activeDeal) {
      const margin = finalScoreP - finalScoreA;
      if (won && activeDeal.metric === 'wins') sponsorResult = p.sponsorship.advance('wins', 1, p.seasonClock.weekIndex);
      else if (won && activeDeal.metric === 'ligaPts') sponsorResult = p.sponsorship.advance('ligaPts', 3, p.seasonClock.weekIndex);
      else if (won && margin >= 6 && activeDeal.metric === 'cleanSweeps') sponsorResult = p.sponsorship.advance('cleanSweeps', 1, p.seasonClock.weekIndex);
      else if (revenge && activeDeal.metric === 'finalWins') sponsorResult = p.sponsorship.advance('finalWins', 1, p.seasonClock.weekIndex);
      else { const tick = p.sponsorship.tickJornada(p.seasonClock.weekIndex); if (tick && tick.expired) sponsorResult = tick; }
    }
    if (sponsorResult && sponsorResult.completed) {
      const bonus = Math.round(sponsorResult.reward * p.facilities.sponsorMultiplier());
      sponsorResult.reward = bonus;
      money += bonus;
      p.news.push(`Patrocinio cumplido: ${sponsorResult.deal.name} paga ${bonus}€.`);
    } else if (sponsorResult && sponsorResult.expired) {
      p.news.push(`El patrocinio de ${sponsorResult.deal.name} se acaba sin cumplirse.`);
    }

    // resto de la jornada: los otros 4 partidos se resuelven por estadísticas
    this._simulateRestOfMatchday(league, ctx.matchdayIndex ?? league.matchday);
    league.matchday++;

    // el resto de ligas (los 7 niveles españoles donde ahora mismo no
    // juegas, más las 3 ligas de fondo de cada país extranjero) avanzan
    // una jornada en paralelo, 100% IA — así sus clasificaciones son
    // reales y no un empate a cero eterno cuando por fin haga falta
    // consultarlas (p.ej. para la Copa de Europa)
    for (const [lvl, lg] of p.leagueWorld.leagues) {
      if (lvl !== league.level) this._simulateLeagueMatchday(lg);
    }
    for (const world of p.foreignLeagues.values()) {
      for (const [, lg] of world.leagues) this._simulateLeagueMatchday(lg);
    }

    // el Mercado global también se mueve solo esta semana: clubes IA de
    // cualquier liga (española o de cualquier país extranjero) compran y
    // venden excedente entre ellos según su propia necesidad, no solo
    // cuando te toca a ti
    TransferPool.simulateWeeklyMarket(p.leagueWorld, p.foreignLeagues);
    // tus ojeadores también trabajan esta semana: destapan excedentes
    // nuevos en el país que estén ojeando, o completan el informe de quien
    // llevaran vigilando en concreto
    advanceScoutingWeek(p, p.seasonClock.weekIndex);
    // algunos excedentes pueden haber cambiado de manos entre clubes IA (o
    // dejado de estar en venta): los ojeadores en modo jugador cuyo
    // objetivo ya no existe como tal se liberan
    p.scoutStaff.pruneAssignments(currentMarketSeedKeys(p));

    // el descenso por crisis de junta se aplica aquí (ya resuelta la jornada
    // en la liga actual) y no si la temporada se acaba esta misma semana,
    // para no pisarse con el ascenso/descenso normal de fin de temporada
    if (crisisDemotion && !league.isSeasonOver) {
      const fromLevel = league.level;
      p.currentLeagueLevel = fromLevel - 1;
      p.leagueWorld.movePlayer(fromLevel, p.currentLeagueLevel, p.clubName);
    }

    // ¿se acaba la temporada? ascenso de los 2 primeros, descenso de los 2 últimos
    let seasonEnd = null;
    if (league.isSeasonOver) {
      p.seasonsPlayed++;
      p.boardCrisis = false; // temporada nueva, cuenta atrás de ultimátums a cero
      for (const id of p.roster.ids) p.roster.get(id).age++;
      this._ageRivalWorld(p, league);
      const rank = league.myRank();
      const table = league.standings();
      let boardResult = null;
      if (p.boardGoal) {
        const bo = new BoardObjective(1); bo.goal = p.boardGoal;
        boardResult = bo.settle(rank);
        money += boardResult.amount;
        p.boardConfidence = clamp(p.boardConfidence + (boardResult.met ? 20 : -25), 0, 100);
        const pres = boardPresidentFor(p.clubName);
        p.news.push(boardResult.met
          ? `${pres.name} respira: cumplís el objetivo. +${boardResult.amount}€.`
          : `${pres.name} no queda ${boardAdj(pres, 'contento', 'contenta')}: no llegáis al objetivo. ${boardResult.amount}€.`);
      }
      if (rank === 1) {
        p.seasonTitles++;
        p.addAnnal(`¡CAMPEONES DE LA LIGA DE ${league.cityName}! ${p.clubName} corona la temporada en lo más alto de su categoría.`);
      }

      const promoted = rank <= 2 && league.level < 8;
      const relegated = rank >= 9 && league.level > 1;
      const fromLevel = league.level;
      if (promoted) {
        p.promotions++;
        p.currentLeagueLevel = league.level + 1;
        p.leagueWorld.movePlayer(fromLevel, p.currentLeagueLevel, p.clubName);
        p.news.push(`¡ASCENSO! ${p.clubName} sube a la liga de ${cityAt(p.currentLeagueLevel)} tras acabar ${rank}º.`);
        if (p.currentLeagueLevel === 8 && !p.reachedTopFlight) {
          p.reachedTopFlight = true;
          p.addAnnal(`${p.clubName} PISA MADRID POR PRIMERA VEZ: ascenso a la máxima categoría de la liga federada.`);
        }
      } else if (relegated) {
        p.relegations++;
        p.currentLeagueLevel = Math.max(1, league.level - 1);
        p.leagueWorld.movePlayer(fromLevel, p.currentLeagueLevel, p.clubName);
        p.news.push(`DESCENSO: ${p.clubName} baja a la liga de ${cityAt(p.currentLeagueLevel)} tras acabar ${rank}º.`);
      } else {
        p.news.push(`Fin de temporada en ${league.cityName}: ${p.clubName} acaba ${rank}º de 10.`);
        league.startNewSeason();
      }
      // en los tres casos (ascenso/descenso/repesca) la liga que toca ahora
      // arranca con matchday 0: hay que retomar el offset semana↔jornada
      // para que el calendario siga encontrando los domingos de partido
      p.seasonClock.markSeasonStart();
      // la Agenda solo deja retroceder hasta la primera semana de la
      // temporada EN CURSO: los resultados de la que se acaba de cerrar ya
      // no se pueden consultar navegando hacia atrás, así que no hace
      // falta arrastrarlos (evitaría crecer sin límite en el guardado)
      p.matchResults = {};
      p.friendliesLeft = 3;
      if (!p.cup || p.cup.finished) {
        p.cup = Cup.generate(p.leagueWorld, p.club, p.club.avgSkill(p.roster));
        const day = p.seasonClock.firstFreeDayFrom(3, p.league);
        p.seasonClock.scheduleCup(day);
        p.news.push(`¡ARRANCA LA COPA DE ESPAÑA! ${p.clubName} debuta en ${p.cup.roundName.toLowerCase()} contra ${p.cup.playerOpponent().name}.`);
      }

      // Copa de Europa: solo si acabas de cerrar una temporada en el nivel
      // más alto (Madrid, 8) quedando entre los 4 primeros — se sortea con
      // los 4 primeros de esa liga y los 4 primeros de la liga de nivel 8
      // de cada uno de los 5 países extranjeros, totalmente al azar y sin
      // mirar país.
      if (fromLevel === 8 && rank <= 4 && (!p.euroCup || p.euroCup.finished)) {
        const groups = [{ country: 'ES', clubs: table.slice(0, 4) }];
        for (const [code, world] of p.foreignLeagues) {
          const top = world.leagueOf(8);
          if (top) groups.push({ country: code, clubs: top.standings().slice(0, 4) });
        }
        p.euroCup = EuropeanCup.generate(groups, p.club, p.club.avgSkill(p.roster));
        const day = p.seasonClock.firstFreeDayFrom(6, p.league);
        p.seasonClock.scheduleEuroCup(day);
        const firstOpp = p.euroCup.playerOpponent();
        const oppTag = firstOpp ? countryTag(firstOpp.country) : '';
        p.news.push(`¡OS CLASIFICÁIS PARA LA COPA DE EUROPA! ${p.clubName} debuta en ${p.euroCup.roundName.toLowerCase()} contra ${firstOpp ? firstOpp.name : '?'}${oppTag}.`);
      }
      p.boardGoal = boardGoalFor(p.seasonsPlayed, p.currentLeagueLevel);
      const awards = this._seasonAwards(p);
      if (awards.length) {
        const linea = awards.map((a) => `${STAT_LABEL[a.stat]}: ${this.nameOf(a.id)}`).join('  ·  ');
        p.news.push(`PREMIOS DE LA PEÑA — fin de temporada: ${linea}.`);
      }
      seasonEnd = { rank, promoted, relegated, table, awards, cityName: league.cityName };
    }

    const claimed = p.campaign.checkAndClaim(p.snapshotForCampaign());
    for (const ch of claimed) {
      p.money += ch.reward.m; p.xp += ch.reward.x;
      p.news.push(`CAPÍTULO CUMPLIDO: "${ch.title}". +${ch.reward.m}€ +${ch.reward.x} XP.`);
    }

    const ups = p.addReward(xp, money);
    p.save();
    return { won, xp, money, ups, revenge, stormWin, itemDrop, betResult, sponsorResult, seasonEnd, weeklyGoalResult, ultimatum, crisisDemotion, xpPerAbuelo };
  }

  // otorga XP a un abuelo y anuncia en las noticias cada subida de nivel
  // que provoque (puede subir varios de golpe con partidos muy buenos)
  _grantXp(p, id, amount) {
    const ups = p.roster.get(id).addXp(amount);
    for (const up of ups) {
      p.news.push(`¡${this.nameOf(id)} sube a nivel ${up.level}! ${up.points} puntos por repartir en Mi Peña.`);
    }
  }

  // el mundo también envejece: los clubes IA de la liga española completa
  // y de las 3 de fondo de cada país extranjero pierden y ganan jugadores
  // por edad, igual que tu propia peña (ver Club.ageAndRenew). Si el
  // capitán que se retira era el del derbi o el del némesis, se anuncia —
  // esas son las dos únicas relaciones que el jugador sigue de cerca, así
  // que son las únicas que merecen una noticia entre cientos de clubes.
  _ageRivalWorld(p, league) {
    const derbyBefore = p.derbyClub ? p.derbyClub.captain : null;
    const nemesisClub = p.nemesis ? league.clubById(p.nemesis.city) : null;
    const nemesisCaptainBefore = nemesisClub ? nemesisClub.captain : null;

    for (const [, lg] of p.leagueWorld.leagues) {
      for (const c of lg.clubs) {
        if (c.isPlayer) continue;
        const retired = c.ageAndRenew();
        if (!retired) continue;
        if (derbyBefore && retired.id === derbyBefore.id) {
          p.news.push(`EL DERBI CAMBIA DE CARA: el capitán de siempre en ${p.derbyClub.name} cuelga la petanca. Toma el relevo alguien con ganas de hacerse un nombre.`);
        } else if (nemesisCaptainBefore && retired.id === nemesisCaptainBefore.id) {
          p.news.push(`VUESTRO NÉMESIS TAMBIÉN CAMBIA DE CARA: se retira quien capitaneaba ${nemesisClub.name}. La rivalidad sigue, pero con otra mano al frente.`);
        }
      }
    }
    for (const world of p.foreignLeagues.values()) {
      for (const [, lg] of world.leagues) for (const c of lg.clubs) c.ageAndRenew();
    }
  }

  // liquida la deuda de sangre de cualquiera de los `usados` que arrastre
  // una cuenta pendiente con el club rival de este partido (ver
  // AbueloState.retireToGrandchild / Game.js._startWeeklyMatch) — solo si
  // se ha ganado; el nieto la salda con moral, XP y una noticia con sabor.
  settleDebts(p, usados, opponentId, won) {
    if (!won) return;
    for (const id of usados) {
      const s = p.roster.get(id);
      if (!s.debt || s.debt.clubId !== opponentId) continue;
      const label = s.debt.label;
      s.debt = null;
      s.addMoral(10);
      this._grantXp(p, id, 40);
      p.news.push(`DEUDA SALDADA: ${this.nameOf(id)} por fin ajusta cuentas con ${label}. Su abuelo puede descansar tranquilo.`);
    }
  }

  // suma un partido jugado juntos a cada pareja de `usados`; anuncia cada
  // subida de nivel de vínculo con nombre, y da un pequeño extra de moral a
  // la pareja de leyenda cada vez que gana junta (ver domain/Chemistry.js)
  trackChemistry(p, usados, won) {
    for (let i = 0; i < usados.length; i++) {
      for (let j = i + 1; j < usados.length; j++) {
        const a = usados[i], b = usados[j];
        const key = chemistryKey(a, b);
        const before = p.chemistry[key] || 0;
        const after = before + 1;
        p.chemistry[key] = after;
        const lvlBefore = chemistryLevel(before), lvlAfter = chemistryLevel(after);
        if (lvlAfter > lvlBefore && CHEMISTRY_LEVELS[lvlAfter].label) {
          p.news.push(`COMPENETRACIÓN: ${this.nameOf(a)} y ${this.nameOf(b)} ${CHEMISTRY_LEVELS[lvlAfter].label}. Se les nota en la pista.`);
          if (lvlAfter === CHEMISTRY_LEVELS.length - 1) {
            p.addAnnal(`PAREJA DE LEYENDA: ${this.nameOf(a)} y ${this.nameOf(b)} alcanzan la compenetración máxima tras años rodados juntos.`);
          }
        }
        if (won && lvlAfter === CHEMISTRY_LEVELS.length - 1) {
          p.roster.get(a).addMoral(1);
          p.roster.get(b).addMoral(1);
        }
      }
    }
  }

  // noticia semanal ambiental: qué se cuece en la liga (fichajes ajenos, etc.)
  weeklyNews(league) {
    const p = this.player;
    if (Math.random() <= 0.4) {
      const others = league.clubs.filter((c) => !c.isPlayer);
      if (others.length) {
        const club = others[Math.floor(Math.random() * others.length)];
        const templates = [
          `${club.name} ficha a un jugador nuevo para reforzar la plantilla.`,
          `${club.name} anda flojo de forma esta semana, dicen en el bar.`,
          `Rumores de que ${club.name} quiere ficharse a alguien de la comarca.`,
        ];
        p.news.push(templates[Math.floor(Math.random() * templates.length)]);
      }
    }
    // rumor de mercado: solo sobre excedentes que tus ojeadores YA han
    // destapado (no tiene sentido dar pistas de alguien que ni tú mismo
    // conoces todavía) — anima a echarle un vistazo al Mercado
    const listings = TransferPool.globalListings(p.leagueWorld, p.foreignLeagues).filter((l) => l.player.discovered);
    if (Math.random() <= 0.2 && listings.length) {
      const cand = listings[Math.floor(Math.random() * listings.length)].player;
      const templates = [
        `RUMOR: se habla de un jugador de ${cand.nationality.label} rondando el mercado con ganas de fichar por la peña.`,
        `RUMOR: dicen en el bar que hay alguien de ${cand.nationality.label} en el mercado que promete, pero nadie sabe bien de qué pie cojea.`,
        `RUMOR: ${cand.name} anda mirando ofertas, según cuentan. Habrá que echar un ojo al Mercado.`,
      ];
      p.news.push(templates[Math.floor(Math.random() * templates.length)]);
    }

    // reportaje sobre un abuelo concreto: racha, vínculo, mentoría,
    // herencia, veteranía o nivel — para que la Hemeroteca hable de
    // personas y no solo de resultados y cotilleo genérico (ver
    // data/biografias.js, que reutiliza datos ya trackeados en otro sitio)
    if (Math.random() <= 0.08) {
      const bio = composeBiography(p, (id) => this.nameOf(id));
      if (bio) p.news.push(bio);
    }
  }

  // premios de fin de temporada: "la peña vota" al mejor de cada stat entre
  // quien ha jugado al menos una vez, con una pequeña mejora permanente de
  // premio (o un empujón de moral si ya estaba a tope)
  _seasonAwards(p) {
    const jugadores = p.roster.ids.filter((id) => p.roster.get(id).career.wins + p.roster.get(id).career.losses > 0);
    if (!jugadores.length) return [];
    const awards = [];
    for (const stat of STAT_KEYS) {
      let best = jugadores[0];
      for (const id of jugadores) if (p.roster.get(id).getStat(stat) > p.roster.get(best).getStat(stat)) best = id;
      p.roster.get(best).train(stat, 1);
      awards.push({ id: best, stat });
    }
    return awards;
  }

  _simulateRestOfMatchday(league, idx) {
    const fixtures = league.fixturesForMatchday(idx);
    for (const [aId, bId] of fixtures) {
      const a = league.clubById(aId), b = league.clubById(bId);
      if (!a || !b || a.isPlayer || b.isPlayer) continue; // el tuyo ya se ha resuelto jugando
      const won = Math.random() < a.avgSkill() / (a.avgSkill() + b.avgSkill());
      a.recordResult(won); b.recordResult(!won);
    }
  }

  // una jornada COMPLETA (los 5 partidos) de una liga 100% IA en la que el
  // jugador no tiene equipo — a diferencia de _simulateRestOfMatchday, que
  // salta el partido del jugador porque ya se ha jugado en vivo. Si la
  // temporada de esa liga se acaba, arranca otra sola para no quedarse
  // congelada con isSeasonOver a true para siempre.
  _simulateLeagueMatchday(league) {
    if (!league) return;
    if (league.isSeasonOver) { league.startNewSeason(); return; }
    const fixtures = league.fixturesForMatchday(league.matchday);
    for (const [aId, bId] of fixtures) {
      const a = league.clubById(aId), b = league.clubById(bId);
      if (!a || !b) continue;
      const won = Math.random() < a.avgSkill() / (a.avgSkill() + b.avgSkill());
      a.recordResult(won); b.recordResult(!won);
    }
    league.matchday++;
  }
}

function cityAt(level) {
  const map = { 1: 'Albacete', 2: 'Cuenca', 3: 'Zaragoza', 4: 'Sevilla', 5: 'Valencia', 6: 'Bilbao', 7: 'Barcelona', 8: 'Madrid' };
  return map[level] || `nivel ${level}`;
}
function boardGoalFor(seasonNum, leagueLevel) { return BoardObjective.forSeason(seasonNum, leagueLevel).goal; }

// cuánto cambia la confianza de la junta tras un partido: además del
// resultado en bruto, pesa la contundencia (margen) y si el rival era
// mejor o peor que tú sobre el papel — machacar a un equipo mejor vale
// mucho más que ganar por la mínima a uno flojo, y perder por goleada
// duele más que caer en el último suspiro. Antes era un +3/-5 fijo, igual
// para un partido ajustadísimo que para una manita en cualquier sentido.
function boardConfidenceDelta(won, margin, mySkill, oppSkill) {
  const upset = clamp((oppSkill - mySkill) / 3, -1, 1); // >0: el rival era mejor sobre el papel
  const marginRatio = clamp(Math.abs(margin) / 8, 0, 1);
  if (won) return Math.round(3 + marginRatio * 2 + Math.max(0, upset) * 4);
  return -Math.round(5 + marginRatio * 3 - Math.max(0, -upset) * 2);
}
