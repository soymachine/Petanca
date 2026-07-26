#!/usr/bin/env bash
# Compila la edición FULL (todo el contenido, la que se envuelve para
# Steam) y la sirve en localhost para probarla en el navegador. Ejecutar
# desde cualquier sitio: ./run-full.sh
set -e
cd "$(dirname "$0")"

PORT=4322

node tools/build-editions.mjs full

( sleep 1
  if command -v open >/dev/null 2>&1; then open "http://localhost:$PORT"
  elif command -v xdg-open >/dev/null 2>&1; then xdg-open "http://localhost:$PORT"
  fi
) &

node tools/serve-dist.mjs dist/full "$PORT"
