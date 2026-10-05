#!/usr/bin/env bash
# Restablece la contraseña de una cuenta del aula y la desbloquea (se ejecuta como el usuario del servicio).
#   sudo isup-reset-password correo@dominio            → genera una contraseña nueva y la muestra una vez
#   sudo isup-reset-password correo@dominio NuevaClave1
set -euo pipefail
APP_DIR="${APP_DIR:-/opt/isup}"
SVC_USER="${SVC_USER:-isup}"
ENV_FILE="${ENV_FILE:-/etc/isup/isup.env}"
[ $# -ge 1 ] || { echo "Uso: sudo isup-reset-password correo-o-código [nueva-contraseña]"; exit 1; }
[ "$(id -u)" -eq 0 ] || { echo "Ejecuta con sudo."; exit 1; }
DATA_DIR="$(grep -E '^DATA_DIR=' "$ENV_FILE" 2>/dev/null | cut -d= -f2- | tr -d '"' || true)"
exec runuser -u "$SVC_USER" -- env HOME="$APP_DIR" DATA_DIR="${DATA_DIR:-/var/lib/isup}" NODE_OPTIONS=--disable-warning=ExperimentalWarning \
  node "$APP_DIR/server/tools/reset-password.mjs" "$@"
