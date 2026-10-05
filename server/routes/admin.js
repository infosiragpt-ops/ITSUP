import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { all, get, run, insert, httpError, notify, tx } from '../db.js';
import { role, publicUser } from '../auth.js';
import { courseCard } from '../lib.js';

const r = Router();
r.use(role('admin'));

const COLORS = ['#C96442', '#5B7B6F', '#6A5ACD', '#B8860B', '#2F6F8F', '#8B4C6B', '#4F6D3A', '#A0522D'];

r.get('/stats', (req, res) => {
  const c = (sql, ...p) => get(sql, ...p).n;
  res.json({
    students: c("SELECT COUNT(*) n FROM users WHERE role = 'student' AND active = 1"),
    teachers: c("SELECT COUNT(*) n FROM users WHERE role = 'teacher' AND active = 1"),
    courses: c('SELECT COUNT(*) n FROM courses'),
    programs: c('SELECT COUNT(*) n FROM programs WHERE active = 1'),
    applicants_new: c("SELECT COUNT(*) n FROM applicants WHERE status = 'nuevo'"),
    tickets_open: c("SELECT COUNT(*) n FROM tickets WHERE status != 'resuelto'"),
    submissions_week: c("SELECT COUNT(*) n FROM submissions WHERE submitted_at > datetime('now','-7 days')"),
    logins_week: c("SELECT COUNT(*) n FROM users WHERE last_login > datetime('now','-7 days')"),
    by_program: all(`SELECT p.short AS name, p.color, (SELECT COUNT(*) FROM users u WHERE u.program_id = p.id AND u.role = 'student') AS students FROM programs p WHERE p.active = 1 ORDER BY students DESC`),
    recent_applicants: all('SELECT a.*, p.short AS program FROM applicants a LEFT JOIN programs p ON p.id = a.program_id ORDER BY a.created_at DESC LIMIT 5'),
    term: get('SELECT * FROM terms WHERE is_active = 1'),
  });
});

/* ---------------- Users ---------------- */

r.get('/users', (req, res) => {
  const { role: rl, q } = req.query;
  let sql = 'SELECT u.*, p.short AS program_short FROM users u LEFT JOIN programs p ON p.id = u.program_id WHERE 1=1';
  const params = [];
  if (rl) { sql += ' AND u.role = ?'; params.push(rl); }
  if (q) { sql += " AND (u.first_name || ' ' || u.last_name LIKE ? OR u.email LIKE ? OR u.code LIKE ?)"; params.push(`%${q}%`, `%${q}%`, `%${q}%`); }
  sql += ' ORDER BY u.role, u.last_name LIMIT 500';
  res.json(all(sql, ...params).map(publicUser));
});

function nextCode(roleName) {
  const prefix = { student: 'N00', teacher: 'D00', admin: 'A00' }[roleName];
  const year = new Date().getFullYear().toString().slice(2);
  let n = get('SELECT COUNT(*) n FROM users WHERE role = ?', roleName).n + 1;
  while (get('SELECT 1 x FROM users WHERE code = ?', `${prefix}${year}${String(n).padStart(4, '0')}`)) n++;
  return `${prefix}${year}${String(n).padStart(4, '0')}`;
}

r.post('/users', (req, res) => {
  const { first_name, last_name, email, role: rl, program_id, cycle, password, title } = req.body;
  if (!first_name?.trim() || !last_name?.trim() || !email?.trim()) throw httpError(400, 'Nombre, apellido y correo son obligatorios');
  if (!['student', 'teacher', 'admin'].includes(rl)) throw httpError(400, 'Rol inválido');
  if (get('SELECT 1 x FROM users WHERE lower(email) = lower(?)', email.trim())) throw httpError(400, 'Ya existe un usuario con ese correo');
  const pwd = password?.trim() || 'Isup2026!';
  if (pwd.length < 8) throw httpError(400, 'La contraseña debe tener al menos 8 caracteres');
  const id = insert(
    'INSERT INTO users (code, email, password_hash, first_name, last_name, role, program_id, cycle, title, avatar_color) VALUES (?,?,?,?,?,?,?,?,?,?)',
    nextCode(rl), email.trim().toLowerCase(), bcrypt.hashSync(pwd, 10), first_name.trim(), last_name.trim(), rl,
    program_id ? Number(program_id) : null, cycle ? Number(cycle) : null, title || null, COLORS[Math.floor(Math.random() * COLORS.length)]
  );
  notify([id], { type: 'welcome', title: '¡Bienvenido(a) a ISUP!', body: 'Completa tu checklist de inicio para empezar tus clases.', link: '/app' });
  res.status(201).json(publicUser(get('SELECT * FROM users WHERE id = ?', id)));
});

