#!/usr/bin/env bash
# Importa o actualiza las carreras del aula desde un archivo JSON (se ejecuta como el usuario del servicio).
#   sudo isup-carreras                          → catálogo del repositorio (deploy/programas-tepsup.json)
#   sudo isup-carreras /ruta/mis-carreras.json  → otro archivo con el mismo formato
#   sudo isup-carreras --solo-estas             → además desactiva las carreras que no estén en el archivo
set -euo pipefail
APP_DIR="${APP_DIR:-/opt/isup}"
SVC_USER="${SVC_USER:-isup}"
ENV_FILE="${ENV_FILE:-/etc/isup/isup.env}"
[ "$(id -u)" -eq 0 ] || { echo "Ejecuta con sudo."; exit 1; }
FILE="$APP_DIR/deploy/programas-tepsup.json"
ARGS=()
for a in "$@"; do
  case "$a" in --*) ARGS+=("$a") ;; *) FILE="$a" ;; esac
done
[ -f "$FILE" ] || { echo "No existe el archivo $FILE"; exit 1; }
FILE="$(readlink -f "$FILE")"
DATA_DIR="$(grep -E '^DATA_DIR=' "$ENV_FILE" 2>/dev/null | cut -d= -f2- | tr -d '"' || true)"
exec runuser -u "$SVC_USER" -- env HOME="$APP_DIR" DATA_DIR="${DATA_DIR:-/var/lib/isup}" NODE_OPTIONS=--disable-warning=ExperimentalWarning \
  node "$APP_DIR/server/tools/import-programs.mjs" "$FILE" "${ARGS[@]}"
