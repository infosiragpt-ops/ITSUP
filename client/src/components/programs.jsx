import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Clock, GraduationCap } from 'lucide-react';
import { ALL_AREAS, AREAS, PROGRAM_ICONS, ProgramPhoto, areaOf } from './brand.jsx';
import { cx } from './ui.jsx';

const usedAreas = (programs) => AREAS.filter((a) => programs.some((p) => p.area === a.key));

/** Tarjeta de carrera con foto, área e ícono. */
export function ProgramCard({ p }) {
  const Icon = PROGRAM_ICONS[p.icon] || GraduationCap;
  const area = areaOf(p);
  return (
    <Link to={`/carreras/${p.slug}`} className="group card flex flex-col overflow-hidden transition duration-300 hover:-translate-y-1 hover:shadow-lift">
      <div className="relative aspect-[16/10] overflow-hidden bg-sunken">
        <ProgramPhoto p={p} size="md" className="h-full w-full transition duration-700 ease-out group-hover:scale-[1.06]" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#141413]/65 via-[#141413]/5 to-transparent" />
        {area && (
          <span className="absolute top-3.5 left-3.5 inline-flex items-center gap-1.5 rounded-full bg-white/92 px-2.5 py-1 text-[11.5px] font-semibold text-[#141413] shadow-sm backdrop-blur">
            <area.icon size={13} strokeWidth={2.2} /> {area.label}
          </span>
        )}
        <span className="absolute bottom-3.5 left-3.5 flex h-11 w-11 items-center justify-center rounded-xl text-white shadow-lg ring-1 ring-white/25" style={{ background: p.color }}>
          <Icon size={21} />
        </span>
        <span className="absolute right-3.5 bottom-4 text-[12px] font-medium text-white/90">{p.modality}</span>
      </div>
      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <h3 className="text-lg leading-snug font-semibold text-ink">{p.name}</h3>
        <p className="mt-2 line-clamp-3 flex-1 text-sm leading-relaxed text-muted">{p.description}</p>
        <div className="mt-5 flex items-center justify-between border-t border-line pt-4 text-[13px]">
          <span className="flex items-center gap-1.5 text-muted"><Clock size={14} /> {p.duration}</span>
          <span className="flex items-center gap-1 font-semibold text-primary-ink">Ver carrera <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" /></span>
        </div>
      </div>
    </Link>
  );
}

