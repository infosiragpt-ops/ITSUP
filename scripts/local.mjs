#!/usr/bin/env node
/**
 * Arranque local de ISUP Aula Virtual con un solo comando (npm run local, iniciar.bat, iniciar.sh).
 *
 *  1. Comprueba la versión de Node.js (necesita el módulo node:sqlite).
 *  2. Instala dependencias si falta node_modules y compila la interfaz si falta client/dist.
 *  3. Si el aula ya está abierta en el puerto, solo abre el navegador; si el puerto lo usa otro programa, busca uno libre.
 *  4. Arranca el servidor, espera a que responda y abre el navegador en la pantalla de ingreso.
 *
 * Opciones: --red (o ISUP_LAN=1) permite entrar desde otros dispositivos de la misma red Wi-Fi.
 * Variables: PORT (3000), NO_OPEN=1 (no abrir navegador), ISUP_REBUILD=1 (recompilar la interfaz), ISUP_LAUNCHER=1 (la pausa final la hace el .bat).
 */
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WIN = process.platform === 'win32';
const ARGS = new Set(process.argv.slice(2));
const LAN = ARGS.has('--red') || process.env.ISUP_LAN === '1';
const HOST = LAN ? '0.0.0.0' : '127.0.0.1';
const BASE_PORT = Number(process.env.PORT) || 3000;

// Símbolos: la consola clásica de Windows (conhost) no dibuja bien los glifos Unicode
const FANCY = !WIN || !!process.env.WT_SESSION || !!process.env.TERM_PROGRAM || !!process.env.ConEmuANSI;
const S = FANCY
  ? { ok: '✔', bad: '✖', warn: '⚠', step: '▸', rule: '─'.repeat(34), dots: '…', dot: '·' }
  : { ok: 'OK', bad: 'ERROR:', warn: 'AVISO:', step: '>', rule: '-'.repeat(34), dots: '...', dot: '-' };

const say = (s = '') => console.log(s);
const waitKey = () => {
  if (process.env.ISUP_LAUNCHER === '1' || !process.stdin.isTTY) return; // el .bat/.sh ya hacen la pausa
  say('  Pulsa Enter para cerrar esta ventana.');
  try { fs.readSync(0, Buffer.alloc(64)); } catch {}
};
const fail = (msg) => { say(`\n  ${S.bad} ${msg}\n`); waitKey(); process.exit(1); };

/* ---------- 1. Versión de Node ---------- */
const [major, minor] = process.versions.node.split('.').map(Number);
// node:sqlite llegó en 22.5 tras la bandera --experimental-sqlite y se habilitó por defecto en 22.13 / 23.4.
const needsFlag = (major === 22 && minor >= 5 && minor < 13) || (major === 23 && minor < 4);
if (major < 22 || (major === 22 && minor < 5)) {
  fail(`Se necesita Node.js 22.13 o superior (tienes ${process.versions.node}). Descárgalo en https://nodejs.org (versión LTS), instálalo y vuelve a ejecutar este archivo.`);
}
const nodeFlags = needsFlag ? ['--experimental-sqlite'] : [];

say('');
say('  ISUP ' + S.dot + ' Aula Virtual ' + S.dot + ' modo local');
say('  ' + S.rule);
say(`  Node.js ${process.versions.node}${needsFlag ? ' (se activa --experimental-sqlite)' : ''}`);
say(`  Carpeta: ${ROOT}`);

// Carpeta sincronizada con OneDrive: la base de datos SQLite puede bloquearse o corromperse
const oneDrive = [process.env.OneDrive, process.env.OneDriveConsumer, process.env.OneDriveCommercial].filter(Boolean);
if (WIN && (oneDrive.some((d) => ROOT.toLowerCase().startsWith(d.toLowerCase())) || /\\onedrive\\/i.test(ROOT))) {
  say(`\n  ${S.warn} Esta carpeta está dentro de OneDrive. Para evitar problemas con la base de datos, mueve la carpeta a C:\\ISUP (o fuera de OneDrive) y vuelve a abrirla.`);
}

/* ---------- 2. Dependencias e interfaz ---------- */
const npmCli = path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js');
const runNpm = (args, label) => {
  say(`\n  ${S.step} ${label}${S.dots}`);
  const r = fs.existsSync(npmCli)
    ? spawnSync(process.execPath, [npmCli, ...args], { cwd: ROOT, stdio: 'inherit' })
    : spawnSync(WIN ? 'npm.cmd' : 'npm', args, { cwd: ROOT, stdio: 'inherit', shell: WIN });
  if (r.status !== 0) fail(`${label} falló (código ${r.status ?? r.error?.message}). Si es un problema de red, revisa tu conexión y vuelve a intentarlo.`);
};
const hasBuild = fs.existsSync(path.join(ROOT, 'client', 'dist', 'index.html'));
const rebuild = process.env.ISUP_REBUILD === '1' || !hasBuild;
const needsDeps = !fs.existsSync(path.join(ROOT, 'node_modules', 'express'));
const needsDevDeps = rebuild && !fs.existsSync(path.join(ROOT, 'node_modules', 'vite'));
if (needsDeps || needsDevDeps) {
  // Con la interfaz ya compilada solo hacen falta las dependencias del servidor (ligeras).
  runNpm(['install', '--no-audit', '--no-fund', ...(rebuild ? [] : ['--omit=dev'])], 'Instalando dependencias (solo la primera vez, puede tardar un par de minutos)');
}
if (rebuild) runNpm(['run', 'build'], 'Compilando la interfaz');

