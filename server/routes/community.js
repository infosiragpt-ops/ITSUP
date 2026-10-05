import { Router } from 'express';
import { all, get, run, insert, now, httpError, notify } from '../db.js';
import { courseAccess, requireEdit } from '../auth.js';
import { userBrief, studentIds, courseIdsFor, inList, coursesFor, courseCard } from '../lib.js';

const r = Router();

/* ---------------- Forums ---------------- */

r.get('/courses/:id/forums', (req, res) => {
  const { course } = courseAccess(req.params.id, req.user);
  res.json(all(
    `SELECT f.*, (SELECT COUNT(*) FROM threads t WHERE t.forum_id = f.id) AS threads,
       (SELECT COUNT(*) FROM posts p JOIN threads t ON t.id = p.thread_id WHERE t.forum_id = f.id) AS posts,
       (SELECT MAX(COALESCE((SELECT MAX(p.created_at) FROM posts p WHERE p.thread_id = t.id), t.created_at)) FROM threads t WHERE t.forum_id = f.id) AS last_activity
     FROM forums f WHERE f.course_id = ? ORDER BY f.id`, course.id));
});

r.post('/courses/:id/forums', (req, res) => {
  const { course } = requireEdit(req.params.id, req.user);
  const { title, description } = req.body;
  if (!title?.trim()) throw httpError(400, 'El título es obligatorio');
  const id = insert('INSERT INTO forums (course_id, title, description) VALUES (?,?,?)', course.id, title.trim(), description || '');
  res.status(201).json(get('SELECT * FROM forums WHERE id = ?', id));
});

const forumOf = (id) => {
  const f = get('SELECT * FROM forums WHERE id = ?', Number(id));
  if (!f) throw httpError(404, 'Foro no encontrado');
  return f;
};

r.get('/forums/:id/threads', (req, res) => {
  const f = forumOf(req.params.id);
  courseAccess(f.course_id, req.user);
  const threads = all(
    `SELECT t.*, (SELECT COUNT(*) FROM posts p WHERE p.thread_id = t.id) AS replies,
       COALESCE((SELECT MAX(p.created_at) FROM posts p WHERE p.thread_id = t.id), t.created_at) AS last_activity
     FROM threads t WHERE t.forum_id = ? ORDER BY t.pinned DESC, last_activity DESC`, f.id);
  res.json({ forum: f, threads: threads.map((t) => ({ ...t, author: userBrief(t.author_id) })) });
});

r.post('/forums/:id/threads', (req, res) => {
  const f = forumOf(req.params.id);
  const { course, canEdit } = courseAccess(f.course_id, req.user);
  const { title, body } = req.body;
  if (!title?.trim() || !body?.trim()) throw httpError(400, 'Escribe un título y un mensaje');
  const id = insert('INSERT INTO threads (forum_id, author_id, title, body, pinned) VALUES (?,?,?,?,?)',
    f.id, req.user.id, title.trim(), body.trim(), canEdit && req.body.pinned ? 1 : 0);
  if (!canEdit && course.teacher_id) {
    notify([course.teacher_id], { type: 'forum', title: `Nuevo tema en ${f.title}`, body: title.trim(), link: `/app/cursos/${course.id}/foros/${f.id}/${id}` });
  }
  res.status(201).json(get('SELECT * FROM threads WHERE id = ?', id));
});

r.get('/threads/:id', (req, res) => {
  const t = get('SELECT * FROM threads WHERE id = ?', Number(req.params.id));
  if (!t) throw httpError(404, 'Tema no encontrado');
  const f = forumOf(t.forum_id);
  const { canEdit } = courseAccess(f.course_id, req.user);
  const posts = all('SELECT * FROM posts WHERE thread_id = ? ORDER BY created_at', t.id).map((p) => ({ ...p, author: userBrief(p.author_id) }));
  res.json({ thread: { ...t, author: userBrief(t.author_id) }, forum: f, posts, can_edit: canEdit });
});

r.post('/threads/:id/posts', (req, res) => {
  const t = get('SELECT * FROM threads WHERE id = ?', Number(req.params.id));
  if (!t) throw httpError(404, 'Tema no encontrado');
  const f = forumOf(t.forum_id);
  const { course } = courseAccess(f.course_id, req.user);
  if (!req.body.body?.trim()) throw httpError(400, 'Escribe tu respuesta');
  const id = insert('INSERT INTO posts (thread_id, author_id, body) VALUES (?,?,?)', t.id, req.user.id, req.body.body.trim());
  if (t.author_id !== req.user.id) {
    notify([t.author_id], {
      type: 'forum', title: `${req.user.first_name} respondió a tu tema`, body: t.title, link: `/app/cursos/${course.id}/foros/${f.id}/${t.id}`,
    });
  }
  res.status(201).json({ ...get('SELECT * FROM posts WHERE id = ?', id), author: userBrief(req.user.id) });
});

