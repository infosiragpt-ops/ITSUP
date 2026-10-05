import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { all, get, run, insert, httpError, notify, tx, audit, settings, setSetting, DEFAULT_SETTINGS, now } from '../db.js';
import { role, publicUser } from '../auth.js';
import { courseCard, checkPassword } from '../lib.js';
import { buildActa, closeActa, reopenActa, creditsFor } from '../academic.js';
import { randomPassword } from '../seed.js';

const r = Router();
r.use(role('admin'));

const COLORS = ['#C96442', '#5B7B6F', '#6A5ACD', '#B8860B', '#2F6F8F', '#8B4C6B', '#4F6D3A', '#A0522D'];

r.get('/stats', (req, res) => {
  const c = (sql, ...p) => get(sql, ...p).n;
  const term = get('SELECT * FROM terms WHERE is_active = 1');
  const termCourses = term ? all('SELECT * FROM courses WHERE term_id = ?', term.id) : [];
  const actas = termCourses.filter((x) => x.status === 'closed').length;
  res.json({
    students: c("SELECT COUNT(*) n FROM users WHERE role = 'student' AND active = 1"),
    teachers: c("SELECT COUNT(*) n FROM users WHERE role = 'teacher' AND active = 1"),
    courses: c('SELECT COUNT(*) n FROM courses' + (term ? ` WHERE term_id = ${term.id}` : '')),
    programs: c('SELECT COUNT(*) n FROM programs WHERE active = 1'),
    applicants_new: c("SELECT COUNT(*) n FROM applicants WHERE status = 'nuevo'"),
    tickets_open: c("SELECT COUNT(*) n FROM tickets WHERE status != 'resuelto'"),
    submissions_week: c("SELECT COUNT(*) n FROM submissions WHERE submitted_at > datetime('now','-7 days')"),
    logins_week: c("SELECT COUNT(*) n FROM users WHERE last_login > datetime('now','-7 days')"),
    actas_closed: actas, actas_total: termCourses.length,
    attendance_pending: c(`SELECT COUNT(*) n FROM live_sessions s WHERE datetime(s.starts_at, '+' || s.duration_min || ' minutes') < datetime('now')
      AND NOT EXISTS (SELECT 1 FROM attendance a WHERE a.session_id = s.id)` + (term ? ` AND s.course_id IN (SELECT id FROM courses WHERE term_id = ${term.id})` : '')),
    consent_pending: c("SELECT COUNT(*) n FROM users WHERE active = 1 AND (consent_version IS NULL OR consent_version != ?)", settings().consent_version),
    by_program: all(`SELECT p.short AS name, p.color, (SELECT COUNT(*) FROM users u WHERE u.program_id = p.id AND u.role = 'student') AS students FROM programs p WHERE p.active = 1 ORDER BY students DESC`),
    recent_applicants: all('SELECT a.*, p.short AS program FROM applicants a LEFT JOIN programs p ON p.id = a.program_id ORDER BY a.created_at DESC LIMIT 5'),
    recent_audit: all('SELECT a.*, u.first_name, u.last_name FROM audit_log a LEFT JOIN users u ON u.id = a.user_id ORDER BY a.id DESC LIMIT 6'),
    term,
  });
});

/* ---------------- Users ---------------- */

