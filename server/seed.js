import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db, SCHEMA, insert, run, get, all, tx, UPLOADS_DIR, setSetting, DEFAULT_SETTINGS } from './db.js';
import { PROGRAMS, TEACHERS, STUDENTS, COURSES, APPLICANTS, PREVIOUS_TERM, SYLLABUS_BY_CODE } from './seed-data.js';
import { closeActa } from './academic.js';

/** Contraseña común de todas las cuentas de demostración (ver DEMO_ACCESOS.md). */
export const DEMO_PASSWORD = 'Isup2026!';

const DAY = 864e5;
const LIMA_OFFSET_H = 5; // Lima = UTC-5, sin horario de verano

/** Date at Lima-local day offset + hour:minute, returned as ISO (UTC). */
function limaAt(dayOffset, hour = 23, minute = 59) {
  const lima = new Date(Date.now() - LIMA_OFFSET_H * 3600e3);
  return new Date(Date.UTC(lima.getUTCFullYear(), lima.getUTCMonth(), lima.getUTCDate() + dayOffset, hour + LIMA_OFFSET_H, minute)).toISOString();
}
const limaDate = (dayOffset) => limaAt(dayOffset, 12, 0).slice(0, 10);
const limaWeekday = () => new Date(Date.now() - LIMA_OFFSET_H * 3600e3).getUTCDay();

// Deterministic PRNG so every reset produces the same demo
function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------- Tiny PDF writer (one page, Helvetica, WinAnsi) for syllabus files ---------- */
function makePdf(title, subtitle, sections) {
  const esc = (s) => s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  let y = 760;
  const ops = ['0.788 0.392 0.259 rg 0 792 595 50 re f', 'BT /F2 13 Tf 1 1 1 rg 40 810 Td (ISUP · Instituto Superior Universitario Privado) Tj ET'];
  const text = (s, size = 10.5, bold = false, color = '0.08 0.08 0.07') => {
    ops.push(`BT /${bold ? 'F2' : 'F1'} ${size} Tf ${color} rg 40 ${y} Td (${esc(s)}) Tj ET`);
    y -= size + 6;
  };
  const wrap = (s, max = 92) => {
    const words = s.split(' '); const lines = []; let cur = '';
    for (const w of words) { if ((cur + ' ' + w).trim().length > max) { lines.push(cur); cur = w; } else cur = (cur + ' ' + w).trim(); }
    if (cur) lines.push(cur);
    return lines;
  };
  text(title, 20, true); text(subtitle, 11, false, '0.37 0.36 0.35'); y -= 8;
  for (const [h, body] of sections) {
    text(h, 12.5, true, '0.788 0.392 0.259');
    for (const para of [].concat(body)) for (const line of wrap(para)) text(line);
    y -= 6;
  }
  const stream = ops.join('\n');
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>',
    `<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
  ];
  let out = '%PDF-1.4\n';
  const offsets = [];
  objs.forEach((o, i) => { offsets.push(Buffer.byteLength(out, 'latin1')); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = Buffer.byteLength(out, 'latin1');
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => String(o).padStart(10, '0') + ' 00000 n \n').join('')}`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(out.replace(/·/g, '\xb7').replace(/[–—]/g, '-'), 'latin1');
}

function lesson(item, courseName) {
  const points = item.points.map((p) => `- ${p}`).join('\n');
  return `En esta lección de **${courseName}** trabajaremos **${item.title.toLowerCase()}**. Tómate unos ${item.minutes} minutos, lee con calma y, si algo no queda claro, publícalo en el *Foro de consultas*.

### Lo que aprenderás
${points}

${item.extra ? item.extra + '\n\n' : ''}### Ponlo en práctica
1. Resume la lección en tres ideas con tus propias palabras.
2. Busca un ejemplo real (en tu trabajo, tu barrio o una app que uses) donde se aplique este tema.
3. Anota una pregunta para la próxima sesión en vivo.

> **Tip ISUP:** marca esta lección como completada cuando termines; así tu progreso se actualiza y sabrás exactamente dónde continuar.`;
}

