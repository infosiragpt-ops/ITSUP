import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { all, get, run, insert, now, httpError, notify, UPLOADS_DIR, audit } from '../db.js';
import { courseAccess, requireEdit, requireOpen } from '../auth.js';
import { upload, fileName, courseCard, coursesFor, courseProgress, studentIds, userBrief, activeTerm } from '../lib.js';
import { studentStanding, buildActa, courseCategories, courseRules, riskFlags, COURSE_TYPE_LABEL } from '../academic.js';

const r = Router();

/* ---------------- Courses ---------------- */

r.get('/courses', (req, res) => {
  const allTerms = req.query.term === 'all';
  const cards = coursesFor(req.user, { allTerms }).map((c) => courseCard(c, req.user));
  res.json(cards);
});

r.get('/courses/:id', (req, res) => {
  const { course, canEdit } = courseAccess(req.params.id, req.user);
  if (req.user.role === 'student') {
    run('UPDATE enrollments SET last_access = ? WHERE course_id = ? AND user_id = ?', now(), course.id, req.user.id);
  }
  const card = courseCard(course, req.user);
  card.can_edit = canEdit;
  card.course_type_label = COURSE_TYPE_LABEL[course.course_type] || course.course_type;
  card.rules = courseRules(course);
  card.categories = courseCategories(course.id);
  card.counts = {
    modules: get('SELECT COUNT(*) n FROM modules WHERE course_id = ?', course.id).n,
    items: get('SELECT COUNT(*) n FROM items WHERE course_id = ?', course.id).n,
    assignments: get('SELECT COUNT(*) n FROM assignments WHERE course_id = ?', course.id).n,
    quizzes: get('SELECT COUNT(*) n FROM quizzes WHERE course_id = ?', course.id).n,
    forums: get('SELECT COUNT(*) n FROM forums WHERE course_id = ?', course.id).n,
  };
  res.json(card);
});

r.put('/courses/:id', (req, res) => {
  const { course } = requireEdit(req.params.id, req.user);
  const { description, syllabus, schedule } = req.body;
  run('UPDATE courses SET description = ?, syllabus = ?, schedule = ? WHERE id = ?',
    description ?? course.description, syllabus ?? course.syllabus, schedule ?? course.schedule, course.id);
  audit(req, 'course.update', { entity: 'course', entityId: course.id });
  res.json(get('SELECT * FROM courses WHERE id = ?', course.id));
});

/* ---------------- Modules & items ---------------- */

r.get('/courses/:id/modules', (req, res) => {
  const { course } = courseAccess(req.params.id, req.user);
  const done = new Set(
    all('SELECT p.item_id FROM item_progress p JOIN items i ON i.id = p.item_id WHERE i.course_id = ? AND p.user_id = ?', course.id, req.user.id)
      .map((x) => x.item_id)
  );
  const modules = all('SELECT * FROM modules WHERE course_id = ? ORDER BY position, id', course.id);
  const items = all('SELECT * FROM items WHERE course_id = ? ORDER BY position, id', course.id);
  const assignments = all('SELECT id, module_id, title, due_at, points FROM assignments WHERE course_id = ?', course.id);
  const quizzes = all('SELECT id, module_id, title, due_at, points, time_limit_min FROM quizzes WHERE course_id = ?', course.id);
  const mySubs = new Set(all('SELECT assignment_id FROM submissions WHERE user_id = ?', req.user.id).map((s) => s.assignment_id));
  const myAttempts = new Set(
    all('SELECT DISTINCT quiz_id FROM quiz_attempts WHERE user_id = ? AND submitted_at IS NOT NULL', req.user.id).map((s) => s.quiz_id)
  );
  res.json({
    progress: courseProgress(course.id, req.user.id),
    modules: modules.map((m) => ({
      ...m,
      items: items.filter((i) => i.module_id === m.id).map((i) => ({ ...i, completed: done.has(i.id) })),
      assignments: assignments.filter((a) => a.module_id === m.id).map((a) => ({ ...a, submitted: mySubs.has(a.id) })),
      quizzes: quizzes.filter((q) => q.module_id === m.id).map((q) => ({ ...q, submitted: myAttempts.has(q.id) })),
    })),
  });
});

