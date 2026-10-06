#!/usr/bin/env bash
# Importa el catálogo de cursos (deploy/catalogo) al aula: cursos por carrera y ciclo con sílabo, diapositivas,
# lecturas, casos, tareas, cuestionarios y sesiones. Se ejecuta como el usuario del servicio.
#   sudo isup-cursos                   → crea los cursos que falten y actualiza datos, sílabos y diapositivas
#   sudo isup-cursos --rehacer         → vuelve a crear el contenido de los cursos sin matrículas ni notas
#   sudo isup-cursos --solo=slug1,slug2
set -euo pipefail
APP_DIR="${APP_DIR:-/opt/isup}"
SVC_USER="${SVC_USER:-isup}"
ENV_FILE="${ENV_FILE:-/etc/isup/isup.env}"
[ "$(id -u)" -eq 0 ] || { echo "Ejecuta con sudo."; exit 1; }
DATA_DIR="$(grep -E '^DATA_DIR=' "$ENV_FILE" 2>/dev/null | cut -d= -f2- | tr -d '"' || true)"
exec runuser -u "$SVC_USER" -- env HOME="$APP_DIR" DATA_DIR="${DATA_DIR:-/var/lib/isup}" NODE_OPTIONS=--disable-warning=ExperimentalWarning \
  node "$APP_DIR/server/tools/import-courses.mjs" "$APP_DIR/deploy/catalogo" "$@"