export function seed() {
  const rand = mulberry32(2026);
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const hash = bcrypt.hashSync(DEMO_PASSWORD, 10);
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });

  tx(() => {
    /* Programs */
    const programId = {};
    for (const p of PROGRAMS) {
      const curriculum = p.curriculum.map((courses, i) => ({ cycle: i + 1, courses }));
      programId[p.slug] = insert(
        'INSERT INTO programs (slug, name, short, description, duration, modality, icon, color, profile, field, area, image, curriculum, level, degree, total_credits, total_hours, resolution) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
        p.slug, p.name, p.short, p.description, p.duration, p.modality, p.icon, p.color, p.profile, p.field, p.area, p.image, JSON.stringify(curriculum),
        'Profesional Técnico', `Profesional Técnico en ${p.name}`, 120, 2550, p.resolution || 'R.M. N.° 000-2026-MINEDU (licenciamiento institucional)'
      );
    }

    /* Term: started 7 weeks ago (Monday) */
    const wd = limaWeekday();
    const toMonday = (wd + 6) % 7;
    const termStartOffset = -toMonday - 49;
    const startDate = limaDate(termStartOffset);
    const year = Number(startDate.slice(0, 4));
    const termName = `${year}-${Number(startDate.slice(5, 7)) < 7 ? 'I' : 'II'}`;
    const termId = insert('INSERT INTO terms (name, start_date, end_date, weeks, is_active) VALUES (?,?,?,16,1)', termName, startDate, limaDate(termStartOffset + 7 * 16 - 2));
    // Periodo anterior (cerrado) para el récord académico del estudiante de demostración
    const prevName = termName.endsWith('-I') ? `${year - 1}-II` : `${year}-I`;
    const prevStart = termStartOffset - 7 * 24;
    const prevTermId = insert('INSERT INTO terms (name, start_date, end_date, weeks, is_active, closed_at) VALUES (?,?,?,16,0,?)', prevName, limaDate(prevStart), limaDate(prevStart + 7 * 16 - 2), limaAt(prevStart + 7 * 17, 12, 0));

    /* Configuración institucional */
    for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) setSetting(k, v);

    /* Users */
    const consentV = DEFAULT_SETTINGS.consent_version;
    let dniSeq = 70000000 + Math.floor(rand() * 900000);
    const nextDni = () => String(dniSeq += 137 + Math.floor(rand() * 900));
    insert(
      "INSERT INTO users (code, email, password_hash, first_name, last_name, role, title, avatar_color, phone, onboarding, dni, consent_at, consent_version) VALUES (?,?,?,?,?,'admin',?,?,?,?,?,?,?)",
      'A00260001', 'admin@isup.edu.pe', hash, 'Lucía', 'Paredes Montoya', 'Coordinadora Académica', '#3D3929', '01 640 5000', '{"done":true}', nextDni(), limaAt(termStartOffset, 9, 0), consentV
    );
    const teacherId = {};
    let tn = 1;
    for (const [key, t] of Object.entries(TEACHERS)) {
      teacherId[key] = insert(
        "INSERT INTO users (code, email, password_hash, first_name, last_name, role, title, avatar_color, bio, onboarding, last_login, dni, consent_at, consent_version) VALUES (?,?,?,?,?,'teacher',?,?,?,?,?,?,?,?)",
        `D0026${String(tn++).padStart(4, '0')}`, t.email, hash, t.first, t.last, t.title, t.color,
        `Docente de ISUP. ${t.title}.`, '{"done":true}', limaAt(-1, 20, 0), nextDni(), limaAt(termStartOffset, 9, 0), consentV
      );
    }
    const colors = ['#C96442', '#5B7B6F', '#6A5ACD', '#B8860B', '#2F6F8F', '#8B4C6B', '#4F6D3A', '#A0522D'];
    const studentId = [];
    STUDENTS.forEach(([first, last, email], i) => {
      const isAdm = i >= 19;
      const plain = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(' ')[0];
      const mail = email || `${plain(first)}.${plain(last)}@isup.edu.pe`;
      // La estudiante de demostración aún no acepta la política de datos: verá el aviso al ingresar.
      studentId.push(insert(
        "INSERT INTO users (code, email, password_hash, first_name, last_name, role, program_id, cycle, avatar_color, phone, onboarding, last_login, dni, consent_at, consent_version) VALUES (?,?,?,?,?,'student',?,3,?,?,?,?,?,?,?)",
        `N0026${String(i + 1).padStart(4, '0')}`, mail, hash, first, last,
        programId[isAdm ? 'administracion-de-empresas' : 'desarrollo-de-sistemas'], colors[i % colors.length],
        `9${String(10000000 + Math.floor(rand() * 89999999)).slice(0, 8)}`,
        i === 0 ? '{"internet":true,"chrome":true}' : '{"done":true}', limaAt(-Math.floor(rand() * 5), 19, 30),
        nextDni(), i === 0 ? null : limaAt(termStartOffset, 10, 0), i === 0 ? null : consentV
      ));
    });
    const demoStudent = studentId[0];
    const dsiStudents = studentId.slice(0, 19);
    const admStudents = studentId.slice(19);

    /* Courses */
    const nowMs = Date.now();
    for (const c of COURSES) {
      const tId = teacherId[c.teacher];
      const syllabus = `Unidad didáctica de ${c.credits} créditos del ciclo ${c.cycle}. ${c.description}`;
      const hoursTheory = c.credits * 8;
      const hoursPractice = c.credits * 16; // 8 h teóricas + 16 h prácticas por crédito (16 h T = 32 h P = 1 crédito)
      const courseId = insert(
        `INSERT INTO courses (code, name, description, program_id, term_id, teacher_id, cycle, credits, color, schedule, syllabus, module_name, course_type, hours_theory, hours_practice, syllabus_json)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        c.code, c.name, c.description, programId[c.program], termId, tId, c.cycle, c.credits, c.color, c.schedule, syllabus,
        c.module, c.type || 'especifica', hoursTheory, hoursPractice, JSON.stringify(SYLLABUS_BY_CODE[c.code] || {})
      );
      // Criterios de evaluación ponderados del sílabo
      const catId = {};
      c.categories.forEach(([key, name, weight], i) => { catId[key] = insert('INSERT INTO grade_categories (course_id, name, weight, position) VALUES (?,?,?,?)', courseId, name, weight, i); });
      const students = c.program === 'desarrollo-de-sistemas' ? dsiStudents : admStudents;
      students.forEach((sid, i) => insert('INSERT INTO enrollments (course_id, user_id, last_access) VALUES (?,?,?)',
        courseId, sid, limaAt(-(COURSES.indexOf(c) + i % 3), 20, 0)));

      // Syllabus PDF
      const pdfName = `${crypto.randomUUID()}.pdf`;
      fs.writeFileSync(path.join(UPLOADS_DIR, pdfName), makePdf(`Sílabo · ${c.name}`, `${c.code} · Ciclo ${c.cycle} · ${c.credits} créditos · Periodo ${termName}`, [
        ['Sumilla', c.description],
        ['Docente', `${TEACHERS[c.teacher].first} ${TEACHERS[c.teacher].last} - ${TEACHERS[c.teacher].title}`],
        ['Horario de sesiones en vivo', `${c.schedule} (hora de Lima). Las sesiones quedan registradas en el calendario del aula virtual.`],
        ['Unidades de aprendizaje', c.units.map((u) => `${u.title}: ${u.desc}`)],
        ['Sistema de evaluación', `${c.categories.map(([, n, w]) => `${n} ${w}%`).join(' - ')}. Escala vigesimal (0 a 20); nota mínima aprobatoria 13; la fracción 0.5 se redondea a favor del estudiante. Inasistencia injustificada mayor al 30% desaprueba la unidad didáctica (DPI).`],
        ['Normas del aula virtual', 'Ingresa con tu cámara encendida en las evaluaciones supervisadas, participa en los foros con respeto y entrega tus trabajos dentro del plazo.'],
      ]));

      // Units: 4 units spread over the term; current unit = 3
      const unitStarts = [termStartOffset, termStartOffset + 21, termStartOffset + 42, termStartOffset + 63];
      const moduleIds = [];
      const allItems = [];
      c.units.forEach((u, ui) => {
        const mId = insert('INSERT INTO modules (course_id, title, description, position, start_date) VALUES (?,?,?,?,?)',
          courseId, u.title, u.desc, ui + 1, limaAt(unitStarts[ui] ?? termStartOffset, 0, 0));
        moduleIds.push(mId);
        u.items.forEach((it, ii) => {
          const base = [mId, courseId, it.type, it.title === 'Sílabo del curso' ? `Sílabo · ${c.name}` : it.title];
          let id;
          if (it.type === 'reading') id = insert('INSERT INTO items (module_id, course_id, type, title, content, duration_min, position) VALUES (?,?,?,?,?,?,?)', ...base, lesson(it, c.name), it.minutes, ii);
          else if (it.type === 'video') id = insert('INSERT INTO items (module_id, course_id, type, title, content, url, duration_min, position) VALUES (?,?,?,?,?,?,?,?)', ...base,
            'Mira el video completo y toma apuntes. Al final encontrarás preguntas de repaso para comentar en la próxima sesión.',
            `https://www.youtube.com/results?search_query=${encodeURIComponent(it.title.replace(/^.*?: /, ''))}`, it.minutes, ii);
          else if (it.type === 'link') id = insert('INSERT INTO items (module_id, course_id, type, title, content, url, position) VALUES (?,?,?,?,?,?,?)', ...base, 'Recurso externo recomendado para profundizar.', it.url, ii);
          else id = insert('INSERT INTO items (module_id, course_id, type, title, content, file_name, file_path, position) VALUES (?,?,?,?,?,?,?,?)', ...base,
            'Documento oficial del curso: competencias, unidades, cronograma y sistema de evaluación.', `Silabo-${c.code}.pdf`, pdfName, ii);
          allItems.push({ id, unit: ui });
        });
      });

      // Item progress
      for (const sid of students) {
        const diligence = sid === demoStudent ? 1 : 0.55 + rand() * 0.45;
        for (const it of allItems) {
          let done;
          if (sid === demoStudent) done = it.unit < 2 || (it.unit === 2 && allItems.filter((x) => x.unit === 2).indexOf(it) < 1);
          else done = it.unit < 2 ? rand() < diligence : it.unit === 2 ? rand() < diligence * 0.4 : false;
          if (done) insert('INSERT INTO item_progress (user_id, item_id, completed_at) VALUES (?,?,?)', sid, it.id, limaAt(-Math.floor(rand() * 20) - 1, 21, 0));
        }
      }

      // Assignments & submissions
      for (const a of c.assignments) {
        const due = limaAt(a.due, 23, 59);
        const aId = insert('INSERT INTO assignments (course_id, module_id, title, instructions, due_at, points, created_at, category_id, rubric) VALUES (?,?,?,?,?,20,?,?,?)',
          courseId, moduleIds[a.unit], a.title, a.instructions, due, limaAt(a.due - 10, 9, 0), catId[a.cat] || null, JSON.stringify(a.rubric || []));
        const past = new Date(due).getTime() < nowMs;
        const lastPast = past && !c.assignments.some((b) => b !== a && b.due < 0 && b.due > a.due);
        for (const sid of students) {
          const isDemo = sid === demoStudent;
          if (past) {
            if (!isDemo && rand() < 0.08) continue; // didn't submit
            const grade = isDemo ? 15 + Math.floor(rand() * 4) : 10 + Math.floor(rand() * 10);
            const ungraded = lastPast && !isDemo && rand() < 0.35;
            insert('INSERT INTO submissions (assignment_id, user_id, body, submitted_at, grade, feedback, graded_at) VALUES (?,?,?,?,?,?,?)',
              aId, sid, isDemo ? 'Adjunto mi trabajo. Incluí una sección extra con ejemplos de mi entorno laboral.' : 'Entrego mi trabajo, quedo atento(a) a sus comentarios.',
              limaAt(a.due - 1 - Math.floor(rand() * 3), 20 + Math.floor(rand() * 3), 15),
              ungraded ? null : grade,
              ungraded ? null : pick(['Buen trabajo, se nota el esfuerzo. Revisa la ortografía en la conclusión.', 'Excelente análisis. Sigue así.', 'Cumple con lo solicitado; puedes profundizar más en los ejemplos.', 'Muy completo y bien organizado. ¡Felicitaciones!']),
              ungraded ? null : limaAt(a.due + 2, 10, 0));
          } else if (!isDemo && a.due < 15 && rand() < 0.4) {
            insert('INSERT INTO submissions (assignment_id, user_id, body, submitted_at) VALUES (?,?,?,?)', aId, sid,
              'Envío mi avance de la tarea. Quedo atento(a) a la retroalimentación.', limaAt(-Math.floor(rand() * 2), 18, 30));
          }
        }
      }

      // Quizzes & attempts
      for (const q of c.quizzes) {
        const due = limaAt(q.due, 23, 59);
        const qId = insert('INSERT INTO quizzes (course_id, module_id, title, description, available_from, due_at, time_limit_min, max_attempts, points, category_id) VALUES (?,?,?,?,?,?,?,?,20,?)',
          courseId, moduleIds[q.unit], q.title, `Evaluación de la ${c.units[q.unit].title.split(' · ')[0]}. Tienes ${q.time} minutos y ${q.attempts} intento(s). Se considera tu mejor nota.`,
          limaAt(q.due - 9, 8, 0), due, q.time, q.attempts, catId[q.cat] || null);
        const qs = q.questions.map(([type, prompt, options, correct, explanation], i) => {
          const opts = type === 'truefalse' ? ['Verdadero', 'Falso'] : options;
          const id = insert('INSERT INTO quiz_questions (quiz_id, type, prompt, options, correct, explanation, points, position) VALUES (?,?,?,?,?,?,1,?)',
            qId, type, prompt, JSON.stringify(opts), JSON.stringify(correct), explanation, i);
          return { id, type, correct, n: opts.length };
        });
        const past = new Date(due).getTime() < nowMs;
        for (const sid of students) {
          const isDemo = sid === demoStudent;
          if (!past && (isDemo || rand() > 0.3)) continue;
          if (past && !isDemo && rand() < 0.1) continue;
          const skill = isDemo ? 0.85 : 0.5 + rand() * 0.5;
          const answers = {};
          let ok = 0;
          for (const x of qs) {
            const right = rand() < skill;
            if (right) { answers[x.id] = x.type === 'multiple' ? x.correct : x.correct[0]; ok++; }
            else answers[x.id] = x.type === 'multiple' ? [x.correct[0]] : (x.correct[0] + 1) % x.n;
          }
          if (isDemo && ok === qs.length) { /* keep a realistic, not perfect, score */ const x = qs[qs.length - 1]; answers[x.id] = x.type === 'multiple' ? [x.correct[0]] : (x.correct[0] + 1) % x.n; ok--; }
          const at = past ? limaAt(q.due - 2, 20, 10) : limaAt(0, 9, 0);
          insert('INSERT INTO quiz_attempts (quiz_id, user_id, answers, score, started_at, submitted_at) VALUES (?,?,?,?,?,?)',
            qId, sid, JSON.stringify(answers), Math.round((ok / qs.length) * 200) / 10, at, new Date(new Date(at).getTime() + (5 + rand() * 8) * 60e3).toISOString());
        }
      }

      // Forums
      const who = (a) => (a === 't' ? tId : students[Number(a.slice(1))] ?? students[0]);
      for (const fo of c.forums) {
        const fId = insert('INSERT INTO forums (course_id, title, description, created_at) VALUES (?,?,?,?)', courseId, fo.title, fo.description, limaAt(termStartOffset, 8, 0));
        for (const th of fo.threads) {
          const tid = insert('INSERT INTO threads (forum_id, author_id, title, body, pinned, created_at) VALUES (?,?,?,?,?,?)',
            fId, who(th.author), th.title, th.body, th.pinned ? 1 : 0, limaAt(th.days, 18, 20));
          th.posts.forEach(([a, body], i) => insert('INSERT INTO posts (thread_id, author_id, body, created_at) VALUES (?,?,?,?)',
            tid, who(a), body, limaAt(Math.min(th.days + i + 1, 0), 9 + i * 3, 5)));
        }
      }

      // Live sessions: weekly, from term start to +3 weeks
      let n = 1;
      const pastSessions = [];
      for (let d = termStartOffset; d <= 21; d++) {
        const weekday = (((wd + d) % 7) + 7) % 7;
        if (!c.days.includes(weekday)) continue;
        const starts = limaAt(d, c.hour, 0);
        const sid = insert('INSERT INTO live_sessions (course_id, title, description, starts_at, duration_min, meeting_url, recording_url) VALUES (?,?,?,?,?,?,?)',
          courseId, `Sesión ${n++} · ${c.units[Math.min(Math.floor((d - termStartOffset) / 21), c.units.length - 1)].title.split(' · ')[1]}`,
          'Clase en vivo por videoconferencia. Ingresa 5 minutos antes con audífonos.', starts, 90,
          `https://meet.jit.si/ISUP-${c.code}-${termName}`, d < -1 ? `https://meet.jit.si/ISUP-${c.code}-${termName}/grabacion-${n - 1}` : null);
        if (d < 0) pastSessions.push({ id: sid, d });
      }
      // Registro de asistencia de las sesiones ya dictadas (la última queda pendiente de registrar por el docente)
      pastSessions.slice(0, -1).forEach((se) => {
        for (const sid of students) {
          const isDemo = sid === demoStudent;
          const r = rand();
          // Un estudiante por curso con muchas faltas para mostrar la alerta de inasistencia (> 30 %)
          const risky = sid === students[3];
          const status = isDemo ? (r < 0.9 ? 'presente' : 'tardanza') : risky ? (r < 0.45 ? 'falta' : 'presente') : r < 0.84 ? 'presente' : r < 0.92 ? 'tardanza' : r < 0.965 ? 'falta' : 'justificada';
          insert('INSERT INTO attendance (session_id, user_id, status, note, recorded_by, recorded_at) VALUES (?,?,?,?,?,?)',
            se.id, sid, status, status === 'justificada' ? 'Certificado médico presentado' : null, tId, limaAt(se.d, c.hour + 2, 0));
        }
      });
      if (c.code === 'DSI-301') {
        // A session happening right now so the "En vivo" experience can be tried
        const live = new Date(Math.floor((nowMs - 15 * 60e3) / 300e3) * 300e3).toISOString();
        insert('INSERT INTO live_sessions (course_id, title, description, starts_at, duration_min, meeting_url) VALUES (?,?,?,?,?,?)',
          courseId, 'Asesoría en vivo · Dudas de la Tarea 3', 'Sesión abierta para resolver dudas sobre la API REST.', live, 120, `https://meet.jit.si/ISUP-${c.code}-asesoria`);
      }

      // Announcements
      for (const an of c.announcements) {
        insert('INSERT INTO announcements (course_id, author_id, title, body, pinned, created_at) VALUES (?,?,?,?,?,?)',
          courseId, tId, an.title, an.body, an.pinned ? 1 : 0, an.days === 0 ? new Date(nowMs - 2 * 3600e3).toISOString() : limaAt(an.days, 10, 0));
      }
    }

    /* Periodo anterior: cursos cerrados con acta para el récord académico */
    for (const pc of PREVIOUS_TERM) {
      const tId = teacherId[pc.teacher];
      const cid = insert(
        `INSERT INTO courses (code, name, description, program_id, term_id, teacher_id, cycle, credits, color, schedule, syllabus, module_name, course_type, hours_theory, hours_practice, status, closed_at, closed_by)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'open',NULL,NULL)`,
        pc.code, pc.name, pc.description, programId['desarrollo-de-sistemas'], prevTermId, tId, 2, pc.credits, pc.color, pc.schedule,
        `Unidad didáctica de ${pc.credits} créditos del ciclo 2.`, pc.module, pc.type || 'especifica', pc.credits * 8, pc.credits * 16
      );
      const cats = [['proceso', 'Evaluación de proceso', 40], ['producto', 'Evaluación de producto', 30], ['final', 'Evaluación final', 30]]
        .map(([k, nme, w], i) => [k, insert('INSERT INTO grade_categories (course_id, name, weight, position) VALUES (?,?,?,?)', cid, nme, w, i)]);
      const catOf = Object.fromEntries(cats);
      const mId = insert('INSERT INTO modules (course_id, title, description, position, start_date) VALUES (?,?,?,1,?)', cid, 'Unidad 1 · Contenidos del curso', 'Material archivado del periodo anterior.', limaAt(prevStart, 0, 0));
      insert('INSERT INTO items (module_id, course_id, type, title, content, duration_min, position) VALUES (?,?,?,?,?,?,0)', mId, cid, 'reading', 'Resumen del curso', 'Este curso pertenece a un periodo cerrado. El material queda disponible solo para consulta.', 10);
      insert('INSERT INTO forums (course_id, title, description) VALUES (?,?,?)', cid, 'Foro de consultas', 'Foro archivado.');
      for (const sid of dsiStudents) insert('INSERT INTO enrollments (course_id, user_id, last_access, created_at) VALUES (?,?,?,?)', cid, sid, limaAt(prevStart + 100, 20, 0), limaAt(prevStart - 5, 10, 0));
      // Actividades calificadas por criterio
      const acts = [['proceso', 'Tarea 1', -95], ['proceso', 'Tarea 2', -80], ['producto', 'Proyecto de unidad', -65], ['final', 'Examen final', -50]];
      for (const [k, title, dd] of acts) {
        const aId = insert('INSERT INTO assignments (course_id, module_id, title, instructions, due_at, points, created_at, category_id) VALUES (?,?,?,?,?,20,?,?)',
          cid, mId, `${title} · ${pc.name}`, 'Actividad del periodo anterior.', limaAt(prevStart + 112 + dd + 95, 23, 59), limaAt(prevStart + 100 + dd + 95, 9, 0), catOf[k]);
        for (const sid of dsiStudents) {
          const isDemo = sid === demoStudent;
          const base = isDemo ? pc.demoGrade : 9 + Math.floor(rand() * 11);
          const grade = Math.max(0, Math.min(20, base + Math.floor(rand() * 5) - 2));
          insert('INSERT INTO submissions (assignment_id, user_id, body, submitted_at, grade, feedback, graded_at, graded_by) VALUES (?,?,?,?,?,?,?,?)',
            aId, sid, 'Entrega del periodo anterior.', limaAt(prevStart + 110 + dd + 95, 20, 0), grade, 'Calificado.', limaAt(prevStart + 113 + dd + 95, 10, 0), tId);
        }
      }
      // Sesiones y asistencia del periodo anterior
      for (let w = 0; w < 14; w++) {
        const sid = insert('INSERT INTO live_sessions (course_id, title, description, starts_at, duration_min, meeting_url) VALUES (?,?,?,?,?,?)',
          cid, `Sesión ${w + 1}`, 'Clase en vivo (periodo anterior).', limaAt(prevStart + w * 7 + 1, 19, 0), 90, `https://meet.jit.si/ISUP-${pc.code}-${prevName}`);
        for (const st of dsiStudents) {
          const r = rand();
          insert('INSERT INTO attendance (session_id, user_id, status, recorded_by, recorded_at) VALUES (?,?,?,?,?)', sid, st, st === demoStudent ? (r < 0.93 ? 'presente' : 'tardanza') : r < 0.8 ? 'presente' : r < 0.9 ? 'tardanza' : 'falta', tId, limaAt(prevStart + w * 7 + 1, 21, 0));
        }
      }
      // Cierre del acta (nota final, condición y recuperación quedan congeladas)
      const course = get('SELECT * FROM courses WHERE id = ?', cid);
      closeActa(course, tId);
      run('UPDATE courses SET closed_at = ? WHERE id = ?', limaAt(prevStart + 7 * 16 + 3, 12, 0), cid);
      run('UPDATE final_grades SET closed_at = ? WHERE course_id = ?', limaAt(prevStart + 7 * 16 + 3, 12, 0), cid);
    }

    /* Global announcements */
    const adminId = get("SELECT id FROM users WHERE role = 'admin'").id;
    insert('INSERT INTO announcements (course_id, author_id, title, body, pinned, created_at) VALUES (NULL,?,?,?,1,?)', adminId,
      'Semana de evaluaciones parciales',
      'La próxima semana se desarrollan las evaluaciones parciales. Verifica que tu cámara, micrófono y Google Chrome estén actualizados. Si tienes problemas técnicos escríbenos desde **Ayuda y soporte**.', limaAt(-1, 9, 0));
    insert('INSERT INTO announcements (course_id, author_id, title, body, pinned, created_at) VALUES (NULL,?,?,?,0,?)', adminId,
      `¡Bienvenidos al ciclo ${termName}!`,
      'Les damos la bienvenida a un nuevo ciclo en ISUP. Recuerda completar tu checklist de inicio y revisar el sílabo de cada curso.', limaAt(termStartOffset, 8, 0));

    /* Institutional calendar */
    const ev = (title, description, d, end, type = 'institutional') => insert('INSERT INTO events (title, description, date, end_date, type) VALUES (?,?,?,?,?)', title, description, limaDate(d), end != null ? limaDate(end) : null, type);
    ev(`Inicio de clases ${termName}`, 'Primer día de clases del ciclo.', termStartOffset, null, 'academic');
    ev('Evaluaciones parciales', 'Semana de evaluaciones parciales supervisadas.', termStartOffset + 56, termStartOffset + 60, 'exam');
    ev('Feria virtual de empleabilidad', 'Empresas aliadas presentan ofertas de prácticas y empleo.', termStartOffset + 66, null, 'event');
    ev('Fecha límite de retiro de cursos', 'Último día para solicitar el retiro de un curso sin afectar tu promedio.', termStartOffset + 70, null, 'academic');
    ev('Evaluaciones finales', 'Semana de evaluaciones finales.', termStartOffset + 105, termStartOffset + 109, 'exam');
    ev('Cierre de notas', 'Publicación de notas finales del ciclo.', termStartOffset + 112, null, 'academic');
    ev('Matrícula del siguiente ciclo', 'Proceso de matrícula en línea.', termStartOffset + 115, termStartOffset + 126, 'academic');

    /* Applicants & tickets */
    for (const [name, dni, email, phone, prog, msg, status, d] of APPLICANTS) {
      insert('INSERT INTO applicants (full_name, dni, email, phone, program_id, message, status, created_at) VALUES (?,?,?,?,?,?,?,?)',
        name, dni, email, phone, programId[prog], msg, status, limaAt(d, 11, 30));
    }
    insert("INSERT INTO tickets (user_id, category, subject, message, status, response, created_at, updated_at) VALUES (?,?,?,?,'resuelto',?,?,?)",
      demoStudent, 'Aula virtual', 'No puedo ver el video de la Unidad 1',
      'Al abrir el video de la Unidad 1 de Desarrollo Web me sale una pantalla negra.',
      'Hola Valeria, el problema era la versión del navegador. Actualiza Google Chrome a la última versión y el video cargará correctamente. ¡Gracias por escribirnos!',
      limaAt(-30, 21, 0), limaAt(-29, 9, 30));
    insert("INSERT INTO tickets (user_id, category, subject, message, status, created_at) VALUES (?,?,?,?,'abierto',?)",
      studentId[3], 'Evaluaciones', 'Se cortó mi internet durante el cuestionario', 'Se me fue la conexión a mitad del cuestionario 1 de Base de Datos. ¿Puedo dar otro intento?', limaAt(-1, 22, 10));

    /* Notifications for the demo accounts */
    const N = (uid, type, title, body, link, d, read) => insert('INSERT INTO notifications (user_id, type, title, body, link, created_at, read_at) VALUES (?,?,?,?,?,?,?)',
      uid, type, title, body, link, d, read ? d : null);
    const dsi301 = get("SELECT id FROM courses WHERE code = 'DSI-301'").id;
    const dsi302 = get("SELECT id FROM courses WHERE code = 'DSI-302'").id;
    const t2 = get("SELECT id FROM assignments WHERE course_id = ? AND title LIKE 'Tarea 2%'", dsi301).id;
    const t3 = get("SELECT id FROM assignments WHERE course_id = ? AND title LIKE 'Tarea 3%'", dsi301).id;
    N(demoStudent, 'session', 'Tu clase de Desarrollo Web está en vivo', 'Asesoría en vivo · Dudas de la Tarea 3', `/app/cursos/${dsi301}/sesiones`, new Date(nowMs - 10 * 60e3).toISOString(), false);
    N(demoStudent, 'announcement', 'Anuncio · Desarrollo Web Full Stack', 'Sesión de hoy: conectamos frontend y API', `/app/cursos/${dsi301}`, new Date(nowMs - 2 * 3600e3).toISOString(), false);
    N(demoStudent, 'assignment', 'Vence en 3 días: Tarea 3 · API REST de tareas', 'Desarrollo Web Full Stack', `/app/cursos/${dsi301}/tareas/${t3}`, limaAt(0, 8, 0), false);
    N(demoStudent, 'grade', 'Calificación publicada · Tarea 2 · Landing page responsive', 'Desarrollo Web Full Stack', `/app/cursos/${dsi301}/tareas/${t2}`, limaAt(-3, 10, 0), true);
    N(demoStudent, 'announcement', 'Anuncio · Base de Datos Relacionales', 'Material extra: base de datos de práctica', `/app/cursos/${dsi302}`, limaAt(-4, 10, 0), true);
    N(teacherId.carla, 'submission', 'Tienes entregas por calificar', 'Tarea 3 · API REST de tareas', `/app/cursos/${dsi301}/tareas/${t3}`, limaAt(0, 7, 30), false);
    N(teacherId.carla, 'forum', 'Nuevo tema en Foro de consultas', 'Error CORS al conectar mi frontend con la API', `/app/cursos/${dsi301}/foros`, limaAt(-2, 18, 25), false);
    N(adminId, 'ticket', 'Nueva solicitud de soporte', 'Se cortó mi internet durante el cuestionario', '/app/admin/soporte', limaAt(-1, 22, 10), false);

    /* Auditoría de muestra */
    const A = (uid, action, entity, entityId, details, d) => insert('INSERT INTO audit_log (user_id, action, entity, entity_id, details, ip, created_at) VALUES (?,?,?,?,?,?,?)', uid, action, entity, entityId, details ? JSON.stringify(details) : null, '127.0.0.1', d);
    A(adminId, 'term.activate', 'term', termId, { name: termName }, limaAt(termStartOffset - 3, 9, 0));
    A(adminId, 'settings.update', 'settings', null, { changed: ['institution_name', 'min_grade'] }, limaAt(termStartOffset - 3, 9, 5));
    A(teacherId.carla, 'syllabus.update', 'course', dsi301, null, limaAt(termStartOffset - 1, 16, 0));
    A(teacherId.carla, 'attendance.record', 'session', null, { course_id: dsi301, records: 19 }, limaAt(-6, 21, 0));
    A(teacherId.carla, 'grade.set', 'submission', t2, { assignment_id: t2, to: 17 }, limaAt(-3, 10, 0));
    A(demoStudent, 'auth.login', 'user', demoStudent, null, limaAt(-1, 19, 30));
  });
}

