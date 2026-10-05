import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { get, run, now, httpError } from '../db.js';
import { auth, signToken, publicUser } from '../auth.js';

const r = Router();

r.post('/login', (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  if (!email || !password) throw httpError(400, 'Ingresa tu correo y contraseña');
  const user = get('SELECT * FROM users WHERE lower(email) = ? OR lower(code) = ?', email, email);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    throw httpError(401, 'Correo/código o contraseña incorrectos');
  }
  if (!user.active) throw httpError(403, 'Tu cuenta está desactivada. Contacta a soporte.');
  run('UPDATE users SET last_login = ? WHERE id = ?', now(), user.id);
  res.json({ token: signToken(user), user: withProgram(get('SELECT * FROM users WHERE id = ?', user.id)) });
});

r.get('/me', auth, (req, res) => res.json({ user: withProgram(req.user) }));

r.put('/profile', auth, (req, res) => {
  const { first_name, last_name, phone, bio, avatar_color } = req.body;
  if (first_name !== undefined && !String(first_name).trim()) throw httpError(400, 'El nombre es obligatorio');
  const u = req.user;
  run(
    'UPDATE users SET first_name = ?, last_name = ?, phone = ?, bio = ?, avatar_color = ? WHERE id = ?',
    (first_name ?? u.first_name).trim(), (last_name ?? u.last_name).trim(), phone ?? u.phone, bio ?? u.bio,
    avatar_color ?? u.avatar_color, u.id
  );
  res.json({ user: withProgram(get('SELECT * FROM users WHERE id = ?', u.id)) });
});

r.put('/password', auth, (req, res) => {
  const { current, next } = req.body;
  if (!bcrypt.compareSync(String(current || ''), req.user.password_hash)) throw httpError(400, 'La contraseña actual no es correcta');
  if (!next || String(next).length < 8) throw httpError(400, 'La nueva contraseña debe tener al menos 8 caracteres');
  run('UPDATE users SET password_hash = ? WHERE id = ?', bcrypt.hashSync(String(next), 10), req.user.id);
  res.json({ ok: true });
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
  if (u.program_id) pu.program = get('SELECT id, name, slug, short FROM programs WHERE id = ?', u.program_id);
  return pu;
}

export default r;
