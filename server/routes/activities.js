import { Router } from 'express';
import { all, get, run, insert, now, httpError, notify, tx, audit } from '../db.js';
import { courseAccess, requireEdit, requireOpen } from '../auth.js';
import { upload, fileName, studentIds, userBrief } from '../lib.js';
import { courseCategories } from '../academic.js';

/** Valida que el criterio de evaluación pertenezca al curso. */
function categoryFor(courseId, value) {
  if (value === undefined || value === null || value === '') return null;
  const id = Number(value);
  if (!courseCategories(courseId).some((c) => c.id === id)) throw httpError(400, 'El criterio de evaluación no pertenece a este curso');
  return id;
}

/** Rúbrica: lista de criterios { name, points, description? } cuyos puntajes suman el puntaje máximo. */
function parseRubric(value, points) {
  if (value === undefined) return undefined;
  const list = (Array.isArray(value) ? value : []).map((c) => ({ name: String(c.name || '').trim(), points: Number(c.points) || 0, description: String(c.description || '').trim() })).filter((c) => c.name);
  if (!list.length) return '[]';
  const total = list.reduce((s, c) => s + c.points, 0);
  if (Math.abs(total - Number(points)) > 0.01) throw httpError(400, `Los puntajes de la rúbrica deben sumar ${points} (suman ${total})`);
  return JSON.stringify(list);
}
const withRubric = (a) => a && { ...a, rubric: (() => { try { return JSON.parse(a.rubric || '[]'); } catch { return []; } })() };

const r = Router();

/* ---------------- Assignments ---------------- */

r.get('/courses/:id/assignments', (req, res) => {
  const { course, canEdit } = courseAccess(req.params.id, req.user);
  const list = all('SELECT * FROM assignments WHERE course_id = ? ORDER BY due_at', course.id);
  const total = get("SELECT COUNT(*) n FROM enrollments e JOIN users u ON u.id = e.user_id WHERE e.course_id = ? AND u.role = 'student'", course.id).n;
  const cats = Object.fromEntries(courseCategories(course.id).map((c) => [c.id, c.name]));
  res.json(list.map(withRubric).map((a) => {
    a.category = a.category_id ? cats[a.category_id] : null;
    if (canEdit) {
      const st = get('SELECT COUNT(*) AS subs, SUM(grade IS NULL) AS pending FROM submissions WHERE assignment_id = ?', a.id);
      return { ...a, stats: { submitted: st.subs, pending: st.pending || 0, students: total } };
    }
    return { ...a, submission: get('SELECT * FROM submissions WHERE assignment_id = ? AND user_id = ?', a.id, req.user.id) || null };
  }));
});

r.post('/courses/:id/assignments', (req, res) => {
  const { course } = requireEdit(req.params.id, req.user);
  requireOpen(course);
  const { title, instructions, due_at, points, module_id, allow_late, category_id, rubric } = req.body;
  if (!title?.trim() || !due_at) throw httpError(400, 'Título y fecha de entrega son obligatorios');
  const pts = Number(points) || 20;
  const id = insert('INSERT INTO assignments (course_id, module_id, title, instructions, due_at, points, allow_late, category_id, rubric) VALUES (?,?,?,?,?,?,?,?,?)',
    course.id, module_id ? Number(module_id) : null, title.trim(), instructions || '', new Date(due_at).toISOString(),
    pts, allow_late === false ? 0 : 1, categoryFor(course.id, category_id), parseRubric(rubric, pts) ?? '[]');
  audit(req, 'assignment.create', { entity: 'assignment', entityId: id, details: { course_id: course.id, title: title.trim() } });
  notify(studentIds(course.id), {
    type: 'assignment', title: `Nueva tarea · ${course.name}`, body: title.trim(), link: `/app/cursos/${course.id}/tareas/${id}`,
  });
  res.status(201).json(get('SELECT * FROM assignments WHERE id = ?', id));
});

const assignmentOf = (id) => {
  const a = get('SELECT * FROM assignments WHERE id = ?', Number(id));
  if (!a) throw httpError(404, 'Tarea no encontrada');
  return a;
};

