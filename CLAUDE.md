# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

PETANKA — a 100% ASCII petanca (pétanque) game for the browser, in Spanish.
Manage a "peña" (club) of grandfather players, climb an 8-level league
pyramid across Spain (and, via transfers/scouting, players from France,
Italy, Belgium, Switzerland, Portugal), play out individual petanca throws
with real physics (wind, rain, terrain features), and run the club side:
transfer market, scouting staff, sponsorships, board confidence, cup
competitions (Copa de España, Copa de Europa), press, and a light narrative
layer (nemesis rivals, derbies, moral, calendar events).

The game itself (`public/game/`) is **vanilla JS, no build step, no
framework, no dependencies**. Astro exists purely to serve/build that static
tree — `src/pages/index.astro` is a single page that links
`/game/style.css` and boots `/game/main.js` as a module script. There is no
Astro component logic to speak of; almost all real work happens under
`public/game/`.

## Commands

```
npm run dev       # astro dev server on :4321 (edit public/game/* and reload)
npm run build     # astro build -> static output
npm run preview   # serve the built output
npm run verify    # node tools/verify.mjs — headless consistency checks
```

`npm run verify` (`tools/verify.mjs`) is the closest thing to a test suite:
a plain Node script (no test runner/framework) that imports domain/data
modules directly and asserts invariants — name pools, club generation
nationality purity, country strength ordering, map/geography connectivity,
court physics setup, transfer market equilibrium over simulated weeks,
manager reputation math, scouting reveal timing, save/load migration, and
European Cup bracket integrity. It stubs `globalThis.localStorage` since
`Player.js` reads/writes it directly. Run a single check by temporarily
narrowing the `checks` array in that file, or by copy-pasting one `check(...)`
block into a scratch script — there's no `--grep`-style filter built in.

There is no lint/format script and no browser test harness; UI/render
behavior must be verified by actually opening the game (`npm run dev`, or
just open `public/game/index.html`-equivalent page via the Astro route) and
playing through it, per the repo's own testing philosophy in `instructions.md`.

## Architecture

### Composition root: `public/game/core/Game.js`

`Game` is instantiated once from `public/game/main.js`. It owns:
- `screen` (`core/Screen.js`) — the render target (140×46 character grid).
- `input` (`core/Input.js`) — keyboard + mouse state.
- `player` (`model/Player.js`) — the entire save file, loaded via `Player.load()`.
- `career` (`model/Career.js`) — end-of-match resolution ("close out the week").
- `screens` — a map of screen-name → screen instance (see below).

`Game.state` (a string like `'title'`, `'hub'`, `'lineup'`, `'match'`,
`'result'`, ...) selects which screen's `draw()` (and, for `'match'`,
`update(dt)`) runs each frame. Screens read/mutate `game.*` directly and
flip `game.state` to navigate — there's no router, just this shared mutable
`Game` object passed into every screen's constructor. The main loop
(`Game.loop`, driven by `requestAnimationFrame`) also drives a "Debugger"
auto-simulate mode (`simulating`/`debugAdvanceOneDay`) that fast-forwards
days without playing matches, useful for exercising season-length logic
manually.

### Directory map (`public/game/`)

- `core/` — engine plumbing: `Screen` (char/color buffer → `<span>` runs per
  row), `Input` (keys held vs. one-frame `hit()`, mouse drag/click on the
  grid), `utils.js`, `seaFx.js`.
- `screens/` — one class per screen (Title, Agenda/calendar, Hub, LeagueMap,
  Penya/roster management, Bar/betting+league table, Club/facilities,
  Hemeroteca/news archive, Ayuda/help, Press, Capitulos/campaign chapters,
  Lineup, Match, Result, SeasonEnd). Each screen only calls back into `Game`
  methods; screens don't talk to each other directly.
- `match/` — the live throw-by-throw simulation: `Match.js` (state machine
  for a single match, including the 4-phase throw sequence and training
  drills), `AIPlayer.js` (rival throw decisions), `ThrowProfile.js`,
  `Narrator.js` (contextual commentary lines).
- `physics/` — `Ball.js`, `Court.js` (per-city terrain features, e.g. slope,
  puddles, walls), `Weather.js`, `constants.js` (grid size, gravity,
  friction, target score).