r.put('/users/:id', (req, res) => {
  const u = get('SELECT * FROM users WHERE id = ?', Number(req.params.id));
  if (!u) throw httpError(404, 'Usuario no encontrado');
  const { first_name, last_name, email, role: rl, program_id, cycle, active, password, title } = req.body;
  if (u.id === req.user.id && (active === false || active === 0 || (rl && rl !== 'admin'))) throw httpError(400, 'No puedes desactivar ni cambiar el rol de tu propia cuenta');
  if (email && get('SELECT 1 x FROM users WHERE lower(email) = lower(?) AND id != ?', email.trim(), u.id)) throw httpError(400, 'Ya existe otro usuario con ese correo');
  run('UPDATE users SET first_name = ?, last_name = ?, email = ?, role = ?, program_id = ?, cycle = ?, active = ?, title = ? WHERE id = ?',
    first_name ?? u.first_name, last_name ?? u.last_name, email ? email.trim().toLowerCase() : u.email, rl ?? u.role,
    program_id === undefined ? u.program_id : program_id || null, cycle === undefined ? u.cycle : cycle || null,
    active === undefined ? u.active : active ? 1 : 0, title ?? u.title, u.id);
  if (password) {
    if (String(password).length < 8) throw httpError(400, 'La contraseña debe tener al menos 8 caracteres');
    run('UPDATE users SET password_hash = ? WHERE id = ?', bcrypt.hashSync(String(password), 10), u.id);
  }
  res.json(publicUser(get('SELECT * FROM users WHERE id = ?', u.id)));
});

r.delete('/users/:id', (req, res) => {
  const id = Number(req.params.id);
  if (id === req.user.id) throw httpError(400, 'No puedes eliminar tu propia cuenta');
  run('UPDATE users SET active = 0 WHERE id = ?', id);
  res.json({ ok: true });
});

/* ---------------- Courses ---------------- */

r.get('/courses', (req, res) => {
  res.json(all('SELECT * FROM courses ORDER BY code').map((c) => courseCard(c, req.user)));
});

r.post('/courses', (req, res) => {
  const { code, name, description, program_id, teacher_id, cycle, credits, schedule } = req.body;
  if (!code?.trim() || !name?.trim()) throw httpError(400, 'Código y nombre son obligatorios');
  const term = get('SELECT id FROM terms WHERE is_active = 1');
  const id = tx(() => {
    const cid = insert(
      'INSERT INTO courses (code, name, description, program_id, term_id, teacher_id, cycle, credits, color, schedule) VALUES (?,?,?,?,?,?,?,?,?,?)',
      code.trim().toUpperCase(), name.trim(), description || '', program_id ? Number(program_id) : null, term?.id || null,
      teacher_id ? Number(teacher_id) : null, cycle ? Number(cycle) : null, Number(credits) || 3,
      COLORS[get('SELECT COUNT(*) n FROM courses').n % COLORS.length], schedule || ''
    );
    insert('INSERT INTO modules (course_id, title, description, position) VALUES (?,?,?,1)', cid, 'Unidad 1 · Introducción', 'Presentación del curso y primeros conceptos.');
    insert('INSERT INTO forums (course_id, title, description) VALUES (?,?,?)', cid, 'Foro de consultas', 'Publica aquí tus dudas sobre el curso.');
    return cid;
  });
  if (teacher_id) notify([Number(teacher_id)], { type: 'course', title: 'Se te asignó un nuevo curso', body: name.trim(), link: `/app/cursos/${id}` });
  res.status(201).json(get('SELECT * FROM courses WHERE id = ?', id));
});

r.put('/courses/:id', (req, res) => {
  const c = get('SELECT * FROM courses WHERE id = ?', Number(req.params.id));
  if (!c) throw httpError(404, 'Curso no encontrado');
  const { code, name, description, program_id, teacher_id, cycle, credits, schedule } = req.body;
  run('UPDATE courses SET code = ?, name = ?, description = ?, program_id = ?, teacher_id = ?, cycle = ?, credits = ?, schedule = ? WHERE id = ?',
    code ?? c.code, name ?? c.name, description ?? c.description, program_id ?? c.program_id,
    teacher_id === undefined ? c.teacher_id : teacher_id || null, cycle ?? c.cycle, credits ?? c.credits, schedule ?? c.schedule, c.id);
  res.json(get('SELECT * FROM courses WHERE id = ?', c.id));
});

r.delete('/courses/:id', (req, res) => {
  run('DELETE FROM courses WHERE id = ?', Number(req.params.id));
  res.json({ ok: true });
});

r.get('/courses/:id/enrollments', (req, res) => {
  res.json(all(
    `SELECT u.id, u.first_name, u.last_name, u.code, u.email, u.avatar_color FROM enrollments e JOIN users u ON u.id = e.user_id
     WHERE e.course_id = ? AND u.role = 'student' ORDER BY u.last_name`, Number(req.params.id)));
});

r.post('/courses/:id/enrollments', (req, res) => {
  const c = get('SELECT * FROM courses WHERE id = ?', Number(req.params.id));
  if (!c) throw httpError(404, 'Curso no encontrado');
  const ids = (req.body.user_ids || []).map(Number);
  let added = 0;
  tx(() => {
    for (const uid of ids) added += Number(run('INSERT OR IGNORE INTO enrollments (course_id, user_id) VALUES (?, ?)', c.id, uid).changes);
  });
  notify(ids, { type: 'course', title: `Fuiste matriculado(a) en ${c.name}`, body: c.code, link: `/app/cursos/${c.id}` });
  res.json({ added });
});

