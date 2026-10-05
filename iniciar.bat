@echo off
rem  ISUP Aula Virtual - arranque local en Windows (doble clic). Opcion: iniciar.bat red  (acceso desde el celular)
title ISUP Aula Virtual
cd /d "%~dp0"

if not exist "%~dp0scripts\local.mjs" (
  echo.
  echo   Este archivo se esta ejecutando desde dentro del ZIP o fuera de su carpeta.
  echo   1. Cierra esta ventana.
  echo   2. Clic derecho sobre el archivo ZIP ^> "Extraer todo..." y elige una carpeta ^(por ejemplo C:\ISUP^).
  echo   3. Abre la carpeta extraida y haz doble clic en iniciar.bat.
  echo.
  pause
  exit /b 1
)

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   No se encontro Node.js en este equipo.
  echo   1. Descargalo desde https://nodejs.org  ^(boton verde "LTS", version 22 o superior^)
  echo   2. Instalalo con las opciones por defecto, cierra esta ventana y vuelve a hacer doble clic.
  echo.
  pause
  exit /b 1
)

set "NODE_MAJOR="
for /f "tokens=1 delims=." %%v in ('node -v 2^>nul') do set "NODE_MAJOR=%%v"
if defined NODE_MAJOR set "NODE_MAJOR=%NODE_MAJOR:v=%"
if not defined NODE_MAJOR set "NODE_MAJOR=0"
if %NODE_MAJOR% LSS 22 (
  echo.
  echo   Tu Node.js es antiguo ^(version %NODE_MAJOR%^). Se necesita la version 22 o superior.
  echo   Descarga la version LTS desde https://nodejs.org, instalala y vuelve a hacer doble clic.
  echo.
  pause
  exit /b 1
)

set "ISUP_LAUNCHER=1"
if /i "%~1"=="red" set "ISUP_LAN=1"
node "%~dp0scripts\local.mjs"
set "CODE=%errorlevel%"
if not "%CODE%"=="0" (
  echo.
  echo   El aula virtual se detuvo con un error ^(codigo %CODE%^). Revisa el mensaje anterior.
  pause
)
