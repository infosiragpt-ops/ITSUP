#!/usr/bin/env bash
# ISUP Aula Virtual - doble clic en macOS (abre Terminal y arranca el aula)
cd "$(dirname "$0")" || exit 1
if [ ! -f ./iniciar.sh ]; then
  echo
  echo "  Falta iniciar.sh: este archivo debe quedarse dentro de la carpeta del aula virtual (no lo muevas solo al Escritorio ni al Dock)."
  echo
  read -r -p "  Pulsa Enter para terminar…" _
  exit 1
fi
exec bash ./iniciar.sh "$@"
