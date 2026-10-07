/**
 * Rutas del módulo académico normativo: sílabo estructurado, criterios de evaluación,
 * asistencia, actas de evaluación, récord académico y documentos verificables.
 */
import { Router } from 'express';
import { all, get, run, now, httpError, notify, audit, settings, tx } from '../db.js';
import { courseAccess, requireEdit, requireOpen, publicUser } from '../auth.js';
import { userBrief, courseProgress, studentIds, activeTerm } from '../lib.js';
import {
  courseCategories, replaceCategories, studentStanding, attendanceSummary, buildActa, closeActa, riskFlags,
  academicRecord, issueDocument, DOCUMENT_TYPES, COURSE_TYPE_LABEL, courseRules, enrolledStudents,
} from '../academic.js';

const r = Router();

/* ---------------- Sílabo estructurado ---------------- */

/** Plantilla del sílabo según los Lineamientos Académicos Generales. */
export function defaultSyllabus(course) {
  return {
    summary: course.description || '',
    competency: '',
    capacities: [],
    indicators: [],
    methodology: 'Aprendizaje activo en modalidad a distancia: sesiones sincrónicas por videoconferencia, estudio autónomo con lecturas y videos por unidad, foros de discusión, tareas aplicadas y evaluaciones en línea con retroalimentación.',
    resources: ['Aula Virtual ISUP (contenidos, foros, tareas y evaluaciones)', 'Sesiones en vivo por videoconferencia', 'Biblioteca virtual'],
    bibliography: [],
    policies: 'La nota mínima aprobatoria es 13. La inasistencia injustificada a más del 30 % de las sesiones programadas desaprueba la unidad didáctica. Las entregas fuera de plazo se registran como tardías. Se promueve la honestidad académica: el plagio y la suplantación se sancionan según el Reglamento Institucional.',
    approved_by: '',
    approved_at: '',
  };
}

function syllabusOf(course) {
  let s = {};
  try { s = JSON.parse(course.syllabus_json || '{}'); } catch {}
  const base = defaultSyllabus(course);
  const out = { ...base, ...s };
  for (const k of ['capacities', 'indicators', 'resources', 'bibliography']) if (!Array.isArray(out[k])) out[k] = base[k];
  return out;
}

r.get('/courses/:id/syllabus', (req, res) => {
  const { course, canEdit } = courseAccess(req.params.id, req.user);
  const program = course.program_id ? get('SELECT id, name, short, level, degree FROM programs WHERE id = ?', course.program_id) : null;
  const term = course.term_id ? get('SELECT * FROM terms WHERE id = ?', course.term_id) : null;
  const teacher = course.teacher_id ? get('SELECT id, first_name, last_name, title, email FROM users WHERE id = ?', course.teacher_id) : null;
  const units = all('SELECT id, title, description, position, start_date FROM modules WHERE course_id = ? ORDER BY position, id', course.id).map((m) => ({
    ...m,
    items: all('SELECT id, type, title, duration_min FROM items WHERE module_id = ? ORDER BY position, id', m.id),
    assignments: all('SELECT id, title, due_at, points FROM assignments WHERE module_id = ? ORDER BY due_at', m.id),
    quizzes: all('SELECT id, title, due_at, points FROM quizzes WHERE module_id = ? ORDER BY due_at', m.id),
  }));
  const inst = settings();
  res.json({
    course: {
      id: course.id, code: course.code, name: course.name, credits: course.credits, cycle: course.cycle, schedule: course.schedule,
      module_name: course.module_name, course_type: course.course_type, course_type_label: COURSE_TYPE_LABEL[course.course_type] || course.course_type,
      hours_theory: course.hours_theory, hours_practice: course.hours_practice, hours_total: (course.hours_theory || 0) + (course.hours_practice || 0),
      modality: program?.modality, status: course.status,
    },
    institution: { name: inst.institution_name, short: inst.institution_short, resolution: inst.institution_resolution },
    program, term, teacher, units,
    categories: courseCategories(course.id),
    rules: courseRules(course),
    syllabus: syllabusOf(course),
    can_edit: canEdit,
  });
});

