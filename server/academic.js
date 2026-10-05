/**
 * Motor académico de ISUP.
 *
 * Implementa las reglas de evaluación de la educación superior tecnológica peruana
 * (Ley N.° 30512, su Reglamento D.S. N.° 010-2017-MINEDU y los Lineamientos Académicos
 * Generales del MINEDU para IES y EEST):
 *
 *  - Escala vigesimal (0 a 20). Nota mínima aprobatoria de la unidad didáctica: 13.
 *  - El promedio final se obtiene de los criterios de evaluación ponderados definidos en el sílabo
 *    y se redondea al entero: la fracción igual o mayor a 0.5 favorece al estudiante.
 *  - Inasistencia injustificada mayor al 30 % de las sesiones: desaprobado por inasistencia (DPI).
 *  - El estudiante con nota final entre 10 y 12 puede rendir una evaluación de recuperación, cuya nota
 *    reemplaza a la nota final de la unidad didáctica.
 *  - 1 crédito académico = 16 horas teóricas = 32 horas prácticas.
 *
 * Los umbrales se leen de la configuración institucional y pueden ajustarse por curso.
 */
import crypto from 'node:crypto';
import { all, get, run, insert, now, settings } from './db.js';

const round1 = (n) => Math.round(n * 10) / 10;
/** Redondeo normativo: 12.5 → 13, 12.49 → 12. */
export const roundHalfUp = (n) => (n == null ? null : Math.floor(n + 0.5));

export const CONDITION_LABEL = {
  aprobado: 'Aprobado',
  desaprobado: 'Desaprobado',
  dpi: 'Desaprobado por inasistencia',
  retirado: 'Retirado',
  pendiente: 'En proceso',
};

export const COURSE_TYPE_LABEL = {
  especifica: 'Competencia técnica o específica',
  empleabilidad: 'Competencia para la empleabilidad',
  efsrt: 'Experiencias formativas en situaciones reales de trabajo',
};

export const DOCUMENT_TYPES = {
  constancia_matricula: 'Constancia de matrícula',
  boleta_notas: 'Boleta de notas',
  record_academico: 'Récord académico',
};

/** Créditos que corresponden a una carga horaria (LAG: 16 h teóricas o 32 h prácticas por crédito). */
export const creditsFor = (theory = 0, practice = 0) => Math.round(((theory || 0) / 16 + (practice || 0) / 32) * 10) / 10;

export function courseRules(course) {
  const s = settings();
  return {
    min_grade: Number(course?.min_grade ?? s.min_grade) || 13,
    max_absence_pct: Number(course?.max_absence_pct ?? s.max_absence_pct) || 30,
    recovery_min: Number(s.recovery_min) || 10,
    recovery_max: Number(s.recovery_max) || 12,
  };
}

/* ---------------- Criterios de evaluación ---------------- */

export const courseCategories = (courseId) =>
  all('SELECT * FROM grade_categories WHERE course_id = ? ORDER BY position, id', courseId);

export function replaceCategories(courseId, list) {
  const clean = (list || [])
    .map((c, i) => ({ id: c.id ? Number(c.id) : null, name: String(c.name || '').trim(), weight: Number(c.weight) || 0, position: i }))
    .filter((c) => c.name);
  const total = clean.reduce((s, c) => s + c.weight, 0);
  if (clean.length && Math.abs(total - 100) > 0.01) throw Object.assign(new Error(`Los pesos deben sumar 100 % (suman ${round1(total)} %)`), { status: 400, expose: true });
  const existing = new Set(courseCategories(courseId).map((c) => c.id));
  const keep = new Set();
  for (const c of clean) {
    if (c.id && existing.has(c.id)) {
      run('UPDATE grade_categories SET name = ?, weight = ?, position = ? WHERE id = ?', c.name, c.weight, c.position, c.id);
      keep.add(c.id);
    } else {
      keep.add(insert('INSERT INTO grade_categories (course_id, name, weight, position) VALUES (?,?,?,?)', courseId, c.name, c.weight, c.position));
    }
  }
  for (const id of existing) if (!keep.has(id)) run('DELETE FROM grade_categories WHERE id = ?', id);
  return courseCategories(courseId);
}

/* ---------------- Calificaciones de un estudiante en un curso ---------------- */

