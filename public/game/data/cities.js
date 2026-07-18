// lon/lat = coordenadas geográficas reales aproximadas; Geography las traduce
// a coordenadas del mapa-mundo (wx/wy). `diff` es ahora el NIVEL DE LIGA
// (1 = Albacete, la más floja; 8 = Madrid, la más fuerte), no solo una
// dificultad de torneo suelto.
export const CITIES = [
  { name: 'ALBACETE', lon: -1.86, lat: 38.99, diff: 1, minLevel: 1, color: '#7ec850',
    clima: { SOL: 5, LLUVIA: 1, VIENTO: 3, CALOR: 3, NIEBLA: 1, HELADA: 1 },
    feature: { id: 'flat', desc: 'La llanura perfecta: tierra lisa sin una sola calva.' } },
  { name: 'CUENCA', lon: -2.14, lat: 40.07, diff: 2, minLevel: 1, color: '#7ec850',
    clima: { SOL: 5, LLUVIA: 2, VIENTO: 2, CALOR: 2, NIEBLA: 2, HELADA: 1 },
    feature: { id: 'slope', desc: 'Pista inclinada: las bolas ruedan cuesta abajo (hacia el sur).' } },
  { name: 'ZARAGOZA', lon: -0.88, lat: 41.65, diff: 3, minLevel: 2, color: '#e8c832',
    clima: { SOL: 3, LLUVIA: 1, VIENTO: 7, CALOR: 2, HELADA: 2 },
    feature: { id: 'cierzo', desc: 'El cierzo no descansa: aquí siempre sopla algo.' } },
  { name: 'SEVILLA', lon: -5.99, lat: 37.39, diff: 4, minLevel: 3, color: '#f2903a',
    clima: { SOL: 4, LLUVIA: 1, VIENTO: 1, CALOR: 7 },
    feature: { id: 'fastdry', desc: 'Albero recocho: la tierra dura hace rodar las bolas de más.' } },
  { name: 'VALENCIA', lon: -0.38, lat: 39.47, diff: 5, minLevel: 4, color: '#e8c832',
    clima: { SOL: 6, LLUVIA: 2, VIENTO: 2, CALOR: 3 },
    feature: { id: 'tree', desc: 'El plátano centenario: los globos altos acaban entre sus ramas.' } },
  { name: 'BILBAO', lon: -2.94, lat: 43.26, diff: 6, minLevel: 5, color: '#f2903a',
    clima: { SOL: 2, LLUVIA: 7, VIENTO: 3, CALOR: 1, NIEBLA: 3 },
    feature: { id: 'puddles', desc: 'Charcos permanentes: donde caen, las bolas se ahogan.' } },
  { name: 'BARCELONA', lon: 2.17, lat: 41.39, diff: 7, minLevel: 6, color: '#e8433f',
    clima: { SOL: 4, LLUVIA: 3, VIENTO: 3, CALOR: 2 },
    feature: { id: 'walls', desc: 'Pista urbana con tablones duros: las bandas devuelven la bola.' } },
  { name: 'MADRID', lon: -3.70, lat: 40.42, diff: 8, minLevel: 7, color: '#e8433f',
    clima: { SOL: 4, LLUVIA: 2, VIENTO: 2, CALOR: 4, NIEBLA: 1, HELADA: 1 },
    feature: { id: 'pressure', desc: 'Foco mediático: la presión pesa el doble. Temple o muerte.' } },
];

export const RIVALS = ['EL SABIO', 'PACO EL LARGO', 'LA JOSEFA', 'EL CARDENAL', 'DON EVARISTO',
  'EL DE BILBAO', 'REMEDIOS', 'MARISCAL RAMÓN'];
export const ROUND_NAMES = ['CUARTOS', 'SEMIFINAL', 'FINAL'];
export const PENAS_LIGA = ['PEÑA EL BOLICHE', 'LOS DEL BAR PACO', 'PEÑA LA BOINA', 'CLUB SIRIMIRI'];

export function cityReward(c) { return { xp: 80 + c.diff * 60, money: 50 + c.diff * 75 }; }
