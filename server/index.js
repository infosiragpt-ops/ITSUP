import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, UPLOADS_DIR, get } from './db.js';
import { auth } from './auth.js';
import { seed } from './seed.js';
import authRoutes from './routes/auth.js';
import publicRoutes from './routes/public.js';
import courseRoutes from './routes/courses.js';
import activityRoutes from './routes/activities.js';
import communityRoutes from './routes/community.js';
import academicRoutes from './routes/academic.js';
import adminRoutes from './routes/admin.js';

if (!get('SELECT COUNT(*) n FROM users').n) {
  console.log('Base de datos vacía: cargando datos de demostración…');
  seed();
}

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', process.env.TRUST_PROXY === '1');
app.use(express.json({ limit: '2mb' }));

/* Cabeceras de seguridad (OWASP). CSP permite estilos y el script inline del tema; el resto solo del propio origen. */
const PROD = process.env.NODE_ENV === 'production';
app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Content-Security-Policy': [
      "default-src 'self'", "script-src 'self' 'unsafe-inline'", "style-src 'self' 'unsafe-inline'", "img-src 'self' data: https:",
      "font-src 'self' data:", "connect-src 'self'", "frame-ancestors 'none'", "base-uri 'self'", "form-action 'self'", "object-src 'none'",
    ].join('; '),
    ...(PROD ? { 'Strict-Transport-Security': 'max-age=31536000; includeSubDomains' } : {}),
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
app.listen(PORT, () => console.log(`ISUP Aula Virtual lista en http://localhost:${PORT}`));
