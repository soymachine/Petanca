// Mar Mediterráneo "vivo": en vez de puntitos sueltos al azar, cada celda
// de mar se colorea con una mezcla de senoides (como un mapa de calor) que
// oscila con el frame, dando una sensación de oleaje continuo en azules.
const TIERS = [
  { max: 0.22, ch: '·', color: '#0a1830' },
  { max: 0.42, ch: '·', color: '#0f2c4c' },
  { max: 0.60, ch: '~', color: '#154a72' },
  { max: 0.76, ch: '~', color: '#1f6c96' },
  { max: 0.90, ch: '≈', color: '#3a90b8' },
  { max: 1.01, ch: '≈', color: '#63b6d8' },
];

export function seaCell(wx, wy, frame) {
  const t = frame * 0.0225; // oleaje a mitad de velocidad (era 0.045)
  const v = Math.sin(wx * 0.21 + t) + Math.sin(wy * 0.16 - t * 0.8) + Math.sin((wx - wy) * 0.10 + t * 0.55);
  const i = (v / 3 + 1) / 2; // 0..1
  for (const tier of TIERS) if (i <= tier.max) return tier;
  return TIERS[TIERS.length - 1];
}
