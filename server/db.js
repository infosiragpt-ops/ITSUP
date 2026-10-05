import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, '..');
export const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(ROOT, 'data');
export const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, 'isup.db');

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS programs (
  id INTEGER PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  short TEXT,
  description TEXT,
  duration TEXT,
  modality TEXT,
  icon TEXT,
  color TEXT,
  profile TEXT,
  field TEXT,
  area TEXT,
  image TEXT,
  curriculum TEXT DEFAULT '[]',
  level TEXT DEFAULT 'Profesional Técnico',
  degree TEXT,
  total_credits INTEGER DEFAULT 120,
  total_hours INTEGER DEFAULT 2550,
  resolution TEXT,
  active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  code TEXT UNIQUE,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('student','teacher','admin')),
  program_id INTEGER REFERENCES programs(id),
  cycle INTEGER,
  phone TEXT,
  bio TEXT,
  title TEXT,
  avatar_color TEXT,
  active INTEGER DEFAULT 1,
  onboarding TEXT DEFAULT '{}',
  dni TEXT,
  consent_at TEXT,
  consent_version TEXT,
  failed_logins INTEGER DEFAULT 0,
  locked_until TEXT,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  last_login TEXT
);

CREATE TABLE IF NOT EXISTS terms (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  start_date TEXT,
  end_date TEXT,
  weeks INTEGER DEFAULT 16,
  is_active INTEGER DEFAULT 0,
  closed_at TEXT
);

