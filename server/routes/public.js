import { Router } from 'express';
import { all, get, insert, httpError, settings } from '../db.js';
import { verifyDocument } from '../academic.js';

const r = Router();

const parseProgram = (p) => p && { ...p, curriculum: JSON.parse(p.curriculum || '[]') };

r.get('/programs', (req, res) => {
  res.json(all('SELECT * FROM programs WHERE active = 1 ORDER BY id').map(parseProgram));
});

r.get('/programs/:slug', (req, res) => {
  const p = get('SELECT * FROM programs WHERE slug = ? AND active = 1', req.params.slug);
  if (!p) throw httpError(404, 'Carrera no encontrada');
  res.json(parseProgram(p));
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

r.post('/applicants', (req, res) => {
  const { full_name, dni, email, phone, program_id, message, consent } = req.body;
  if (!full_name?.trim() || !email?.trim()) throw httpError(400, 'Nombre y correo son obligatorios');
  if (!/^\S+@\S+\.\S+$/.test(email)) throw httpError(400, 'Ingresa un correo válido');
  if (dni && !/^\d{8}$/.test(String(dni))) throw httpError(400, 'El DNI debe tener 8 dígitos');
  if (consent === false) throw httpError(400, 'Debes autorizar el tratamiento de tus datos personales para postular');
  const id = insert(
    'INSERT INTO applicants (full_name, dni, email, phone, program_id, message) VALUES (?,?,?,?,?,?)',
    full_name.trim(), dni || null, email.trim(), phone || null, program_id ? Number(program_id) : null, message || null
  );
  res.status(201).json({ id, ok: true });
});

export default r;