/**
 * Actividades calificables de un estudiante y su promedio.
 * Si el curso define criterios ponderados, el promedio es la suma de (promedio del criterio × peso).
 * Los criterios sin actividades calificadas se excluyen y los pesos restantes se reescalan,
 * de modo que el promedio parcial siempre esté en escala 0–20.
 */
export function studentGrades(courseId, userId) {
  const assignments = all(
    `SELECT a.id, a.title, a.due_at, a.points, a.category_id, s.id AS submission_id, s.grade, s.submitted_at, s.feedback
     FROM assignments a LEFT JOIN submissions s ON s.assignment_id = a.id AND s.user_id = ?
     WHERE a.course_id = ? ORDER BY a.due_at`,
    userId, courseId
  ).map((a) => ({
    kind: 'assignment', id: a.id, title: a.title, due_at: a.due_at, points: a.points, category_id: a.category_id,
    score: a.grade, submitted: !!a.submission_id, submitted_at: a.submitted_at, feedback: a.feedback,
  }));
  const quizzes = all(
    `SELECT q.id, q.title, q.due_at, q.points, q.category_id,
       (SELECT MAX(score) FROM quiz_attempts t WHERE t.quiz_id = q.id AND t.user_id = ? AND t.submitted_at IS NOT NULL) AS best,
       (SELECT COUNT(*) FROM quiz_attempts t WHERE t.quiz_id = q.id AND t.user_id = ? AND t.submitted_at IS NOT NULL) AS attempts
     FROM quizzes q WHERE q.course_id = ? ORDER BY q.due_at`,
    userId, userId, courseId
  ).map((q) => ({
    kind: 'quiz', id: q.id, title: q.title, due_at: q.due_at, points: q.points, category_id: q.category_id,
    score: q.best, submitted: q.attempts > 0, attempts: q.attempts,
  }));
  const items = [...assignments, ...quizzes].sort((a, b) => String(a.due_at).localeCompare(String(b.due_at)));
  const on20 = (i) => (i.score / i.points) * 20;
  const graded = items.filter((i) => i.score != null);
  const simpleAvg = (list) => (list.length ? list.reduce((s, i) => s + on20(i), 0) / list.length : null);

  const cats = courseCategories(courseId);
  let weighted = null;
  let categories = [];
  if (cats.length) {
    categories = cats.map((c) => {
      const mine = items.filter((i) => i.category_id === c.id);
      const g = mine.filter((i) => i.score != null);
      return { id: c.id, name: c.name, weight: c.weight, items: mine.length, graded: g.length, average: g.length ? round1(simpleAvg(g)) : null };
    });
    const withAvg = categories.filter((c) => c.average != null);
    const wsum = withAvg.reduce((s, c) => s + c.weight, 0);
    weighted = wsum ? round1(withAvg.reduce((s, c) => s + c.average * c.weight, 0) / wsum) : null;
    // Actividades sin criterio asignado no entran al promedio ponderado, pero se listan.
  } else {
    weighted = graded.length ? round1(simpleAvg(graded)) : null;
  }
  return { items, categories, average: weighted, weighted, graded: graded.length, total: items.length, uncategorized: cats.length ? items.filter((i) => !i.category_id).length : 0 };
}

/* ---------------- Asistencia ---------------- */

/**
 * Resumen de asistencia del estudiante. Solo cuentan las sesiones ya realizadas en las que el
 * docente registró asistencia. La tardanza cuenta como asistencia; la falta justificada no cuenta
 * como inasistencia para el cómputo del 30 %.
 */
export function attendanceSummary(courseId, userId, course = null) {
  const rules = courseRules(course || get('SELECT min_grade, max_absence_pct FROM courses WHERE id = ?', courseId));
  const rows = all(
    `SELECT s.id, s.title, s.starts_at, s.duration_min, a.status, a.note,
       (SELECT COUNT(*) FROM attendance x WHERE x.session_id = s.id) AS taken
     FROM live_sessions s LEFT JOIN attendance a ON a.session_id = s.id AND a.user_id = ?
     WHERE s.course_id = ? AND datetime(s.starts_at) <= datetime('now') ORDER BY s.starts_at`,
    userId, courseId
  );
  const counted = rows.filter((r) => r.taken > 0);
  const c = { presente: 0, tardanza: 0, falta: 0, justificada: 0 };
  for (const r of counted) c[r.status || 'falta']++;
  const sessions = counted.length;
  const absencePct = sessions ? round1((c.falta / sessions) * 100) : 0;
  const attendancePct = sessions ? round1(((c.presente + c.tardanza) / sessions) * 100) : null;
  return {
    sessions, ...c,
    absence_pct: absencePct,
    attendance_pct: attendancePct,
    limit_pct: rules.max_absence_pct,
    dpi: sessions > 0 && absencePct > rules.max_absence_pct,
    at_risk: sessions > 0 && absencePct > rules.max_absence_pct * 0.66,
    detail: rows.map((r) => ({ session_id: r.id, title: r.title, starts_at: r.starts_at, status: r.taken ? r.status || 'falta' : null, note: r.note })),
  };
}