r.post('/courses/:id/modules', (req, res) => {
  const { course } = requireEdit(req.params.id, req.user);
  requireOpen(course);
  const { title, description, start_date } = req.body;
  if (!title?.trim()) throw httpError(400, 'El título es obligatorio');
  const pos = get('SELECT COALESCE(MAX(position), 0) + 1 AS p FROM modules WHERE course_id = ?', course.id).p;
  const id = insert('INSERT INTO modules (course_id, title, description, position, start_date) VALUES (?,?,?,?,?)',
    course.id, title.trim(), description || null, pos, start_date || null);
  res.status(201).json(get('SELECT * FROM modules WHERE id = ?', id));
});

const moduleOf = (id) => {
  const m = get('SELECT * FROM modules WHERE id = ?', Number(id));
  if (!m) throw httpError(404, 'Unidad no encontrada');
  return m;
};

r.put('/modules/:id', (req, res) => {
  const m = moduleOf(req.params.id);
  requireEdit(m.course_id, req.user);
  const { title, description, start_date } = req.body;
  run('UPDATE modules SET title = ?, description = ?, start_date = ? WHERE id = ?',
    title ?? m.title, description ?? m.description, start_date ?? m.start_date, m.id);
  res.json(get('SELECT * FROM modules WHERE id = ?', m.id));
});

r.delete('/modules/:id', (req, res) => {
  const m = moduleOf(req.params.id);
  requireEdit(m.course_id, req.user);
  run('DELETE FROM modules WHERE id = ?', m.id);
  res.json({ ok: true });
});

r.post('/modules/:id/items', upload.single('file'), (req, res) => {
  const m = moduleOf(req.params.id);
  requireEdit(m.course_id, req.user);
  const { type, title, content, url, duration_min } = req.body;
  if (!['reading', 'video', 'file', 'link'].includes(type)) throw httpError(400, 'Tipo de recurso inválido');
  if (!title?.trim()) throw httpError(400, 'El título es obligatorio');
  if (type === 'file' && !req.file) throw httpError(400, 'Adjunta un archivo');
  const pos = get('SELECT COALESCE(MAX(position), 0) + 1 AS p FROM items WHERE module_id = ?', m.id).p;
  const id = insert(
    'INSERT INTO items (module_id, course_id, type, title, content, url, file_name, file_path, duration_min, position) VALUES (?,?,?,?,?,?,?,?,?,?)',
    m.id, m.course_id, type, title.trim(), content || null, url || null, fileName(req.file),
    req.file ? req.file.filename : null, duration_min ? Number(duration_min) : null, pos
  );
  const course = get('SELECT name FROM courses WHERE id = ?', m.course_id);
  notify(studentIds(m.course_id), {
    type: 'content', title: `Nuevo material en ${course.name}`, body: title.trim(), link: `/app/cursos/${m.course_id}/contenido?item=${id}`,
  });
  res.status(201).json(get('SELECT * FROM items WHERE id = ?', id));
});

const itemOf = (id) => {
  const i = get('SELECT * FROM items WHERE id = ?', Number(id));
  if (!i) throw httpError(404, 'Recurso no encontrado');
  return i;
};

r.put('/items/:id', (req, res) => {
  const i = itemOf(req.params.id);
  requireEdit(i.course_id, req.user);
  const { title, content, url, duration_min } = req.body;
  run('UPDATE items SET title = ?, content = ?, url = ?, duration_min = ? WHERE id = ?',
    title ?? i.title, content ?? i.content, url ?? i.url, duration_min ?? i.duration_min, i.id);
  res.json(get('SELECT * FROM items WHERE id = ?', i.id));
});

r.delete('/items/:id', (req, res) => {
  const i = itemOf(req.params.id);
  requireEdit(i.course_id, req.user);
  if (i.file_path) fs.rm(path.join(UPLOADS_DIR, i.file_path), () => {});
  run('DELETE FROM items WHERE id = ?', i.id);
  res.json({ ok: true });
});

