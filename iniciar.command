#!/usr/bin/env bash
# ISUP Aula Virtual - doble clic en macOS (abre Terminal y arranca el aula)
cd "$(dirname "$0")" || exit 1
exec bash "./iniciar.sh"