/** Filtro por área académica (píldoras con ícono). */
export function AreaTabs({ programs, value, onChange, className }) {
  const areas = usedAreas(programs);
  if (areas.length < 2) return null;
  return (
    <div className={cx('no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0', className)} role="tablist" aria-label="Filtrar carreras por área">
      {[ALL_AREAS, ...areas].map((a) => {
        const active = value === a.key;
        const count = a.key === 'all' ? programs.length : programs.filter((p) => p.area === a.key).length;
        return (
          <button key={a.key} role="tab" aria-selected={active} onClick={() => onChange(a.key)}
            className={cx('inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-semibold transition',
              active ? 'border-ink bg-ink text-bg shadow-soft' : 'border-line bg-surface text-ink-2 hover:border-line-strong hover:bg-sunken')}>
            <a.icon size={17} strokeWidth={1.9} className={active ? '' : 'text-primary'} />
            {a.label}
            <span className={cx('rounded-full px-1.5 text-[11px] tabular-nums', active ? 'bg-white/20' : 'bg-sunken text-muted')}>{count}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Filtro por área + cuadrícula de carreras (inicio y página de carreras). */
export function ProgramsExplorer({ programs }) {
  const [area, setArea] = useState('all');
  if (!programs) {
    return <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton h-[380px] rounded-2xl" />)}</div>;
  }
  const list = programs.filter((p) => area === 'all' || p.area === area);
  return (
    <>
      <AreaTabs programs={programs} value={area} onChange={setArea} className="mb-8" />
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((p) => <ProgramCard key={p.id} p={p} />)}
      </div>
    </>
  );
}

/** Menú desplegable de carreras: áreas con ícono, carreras con miniatura y vista previa con foto. */
export function CareersMega({ programs }) {
  const [area, setArea] = useState('all');
  const [hovered, setHovered] = useState(null);
  const areas = usedAreas(programs);
  const list = programs.filter((p) => area === 'all' || p.area === area);
  const preview = list.find((p) => p.id === hovered) || list[0];
  const pick = (key) => { setArea(key); setHovered(null); };

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-lift">
      {areas.length > 1 && (
        <div role="tablist" aria-label="Áreas académicas" className="grid border-b border-line bg-sunken/70" style={{ gridTemplateColumns: `repeat(${areas.length + 1}, minmax(0, 1fr))` }}>
          {[ALL_AREAS, ...areas].map((a) => {
            const active = area === a.key;
            return (
              <button key={a.key} role="tab" aria-selected={active} onClick={() => pick(a.key)} onMouseEnter={() => pick(a.key)}
                className={cx('flex flex-col items-center gap-2 px-3 pt-4 pb-3.5 text-[11.5px] font-bold tracking-[0.09em] uppercase transition',
                  active ? 'bg-surface text-ink shadow-[inset_0_-2px_0_var(--c-primary)]' : 'text-muted hover:text-ink')}>
                <a.icon size={27} strokeWidth={1.5} className={active ? 'text-primary' : ''} />
                {a.label}
              </button>
            );
          })}
        </div>
      )}
      <div className="grid grid-cols-[minmax(0,1fr)_290px]">
        <div className={cx('grid content-start gap-1 p-3', list.length > 3 ? 'grid-cols-2' : 'grid-cols-1')}>
          {list.map((p) => (
            <Link key={p.id} to={`/carreras/${p.slug}`} onMouseEnter={() => setHovered(p.id)} onFocus={() => setHovered(p.id)}
              className={cx('group flex items-center gap-3 rounded-xl p-2.5 transition', preview?.id === p.id ? 'bg-sunken' : 'hover:bg-sunken')}>
              <ProgramPhoto p={p} size="sm" className="h-14 w-14 shrink-0 rounded-xl" />
              <span className="min-w-0">
                <span className="block text-[14px] leading-snug font-semibold text-ink group-hover:text-primary-ink">{p.name}</span>
                <span className="mt-1 flex items-center gap-1.5 text-xs text-muted"><Clock size={12} /> {p.duration}</span>
              </span>
            </Link>
          ))}
        </div>
        {preview && (
          <Link to={`/carreras/${preview.slug}`} className="group relative m-3 ml-0 min-h-[236px] overflow-hidden rounded-xl bg-night">
            <ProgramPhoto p={preview} size="md" className="absolute inset-0 h-full w-full transition duration-700 group-hover:scale-105" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#141413]/92 via-[#141413]/35 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-4 text-white">
              {areaOf(preview) && <div className="text-[10.5px] font-bold tracking-[0.12em] text-white/75 uppercase">{areaOf(preview).label}</div>}
              <div className="font-display mt-0.5 text-[1.15rem] leading-tight font-semibold">{preview.name}</div>
              <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-white/75">{preview.description}</p>
              <span className="mt-2.5 inline-flex items-center gap-1 text-xs font-semibold">Ver plan de estudios <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" /></span>
            </div>
          </Link>
        )}
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-line bg-sunken/60 px-4 py-3">
        <span className="text-[13px] text-muted">{programs.length} carreras técnicas · 100% virtuales · Título a nombre de la Nación</span>
        <Link to="/carreras" className="inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold text-primary-ink hover:underline">Ver todas las carreras <ArrowRight size={15} /></Link>
      </div>
    </div>
  );
}

/** Lista de carreras agrupada por área para el menú móvil. */
export function CareersMobileList({ programs }) {
  const groups = [...usedAreas(programs).map((a) => ({ ...a, items: programs.filter((p) => p.area === a.key) })),
    { key: 'otras', label: 'Otras carreras', items: programs.filter((p) => !areaOf(p)) }].filter((g) => g.items.length);
  return groups.map((g) => (
    <div key={g.key} className="mb-3">
      <div className="mb-1 flex items-center gap-2 px-2 pt-2 text-xs font-semibold tracking-[0.1em] text-faint uppercase">
        {g.icon && <g.icon size={14} />} {g.label}
      </div>
      {g.items.map((p) => (
        <Link key={p.id} to={`/carreras/${p.slug}`} className="flex items-center gap-3 rounded-xl px-2 py-2 text-[15px] font-medium text-ink active:bg-sunken">
          <ProgramPhoto p={p} size="sm" className="h-11 w-11 shrink-0 rounded-lg" /> {p.name}
        </Link>
      ))}
    </div>
  ));
}
