/**
 * Genera la presentación (PowerPoint) de una unidad a partir del paquete académico de un curso
 * (deploy/catalogo/cursos/<slug>.json). Diseño institucional: portada, objetivos, contenido con notas del
 * docente, caso de estudio, evaluación y referencias.
 *
 *   import { buildUnitDeck } from './build-pptx.mjs';
 *   await buildUnitDeck(pkg, 0, '/ruta/salida.pptx', { institution: 'TEPSUP', program: 'Administración', code: 'ADM-101' });
 *
 * Uso directo: node server/tools/build-pptx.mjs deploy/catalogo/cursos/<slug>.json carpeta-salida/
 */
import fs from 'node:fs';
import path from 'node:path';
import pptxgen from 'pptxgenjs';

const C = { ink: '1F2A37', primary: 'C96442', accent: 'E8A98D', muted: '6B7280', paper: 'FBF9F6', line: 'E5E1DB', white: 'FFFFFF', soft: 'F6EFE9' };
const FONT = 'Calibri';
const W = 10, H = 5.625;

const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
/** Quita marcas Markdown básicas para texto plano de diapositivas. */
const plain = (s) => clean(String(s ?? '').replace(/```[\s\S]*?```/g, ' ').replace(/[*_`#>]/g, ''));
const firstParagraphs = (md, maxWords) => {
  const words = plain(md).split(' ');
  return words.length <= maxWords ? words.join(' ') : `${words.slice(0, maxWords).join(' ')}…`;
};

export async function buildUnitDeck(pkg, unitIndex, outPath, meta = {}) {
  const unit = pkg.units[unitIndex];
  if (!unit) throw new Error(`La unidad ${unitIndex + 1} no existe en ${pkg.slug}`);
  const institution = meta.institution || 'TEPSUP';
  const program = meta.program || '';
  const code = meta.code || '';
  const unitNo = unitIndex + 1;
  const footer = [institution, code, pkg.name, `Unidad ${unitNo}`].filter(Boolean).join('  ·  ');

  const pres = new pptxgen();
  pres.layout = 'LAYOUT_16x9';
  pres.author = institution;
  pres.company = institution;
  pres.title = `${pkg.name} · ${unit.title}`;
  pres.subject = program;

  pres.defineSlideMaster({
    title: 'CONTENIDO',
    background: { color: C.white },
    objects: [
      { rect: { x: 0, y: 0, w: W, h: 0.09, fill: { color: C.primary } } },
      { rect: { x: 0, y: H - 0.42, w: W, h: 0.42, fill: { color: C.paper } } },
      { text: { text: footer, options: { x: 0.45, y: H - 0.4, w: W - 1.6, h: 0.38, fontSize: 9, fontFace: FONT, color: C.muted, valign: 'middle' } } },
    ],
    slideNumber: { x: W - 1.0, y: H - 0.4, w: 0.6, h: 0.38, fontSize: 9, fontFace: FONT, color: C.muted, align: 'right' },
  });
  pres.defineSlideMaster({
    title: 'SECCION',
    background: { color: C.ink },
    objects: [{ rect: { x: 0.45, y: 1.1, w: 0.14, h: 1.6, fill: { color: C.primary } } }],
  });

  // Portada
  {
    const s = pres.addSlide({ masterName: 'SECCION' });
    s.addText(clean(`${institution}${program ? ' · ' + program : ''}`), { x: 0.8, y: 0.55, w: W - 1.6, h: 0.4, fontSize: 13, fontFace: FONT, color: C.accent, bold: true, charSpacing: 2 });
    s.addText(clean(pkg.name), { x: 0.8, y: 1.05, w: W - 1.6, h: 1.0, fontSize: 32, fontFace: FONT, color: C.white, bold: true, valign: 'top', fit: 'shrink' });
    s.addText(clean(unit.title), { x: 0.8, y: 2.15, w: W - 1.6, h: 0.8, fontSize: 22, fontFace: FONT, color: C.accent, valign: 'top', fit: 'shrink' });
    s.addText(clean(unit.description), { x: 0.8, y: 3.05, w: W - 1.6, h: 1.2, fontSize: 14, fontFace: FONT, color: 'D7DCE3', valign: 'top', fit: 'shrink' });
    s.addText(clean([code, `${pkg.credits} créditos`, `${pkg.hours_theory + pkg.hours_practice} horas`, `Semanas ${unitNo * 4 - 3}–${unitNo * 4}`].filter(Boolean).join('  ·  ')), { x: 0.8, y: H - 0.75, w: W - 1.6, h: 0.4, fontSize: 11, fontFace: FONT, color: C.muted });
    s.addNotes(`${pkg.name} — ${unit.title}. Logro de la unidad: ${clean(unit.description)}\n\nCompetencia del curso: ${clean(pkg.competency)}`);
  }

  // Objetivos y temas
  {
    const s = pres.addSlide({ masterName: 'CONTENIDO' });
    s.addText('Logro y temas de la unidad', { x: 0.45, y: 0.3, w: W - 0.9, h: 0.6, fontSize: 24, fontFace: FONT, color: C.ink, bold: true });
    s.addShape(pres.ShapeType.rect, { x: 0.45, y: 1.0, w: W - 0.9, h: 0.95, fill: { color: C.soft }, line: { color: C.soft } });
    s.addText(clean(unit.description), { x: 0.6, y: 1.05, w: W - 1.2, h: 0.85, fontSize: 13, fontFace: FONT, color: C.ink, valign: 'middle', fit: 'shrink' });
    s.addText('Temas', { x: 0.45, y: 2.1, w: 4, h: 0.4, fontSize: 13, fontFace: FONT, color: C.primary, bold: true });
    s.addText(unit.topics.map((t) => ({ text: clean(t), options: { bullet: { code: '25AA' }, breakLine: true } })), { x: 0.45, y: 2.5, w: W - 0.9, h: 2.4, fontSize: 15, fontFace: FONT, color: C.ink, valign: 'top', paraSpaceAfter: 6, fit: 'shrink' });
    s.addNotes(`Presenta el logro de la unidad y conecta los temas con la competencia del curso. Capacidades: ${pkg.capacities.map(clean).join(' | ')}`);
  }

  // Contenido
  unit.slides.forEach((sl, i) => {
    const s = pres.addSlide({ masterName: 'CONTENIDO' });
    s.addText(clean(sl.title), { x: 0.45, y: 0.3, w: W - 0.9, h: 0.75, fontSize: 24, fontFace: FONT, color: C.ink, bold: true, valign: 'middle', fit: 'shrink' });
    s.addShape(pres.ShapeType.line, { x: 0.45, y: 1.1, w: 1.2, h: 0, line: { color: C.primary, width: 2 } });
    s.addText(sl.bullets.map((b) => ({ text: plain(b), options: { bullet: { code: '25AA' }, breakLine: true } })), { x: 0.45, y: 1.3, w: W - 0.9, h: H - 1.9, fontSize: sl.bullets.length > 4 ? 15 : 17, fontFace: FONT, color: C.ink, valign: 'top', paraSpaceAfter: 8, fit: 'shrink' });
    s.addNotes(`Diapositiva ${i + 1}/${unit.slides.length} · ${clean(sl.title)}\n\n${clean(sl.notes)}`);
  });

  // Caso de estudio
  {
    const s = pres.addSlide({ masterName: 'SECCION' });
    s.addText('Caso de estudio', { x: 0.8, y: 0.55, w: W - 1.6, h: 0.4, fontSize: 13, fontFace: FONT, color: C.accent, bold: true, charSpacing: 2 });
    s.addText(clean(unit.case.title), { x: 0.8, y: 1.05, w: W - 1.6, h: 0.9, fontSize: 26, fontFace: FONT, color: C.white, bold: true, valign: 'top', fit: 'shrink' });
    s.addText(firstParagraphs(unit.case.content, 110), { x: 0.8, y: 2.0, w: W - 1.6, h: 1.6, fontSize: 12, fontFace: FONT, color: 'D7DCE3', valign: 'top', fit: 'shrink' });
    s.addText(unit.case.questions.map((q, i) => ({ text: `${i + 1}. ${clean(q)}`, options: { breakLine: true } })), { x: 0.8, y: 3.65, w: W - 1.6, h: 1.6, fontSize: 12, fontFace: FONT, color: C.accent, valign: 'top', paraSpaceAfter: 4, fit: 'shrink' });
    s.addNotes(`Caso completo (está también como lectura en el aula virtual):\n\n${clean(unit.case.content)}\n\nPreguntas: ${unit.case.questions.map(clean).join(' | ')}`);
  }

  // Evaluación de la unidad
  {
    const s = pres.addSlide({ masterName: 'CONTENIDO' });
    s.addText('Evaluación de la unidad', { x: 0.45, y: 0.3, w: W - 0.9, h: 0.6, fontSize: 24, fontFace: FONT, color: C.ink, bold: true });
    const half = (W - 1.1) / 2;
    s.addShape(pres.ShapeType.rect, { x: 0.45, y: 1.05, w: half, h: 3.9, fill: { color: C.soft }, line: { color: C.soft } });
    s.addShape(pres.ShapeType.rect, { x: 0.65 + half, y: 1.05, w: half, h: 3.9, fill: { color: C.paper }, line: { color: C.line } });
    s.addText('Tarea', { x: 0.6, y: 1.15, w: half - 0.3, h: 0.4, fontSize: 13, fontFace: FONT, color: C.primary, bold: true });
    s.addText([
      { text: clean(unit.assignment.title), options: { bold: true, breakLine: true } },
      { text: firstParagraphs(unit.assignment.instructions, 60), options: { breakLine: true } },
      { text: 'Rúbrica (20 puntos):', options: { bold: true, breakLine: true } },
      ...unit.assignment.rubric.map((r) => ({ text: `${clean(r.name)} · ${r.points} pts`, options: { bullet: { code: '25AA' }, breakLine: true } })),
    ], { x: 0.6, y: 1.55, w: half - 0.3, h: 3.3, fontSize: 11, fontFace: FONT, color: C.ink, valign: 'top', paraSpaceAfter: 4, fit: 'shrink' });
    s.addText('Cuestionario y lectura', { x: 0.8 + half, y: 1.15, w: half - 0.3, h: 0.4, fontSize: 13, fontFace: FONT, color: C.primary, bold: true });
    s.addText([
      { text: clean(unit.quiz.title), options: { bold: true, breakLine: true } },
      { text: `${unit.quiz.questions.length} preguntas · 20 puntos · 2 intentos`, options: { breakLine: true } },
      { text: ' ', options: { breakLine: true } },
      { text: clean(unit.reading.title), options: { bold: true, breakLine: true } },
      { text: `Lectura obligatoria (${unit.reading.minutes} min) disponible en el aula virtual.`, options: { breakLine: true } },
      { text: ' ', options: { breakLine: true } },
      { text: 'Sistema de evaluación del curso:', options: { bold: true, breakLine: true } },
      ...pkg.evaluation.map((e) => ({ text: `${clean(e.name)} · ${e.weight} %`, options: { bullet: { code: '25AA' }, breakLine: true } })),
    ], { x: 0.8 + half, y: 1.55, w: half - 0.3, h: 3.3, fontSize: 11, fontFace: FONT, color: C.ink, valign: 'top', paraSpaceAfter: 4, fit: 'shrink' });
    s.addNotes(`Tarea: ${clean(unit.assignment.instructions)}\n\nCuestionario: ${unit.quiz.questions.length} preguntas sobre la unidad.`);
  }

  // Referencias
  {
    const s = pres.addSlide({ masterName: 'CONTENIDO' });
    s.addText('Referencias bibliográficas', { x: 0.45, y: 0.3, w: W - 0.9, h: 0.6, fontSize: 24, fontFace: FONT, color: C.ink, bold: true });
    s.addText(pkg.bibliography.map((b) => ({ text: clean(b), options: { breakLine: true } })), { x: 0.45, y: 1.05, w: W - 0.9, h: H - 1.65, fontSize: 11, fontFace: FONT, color: C.ink, valign: 'top', paraSpaceAfter: 6, fit: 'shrink' });
    s.addNotes('Bibliografía del sílabo; recomienda a los estudiantes la lectura prioritaria para la unidad.');
  }

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  await pres.writeFile({ fileName: outPath, compression: true });
  return { slides: unit.slides.length + 5, path: outPath };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  const [file, outDir] = process.argv.slice(2);
  if (!file || !outDir) { console.error('Uso: node server/tools/build-pptx.mjs curso.json carpeta-salida/'); process.exit(1); }
  const pkg = JSON.parse(fs.readFileSync(file, 'utf8'));
  for (let i = 0; i < pkg.units.length; i++) {
    const out = path.join(outDir, `${pkg.slug}-u${i + 1}.pptx`);
    const r = await buildUnitDeck(pkg, i, out, { institution: 'TEPSUP' });
    console.log(`✔ ${out} (${r.slides} diapositivas, ${(fs.statSync(out).size / 1024).toFixed(0)} KB)`);
  }
}
