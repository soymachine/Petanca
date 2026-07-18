# Next steps

Segunda pasada sobre los escudos de club, ya implementada:

1. **Un 50% más grandes** — el escudo "de héroe" pasa de 9x9 a 13x13
   (ResultScreen, tooltip de Ligas). El mini de Mi Peña crece de 5x7 a 5x9
   (el ancho sí sube un 28%; el alto se queda en 5 filas porque la fila 8
   de esa pantalla ya la usa el texto de ayuda de cada sección — subirlo
   más se lo comería).
2. **Formas más variadas** — de 5 siluetas a 8: se añaden estrella (4
   puntas a lo brújula), hexágono (lados rectos largos) y cruz, además de
   escudo/círculo/diamante/cuadrado/banderín. Mismo orden en SHAPES y
   MINI_SHAPES para que un mismo club "vaya a juego" a las dos escalas.
3. **Degradados en vez de colores planos** — el color base ya no es un
   único tono por mitad del escudo: se aproxima un degradado real
   (vertical / horizontal / diagonal / radial) con varias bandas finas
   interpoladas entre 2 colores, como el dithering de un pixel art retro
   (`CrestGenerator.gradientLayers`).

Este archivo queda vacío a la espera de la próxima tanda de ideas.
