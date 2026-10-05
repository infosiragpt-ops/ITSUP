#!/usr/bin/env bash
# Copia de seguridad de ISUP Aula Virtual: base de datos SQLite (copia consistente y verificada), archivos
# subidos y configuración (/etc/isup/isup.env, que contiene el secreto de sesión).
# Variables: DATA_DIR (/var/lib/isup), BACKUP_DIR (/var/backups/isup), KEEP_DAYS (14), SVC_USER (isup)
set -euo pipefail
DATA_DIR="${DATA_DIR:-/var/lib/isup}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/isup}"
KEEP_DAYS="${KEEP_DAYS:-14}"
SVC_USER="${SVC_USER:-isup}"
ENV_FILE="${ENV_FILE:-/etc/isup/isup.env}"
STAMP="$(date +%Y%m%d-%H%M%S)"
DB="$DATA_DIR/isup.db"

[ "$(id -u)" -eq 0 ] || { echo "Ejecuta como root (sudo isup-backup)."; exit 1; }
install -d -m 0750 -o root -g "$SVC_USER" "$BACKUP_DIR"
[ -f "$DB" ] || { echo "No existe la base de datos $DB; nada que respaldar."; exit 0; }

# La copia la hace el usuario del servicio: así los archivos auxiliares -wal/-shm nunca quedan de root
# (.backup usa la API de SQLite: segura aunque el servidor esté escribiendo, modo WAL)
TMP="$DATA_DIR/.backup-$STAMP.db"
runuser -u "$SVC_USER" -- sqlite3 "$DB" ".backup '$TMP'"
if [ "$(runuser -u "$SVC_USER" -- sqlite3 "$TMP" 'PRAGMA integrity_check')" != "ok" ]; then
  rm -f "$TMP"; echo "✖ La copia de la base de datos no pasó la verificación de integridad."; exit 1
fi
gzip -f "$TMP"
install -o root -g "$SVC_USER" -m 0640 "$TMP.gz" "$BACKUP_DIR/isup-$STAMP.db.gz"
rm -f "$TMP.gz"

if [ -d "$DATA_DIR/uploads" ]; then
  # Un archivo que cambie durante la copia (subida en curso) no debe abortar el respaldo (tar devuelve 1)
  tar --warning=no-file-changed -czf "$BACKUP_DIR/uploads-$STAMP.tar.gz" -C "$DATA_DIR" uploads || [ $? -eq 1 ]
  chown root:"$SVC_USER" "$BACKUP_DIR/uploads-$STAMP.tar.gz"; chmod 0640 "$BACKUP_DIR/uploads-$STAMP.tar.gz"
fi
[ -f "$ENV_FILE" ] && install -o root -g root -m 0600 "$ENV_FILE" "$BACKUP_DIR/isup-env-$STAMP"

# Retención
find "$BACKUP_DIR" -type f \( -name 'isup-*.db.gz' -o -name 'uploads-*.tar.gz' -o -name 'isup-env-*' \) -mtime +"$KEEP_DAYS" -delete

FREE_MB="$(df -Pm "$BACKUP_DIR" | awk 'NR==2{print $4}')"
[ "${FREE_MB:-0}" -ge 1024 ] || echo "⚠ Quedan solo ${FREE_MB} MB libres en el disco: descarga y borra copias antiguas o amplía el VPS."
echo "Copia creada: $BACKUP_DIR/isup-$STAMP.db.gz ($(du -sh "$BACKUP_DIR" | cut -f1) en total)"