/* ---------------- Nota final y condición ---------------- */

/**
 * Nota final y condición del estudiante en el curso (vista en vivo, aún sin acta).
 * `stored` es la fila de final_grades si el acta ya fue cerrada o si hay recuperación registrada.
 */
export function computeFinal(course, grades, attendance, stored = null) {
  const rules = courseRules(course);
  const enrollment = stored?.enrollment_status;
  const weighted = grades.weighted;
  const base = roundHalfUp(weighted);
  const recovery = stored?.recovery ?? null;
  let final = base;
  let condition;
  if (enrollment === 'retirado') condition = 'retirado';
  else if (attendance.dpi) condition = 'dpi';
  else if (base == null) condition = 'pendiente';
  else {
    if (recovery != null && base >= rules.recovery_min && base <= rules.recovery_max) final = roundHalfUp(recovery);
    condition = final >= rules.min_grade ? 'aprobado' : 'desaprobado';
  }
  const canRecover = condition === 'desaprobado' && base != null && base >= rules.recovery_min && base <= rules.recovery_max && recovery == null;
  return {
    weighted, base, final: condition === 'dpi' || condition === 'retirado' ? final : final, recovery, condition,
    label: CONDITION_LABEL[condition], can_recover: canRecover, min_grade: rules.min_grade,
  };
}

/** Fila completa (calificaciones + asistencia + nota final) de un estudiante en un curso. */
export function studentStanding(course, userId) {
  const grades = studentGrades(course.id, userId);
  const attendance = attendanceSummary(course.id, userId, course);
  const stored = get(
    `SELECT f.*, e.status AS enrollment_status FROM enrollments e LEFT JOIN final_grades f ON f.course_id = e.course_id AND f.user_id = e.user_id
     WHERE e.course_id = ? AND e.user_id = ?`, course.id, userId
  );
  if (course.status === 'closed' && stored?.closed_at) {
    // Acta cerrada: la nota final es la registrada en el acta, no la calculada en vivo.
    return {
      grades, attendance,
      final: {
        weighted: stored.weighted, base: roundHalfUp(stored.weighted), final: stored.final, recovery: stored.recovery,
        condition: stored.condition, label: CONDITION_LABEL[stored.condition] || stored.condition, can_recover: false,
        min_grade: courseRules(course).min_grade, closed_at: stored.closed_at, observations: stored.observations,
      },
      closed: true,
    };
  }
  const final = computeFinal(course, grades, attendance, stored);
  return { grades, attendance, final: { ...final, observations: stored?.observations || null }, closed: false };
}

/** Indicadores de riesgo académico para el acompañamiento (tutoría). */
export function riskFlags(standing, progressPct = null) {
  const flags = [];
  const { final, attendance, grades } = standing;
  if (attendance.dpi) flags.push({ key: 'dpi', label: 'Supera el límite de inasistencias', tone: 'danger' });
  else if (attendance.at_risk) flags.push({ key: 'attendance', label: `Inasistencias ${attendance.absence_pct}% (límite ${attendance.limit_pct}%)`, tone: 'warn' });
  if (final.base != null && final.base < final.min_grade) flags.push({ key: 'grade', label: `Promedio ${grades.weighted} (mínimo ${final.min_grade})`, tone: final.base < 10 ? 'danger' : 'warn' });
  const missing = grades.items.filter((i) => !i.submitted && new Date(i.due_at) < new Date()).length;
  if (missing >= 2) flags.push({ key: 'missing', label: `${missing} actividades sin entregar`, tone: 'warn' });
  if (progressPct != null && progressPct < 35) flags.push({ key: 'progress', label: `Avance de contenido ${progressPct}%`, tone: 'warn' });
  return flags;
}

