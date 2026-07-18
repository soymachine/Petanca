# Next steps

Ronda de mejoras a la Agenda y al final de partido, ya implementada:

1. **Retroceder en la Agenda hasta la primera semana de temporada** — el
   pasador de páginas ya no solo deja ir hacia delante: con `[←]` se puede
   volver hasta la primera semana de la temporada en curso (tope calculado
   contra `SeasonClock.seasonWeekOffset`, nunca cruza a una temporada ya
   cerrada).
2. **Ver el resultado al hacer rollover sobre un día ya jugado** — nuevo
   `Player.matchResults` (marcador por día, vaciado al cerrar temporada).
   `AgendaScreen._dayEntry` reconstruye la entrada de un día ya jugado a
   partir de ese marcador en vez del estado EN VIVO del cruce (Copa/Copa de
   Europa ya habían avanzado de ronda para cuando se mira hacia atrás, así
   que antes esos días se veían en blanco). El tooltip enseña ahora
   ganado/perdido y el marcador.
3. **El avance automático ya no desplaza el libro cada semana** — la pareja
   de semanas mostrada (`AgendaScreen.leftWeek`) se queda fija hasta que
   TANTO la izquierda como la derecha quedan en el pasado, y solo entonces
   salta de dos en dos.
4. **Escudos de club procedurales** — cada club (el tuyo y cualquier rival)
   tiene un escudo determinista por nombre: silueta fija con un patrón
   heráldico (liso/partido en palo/en faja/cuartelado) en dos colores y un
   emblema central, generado con el mismo truco de hash+semilla que ya usan
   `rivalArchetypes`/`boardPresident` (`portraits/CrestGenerator.js`,
   `portraits/CrestParts.js`). La pantalla de resultado de cada partido de
   liga (`screens/ResultScreen.js`) ahora abre con ambos escudos, nombres y
   el marcador cara a cara, en vez del trofeo/texto genérico de antes.

Este archivo queda vacío a la espera de la próxima tanda de ideas.