r.get('/assignments/:id', (req, res) => {
  const a = assignmentOf(req.params.id);
  const { course, canEdit } = courseAccess(a.course_id, req.user);
  const cat = a.category_id ? get('SELECT name, weight FROM grade_categories WHERE id = ?', a.category_id) : null;
  const out = { ...withRubric(a), category: cat, can_edit: canEdit, course_closed: course.status === 'closed', course: { id: course.id, name: course.name, code: course.code, color: course.color } };
  if (canEdit) {
    const students = all(
      `SELECT u.id, u.first_name, u.last_name, u.code, u.avatar_color FROM enrollments e JOIN users u ON u.id = e.user_id
       WHERE e.course_id = ? AND u.role = 'student' ORDER BY u.last_name`, course.id);
    out.submissions = students.map((s) => ({
      student: s,
      submission: get('SELECT * FROM submissions WHERE assignment_id = ? AND user_id = ?', a.id, s.id) || null,
    }));
  } else {
    out.submission = get('SELECT * FROM submissions WHERE assignment_id = ? AND user_id = ?', a.id, req.user.id) || null;
  }
  res.json(out);
});

r.put('/assignments/:id', (req, res) => {
  const a = assignmentOf(req.params.id);
  const { course } = requireEdit(a.course_id, req.user);
  requireOpen(course);
  const { title, instructions, due_at, points, category_id, allow_late, rubric } = req.body;
  const pts = points === undefined || points === '' ? a.points : Number(points);
  const rub = parseRubric(rubric, pts);
  run('UPDATE assignments SET title = ?, instructions = ?, due_at = ?, points = ?, category_id = ?, allow_late = ?, rubric = ? WHERE id = ?',
    title ?? a.title, instructions ?? a.instructions, due_at ? new Date(due_at).toISOString() : a.due_at, pts,
    category_id === undefined ? a.category_id : categoryFor(course.id, category_id), allow_late === undefined ? a.allow_late : allow_late ? 1 : 0, rub ?? a.rubric, a.id);
  audit(req, 'assignment.update', { entity: 'assignment', entityId: a.id });
  res.json(withRubric(get('SELECT * FROM assignments WHERE id = ?', a.id)));
});

r.delete('/assignments/:id', (req, res) => {
  const a = assignmentOf(req.params.id);
  const { course } = requireEdit(a.course_id, req.user);
  requireOpen(course);
  run('DELETE FROM assignments WHERE id = ?', a.id);
  audit(req, 'assignment.delete', { entity: 'assignment', entityId: a.id, details: { title: a.title } });
  res.json({ ok: true });
});

r.post('/assignments/:id/submit', upload.single('file'), (req, res) => {
  const a = assignmentOf(req.params.id);
  const { course } = courseAccess(a.course_id, req.user);
  if (req.user.role !== 'student') throw httpError(400, 'Solo los estudiantes pueden entregar tareas');
  if (course.status === 'closed') throw httpError(409, 'El acta del curso está cerrada: ya no se reciben entregas');
  const late = a.due_at && new Date() > new Date(a.due_at);
  if (late && !a.allow_late) throw httpError(400, 'La fecha de entrega ya venció');
  const body = (req.body.body || '').trim();
  if (!body && !req.file) throw httpError(400, 'Escribe una respuesta o adjunta un archivo');
  const existing = get('SELECT * FROM submissions WHERE assignment_id = ? AND user_id = ?', a.id, req.user.id);
  if (existing?.grade != null) throw httpError(400, 'Esta entrega ya fue calificada');
  if (existing) {
    run('UPDATE submissions SET body = ?, file_name = COALESCE(?, file_name), file_path = COALESCE(?, file_path), submitted_at = ? WHERE id = ?',
      body, fileName(req.file), req.file?.filename || null, now(), existing.id);
  } else {
    insert('INSERT INTO submissions (assignment_id, user_id, body, file_name, file_path) VALUES (?,?,?,?,?)',
      a.id, req.user.id, body, fileName(req.file), req.file?.filename || null);
  }
  if (course.teacher_id) {
    notify([course.teacher_id], {
      type: 'submission', title: `Nueva entrega · ${a.title}`,
      body: `${req.user.first_name} ${req.user.last_name}`, link: `/app/cursos/${course.id}/tareas/${a.id}`,
    });
  }
  res.json(get('SELECT * FROM submissions WHERE assignment_id = ? AND user_id = ?', a.id, req.user.id));
});