r.put('/courses/:id/syllabus', (req, res) => {
  const { course } = requireEdit(req.params.id, req.user);
  const current = syllabusOf(course);
  const body = req.body || {};
  const str = (v, fallback) => (v === undefined ? fallback : String(v ?? ''));
  const arr = (v, fallback) => (v === undefined ? fallback : (Array.isArray(v) ? v : String(v).split('\n')).map((x) => String(x).trim()).filter(Boolean));
  const next = {
    summary: str(body.summary, current.summary), competency: str(body.competency, current.competency),
    capacities: arr(body.capacities, current.capacities), indicators: arr(body.indicators, current.indicators),
    methodology: str(body.methodology, current.methodology), resources: arr(body.resources, current.resources),
    bibliography: arr(body.bibliography, current.bibliography), policies: str(body.policies, current.policies),
    approved_by: str(body.approved_by, current.approved_by), approved_at: str(body.approved_at, current.approved_at),
    // Cronograma semanal (lo carga el catálogo de cursos); se conserva al editar los demás campos
    weekly_plan: Array.isArray(body.weekly_plan) ? body.weekly_plan : (Array.isArray(current.weekly_plan) ? current.weekly_plan : []),
  };
  run('UPDATE courses SET syllabus_json = ? WHERE id = ?', JSON.stringify(next), course.id);
  if (body.categories) replaceCategories(course.id, body.categories);
  audit(req, 'syllabus.update', { entity: 'course', entityId: course.id });
  res.json({ syllabus: next, categories: courseCategories(course.id) });
});

/* ---------------- Criterios de evaluación ---------------- */

r.get('/courses/:id/categories', (req, res) => {
  const { course } = courseAccess(req.params.id, req.user);
  res.json(courseCategories(course.id));
});

r.put('/courses/:id/categories', (req, res) => {
  const { course } = requireEdit(req.params.id, req.user);
  requireOpen(course);
  const list = replaceCategories(course.id, req.body.categories || []);
  audit(req, 'categories.update', { entity: 'course', entityId: course.id, details: list.map((c) => `${c.name} ${c.weight}%`) });
  res.json(list);
});

/* ---------------- Asistencia ---------------- */

const sessionOf = (id) => {
  const s = get('SELECT * FROM live_sessions WHERE id = ?', Number(id));
  if (!s) throw httpError(404, 'Sesión no encontrada');
  return s;
};

r.get('/courses/:id/attendance', (req, res) => {
  const { course, canEdit } = courseAccess(req.params.id, req.user);
  if (!canEdit) return res.json({ mine: attendanceSummary(course.id, req.user.id, course), rules: courseRules(course) });
  const sessions = all(
    `SELECT s.id, s.title, s.starts_at, s.duration_min, (SELECT COUNT(*) FROM attendance a WHERE a.session_id = s.id) AS taken
     FROM live_sessions s WHERE s.course_id = ? AND datetime(s.starts_at) <= datetime('now') ORDER BY s.starts_at`, course.id
  );
  const records = all(
    'SELECT a.session_id, a.user_id, a.status, a.note FROM attendance a JOIN live_sessions s ON s.id = a.session_id WHERE s.course_id = ?', course.id
  );
  const byKey = Object.fromEntries(records.map((x) => [`${x.session_id}:${x.user_id}`, x]));
  const students = enrolledStudents(course.id).map((s) => ({
    ...s, dni: undefined,
    summary: (({ detail, ...rest }) => rest)(attendanceSummary(course.id, s.id, course)),
    cells: sessions.map((se) => byKey[`${se.id}:${s.id}`]?.status || null),
  }));
  res.json({ sessions, students, rules: courseRules(course), closed: course.status === 'closed' });
});

