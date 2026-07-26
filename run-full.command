#!/usr/bin/env bash
# Compila la edición FULL (todo el contenido, la que se envuelve para
# Steam) y la sirve en localhost para probarla en el navegador. Doble
# clic en el Finder (o ./run-full.command desde terminal) — abre una
# ventana de Terminal y la deja abierta sirviendo el juego; ciérrala
# para detener el servidor.
cd "$(dirname "$0")"
# si algo falla (build roto, node no encontrado...) deja la ventana
# abierta con el error visible en vez de cerrarse sola de golpe
trap 'echo; read -p "Pulsa Intro para cerrar esta ventana..."' EXIT
set -e

PORT=4322

node tools/build-editions.mjs full

( sleep 1
  if command -v open >/dev/null 2>&1; then open "http://localhost:$PORT"
  elif command -v xdg-open >/dev/null 2>&1; then xdg-open "http://localhost:$PORT"
  fi
) &

node tools/serve-dist.mjs dist/full "$PORT"
