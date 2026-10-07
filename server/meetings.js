/**
 * Salas de videoconferencia de las sesiones en vivo.
 *
 * Cada curso tiene una sala estable (misma dirección todo el periodo) para que docentes y estudiantes no
 * dependan de enlaces distintos por semana. El nombre lleva una huella derivada del secreto del servidor,
 * así no se puede adivinar a partir del código del curso.
 *
 * MEET_BASE_URL define el servicio: por defecto Jitsi Meet público (https://meet.jit.si); al instalar un
 * servidor propio (p. ej. https://meet.tepsup.com) basta con cambiar la variable y volver a sincronizar.
 */
import crypto from 'node:crypto';
import { all, get, run, settings } from './db.js';
import { JWT_SECRET } from './auth.js';

export const MEET_BASE_URL = (process.env.MEET_BASE_URL || 'https://meet.jit.si').replace(/\/+$/, '');

const clean = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

/** Dirección de la sala de un curso (determinista: el mismo curso siempre da la misma sala). */
export function courseRoomUrl(course) {
  const short = clean(settings().institution_short || 'ISUP').toUpperCase();
  const code = clean(course.code || `C${course.id}`).toUpperCase();
  const stamp = crypto.createHmac('sha256', JWT_SECRET).update(`room:${course.id}:${code}`).digest('base64url').slice(0, 8);
  return `${MEET_BASE_URL}/${short}-${code}-${stamp}`;
}

/** Asigna la sala del curso a las sesiones que no tienen enlace. Devuelve cuántas se completaron. */
export function fillMissingMeetingUrls(courseId = null) {
  const rows = courseId
    ? all("SELECT DISTINCT c.id, c.code FROM courses c JOIN live_sessions s ON s.course_id = c.id WHERE c.id = ? AND (s.meeting_url IS NULL OR s.meeting_url = '')", courseId)
    : all("SELECT DISTINCT c.id, c.code FROM courses c JOIN live_sessions s ON s.course_id = c.id WHERE s.meeting_url IS NULL OR s.meeting_url = ''");
  let n = 0;
  for (const c of rows) {
    n += Number(run("UPDATE live_sessions SET meeting_url = ? WHERE course_id = ? AND (meeting_url IS NULL OR meeting_url = '')", courseRoomUrl(c), c.id).changes);
  }
  return n;
}

export const sessionCourse = (sessionId) => get('SELECT c.* FROM courses c JOIN live_sessions s ON s.course_id = c.id WHERE s.id = ?', sessionId);