r.post('/items/:id/complete', (req, res) => {
  const i = itemOf(req.params.id);
  courseAccess(i.course_id, req.user);
  const done = req.body.completed !== false;
  if (done) run('INSERT OR IGNORE INTO item_progress (user_id, item_id) VALUES (?, ?)', req.user.id, i.id);
  else run('DELETE FROM item_progress WHERE user_id = ? AND item_id = ?', req.user.id, i.id);
  res.json({ completed: done, progress: courseProgress(i.course_id, req.user.id) });
});

/* ---------------- Announcements ---------------- */

const annWithAuthor = (a) => ({ ...a, author: a.author_id ? userBrief(a.author_id) : null });

r.get('/courses/:id/announcements', (req, res) => {
  const { course } = courseAccess(req.params.id, req.user);
  res.json(all('SELECT * FROM announcements WHERE course_id = ? ORDER BY pinned DESC, created_at DESC', course.id).map(annWithAuthor));
});

r.post('/courses/:id/announcements', (req, res) => {
  const { course } = requireEdit(req.params.id, req.user);
  const { title, body, pinned } = req.body;
  if (!title?.trim() || !body?.trim()) throw httpError(400, 'Título y mensaje son obligatorios');
  const id = insert('INSERT INTO announcements (course_id, author_id, title, body, pinned) VALUES (?,?,?,?,?)',
    course.id, req.user.id, title.trim(), body.trim(), pinned ? 1 : 0);
  notify(studentIds(course.id), { type: 'announcement', title: `Anuncio · ${course.name}`, body: title.trim(), link: `/app/cursos/${course.id}` });
  res.status(201).json(annWithAuthor(get('SELECT * FROM announcements WHERE id = ?', id)));
});

r.delete('/announcements/:id', (req, res) => {
  const a = get('SELECT * FROM announcements WHERE id = ?', Number(req.params.id));
  if (!a) throw httpError(404, 'Anuncio no encontrado');
  if (a.course_id) requireEdit(a.course_id, req.user);
  else if (req.user.role !== 'admin') throw httpError(403, 'Sin permisos');
  run('DELETE FROM announcements WHERE id = ?', a.id);
  res.json({ ok: true });
});

/* ---------------- People ---------------- */

r.get('/courses/:id/people', (req, res) => {
  const { course, canEdit } = courseAccess(req.params.id, req.user);
  const teacher = course.teacher_id ? userBrief(course.teacher_id) : null;
  const students = all(
    `SELECT u.id, u.first_name, u.last_name, u.avatar_color, u.code, ${canEdit ? 'u.email, e.last_access,' : ''} u.role, e.status AS enrollment_status
     FROM enrollments e JOIN users u ON u.id = e.user_id WHERE e.course_id = ? AND u.role = 'student' ${canEdit ? '' : "AND e.status = 'matriculado'"} ORDER BY u.last_name`,
    course.id
  );
  if (canEdit) {
    for (const s of students) {
      s.progress = courseProgress(course.id, s.id);
      const st = studentStanding(course, s.id);
      s.weighted = st.grades.weighted;
      s.condition = st.final.condition;
      s.attendance_pct = st.attendance.attendance_pct;
      s.absence_pct = st.attendance.absence_pct;
      s.flags = s.enrollment_status === 'retirado' ? [] : riskFlags(st, s.progress.pct);
    }
  }
  res.json({ teacher, students, rules: courseRules(course) });
});

/* ---------------- Grades ---------------- */

const stripDetail = ({ detail, ...a }) => a;

r.get('/courses/:id/grades', (req, res) => {
  const { course, canEdit } = courseAccess(req.params.id, req.user);
  const rules = courseRules(course);
  const categories = courseCategories(course.id);
  if (!canEdit) {
    const st = studentStanding(course, req.user.id);
    return res.json({ mine: st.grades, attendance: stripDetail(st.attendance), final: st.final, closed: st.closed, rules, categories, course_status: course.status });
  }
  const acta = buildActa(course);
  const rows = acta.rows.map((r) => ({
    student: { id: r.student.id, first_name: r.student.first_name, last_name: r.student.last_name, code: r.student.code, avatar_color: r.student.avatar_color, enrollment_status: r.student.enrollment_status },
    ...r.grades, attendance: stripDetail(r.attendance), final: r.final, closed: r.closed,
  }));
  const sample = rows[0]?.items || studentStanding(course, 0).grades.items;
  const columns = sample.map(({ kind, id, title, due_at, points, category_id }) => ({ kind, id, title, due_at, points, category_id }));
  res.json({ columns, rows, categories, rules, stats: acta.stats, course_status: course.status, closed_at: course.closed_at, closed: acta.closed });
});