r.delete('/courses/:id/enrollments/:uid', (req, res) => {
  run('DELETE FROM enrollments WHERE course_id = ? AND user_id = ?', Number(req.params.id), Number(req.params.uid));
  res.json({ ok: true });
});

/* ---------------- Programs ---------------- */

r.get('/programs', (req, res) => {
  res.json(all(`SELECT p.*, (SELECT COUNT(*) FROM users u WHERE u.program_id = p.id AND u.role = 'student') AS students,
    (SELECT COUNT(*) FROM courses c WHERE c.program_id = p.id) AS courses FROM programs p ORDER BY p.id`)
    .map((p) => ({ ...p, curriculum: JSON.parse(p.curriculum || '[]') })));
});

r.post('/programs', (req, res) => {
  const { name, short, description, duration, modality, field, profile, color, icon, area, image } = req.body;
  if (!name?.trim()) throw httpError(400, 'El nombre es obligatorio');
  const slug = name.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  if (get('SELECT 1 x FROM programs WHERE slug = ?', slug)) throw httpError(400, 'Ya existe una carrera con ese nombre');
  const id = insert('INSERT INTO programs (slug, name, short, description, duration, modality, field, profile, color, icon, area, image) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
    slug, name.trim(), short || name.trim(), description || '', duration || '3 años (6 ciclos)', modality || '100% virtual', field || '', profile || '', color || '#C96442', icon || 'graduation',
    area || null, image?.trim() || null);
  res.status(201).json(get('SELECT * FROM programs WHERE id = ?', id));
});

r.put('/programs/:id', (req, res) => {
  const p = get('SELECT * FROM programs WHERE id = ?', Number(req.params.id));
  if (!p) throw httpError(404, 'Carrera no encontrada');
  const f = ['name', 'short', 'description', 'duration', 'modality', 'field', 'profile', 'color', 'icon'];
  const v = f.map((k) => req.body[k] ?? p[k]);
  // Área y foto sí pueden quedar vacías (la web muestra entonces el color y el ícono de la carrera)
  for (const k of ['area', 'image']) {
    f.push(k);
    v.push(req.body[k] === undefined ? p[k] : String(req.body[k] || '').trim() || null);
  }
  const active = req.body.active === undefined ? p.active : req.body.active ? 1 : 0;
  run(`UPDATE programs SET ${f.map((k) => `${k} = ?`).join(', ')}, active = ? WHERE id = ?`, ...v, active, p.id);
  res.json(get('SELECT * FROM programs WHERE id = ?', p.id));
});

/* ---------------- Applicants ---------------- */

r.get('/applicants', (req, res) => {
  res.json(all('SELECT a.*, p.name AS program FROM applicants a LEFT JOIN programs p ON p.id = a.program_id ORDER BY a.created_at DESC'));
});

r.put('/applicants/:id', (req, res) => {
  const { status } = req.body;
  if (!['nuevo', 'contactado', 'matriculado', 'descartado'].includes(status)) throw httpError(400, 'Estado inválido');
  run('UPDATE applicants SET status = ? WHERE id = ?', status, Number(req.params.id));
  res.json(get('SELECT * FROM applicants WHERE id = ?', Number(req.params.id)));
});

/* ---------------- Global announcements & events ---------------- */

r.get('/announcements', (req, res) => {
  res.json(all('SELECT * FROM announcements WHERE course_id IS NULL ORDER BY created_at DESC'));
});

r.post('/announcements', (req, res) => {
  const { title, body, audience = 'all' } = req.body;
  if (!title?.trim() || !body?.trim()) throw httpError(400, 'Título y mensaje son obligatorios');
  const id = insert('INSERT INTO announcements (course_id, author_id, title, body, pinned) VALUES (NULL,?,?,?,1)', req.user.id, title.trim(), body.trim());
  const roles = audience === 'all' ? ['student', 'teacher'] : [audience];
  const ids = all(`SELECT id FROM users WHERE active = 1 AND role IN (${roles.map(() => '?').join(',')})`, ...roles).map((x) => x.id);
  notify(ids, { type: 'announcement', title: `Comunicado ISUP: ${title.trim()}`, body: body.trim().slice(0, 120), link: '/app' });
  res.status(201).json(get('SELECT * FROM announcements WHERE id = ?', id));
});

r.post('/events', (req, res) => {
  const { title, description, date, end_date, type } = req.body;
  if (!title?.trim() || !date) throw httpError(400, 'Título y fecha son obligatorios');
  const id = insert('INSERT INTO events (title, description, date, end_date, type) VALUES (?,?,?,?,?)', title.trim(), description || '', date, end_date || null, type || 'institutional');
  res.status(201).json(get('SELECT * FROM events WHERE id = ?', id));
});

r.delete('/events/:id', (req, res) => {
  run('DELETE FROM events WHERE id = ?', Number(req.params.id));
  res.json({ ok: true });
});

export default r;
