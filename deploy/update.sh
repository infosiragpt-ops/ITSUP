#!/usr/bin/env bash
# Actualiza ISUP Aula Virtual y reinicia el servicio (copia de seguridad previa incluida).
#   sudo isup-update                     → última versión de la rama desplegada
#   sudo isup-update otra-rama           → cambia a otra rama
#   sudo isup-update --ref <commit>      → versión exacta (fija el código; pausa el despliegue automático)
#   sudo isup-update --rollback <commit> → vuelve a ese commit sin abandonar la rama (lo usa isup-autoupdate)
set -euo pipefail
APP_DIR="${APP_DIR:-/opt/isup}"
SVC_USER="${SVC_USER:-isup}"
NPM_CACHE="${NPM_CACHE:-/var/cache/isup-npm}"
PORT="$(grep -E '^PORT=' /etc/isup/isup.env 2>/dev/null | cut -d= -f2 | tr -d '"' || true)"
PORT="${PORT:-3000}"

[ "$(id -u)" -eq 0 ] || { echo "Ejecuta con sudo."; exit 1; }
# Un solo despliegue a la vez (manual o automático)
mkdir -p /run/lock; exec 9>/run/lock/isup-update.lock
flock -n 9 || { echo "Ya hay una actualización en curso; inténtalo en unos minutos."; exit 1; }
as_isup() { runuser -u "$SVC_USER" -- env HOME="$APP_DIR" npm_config_cache="$NPM_CACHE" "$@"; }
REF=""; ROLLBACK=""
if [ "${1:-}" = "--ref" ]; then
  REF="${2:-}"; [ -n "$REF" ] || { echo "Indica el commit: sudo isup-update --ref abc1234"; exit 1; }
  shift 2
elif [ "${1:-}" = "--rollback" ]; then
  ROLLBACK="${2:-}"; [ -n "$ROLLBACK" ] || { echo "Indica el commit: sudo isup-update --rollback abc1234"; exit 1; }
  shift 2
fi

echo "▸ Copia de seguridad previa"
if ! /usr/local/bin/isup-backup; then
  echo "✖ La copia previa falló: se cancela la actualización para no arriesgar los datos (prueba: sudo isup-backup)."; exit 1
fi

BEFORE="$(as_isup git -C "$APP_DIR" rev-parse --short HEAD)"
# Cambios locales (p. ej. package-lock.json reescrito por npm) se descartan antes de cambiar de versión
as_isup git -C "$APP_DIR" reset --quiet --hard
if [ -n "$REF" ]; then
  echo "▸ Cambiando a la versión $REF"
  as_isup git -C "$APP_DIR" fetch --quiet origin
  as_isup git -C "$APP_DIR" checkout --quiet --detach "$REF"
elif [ -n "$ROLLBACK" ]; then
  BRANCH="$(as_isup git -C "$APP_DIR" rev-parse --abbrev-ref HEAD)"
  [ "$BRANCH" != HEAD ] || BRANCH="$(as_isup git -C "$APP_DIR" branch -r --contains "$ROLLBACK" --format='%(refname:short)' | head -1 | sed 's#^origin/##')"
  echo "▸ Volviendo al commit $ROLLBACK en la rama $BRANCH"
  as_isup git -C "$APP_DIR" checkout --quiet -B "$BRANCH" "$ROLLBACK"
else
  BRANCH="${1:-$(as_isup git -C "$APP_DIR" rev-parse --abbrev-ref HEAD)}"
  if [ "$BRANCH" = HEAD ]; then
    echo "El código está en un commit fijo (tras un --ref). Indica la rama a seguir: sudo isup-update main"; exit 1
  fi
  echo "▸ Descargando cambios de la rama $BRANCH"
  as_isup git -C "$APP_DIR" fetch --quiet origin "$BRANCH"
  as_isup git -C "$APP_DIR" checkout --quiet "$BRANCH"
  as_isup git -C "$APP_DIR" reset --quiet --hard "origin/$BRANCH"
fi
AFTER="$(as_isup git -C "$APP_DIR" rev-parse --short HEAD)"
[ -f "$APP_DIR/deploy/update.sh" ] || { echo "✖ Esta versión no incluye deploy/ (modo producción). Vuelve con: sudo isup-update --ref $BEFORE"; exit 1; }
echo "   $BEFORE → $AFTER"

echo "▸ Dependencias e interfaz"
# Se compila en client/dist.next y se intercambia al final para que el sitio no se quede sin interfaz
as_isup bash -c "cd '$APP_DIR' && npm ci --no-audit --no-fund --loglevel=error \
  && VITE_DEMO_MODE=false npm run build --silent -- --outDir dist.next \
  && npm prune --omit=dev --no-audit --no-fund --loglevel=error"
as_isup bash -c "cd '$APP_DIR/client' && rm -rf dist.prev && { [ ! -d dist ] || mv dist dist.prev; } && mv dist.next dist"

echo "▸ Reiniciando el servicio"
install -m 0755 "$APP_DIR/deploy/backup.sh" /usr/local/bin/isup-backup
install -m 0755 "$APP_DIR/deploy/restore.sh" /usr/local/bin/isup-restore
install -m 0755 "$APP_DIR/deploy/update.sh" /usr/local/bin/isup-update
install -m 0755 "$APP_DIR/deploy/reset-password.sh" /usr/local/bin/isup-reset-password
install -m 0755 "$APP_DIR/deploy/import-programs.sh" /usr/local/bin/isup-carreras
install -m 0755 "$APP_DIR/deploy/autoupdate.sh" /usr/local/bin/isup-autoupdate
systemctl restart isup.service 9>&-
for _ in $(seq 1 40); do curl -fsS "http://127.0.0.1:$PORT/api/health" >/dev/null 2>&1 && break; sleep 1; done
if curl -fsS "http://127.0.0.1:$PORT/api/health" >/dev/null 2>&1; then
  echo "✔ Actualizado y en ejecución ($AFTER)."
  if [ -f "$APP_DIR/deploy/post-update.sh" ]; then
    bash "$APP_DIR/deploy/post-update.sh" || { echo "✖ Las tareas posteriores al despliegue fallaron (ver arriba)."; exit 1; }
  fi
  if [ -z "$ROLLBACK" ] && ! as_isup git -C "$APP_DIR" diff --quiet "$BEFORE" "$AFTER" -- deploy/install-ubuntu.sh 2>/dev/null; then
    echo "  Cambió el instalador (unidades systemd, Caddy o firewall): el despliegue automático lo aplicará solo; a mano: vuelve a ejecutar deploy/install-ubuntu.sh."
  fi
else
  journalctl -u isup -n 30 --no-pager
  echo "✖ El servicio no respondió tras la actualización."
  echo "  Para volver a la versión anterior: sudo isup-update --ref $BEFORE"
  echo "  Si la actualización cambió la base de datos, restaura la copia previa: sudo isup-restore (lista las copias)"
  exit 1
fi
