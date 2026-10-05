import bcrypt from 'bcryptjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db, SCHEMA, insert, run, get, all, tx, UPLOADS_DIR } from './db.js';
import { PROGRAMS, TEACHERS, STUDENTS, COURSES, APPLICANTS } from './seed-data.js';

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
        'INSERT INTO programs (slug, name, short, description, duration, modality, icon, color, profile, field, area, image, curriculum) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
        p.slug, p.name, p.short, p.description, p.duration, p.modality, p.icon, p.color, p.profile, p.field, p.area, p.image, JSON.stringify(curriculum)
      );
    }

    /* Term: started 7 weeks ago (Monday) */
    const wd = limaWeekday();
    const toMonday = (wd + 6) % 7;
    const termStartOffset = -toMonday - 49;
    const startDate = limaDate(termStartOffset);
    const year = Number(startDate.slice(0, 4));
    const termName = `${year}-${Number(startDate.slice(5, 7)) < 7 ? 'I' : 'II'}`;
    const termId = insert('INSERT INTO terms (name, start_date, end_date, is_active) VALUES (?,?,?,1)', termName, startDate, limaDate(termStartOffset + 7 * 16 - 2));

    /* Users */
    insert(
      "INSERT INTO users (code, email, password_hash, first_name, last_name, role, title, avatar_color, phone, onboarding) VALUES (?,?,?,?,?,'admin',?,?,?,?)",
      'A00260001', 'admin@isup.edu.pe', hash, 'Lucía', 'Paredes Montoya', 'Coordinadora Académica', '#3D3929', '01 640 5000', '{"done":true}'
    );
    const teacherId = {};
    let tn = 1;
    for (const [key, t] of Object.entries(TEACHERS)) {
      teacherId[key] = insert(
        "INSERT INTO users (code, email, password_hash, first_name, last_name, role, title, avatar_color, bio, onboarding, last_login) VALUES (?,?,?,?,?,'teacher',?,?,?,?,?)",
        `D0026${String(tn++).padStart(4, '0')}`, t.email, hash, t.first, t.last, t.title, t.color,
        `Docente de ISUP. ${t.title}.`, '{"done":true}', limaAt(-1, 20, 0)
      );
    }
    const colors = ['#C96442', '#5B7B6F', '#6A5ACD', '#B8860B', '#2F6F8F', '#8B4C6B', '#4F6D3A', '#A0522D'];
    const studentId = [];
    STUDENTS.forEach(([first, last, email], i) => {
      const isAdm = i >= 19;
      const plain = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(' ')[0];
      const mail = email || `${plain(first)}.${plain(last)}@isup.edu.pe`;
      studentId.push(insert(
        "INSERT INTO users (code, email, password_hash, first_name, last_name, role, program_id, cycle, avatar_color, phone, onboarding, last_login) VALUES (?,?,?,?,?,'student',?,3,?,?,?,?)",
        `N0026${String(i + 1).padStart(4, '0')}`, mail, hash, first, last,
        programId[isAdm ? 'administracion-de-empresas' : 'desarrollo-de-sistemas'], colors[i % colors.length],
        `9${String(10000000 + Math.floor(rand() * 89999999)).slice(0, 8)}`,
        i === 0 ? '{"internet":true,"chrome":true}' : '{"done":true}', limaAt(-Math.floor(rand() * 5), 19, 30)
      ));
    });
    const demoStudent = studentId[0];
    const dsiStudents = studentId.slice(0, 19);
    const admStudents = studentId.slice(19);

    /* Courses */
    const nowMs = Date.now();
    for (const c of COURSES) {
      const tId = teacherId[c.teacher];
      const syllabus = `Curso de ${c.credits} créditos del ciclo ${c.cycle}. ${c.description}`;
      const courseId = insert(
        'INSERT INTO courses (code, name, description, program_id, term_id, teacher_id, cycle, credits, color, schedule, syllabus) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
        c.code, c.name, c.description, programId[c.program], termId, tId, c.cycle, c.credits, c.color, c.schedule, syllabus
      );
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
        ['Evaluación', 'Promedio simple de tareas y cuestionarios en escala vigesimal (0 a 20). Nota mínima aprobatoria: 13.'],
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
        const aId = insert('INSERT INTO assignments (course_id, module_id, title, instructions, due_at, points, created_at) VALUES (?,?,?,?,?,20,?)',
          courseId, moduleIds[a.unit], a.title, a.instructions, due, limaAt(a.due - 10, 9, 0));
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
        const qId = insert('INSERT INTO quizzes (course_id, module_id, title, description, available_from, due_at, time_limit_min, max_attempts, points) VALUES (?,?,?,?,?,?,?,?,20)',
          courseId, moduleIds[q.unit], q.title, `Evaluación de la ${c.units[q.unit].title.split(' · ')[0]}. Tienes ${q.time} minutos y ${q.attempts} intento(s). Se considera tu mejor nota.`,
          limaAt(q.due - 9, 8, 0), due, q.time, q.attempts);
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
      for (let d = termStartOffset; d <= 21; d++) {
        const weekday = (((wd + d) % 7) + 7) % 7;
        if (!c.days.includes(weekday)) continue;
        const starts = limaAt(d, c.hour, 0);
        insert('INSERT INTO live_sessions (course_id, title, description, starts_at, duration_min, meeting_url, recording_url) VALUES (?,?,?,?,?,?,?)',
          courseId, `Sesión ${n++} · ${c.units[Math.min(Math.floor((d - termStartOffset) / 21), c.units.length - 1)].title.split(' · ')[1]}`,
          'Clase en vivo por videoconferencia. Ingresa 5 minutos antes con audífonos.', starts, 90,
          `https://meet.jit.si/ISUP-${c.code}-${termName}`, null);
      }
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
  });
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
