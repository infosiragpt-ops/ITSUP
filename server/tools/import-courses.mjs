#!/usr/bin/env node
/**
 * Importa el catálogo de cursos (deploy/catalogo) al aula virtual: crea o actualiza cada curso ofertado
 * (carrera × ciclo × código) en el periodo activo, con su sílabo, criterios de evaluación, 4 unidades con
 * diapositivas (PowerPoint generado), lectura, caso de estudio, tarea con rúbrica, cuestionario, 16 sesiones
 * en vivo y foro de consultas.
 *
 *   node server/tools/import-courses.mjs [deploy/catalogo] [--rehacer] [--solo slug1,slug2]
 *
 * Idempotente: un curso ya existente conserva su contenido (el docente puede haberlo editado); solo se
 * actualizan sus datos generales, el sílabo y los archivos de diapositivas. Con --rehacer se vuelve a crear
 * todo el contenido de los cursos del catálogo sin actividad de estudiantes (entregas, intentos, avance ni asistencia).
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith('--')));
const only = (args.find((a) => a.startsWith('--solo=')) || '').slice(7).split(',').filter(Boolean);
const dir = args.find((a) => !a.startsWith('--')) || path.resolve(new URL('../../deploy/catalogo', import.meta.url).pathname);
if (typeof process.getuid === 'function' && process.getuid() === 0 && !process.env.ISUP_ALLOW_ROOT) {
  console.error('No ejecutes esta herramienta como root. En el servidor usa: sudo isup-cursos');
  process.exit(1);
}
const { get, run, insert, all, tx, settings, UPLOADS_DIR, DATA_DIR } = await import('../db.js');
const { validate } = await import('../../deploy/catalogo/validar.mjs');
const { buildUnitDeck } = await import('./build-pptx.mjs');
const { autoEnrollAll } = await import('../enrollment.js');

const index = JSON.parse(fs.readFileSync(path.join(dir, 'cursos-index.json'), 'utf8'));
const term = get('SELECT * FROM terms WHERE is_active = 1 ORDER BY id DESC');
if (!term) { console.error('No hay un periodo académico activo: créalo en Gestión académica → Periodos.'); process.exit(1); }
const inst = settings();
const SHORT = inst.institution_short || 'TEPSUP';
const LIMA = 5; // UTC-5

const termStart = new Date(`${term.start_date}T12:00:00Z`);
// Semana 1 = primer lunes a partir de la fecha de inicio del periodo
const monday1 = new Date(termStart); monday1.setUTCDate(monday1.getUTCDate() + ((8 - monday1.getUTCDay()) % 7));
const limaAt = (dayOffset, hour, minute = 0) => new Date(Date.UTC(monday1.getUTCFullYear(), monday1.getUTCMonth(), monday1.getUTCDate() + dayOffset, hour + LIMA, minute)).toISOString();
const dateOf = (dayOffset) => limaAt(dayOffset, 12).slice(0, 10);
const DAY = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes'];
const DAY_SHORT = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie'];
const hashInt = (s, mod) => parseInt(crypto.createHash('md5').update(s).digest('hex').slice(0, 8), 16) % mod;
const md = (s) => String(s || '').trim();

let created = 0, updated = 0, skipped = 0, decks = 0;
const problems = [];
// Huella del contenido de cada presentación generada: solo se regenera cuando cambia el paquete
const stampsFile = path.join(DATA_DIR, 'catalogo-diapositivas.json');
let stamps = {};
try { stamps = JSON.parse(fs.readFileSync(stampsFile, 'utf8')); } catch {}
const saveStamps = () => fs.writeFileSync(stampsFile, JSON.stringify(stamps, null, 1));

const TRANSVERSAL = /^(Comunicación Efectiva|Herramientas Digitales para el Trabajo|Inglés para el Trabajo|Investigación e Innovación Tecnológica|Emprendimiento e Innovación|Comportamiento Ético|Ética Profesional$)/;
let shells = 0;
/** Curso base del plan de estudios mientras su paquete académico completo está en elaboración. */
function createShell(entry) {
  for (const off of entry.offerings) {
    const program = get('SELECT id, name, color FROM programs WHERE slug = ?', off.program_slug);
    if (!program) { problems.push(`${off.code}: la carrera ${off.program_slug} no existe (ejecuta isup-carreras)`); continue; }
    if (get('SELECT 1 x FROM courses WHERE code = ? AND term_id = ?', off.code, term.id)) continue;
    const type = /^Experiencias Formativas/.test(entry.name) ? 'efsrt' : TRANSVERSAL.test(entry.name) ? 'empleabilidad' : 'especifica';
    const day = hashInt(off.code, 5);
    const [hh, mm] = hashInt(`${off.code}:h`, 2) === 0 ? [19, 0] : [20, 45];
    const schedule = `${DAY_SHORT[day]} ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}–${hh === 19 ? '20:30' : '22:15'}`;
    const summary = `Unidad didáctica del ciclo ${off.cycle} de la carrera de ${program.name} (modalidad 100 % virtual). El sílabo completo, las diapositivas, lecturas, casos, tareas y cuestionarios se publican en el aula conforme se completa el diseño instruccional del curso.`;
    tx(() => {
      const cid = insert(`INSERT INTO courses (code, term_id, teacher_id, min_grade, max_absence_pct, name, description, program_id, cycle, credits, color, schedule, course_type, hours_theory, hours_practice, syllabus_json)
        VALUES (?, ?, NULL, 13, 30, ?, ?, ?, ?, 3, ?, ?, ?, 32, 32, ?)`,
        off.code, term.id, entry.name, summary, program.id, off.cycle, program.color || '#C96442', schedule, type, JSON.stringify({ summary, catalog_shell: true }));
      [['Evaluación de proceso', 40], ['Evaluación de producto', 30], ['Evaluación final', 30]].forEach(([n, w], i) =>
        insert('INSERT INTO grade_categories (course_id, name, weight, position) VALUES (?,?,?,?)', cid, n, w, i));
      insert('INSERT INTO forums (course_id, title, description) VALUES (?,?,?)', cid, 'Foro de consultas', 'Publica aquí tus dudas sobre el curso; el docente y tus compañeros responden.');
    });
    shells++;
  }
}

