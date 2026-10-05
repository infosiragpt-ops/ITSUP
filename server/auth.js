import jwt from 'jsonwebtoken';
import { get, httpError } from './db.js';

export const JWT_SECRET = process.env.JWT_SECRET || 'isup-dev-secret-cambiar-en-produccion';
const SESSION_HOURS = Number(process.env.SESSION_HOURS) || 24 * 7;

export function signToken(user) {
  return jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: `${SESSION_HOURS}h` });
}

/** Representación segura del usuario: sin hash ni contadores internos; el DNI se entrega enmascarado. */
export function publicUser(u, { full = false } = {}) {
  if (!u) return null;
  const { password_hash, onboarding, failed_logins, locked_until, ...rest } = u;
  let ob = {};
  try { ob = JSON.parse(onboarding || '{}'); } catch {}
  const out = { ...rest, dni: full ? rest.dni : maskDni(rest.dni), onboarding: ob };
  if (full) out.locked = !!(locked_until && new Date(locked_until) > new Date());
  return out;
}

export const maskDni = (dni) => (dni ? `${'•'.repeat(Math.max(0, dni.length - 3))}${dni.slice(-3)}` : null);

export function auth(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Inicia sesión para continuar' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = get('SELECT * FROM users WHERE id = ? AND active = 1', payload.id);
    if (!user) throw new Error('no user');
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: 'Tu sesión expiró. Vuelve a ingresar.' });
  }
}

export const role = (...roles) => (req, res, next) =>
  roles.includes(req.user.role) ? next() : res.status(403).json({ error: 'No tienes permisos para esta acción' });

/** Returns the course and whether the user can manage it. Throws if no access. */
export function courseAccess(courseId, user) {
  const course = get('SELECT * FROM courses WHERE id = ?', Number(courseId));
  if (!course) throw httpError(404, 'Curso no encontrado');
  if (user.role === 'admin') return { course, canEdit: true };
  if (user.role === 'teacher' && course.teacher_id === user.id) return { course, canEdit: true };
  const e = get('SELECT 1 AS ok FROM enrollments WHERE course_id = ? AND user_id = ?', course.id, user.id);
  if (!e) throw httpError(403, 'No estás matriculado en este curso');
  return { course, canEdit: false };
}

export function requireEdit(courseId, user) {
  const a = courseAccess(courseId, user);
  if (!a.canEdit) throw httpError(403, 'Solo el docente del curso puede hacer esto');
  return a;
}

/** Con el acta cerrada no se modifican calificaciones ni actividades (la reabre Administración). */
export function requireOpen(course) {
  if (course.status === 'closed') throw httpError(409, 'El acta de este curso está cerrada. Solicita a Administración reabrirla para hacer cambios.');
  return course;
}
