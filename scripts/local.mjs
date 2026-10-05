#!/usr/bin/env node
/**
 * Arranque local de ISUP Aula Virtual con un solo comando (npm run local, iniciar.bat, iniciar.sh).
 *
 *  1. Comprueba la versión de Node.js (necesita el módulo node:sqlite).
 *  2. Instala dependencias si falta node_modules y compila la interfaz si falta client/dist.
 *  3. Arranca el servidor, espera a que responda y abre el navegador en la pantalla de ingreso.
 *
 * Variables opcionales: PORT (3000), NO_OPEN=1 (no abrir navegador), ISUP_REBUILD=1 (recompilar la interfaz).
 */
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT) || 3000;
const WIN = process.platform === 'win32';
const NPM = WIN ? 'npm.cmd' : 'npm';

const say = (s = '') => console.log(s);
const fail = (msg) => {
  say(`\n  ✖ ${msg}\n`);
  if (WIN) { say('  Pulsa Enter para cerrar esta ventana.'); try { fs.readFileSync(0, { encoding: 'utf8', flag: 'r' }); } catch {} }
  process.exit(1);
};

/* ---------- 1. Versión de Node ---------- */
const [major, minor] = process.versions.node.split('.').map(Number);
// node:sqlite llegó en 22.5 tras la bandera --experimental-sqlite y se habilitó por defecto en 22.13 / 23.4.
const needsFlag = (major === 22 && minor >= 5 && minor < 13) || (major === 23 && minor < 4);
if (major < 22 || (major === 22 && minor < 5)) {
  fail(`Se necesita Node.js 22.13 o superior (tienes ${process.versions.node}). Descárgalo en https://nodejs.org (versión LTS) e inténtalo de nuevo.`);
}
const nodeFlags = needsFlag ? ['--experimental-sqlite'] : [];

say('');
say('  ISUP · Aula Virtual — modo local');
say('  ─────────────────────────────────');
say(`  Node.js ${process.versions.node}${needsFlag ? ' (se activa --experimental-sqlite)' : ''} · carpeta ${ROOT}`);

/* ---------- 2. Dependencias e interfaz ---------- */
const run = (cmd, args, label) => {
  say(`\n  ▸ ${label}…`);
  const r = spawnSync(cmd, args, { cwd: ROOT, stdio: 'inherit', shell: WIN });
  if (r.status !== 0) fail(`${label} falló (código ${r.status ?? r.error?.message}). Revisa el mensaje anterior; si es un problema de red, vuelve a intentarlo.`);
};
const hasBuild = fs.existsSync(path.join(ROOT, 'client', 'dist', 'index.html'));
const needsDeps = !fs.existsSync(path.join(ROOT, 'node_modules', 'express'));
const needsDevDeps = (!hasBuild || process.env.ISUP_REBUILD === '1') && !fs.existsSync(path.join(ROOT, 'node_modules', 'vite'));

if (needsDeps || needsDevDeps) {
  // Si la interfaz ya viene compilada solo hacen falta las dependencias del servidor.
  const args = ['install', '--no-audit', '--no-fund', ...(hasBuild && process.env.ISUP_REBUILD !== '1' ? ['--omit=dev'] : [])];
  run(NPM, args, 'Instalando dependencias (solo la primera vez, puede tardar un par de minutos)');
}
if (!hasBuild || process.env.ISUP_REBUILD === '1') run(NPM, ['run', 'build'], 'Compilando la interfaz');

/* ---------- 3. Servidor ---------- */
say(`\n  ▸ Iniciando el servidor en el puerto ${PORT}…`);
const server = spawn(process.execPath, [...nodeFlags, path.join(ROOT, 'server', 'index.js')], {
  cwd: ROOT, stdio: ['ignore', 'inherit', 'inherit'], env: { ...process.env, PORT: String(PORT), NODE_NO_WARNINGS: '1' },
});
server.on('exit', (code) => {
  if (code && code !== 0) fail(`El servidor se detuvo con código ${code}. Si dice "EADDRINUSE", el puerto ${PORT} está ocupado: cierra la otra ventana o ejecuta con otro puerto (PORT=3001).`);
  process.exit(code ?? 0);
});
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { server.kill(); process.exit(0); });

const url = `http://localhost:${PORT}/login`;
const lanUrls = Object.values(os.networkInterfaces()).flat()
  .filter((i) => i && i.family === 'IPv4' && !i.internal)
  .map((i) => `http://${i.address}:${PORT}`);

const started = Date.now();
(async function waitAndOpen() {
  while (Date.now() - started < 60_000) {
    try {
      const r = await fetch(`http://localhost:${PORT}/api/health`);
      if (r.ok) break;
    } catch {}
    await new Promise((res) => setTimeout(res, 500));
  }
  say('');
  say('  ✔ Aula virtual lista.');
  say(`    Ingreso:        ${url}`);
  if (lanUrls.length) say(`    Desde celular:  ${lanUrls.join('  ')}  (misma red Wi-Fi)`);
  say('    Accesos demo:   estudiante@isup.edu.pe · docente@isup.edu.pe · admin@isup.edu.pe · contraseña Isup2026!');
  say('    Deja esta ventana abierta mientras uses el aula. Para detener: Ctrl+C (o cierra la ventana).');
  say('');
  if (process.env.NO_OPEN === '1') return;
  const opener = WIN ? ['cmd', ['/c', 'start', '""', url]] : process.platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]];
  try { spawn(opener[0], opener[1], { stdio: 'ignore', detached: true }).on('error', () => {}).unref(); } catch {}
})();