r.get('/grades', (req, res) => {
  const term = activeTerm();
  const courses = coursesFor(req.user).map((c) => {
    const st = studentStanding(c, req.user.id);
    return {
      id: c.id, code: c.code, name: c.name, color: c.color, credits: c.credits, status: c.status,
      teacher: userBrief(c.teacher_id), ...st.grades, attendance: stripDetail(st.attendance), final: st.final, closed: st.closed,
    };
  });
  const withAvg = courses.filter((c) => c.average != null);
  const credits = withAvg.reduce((s, c) => s + c.credits, 0);
  const weighted = credits ? Math.round((withAvg.reduce((s, c) => s + c.average * c.credits, 0) / credits) * 10) / 10 : null;
  res.json({ term, courses, weighted_average: weighted });
});

/* ---------------- Live sessions ---------------- */

r.get('/courses/:id/sessions', (req, res) => {
  const { course, canEdit } = courseAccess(req.params.id, req.user);
  const list = all(
    `SELECT s.*, (SELECT COUNT(*) FROM attendance a WHERE a.session_id = s.id) AS attendance_taken FROM live_sessions s WHERE s.course_id = ? ORDER BY s.starts_at`, course.id
  );
  if (!canEdit) {
    const mine = Object.fromEntries(all('SELECT a.session_id, a.status FROM attendance a JOIN live_sessions s ON s.id = a.session_id WHERE s.course_id = ? AND a.user_id = ?', course.id, req.user.id).map((x) => [x.session_id, x.status]));
    return res.json(list.map((x) => ({ ...x, my_attendance: mine[x.id] || (x.attendance_taken ? 'falta' : null) })));
  }
  res.json(list);
});

r.post('/courses/:id/sessions', (req, res) => {
  const { course } = requireEdit(req.params.id, req.user);
  requireOpen(course);
  const { title, description, starts_at, duration_min, meeting_url } = req.body;
  if (!title?.trim() || !starts_at) throw httpError(400, 'Título y fecha son obligatorios');
  const url = meeting_url?.trim() || `https://meet.jit.si/ISUP-${course.code}-${Date.now().toString(36)}`;
  const id = insert('INSERT INTO live_sessions (course_id, title, description, starts_at, duration_min, meeting_url) VALUES (?,?,?,?,?,?)',
    course.id, title.trim(), description || null, new Date(starts_at).toISOString(), Number(duration_min) || 90, url);
  notify(studentIds(course.id), {
    type: 'session', title: `Nueva sesión en vivo · ${course.name}`, body: title.trim(), link: `/app/cursos/${course.id}/sesiones`,
  });
  res.status(201).json(get('SELECT * FROM live_sessions WHERE id = ?', id));
});

r.put('/sessions/:id', (req, res) => {
  const s = get('SELECT * FROM live_sessions WHERE id = ?', Number(req.params.id));
  if (!s) throw httpError(404, 'Sesión no encontrada');
  requireEdit(s.course_id, req.user);
  const { recording_url, title, starts_at, meeting_url } = req.body;
  run('UPDATE live_sessions SET recording_url = ?, title = ?, starts_at = ?, meeting_url = ? WHERE id = ?',
    recording_url ?? s.recording_url, title ?? s.title, starts_at ? new Date(starts_at).toISOString() : s.starts_at, meeting_url ?? s.meeting_url, s.id);
  res.json(get('SELECT * FROM live_sessions WHERE id = ?', s.id));
});

r.delete('/sessions/:id', (req, res) => {
  const s = get('SELECT * FROM live_sessions WHERE id = ?', Number(req.params.id));
  if (!s) throw httpError(404, 'Sesión no encontrada');
  requireEdit(s.course_id, req.user);
  run('DELETE FROM live_sessions WHERE id = ?', s.id);
  res.json({ ok: true });
});

export default r;