r.get('/users', (req, res) => {
  const { role: rl, q } = req.query;
  let sql = 'SELECT u.*, p.short AS program_short FROM users u LEFT JOIN programs p ON p.id = u.program_id WHERE 1=1';
  const params = [];
  if (rl) { sql += ' AND u.role = ?'; params.push(rl); }
  if (q) { sql += " AND (u.first_name || ' ' || u.last_name LIKE ? OR u.email LIKE ? OR u.code LIKE ? OR u.dni LIKE ?)"; params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`); }
  sql += ' ORDER BY u.role, u.last_name LIMIT 500';
  res.json(all(sql, ...params).map((u) => publicUser(u, { full: true })));
});

function nextCode(roleName) {
  const prefix = { student: 'N00', teacher: 'D00', admin: 'A00' }[roleName];
  const year = new Date().getFullYear().toString().slice(2);
  let n = get('SELECT COUNT(*) n FROM users WHERE role = ?', roleName).n + 1;
  while (get('SELECT 1 x FROM users WHERE code = ?', `${prefix}${year}${String(n).padStart(4, '0')}`)) n++;
  return `${prefix}${year}${String(n).padStart(4, '0')}`;
}

const validDni = (dni) => !dni || /^\d{8}$/.test(String(dni));

r.post('/users', (req, res) => {
  const { first_name, last_name, email, role: rl, program_id, cycle, password, title, dni } = req.body;
  if (!first_name?.trim() || !last_name?.trim() || !email?.trim()) throw httpError(400, 'Nombre, apellido y correo son obligatorios');
  if (!['student', 'teacher', 'admin'].includes(rl)) throw httpError(400, 'Rol inválido');
  if (get('SELECT 1 x FROM users WHERE lower(email) = lower(?)', email.trim())) throw httpError(400, 'Ya existe un usuario con ese correo');
  if (!validDni(dni)) throw httpError(400, 'El DNI debe tener 8 dígitos');
  if (dni && get('SELECT 1 x FROM users WHERE dni = ?', String(dni))) throw httpError(400, 'Ya existe un usuario con ese DNI');
  // Sin contraseña indicada se genera una temporal aleatoria que se muestra una sola vez al administrador.
  const generated = !password?.trim();
  const pwd = generated ? randomPassword() : password.trim();
  const problem = checkPassword(pwd);
  if (problem) throw httpError(400, problem);
  const id = insert(
    'INSERT INTO users (code, email, password_hash, first_name, last_name, role, program_id, cycle, title, avatar_color, dni) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
    nextCode(rl), email.trim().toLowerCase(), bcrypt.hashSync(pwd, 10), first_name.trim(), last_name.trim(), rl,
    program_id ? Number(program_id) : null, cycle ? Number(cycle) : null, title || null, COLORS[Math.floor(Math.random() * COLORS.length)], dni ? String(dni) : null
  );
  notify([id], { type: 'welcome', title: '¡Bienvenido(a) a ISUP!', body: 'Completa tu checklist de inicio para empezar tus clases.', link: '/app' });
  audit(req, 'user.create', { entity: 'user', entityId: id, details: { role: rl, email: email.trim().toLowerCase(), generated_password: generated } });
  res.status(201).json({ ...publicUser(get('SELECT * FROM users WHERE id = ?', id), { full: true }), temp_password: generated ? pwd : undefined });
});

r.put('/users/:id', (req, res) => {
  const u = get('SELECT * FROM users WHERE id = ?', Number(req.params.id));
  if (!u) throw httpError(404, 'Usuario no encontrado');
  const { first_name, last_name, email, role: rl, program_id, cycle, active, password, title, dni, unlock } = req.body;
  if (u.id === req.user.id && (active === false || active === 0 || (rl && rl !== 'admin'))) throw httpError(400, 'No puedes desactivar ni cambiar el rol de tu propia cuenta');
  if (email && get('SELECT 1 x FROM users WHERE lower(email) = lower(?) AND id != ?', email.trim(), u.id)) throw httpError(400, 'Ya existe otro usuario con ese correo');
  if (dni !== undefined && !validDni(dni)) throw httpError(400, 'El DNI debe tener 8 dígitos');
  if (dni && get('SELECT 1 x FROM users WHERE dni = ? AND id != ?', String(dni), u.id)) throw httpError(400, 'Ya existe otro usuario con ese DNI');
  run('UPDATE users SET first_name = ?, last_name = ?, email = ?, role = ?, program_id = ?, cycle = ?, active = ?, title = ?, dni = ? WHERE id = ?',
    first_name ?? u.first_name, last_name ?? u.last_name, email ? email.trim().toLowerCase() : u.email, rl ?? u.role,
    program_id === undefined ? u.program_id : program_id || null, cycle === undefined ? u.cycle : cycle || null,
    active === undefined ? u.active : active ? 1 : 0, title ?? u.title, dni === undefined ? u.dni : dni ? String(dni) : null, u.id);
  if (password) {
    const problem = checkPassword(password);
    if (problem) throw httpError(400, problem);
    run('UPDATE users SET password_hash = ?, failed_logins = 0, locked_until = NULL WHERE id = ?', bcrypt.hashSync(String(password), 10), u.id);
  }
  if (unlock) run('UPDATE users SET failed_logins = 0, locked_until = NULL WHERE id = ?', u.id);
  const changed = Object.keys(req.body).filter((k) => k !== 'password');
  audit(req, active !== undefined && !active ? 'user.deactivate' : 'user.update', { entity: 'user', entityId: u.id, details: { fields: changed, password_reset: !!password } });
  res.json(publicUser(get('SELECT * FROM users WHERE id = ?', u.id), { full: true }));
});

r.delete('/users/:id', (req, res) => {
  const id = Number(req.params.id);
  if (id === req.user.id) throw httpError(400, 'No puedes eliminar tu propia cuenta');
  run('UPDATE users SET active = 0 WHERE id = ?', id);
  audit(req, 'user.deactivate', { entity: 'user', entityId: id });
  res.json({ ok: true });
});

/* ---------------- Courses ---------------- */

r.get('/courses', (req, res) => {
  const { term } = req.query;
  const sql = term === 'all' ? 'SELECT * FROM courses ORDER BY code' : term ? `SELECT * FROM courses WHERE term_id = ${Number(term)} ORDER BY code` : 'SELECT * FROM courses ORDER BY code';
  res.json(all(sql).map((c) => courseCard(c, req.user)));
});

const COURSE_TYPES = ['especifica', 'empleabilidad', 'efsrt'];

function courseFields(body, fallback = {}) {
  const ht = body.hours_theory === undefined ? fallback.hours_theory ?? 32 : Number(body.hours_theory) || 0;
  const hp = body.hours_practice === undefined ? fallback.hours_practice ?? 32 : Number(body.hours_practice) || 0;
  const credits = body.credits === undefined || body.credits === '' ? fallback.credits ?? Math.max(1, Math.round(creditsFor(ht, hp))) : Number(body.credits);
  if (!Number.isFinite(credits) || credits < 1 || credits > 10) throw httpError(400, 'Los créditos deben estar entre 1 y 10');
  const type = body.course_type === undefined ? fallback.course_type || 'especifica' : body.course_type;
  if (!COURSE_TYPES.includes(type)) throw httpError(400, 'Tipo de unidad didáctica inválido');
  const minGrade = body.min_grade === undefined ? fallback.min_grade ?? 13 : Number(body.min_grade);
  const maxAbs = body.max_absence_pct === undefined ? fallback.max_absence_pct ?? 30 : Number(body.max_absence_pct);
  if (minGrade < 0 || minGrade > 20 || maxAbs < 0 || maxAbs > 100) throw httpError(400, 'Parámetros de evaluación fuera de rango');
  return { hours_theory: ht, hours_practice: hp, credits, course_type: type, module_name: body.module_name === undefined ? fallback.module_name ?? null : String(body.module_name || '').trim() || null, min_grade: minGrade, max_absence_pct: maxAbs };
}

r.post('/courses', (req, res) => {
  const { code, name, description, program_id, teacher_id, cycle, schedule, term_id } = req.body;
  if (!code?.trim() || !name?.trim()) throw httpError(400, 'Código y nombre son obligatorios');
  const f = courseFields(req.body);
  const term = term_id ? get('SELECT id FROM terms WHERE id = ?', Number(term_id)) : get('SELECT id FROM terms WHERE is_active = 1');
  const id = tx(() => {
    const cid = insert(
      `INSERT INTO courses (code, name, description, program_id, term_id, teacher_id, cycle, credits, color, schedule, module_name, course_type, hours_theory, hours_practice, min_grade, max_absence_pct)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      code.trim().toUpperCase(), name.trim(), description || '', program_id ? Number(program_id) : null, term?.id || null,
      teacher_id ? Number(teacher_id) : null, cycle ? Number(cycle) : null, f.credits,
      COLORS[get('SELECT COUNT(*) n FROM courses').n % COLORS.length], schedule || '', f.module_name, f.course_type, f.hours_theory, f.hours_practice, f.min_grade, f.max_absence_pct
    );
    insert('INSERT INTO modules (course_id, title, description, position) VALUES (?,?,?,1)', cid, 'Unidad 1 · Introducción', 'Presentación del curso y primeros conceptos.');
    insert('INSERT INTO forums (course_id, title, description) VALUES (?,?,?)', cid, 'Foro de consultas', 'Publica aquí tus dudas sobre el curso.');
    // Criterios de evaluación por defecto (editables por el docente en el sílabo)
    [['Evaluación de proceso', 40], ['Evaluación de producto', 30], ['Evaluación final', 30]].forEach(([n, w], i) =>
      insert('INSERT INTO grade_categories (course_id, name, weight, position) VALUES (?,?,?,?)', cid, n, w, i));
    return cid;
  });
  if (teacher_id) notify([Number(teacher_id)], { type: 'course', title: 'Se te asignó un nuevo curso', body: name.trim(), link: `/app/cursos/${id}` });
  audit(req, 'course.create', { entity: 'course', entityId: id, details: { code: code.trim().toUpperCase() } });
  res.status(201).json(get('SELECT * FROM courses WHERE id = ?', id));
});

