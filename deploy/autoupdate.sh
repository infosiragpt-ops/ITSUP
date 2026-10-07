#!/usr/bin/env bash
# Despliegue automático de ISUP Aula Virtual (lo ejecuta isup-autoupdate.timer cada 5 minutos).
# Si la rama desplegada tiene commits nuevos en el repositorio, actualiza con isup-update (o vuelve a ejecutar el
# instalador si este cambió: unidades systemd, Caddy, firewall). Si el despliegue falla, restaura la versión anterior
# y no vuelve a intentar ese mismo commit hasta que aparezca otro.
#   sudo isup-autoupdate            → comprobar y desplegar si hay novedades
#   sudo isup-autoupdate --estado   → ver versión desplegada, remota y último resultado
set -euo pipefail
APP_DIR="${APP_DIR:-/opt/isup}"
SVC_USER="${SVC_USER:-isup}"
ENV_FILE="${ENV_FILE:-/etc/isup/isup.env}"
STATE_DIR="${STATE_DIR:-/var/lib/isup}"
FAILED_FILE="$STATE_DIR/.autoupdate-failed"
LAST_FILE="$STATE_DIR/.autoupdate-last"
LOG="${LOG:-/var/log/isup-autoupdate.log}"

[ "$(id -u)" -eq 0 ] || { echo "Ejecuta con sudo."; exit 1; }
[ -e "$LOG" ] || install -m 0600 /dev/null "$LOG"
chmod 0600 "$LOG" 2>/dev/null || true
as_isup() { runuser -u "$SVC_USER" -- env HOME="$APP_DIR" "$@"; }
log() { logger -t isup-autoupdate -- "$*" 2>/dev/null || true; printf '%s %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" | tee -a "$LOG"; }
envval() { grep -E "^$1=" "$ENV_FILE" 2>/dev/null | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//' -e 's/\\"/"/g' -e 's/\\\\/\\/g' || true; }

BRANCH="$(as_isup git -C "$APP_DIR" rev-parse --abbrev-ref HEAD)"
if [ "$BRANCH" = HEAD ]; then
  [ "${1:-}" = "--estado" ] && echo "Despliegue automático en pausa: el código está fijado en un commit (isup-update --ref). Para reanudar: sudo isup-update <rama>"
  exit 0
fi
if ! as_isup git -C "$APP_DIR" fetch --quiet origin "$BRANCH" 2>>"$LOG"; then
  log "No se pudo consultar el repositorio (sin red o GitHub caído); se reintentará"
  exit 0
fi
LOCAL="$(as_isup git -C "$APP_DIR" rev-parse HEAD)"
REMOTE="$(as_isup git -C "$APP_DIR" rev-parse "origin/$BRANCH")"
FAILED="$(cat "$FAILED_FILE" 2>/dev/null || true)"

if [ "${1:-}" = "--estado" ]; then
  echo "Rama desplegada:   $BRANCH"
  echo "Versión en uso:    ${LOCAL:0:7}"
  echo "Última en GitHub:  ${REMOTE:0:7} $([ "$LOCAL" = "$REMOTE" ] && echo '(al día)' || echo '(pendiente)')"
  [ -z "$FAILED" ] || echo "Commit descartado: ${FAILED:0:7} (falló al desplegar; se ignora hasta que haya otro commit)"
  [ ! -f "$LAST_FILE" ] || echo "Último despliegue:  $(cat "$LAST_FILE")"
  echo "Registro:          $LOG  ·  journalctl -t isup-autoupdate"
  exit 0
fi

[ "$LOCAL" != "$REMOTE" ] || exit 0
if [ "$REMOTE" = "$FAILED" ]; then exit 0; fi

# Un solo despliegue a la vez (isup-update toma el mismo cerrojo)
[ "$(stat -c %s "$LOG" 2>/dev/null || echo 0)" -lt 5000000 ] || : > "$LOG"
log "Nueva versión en $BRANCH: ${LOCAL:0:7} → ${REMOTE:0:7}. Desplegando…"

ok=0
if ! as_isup git -C "$APP_DIR" diff --quiet "$LOCAL" "$REMOTE" -- deploy/install-ubuntu.sh; then
  # Cambió el instalador: se vuelve a ejecutar completo con los datos guardados en isup.env (unidades, Caddy, firewall)
  DOMAIN="$(envval PUBLIC_URL | sed 's#^https\?://##')"
  ADMIN_EMAIL="$(envval ISUP_ADMIN_EMAIL)"
  if [ -z "$DOMAIN" ] || [ -z "$ADMIN_EMAIL" ]; then
    log "El instalador cambió pero faltan PUBLIC_URL/ISUP_ADMIN_EMAIL en $ENV_FILE; se usa isup-update"
    /usr/local/bin/isup-update "$BRANCH" >>"$LOG" 2>&1 && ok=1
  else
    log "El instalador cambió: se vuelve a ejecutar para $DOMAIN"
    TMP="$(mktemp /tmp/isup-install.XXXXXX)"
    as_isup git -C "$APP_DIR" show "$REMOTE:deploy/install-ubuntu.sh" > "$TMP"
    INSTITUTION="$(envval ISUP_INSTITUTION)" SHORT="$(envval ISUP_SHORT)" WWW="$(envval ISUP_WWW)" BRANCH="$BRANCH" WAIT_DNS=0 ISUP_HIDE_PASSWORD=1 \
      bash "$TMP" "$DOMAIN" "$ADMIN_EMAIL" >>"$LOG" 2>&1 && ok=1
    rm -f "$TMP"
  fi
else
  /usr/local/bin/isup-update "$BRANCH" >>"$LOG" 2>&1 && ok=1
fi

if [ "$ok" = 1 ]; then
  rm -f "$FAILED_FILE"
  echo "$(date '+%Y-%m-%d %H:%M:%S') ok ${REMOTE:0:7}" > "$LAST_FILE"
  log "Desplegado ${REMOTE:0:7} correctamente"
else
  echo "$REMOTE" > "$FAILED_FILE"
  echo "$(date '+%Y-%m-%d %H:%M:%S') FALLÓ ${REMOTE:0:7}, restaurada ${LOCAL:0:7}" > "$LAST_FILE"
  log "Falló el despliegue de ${REMOTE:0:7}; restaurando ${LOCAL:0:7}"
  if /usr/local/bin/isup-update --rollback "$LOCAL" >>"$LOG" 2>&1; then
    log "Versión anterior ${LOCAL:0:7} restaurada; ${REMOTE:0:7} queda descartado hasta que haya otro commit"
  else
    log "✖ La restauración también falló: revisa journalctl -u isup y $LOG"
  fi
  exit 1
fi
