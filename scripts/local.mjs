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
 *           --reiniciar (o ISUP_RESET=1) borra la carpeta data/ con el aula cerrada y vuelve a cargar la demo con las fechas de hoy.
 * Variables: PORT (3000), NO_OPEN=1 (no abrir navegador), ISUP_REBUILD=1 (recompilar la interfaz), ISUP_LAUNCHER=1 (la pausa final la hace el .bat).
 */
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import tty from 'node:tty';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WIN = process.platform === 'win32';
const ARGS = new Set(process.argv.slice(2));
const LAN = ARGS.has('--red') || process.env.ISUP_LAN === '1';
const HOST = LAN ? '0.0.0.0' : '127.0.0.1';
const RESET = ARGS.has('--reiniciar') || process.env.ISUP_RESET === '1';
const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(ROOT, 'data');
const BASE_PORT = Number(process.env.PORT) || 3000;

// Símbolos: la consola clásica de Windows (conhost) no dibuja bien los glifos Unicode
const FANCY = !WIN || !!process.env.WT_SESSION || !!process.env.TERM_PROGRAM || !!process.env.ConEmuANSI;
const S = FANCY
  ? { ok: '✔', bad: '✖', warn: '⚠', step: '▸', rule: '─'.repeat(34), dots: '…', dot: '·' }
  : { ok: 'OK', bad: 'ERROR:', warn: 'AVISO:', step: '>', rule: '-'.repeat(34), dots: '...', dot: '-' };