r.delete('/posts/:id', (req, res) => {
  const p = get('SELECT p.*, f.course_id FROM posts p JOIN threads t ON t.id = p.thread_id JOIN forums f ON f.id = t.forum_id WHERE p.id = ?', Number(req.params.id));
  if (!p) throw httpError(404, 'Respuesta no encontrada');
  const { canEdit } = courseAccess(p.course_id, req.user);
  if (!canEdit && p.author_id !== req.user.id) throw httpError(403, 'Sin permisos');
  run('DELETE FROM posts WHERE id = ?', p.id);
  res.json({ ok: true });
});

r.delete('/threads/:id', (req, res) => {
  const t = get('SELECT t.*, f.course_id FROM threads t JOIN forums f ON f.id = t.forum_id WHERE t.id = ?', Number(req.params.id));
  if (!t) throw httpError(404, 'Tema no encontrado');
  const { canEdit } = courseAccess(t.course_id, req.user);
  if (!canEdit && t.author_id !== req.user.id) throw httpError(403, 'Sin permisos');
  run('DELETE FROM threads WHERE id = ?', t.id);
  res.json({ ok: true });
});

/* ---------------- Dashboard ---------------- */

r.get('/dashboard', (req, res) => {
  const u = req.user;
  const ids = courseIdsFor(u);
  const list = inList(ids);
  const courseName = Object.fromEntries(all(`SELECT id, name, code, color FROM courses WHERE id IN (${list})`).map((c) => [c.id, c]));

  const sessions = all(
    `SELECT * FROM live_sessions WHERE course_id IN (${list})
     AND datetime(starts_at, '+' || duration_min || ' minutes') > datetime('now') AND starts_at < ?
     ORDER BY starts_at LIMIT 6`, new Date(Date.now() + 8 * 864e5).toISOString()
  ).map((s) => ({ ...s, course: courseName[s.course_id] }));

  const announcements = all(
    `SELECT * FROM announcements WHERE course_id IN (${list}) OR course_id IS NULL ORDER BY created_at DESC LIMIT 5`
  ).map((a) => ({ ...a, author: userBrief(a.author_id), course: courseName[a.course_id] || null }));

  const courses = coursesFor(u).map((c) => courseCard(c, u));
  const out = { courses, sessions, announcements };

  if (u.role === 'student') {
    const horizon = new Date(Date.now() + 21 * 864e5).toISOString();
    const assignments = all(
      `SELECT a.*, 'assignment' AS kind FROM assignments a WHERE a.course_id IN (${list}) AND a.due_at > ? AND a.due_at < ?
       AND NOT EXISTS (SELECT 1 FROM submissions s WHERE s.assignment_id = a.id AND s.user_id = ?)`,
      new Date(Date.now() - 3 * 864e5).toISOString(), horizon, u.id);
    const quizzes = all(
      `SELECT q.*, 'quiz' AS kind FROM quizzes q WHERE q.course_id IN (${list}) AND q.due_at > ? AND q.due_at < ?
       AND NOT EXISTS (SELECT 1 FROM quiz_attempts t WHERE t.quiz_id = q.id AND t.user_id = ? AND t.submitted_at IS NOT NULL)`,
      now(), horizon, u.id);
    out.upcoming = [...assignments, ...quizzes]
      .sort((a, b) => a.due_at.localeCompare(b.due_at))
      .map((x) => ({ id: x.id, kind: x.kind, title: x.title, due_at: x.due_at, points: x.points, course: courseName[x.course_id] }));

    // "Continue where you left off": first incomplete item of the most recently accessed course
    const next = get(
      `SELECT i.*, m.title AS module_title FROM items i JOIN modules m ON m.id = i.module_id
       JOIN enrollments e ON e.course_id = i.course_id AND e.user_id = ?
       WHERE NOT EXISTS (SELECT 1 FROM item_progress p WHERE p.item_id = i.id AND p.user_id = ?)
       AND (m.start_date IS NULL OR m.start_date <= ?)
       ORDER BY e.last_access DESC, m.position, i.position LIMIT 1`, u.id, u.id, now());
    out.continue = next ? { ...next, course: courseName[next.course_id] } : null;

    const avgs = courses.map((c) => c.grades.average).filter((x) => x != null);
    out.stats = {
      average: avgs.length ? Math.round((avgs.reduce((a, b) => a + b, 0) / avgs.length) * 10) / 10 : null,
      pending: out.upcoming.length,
      progress: courses.length ? Math.round(courses.reduce((s, c) => s + c.progress.pct, 0) / courses.length) : 0,
      courses: courses.length,
    };
  } else {
    out.to_grade = all(
      `SELECT s.id, s.submitted_at, a.id AS assignment_id, a.title, a.course_id, u.first_name, u.last_name, u.avatar_color
       FROM submissions s JOIN assignments a ON a.id = s.assignment_id JOIN users u ON u.id = s.user_id
       WHERE a.course_id IN (${list}) AND s.grade IS NULL ORDER BY s.submitted_at LIMIT 8`
    ).map((s) => ({ ...s, course: courseName[s.course_id] }));
    out.forum_activity = all(
      `SELECT p.id, p.body, p.created_at, t.id AS thread_id, t.title, f.id AS forum_id, f.course_id, p.author_id
       FROM posts p JOIN threads t ON t.id = p.thread_id JOIN forums f ON f.id = t.forum_id
       WHERE f.course_id IN (${list}) ORDER BY p.created_at DESC LIMIT 5`
    ).map((p) => ({ ...p, author: userBrief(p.author_id), course: courseName[p.course_id] }));
    out.stats = {
      courses: courses.length,
      students: get(`SELECT COUNT(DISTINCT user_id) n FROM enrollments e JOIN users u ON u.id = e.user_id WHERE u.role = 'student' AND course_id IN (${list})`).n,
      to_grade: get(`SELECT COUNT(*) n FROM submissions s JOIN assignments a ON a.id = s.assignment_id WHERE a.course_id IN (${list}) AND s.grade IS NULL`).n,
      sessions_week: sessions.length,
    };
  }
  res.json(out);
});