/* ---------------- Actas ---------------- */

export const enrolledStudents = (courseId) =>
  all(
    `SELECT u.id, u.first_name, u.last_name, u.code, u.dni, u.email, u.avatar_color, e.status AS enrollment_status
     FROM enrollments e JOIN users u ON u.id = e.user_id WHERE e.course_id = ? AND u.role = 'student' ORDER BY u.last_name, u.first_name`,
    courseId
  );

/** Acta de evaluación: una fila por estudiante con sus notas por criterio, asistencia, nota final y condición. */
export function buildActa(course) {
  const categories = courseCategories(course.id);
  const rows = enrolledStudents(course.id).map((s) => {
    const st = studentStanding(course, s.id);
    return { student: s, ...st };
  });
  const closedRows = rows.filter((r) => r.closed);
  const counted = rows.filter((r) => r.final.condition !== 'retirado');
  const stats = {
    students: rows.length,
    aprobados: counted.filter((r) => r.final.condition === 'aprobado').length,
    desaprobados: counted.filter((r) => r.final.condition === 'desaprobado').length,
    dpi: counted.filter((r) => r.final.condition === 'dpi').length,
    retirados: rows.length - counted.length,
    pendientes: counted.filter((r) => r.final.condition === 'pendiente').length,
    average: (() => { const v = counted.map((r) => r.final.final).filter((x) => x != null); return v.length ? round1(v.reduce((a, b) => a + b, 0) / v.length) : null; })(),
    attendance: (() => { const v = counted.map((r) => r.attendance.attendance_pct).filter((x) => x != null); return v.length ? round1(v.reduce((a, b) => a + b, 0) / v.length) : null; })(),
  };
  return { course, categories, rows, stats, closed: course.status === 'closed', closed_at: course.closed_at, all_closed: closedRows.length === rows.length && rows.length > 0 };
}

/** Cierra el acta del curso: congela la nota final y la condición de cada estudiante. */
export function closeActa(course, byUserId) {
  const acta = buildActa(course);
  const pending = acta.rows.filter((r) => r.final.condition === 'pendiente');
  if (pending.length) {
    const e = new Error(`${pending.length} estudiante(s) aún no tienen ninguna calificación registrada. Califica sus actividades o retíralos del curso antes de cerrar el acta.`);
    e.status = 400; e.expose = true; throw e;
  }
  const ts = now();
  for (const r of acta.rows) {
    run(
      `INSERT INTO final_grades (course_id, user_id, weighted, final, recovery, attendance_pct, absence_pct, condition, observations, closed_at, closed_by)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)
       ON CONFLICT(course_id, user_id) DO UPDATE SET weighted = excluded.weighted, final = excluded.final, recovery = excluded.recovery,
         attendance_pct = excluded.attendance_pct, absence_pct = excluded.absence_pct, condition = excluded.condition,
         observations = COALESCE(final_grades.observations, excluded.observations), closed_at = excluded.closed_at, closed_by = excluded.closed_by`,
      course.id, r.student.id, r.grades.weighted, r.final.final, r.final.recovery, r.attendance.attendance_pct, r.attendance.absence_pct,
      r.final.condition, r.final.observations || null, ts, byUserId
    );
  }
  run("UPDATE courses SET status = 'closed', closed_at = ?, closed_by = ? WHERE id = ?", ts, byUserId, course.id);
  return buildActa(get('SELECT * FROM courses WHERE id = ?', course.id));
}

export function reopenActa(course) {
  run("UPDATE courses SET status = 'open', closed_at = NULL, closed_by = NULL WHERE id = ?", course.id);
  run('UPDATE final_grades SET closed_at = NULL, closed_by = NULL WHERE course_id = ?', course.id);
  return buildActa(get('SELECT * FROM courses WHERE id = ?', course.id));
}

/* ---------------- Récord académico ---------------- */

export function termsOf(userId) {
  return all(
    `SELECT DISTINCT t.* FROM terms t JOIN courses c ON c.term_id = t.id JOIN enrollments e ON e.course_id = c.id
     WHERE e.user_id = ? ORDER BY t.start_date DESC`, userId
  );
}

