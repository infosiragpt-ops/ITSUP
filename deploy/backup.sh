#!/usr/bin/env bash
# Copia de seguridad de ISUP Aula Virtual: base de datos SQLite (copia consistente) + archivos subidos.
# Variables: DATA_DIR (/var/lib/isup), BACKUP_DIR (/var/backups/isup), KEEP_DAYS (14)
set -euo pipefail
DATA_DIR="${DATA_DIR:-/var/lib/isup}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/isup}"
KEEP_DAYS="${KEEP_DAYS:-14}"
STAMP="$(date +%Y%m%d-%H%M%S)"
DB="$DATA_DIR/isup.db"

mkdir -p "$BACKUP_DIR"
[ -f "$DB" ] || { echo "No existe la base de datos $DB; nada que respaldar."; exit 0; }

# .backup usa la API de SQLite: segura aunque el servidor esté escribiendo (modo WAL)
sqlite3 "$DB" ".backup '$BACKUP_DIR/isup-$STAMP.db'"
gzip -f "$BACKUP_DIR/isup-$STAMP.db"
if [ -d "$DATA_DIR/uploads" ]; then
  tar -czf "$BACKUP_DIR/uploads-$STAMP.tar.gz" -C "$DATA_DIR" uploads
fi
chmod 0640 "$BACKUP_DIR"/*-"$STAMP".* 2>/dev/null || true

# Retención
find "$BACKUP_DIR" -type f \( -name 'isup-*.db.gz' -o -name 'uploads-*.tar.gz' \) -mtime +"$KEEP_DAYS" -delete
echo "Copia creada: $BACKUP_DIR/isup-$STAMP.db.gz ($(du -sh "$BACKUP_DIR" | cut -f1) en total)"
