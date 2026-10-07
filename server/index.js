import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, UPLOADS_DIR, get, db } from './db.js';
import { auth } from './auth.js';
import { seed, seedMinimal } from './seed.js';
import { autoEnrollAll } from './enrollment.js';
import { fillMissingMeetingUrls } from './meetings.js';
import authRoutes from './routes/auth.js';
import publicRoutes from './routes/public.js';
import courseRoutes from './routes/courses.js';
import activityRoutes from './routes/activities.js';
import communityRoutes from './routes/community.js';
import academicRoutes from './routes/academic.js';
import adminRoutes from './routes/admin.js';

const PROD = process.env.NODE_ENV === 'production';

if (!get('SELECT COUNT(*) n FROM users').n) {
  // ISUP_SEED=minimal: solo la cuenta de administración y el periodo actual. Es el modo por defecto en producción:
  // los datos de demostración (contraseña pública) solo se cargan en producción si se pide ISUP_SEED=demo.
  const mode = process.env.ISUP_SEED || (PROD ? 'minimal' : 'demo');
  if (mode === 'minimal') {
    console.log('Base de datos vacía: creando la cuenta de administración inicial…');
    seedMinimal();
  } else {
    if (PROD) console.warn('ATENCIÓN: cargando datos de demostración con contraseña pública en producción (ISUP_SEED=demo).');
    console.log('Base de datos vacía: cargando datos de demostración…');
    seed();
  }
}

// Matrícula automática: cada estudiante en los cursos de su carrera y ciclo del periodo activo
{
  const rooms = fillMissingMeetingUrls();
  if (rooms) console.log(`Salas de videoconferencia asignadas a ${rooms} sesión(es) sin enlace`);
  const r = autoEnrollAll();
  if (r.added || r.removed) console.log(`Matrícula automática: ${r.added} matrícula(s) nueva(s), ${r.removed} retirada(s) en ${r.students} estudiante(s)`);
}

const app = express();
app.disable('x-powered-by');
// TRUST_PROXY=1: solo se confía en el proxy local (Caddy en 127.0.0.1) para la IP real del cliente (req.ip)
app.set('trust proxy', process.env.TRUST_PROXY === '1' ? 'loopback' : false);
app.use(express.json({ limit: '2mb' }));

/* Cabeceras de seguridad (OWASP). CSP: scripts solo del propio origen (el tema se carga desde /theme.js); estilos inline por Tailwind. */
app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Content-Security-Policy': [
      "default-src 'self'", "script-src 'self'", "style-src 'self' 'unsafe-inline'", "img-src 'self' data: https:",
      "font-src 'self' data:", "connect-src 'self'", "frame-ancestors 'none'", "base-uri 'self'", "form-action 'self'", "object-src 'none'",
    ].join('; '),
    ...(PROD ? { 'Strict-Transport-Security': 'max-age=31536000' } : {}),
  });
  if (req.path.startsWith('/api')) res.set('Cache-Control', 'no-store');
  next();
});

app.get('/api/health', (req, res) => res.json({ ok: true, name: 'ISUP Aula Virtual', version: '2.0.0' }));
app.use('/api/auth', authRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/admin', auth, adminRoutes);
app.use('/api', auth, courseRoutes, activityRoutes, communityRoutes, academicRoutes);
app.use('/api', (req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));

// Uploaded files (served with a download-friendly name when ?name= is present)
const INLINE_TYPES = new Set(['.pdf', '.png', '.jpg', '.jpeg', '.gif', '.webp']);
app.use('/uploads', (req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  // Only PDFs and images may render in the browser; everything else is forced to download
  if (req.query.name) res.attachment(String(req.query.name));
  else if (!INLINE_TYPES.has(path.extname(req.path).toLowerCase())) res.attachment();
  next();
}, express.static(UPLOADS_DIR, { fallthrough: false }));

// Built frontend
const dist = path.join(ROOT, 'client', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist, { index: false, maxAge: '1h' }));
  // Las rutas de la aplicación no llevan extensión: un archivo estático inexistente responde 404
  app.get(/^(?!\/api|\/uploads)[^.]*$/, (req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'El archivo supera los 25 MB' });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Solicitud inválida' });
  if (!err.expose) console.error(err);
  res.status(err.status || 500).json({ error: err.expose ? err.message : 'Ocurrió un error inesperado' });
});

const PORT = Number(process.env.PORT) || 3000;
// HOST=127.0.0.1 en producción (detrás de Caddy/Nginx); por defecto escucha en todas las interfaces para el uso local en red.
const HOST = process.env.HOST || '0.0.0.0';
// Express 5 entrega el error de escucha (p. ej. EADDRINUSE) al callback: hay que comprobarlo y salir con código distinto de 0.
const server = app.listen(PORT, HOST, (err) => {
  if (err) return onListenError(err);
  console.log(`ISUP Aula Virtual lista en http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
});
server.on('error', onListenError);
function onListenError(err) {
  if (err.code === 'EADDRINUSE') console.error(`El puerto ${PORT} ya está en uso por otro programa (EADDRINUSE). Cierra ese programa o inicia con otro puerto, por ejemplo PORT=3001.`);
  else if (err.code === 'EACCES') console.error(`No se puede usar el puerto ${PORT} (EACCES): está reservado por el sistema. Inicia con otro puerto, por ejemplo PORT=3001.`);
  else console.error('No se pudo iniciar el servidor:', err.message);
  process.exit(1);
}

// Apagado ordenado (systemctl stop / Ctrl+C): se cierran las conexiones y la base de datos (sin -wal/-shm pendientes)
let stopping = false;
function shutdown(signal) {
  if (stopping) return;
  stopping = true;
  console.log(`Señal ${signal}: cerrando el aula virtual…`);
  const done = () => { try { db.close(); } catch {} process.exit(0); };
  server.close(done);
  server.closeIdleConnections?.();
  setTimeout(done, 5000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
