#!/usr/bin/env bash
# Actualiza ISUP Aula Virtual a la última versión de la rama desplegada y reinicia el servicio.
# Uso: sudo isup-update            (o: sudo isup-update otra-rama)
set -euo pipefail
APP_DIR="${APP_DIR:-/opt/isup}"
SVC_USER="${SVC_USER:-isup}"
BRANCH="${1:-$(git -C "$APP_DIR" rev-parse --abbrev-ref HEAD)}"
PORT="$(grep -E '^PORT=' /etc/isup/isup.env 2>/dev/null | cut -d= -f2 || echo 3000)"

[ "$(id -u)" -eq 0 ] || { echo "Ejecuta con sudo."; exit 1; }
echo "▸ Copia de seguridad previa"
/usr/local/bin/isup-backup || true

echo "▸ Descargando cambios de la rama $BRANCH"
BEFORE="$(git -C "$APP_DIR" rev-parse --short HEAD)"
sudo -u "$SVC_USER" -H git -C "$APP_DIR" fetch --quiet origin "$BRANCH"
sudo -u "$SVC_USER" -H git -C "$APP_DIR" checkout --quiet "$BRANCH"
sudo -u "$SVC_USER" -H git -C "$APP_DIR" reset --quiet --hard "origin/$BRANCH"
AFTER="$(git -C "$APP_DIR" rev-parse --short HEAD)"
echo "   $BEFORE → $AFTER"

echo "▸ Dependencias e interfaz"
sudo -u "$SVC_USER" -H bash -c "cd '$APP_DIR' && npm ci --no-audit --no-fund --loglevel=error && VITE_DEMO_MODE=false npm run build --silent && npm prune --omit=dev --no-audit --no-fund --loglevel=error"

echo "▸ Reiniciando el servicio"
install -m 0755 "$APP_DIR/deploy/backup.sh" /usr/local/bin/isup-backup
install -m 0755 "$APP_DIR/deploy/update.sh" /usr/local/bin/isup-update
systemctl restart isup.service
for _ in $(seq 1 40); do curl -fsS "http://127.0.0.1:$PORT/api/health" >/dev/null 2>&1 && break; sleep 1; done
if curl -fsS "http://127.0.0.1:$PORT/api/health" >/dev/null 2>&1; then
  echo "✔ Actualizado y en ejecución ($AFTER)."
else
  journalctl -u isup -n 30 --no-pager
  echo "✖ El servicio no respondió tras la actualización. Para volver atrás: sudo -u $SVC_USER git -C $APP_DIR reset --hard $BEFORE && sudo isup-update"
  exit 1
fi
