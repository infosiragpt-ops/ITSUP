const TZ = 'America/Lima';
const LOCALE = 'es-PE';

const fmt = (opts) => new Intl.DateTimeFormat(LOCALE, { timeZone: TZ, ...opts });
const dateFmt = fmt({ day: 'numeric', month: 'short', year: 'numeric' });
const shortFmt = fmt({ day: 'numeric', month: 'short' });
const longFmt = fmt({ weekday: 'long', day: 'numeric', month: 'long' });
const timeFmt = fmt({ hour: '2-digit', minute: '2-digit', hour12: true });
const weekdayFmt = fmt({ weekday: 'short' });
const rtf = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });

const toDate = (d) => (d instanceof Date ? d : new Date(d && d.length === 10 ? `${d}T12:00:00-05:00` : d));

export const fmtDate = (d) => (d ? dateFmt.format(toDate(d)) : '—');
export const fmtShort = (d) => (d ? shortFmt.format(toDate(d)).replace('.', '') : '—');
export const fmtLong = (d) => (d ? capitalize(longFmt.format(toDate(d))) : '—');
export const fmtTime = (d) => (d ? timeFmt.format(toDate(d)).replace(/\s?a\.\s?m\./, ' a. m.').replace(/\s?p\.\s?m\./, ' p. m.') : '');
export const fmtDateTime = (d) => (d ? `${fmtShort(d)} · ${fmtTime(d)}` : '—');
export const fmtWeekday = (d) => capitalize(weekdayFmt.format(toDate(d)).replace('.', ''));
export const capitalize = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/** Lima calendar day key (YYYY-MM-DD) for a date. */
export function dayKey(d) {
  const p = fmt({ year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(toDate(d));
  const g = (t) => p.find((x) => x.type === t).value;
  return `${g('year')}-${g('month')}-${g('day')}`;
}

export function relative(d) {
  if (!d) return '';
  const diff = toDate(d).getTime() - Date.now();
  const abs = Math.abs(diff);
  const min = 60e3, hour = 3600e3, day = 864e5;
  if (abs < min) return 'justo ahora';
  if (abs < hour) return rtf.format(Math.round(diff / min), 'minute');
  if (abs < day) return rtf.format(Math.round(diff / hour), 'hour');
  if (abs < 7 * day) return rtf.format(Math.round(diff / day), 'day');
  if (abs < 30 * day) return rtf.format(Math.round(diff / (7 * day)), 'week');
  return fmtDate(d);
}

/** Label + tone for a due date. */
export function dueInfo(due, done = false) {
  if (!due) return { label: 'Sin fecha', tone: 'neutral' };
  if (done) return { label: `Entregado`, tone: 'success' };
  const diff = toDate(due).getTime() - Date.now();
  const days = diff / 864e5;
  if (diff < 0) return { label: `Venció ${relative(due)}`, tone: 'danger' };
  if (days < 1) return { label: `Vence hoy · ${fmtTime(due)}`, tone: 'danger' };
  if (days < 2) return { label: `Vence mañana · ${fmtTime(due)}`, tone: 'warn' };
  if (days < 7) return { label: `Vence ${relative(due)}`, tone: 'warn' };
  return { label: `Vence el ${fmtShort(due)}`, tone: 'neutral' };
}

export function sessionState(s) {
  const start = new Date(s.starts_at).getTime();
  const end = start + (s.duration_min || 90) * 60e3;
  const now = Date.now();
  if (now >= start - 10 * 60e3 && now < start) return 'soon';
  if (now >= start && now < end) return 'live';
  if (now >= end) return 'past';
  return 'upcoming';
}

export const fullName = (u) => (u ? `${u.first_name} ${u.last_name}` : '');
export const firstName = (u) => (u ? u.first_name : '');
export const initials = (u) => (u ? `${u.first_name?.[0] || ''}${u.last_name?.[0] || ''}`.toUpperCase() : '?');

export function greeting() {
  const h = Number(fmt({ hour: 'numeric', hour12: false }).format(new Date()));
  if (h < 12) return 'Buenos días';
  if (h < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

export const gradeTone = (g, max = 20) => (g == null ? 'neutral' : (g / max) * 20 >= 13 ? 'success' : 'danger');
export const fmtGrade = (g) => (g == null ? '—' : Number.isInteger(g) ? String(g) : g.toFixed(1));

export const ROLE_LABEL = { student: 'Estudiante', teacher: 'Docente', admin: 'Administrador(a)' };

export const pluralize = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/** Value for <input type="datetime-local"> in Lima time. */
export function toLocalInput(d) {
  const p = fmt({ year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(toDate(d));
  const g = (t) => p.find((x) => x.type === t).value;
  return `${g('year')}-${g('month')}-${g('day')}T${g('hour') === '24' ? '00' : g('hour')}:${g('minute')}`;
}
/** Interprets a datetime-local value as Lima time and returns ISO. */
export const fromLocalInput = (v) => (v ? new Date(`${v}:00-05:00`).toISOString() : null);