/** Historial académico por periodo: cursos, créditos, nota final, condición y promedio ponderado del periodo. */
export function academicRecord(userId) {
  const terms = termsOf(userId).map((t) => {
    const courses = all(
      `SELECT c.* FROM courses c JOIN enrollments e ON e.course_id = c.id WHERE e.user_id = ? AND c.term_id = ? ORDER BY c.code`, userId, t.id
    ).map((c) => {
      const st = studentStanding(c, userId);
      const teacher = c.teacher_id ? get('SELECT first_name, last_name FROM users WHERE id = ?', c.teacher_id) : null;
      return {
        id: c.id, code: c.code, name: c.name, credits: c.credits, module_name: c.module_name, course_type: c.course_type,
        hours: (c.hours_theory || 0) + (c.hours_practice || 0), color: c.color, teacher,
        weighted: st.grades.weighted, final: st.final.final, recovery: st.final.recovery, condition: st.final.condition, label: st.final.label,
        attendance_pct: st.attendance.attendance_pct, closed: st.closed, items: st.grades.items,
      };
    });
    const withFinal = courses.filter((c) => c.final != null && c.condition !== 'retirado');
    const credits = withFinal.reduce((s, c) => s + c.credits, 0);
    const approved = courses.filter((c) => c.condition === 'aprobado');
    return {
      term: t,
      courses,
      credits_enrolled: courses.filter((c) => c.condition !== 'retirado').reduce((s, c) => s + c.credits, 0),
      credits_approved: approved.reduce((s, c) => s + c.credits, 0),
      weighted_average: credits ? round1(withFinal.reduce((s, c) => s + c.final * c.credits, 0) / credits) : null,
      closed: courses.length > 0 && courses.every((c) => c.closed),
    };
  });
  const closedTerms = terms.filter((t) => t.closed);
  const allApproved = closedTerms.flatMap((t) => t.courses.filter((c) => c.condition === 'aprobado'));
  const allFinal = closedTerms.flatMap((t) => t.courses.filter((c) => c.final != null && c.condition !== 'retirado'));
  const totalCredits = allFinal.reduce((s, c) => s + c.credits, 0);
  return {
    terms,
    summary: {
      credits_approved: allApproved.reduce((s, c) => s + c.credits, 0),
      courses_approved: allApproved.length,
      courses_failed: closedTerms.flatMap((t) => t.courses.filter((c) => ['desaprobado', 'dpi'].includes(c.condition))).length,
      cumulative_average: totalCredits ? round1(allFinal.reduce((s, c) => s + c.final * c.credits, 0) / totalCredits) : null,
      terms_closed: closedTerms.length,
    },
  };
}

/* ---------------- Documentos verificables ---------------- */

const DOC_SECRET = process.env.JWT_SECRET || 'isup-dev-secret-cambiar-en-produccion';
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function documentCode() {
  const year = new Date().getFullYear();
  for (;;) {
    const bytes = crypto.randomBytes(8);
    const body = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
    const code = `ISUP-${year}-${body.slice(0, 4)}-${body.slice(4, 8)}`;
    if (!get('SELECT 1 x FROM documents WHERE code = ?', code)) return code;
  }
}

export const documentHash = (payload) => crypto.createHmac('sha256', DOC_SECRET).update(JSON.stringify(payload)).digest('hex');

/** Emite un documento académico con código único y huella digital para su verificación pública. */
export function issueDocument({ type, user, termId = null, payload, issuedBy = null }) {
  const code = documentCode();
  const full = { ...payload, code, type, type_label: DOCUMENT_TYPES[type], issued_at: now() };
  const hash = documentHash(full);
  const id = insert('INSERT INTO documents (code, type, user_id, term_id, payload, hash, issued_by) VALUES (?,?,?,?,?,?,?)',
    code, type, user.id, termId, JSON.stringify(full), hash, issuedBy);
  return { id, code, hash, payload: full };
}

export function verifyDocument(code) {
  const d = get('SELECT d.*, u.first_name, u.last_name, u.code AS student_code FROM documents d LEFT JOIN users u ON u.id = d.user_id WHERE d.code = ?', String(code || '').trim().toUpperCase());
  if (!d) return null;
  const payload = JSON.parse(d.payload);
  const valid = documentHash(payload) === d.hash;
  return { valid, code: d.code, type: d.type, type_label: DOCUMENT_TYPES[d.type] || d.type, issued_at: d.created_at, payload };
}
