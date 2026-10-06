#!/usr/bin/env node
/**
 * Valida un paquete académico de curso (deploy/catalogo/cursos/<slug>.json) contra el contrato que usan el
 * generador de diapositivas y el importador. Uso: node deploy/catalogo/validar.mjs archivo.json [...]
 * Sale con código 1 si hay errores y los lista; con 0 si el archivo es válido.
 */
import fs from 'node:fs';
import path from 'node:path';

const words = (s) => String(s || '').trim().split(/\s+/).filter(Boolean).length;
const slugOf = (s) => String(s).trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

export function validate(pkg, fileName) {
  const errors = [];
  const err = (m) => errors.push(m);
  const isStr = (v, min = 1) => typeof v === 'string' && v.trim().length >= min;
  const arr = (v, min, max, what) => { if (!Array.isArray(v) || v.length < min || v.length > max) err(`${what}: se esperan entre ${min} y ${max} elementos`); return Array.isArray(v) ? v : []; };
  const range = (n, lo, hi, what) => { if (typeof n !== 'number' || n < lo || n > hi) err(`${what}: debe ser un número entre ${lo} y ${hi} (es ${JSON.stringify(n)})`); };
  const wordsIn = (s, lo, hi, what) => { const w = words(s); if (w < lo || w > hi) err(`${what}: ${w} palabras; se esperan entre ${lo} y ${hi}`); };
  const noUrl = (s, what) => { if (/https?:\/\//i.test(String(s || ''))) err(`${what}: no debe contener URLs`); };

  if (!pkg || typeof pkg !== 'object') return ['El archivo no contiene un objeto JSON'];
  if (!isStr(pkg.name, 3)) err('name: obligatorio');
  if (!isStr(pkg.slug)) err('slug: obligatorio');
  else if (fileName && path.basename(fileName, '.json') !== pkg.slug) err(`slug (${pkg.slug}) no coincide con el nombre del archivo`);
  else if (slugOf(pkg.slug) !== pkg.slug) err('slug: solo minúsculas, números y guiones');
  if (!['especifica', 'empleabilidad', 'efsrt'].includes(pkg.course_type)) err("course_type: debe ser 'especifica', 'empleabilidad' o 'efsrt'");
  if (!isStr(pkg.module_name, 3)) err('module_name: obligatorio (módulo formativo)');
  range(pkg.credits, 2, 6, 'credits');
  range(pkg.hours_theory, 0, 96, 'hours_theory');
  range(pkg.hours_practice, 0, 160, 'hours_practice');
  if (typeof pkg.credits === 'number' && typeof pkg.hours_theory === 'number' && typeof pkg.hours_practice === 'number') {
    const calc = pkg.hours_theory / 16 + pkg.hours_practice / 32;
    if (Math.abs(calc - pkg.credits) > 0.01) err(`credits (${pkg.credits}) no cuadra con las horas: ${pkg.hours_theory}/16 + ${pkg.hours_practice}/32 = ${calc} (1 crédito = 16 h teoría o 32 h práctica)`);
  }
  wordsIn(pkg.summary, 70, 200, 'summary (sumilla)');
  wordsIn(pkg.competency, 15, 90, 'competency');
  arr(pkg.capacities, 3, 5, 'capacities').forEach((c, i) => wordsIn(c, 8, 60, `capacities[${i}]`));
  arr(pkg.indicators, 4, 8, 'indicators').forEach((c, i) => wordsIn(c, 8, 60, `indicators[${i}]`));
  wordsIn(pkg.methodology, 40, 160, 'methodology');
  arr(pkg.bibliography, 5, 10, 'bibliography').forEach((b, i) => { wordsIn(b, 4, 60, `bibliography[${i}]`); noUrl(b, `bibliography[${i}]`); if (!/\(\s*(19|20)\d{2}\s*\)/.test(b)) err(`bibliography[${i}]: debe incluir el año entre paréntesis, formato APA`); });
  const ev = arr(pkg.evaluation, 3, 4, 'evaluation');
  let sum = 0;
  ev.forEach((e, i) => { if (!isStr(e?.name, 3)) err(`evaluation[${i}].name`); range(e?.weight, 10, 60, `evaluation[${i}].weight`); sum += Number(e?.weight) || 0; wordsIn(e?.description, 6, 60, `evaluation[${i}].description`); });
  if (ev.length && Math.round(sum) !== 100) err(`evaluation: los pesos suman ${sum}, deben sumar 100`);

  const units = arr(pkg.units, 4, 4, 'units');
  units.forEach((u, ui) => {
    const U = `units[${ui}]`;
    if (!isStr(u?.title, 5)) err(`${U}.title`);
    wordsIn(u?.description, 12, 80, `${U}.description`);
    arr(u?.topics, 3, 6, `${U}.topics`).forEach((t, i) => wordsIn(t, 2, 25, `${U}.topics[${i}]`));
    const slides = arr(u?.slides, 12, 18, `${U}.slides`);
    slides.forEach((s, si) => {
      const S = `${U}.slides[${si}]`;
      wordsIn(s?.title, 2, 16, `${S}.title`);
      arr(s?.bullets, 3, 6, `${S}.bullets`).forEach((b, bi) => { wordsIn(b, 4, 40, `${S}.bullets[${bi}]`); noUrl(b, `${S}.bullets[${bi}]`); });
      wordsIn(s?.notes, 70, 220, `${S}.notes (notas del docente)`);
    });
    if (!isStr(u?.reading?.title, 5)) err(`${U}.reading.title`);
    range(u?.reading?.minutes, 15, 60, `${U}.reading.minutes`);
    wordsIn(u?.reading?.content, 450, 1000, `${U}.reading.content`);
    noUrl(u?.reading?.content, `${U}.reading.content`);
    if (!isStr(u?.case?.title, 5)) err(`${U}.case.title`);
    wordsIn(u?.case?.content, 250, 600, `${U}.case.content`);
    noUrl(u?.case?.content, `${U}.case.content`);
    arr(u?.case?.questions, 3, 5, `${U}.case.questions`).forEach((q, i) => wordsIn(q, 6, 60, `${U}.case.questions[${i}]`));
    if (!isStr(u?.assignment?.title, 5)) err(`${U}.assignment.title`);
    wordsIn(u?.assignment?.instructions, 100, 350, `${U}.assignment.instructions`);
    const rub = arr(u?.assignment?.rubric, 3, 5, `${U}.assignment.rubric`);
    let pts = 0;
    rub.forEach((r, i) => { if (!isStr(r?.name, 3)) err(`${U}.assignment.rubric[${i}].name`); range(r?.points, 1, 12, `${U}.assignment.rubric[${i}].points`); pts += Number(r?.points) || 0; });
    if (rub.length && pts !== 20) err(`${U}.assignment.rubric: los puntos suman ${pts}, deben sumar 20`);
    if (!isStr(u?.quiz?.title, 5)) err(`${U}.quiz.title`);
    arr(u?.quiz?.questions, 5, 8, `${U}.quiz.questions`).forEach((q, qi) => {
      const Q = `${U}.quiz.questions[${qi}]`;
      wordsIn(q?.prompt, 6, 70, `${Q}.prompt`);
      const opts = arr(q?.options, 4, 4, `${Q}.options`);
      opts.forEach((o, oi) => wordsIn(o, 1, 30, `${Q}.options[${oi}]`));
      if (new Set(opts.map((o) => String(o).trim().toLowerCase())).size !== opts.length) err(`${Q}.options: hay opciones repetidas`);
      if (!Number.isInteger(q?.correct) || q.correct < 0 || q.correct > 3) err(`${Q}.correct: índice 0-3 de la opción correcta`);
      wordsIn(q?.explanation, 8, 80, `${Q}.explanation`);
    });
  });
  const plan = arr(pkg.weekly_plan, 16, 16, 'weekly_plan');
  plan.forEach((w, i) => {
    const W = `weekly_plan[${i}]`;
    if (w?.week !== i + 1) err(`${W}.week: debe ser ${i + 1}`);
    if (![1, 2, 3, 4].includes(w?.unit)) err(`${W}.unit: 1-4`);
    else if (w.unit !== Math.floor(i / 4) + 1) err(`${W}.unit: la semana ${i + 1} corresponde a la unidad ${Math.floor(i / 4) + 1}`);
    wordsIn(w?.topic, 3, 30, `${W}.topic`);
    wordsIn(w?.activity, 6, 60, `${W}.activity`);
    wordsIn(w?.evidence, 2, 30, `${W}.evidence`);
  });
  return errors;
}

export function stats(pkg) {
  const slides = pkg.units.reduce((n, u) => n + u.slides.length, 0);
  const text = JSON.stringify(pkg);
  return { units: pkg.units.length, slides, questions: pkg.units.reduce((n, u) => n + u.quiz.questions.length, 0), words: words(text.replace(/[{}\[\]":,]/g, ' ')) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  const files = process.argv.slice(2);
  if (!files.length) { console.error('Uso: node deploy/catalogo/validar.mjs archivo.json [...]'); process.exit(1); }
  let bad = 0;
  for (const f of files) {
    let pkg;
    try { pkg = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { console.error(`✖ ${f}: JSON inválido (${e.message})`); bad++; continue; }
    const errors = validate(pkg, f);
    if (errors.length) { bad++; console.error(`✖ ${f}: ${errors.length} error(es)`); errors.slice(0, 40).forEach((e) => console.error(`   - ${e}`)); if (errors.length > 40) console.error(`   … y ${errors.length - 40} más`); }
    else { const s = stats(pkg); console.log(`✔ ${f}: ${s.units} unidades, ${s.slides} diapositivas, ${s.questions} preguntas, ~${s.words} palabras`); }
  }
  process.exit(bad ? 1 : 0);
}
