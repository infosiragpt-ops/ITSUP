/**
 * Plan de estudios de una carrera: lista de ciclos [{ cycle, courses: [nombre, …] }].
 *
 * Acepta también el formato del catálogo (deploy/programas-tepsup.json), una lista de listas
 * [[curso, …], …] donde la posición es el ciclo, y descarta entradas inválidas para que ninguna
 * pantalla dependa de cómo se cargó la carrera.
 */
export function normalizeCurriculum(raw) {
  let list = raw;
  if (typeof raw === 'string') {
    try { list = JSON.parse(raw || '[]'); } catch { list = []; }
  }
  if (!Array.isArray(list)) return [];
  return list
    .map((c, i) => {
      const courses = Array.isArray(c) ? c : Array.isArray(c?.courses) ? c.courses : [];
      const cycle = Array.isArray(c) ? i + 1 : Number(c?.cycle) || i + 1;
      return { cycle, courses: courses.map((x) => String(typeof x === 'object' && x ? x.name ?? '' : x ?? '').trim()).filter(Boolean) };
    })
    .filter((c) => c.courses.length)
    .sort((a, b) => a.cycle - b.cycle);
}
