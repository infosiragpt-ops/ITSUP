@echo off
rem  ISUP Aula Virtual - arranque local en Windows (doble clic)
chcp 65001 >nul
title ISUP Aula Virtual
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   No se encontro Node.js en este equipo.
  echo   1. Descargalo desde https://nodejs.org  ^(version LTS, 22 o superior^)
  echo   2. Instalalo con las opciones por defecto y reinicia esta ventana.
  echo.
  pause
  exit /b 1
)

node "%~dp0scripts\local.mjs"
set CODE=%errorlevel%
if not "%CODE%"=="0" (
  echo.
  echo   El aula virtual se detuvo con un error ^(codigo %CODE%^).
  pause
)