CREATE TABLE IF NOT EXISTS courses (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  program_id INTEGER REFERENCES programs(id),
  term_id INTEGER REFERENCES terms(id),
  teacher_id INTEGER REFERENCES users(id),
  cycle INTEGER,
  credits INTEGER DEFAULT 3,
  color TEXT,
  schedule TEXT,
  syllabus TEXT,
  module_name TEXT,
  course_type TEXT DEFAULT 'especifica' CHECK (course_type IN ('especifica','empleabilidad','efsrt')),
  hours_theory INTEGER DEFAULT 32,
  hours_practice INTEGER DEFAULT 32,
  syllabus_json TEXT DEFAULT '{}',
  min_grade REAL DEFAULT 13,
  max_absence_pct REAL DEFAULT 30,
  status TEXT DEFAULT 'open' CHECK (status IN ('open','closed')),
  closed_at TEXT,
  closed_by INTEGER REFERENCES users(id),
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS grade_categories (
  id INTEGER PRIMARY KEY,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  weight REAL NOT NULL DEFAULT 0,
  position INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS enrollments (
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  last_access TEXT,
  status TEXT DEFAULT 'matriculado' CHECK (status IN ('matriculado','retirado')),
  withdrawn_at TEXT,
  PRIMARY KEY (course_id, user_id)
);

CREATE TABLE IF NOT EXISTS modules (
  id INTEGER PRIMARY KEY,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  position INTEGER DEFAULT 0,
  start_date TEXT
);

CREATE TABLE IF NOT EXISTS items (
  id INTEGER PRIMARY KEY,
  module_id INTEGER NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('reading','video','file','link')),
  title TEXT NOT NULL,
  content TEXT,
  url TEXT,
  file_name TEXT,
  file_path TEXT,
  duration_min INTEGER,
  position INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS item_progress (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  completed_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (user_id, item_id)
);

CREATE TABLE IF NOT EXISTS announcements (
  id INTEGER PRIMARY KEY,
  course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE,
  author_id INTEGER REFERENCES users(id),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  pinned INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS assignments (
  id INTEGER PRIMARY KEY,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  module_id INTEGER REFERENCES modules(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  instructions TEXT,
  due_at TEXT,
  points REAL DEFAULT 20,
  allow_late INTEGER DEFAULT 1,
  category_id INTEGER REFERENCES grade_categories(id) ON DELETE SET NULL,
  rubric TEXT DEFAULT '[]',
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS submissions (
  id INTEGER PRIMARY KEY,
  assignment_id INTEGER NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT,
  file_name TEXT,
  file_path TEXT,
  submitted_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  grade REAL,
  feedback TEXT,
  graded_at TEXT,
  rubric_scores TEXT,
  graded_by INTEGER REFERENCES users(id),
  UNIQUE (assignment_id, user_id)
);

CREATE TABLE IF NOT EXISTS quizzes (
  id INTEGER PRIMARY KEY,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  module_id INTEGER REFERENCES modules(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  available_from TEXT,
  due_at TEXT,
  time_limit_min INTEGER DEFAULT 20,
  max_attempts INTEGER DEFAULT 2,
  points REAL DEFAULT 20,
  category_id INTEGER REFERENCES grade_categories(id) ON DELETE SET NULL,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS quiz_questions (
  id INTEGER PRIMARY KEY,
  quiz_id INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('single','multiple','truefalse')),
  prompt TEXT NOT NULL,
  options TEXT NOT NULL,
  correct TEXT NOT NULL,
  explanation TEXT,
  points REAL DEFAULT 1,
  position INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS quiz_attempts (
  id INTEGER PRIMARY KEY,
  quiz_id INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  answers TEXT,
  score REAL,
  started_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  submitted_at TEXT
);

CREATE TABLE IF NOT EXISTS forums (
  id INTEGER PRIMARY KEY,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS threads (
  id INTEGER PRIMARY KEY,
  forum_id INTEGER NOT NULL REFERENCES forums(id) ON DELETE CASCADE,
  author_id INTEGER REFERENCES users(id),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  pinned INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY,
  thread_id INTEGER NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  author_id INTEGER REFERENCES users(id),
  body TEXT NOT NULL,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS live_sessions (
  id INTEGER PRIMARY KEY,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  starts_at TEXT NOT NULL,
  duration_min INTEGER DEFAULT 90,
  meeting_url TEXT,
  recording_url TEXT
);

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT,
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  read_at TEXT,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  date TEXT NOT NULL,
  end_date TEXT,
  type TEXT DEFAULT 'institutional'
);

CREATE TABLE IF NOT EXISTS tickets (
  id INTEGER PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  category TEXT,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT DEFAULT 'abierto' CHECK (status IN ('abierto','en_proceso','resuelto')),
  response TEXT,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS applicants (
  id INTEGER PRIMARY KEY,
  full_name TEXT NOT NULL,
  dni TEXT,
  email TEXT NOT NULL,
  phone TEXT,
  program_id INTEGER REFERENCES programs(id),
  message TEXT,
  status TEXT DEFAULT 'nuevo' CHECK (status IN ('nuevo','contactado','matriculado','descartado')),
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS attendance (
  session_id INTEGER NOT NULL REFERENCES live_sessions(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('presente','tardanza','falta','justificada')),
  note TEXT,
  recorded_by INTEGER REFERENCES users(id),
  recorded_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (session_id, user_id)
);

CREATE TABLE IF NOT EXISTS final_grades (
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  weighted REAL,
  final REAL,
  recovery REAL,
  attendance_pct REAL,
  absence_pct REAL,
  condition TEXT,
  observations TEXT,
  closed_at TEXT,
  closed_by INTEGER REFERENCES users(id),
  PRIMARY KEY (course_id, user_id)
);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity TEXT,
  entity_id INTEGER,
  details TEXT,
  ip TEXT,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  type TEXT NOT NULL,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  term_id INTEGER REFERENCES terms(id),
  payload TEXT NOT NULL,
  hash TEXT NOT NULL,
  issued_by INTEGER REFERENCES users(id),
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE INDEX IF NOT EXISTS idx_items_module ON items(module_id);
CREATE INDEX IF NOT EXISTS idx_modules_course ON modules(course_id);
CREATE INDEX IF NOT EXISTS idx_assign_course ON assignments(course_id);
CREATE INDEX IF NOT EXISTS idx_quiz_course ON quizzes(course_id);
CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, read_at);
CREATE INDEX IF NOT EXISTS idx_enroll_user ON enrollments(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_course ON live_sessions(course_id, starts_at);
CREATE INDEX IF NOT EXISTS idx_threads_forum ON threads(forum_id);
CREATE INDEX IF NOT EXISTS idx_posts_thread ON posts(thread_id);
CREATE INDEX IF NOT EXISTS idx_attendance_user ON attendance(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_user ON documents(user_id);
CREATE INDEX IF NOT EXISTS idx_categories_course ON grade_categories(course_id);
`;

export const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 3000;');
db.exec(SCHEMA);

// Migraciones ligeras para bases creadas con una versión anterior del esquema.
// Cada entrada: [tabla, columna, definición SQL]. Solo se agregan las columnas que falten.
const MIGRATIONS = [
  ['programs', 'area', 'TEXT'], ['programs', 'image', 'TEXT'],
  ['programs', 'level', "TEXT DEFAULT 'Profesional Técnico'"], ['programs', 'degree', 'TEXT'],
  ['programs', 'total_credits', 'INTEGER DEFAULT 120'], ['programs', 'total_hours', 'INTEGER DEFAULT 2550'], ['programs', 'resolution', 'TEXT'],
  ['users', 'dni', 'TEXT'], ['users', 'consent_at', 'TEXT'], ['users', 'consent_version', 'TEXT'],
  ['users', 'failed_logins', 'INTEGER DEFAULT 0'], ['users', 'locked_until', 'TEXT'], ['users', 'password_changed_at', 'TEXT'],
  ['terms', 'weeks', 'INTEGER DEFAULT 16'], ['terms', 'closed_at', 'TEXT'],
  ['courses', 'module_name', 'TEXT'], ['courses', 'course_type', "TEXT DEFAULT 'especifica'"],
  ['courses', 'hours_theory', 'INTEGER DEFAULT 32'], ['courses', 'hours_practice', 'INTEGER DEFAULT 32'],
  ['courses', 'syllabus_json', "TEXT DEFAULT '{}'"], ['courses', 'min_grade', 'REAL DEFAULT 13'], ['courses', 'max_absence_pct', 'REAL DEFAULT 30'],
  ['courses', 'status', "TEXT DEFAULT 'open'"], ['courses', 'closed_at', 'TEXT'], ['courses', 'closed_by', 'INTEGER'],
  ['enrollments', 'status', "TEXT DEFAULT 'matriculado'"], ['enrollments', 'withdrawn_at', 'TEXT'],
  ['assignments', 'category_id', 'INTEGER'], ['assignments', 'rubric', "TEXT DEFAULT '[]'"],
  ['submissions', 'rubric_scores', 'TEXT'], ['submissions', 'graded_by', 'INTEGER'],
  ['quizzes', 'category_id', 'INTEGER'],
];
const columnCache = {};
for (const [table, col, def] of MIGRATIONS) {
  columnCache[table] ||= db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
  if (!columnCache[table].includes(col)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`);
    columnCache[table].push(col);
  }
}

const cache = new Map();
function stmt(sql) {
  let s = cache.get(sql);
  if (!s) {
    s = db.prepare(sql);
    cache.set(sql, s);
  }
  return s;
}

export const all = (sql, ...p) => stmt(sql).all(...p);
export const get = (sql, ...p) => stmt(sql).get(...p);
export const run = (sql, ...p) => stmt(sql).run(...p);
export const insert = (sql, ...p) => Number(stmt(sql).run(...p).lastInsertRowid);

export function tx(fn) {
  db.exec('BEGIN');
  try {
    const r = fn();
    db.exec('COMMIT');
    return r;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

export const now = () => new Date().toISOString();

export function httpError(status, message) {
  const e = new Error(message);
  e.status = status;
  e.expose = true;
  return e;
}

export function notify(userIds, { type, title, body = null, link = null }) {
  for (const uid of userIds) {
    run('INSERT INTO notifications (user_id, type, title, body, link) VALUES (?,?,?,?,?)', uid, type, title, body, link);
  }
}

/* ---------------- Auditoría y configuración institucional ---------------- */

/** Registra una acción relevante (trazabilidad exigida para registros académicos y datos personales). */
export function audit(req, action, { entity = null, entityId = null, details = null } = {}) {
  // req.ip ya aplica la política 'trust proxy' de Express (no se confía en X-Forwarded-For de clientes cualesquiera)
  const ip = req?.ip ?? req?.socket?.remoteAddress ?? null;
  run('INSERT INTO audit_log (user_id, action, entity, entity_id, details, ip) VALUES (?,?,?,?,?,?)',
    req?.user?.id ?? null, action, entity, entityId, details == null ? null : JSON.stringify(details), ip);
}

/** Configuración institucional por defecto (editable desde Administración → Gestión académica). */
export const DEFAULT_SETTINGS = {
  institution_name: 'Instituto Superior Universitario Privado',
  institution_short: 'ISUP',
  institution_code: '0000000',
  institution_resolution: 'R.M. N.° 000-2026-MINEDU',
  institution_address: 'Lima, Perú',
  institution_director: 'Dirección General',
  academic_secretary: 'Secretaría Académica',
  min_grade: '13',
  max_absence_pct: '30',
  recovery_min: '10',
  recovery_max: '12',
  consent_version: '2026-1',
  privacy_contact: 'datospersonales@isup.edu.pe',
};

export function settings() {
  const rows = Object.fromEntries(all('SELECT key, value FROM settings').map((r) => [r.key, r.value]));
  return { ...DEFAULT_SETTINGS, ...rows };
}

export function setSetting(key, value) {
  run('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', key, String(value ?? ''));
}