r.get('/sessions/:id/attendance', (req, res) => {
  const s = sessionOf(req.params.id);
  const { course } = requireEdit(s.course_id, req.user);
  const rows = Object.fromEntries(all('SELECT user_id, status, note FROM attendance WHERE session_id = ?', s.id).map((x) => [x.user_id, x]));
  res.json({
    session: s,
    students: enrolledStudents(course.id).map((st) => ({ id: st.id, first_name: st.first_name, last_name: st.last_name, code: st.code, avatar_color: st.avatar_color, enrollment_status: st.enrollment_status, status: rows[st.id]?.status || null, note: rows[st.id]?.note || null })),
  });
});

const STATUSES = new Set(['presente', 'tardanza', 'falta', 'justificada']);

r.put('/sessions/:id/attendance', (req, res) => {
  const s = sessionOf(req.params.id);
  const { course } = requireEdit(s.course_id, req.user);
  requireOpen(course);
  if (new Date(s.starts_at) > new Date()) throw httpError(400, 'La sesión aún no ha empezado');
  const allowed = new Set(studentIds(course.id).concat(enrolledStudents(course.id).map((x) => x.id)));
  const records = Array.isArray(req.body.records) ? req.body.records : [];
  let n = 0;
  tx(() => {
    for (const rec of records) {
      const uid = Number(rec.user_id);
      if (!allowed.has(uid) || !STATUSES.has(rec.status)) continue;
      run(`INSERT INTO attendance (session_id, user_id, status, note, recorded_by, recorded_at) VALUES (?,?,?,?,?,?)
           ON CONFLICT(session_id, user_id) DO UPDATE SET status = excluded.status, note = excluded.note, recorded_by = excluded.recorded_by, recorded_at = excluded.recorded_at`,
        s.id, uid, rec.status, rec.note ? String(rec.note).slice(0, 200) : null, req.user.id, now());
      n++;
    }
  });
  audit(req, 'attendance.record', { entity: 'session', entityId: s.id, details: { course_id: course.id, records: n } });
  // Aviso a quienes quedaron cerca o por encima del límite de inasistencias
  for (const uid of studentIds(course.id)) {
    const a = attendanceSummary(course.id, uid, course);
    if (a.dpi || a.at_risk) {
      const recent = get("SELECT 1 x FROM notifications WHERE user_id = ? AND type = 'attendance' AND link = ? AND created_at > datetime('now', '-3 days')", uid, `/app/cursos/${course.id}/asistencia`);
      if (!recent) notify([uid], {
        type: 'attendance', title: a.dpi ? `Superaste el límite de inasistencias en ${course.name}` : `Atención: inasistencias en ${course.name}`,
        body: `Tienes ${a.absence_pct}% de inasistencias (límite ${a.limit_pct}%). Comunícate con tu docente o tutor.`, link: `/app/cursos/${course.id}/asistencia`,
      });
    }
  }
  res.json({ ok: true, saved: n });
});

/** El estudiante registra su ingreso a la videoconferencia: asistencia automática (presente o tardanza). */
r.post('/sessions/:id/join', (req, res) => {
  const s = sessionOf(req.params.id);
  const { course, canEdit } = courseAccess(s.course_id, req.user);
  if (canEdit) return res.json({ ok: true, teacher: true, url: s.meeting_url });
  if (course.status === 'closed') return res.json({ ok: true, url: s.meeting_url });
  const start = new Date(s.starts_at).getTime();
  const end = start + (s.duration_min || 90) * 60e3;
  const t = Date.now();
  if (t >= start - 10 * 60e3 && t <= end) {
    const late = t > start + 15 * 60e3;
    const existing = get('SELECT status FROM attendance WHERE session_id = ? AND user_id = ?', s.id, req.user.id);
    if (!existing || existing.status === 'falta') {
      run(`INSERT INTO attendance (session_id, user_id, status, note, recorded_by, recorded_at) VALUES (?,?,?,?,?,?)
           ON CONFLICT(session_id, user_id) DO UPDATE SET status = excluded.status, note = excluded.note, recorded_at = excluded.recorded_at`,
        s.id, req.user.id, late ? 'tardanza' : 'presente', 'Registro automático al unirse a la sesión', req.user.id, now());
    }
  }
  res.json({ ok: true, url: s.meeting_url });
});

