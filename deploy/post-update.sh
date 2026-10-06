#!/usr/bin/env bash
# Tareas posteriores a cada despliegue (las ejecutan el instalador e isup-update tras comprobar que el aula responde).
# Deben ser idempotentes: se repiten en cada actualización.
set -euo pipefail
APP_DIR="${APP_DIR:-/opt/isup}"

echo "▸ Catálogo de carreras (deploy/programas-tepsup.json)"
bash "$APP_DIR/deploy/import-programs.sh" "$APP_DIR/deploy/programas-tepsup.json"

if [ -d "$APP_DIR/deploy/catalogo/cursos" ] && [ -n "$(ls -A "$APP_DIR/deploy/catalogo/cursos" 2>/dev/null)" ]; then
  echo "▸ Catálogo de cursos (deploy/catalogo): sílabos, diapositivas, lecturas, casos, tareas y cuestionarios"
  bash "$APP_DIR/deploy/import-courses.sh"
fi
