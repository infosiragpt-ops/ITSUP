import { Router } from 'express';
import { all, get, insert, httpError } from '../db.js';

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

r.post('/applicants', (req, res) => {
  const { full_name, dni, email, phone, program_id, message } = req.body;
  if (!full_name?.trim() || !email?.trim()) throw httpError(400, 'Nombre y correo son obligatorios');
  if (!/^\S+@\S+\.\S+$/.test(email)) throw httpError(400, 'Ingresa un correo válido');
  if (dni && !/^\d{8}$/.test(String(dni))) throw httpError(400, 'El DNI debe tener 8 dígitos');
  const id = insert(
    'INSERT INTO applicants (full_name, dni, email, phone, program_id, message) VALUES (?,?,?,?,?,?)',
    full_name.trim(), dni || null, email.trim(), phone || null, program_id ? Number(program_id) : null, message || null
  );
  res.status(201).json({ id, ok: true });
});

export default r;