/* ---------------- Acta de evaluación ---------------- */

const actaJson = (acta) => ({
  ...acta,
  course: (({ syllabus_json, ...c }) => c)(acta.course),
  // El acta es un documento oficial: el docente ve el DNI completo (el estudiante solo ve el suyo enmascarado en su perfil).
  rows: acta.rows.map((row) => ({ ...row, student: { ...row.student, email: undefined }, attendance: (({ detail, ...a }) => a)(row.attendance) })),
});

r.get('/courses/:id/acta', (req, res) => {
  const { course, canEdit } = courseAccess(req.params.id, req.user);
  if (!canEdit) throw httpError(403, 'Solo el docente puede ver el acta completa');
  const acta = buildActa(course);
  const inst = settings();
  const program = course.program_id ? get('SELECT id, name, short FROM programs WHERE id = ?', course.program_id) : null;
  const term = course.term_id ? get('SELECT * FROM terms WHERE id = ?', course.term_id) : null;
  const teacher = course.teacher_id ? userBrief(course.teacher_id) : null;
  res.json({ ...actaJson(acta), program, term, teacher, institution: { name: inst.institution_name, short: inst.institution_short, resolution: inst.institution_resolution, director: inst.institution_director, academic_secretary: inst.academic_secretary } });
});

/** Nota de recuperación u observación para un estudiante (antes del cierre del acta). */
r.put('/courses/:id/acta/:uid', (req, res) => {
  const { course } = requireEdit(req.params.id, req.user);
  requireOpen(course);
  const uid = Number(req.params.uid);
  if (!get('SELECT 1 x FROM enrollments WHERE course_id = ? AND user_id = ?', course.id, uid)) throw httpError(404, 'El estudiante no está matriculado en este curso');
  const existing = get('SELECT * FROM final_grades WHERE course_id = ? AND user_id = ?', course.id, uid);
  let recovery = existing?.recovery ?? null;
  if (req.body.recovery !== undefined) {
    if (req.body.recovery === null || req.body.recovery === '') recovery = null;
    else {
      recovery = Number(req.body.recovery);
      if (Number.isNaN(recovery) || recovery < 0 || recovery > 20) throw httpError(400, 'La nota de recuperación debe estar entre 0 y 20');
      const st = studentStanding(course, uid);
      const rules = courseRules(course);
      if (st.final.condition === 'dpi') throw httpError(400, 'Un estudiante desaprobado por inasistencia no puede rendir recuperación');
      if (st.final.base == null || st.final.base < rules.recovery_min || st.final.base > rules.recovery_max) {
        throw httpError(400, `Solo pueden rendir recuperación los estudiantes con nota final entre ${rules.recovery_min} y ${rules.recovery_max}`);
      }
    }
  }
  const observations = req.body.observations === undefined ? existing?.observations ?? null : String(req.body.observations || '').slice(0, 300) || null;
  run(`INSERT INTO final_grades (course_id, user_id, recovery, observations) VALUES (?,?,?,?)
       ON CONFLICT(course_id, user_id) DO UPDATE SET recovery = excluded.recovery, observations = excluded.observations`, course.id, uid, recovery, observations);
  audit(req, 'acta.recovery', { entity: 'course', entityId: course.id, details: { user_id: uid, recovery, observations } });
  if (req.body.recovery !== undefined && recovery != null) {
    notify([uid], { type: 'grade', title: `Nota de recuperación registrada · ${course.name}`, body: `Obtuviste ${recovery} en la evaluación de recuperación.`, link: `/app/cursos/${course.id}/calificaciones` });
  }
  const st = studentStanding(course, uid);
  res.json({ final: st.final, attendance: (({ detail, ...a }) => a)(st.attendance), grades: st.grades });
});

