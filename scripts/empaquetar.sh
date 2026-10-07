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
# (deploy/ son scripts del servidor VPS con sudo: no van en el paquete de escritorio)
git ls-files -co --exclude-standard | grep -v -e '^\.claude/' -e '^\.github/' -e '^deploy/' -e '\.zip$' -e '\.sha256$' | while IFS= read -r f; do
  mkdir -p "$PKG/$(dirname "$f")"; cp -p "$f" "$PKG/$f"
done
mkdir -p "$PKG/client"; cp -rp client/dist "$PKG/client/dist"
# Los lanzadores deben ser ejecutables aunque el repositorio se haya copiado desde Windows (perdería los modos)
chmod 0755 "$PKG/iniciar.sh" "$PKG/iniciar.command" "$PKG/scripts/local.mjs"

echo "▸ Instalando solo las dependencias del servidor dentro del paquete"
(cd "$PKG" && npm ci --omit=dev --no-audit --no-fund --loglevel=error && rm -rf node_modules/.package-lock.json)

# Archivo de bienvenida en la raíz del ZIP (texto para personas no técnicas; la guía completa es INICIO_RAPIDO.md)
cat > "$PKG/LEEME.txt" <<'EOF'
ISUP · Aula Virtual · paquete local
===================================

1. Extrae TODO el ZIP a una carpeta (Windows: C:\ISUP; Mac: Descargas o tu carpeta personal). No lo ejecutes desde dentro del ZIP
   y no pongas la carpeta en OneDrive ni en iCloud Drive (Escritorio/Documentos sincronizados).
   Windows: ANTES de extraer, clic derecho sobre el ZIP → Propiedades → marca "Desbloquear" → Aceptar
   (evita "Windows protegió su PC" y el bloqueo de Smart App Control).
2. Instala Node.js (una sola vez) desde https://nodejs.org → botón verde "LTS" (sirve 22, 24 o más nuevo).
3. Abre el aula:
   - Windows: doble clic en "iniciar" (iniciar.bat). Si sale "Windows protegió su PC": Más información → Ejecutar de todas formas.
   - macOS:   doble clic en iniciar.command. La primera vez macOS lo bloquea: pulsa "Listo", ve a Ajustes del Sistema →
              Privacidad y seguridad → "Abrir de todos modos" y vuelve a hacer doble clic (macOS 13/14: Control+clic → Abrir).
              Alternativa sin permisos: abre Terminal, escribe "bash " y arrastra iniciar.sh a la ventana.
   - Linux:   abre un terminal en la carpeta y escribe: bash iniciar.sh
4. Se abrirá el navegador en http://localhost:3000/login. Deja la ventana abierta mientras uses el aula; para detener, ciérrala.
   Accesos de demostración (contraseña Isup2026!): estudiante@isup.edu.pe · docente@isup.edu.pe · admin@isup.edu.pe
5. Tus datos quedan en la carpeta "data" (cópiala, con el aula cerrada, para hacer un respaldo).
   Para volver a la demo con fechas de hoy: iniciar.bat reiniciar (Windows) o bash iniciar.sh --reiniciar (Mac/Linux).
   Para entrar desde el celular (misma Wi-Fi): iniciar-red.bat (Windows) o bash iniciar.sh --red (Mac/Linux).

Guía completa: INICIO_RAPIDO.md · Qué probar: DEMO_ACCESOS.md · Normativa: NORMATIVA.md · Versión: VERSION.txt
EOF

# Identificación del paquete (para soporte y para saber qué versión tiene instalada el usuario)
printf 'ISUP Aula Virtual %s\nPaquete local generado el %s\nCommit: %s\nRequiere Node.js 22.13 o superior (https://nodejs.org, LTS)\n' \
  "$(node -p "require('./package.json').version")" "$(date -u +%Y-%m-%d)" "$(git rev-parse --short HEAD 2>/dev/null || echo desconocido)" > "$PKG/VERSION.txt"

echo "▸ Comprimiendo"
rm -f "$OUT"
(cd "$STAGE" && zip -qr -X "$OUT" isup-aula-virtual)
echo "▸ Comprobando el paquete"
LISTA="$(unzip -Z1 "$OUT")"
fallo() { echo "✖ $1"; exit 1; }
printf '%s\n' "$LISTA" | grep -E '^isup-aula-virtual/(data/|\.claude/|\.git/|\.env$)' >/dev/null && fallo "el ZIP contiene data/, .claude/, .git/ o .env"
printf '%s\n' "$LISTA" | grep -E '\.node$' >/dev/null && fallo "el ZIP contiene binarios nativos (.node): no sería portable entre sistemas"
printf '%s\n' "$LISTA" | grep -E '^isup-aula-virtual/client/dist/index\.html$' >/dev/null || fallo "falta client/dist (interfaz compilada)"
printf '%s\n' "$LISTA" | grep -E '^isup-aula-virtual/node_modules/express/package\.json$' >/dev/null || fallo "faltan las dependencias del servidor"
printf '%s\n' "$LISTA" | grep -E '^isup-aula-virtual/node_modules/vite/' >/dev/null && fallo "el ZIP incluye devDependencies (vite): se empaquetó sin --omit=dev"
for f in iniciar.sh iniciar.command scripts/local.mjs; do
  unzip -Z "$OUT" "isup-aula-virtual/$f" | grep '^-rwx' >/dev/null || fallo "$f perdió el permiso de ejecución (genera el ZIP en Linux/macOS con zip, no en Windows)"
done
unzip -p "$OUT" isup-aula-virtual/iniciar.bat | head -1 | grep -q $'\r$' || fallo "iniciar.bat no tiene finales de línea CRLF"
sha256sum "$OUT" | tee "$OUT.sha256"
echo "✔ Paquete creado: $OUT ($(du -h "$OUT" | cut -f1), $(printf '%s\n' "$LISTA" | grep -vc '/$') archivos)"