const say = (s = '') => console.log(s);
const waitKey = () => {
  // tty.isatty(0) y no process.stdin.isTTY: tocar process.stdin pone el descriptor en modo no bloqueante y readSync falla con EAGAIN.
  if (process.env.ISUP_LAUNCHER === '1' || !tty.isatty(0)) return; // el .bat/.sh ya hacen la pausa
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
// macOS: Escritorio/Documentos en iCloud Drive (o Google Drive/Dropbox en ~/Library/CloudStorage) sincronizan la base de datos a medias
let realRoot = ROOT; try { realRoot = fs.realpathSync(ROOT); } catch {}
if (process.platform === 'darwin' && /\/Library\/(Mobile Documents|CloudStorage)\//.test(realRoot)) {
  say(`\n  ${S.warn} Esta carpeta está dentro de iCloud Drive u otro servicio de sincronización. Para evitar problemas con la base de datos, mueve la carpeta a tu carpeta personal (por ejemplo ~/ISUP) y vuelve a abrirla.`);
}

/* ---------- 2. Dependencias e interfaz ---------- */
// npm que acompaña a este node: Windows lo tiene junto al ejecutable; macOS/Linux (pkg, Homebrew, nvm, .tar.xz) en ../lib/node_modules/npm.
const npmCli = [
  path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js'),
  path.join(path.dirname(process.execPath), '..', 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js'),
].find((p) => fs.existsSync(p));
const runNpm = (args, label) => {
  say(`\n  ${S.step} ${label}${S.dots}`);
  const r = npmCli
    ? spawnSync(process.execPath, [npmCli, ...args], { cwd: ROOT, stdio: 'inherit' })
    : spawnSync(WIN ? 'npm.cmd' : 'npm', args, { cwd: ROOT, stdio: 'inherit', shell: WIN });
  if (r.status !== 0) fail(`${label} falló (código ${r.status ?? r.error?.message}). Si es un problema de red, revisa tu conexión y vuelve a intentarlo.`);
};
const hasBuild = fs.existsSync(path.join(ROOT, 'client', 'dist', 'index.html'));
const rebuild = process.env.ISUP_REBUILD === '1' || !hasBuild;
// Una instalación interrumpida puede dejar express pero no el resto: se comprueban todas las dependencias declaradas.
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const needsDeps = !Object.keys(pkg.dependencies || {}).every((d) => fs.existsSync(path.join(ROOT, 'node_modules', d, 'package.json')));
// node_modules copiado desde otro sistema (p. ej. el ZIP se hizo en Linux y se abre en un Mac): faltan los binarios nativos de esta plataforma.
const foreignModules = fs.existsSync(path.join(ROOT, 'node_modules', 'esbuild')) && !fs.existsSync(path.join(ROOT, 'node_modules', '@esbuild', `${process.platform}-${process.arch}`));
const needsDevDeps = rebuild && (!fs.existsSync(path.join(ROOT, 'node_modules', 'vite')) || foreignModules);
// Vite 8 exige Node 20.19 / 22.12 o superior: con 22.5–22.11 el servidor arranca (bandera) pero la compilación fallaría.
if (rebuild && major === 22 && minor < 12) fail(`Para compilar la interfaz hace falta Node.js 22.12 o superior (tienes ${process.versions.node}). Actualiza Node.js desde https://nodejs.org o usa un paquete que ya incluya la carpeta client/dist.`);
if (needsDeps || needsDevDeps) {
  // Con la interfaz ya compilada solo hacen falta las dependencias del servidor (ligeras).
  runNpm(['install', '--no-audit', '--no-fund', ...(rebuild ? [] : ['--omit=dev'])], 'Instalando dependencias (solo la primera vez, puede tardar un par de minutos)');
}
if (rebuild) runNpm(['run', 'build'], 'Compilando la interfaz');

/* ---------- 3. Puerto ---------- */
const openBrowser = (u) => {
  if (process.env.NO_OPEN === '1') return;
  try {
    if (WIN) {
      const child = spawn(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', `start "" "${u}"`], { windowsVerbatimArguments: true, windowsHide: true, detached: true, stdio: 'ignore' });
      child.on('error', () => {});
      child.unref();
      return;
    }
    // Linux: xdg-open falta en instalaciones mínimas y en WSL; se prueban alternativas en orden (la URL ya se mostró en pantalla).
    const candidates = process.platform === 'darwin' ? [['open', [u]]]
      : [['xdg-open', [u]], ['gio', ['open', u]], ['sensible-browser', [u]], ['wslview', [u]], ['cmd.exe', ['/c', 'start', '""', u]]];
    const attempt = (i) => {
      if (i >= candidates.length) return;
      try {
        const child = spawn(candidates[i][0], candidates[i][1], { detached: true, stdio: 'ignore' });
        child.on('error', () => attempt(i + 1));
        child.on('exit', (code) => { if (code) attempt(i + 1); });
        child.unref();
      } catch { attempt(i + 1); }
    };
    attempt(0);
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
    if (RESET) fail(`Para reiniciar la demo primero cierra la ventana del aula virtual que sigue abierta en http://localhost:${PORT} y vuelve a intentarlo.`);
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

/* ---------- 3b. Reiniciar la demo ---------- */
if (RESET) {
  try {
    fs.rmSync(DATA_DIR, { recursive: true, force: true });
    say(`\n  ${S.warn} Demo reiniciada: se borró ${DATA_DIR}. Se cargan de nuevo los datos de demostración con las fechas de hoy.`);
  } catch (e) {
    fail(`No se pudo borrar ${DATA_DIR} (${e.code || e.message}). Cierra todas las ventanas del aula virtual y vuelve a intentarlo.`);
  }
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
process.on('exit', () => { if (server.exitCode == null && server.signalCode == null) server.kill(); }); // nunca dejar el servidor huérfano

const url = `http://localhost:${PORT}/login`;
// Adaptadores virtuales (VirtualBox 192.168.56.x, WSL/Hyper-V 172.16-31.x, APIPA 169.254.x) se ocultan si hay una IP normal de la Wi-Fi
const isVirtualIp = (ip) => /^(169\.254\.|192\.168\.56\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip);
const lanIps = LAN ? Object.values(os.networkInterfaces()).flat().filter((i) => i && i.family === 'IPv4' && !i.internal).map((i) => i.address) : [];
const lanUrls = (lanIps.some((ip) => !isVirtualIp(ip)) ? lanIps.filter((ip) => !isVirtualIp(ip)) : lanIps).map((ip) => `http://${ip}:${PORT}`);

const started = Date.now();
(async function waitAndOpen() {
  let up = false;
  while (Date.now() - started < 90_000 && server.exitCode == null) {
    if (await isIsup(PORT)) { up = true; break; }
    await new Promise((res) => setTimeout(res, 400));
  }
  if (!up) {
    if (server.exitCode == null) say(`\n  ${S.warn} El servidor todavía no responde en ${url}. Revisa los mensajes anteriores; si no hay errores, abre esa dirección en unos segundos.`);
    return;
  }
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
