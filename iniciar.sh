#!/usr/bin/env bash
# ISUP Aula Virtual - arranque local en macOS / Linux
# Uso: ./iniciar.sh   (o doble clic en iniciar.command en macOS)
cd "$(dirname "$0")" || exit 1

if ! command -v node >/dev/null 2>&1; then
  echo
  echo "  No se encontró Node.js en este equipo."
  echo "  Descárgalo desde https://nodejs.org (versión LTS, 22 o superior), instálalo y vuelve a ejecutar este archivo."
  echo
  read -r -p "  Pulsa Enter para cerrar…" _
  exit 1
fi

exec node "./scripts/local.mjs"
