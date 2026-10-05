#!/usr/bin/env bash
# ISUP Aula Virtual - arranque local en macOS / Linux
# Uso: ./iniciar.sh            (o doble clic en iniciar.command en macOS)
#      ./iniciar.sh --red      (permite entrar desde el celular en la misma red Wi-Fi)
cd "$(dirname "$0")" || exit 1

pause() { if [ -t 0 ]; then read -r -p "  Pulsa Enter para cerrar…" _; fi; }

# Node instalado con nvm/Homebrew/Volta: la Terminal abierta por doble clic puede no cargar el PATH
if ! command -v node >/dev/null 2>&1; then
  for d in "$HOME/.nvm/versions/node"/*/bin /opt/homebrew/bin /usr/local/bin "$HOME/.volta/bin" "$HOME/.local/share/fnm/aliases/default/bin"; do
    [ -x "$d/node" ] && { PATH="$d:$PATH"; break; }
  done
fi
if ! command -v node >/dev/null 2>&1; then
  echo
  echo "  No se encontró Node.js en este equipo."
  echo "  Descárgalo desde https://nodejs.org (botón \"LTS\", versión 22 o superior), instálalo y vuelve a ejecutar este archivo."
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
