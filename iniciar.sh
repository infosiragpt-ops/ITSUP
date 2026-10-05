#!/usr/bin/env bash
# ISUP Aula Virtual - arranque local en macOS / Linux
# Uso: ./iniciar.sh            (o doble clic en iniciar.command en macOS)
#      ./iniciar.sh --red      (permite entrar desde el celular en la misma red Wi-Fi)
#      bash iniciar.sh         (si el archivo perdió el permiso de ejecución al descomprimir)
cd "$(dirname "$0")" || exit 1

pause() { if [ -t 0 ]; then read -r -p "  Pulsa Enter para terminar (luego puedes cerrar esta ventana)…" _; fi; }

# Abierto sin terminal (doble clic en el explorador de archivos de Linux): reabrirse dentro de una terminal
# para que los mensajes se vean y Ctrl+C funcione.
if [ ! -t 1 ] && [ -z "${ISUP_EN_TERMINAL:-}" ] && [ "$(uname -s)" = Linux ] && [ -n "${DISPLAY:-}${WAYLAND_DISPLAY:-}" ]; then
  export ISUP_EN_TERMINAL=1
  for t in x-terminal-emulator gnome-terminal konsole xfce4-terminal mate-terminal tilix xterm; do
    command -v "$t" >/dev/null 2>&1 || continue
    case "$t" in
      gnome-terminal|tilix)         exec "$t" -- bash "$0" "$@" ;;
      xfce4-terminal|mate-terminal) exec "$t" -x bash "$0" "$@" ;;
      *)                            exec "$t" -e bash "$0" "$@" ;;
    esac
  done
fi

# El lanzador debe seguir dentro de la carpeta del aula (no arrastrarlo solo al Escritorio ni al Dock)
if [ ! -f ./scripts/local.mjs ] || [ ! -f ./package.json ]; then
  echo
  echo "  Este archivo debe quedarse dentro de la carpeta del aula virtual (junto a package.json, scripts/ y server/)."
  echo "  Descomprime el ZIP completo y vuelve a abrir iniciar.sh / iniciar.command desde esa carpeta."
  echo
  pause; exit 1
fi

# Node instalado con nvm, Homebrew (node@22/node@24 son keg-only), fnm, Volta, asdf, mise o snap: fuera de una
# terminal interactiva el PATH no los incluye. Se elige la versión más nueva que cumpla el mínimo (22).
node_major() { "$1" -v 2>/dev/null | sed 's/^v\([0-9]*\).*/\1/'; }
if ! command -v node >/dev/null 2>&1 || [ "$(node_major node)" -lt 22 ] 2>/dev/null; then
  mejor=""; mejor_v=0
  for d in /opt/homebrew/bin /usr/local/bin \
           /opt/homebrew/opt/node@24/bin /opt/homebrew/opt/node@22/bin /usr/local/opt/node@24/bin /usr/local/opt/node@22/bin \
           "$HOME/.nvm/versions/node"/*/bin "$HOME/.volta/bin" "$HOME/.asdf/shims" "$HOME/.local/share/mise/shims" \
           "$HOME/.local/share/fnm/aliases/default/bin" "$HOME/Library/Application Support/fnm/aliases/default/bin" /snap/bin; do
    [ -x "$d/node" ] || continue
    v=$(node_major "$d/node"); [ -n "$v" ] || continue
    if [ "$v" -ge 22 ] && [ "$v" -gt "$mejor_v" ]; then mejor="$d"; mejor_v=$v; fi
  done
  if [ -n "$mejor" ]; then
    PATH="$mejor:$PATH"; export PATH
  elif [ -s "${NVM_DIR:-$HOME/.nvm}/nvm.sh" ]; then
    . "${NVM_DIR:-$HOME/.nvm}/nvm.sh" >/dev/null 2>&1   # nvm es una función de shell; se carga a mano
  fi
fi
if ! command -v node >/dev/null 2>&1; then
  echo
  echo "  No se encontró Node.js en este equipo."
  case "$(uname -s)" in
    Darwin) echo "  Instálalo desde https://nodejs.org (botón \"LTS\", instalador .pkg) o con Homebrew: brew install node" ;;
    *)      echo "  Instálalo desde https://nodejs.org (botón \"LTS\"): en Linux usa nvm, NodeSource o el .tar.xz; el paquete"
            echo "  de Ubuntu/Debian suele ser antiguo (se necesita la versión 22 o superior)." ;;
  esac
  echo "  Después vuelve a ejecutar este archivo."
  echo
  pause
  exit 1
fi

export ISUP_LAUNCHER=1
node "./scripts/local.mjs" "$@"
code=$?
if [ "$code" -ne 0 ]; then
  echo
  echo "  El aula virtual se detuvo con un error (código $code). Revisa el mensaje anterior."
  pause
fi
exit "$code"