for (const entry of index.courses) {
  if (only.length && !only.includes(entry.slug)) continue;
  const file = path.join(dir, 'cursos', `${entry.slug}.json`);
  if (!fs.existsSync(file)) { createShell(entry); continue; }
  let pkg;
  try { pkg = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { problems.push(`${entry.slug}: JSON inválido (${e.message})`); continue; }
  const errors = validate(pkg, file);
  if (errors.length) { problems.push(`${entry.slug}: ${errors.length} error(es) de validación (${errors[0]})`); continue; }

  // Diapositivas compartidas por todas las ofertas del curso (mismo contenido): catalogo-<slug>-uN.pptx
  const deckFiles = [];
  const contentHash = crypto.createHash('sha1').update(JSON.stringify(pkg.units.map((u) => [u.title, u.description, u.topics, u.slides, u.case, u.assignment, u.quiz, u.reading.title])) + JSON.stringify(pkg.bibliography)).digest('hex').slice(0, 12);
  for (let i = 0; i < pkg.units.length; i++) {
    const name = `catalogo-${pkg.slug}-u${i + 1}.pptx`;
    const out = path.join(UPLOADS_DIR, name);
    if (!fs.existsSync(out) || stamps[name] !== contentHash) {
      await buildUnitDeck(pkg, i, out, { institution: SHORT, program: entry.offerings.map((o) => o.program).filter((v, k, a) => a.indexOf(v) === k).join(' / '), code: entry.offerings.length === 1 ? entry.offerings[0].code : '' });
      stamps[name] = contentHash;
      saveStamps();
      decks++;
    }
    deckFiles.push({ file_path: name, file_name: `${SHORT} · ${pkg.name} · Unidad ${i + 1}.pptx` });
  }

  for (const off of entry.offerings) {
    const program = get('SELECT id, name, color FROM programs WHERE slug = ?', off.program_slug);
    if (!program) { problems.push(`${off.code}: la carrera ${off.program_slug} no existe (ejecuta isup-carreras)`); continue; }
    const existing = get('SELECT * FROM courses WHERE code = ? AND term_id = ?', off.code, term.id);
    // Horario: día y hora deterministas por código (clases virtuales en la noche)
    const day = hashInt(off.code, 5);
    const slot = hashInt(`${off.code}:h`, 2);
    const [hh, mm] = slot === 0 ? [19, 0] : [20, 45];
    const schedule = `${DAY_SHORT[day]} ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}–${String(hh + 1).padStart(2, '0')}:${String(mm + 30).padStart(2, '0')}`.replace(':75', ':15').replace('21:75', '22:15');
    const syllabus = {
      summary: md(pkg.summary), competency: md(pkg.competency), capacities: pkg.capacities.map(md), indicators: pkg.indicators.map(md),
      methodology: md(pkg.methodology), bibliography: pkg.bibliography.map(md),
      resources: [`Aula Virtual ${SHORT} (diapositivas, lecturas, casos, tareas, cuestionarios y foros)`, 'Sesiones en vivo por videoconferencia', 'Biblioteca virtual y bases de datos académicas'],
      weekly_plan: pkg.weekly_plan,
    };
    const courseFields = {
      name: pkg.name, description: md(pkg.summary).split(/(?<=\.)\s/)[0], program_id: program.id, cycle: off.cycle, credits: pkg.credits,
      color: program.color || '#C96442', schedule, module_name: md(pkg.module_name), course_type: pkg.course_type,
      hours_theory: pkg.hours_theory, hours_practice: pkg.hours_practice, syllabus_json: JSON.stringify(syllabus),
    };

    tx(() => {
      let courseId;
      let rebuild = false;
      if (existing) {
        run(`UPDATE courses SET ${Object.keys(courseFields).map((k) => `${k} = ?`).join(', ')} WHERE id = ?`, ...Object.values(courseFields), existing.id);
        courseId = existing.id;
        // Las matrículas (automáticas por carrera y ciclo) no bloquean el reemplazo: solo la actividad académica de los estudiantes
        const hasData = get('SELECT (SELECT COUNT(*) FROM submissions s JOIN assignments a ON a.id = s.assignment_id WHERE a.course_id = ?) + (SELECT COUNT(*) FROM quiz_attempts q JOIN quizzes z ON z.id = q.quiz_id WHERE z.course_id = ?) + (SELECT COUNT(*) FROM item_progress p JOIN items i ON i.id = p.item_id WHERE i.course_id = ?) + (SELECT COUNT(*) FROM attendance t JOIN live_sessions l ON l.id = t.session_id WHERE l.course_id = ?) n', courseId, courseId, courseId, courseId).n;
        const hasContent = get('SELECT COUNT(*) n FROM modules WHERE course_id = ?', courseId).n > 0;
        let wasShell = false;
        try { wasShell = !!JSON.parse(existing.syllabus_json || '{}').catalog_shell; } catch {}
        if ((flags.has('--rehacer') || wasShell) && !hasData) {
          for (const t of ['live_sessions', 'quizzes', 'assignments', 'items', 'modules', 'forums', 'grade_categories']) run(`DELETE FROM ${t} WHERE course_id = ?`, courseId);
          rebuild = true;
        } else if (!hasContent) {
          for (const t of ['forums', 'grade_categories']) run(`DELETE FROM ${t} WHERE course_id = ?`, courseId);
          rebuild = true;
        } else {
          // Conserva el contenido; refresca solo los archivos de diapositivas ya enlazados
          deckFiles.forEach((d) => run('UPDATE items SET file_name = ? WHERE course_id = ? AND type = ? AND file_path = ?', d.file_name, courseId, 'file', d.file_path));
        }
        if (!rebuild) updated++;
      } else {
        courseId = insert(`INSERT INTO courses (code, term_id, teacher_id, min_grade, max_absence_pct, ${Object.keys(courseFields).join(', ')}) VALUES (?, ?, NULL, 13, 30, ${Object.keys(courseFields).map(() => '?').join(', ')})`,
          off.code, term.id, ...Object.values(courseFields));
        rebuild = true;
        created++;
      }
      if (!rebuild) return;
      if (existing) updated++;

      const cats = pkg.evaluation.map((e, i) => insert('INSERT INTO grade_categories (course_id, name, weight, position) VALUES (?,?,?,?)', courseId, md(e.name), e.weight, i));
      const catProcess = cats[0];
      const catProduct = cats[1] || cats[0];
      insert('INSERT INTO forums (course_id, title, description) VALUES (?,?,?)', courseId, 'Foro de consultas', 'Publica aquí tus dudas sobre el curso; el docente y tus compañeros responden.');
      insert('INSERT INTO forums (course_id, title, description) VALUES (?,?,?)', courseId, 'Discusión de casos', 'Debate de los casos de estudio de cada unidad: argumenta con datos y cita las lecturas.');

      pkg.units.forEach((u, ui) => {
        const startDay = ui * 28;                 // lunes de la semana 4ui+1
        const endDay = startDay + 27;             // domingo de la semana 4ui+4
        const mId = insert('INSERT INTO modules (course_id, title, description, position, start_date) VALUES (?,?,?,?,?)', courseId, md(u.title), md(u.description), ui + 1, dateOf(startDay));
        let pos = 0;
        insert('INSERT INTO items (module_id, course_id, type, title, content, file_name, file_path, duration_min, position) VALUES (?,?,?,?,?,?,?,?,?)',
          mId, courseId, 'file', `Diapositivas · ${md(u.title)}`, `Presentación de la unidad (${u.slides.length + 5} diapositivas) con notas para el docente. Temas: ${u.topics.map(md).join('; ')}.`, deckFiles[ui].file_name, deckFiles[ui].file_path, 45, pos++);
        insert('INSERT INTO items (module_id, course_id, type, title, content, duration_min, position) VALUES (?,?,?,?,?,?,?)',
          mId, courseId, 'reading', md(u.reading.title), md(u.reading.content), u.reading.minutes, pos++);
        insert('INSERT INTO items (module_id, course_id, type, title, content, duration_min, position) VALUES (?,?,?,?,?,?,?)',
          mId, courseId, 'reading', md(u.case.title), `${md(u.case.content)}\n\n## Preguntas para el análisis\n\n${u.case.questions.map((q, i) => `${i + 1}. ${md(q)}`).join('\n')}`, 30, pos++);
        insert('INSERT INTO assignments (course_id, module_id, title, instructions, due_at, points, allow_late, category_id, rubric, created_at) VALUES (?,?,?,?,?,20,1,?,?,?)',
          courseId, mId, md(u.assignment.title), md(u.assignment.instructions), limaAt(endDay, 23, 59), catProduct, JSON.stringify(u.assignment.rubric.map((r) => ({ name: md(r.name), points: r.points }))), limaAt(startDay, 8, 0));
        const qId = insert('INSERT INTO quizzes (course_id, module_id, title, description, available_from, due_at, time_limit_min, max_attempts, points, category_id) VALUES (?,?,?,?,?,?,20,2,20,?)',
          courseId, mId, md(u.quiz.title), `Cuestionario de la unidad ${ui + 1}: ${u.quiz.questions.length} preguntas de opción única sobre las diapositivas, la lectura y el caso.`, limaAt(startDay + 21, 8, 0), limaAt(endDay, 23, 59), catProcess);
        u.quiz.questions.forEach((q, qi) => insert('INSERT INTO quiz_questions (quiz_id, type, prompt, options, correct, explanation, points, position) VALUES (?,?,?,?,?,?,1,?)',
          qId, 'single', md(q.prompt), JSON.stringify(q.options.map(md)), JSON.stringify([q.correct]), md(q.explanation), qi));
      });
      pkg.weekly_plan.forEach((w, i) => {
        insert('INSERT INTO live_sessions (course_id, title, description, starts_at, duration_min) VALUES (?,?,?,?,90)',
          courseId, `Semana ${w.week} · ${md(w.topic)}`, `${md(w.activity)} Evidencia: ${md(w.evidence)}`, limaAt(i * 7 + day, hh, mm));
      });
    });
  }
}
console.log(`Cursos: ${created} creado(s) con contenido completo, ${updated} actualizado(s), ${shells} curso(s) base creados (contenido en elaboración) · diapositivas generadas: ${decks} archivo(s) · periodo ${term.name}`);
const enrolled = autoEnrollAll();
console.log(`Matrícula automática por carrera y ciclo: ${enrolled.added} matrícula(s) nueva(s), ${enrolled.removed} retirada(s)`);
if (problems.length) { console.error(`Problemas (${problems.length}):`); problems.forEach((p) => console.error(`  - ${p}`)); }
