import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import { get, run, now, httpError, audit, settings, DATA_DIR } from '../db.js';
import { auth, signToken, publicUser } from '../auth.js';
import { checkPassword } from '../lib.js';

const r = Router();

const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;
/** Intentos por IP para correos inexistentes (evita enumeración y fuerza bruta distribuida). */
const ipAttempts = new Map();
const clientIp = (req) => req.ip || req.socket?.remoteAddress || 'local';
function pruneAttempts() {
  if (ipAttempts.size < 5000) return;
  for (const [k, v] of ipAttempts) if (Date.now() - v.at > LOCK_MINUTES * 60e3) ipAttempts.delete(k);
}

r.post('/login', (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  if (!email || !password) throw httpError(400, 'Ingresa tu correo y contraseña');

  const ip = clientIp(req);
  pruneAttempts();
  const ipRec = ipAttempts.get(ip);
  if (ipRec && ipRec.count >= MAX_ATTEMPTS * 4 && Date.now() - ipRec.at < LOCK_MINUTES * 60e3) {
    throw httpError(429, 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.');
  }

  const user = get('SELECT * FROM users WHERE lower(email) = ? OR lower(code) = ?', email, email);
  if (user?.locked_until && new Date(user.locked_until) > new Date()) {
    const mins = Math.ceil((new Date(user.locked_until) - Date.now()) / 60e3);
    throw httpError(423, `Cuenta bloqueada temporalmente por intentos fallidos. Inténtalo en ${mins} min o escribe a soporte.`);
  }
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    ipAttempts.set(ip, { count: (ipRec?.count || 0) + 1, at: Date.now() });
    if (user) {
      const fails = (user.failed_logins || 0) + 1;
      const lock = fails >= MAX_ATTEMPTS ? new Date(Date.now() + LOCK_MINUTES * 60e3).toISOString() : null;
      run('UPDATE users SET failed_logins = ?, locked_until = ? WHERE id = ?', lock ? 0 : fails, lock, user.id);
      audit({ user, ip }, lock ? 'auth.locked' : 'auth.failed', { entity: 'user', entityId: user.id });
      if (lock) throw httpError(423, `Cuenta bloqueada ${LOCK_MINUTES} minutos por ${MAX_ATTEMPTS} intentos fallidos.`);
    }
    throw httpError(401, 'Correo/código o contraseña incorrectos');
  }
  if (!user.active) throw httpError(403, 'Tu cuenta está desactivada. Contacta a soporte.');
  ipAttempts.delete(ip);
  run('UPDATE users SET last_login = ?, failed_logins = 0, locked_until = NULL WHERE id = ?', now(), user.id);
  audit({ user, ip }, 'auth.login', { entity: 'user', entityId: user.id });
  res.json({ token: signToken(user), user: withProgram(get('SELECT * FROM users WHERE id = ?', user.id)) });
});

r.get('/me', auth, (req, res) => res.json({ user: withProgram(req.user) }));

r.post('/logout', auth, (req, res) => {
  audit(req, 'auth.logout', { entity: 'user', entityId: req.user.id });
  res.json({ ok: true });
});

r.put('/profile', auth, (req, res) => {
  const { first_name, last_name, phone, bio, avatar_color } = req.body;
  if (first_name !== undefined && !String(first_name).trim()) throw httpError(400, 'El nombre es obligatorio');
  const u = req.user;
  run(
    'UPDATE users SET first_name = ?, last_name = ?, phone = ?, bio = ?, avatar_color = ? WHERE id = ?',
    (first_name ?? u.first_name).trim(), (last_name ?? u.last_name).trim(), phone ?? u.phone, bio ?? u.bio,
    avatar_color ?? u.avatar_color, u.id
  );
  audit(req, 'profile.update', { entity: 'user', entityId: u.id });
  res.json({ user: withProgram(get('SELECT * FROM users WHERE id = ?', u.id)) });
});

r.put('/password', auth, (req, res) => {
  const { current, next } = req.body;
  if (!bcrypt.compareSync(String(current || ''), req.user.password_hash)) throw httpError(400, 'La contraseña actual no es correcta');
  const problem = checkPassword(next);
  if (problem) throw httpError(400, problem);
  run('UPDATE users SET password_hash = ?, password_changed_at = ? WHERE id = ?', bcrypt.hashSync(String(next), 10), now(), req.user.id);
  audit(req, 'password.change', { entity: 'user', entityId: req.user.id });
  // La contraseña inicial de la instalación deja de ser válida: se elimina el archivo que la guardaba
  if (req.user.role === 'admin') { try { fs.unlinkSync(path.join(DATA_DIR, 'ADMIN_INICIAL.txt')); } catch {} }
  // Las sesiones anteriores quedan invalidadas; se entrega un token nuevo para la sesión actual
  res.json({ ok: true, token: signToken(req.user) });
});

/** Aceptación de la política de privacidad y tratamiento de datos personales (Ley N.° 29733). */
r.put('/consent', auth, (req, res) => {
  const version = settings().consent_version;
  if (req.body.accept !== true) throw httpError(400, 'Debes aceptar la política para continuar');
  run('UPDATE users SET consent_at = ?, consent_version = ? WHERE id = ?', now(), version, req.user.id);
  audit(req, 'consent.accept', { entity: 'user', entityId: req.user.id, details: { version } });
  res.json({ user: withProgram(get('SELECT * FROM users WHERE id = ?', req.user.id)) });
});

r.put('/onboarding', auth, (req, res) => {
  let ob = {};
  try { ob = JSON.parse(req.user.onboarding || '{}'); } catch {}
  const { key, value = true } = req.body;
  if (!key) throw httpError(400, 'Falta la clave');
  ob[key] = value;
  run('UPDATE users SET onboarding = ? WHERE id = ?', JSON.stringify(ob), req.user.id);
  res.json({ onboarding: ob });
});

function withProgram(u) {
  const pu = publicUser(u);
  if (u.program_id) pu.program = get('SELECT id, name, slug, short, level, degree FROM programs WHERE id = ?', u.program_id);
  pu.consent_required = settings().consent_version;
  return pu;
}

export default r;