r.put('/courses/:id', (req, res) => {
  const c = get('SELECT * FROM courses WHERE id = ?', Number(req.params.id));
  if (!c) throw httpError(404, 'Curso no encontrado');
  const { code, name, description, program_id, teacher_id, cycle, schedule, term_id } = req.body;
  const f = courseFields(req.body, c);
  run(`UPDATE courses SET code = ?, name = ?, description = ?, program_id = ?, teacher_id = ?, cycle = ?, credits = ?, schedule = ?, term_id = ?,
       module_name = ?, course_type = ?, hours_theory = ?, hours_practice = ?, min_grade = ?, max_absence_pct = ? WHERE id = ?`,
    code ?? c.code, name ?? c.name, description ?? c.description, program_id === undefined ? c.program_id : program_id || null,
    teacher_id === undefined ? c.teacher_id : teacher_id || null, cycle === undefined ? c.cycle : cycle || null, f.credits, schedule ?? c.schedule,
    term_id === undefined ? c.term_id : term_id || null, f.module_name, f.course_type, f.hours_theory, f.hours_practice, f.min_grade, f.max_absence_pct, c.id);
  audit(req, 'course.update', { entity: 'course', entityId: c.id });
  res.json(get('SELECT * FROM courses WHERE id = ?', c.id));
});

