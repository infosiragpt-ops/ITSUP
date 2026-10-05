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
import adminRoutes from './routes/admin.js';

if (!get('SELECT COUNT(*) n FROM users').n) {
  console.log('Base de datos vacía: cargando datos de demostración…');
  seed();
}

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (req, res) => res.json({ ok: true, name: 'ISUP Aula Virtual' }));
app.use('/api/auth', authRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/admin', auth, adminRoutes);
app.use('/api', auth, courseRoutes, activityRoutes, communityRoutes);
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
  if (!err.expose) console.error(err);
  res.status(err.status || 500).json({ error: err.expose ? err.message : 'Ocurrió un error inesperado' });
});

const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, () => console.log(`ISUP Aula Virtual lista en http://localhost:${PORT}`));