/* ---------- 3. Puerto ---------- */
const openBrowser = (u) => {
  if (process.env.NO_OPEN === '1') return;
  try {
    const child = WIN
      ? spawn(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', `start "" "${u}"`], { windowsVerbatimArguments: true, windowsHide: true, detached: true, stdio: 'ignore' })
      : spawn(process.platform === 'darwin' ? 'open' : 'xdg-open', [u], { detached: true, stdio: 'ignore' });
    child.on('error', () => {});
    child.unref();
  } catch {}
};
const isFree = (p) => new Promise((res) => {
  const srv = net.createServer().once('error', () => res(false)).once('listening', () => srv.close(() => res(true)));
  srv.listen(p, HOST);
});
const isIsup = async (p) => {
  try {
    const r = await fetch(`http://127.0.0.1:${p}/api/health`, { signal: AbortSignal.timeout(1500) });
    return r.ok && (await r.json()).name === 'ISUP Aula Virtual';
  } catch { return false; }
};

let PORT = BASE_PORT;
if (!(await isFree(PORT))) {
  if (await isIsup(PORT)) {
    say(`\n  ${S.ok} El aula virtual ya está abierta en http://localhost:${PORT} (otra ventana la mantiene en ejecución).`);
    say('    Se abre el navegador; puedes cerrar esta ventana.');
    openBrowser(`http://localhost:${PORT}/login`);
    waitKey();
    process.exit(0);
  }
  let found = null;
  for (let p = PORT + 1; p <= PORT + 20; p++) if (await isFree(p)) { found = p; break; }
  if (!found) fail(`El puerto ${PORT} está ocupado por otro programa y no se encontró uno libre cercano. Cierra ese programa o ejecuta con otro puerto (PORT=4000).`);
  say(`\n  ${S.warn} El puerto ${PORT} lo usa otro programa; se usará el ${found}.`);
  PORT = found;
}

/* ---------- 4. Servidor ---------- */
say(`\n  ${S.step} Iniciando el servidor en el puerto ${PORT}${S.dots}`);
const server = spawn(process.execPath, [...nodeFlags, path.join(ROOT, 'server', 'index.js')], {
  cwd: ROOT, stdio: ['ignore', 'inherit', 'inherit'], env: { ...process.env, PORT: String(PORT), HOST, NODE_NO_WARNINGS: '1' },
});
let stopping = false;
const CTRL_C_WIN = 3221225786; // STATUS_CONTROL_C_EXIT
server.on('exit', (code, signal) => {
  if (stopping || signal || code === CTRL_C_WIN || !code) process.exit(0);
  fail(`El servidor se detuvo con código ${code}. Revisa el mensaje anterior.`);
});
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(sig, () => { stopping = true; server.kill(); process.exit(0); });

const url = `http://localhost:${PORT}/login`;
const lanUrls = LAN ? Object.values(os.networkInterfaces()).flat().filter((i) => i && i.family === 'IPv4' && !i.internal).map((i) => `http://${i.address}:${PORT}`) : [];

const started = Date.now();
(async function waitAndOpen() {
  let up = false;
  while (Date.now() - started < 90_000 && server.exitCode == null) {
    if (await isIsup(PORT)) { up = true; break; }
    await new Promise((res) => setTimeout(res, 400));
  }
  if (!up) return;
  say('');
  say(`  ${S.ok} Aula virtual lista.`);
  say(`    Ingreso:        ${url}`);
  if (LAN) say(`    Desde celular:  ${lanUrls.join('  ') || '(sin red detectada)'}  (misma red Wi-Fi; acepta el aviso del firewall para redes privadas)`);
  else say('    Desde celular:  vuelve a abrir con la opción "red" (iniciar.bat red / ./iniciar.sh --red)');
  say('    Accesos demo:   estudiante@isup.edu.pe ' + S.dot + ' docente@isup.edu.pe ' + S.dot + ' admin@isup.edu.pe ' + S.dot + ' contraseña Isup2026!');
  say('    Deja esta ventana abierta mientras uses el aula. Para detener: Ctrl+C o cierra la ventana.');
  say('');
  openBrowser(url);
})();