- `domain/` — simulation entities that aren't persisted player state:
  `Club`, `League`/`LeagueWorld`/`ForeignLeagueWorld`, `Cup`/`EuropeanCup`,
  `TransferPool` (global surplus-player market), `Scouting`, `FreeAgentPool`,
  `RivalPlayer`, `SeasonClock` (day/week/match-day calendar), and the
  per-match context objects (`WeeklyMatchContext`, `CupMatchContext`,
  `FriendlyMatchContext`) that adapt league/cup/friendly fixtures to a
  common shape `Match.js` consumes.
- `model/` — the save-file object graph rooted at `Player` (`Player.js`):
  `Roster`/`AbueloState` (your players' stats/XP/injuries), `Career.js`
  (the big "resolve a played match" orchestrator — moral, sponsorships,
  board confidence, promotion/relegation, cup scheduling, market tick,
  season-end awards, all in one place), `Season`, `Calendar`,
  `TransferMarket` (one-off buyout offers on your own players),
  `ScoutStaff`, `FacilityManager`, `Campaign` (narrative chapter goals),
  `NewsFeed`, `Sponsorship`, `BoardObjective`, `LineupPresets`, `QuickSim`.
- `data/` — static/generated content: name pools per nationality
  (`names.js`), city/country/geography tables, club-name vocabulary per
  country, climate weights per city, court "feature" table, items, bolas
  (ball) mods, difficulty presets, help/press copy, and `data/art/` (ASCII
  art assets — portraits, banners — generated offline, see below).
- `portraits/` — procedural ASCII portrait composition (`PortraitGenerator`,
  `PortraitParts`), distinct from the static generated art in `data/art/`.

### Data flow for a match

A screen (Hub/Agenda) calls a `Game` method (`_startWeeklyMatch`,
`_startCupMatch`, `_startEuroCupMatch`, `playFriendly`/`startFriendlyMatch`,
or `startTraining`) which builds the appropriate `*MatchContext` from
`domain/`, sets `game.weeklyMatch`, and switches `state` to `'lineup'` (or
`'press'` first for derbies/nemesis/finals/cup ties). Picking a lineup calls
`Game.startMatch(team)`, which constructs `match/Match.js` and switches to
`'match'`. When `Match` finishes, `Game.onMatchFinished()` routes to the
right `Career`/`Game` finisher (`_finishCupMatch`, `_finishEuroCupMatch`,
`_finishFriendlyMatch`, or `career.finishWeeklyMatch` for league play), which
mutates `player` (money, XP, moral, board confidence, promotion/relegation,
market simulation for the week, etc.) and calls `player.save()`.

### Save data

`Player` serializes to `localStorage` under `petanka_save_v4` (see
`model/Player.js`), with automatic migration from older `_v3`/`_v2`/`_v1`
keys and `fromJSON` defensive defaults for fields added after a save was
created (see the migration-related checks in `tools/verify.mjs`). Three
save slots are supported (`petanka_active_slot` selects which key is
active); slot 1 reuses the legacy key so old saves keep working.

### Generated assets

`data/art/*.js` files (portraits, banners) are generated offline by an
ASCII-conversion filter script (`/tmp/ascii_convert.py`, not checked into
the repo — see `instructions.md` for the algorithm: crop → aspect-correct
resize → saturation/contrast boost → luminance-to-character ramp →
palette-quantized color) and then committed as plain JS data. Don't
hand-edit these; regenerate via the filter or the `tools/portrait-generator.html`
tool instead.

## Two overlapping docs, and what's stale

- `instructions.md` is a detailed design/behavior doc for the petanca
  physics engine, throw sequence, weather, per-city court features, and
  roster mechanics — these sections are still accurate (compare
  `physics/constants.js`, `data/abuelos.js` stat keys, and the city→feature
  mapping in `Career.js`'s `cityAt`). However its "Estructura de archivos"
  (root-level `main.js`/`art.js`/`faces.js`), city-based single tournament
  ladder, and `petanka_save_v2` save key describe an **earlier version** of
  the game, superseded by the current league-pyramid/transfer-market/cup
  structure under `public/game/`. Treat it as accurate for physics/feel,
  stale for file layout and the overall game loop.
- `legacy/` holds retired code from prior iterations (including a whole
  `legacy/game-v3-tournament/` snapshot) — reference only, not part of the
  running game.
- `next-steps.md` is currently empty (last round of planned work already shipped).
