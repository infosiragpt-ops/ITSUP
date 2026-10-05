#!/usr/bin/env bash
# Actualiza ISUP Aula Virtual y reinicia el servicio (copia de seguridad previa incluida).
#   sudo isup-update                 → última versión de la rama desplegada
#   sudo isup-update otra-rama       → cambia a otra rama
#   sudo isup-update --ref <commit>  → versión exacta (también sirve para volver atrás)
set -euo pipefail
APP_DIR="${APP_DIR:-/opt/isup}"
SVC_USER="${SVC_USER:-isup}"
NPM_CACHE="${NPM_CACHE:-/var/cache/isup-npm}"
PORT="$(grep -E '^PORT=' /etc/isup/isup.env 2>/dev/null | cut -d= -f2 | tr -d '"' || true)"
PORT="${PORT:-3000}"

[ "$(id -u)" -eq 0 ] || { echo "Ejecuta con sudo."; exit 1; }
as_isup() { runuser -u "$SVC_USER" -- env HOME="$APP_DIR" npm_config_cache="$NPM_CACHE" "$@"; }
REF=""
if [ "${1:-}" = "--ref" ]; then
  REF="${2:-}"; [ -n "$REF" ] || { echo "Indica el commit: sudo isup-update --ref abc1234"; exit 1; }
  shift 2
fi

echo "▸ Copia de seguridad previa"
if ! /usr/local/bin/isup-backup; then
  echo "✖ La copia previa falló: se cancela la actualización para no arriesgar los datos (prueba: sudo isup-backup)."; exit 1
fi

BEFORE="$(as_isup git -C "$APP_DIR" rev-parse --short HEAD)"
if [ -n "$REF" ]; then
  echo "▸ Cambiando a la versión $REF"
  as_isup git -C "$APP_DIR" fetch --quiet origin
  as_isup git -C "$APP_DIR" checkout --quiet --detach "$REF"
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
systemctl restart isup.service
for _ in $(seq 1 40); do curl -fsS "http://127.0.0.1:$PORT/api/health" >/dev/null 2>&1 && break; sleep 1; done
if curl -fsS "http://127.0.0.1:$PORT/api/health" >/dev/null 2>&1; then
  echo "✔ Actualizado y en ejecución ($AFTER)."
  echo "  Si cambió el instalador (unidades systemd, Caddy), vuelve a ejecutar deploy/install-ubuntu.sh para aplicarlo."
else
  journalctl -u isup -n 30 --no-pager
  echo "✖ El servicio no respondió tras la actualización."
  echo "  Para volver a la versión anterior: sudo isup-update --ref $BEFORE"
  echo "  Si la actualización cambió la base de datos, restaura la copia previa: sudo isup-restore (lista las copias)"
  exit 1
fi