/* ---------------- Calendar ---------------- */

r.get('/calendar', (req, res) => {
  const from = req.query.from || new Date(Date.now() - 31 * 864e5).toISOString();
  const to = req.query.to || new Date(Date.now() + 62 * 864e5).toISOString();
  const list = inList(courseIdsFor(req.user));
  const courses = Object.fromEntries(all(`SELECT id, name, code, color FROM courses WHERE id IN (${list})`).map((c) => [c.id, c]));
  const out = [];
  for (const a of all(`SELECT * FROM assignments WHERE course_id IN (${list}) AND due_at BETWEEN ? AND ?`, from, to)) {
    out.push({ id: `a${a.id}`, type: 'assignment', title: a.title, date: a.due_at, course: courses[a.course_id], link: `/app/cursos/${a.course_id}/tareas/${a.id}` });
  }
  for (const q of all(`SELECT * FROM quizzes WHERE course_id IN (${list}) AND due_at BETWEEN ? AND ?`, from, to)) {
    out.push({ id: `q${q.id}`, type: 'quiz', title: q.title, date: q.due_at, course: courses[q.course_id], link: `/app/cursos/${q.course_id}/evaluaciones/${q.id}` });
  }
  for (const s of all(`SELECT * FROM live_sessions WHERE course_id IN (${list}) AND starts_at BETWEEN ? AND ?`, from, to)) {
    out.push({ id: `s${s.id}`, type: 'session', title: s.title, date: s.starts_at, duration_min: s.duration_min, course: courses[s.course_id], link: `/app/cursos/${s.course_id}/sesiones`, meeting_url: s.meeting_url });
  }
  for (const e of all('SELECT * FROM events WHERE date BETWEEN ? AND ?', from.slice(0, 10), to.slice(0, 10))) {
    out.push({ id: `e${e.id}`, type: 'institutional', title: e.title, description: e.description, date: e.date, end_date: e.end_date, all_day: true });
  }
  res.json(out.sort((a, b) => a.date.localeCompare(b.date)));
});

/* ---------------- Notifications ---------------- */

r.get('/notifications', (req, res) => {
  const items = all('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 60', req.user.id);
  const unread = get('SELECT COUNT(*) n FROM notifications WHERE user_id = ? AND read_at IS NULL', req.user.id).n;
  res.json({ items, unread });
});

r.post('/notifications/read-all', (req, res) => {
  run("UPDATE notifications SET read_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE user_id = ? AND read_at IS NULL", req.user.id);
  res.json({ ok: true });
});