/** Contraseña aleatoria legible (sin caracteres ambiguos) que cumple la política: letras y números. */
export function randomPassword(length = 14) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const bytes = crypto.randomBytes(length);
  let out = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
  if (!/\d/.test(out)) out = out.slice(0, -1) + '7';
  if (!/[A-Za-z]/.test(out)) out = 'K' + out.slice(1);
  return out;
}

/**
 * Semilla mínima para producción: configuración institucional, el periodo académico en curso y una
 * cuenta de administración con contraseña aleatoria, que se guarda una sola vez en data/ADMIN_INICIAL.txt.
 */
export function seedMinimal() {
  const email = (process.env.ISUP_ADMIN_EMAIL || 'admin@isup.edu.pe').trim().toLowerCase();
  const password = process.env.ISUP_ADMIN_PASSWORD || randomPassword();
  const institution = process.env.ISUP_INSTITUTION || DEFAULT_SETTINGS.institution_name;
  const short = process.env.ISUP_SHORT || DEFAULT_SETTINGS.institution_short;
  const now = new Date();
  const year = now.getFullYear();
  const first = now.getMonth() < 6;
  const start = first ? `${year}-03-01` : `${year}-08-01`;
  const end = first ? `${year}-07-15` : `${year}-12-15`;
  tx(() => {
    for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) setSetting(k, v);
    setSetting('institution_name', institution);
    setSetting('institution_short', short);
    insert('INSERT INTO terms (name, start_date, end_date, weeks, is_active) VALUES (?,?,?,16,1)', `${year}-${first ? 'I' : 'II'}`, start, end);
    insert(
      "INSERT INTO users (code, email, password_hash, first_name, last_name, role, title, avatar_color, onboarding) VALUES (?,?,?,?,?,'admin',?,?,?)",
      `A00${String(year).slice(2)}0001`, email, bcrypt.hashSync(password, 10), 'Administración', short, 'Secretaría Académica', '#3D3929', '{"done":true}'
    );
  });
  const file = path.join(path.dirname(UPLOADS_DIR), 'ADMIN_INICIAL.txt');
  fs.writeFileSync(file, `ISUP Aula Virtual - cuenta de administración inicial\n\nCorreo:      ${email}\nContraseña:  ${password}\n\nCambia esta contraseña en Mi perfil después del primer ingreso y elimina este archivo.\n`, { mode: 0o600 });
  console.log(`Cuenta de administración creada: ${email} (contraseña guardada en ${file})`);
  return { email, password, file };
}

export function resetDatabase() {
  const tables = all("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").map((t) => t.name);
  db.exec('PRAGMA foreign_keys = OFF');
  for (const t of tables) db.exec(`DROP TABLE IF EXISTS "${t}"`);
  db.exec('PRAGMA foreign_keys = ON');
  db.exec(SCHEMA);
  for (const f of fs.readdirSync(UPLOADS_DIR)) fs.rmSync(path.join(UPLOADS_DIR, f), { force: true });
  seed();
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--reset') || !get('SELECT COUNT(*) n FROM users').n) {
    resetDatabase();
    const counts = ['users', 'courses', 'items', 'assignments', 'submissions', 'quizzes', 'quiz_attempts', 'threads', 'live_sessions'].map((t) => `${t}: ${get(`SELECT COUNT(*) n FROM ${t}`).n}`);
    console.log('Datos de demostración cargados →', counts.join(' · '));
  } else {
    console.log('La base ya tiene datos. Usa --reset para reiniciarla.');
  }
}