r.post('/courses/:id/acta/close', (req, res) => {
  const { course } = requireEdit(req.params.id, req.user);
  requireOpen(course);
  const acta = closeActa(course, req.user.id);
  audit(req, 'acta.close', { entity: 'course', entityId: course.id, details: acta.stats });
  notify(studentIds(course.id), { type: 'grade', title: `Acta cerrada · ${course.name}`, body: 'Tu nota final ya está disponible en Calificaciones y en tu récord académico.', link: `/app/cursos/${course.id}/calificaciones` });
  res.json(actaJson(acta));
});

/** Retiro de un estudiante del curso (conserva su historial; la condición pasa a "Retirado"). */
r.put('/courses/:id/enrollments/:uid/status', (req, res) => {
  const { course } = requireEdit(req.params.id, req.user);
  requireOpen(course);
  const uid = Number(req.params.uid);
  const status = req.body.status === 'retirado' ? 'retirado' : 'matriculado';
  const e = get('SELECT * FROM enrollments WHERE course_id = ? AND user_id = ?', course.id, uid);
  if (!e) throw httpError(404, 'Matrícula no encontrada');
  run('UPDATE enrollments SET status = ?, withdrawn_at = ? WHERE course_id = ? AND user_id = ?', status, status === 'retirado' ? now() : null, course.id, uid);
  audit(req, 'enrollment.status', { entity: 'course', entityId: course.id, details: { user_id: uid, status } });
  res.json({ ok: true, status });
});

/* ---------------- Seguimiento (alerta temprana) ---------------- */

r.get('/courses/:id/tracking', (req, res) => {
  const { course } = requireEdit(req.params.id, req.user);
  const rows = enrolledStudents(course.id).map((s) => {
    const st = studentStanding(course, s.id);
    const progress = courseProgress(course.id, s.id);
    const last = get('SELECT last_access FROM enrollments WHERE course_id = ? AND user_id = ?', course.id, s.id)?.last_access;
    return {
      student: { id: s.id, first_name: s.first_name, last_name: s.last_name, code: s.code, avatar_color: s.avatar_color, email: s.email, enrollment_status: s.enrollment_status },
      weighted: st.grades.weighted, final: st.final.final, condition: st.final.condition, label: st.final.label,
      attendance: (({ detail, ...a }) => a)(st.attendance), progress, last_access: last,
      flags: s.enrollment_status === 'retirado' ? [] : riskFlags(st, progress.pct),
    };
  });
  res.json({ rows, at_risk: rows.filter((r) => r.flags.length).length, rules: courseRules(course) });
});

/* ---------------- Récord académico y documentos ---------------- */

r.get('/record', (req, res) => {
  if (req.user.role !== 'student') throw httpError(403, 'Solo disponible para estudiantes');
  const record = academicRecord(req.user.id);
  const program = req.user.program_id ? get('SELECT id, name, short, level, degree, total_credits, total_hours FROM programs WHERE id = ?', req.user.program_id) : null;
  res.json({ ...record, program, student: publicUser(req.user) });
});

r.get('/documents', (req, res) => {
  res.json(all('SELECT id, code, type, term_id, created_at FROM documents WHERE user_id = ? ORDER BY created_at DESC', req.user.id)
    .map((d) => ({ ...d, type_label: DOCUMENT_TYPES[d.type] || d.type })));
});

r.get('/documents/:code', (req, res) => {
  const d = get('SELECT * FROM documents WHERE code = ? AND user_id = ?', String(req.params.code).toUpperCase(), req.user.id);
  if (!d) throw httpError(404, 'Documento no encontrado');
  res.json({ code: d.code, type: d.type, created_at: d.created_at, payload: JSON.parse(d.payload) });
});