r.delete('/courses/:id', (req, res) => {
  const c = get('SELECT code, status FROM courses WHERE id = ?', Number(req.params.id));
  if (c?.status === 'closed') throw httpError(409, 'No se puede eliminar un curso con acta cerrada. Reábrela primero si realmente necesitas eliminarlo.');
  run('DELETE FROM courses WHERE id = ?', Number(req.params.id));
  audit(req, 'course.delete', { entity: 'course', entityId: Number(req.params.id), details: { code: c?.code } });
  res.json({ ok: true });
});

r.get('/courses/:id/enrollments', (req, res) => {
  res.json(all(
    `SELECT u.id, u.first_name, u.last_name, u.code, u.email, u.avatar_color, e.status, e.created_at FROM enrollments e JOIN users u ON u.id = e.user_id
     WHERE e.course_id = ? AND u.role = 'student' ORDER BY u.last_name`, Number(req.params.id)));
});

r.post('/courses/:id/enrollments', (req, res) => {
  const c = get('SELECT * FROM courses WHERE id = ?', Number(req.params.id));
  if (!c) throw httpError(404, 'Curso no encontrado');
  if (c.status === 'closed') throw httpError(409, 'El acta del curso está cerrada: no se pueden agregar matrículas');
  const ids = (req.body.user_ids || []).map(Number);
  let added = 0;
  tx(() => {
    for (const uid of ids) added += Number(run('INSERT OR IGNORE INTO enrollments (course_id, user_id) VALUES (?, ?)', c.id, uid).changes);
  });
  notify(ids, { type: 'course', title: `Fuiste matriculado(a) en ${c.name}`, body: c.code, link: `/app/cursos/${c.id}` });
  audit(req, 'enrollment.add', { entity: 'course', entityId: c.id, details: { user_ids: ids, added } });
  res.json({ added });
});

