/**
 * Matrícula automática por plan de estudios.
 *
 * En la formación profesional técnica cada estudiante cursa, en el periodo académico activo, las unidades
 * didácticas de su carrera que corresponden a su ciclo. Por eso la matrícula se deriva de (carrera, ciclo):
 *
 *  - Estudiante activo con carrera y ciclo → queda matriculado en todos los cursos abiertos del periodo activo
 *    con esa misma carrera y ciclo.
 *  - Si cambia de carrera o de ciclo, se retiran las matrículas automáticas que ya no le corresponden, siempre que
 *    no tengan actividad académica (entregas, intentos, avance, asistencia o nota final).
 *  - Las matrículas hechas a mano por la administración (source = 'manual', p. ej. un curso a cargo o de
 *    recuperación) y los retiros ('retirado') nunca se tocan.
 *
 * Se ejecuta al crear o editar un estudiante, al crear o editar un curso, al activar un periodo, al arrancar el
 * servidor y al final del importador de cursos, de modo que toda alta llega sola al aula.
 */
import { all, get, run, tx, notify } from './db.js';

const openTerm = () => get('SELECT * FROM terms WHERE is_active = 1 AND closed_at IS NULL ORDER BY id DESC');

const planCourses = (termId, programId, cycle) =>
  all("SELECT id, code, name FROM courses WHERE term_id = ? AND program_id = ? AND cycle = ? AND COALESCE(status, 'open') = 'open' ORDER BY code",
    termId, programId, cycle);

const hasActivity = (courseId, userId) =>
  get(`SELECT
      EXISTS (SELECT 1 FROM submissions s JOIN assignments a ON a.id = s.assignment_id WHERE a.course_id = ?1 AND s.user_id = ?2)
   OR EXISTS (SELECT 1 FROM quiz_attempts q JOIN quizzes z ON z.id = q.quiz_id WHERE z.course_id = ?1 AND q.user_id = ?2)
   OR EXISTS (SELECT 1 FROM item_progress p JOIN items i ON i.id = p.item_id WHERE i.course_id = ?1 AND p.user_id = ?2)
   OR EXISTS (SELECT 1 FROM attendance t JOIN live_sessions l ON l.id = t.session_id WHERE l.course_id = ?1 AND t.user_id = ?2)
   OR EXISTS (SELECT 1 FROM final_grades f WHERE f.course_id = ?1 AND f.user_id = ?2) AS x`, courseId, userId).x === 1;

/** Sincroniza (sin transacción propia) las matrículas automáticas de un estudiante. */
function syncStudent(user, term) {
  const result = { added: [], removed: 0 };
  if (!term || !user || user.role !== 'student') return result;
  const wanted = user.active && user.program_id && user.cycle ? planCourses(term.id, user.program_id, user.cycle) : [];
  const wantedIds = new Set(wanted.map((c) => c.id));

  for (const c of wanted) {
    if (Number(run("INSERT OR IGNORE INTO enrollments (course_id, user_id, source) VALUES (?, ?, 'auto')", c.id, user.id).changes)) result.added.push(c);
  }
  // Matrículas automáticas del periodo activo que ya no corresponden (cambio de carrera/ciclo o baja)
  const stale = all(
    `SELECT e.course_id FROM enrollments e JOIN courses c ON c.id = e.course_id
     WHERE e.user_id = ? AND e.source = 'auto' AND e.status = 'matriculado' AND c.term_id = ? AND COALESCE(c.status, 'open') = 'open'`,
    user.id, term.id
  ).filter((e) => !wantedIds.has(e.course_id) && !hasActivity(e.course_id, user.id));
  for (const e of stale) result.removed += Number(run('DELETE FROM enrollments WHERE course_id = ? AND user_id = ?', e.course_id, user.id).changes);
  return result;
}

function notifyAdded(user, added) {
  if (!added.length) return;
  if (added.length === 1) {
    notify([user.id], { type: 'course', title: `Fuiste matriculado(a) en ${added[0].name}`, body: added[0].code, link: `/app/cursos/${added[0].id}` });
  } else {
    notify([user.id], {
      type: 'course', title: `Se te asignaron ${added.length} cursos del ciclo ${user.cycle}`,
      body: added.map((c) => c.name).join(' · ').slice(0, 240), link: '/app/cursos',
    });
  }
}

/** Matrícula automática de un estudiante en los cursos de su carrera y ciclo del periodo activo. */
export function autoEnrollStudent(userId) {
  const user = get('SELECT * FROM users WHERE id = ?', Number(userId));
  const r = tx(() => syncStudent(user, openTerm()));
  notifyAdded(user, r.added);
  return { added: r.added.length, removed: r.removed };
}

/** Matricula en un curso a todos los estudiantes activos de su carrera y ciclo (curso nuevo o editado). */
export function autoEnrollCourse(courseId) {
  const c = get('SELECT * FROM courses WHERE id = ?', Number(courseId));
  const term = openTerm();
  if (!c || !term) return { added: 0, removed: 0 };
  // Si el curso cambió de carrera o ciclo, sus matrículas automáticas sin actividad dejan de corresponder
  const students = all("SELECT DISTINCT u.* FROM users u LEFT JOIN enrollments e ON e.user_id = u.id AND e.course_id = ? AND e.source = 'auto' WHERE u.role = 'student' AND (e.user_id IS NOT NULL OR (u.active = 1 AND u.program_id = ? AND u.cycle = ?))",
    c.id, c.program_id ?? -1, c.cycle ?? -1);
  let added = 0, removed = 0;
  const notices = [];
  tx(() => {
    for (const u of students) {
      const r = syncStudent(u, term);
      added += r.added.length; removed += r.removed;
      if (r.added.length) notices.push([u, r.added]);
    }
  });
  notices.forEach(([u, list]) => notifyAdded(u, list));
  return { added, removed };
}

/** Sincroniza a todos los estudiantes (arranque del servidor, activación de periodo, importador de cursos). */
export function autoEnrollAll() {
  const term = openTerm();
  if (!term) return { students: 0, added: 0, removed: 0 };
  const students = all("SELECT * FROM users WHERE role = 'student'");
  let added = 0, removed = 0, touched = 0;
  const notices = [];
  tx(() => {
    for (const u of students) {
      const r = syncStudent(u, term);
      added += r.added.length; removed += r.removed;
      if (r.added.length || r.removed) touched++;
      if (r.added.length) notices.push([u, r.added]);
    }
  });
  notices.forEach(([u, list]) => notifyAdded(u, list));
  return { students: touched, added, removed };
}