r.post('/documents', (req, res) => {
  if (req.user.role !== 'student') throw httpError(403, 'Solo los estudiantes pueden emitir sus documentos');
  const type = String(req.body.type || '');
  if (!DOCUMENT_TYPES[type]) throw httpError(400, 'Tipo de documento inválido');
  const inst = settings();
  const u = req.user;
  const program = u.program_id ? get('SELECT * FROM programs WHERE id = ?', u.program_id) : null;
  const student = { id: u.id, name: `${u.first_name} ${u.last_name}`, first_name: u.first_name, last_name: u.last_name, code: u.code, dni: u.dni || null, email: u.email, cycle: u.cycle };
  const institution = { name: inst.institution_name, short: inst.institution_short, code: inst.institution_code, resolution: inst.institution_resolution, address: inst.institution_address, director: inst.institution_director, academic_secretary: inst.academic_secretary };
  const programInfo = program ? { name: program.name, level: program.level, degree: program.degree, modality: program.modality, total_credits: program.total_credits } : null;
  let payload;
  let termId = req.body.term_id ? Number(req.body.term_id) : null;
  const record = academicRecord(u.id);

  if (type === 'constancia_matricula') {
    const term = termId ? get('SELECT * FROM terms WHERE id = ?', termId) : activeTerm();
    if (!term) throw httpError(400, 'No hay un periodo académico activo');
    termId = term.id;
    const courses = all(
      `SELECT c.code, c.name, c.credits, c.cycle, c.hours_theory, c.hours_practice, u.first_name || ' ' || u.last_name AS teacher
       FROM courses c JOIN enrollments e ON e.course_id = c.id LEFT JOIN users u ON u.id = c.teacher_id
       WHERE e.user_id = ? AND c.term_id = ? AND e.status = 'matriculado' ORDER BY c.code`, u.id, term.id
    );
    if (!courses.length) throw httpError(400, 'No tienes cursos matriculados en ese periodo');
    payload = { student, institution, program: programInfo, term: { id: term.id, name: term.name, start_date: term.start_date, end_date: term.end_date }, courses, credits: courses.reduce((s, c) => s + c.credits, 0) };
  } else if (type === 'boleta_notas') {
    const t = record.terms.find((x) => x.term.id === termId) || record.terms[0];
    if (!t) throw httpError(400, 'No tienes periodos con calificaciones');
    termId = t.term.id;
    payload = {
      student, institution, program: programInfo, term: { id: t.term.id, name: t.term.name, start_date: t.term.start_date, end_date: t.term.end_date },
      courses: t.courses.map((c) => ({ code: c.code, name: c.name, credits: c.credits, final: c.final, condition: c.condition, label: c.label, attendance_pct: c.attendance_pct, closed: c.closed })),
      weighted_average: t.weighted_average, credits_approved: t.credits_approved, credits_enrolled: t.credits_enrolled, closed: t.closed,
    };
  } else {
    termId = null;
    payload = {
      student, institution, program: programInfo,
      terms: record.terms.map((t) => ({
        term: { id: t.term.id, name: t.term.name }, weighted_average: t.weighted_average, credits_approved: t.credits_approved, closed: t.closed,
        courses: t.courses.map((c) => ({ code: c.code, name: c.name, credits: c.credits, final: c.final, condition: c.condition, label: c.label, closed: c.closed })),
      })),
      summary: record.summary,
    };
  }
  const doc = issueDocument({ type, user: u, termId, payload, issuedBy: u.id });
  audit(req, 'document.issue', { entity: 'document', entityId: doc.id, details: { type, code: doc.code } });
  res.status(201).json({ code: doc.code, type, created_at: doc.payload.issued_at, payload: doc.payload });
});

export default r;