r.delete('/courses/:id/enrollments/:uid', (req, res) => {
  const c = get('SELECT status FROM courses WHERE id = ?', Number(req.params.id));
  if (c?.status === 'closed') throw httpError(409, 'El acta del curso está cerrada: usa "Retirar" en lugar de eliminar la matrícula');
  run('DELETE FROM enrollments WHERE course_id = ? AND user_id = ?', Number(req.params.id), Number(req.params.uid));
  audit(req, 'enrollment.remove', { entity: 'course', entityId: Number(req.params.id), details: { user_id: Number(req.params.uid) } });
  res.json({ ok: true });
});

/* ---------------- Programs ---------------- */

r.get('/programs', (req, res) => {
  res.json(all(`SELECT p.*, (SELECT COUNT(*) FROM users u WHERE u.program_id = p.id AND u.role = 'student') AS students,
    (SELECT COUNT(*) FROM courses c WHERE c.program_id = p.id) AS courses FROM programs p ORDER BY p.id`)
    .map((p) => ({ ...p, curriculum: JSON.parse(p.curriculum || '[]') })));
});

const PROGRAM_TEXT = ['name', 'short', 'description', 'duration', 'modality', 'field', 'profile', 'color', 'icon', 'level', 'degree', 'resolution'];

r.post('/programs', (req, res) => {
  const b = req.body;
  if (!b.name?.trim()) throw httpError(400, 'El nombre es obligatorio');
  const slug = b.name.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  if (get('SELECT 1 x FROM programs WHERE slug = ?', slug)) throw httpError(400, 'Ya existe una carrera con ese nombre');
  const id = insert(
    'INSERT INTO programs (slug, name, short, description, duration, modality, field, profile, color, icon, area, image, level, degree, total_credits, total_hours, resolution) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
    slug, b.name.trim(), b.short || b.name.trim(), b.description || '', b.duration || '3 años (6 ciclos)', b.modality || '100% virtual', b.field || '', b.profile || '', b.color || '#C96442', b.icon || 'graduation',
    b.area || null, b.image?.trim() || null, b.level || 'Profesional Técnico', b.degree?.trim() || `Profesional Técnico en ${b.name.trim()}`,
    Number(b.total_credits) || 120, Number(b.total_hours) || 2550, b.resolution?.trim() || null);
  audit(req, 'program.create', { entity: 'program', entityId: id, details: { name: b.name.trim() } });
  res.status(201).json(get('SELECT * FROM programs WHERE id = ?', id));
});