r.post('/notifications/:id/read', (req, res) => {
  run("UPDATE notifications SET read_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ? AND user_id = ?", Number(req.params.id), req.user.id);
  res.json({ ok: true });
});

/* ---------------- Search ---------------- */

r.get('/search', (req, res) => {
  const q = String(req.query.q || '').trim();
  if (q.length < 2) return res.json([]);
  const like = `%${q.replace(/[%_]/g, '')}%`;
  const list = inList(courseIdsFor(req.user));
  const results = [
    ...all(`SELECT id, name AS title, code AS subtitle FROM courses WHERE id IN (${list}) AND (name LIKE ? OR code LIKE ?) LIMIT 5`, like, like)
      .map((x) => ({ ...x, type: 'course', link: `/app/cursos/${x.id}` })),
    ...all(`SELECT i.id, i.title, i.type AS kind, i.course_id, c.name AS subtitle FROM items i JOIN courses c ON c.id = i.course_id WHERE i.course_id IN (${list}) AND (i.title LIKE ? OR i.content LIKE ?) LIMIT 8`, like, like)
      .map((x) => ({ ...x, type: 'item', link: `/app/cursos/${x.course_id}/contenido?item=${x.id}` })),
    ...all(`SELECT a.id, a.title, a.course_id, c.name AS subtitle FROM assignments a JOIN courses c ON c.id = a.course_id WHERE a.course_id IN (${list}) AND a.title LIKE ? LIMIT 5`, like)
      .map((x) => ({ ...x, type: 'assignment', link: `/app/cursos/${x.course_id}/tareas/${x.id}` })),
    ...all(`SELECT q.id, q.title, q.course_id, c.name AS subtitle FROM quizzes q JOIN courses c ON c.id = q.course_id WHERE q.course_id IN (${list}) AND q.title LIKE ? LIMIT 5`, like)
      .map((x) => ({ ...x, type: 'quiz', link: `/app/cursos/${x.course_id}/evaluaciones/${x.id}` })),
    ...all(`SELECT t.id, t.title, f.id AS forum_id, f.course_id, c.name AS subtitle FROM threads t JOIN forums f ON f.id = t.forum_id JOIN courses c ON c.id = f.course_id WHERE f.course_id IN (${list}) AND (t.title LIKE ? OR t.body LIKE ?) LIMIT 5`, like, like)
      .map((x) => ({ ...x, type: 'thread', link: `/app/cursos/${x.course_id}/foros/${x.forum_id}/${x.id}` })),
  ];
  res.json(results);
});

/* ---------------- Support tickets ---------------- */

r.get('/tickets', (req, res) => {
  const rows = req.user.role === 'admin'
    ? all('SELECT * FROM tickets ORDER BY (status = \'resuelto\'), created_at DESC')
    : all('SELECT * FROM tickets WHERE user_id = ? ORDER BY created_at DESC', req.user.id);
  res.json(rows.map((t) => ({ ...t, user: userBrief(t.user_id) })));
});

r.post('/tickets', (req, res) => {
  const { category, subject, message } = req.body;
  if (!subject?.trim() || !message?.trim()) throw httpError(400, 'Completa el asunto y el mensaje');
  const id = insert('INSERT INTO tickets (user_id, category, subject, message) VALUES (?,?,?,?)', req.user.id, category || 'Aula virtual', subject.trim(), message.trim());
  const admins = all("SELECT id FROM users WHERE role = 'admin'").map((a) => a.id);
  notify(admins, { type: 'ticket', title: 'Nueva solicitud de soporte', body: subject.trim(), link: '/app/admin/soporte' });
  res.status(201).json(get('SELECT * FROM tickets WHERE id = ?', id));
});

r.put('/tickets/:id', (req, res) => {
  if (req.user.role !== 'admin') throw httpError(403, 'Sin permisos');
  const t = get('SELECT * FROM tickets WHERE id = ?', Number(req.params.id));
  if (!t) throw httpError(404, 'Solicitud no encontrada');
  const { status, response } = req.body;
  run("UPDATE tickets SET status = ?, response = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?", status || t.status, response ?? t.response, t.id);
  if (response && response !== t.response) {
    notify([t.user_id], { type: 'ticket', title: 'Soporte respondió tu solicitud', body: t.subject, link: '/app/ayuda' });
  }
  res.json(get('SELECT * FROM tickets WHERE id = ?', t.id));
});

export default r;
