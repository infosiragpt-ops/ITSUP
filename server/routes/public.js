import { Router } from 'express';
import { all, get, insert, httpError, settings } from '../db.js';
import { verifyDocument } from '../academic.js';
import { normalizeCurriculum } from '../curriculum.js';

const r = Router();

const parseProgram = (p) => p && { ...p, curriculum: normalizeCurriculum(p.curriculum) };
const keyOf = (s) => String(s || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/**
 * Plan de estudios detallado por ciclo: código, créditos, horas y tipo de cada unidad didáctica, tomados de los
 * cursos ofertados en el periodo más reciente. Si un ciclo aún no tiene cursos creados, se usa el plan publicado.
 */
function studyPlan(p, curriculum) {
  const term = get('SELECT id FROM terms WHERE is_active = 1') || get('SELECT t.id FROM terms t JOIN courses c ON c.term_id = t.id WHERE c.program_id = ? ORDER BY t.start_date DESC LIMIT 1', p.id);
  const offered = term ? all(
    `SELECT code, name, cycle, credits, hours_theory, hours_practice, course_type, module_name FROM courses
     WHERE program_id = ? AND term_id = ? AND cycle IS NOT NULL ORDER BY cycle, code`, p.id, term.id) : [];
  const cycles = new Set([...curriculum.map((c) => c.cycle), ...offered.map((c) => c.cycle)]);
  return [...cycles].sort((a, b) => a - b).map((cycle) => {
    const fromDb = offered.filter((c) => c.cycle === cycle);
    const seen = new Set();
    const courses = (fromDb.length ? fromDb : (curriculum.find((c) => c.cycle === cycle)?.courses || []).map((name) => ({ name })))
      .filter((c) => !seen.has(keyOf(c.name)) && seen.add(keyOf(c.name)))
      .map((c) => ({
        name: c.name, code: c.code || null, credits: c.credits ?? null,
        hours: c.hours_theory != null || c.hours_practice != null ? (c.hours_theory || 0) + (c.hours_practice || 0) : null,
        type: c.course_type || null, module: c.module_name || null,
      }));
    const sum = (k) => (courses.every((c) => c[k] != null) ? courses.reduce((n, c) => n + c[k], 0) : null);
    return { cycle, courses, credits: sum('credits'), hours: sum('hours') };
  });
}

r.get('/programs', (req, res) => {
  res.json(all('SELECT * FROM programs WHERE active = 1 ORDER BY id').map(parseProgram));
});

r.get('/programs/:slug', (req, res) => {
  const p = parseProgram(get('SELECT * FROM programs WHERE slug = ? AND active = 1', req.params.slug));
  if (!p) throw httpError(404, 'Carrera no encontrada');
  res.json({ ...p, plan: studyPlan(p, p.curriculum) });
});

r.get('/events', (req, res) => {
  res.json(all('SELECT * FROM events ORDER BY date'));
});

r.get('/term', (req, res) => {
  res.json(get('SELECT * FROM terms WHERE is_active = 1') || null);
});

/** Datos institucionales y reglas académicas públicas (encabezados de documentos, aviso de privacidad). */
r.get('/institution', (req, res) => {
  const s = settings();
  res.json({
    name: s.institution_name, short: s.institution_short, code: s.institution_code, resolution: s.institution_resolution,
    address: s.institution_address, director: s.institution_director, academic_secretary: s.academic_secretary,
    min_grade: Number(s.min_grade), max_absence_pct: Number(s.max_absence_pct), recovery_min: Number(s.recovery_min), recovery_max: Number(s.recovery_max),
    consent_version: s.consent_version, privacy_contact: s.privacy_contact,
  });
});

/** Verificación pública de constancias y boletas emitidas por el aula virtual. */
r.get('/verify/:code', (req, res) => {
  const d = verifyDocument(req.params.code);
  if (!d) throw httpError(404, 'No existe ningún documento con ese código');
  res.json(d);
});

/** Postulaciones anónimas: límite por IP (5 por hora), campo trampa para bots, topes de longitud y consentimiento explícito. */
const applicantHits = new Map();
const APPLICANT_LIMIT = 5;
const APPLICANT_WINDOW = 60 * 60e3;
r.post('/applicants', (req, res) => {
  const ip = req.ip || req.socket?.remoteAddress || 'local';
  const nowMs = Date.now();
  if (applicantHits.size > 5000) for (const [k, v] of applicantHits) if (nowMs - v.at > APPLICANT_WINDOW) applicantHits.delete(k);
  const hit = applicantHits.get(ip);
  if (hit && hit.count >= APPLICANT_LIMIT && nowMs - hit.at < APPLICANT_WINDOW) {
    throw httpError(429, 'Has enviado varias postulaciones seguidas. Inténtalo de nuevo en una hora o escríbenos por WhatsApp.');
  }
  const { full_name, dni, email, phone, program_id, message, consent, website } = req.body;
  if (website) return res.status(201).json({ ok: true }); // campo oculto: solo lo rellenan los bots
  const name = String(full_name || '').trim();
  const mail = String(email || '').trim().toLowerCase();
  if (!name || !mail) throw httpError(400, 'Nombre y correo son obligatorios');
  if (!/^\S+@\S+\.\S+$/.test(mail) || mail.length > 120) throw httpError(400, 'Ingresa un correo válido');
  if (dni && !/^\d{8}$/.test(String(dni))) throw httpError(400, 'El DNI debe tener 8 dígitos');
  if (name.length > 120 || (message && String(message).length > 2000) || (phone && String(phone).length > 20)) throw httpError(400, 'Alguno de los datos es demasiado largo');
  if (consent !== true) throw httpError(400, 'Debes autorizar el tratamiento de tus datos personales para postular');
  applicantHits.set(ip, { count: (hit && nowMs - hit.at < APPLICANT_WINDOW ? hit.count : 0) + 1, at: nowMs });
  const id = insert(
    'INSERT INTO applicants (full_name, dni, email, phone, program_id, message) VALUES (?,?,?,?,?,?)',
    name, dni || null, mail, phone ? String(phone).trim() : null, program_id ? Number(program_id) : null, message ? String(message).trim() : null
  );
  res.status(201).json({ id, ok: true });
});

export default r;