r.put('/programs/:id', (req, res) => {
  const p = get('SELECT * FROM programs WHERE id = ?', Number(req.params.id));
  if (!p) throw httpError(404, 'Carrera no encontrada');
  const f = [...PROGRAM_TEXT];
  const v = f.map((k) => (req.body[k] === undefined ? p[k] : req.body[k]));
  // Área, foto y resolución sí pueden quedar vacías
  for (const k of ['area', 'image']) { f.push(k); v.push(req.body[k] === undefined ? p[k] : String(req.body[k] || '').trim() || null); }
  for (const k of ['total_credits', 'total_hours']) { f.push(k); v.push(req.body[k] === undefined ? p[k] : Number(req.body[k]) || p[k]); }
  if (req.body.curriculum !== undefined) { f.push('curriculum'); v.push(JSON.stringify(Array.isArray(req.body.curriculum) ? req.body.curriculum : [])); }
  const active = req.body.active === undefined ? p.active : req.body.active ? 1 : 0;
  run(`UPDATE programs SET ${f.map((k) => `${k} = ?`).join(', ')}, active = ? WHERE id = ?`, ...v, active, p.id);
  audit(req, 'program.update', { entity: 'program', entityId: p.id });
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
  audit(req, 'announcement.global', { entity: 'announcement', entityId: id, details: { audience, recipients: ids.length } });
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

/* ---------------- Periodos académicos ---------------- */

const termWithCounts = (t) => ({
  ...t,
  courses: get('SELECT COUNT(*) n FROM courses WHERE term_id = ?', t.id).n,
  closed_courses: get("SELECT COUNT(*) n FROM courses WHERE term_id = ? AND status = 'closed'", t.id).n,
  students: get('SELECT COUNT(DISTINCT e.user_id) n FROM enrollments e JOIN courses c ON c.id = e.course_id WHERE c.term_id = ?', t.id).n,
});

r.get('/terms', (req, res) => res.json(all('SELECT * FROM terms ORDER BY start_date DESC').map(termWithCounts)));

r.post('/terms', (req, res) => {
  const { name, start_date, end_date, weeks, activate } = req.body;
  if (!name?.trim() || !start_date || !end_date) throw httpError(400, 'Nombre, fecha de inicio y fin son obligatorios');
  if (end_date < start_date) throw httpError(400, 'La fecha de fin debe ser posterior al inicio');
  if (get('SELECT 1 x FROM terms WHERE name = ?', name.trim())) throw httpError(400, 'Ya existe un periodo con ese nombre');
  const id = tx(() => {
    if (activate) run('UPDATE terms SET is_active = 0');
    return insert('INSERT INTO terms (name, start_date, end_date, weeks, is_active) VALUES (?,?,?,?,?)', name.trim(), start_date, end_date, Number(weeks) || 16, activate ? 1 : 0);
  });
  audit(req, 'term.create', { entity: 'term', entityId: id, details: { name: name.trim(), activate: !!activate } });
  res.status(201).json(termWithCounts(get('SELECT * FROM terms WHERE id = ?', id)));
});

r.put('/terms/:id', (req, res) => {
  const t = get('SELECT * FROM terms WHERE id = ?', Number(req.params.id));
  if (!t) throw httpError(404, 'Periodo no encontrado');
  const { name, start_date, end_date, weeks, activate } = req.body;
  tx(() => {
    if (activate) {
      if (t.closed_at) throw httpError(400, 'No se puede activar un periodo cerrado');
      run('UPDATE terms SET is_active = 0');
      run('UPDATE terms SET is_active = 1 WHERE id = ?', t.id);
    }
    run('UPDATE terms SET name = ?, start_date = ?, end_date = ?, weeks = ? WHERE id = ?', name ?? t.name, start_date ?? t.start_date, end_date ?? t.end_date, weeks ? Number(weeks) : t.weeks, t.id);
  });
  audit(req, activate ? 'term.activate' : 'term.update', { entity: 'term', entityId: t.id });
  res.json(termWithCounts(get('SELECT * FROM terms WHERE id = ?', t.id)));
});

/** Cierre de periodo: cierra las actas de todos los cursos abiertos y marca el periodo como cerrado. */
r.post('/terms/:id/close', (req, res) => {
  const t = get('SELECT * FROM terms WHERE id = ?', Number(req.params.id));
  if (!t) throw httpError(404, 'Periodo no encontrado');
  const open = all("SELECT * FROM courses WHERE term_id = ? AND status = 'open'", t.id);
  const errors = [];
  for (const c of open) {
    try { closeActa(c, req.user.id); } catch (e) { errors.push(`${c.code}: ${e.message}`); }
  }
  if (errors.length) throw httpError(400, `No se pudo cerrar el periodo. ${errors.join(' · ')}`);
  run('UPDATE terms SET closed_at = ?, is_active = 0 WHERE id = ?', now(), t.id);
  audit(req, 'term.close', { entity: 'term', entityId: t.id, details: { courses_closed: open.length } });
  res.json(termWithCounts(get('SELECT * FROM terms WHERE id = ?', t.id)));
});

/* ---------------- Actas e indicadores ---------------- */

r.get('/actas', (req, res) => {
  const termId = req.query.term ? Number(req.query.term) : get('SELECT id FROM terms WHERE is_active = 1')?.id;
  const courses = termId ? all('SELECT * FROM courses WHERE term_id = ? ORDER BY code', termId) : [];
  const rows = courses.map((c) => {
    const acta = buildActa(c);
    return {
      id: c.id, code: c.code, name: c.name, credits: c.credits, color: c.color, status: c.status, closed_at: c.closed_at,
      teacher: c.teacher_id ? get('SELECT first_name, last_name FROM users WHERE id = ?', c.teacher_id) : null,
      program: c.program_id ? get('SELECT short FROM programs WHERE id = ?', c.program_id)?.short : null,
      stats: acta.stats,
      pending_grading: get('SELECT COUNT(*) n FROM submissions s JOIN assignments a ON a.id = s.assignment_id WHERE a.course_id = ? AND s.grade IS NULL', c.id).n,
      attendance_pending: get(`SELECT COUNT(*) n FROM live_sessions s WHERE s.course_id = ? AND datetime(s.starts_at, '+' || s.duration_min || ' minutes') < datetime('now') AND NOT EXISTS (SELECT 1 FROM attendance a WHERE a.session_id = s.id)`, c.id).n,
    };
  });
  const counted = rows.filter((r) => r.stats.students > 0);
  const sum = (k) => counted.reduce((s, r) => s + r.stats[k], 0);
  const totals = { courses: rows.length, closed: rows.filter((r) => r.status === 'closed').length, students: sum('students'), aprobados: sum('aprobados'), desaprobados: sum('desaprobados'), dpi: sum('dpi'), retirados: sum('retirados'), pendientes: sum('pendientes') };
  const evaluated = totals.aprobados + totals.desaprobados + totals.dpi;
  totals.approval_rate = evaluated ? Math.round((totals.aprobados / evaluated) * 100) : null;
  const avgs = counted.map((r) => r.stats.average).filter((x) => x != null);
  totals.average = avgs.length ? Math.round((avgs.reduce((a, b) => a + b, 0) / avgs.length) * 10) / 10 : null;
  const atts = counted.map((r) => r.stats.attendance).filter((x) => x != null);
  totals.attendance = atts.length ? Math.round((atts.reduce((a, b) => a + b, 0) / atts.length) * 10) / 10 : null;
  res.json({ term: termId ? get('SELECT * FROM terms WHERE id = ?', termId) : null, rows, totals });
});

r.post('/courses/:id/acta/reopen', (req, res) => {
  const c = get('SELECT * FROM courses WHERE id = ?', Number(req.params.id));
  if (!c) throw httpError(404, 'Curso no encontrado');
  if (c.status !== 'closed') throw httpError(400, 'El acta de este curso no está cerrada');
  const reason = String(req.body.reason || '').trim();
  if (reason.length < 10) throw httpError(400, 'Indica el motivo de la reapertura (mínimo 10 caracteres); queda registrado en la auditoría');
  reopenActa(c);
  audit(req, 'acta.reopen', { entity: 'course', entityId: c.id, details: { reason } });
  if (c.teacher_id) notify([c.teacher_id], { type: 'grade', title: `Acta reabierta · ${c.name}`, body: `Motivo: ${reason}`, link: `/app/cursos/${c.id}/calificaciones` });
  res.json({ ok: true });
});

/* ---------------- Auditoría ---------------- */

r.get('/audit', (req, res) => {
  const { q, action, user, limit } = req.query;
  let sql = 'SELECT a.*, u.first_name, u.last_name, u.role, u.code FROM audit_log a LEFT JOIN users u ON u.id = a.user_id WHERE 1=1';
  const p = [];
  if (action) { sql += ' AND a.action LIKE ?'; p.push(`${action}%`); }
  if (user) { sql += ' AND a.user_id = ?'; p.push(Number(user)); }
  if (q) { sql += " AND (a.action LIKE ? OR a.details LIKE ? OR u.first_name || ' ' || u.last_name LIKE ?)"; p.push(`%${q}%`, `%${q}%`, `%${q}%`); }
  sql += ' ORDER BY a.id DESC LIMIT ?';
  p.push(Math.min(500, Number(limit) || 200));
  const rows = all(sql, ...p).map((r) => { let d = null; try { d = r.details ? JSON.parse(r.details) : null; } catch { d = r.details; } return { ...r, details: d }; });
  res.json({ rows, actions: all('SELECT DISTINCT action FROM audit_log ORDER BY action').map((x) => x.action) });
});

/* ---------------- Configuración institucional ---------------- */

r.get('/settings', (req, res) => res.json({ values: settings(), defaults: DEFAULT_SETTINGS }));

r.put('/settings', (req, res) => {
  const allowed = Object.keys(DEFAULT_SETTINGS);
  const changed = [];
  for (const [k, v] of Object.entries(req.body || {})) {
    if (!allowed.includes(k)) continue;
    if (['min_grade', 'max_absence_pct', 'recovery_min', 'recovery_max'].includes(k) && (Number.isNaN(Number(v)) || Number(v) < 0)) throw httpError(400, `Valor inválido para ${k}`);
    setSetting(k, v);
    changed.push(k);
  }
  audit(req, 'settings.update', { entity: 'settings', details: { changed } });
  res.json({ values: settings() });
});

export default r;