r.put('/submissions/:id/grade', (req, res) => {
  const s = get('SELECT * FROM submissions WHERE id = ?', Number(req.params.id));
  if (!s) throw httpError(404, 'Entrega no encontrada');
  const a = assignmentOf(s.assignment_id);
  const { course } = requireEdit(a.course_id, req.user);
  requireOpen(course);
  const grade = Number(req.body.grade);
  if (Number.isNaN(grade) || grade < 0 || grade > a.points) throw httpError(400, `La nota debe estar entre 0 y ${a.points}`);
  let rubricScores = null;
  if (Array.isArray(req.body.rubric_scores) && req.body.rubric_scores.length) {
    const rubric = withRubric(a).rubric;
    const scores = req.body.rubric_scores.map((v) => Number(v) || 0);
    scores.forEach((v, i) => { if (rubric[i] && (v < 0 || v > rubric[i].points)) throw httpError(400, `El criterio "${rubric[i].name}" admite de 0 a ${rubric[i].points} puntos`); });
    rubricScores = JSON.stringify(scores);
  }
  const previous = s.grade;
  run('UPDATE submissions SET grade = ?, feedback = ?, graded_at = ?, rubric_scores = ?, graded_by = ? WHERE id = ?', grade, req.body.feedback || null, now(), rubricScores, req.user.id, s.id);
  audit(req, previous == null ? 'grade.set' : 'grade.change', { entity: 'submission', entityId: s.id, details: { assignment_id: a.id, student_id: s.user_id, from: previous, to: grade } });
  notify([s.user_id], {
    type: 'grade', title: `Calificación publicada · ${a.title}`, body: `${course.name}: ${grade}/${a.points}`,
    link: `/app/cursos/${course.id}/tareas/${a.id}`,
  });
  res.json(get('SELECT * FROM submissions WHERE id = ?', s.id));
});

/* ---------------- Quizzes ---------------- */

const parseQ = (q, withAnswers) => ({
  id: q.id, type: q.type, prompt: q.prompt, points: q.points, position: q.position,
  options: JSON.parse(q.options),
  ...(withAnswers ? { correct: JSON.parse(q.correct), explanation: q.explanation } : {}),
});

r.get('/courses/:id/quizzes', (req, res) => {
  const { course, canEdit } = courseAccess(req.params.id, req.user);
  const list = all('SELECT * FROM quizzes WHERE course_id = ? ORDER BY due_at', course.id);
  const cats = Object.fromEntries(courseCategories(course.id).map((c) => [c.id, c.name]));
  res.json(list.map((q) => {
    const questions = get('SELECT COUNT(*) n FROM quiz_questions WHERE quiz_id = ?', q.id).n;
    q.category = q.category_id ? cats[q.category_id] : null;
    if (canEdit) {
      const st = get('SELECT COUNT(DISTINCT user_id) n, AVG(score) avg FROM quiz_attempts WHERE quiz_id = ? AND submitted_at IS NOT NULL', q.id);
      return { ...q, questions, stats: { students: st.n, average: st.avg != null ? Math.round(st.avg * 10) / 10 : null } };
    }
    const mine = get('SELECT COUNT(*) n, MAX(score) best FROM quiz_attempts WHERE quiz_id = ? AND user_id = ? AND submitted_at IS NOT NULL', q.id, req.user.id);
    return { ...q, questions, attempts: mine.n, best: mine.best };
  }));
});

r.post('/courses/:id/quizzes', (req, res) => {
  const { course } = requireEdit(req.params.id, req.user);
  requireOpen(course);
  const { title, description, due_at, available_from, time_limit_min, max_attempts, points, module_id, questions = [], category_id } = req.body;
  const catId = categoryFor(course.id, category_id);
  if (!title?.trim() || !due_at) throw httpError(400, 'Título y fecha límite son obligatorios');
  if (!questions.length) throw httpError(400, 'Agrega al menos una pregunta');
  for (const [i, q] of questions.entries()) {
    if (!q.prompt?.trim()) throw httpError(400, `La pregunta ${i + 1} no tiene enunciado`);
    if (!q.correct?.length) throw httpError(400, `Marca la respuesta correcta de la pregunta ${i + 1}`);
  }
  const id = tx(() => {
    const qid = insert(
      'INSERT INTO quizzes (course_id, module_id, title, description, available_from, due_at, time_limit_min, max_attempts, points, category_id) VALUES (?,?,?,?,?,?,?,?,?,?)',
      course.id, module_id ? Number(module_id) : null, title.trim(), description || '', available_from || now(),
      new Date(due_at).toISOString(), Number(time_limit_min) || 20, Number(max_attempts) || 1, Number(points) || 20, catId
    );
    questions.forEach((q, i) => {
      const options = q.type === 'truefalse' ? ['Verdadero', 'Falso'] : q.options.filter((o) => String(o).trim());
      insert('INSERT INTO quiz_questions (quiz_id, type, prompt, options, correct, explanation, points, position) VALUES (?,?,?,?,?,?,?,?)',
        qid, q.type, q.prompt.trim(), JSON.stringify(options), JSON.stringify(q.correct.map(Number)), q.explanation || null, Number(q.points) || 1, i);
    });
    return qid;
  });
  notify(studentIds(course.id), {
    type: 'quiz', title: `Nueva evaluación · ${course.name}`, body: title.trim(), link: `/app/cursos/${course.id}/evaluaciones/${id}`,
  });
  audit(req, 'quiz.create', { entity: 'quiz', entityId: id, details: { course_id: course.id, title: title.trim() } });
  res.status(201).json(get('SELECT * FROM quizzes WHERE id = ?', id));
});

