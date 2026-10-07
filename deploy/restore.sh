#!/usr/bin/env bash
# Restaura una copia de seguridad de ISUP Aula Virtual (base de datos y, si existe, archivos subidos).
#   sudo isup-restore                      → lista las copias disponibles
#   sudo isup-restore AAAAMMDD-HHMMSS      → restaura esa copia (pide confirmación)
#   sudo isup-restore AAAAMMDD-HHMMSS --si → sin confirmación
#   Opción --solo-bd: no toca la carpeta uploads.
set -euo pipefail
DATA_DIR="${DATA_DIR:-/var/lib/isup}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/isup}"
SVC_USER="${SVC_USER:-isup}"
PORT="$(grep -E '^PORT=' /etc/isup/isup.env 2>/dev/null | cut -d= -f2 | tr -d '"' || true)"
PORT="${PORT:-3000}"

[ "$(id -u)" -eq 0 ] || { echo "Ejecuta como root (sudo isup-restore)."; exit 1; }
STAMP="${1:-}"; YES=0; ONLY_DB=0
for a in "${@:2}"; do case "$a" in --si|-y) YES=1 ;; --solo-bd) ONLY_DB=1 ;; esac; done

if [ -z "$STAMP" ]; then
  echo "Copias disponibles en $BACKUP_DIR (fecha-hora del servidor):"
  ls -1 "$BACKUP_DIR"/isup-*.db.gz 2>/dev/null | sed -E 's#.*/isup-([0-9]{8}-[0-9]{6})\.db\.gz#  \1#' || true
  echo "Uso: sudo isup-restore AAAAMMDD-HHMMSS"
  exit 0
fi
DBGZ="$BACKUP_DIR/isup-$STAMP.db.gz"
UPTAR="$BACKUP_DIR/uploads-$STAMP.tar.gz"
[ -f "$DBGZ" ] || { echo "No existe la copia $DBGZ"; exit 1; }

TMP="$DATA_DIR/.restore-$STAMP.db"
gunzip -c "$DBGZ" > "$TMP"
chown "$SVC_USER:$SVC_USER" "$TMP"; chmod 0640 "$TMP"
CHECK="$(runuser -u "$SVC_USER" -- sqlite3 "$TMP" 'PRAGMA integrity_check')"
[ "$CHECK" = "ok" ] || { rm -f "$TMP"; echo "✖ La copia está dañada (integrity_check: $CHECK)."; exit 1; }
USERS="$(runuser -u "$SVC_USER" -- sqlite3 "$TMP" 'SELECT COUNT(*) FROM users' 2>/dev/null || echo '?')"

echo "Se restaurará la copia $STAMP ($USERS usuarios)$([ -f "$UPTAR" ] && [ "$ONLY_DB" = 0 ] && echo ' y los archivos subidos')."
echo "La base actual se respalda antes (isup-backup) y el aula se detiene unos segundos."
if [ "$YES" != 1 ]; then
  read -r -p "¿Continuar? [s/N] " ans
  case "$ans" in s|S|si|sí|SI|y|Y) ;; *) rm -f "$TMP"; echo "Cancelado."; exit 1 ;; esac
fi

/usr/local/bin/isup-backup || { rm -f "$TMP"; echo "✖ No se pudo hacer la copia previa; no se restaura."; exit 1; }
systemctl stop isup.service
# Con el modo WAL, los archivos auxiliares de la base anterior deben eliminarse o corromperían la restaurada
rm -f "$DATA_DIR/isup.db-wal" "$DATA_DIR/isup.db-shm"
mv -f "$TMP" "$DATA_DIR/isup.db"
if [ -f "$UPTAR" ] && [ "$ONLY_DB" = 0 ]; then
  rm -rf "$DATA_DIR/uploads.restaurando"
  mkdir -p "$DATA_DIR/uploads.restaurando"
  tar -xzf "$UPTAR" -C "$DATA_DIR/uploads.restaurando"
  rm -rf "$DATA_DIR/uploads.anterior"
  [ ! -d "$DATA_DIR/uploads" ] || mv "$DATA_DIR/uploads" "$DATA_DIR/uploads.anterior"
  mv "$DATA_DIR/uploads.restaurando/uploads" "$DATA_DIR/uploads"
  rm -rf "$DATA_DIR/uploads.restaurando" "$DATA_DIR/uploads.anterior"
  chown -R "$SVC_USER:$SVC_USER" "$DATA_DIR/uploads"; chmod 0750 "$DATA_DIR/uploads"
fi
systemctl start isup.service
for _ in $(seq 1 40); do curl -fsS "http://127.0.0.1:$PORT/api/health" >/dev/null 2>&1 && break; sleep 1; done
if curl -fsS "http://127.0.0.1:$PORT/api/health" >/dev/null 2>&1; then
  echo "✔ Copia $STAMP restaurada y aula en ejecución."
else
  journalctl -u isup -n 30 --no-pager
  echo "✖ El aula no respondió tras la restauración (ver registro anterior)."; exit 1
fi
