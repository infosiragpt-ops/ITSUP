import multer from 'multer';
import path from 'node:path';
import crypto from 'node:crypto';
import { all, get, UPLOADS_DIR } from './db.js';
import { studentGrades, attendanceSummary, computeFinal } from './academic.js';

export { studentGrades } from './academic.js';

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

export const activeTerm = () => get('SELECT * FROM terms WHERE is_active = 1') || null;

export function courseProgress(courseId, userId) {
  const total = get('SELECT COUNT(*) AS n FROM items WHERE course_id = ?', courseId).n;
  const done = get(
    'SELECT COUNT(*) AS n FROM item_progress p JOIN items i ON i.id = p.item_id WHERE i.course_id = ? AND p.user_id = ?',
    courseId, userId
  ).n;
  return { total, done, pct: total ? Math.round((done / total) * 100) : 0 };
}

export function courseCard(c, user) {
  const teacher = c.teacher_id ? userBrief(c.teacher_id) : null;
  const card = {
    ...c,
    teacher,
    students: get("SELECT COUNT(*) AS n FROM enrollments e JOIN users u ON u.id = e.user_id WHERE e.course_id = ? AND u.role = 'student' AND e.status = 'matriculado'", c.id).n,
    program: c.program_id ? get('SELECT id, name, short FROM programs WHERE id = ?', c.program_id) : null,
    term: c.term_id ? get('SELECT id, name, is_active FROM terms WHERE id = ?', c.term_id) : null,
    hours: (c.hours_theory || 0) + (c.hours_practice || 0),
    closed: c.status === 'closed',
  };
  delete card.syllabus_json;
  if (user.role === 'student') {
    card.progress = courseProgress(c.id, user.id);
    card.grades = studentGrades(c.id, user.id);
    card.attendance = attendanceSummary(c.id, user.id, c);
    const stored = get('SELECT * FROM final_grades WHERE course_id = ? AND user_id = ?', c.id, user.id);
    card.final = c.status === 'closed' && stored?.closed_at
      ? { final: stored.final, condition: stored.condition }
      : computeFinal(c, card.grades, card.attendance, stored);
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
    card.attendance_pending = get(
      `SELECT COUNT(*) AS n FROM live_sessions s WHERE s.course_id = ? AND datetime(s.starts_at, '+' || s.duration_min || ' minutes') < datetime('now')
       AND NOT EXISTS (SELECT 1 FROM attendance a WHERE a.session_id = s.id)`, c.id
    ).n;
  }
  return card;
}

/**
 * Cursos visibles para el usuario. Por defecto solo los del periodo académico activo (o sin periodo);
 * con { allTerms: true } se incluyen los periodos anteriores (récord académico, administración).
 */
export function coursesFor(user, { allTerms = false } = {}) {
  const term = activeTerm();
  const termFilter = allTerms || !term ? '' : ` AND (c.term_id IS NULL OR c.term_id = ${Number(term.id)})`;
  if (user.role === 'admin') return all('SELECT c.* FROM courses c ORDER BY c.code');
  if (user.role === 'teacher') return all(`SELECT c.* FROM courses c WHERE c.teacher_id = ?${termFilter} ORDER BY c.code`, user.id);
  return all(
    `SELECT c.* FROM courses c JOIN enrollments e ON e.course_id = c.id WHERE e.user_id = ? AND e.status = 'matriculado'${termFilter} ORDER BY e.last_access DESC, c.code`,
    user.id
  );
}

export const courseIdsFor = (user) => coursesFor(user).map((c) => c.id);
export const studentIds = (courseId) =>
  all(
    "SELECT e.user_id AS id FROM enrollments e JOIN users u ON u.id = e.user_id WHERE e.course_id = ? AND u.role = 'student' AND e.status = 'matriculado'",
    courseId
  ).map((x) => x.id);

export const inList = (ids) => (ids.length ? ids.map(Number).join(',') : 'NULL');

/** Política de contraseñas: mínimo 8 caracteres con letras y números. */
export function checkPassword(pwd) {
  const p = String(pwd || '');
  if (p.length < 8) return 'La contraseña debe tener al menos 8 caracteres';
  if (!/[A-Za-z]/.test(p) || !/\d/.test(p)) return 'La contraseña debe combinar letras y números';
  return null;
}