const quizOf = (id) => {
  const q = get('SELECT * FROM quizzes WHERE id = ?', Number(id));
  if (!q) throw httpError(404, 'Evaluación no encontrada');
  return q;
};

r.get('/quizzes/:id', (req, res) => {
  const q = quizOf(req.params.id);
  const { course, canEdit } = courseAccess(q.course_id, req.user);
  const questions = all('SELECT * FROM quiz_questions WHERE quiz_id = ? ORDER BY position', q.id);
  const out = {
    ...q, can_edit: canEdit, course_closed: course.status === 'closed', category: q.category_id ? get('SELECT name, weight FROM grade_categories WHERE id = ?', q.category_id) : null,
    course: { id: course.id, name: course.name, code: course.code, color: course.color },
    question_count: questions.length,
    total_points: questions.reduce((s, x) => s + x.points, 0),
  };
  if (canEdit) {
    out.questions = questions.map((x) => parseQ(x, true));
    out.attempts = all(
      `SELECT t.id, t.score, t.submitted_at, t.started_at, u.id AS user_id, u.first_name, u.last_name, u.avatar_color
       FROM quiz_attempts t JOIN users u ON u.id = t.user_id WHERE t.quiz_id = ? AND t.submitted_at IS NOT NULL ORDER BY u.last_name, t.submitted_at`, q.id);
  } else {
    out.attempts = all('SELECT id, score, started_at, submitted_at FROM quiz_attempts WHERE quiz_id = ? AND user_id = ? ORDER BY started_at', q.id, req.user.id);
    const open = out.attempts.find((t) => !t.submitted_at);
    if (open) {
      out.open_attempt = { ...open, answers: {} };
      out.questions = questions.map((x) => parseQ(x, false));
    }
  }
  res.json(out);
});

r.post('/quizzes/:id/start', (req, res) => {
  const q = quizOf(req.params.id);
  const { course: qc } = courseAccess(q.course_id, req.user);
  if (req.user.role !== 'student') throw httpError(400, 'Solo los estudiantes rinden evaluaciones');
  if (qc.status === 'closed') throw httpError(409, 'El acta del curso está cerrada: la evaluación ya no está disponible');
  if (q.available_from && new Date() < new Date(q.available_from)) throw httpError(400, 'La evaluación aún no está disponible');
  if (q.due_at && new Date() > new Date(q.due_at)) throw httpError(400, 'La evaluación ya cerró');
  let attempt = get('SELECT * FROM quiz_attempts WHERE quiz_id = ? AND user_id = ? AND submitted_at IS NULL', q.id, req.user.id);
  if (!attempt) {
    const used = get('SELECT COUNT(*) n FROM quiz_attempts WHERE quiz_id = ? AND user_id = ?', q.id, req.user.id).n;
    if (used >= q.max_attempts) throw httpError(400, 'Ya usaste todos tus intentos');
    const id = insert('INSERT INTO quiz_attempts (quiz_id, user_id, answers) VALUES (?,?,?)', q.id, req.user.id, '{}');
    attempt = get('SELECT * FROM quiz_attempts WHERE id = ?', id);
  }
  const questions = all('SELECT * FROM quiz_questions WHERE quiz_id = ? ORDER BY position', q.id).map((x) => parseQ(x, false));
  res.json({ attempt: { ...attempt, answers: JSON.parse(attempt.answers || '{}') }, questions, quiz: q });
});

