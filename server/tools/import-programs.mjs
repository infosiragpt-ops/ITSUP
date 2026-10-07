#!/usr/bin/env node
/**
 * Importa o actualiza las carreras (programas de estudio) desde un archivo JSON.
 *
 *   node server/tools/import-programs.mjs deploy/programas-tepsup.json [--solo-estas]
 *
 * El archivo es una lista de carreras (o un objeto con la clave "programs"). Cada carrera se identifica por su
 * "slug": si ya existe se actualizan sus datos, si no se crea. Con --solo-estas, las demás carreras quedan
 * desactivadas (dejan de verse en la web y en los formularios). Respeta DATA_DIR / DB_PATH del entorno.
 */
const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--'));
const onlyThese = args.includes('--solo-estas');
if (!file) {
  console.error('Uso: node server/tools/import-programs.mjs archivo.json [--solo-estas]');
  process.exit(1);
}
// Como root dejaría archivos -wal/-shm de root junto a la base del servicio (que luego no podría escribir)
if (typeof process.getuid === 'function' && process.getuid() === 0 && !process.env.ISUP_ALLOW_ROOT) {
  console.error('No ejecutes esta herramienta como root. En el servidor usa: sudo isup-carreras [archivo.json]');
  process.exit(1);
}
const fs = await import('node:fs');
const path = await import('node:path');
const { get, run, insert, all, tx } = await import('../db.js');
const { normalizeCurriculum } = await import('../curriculum.js');

let data;
try {
  data = JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'));
} catch (e) {
  console.error(`No se pudo leer ${file}: ${e.message}`);
  process.exit(1);
}
const list = Array.isArray(data) ? data : data?.programs;
if (!Array.isArray(list) || !list.length) {
  console.error('El archivo no contiene carreras (se espera una lista o un objeto con "programs").');
  process.exit(1);
}
const slugOf = (s) => String(s).trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
const FIELDS = ['name', 'short', 'description', 'duration', 'modality', 'icon', 'color', 'profile', 'field', 'area', 'image', 'level', 'degree', 'total_credits', 'total_hours', 'resolution'];

let created = 0, updated = 0;
const slugs = [];
tx(() => {
  for (const p of list) {
    if (!p?.name?.trim()) throw new Error('Cada carrera necesita un "name".');
    const slug = slugOf(p.slug || p.name);
    const name = p.name.trim();
    const values = {
      name, short: p.short?.trim() || name, description: p.description || '', duration: p.duration || '3 años (6 ciclos)',
      modality: p.modality || '100% virtual', icon: p.icon || 'graduation', color: p.color || '#C96442', profile: p.profile || '',
      field: p.field || '', area: p.area || null, image: p.image || null, level: p.level || 'Profesional Técnico',
      degree: p.degree?.trim() || `Profesional Técnico en ${name}`, total_credits: Number(p.total_credits) || 120,
      total_hours: Number(p.total_hours) || 2550, resolution: p.resolution?.trim() || null,
    };
    const curriculum = JSON.stringify(normalizeCurriculum(p.curriculum));
    const row = get('SELECT id FROM programs WHERE slug = ?', slug);
    if (row) {
      run(`UPDATE programs SET ${FIELDS.map((k) => `${k} = ?`).join(', ')}, curriculum = ?, active = 1 WHERE id = ?`,
        ...FIELDS.map((k) => values[k]), curriculum, row.id);
      updated++;
      console.log(`  actualizada: ${name} (${slug})`);
    } else {
      insert(`INSERT INTO programs (slug, ${FIELDS.join(', ')}, curriculum, active) VALUES (?, ${FIELDS.map(() => '?').join(', ')}, ?, 1)`,
        slug, ...FIELDS.map((k) => values[k]), curriculum);
      created++;
      console.log(`  creada:      ${name} (${slug})`);
    }
    slugs.push(slug);
  }
  let deactivated = 0;
  if (onlyThese) {
    deactivated = Number(run(`UPDATE programs SET active = 0 WHERE active = 1 AND slug NOT IN (${slugs.map(() => '?').join(',')})`, ...slugs).changes);
    if (deactivated) console.log(`  desactivadas: ${deactivated} carrera(s) que no están en el archivo`);
  }
  run("INSERT INTO audit_log (user_id, action, entity, entity_id, details, ip) VALUES (NULL, 'program.import', 'program', NULL, ?, 'servidor')",
    JSON.stringify({ file: path.basename(file), created, updated, deactivated }));
});
const activeCount = all('SELECT id FROM programs WHERE active = 1').length;
console.log(`Listo: ${created} creada(s), ${updated} actualizada(s). Carreras activas: ${activeCount}.`);
