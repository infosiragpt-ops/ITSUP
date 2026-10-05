#!/usr/bin/env bash
# Genera el paquete "listo para usar" del aula virtual (ZIP con interfaz compilada y dependencias de
# producción incluidas), para ejecutarlo en una computadora sin internet ni conocimientos técnicos.
#
#   bash scripts/empaquetar.sh            → isup-aula-virtual-local.zip en la carpeta del proyecto
#   bash scripts/empaquetar.sh /ruta/salida.zip
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${1:-$ROOT/isup-aula-virtual-local.zip}"
STAGE="$(mktemp -d)"
PKG="$STAGE/isup-aula-virtual"
trap 'rm -rf "$STAGE"' EXIT

cd "$ROOT"
echo "▸ Compilando la interfaz (modo local, con accesos de demostración)"
npm ci --no-audit --no-fund --loglevel=error
npm run build --silent

echo "▸ Copiando archivos del proyecto"
mkdir -p "$PKG"
# Archivos versionados (sin la configuración del editor), más la interfaz compilada
git ls-files -co --exclude-standard | grep -v -e '^\.claude/' -e '^\.github/' -e '\.zip$' | while IFS= read -r f; do
  mkdir -p "$PKG/$(dirname "$f")"; cp -p "$f" "$PKG/$f"
done
mkdir -p "$PKG/client"; cp -rp client/dist "$PKG/client/dist"

echo "▸ Instalando solo las dependencias del servidor dentro del paquete"
(cd "$PKG" && npm ci --omit=dev --no-audit --no-fund --loglevel=error && rm -rf node_modules/.package-lock.json)

# Archivo de bienvenida en la raíz del ZIP
cat > "$PKG/LEEME.txt" <<'EOF'
ISUP · Aula Virtual · paquete local
===================================

1. Extrae TODO el ZIP a una carpeta (por ejemplo C:\ISUP o tu carpeta personal). No lo ejecutes desde dentro del ZIP.
   Windows: si al descargarlo aparece "Windows protegió su PC", clic derecho sobre el ZIP → Propiedades → marca "Desbloquear" → Aceptar, y recién extráelo.
2. Instala Node.js (una sola vez) desde https://nodejs.org → botón verde "LTS".
3. Abre el aula:
   - Windows: doble clic en iniciar.bat
   - macOS:   doble clic en iniciar.command (la primera vez: clic derecho → Abrir)
   - Linux:   ./iniciar.sh
4. Se abrirá el navegador en http://localhost:3000/login
   Accesos de demostración (contraseña Isup2026!): estudiante@isup.edu.pe · docente@isup.edu.pe · admin@isup.edu.pe

Guía completa: INICIO_RAPIDO.md · Qué probar: DEMO_ACCESOS.md · Normativa: NORMATIVA.md
EOF

echo "▸ Comprimiendo"
rm -f "$OUT"
(cd "$STAGE" && zip -qr -X "$OUT" isup-aula-virtual)
echo "✔ Paquete creado: $OUT ($(du -h "$OUT" | cut -f1))"
unzip -l "$OUT" | tail -1
