import multer from 'multer';
import path from 'node:path';
import crypto from 'node:crypto';
import { all, get, UPLOADS_DIR } from './db.js';

export const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOADS_DIR,
    filename: (req, file, cb) => cb(null, crypto.randomUUID() + path.extname(file.originalname).toLowerCase()),
  }),
  limits: { fileSize: 25 * 1024 * 1024 },
});

/** multer decodes original names as latin1; fix accents. */
export const fileName = (f) => (f ? Buffer.from(f.originalname, 'latin1').toString('utf8') : null);

export const userBrief = (id) =>
  get('SELECT id, first_name, last_name, role, avatar_color, title, email FROM users WHERE id = ?', id);

export function courseProgress(courseId, userId) {
  const total = get('SELECT COUNT(*) AS n FROM items WHERE course_id = ?', courseId).n;
  const done = get(
    'SELECT COUNT(*) AS n FROM item_progress p JOIN items i ON i.id = p.item_id WHERE i.course_id = ? AND p.user_id = ?',
    courseId, userId
  ).n;
  return { total, done, pct: total ? Math.round((done / total) * 100) : 0 };
}

const round1 = (n) => Math.round(n * 10) / 10;

/** Grade activities (assignments + quizzes) for one student in one course. Scale 0–20. */
export function studentGrades(courseId, userId) {
  const assignments = all(
    `SELECT a.id, a.title, a.due_at, a.points, s.id AS submission_id, s.grade, s.submitted_at, s.feedback
     FROM assignments a LEFT JOIN submissions s ON s.assignment_id = a.id AND s.user_id = ?
     WHERE a.course_id = ? ORDER BY a.due_at`,
    userId, courseId
  ).map((a) => ({
    kind: 'assignment', id: a.id, title: a.title, due_at: a.due_at, points: a.points,
    score: a.grade, submitted: !!a.submission_id, submitted_at: a.submitted_at, feedback: a.feedback,
  }));
  const quizzes = all(
    `SELECT q.id, q.title, q.due_at, q.points,
       (SELECT MAX(score) FROM quiz_attempts t WHERE t.quiz_id = q.id AND t.user_id = ? AND t.submitted_at IS NOT NULL) AS best,
       (SELECT COUNT(*) FROM quiz_attempts t WHERE t.quiz_id = q.id AND t.user_id = ? AND t.submitted_at IS NOT NULL) AS attempts
     FROM quizzes q WHERE q.course_id = ? ORDER BY q.due_at`,
    userId, userId, courseId
  ).map((q) => ({
    kind: 'quiz', id: q.id, title: q.title, due_at: q.due_at, points: q.points,
    score: q.best, submitted: q.attempts > 0, attempts: q.attempts,
  }));
  const items = [...assignments, ...quizzes].sort((a, b) => String(a.due_at).localeCompare(String(b.due_at)));
  const graded = items.filter((i) => i.score != null);
  const average = graded.length
    ? round1(graded.reduce((s, i) => s + (i.score / i.points) * 20, 0) / graded.length)
    : null;
  return { items, average, graded: graded.length, total: items.length };
}

export function courseCard(c, user) {
  const teacher = c.teacher_id ? userBrief(c.teacher_id) : null;
  const card = {
    ...c,
    teacher,
    students: get('SELECT COUNT(*) AS n FROM enrollments WHERE course_id = ?', c.id).n,
    program: c.program_id ? get('SELECT id, name, short FROM programs WHERE id = ?', c.program_id) : null,
    term: c.term_id ? get('SELECT id, name FROM terms WHERE id = ?', c.term_id) : null,
  };
  if (user.role === 'student') {
    card.progress = courseProgress(c.id, user.id);
    card.grades = studentGrades(c.id, user.id);
    const nextSession = get(
      `SELECT * FROM live_sessions WHERE course_id = ? AND datetime(starts_at, '+' || duration_min || ' minutes') > datetime('now') ORDER BY starts_at LIMIT 1`,
      c.id
    );
    card.next_session = nextSession || null;
  } else {
    card.to_grade = get(
      `SELECT COUNT(*) AS n FROM submissions s JOIN assignments a ON a.id = s.assignment_id WHERE a.course_id = ? AND s.grade IS NULL`,
      c.id
    ).n;
  }
  return card;
}

export function coursesFor(user) {
  if (user.role === 'admin') return all('SELECT * FROM courses ORDER BY code');
  if (user.role === 'teacher') return all('SELECT * FROM courses WHERE teacher_id = ? ORDER BY code', user.id);
  return all(
    'SELECT c.* FROM courses c JOIN enrollments e ON e.course_id = c.id WHERE e.user_id = ? ORDER BY e.last_access DESC, c.code',
    user.id
  );
}

export const courseIdsFor = (user) => coursesFor(user).map((c) => c.id);
export const studentIds = (courseId) =>
  all(
    "SELECT e.user_id AS id FROM enrollments e JOIN users u ON u.id = e.user_id WHERE e.course_id = ? AND u.role = 'student'",
    courseId
  ).map((x) => x.id);

export const inList = (ids) => (ids.length ? ids.map(Number).join(',') : 'NULL');