r.post('/quizzes/:id/attempts/:aid/submit', (req, res) => {
  const q = quizOf(req.params.id);
  const { course } = courseAccess(q.course_id, req.user);
  const attempt = get('SELECT * FROM quiz_attempts WHERE id = ? AND quiz_id = ? AND user_id = ?', Number(req.params.aid), q.id, req.user.id);
  if (!attempt) throw httpError(404, 'Intento no encontrado');
  if (attempt.submitted_at) throw httpError(400, 'Este intento ya fue enviado');
  const answers = req.body.answers || {};
  const questions = all('SELECT * FROM quiz_questions WHERE quiz_id = ? ORDER BY position', q.id);
  let earned = 0, total = 0;
  const review = questions.map((x) => {
    const correct = JSON.parse(x.correct).map(Number).sort();
    const given = (Array.isArray(answers[x.id]) ? answers[x.id] : answers[x.id] != null ? [answers[x.id]] : []).map(Number).sort();
    const ok = correct.length === given.length && correct.every((c, i) => c === given[i]);
    total += x.points;
    if (ok) earned += x.points;
    return { ...parseQ(x, true), given, ok };
  });
  const score = total ? Math.round((earned / total) * q.points * 10) / 10 : 0;
  run('UPDATE quiz_attempts SET answers = ?, score = ?, submitted_at = ? WHERE id = ?', JSON.stringify(answers), score, now(), attempt.id);
  notify([req.user.id], {
    type: 'grade', title: `Resultado · ${q.title}`, body: `${course.name}: ${score}/${q.points}`, link: `/app/cursos/${course.id}/evaluaciones/${q.id}`,
  });
  res.json({ score, points: q.points, earned, total, review });
});

r.get('/quizzes/:id/attempts/:aid', (req, res) => {
  const q = quizOf(req.params.id);
  const { canEdit } = courseAccess(q.course_id, req.user);
  const attempt = get('SELECT * FROM quiz_attempts WHERE id = ? AND quiz_id = ?', Number(req.params.aid), q.id);
  if (!attempt || (!canEdit && attempt.user_id !== req.user.id)) throw httpError(404, 'Intento no encontrado');
  if (!attempt.submitted_at) throw httpError(400, 'Intento en curso');
  const answers = JSON.parse(attempt.answers || '{}');
  const review = all('SELECT * FROM quiz_questions WHERE quiz_id = ? ORDER BY position', q.id).map((x) => {
    const correct = JSON.parse(x.correct).map(Number).sort();
    const given = (Array.isArray(answers[x.id]) ? answers[x.id] : answers[x.id] != null ? [answers[x.id]] : []).map(Number).sort();
    return { ...parseQ(x, true), given, ok: correct.length === given.length && correct.every((c, i) => c === given[i]) };
  });
  res.json({ score: attempt.score, points: q.points, review, student: userBrief(attempt.user_id), submitted_at: attempt.submitted_at });
});

r.put('/quizzes/:id', (req, res) => {
  const q = quizOf(req.params.id);
  const { course } = requireEdit(q.course_id, req.user);
  requireOpen(course);
  const { title, description, due_at, time_limit_min, max_attempts, category_id } = req.body;
  run('UPDATE quizzes SET title = ?, description = ?, due_at = ?, time_limit_min = ?, max_attempts = ?, category_id = ? WHERE id = ?',
    title ?? q.title, description ?? q.description, due_at ? new Date(due_at).toISOString() : q.due_at,
    time_limit_min ?? q.time_limit_min, max_attempts ?? q.max_attempts, category_id === undefined ? q.category_id : categoryFor(course.id, category_id), q.id);
  audit(req, 'quiz.update', { entity: 'quiz', entityId: q.id });
  res.json(get('SELECT * FROM quizzes WHERE id = ?', q.id));
});

r.delete('/quizzes/:id', (req, res) => {
  const q = quizOf(req.params.id);
  const { course } = requireEdit(q.course_id, req.user);
  requireOpen(course);
  run('DELETE FROM quizzes WHERE id = ?', q.id);
  audit(req, 'quiz.delete', { entity: 'quiz', entityId: q.id, details: { title: q.title } });
  res.json({ ok: true });
});

export default r;
