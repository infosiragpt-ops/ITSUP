import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, Clock, MonitorSmartphone, Briefcase, UserCheck, GraduationCap, Award, BookOpen, Timer, Layers, SearchX, ScrollText,
} from 'lucide-react';
import { useApi } from '../../lib/api.js';
import { ROMAN, COURSE_TYPE } from '../../lib/format.js';
import { PROGRAM_ICONS, ProgramPhoto, areaOf } from '../../components/brand.jsx';
import { Button, PageLoader, ErrorState, EmptyState, cx } from '../../components/ui.jsx';

const nf = new Intl.NumberFormat('es-PE');

const TYPE_DOT = { especifica: 'bg-primary', empleabilidad: 'bg-info', efsrt: 'bg-success' };
const TYPE_SHORT = { especifica: 'Técnica', empleabilidad: 'Empleabilidad', efsrt: 'Experiencia formativa' };

/** Plan por ciclo: usa el detallado del servidor y, si no llega, el plan publicado de la carrera. */
function planOf(p) {
  if (Array.isArray(p.plan) && p.plan.length) return p.plan;
  return (Array.isArray(p.curriculum) ? p.curriculum : [])
    .map((c, i) => (Array.isArray(c) ? { cycle: i + 1, courses: c } : c))
    .filter((c) => Array.isArray(c?.courses))
    .map((c) => ({ cycle: c.cycle, credits: null, hours: null, courses: c.courses.map((x) => (typeof x === 'string' ? { name: x } : x)) }));
}

export default function ProgramDetail() {
  const { slug } = useParams();
  const { data: p, loading, error } = useApi(`/public/programs/${slug}`);
  if (loading) return <PageLoader />;
  if (error || !p) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 sm:py-24">
        {/carrera no encontrada/i.test(error || '') ? (
          <EmptyState icon={SearchX} title="No encontramos esta carrera"
            description="Puede que el enlace haya cambiado o que la carrera ya no esté en oferta. Revisa todas nuestras carreras técnicas 100 % virtuales."
            action={<Button to="/carreras" iconRight={ArrowRight}>Ver todas las carreras</Button>} />
        ) : <ErrorState message={error || 'No pudimos cargar la carrera.'} onRetry={() => window.location.reload()} />}
      </div>
    );
  }

  const Icon = PROGRAM_ICONS[p.icon] || GraduationCap;
  const area = areaOf(p);
  const plan = planOf(p);
  const totalCourses = plan.reduce((n, c) => n + c.courses.length, 0);
  const fields = String(p.field || '').split('·').map((f) => f.trim()).filter(Boolean);
  const types = [...new Set(plan.flatMap((c) => c.courses.map((x) => x.type)).filter(Boolean))];
  const apply = `/admision?carrera=${p.id}`;

  const facts = [
    [Clock, 'Duración', p.duration || `${plan.length} ciclos`],
    [Layers, 'Plan de estudios', `${plan.length} ciclos · ${totalCourses} cursos`],
    p.total_credits ? [Award, 'Créditos', nf.format(p.total_credits)] : null,
    p.total_hours ? [Timer, 'Horas', nf.format(p.total_hours)] : null,
  ].filter(Boolean);

  return (
    <>
      <div className="relative isolate overflow-hidden bg-night">
        {/* Foto de la carrera con un velo oscuro para que el texto siempre se lea */}
        <ProgramPhoto p={p} size="lg" eager className="absolute inset-0 -z-20 h-full w-full" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-[#141413]/95 via-[#141413]/80 to-[#141413]/60 md:bg-gradient-to-r md:from-[#141413]/95 md:via-[#141413]/75 md:to-[#141413]/10" />
        <div className="absolute inset-x-0 bottom-0 h-1.5" style={{ background: p.color }} />
        <div className="relative mx-auto max-w-7xl px-4 pt-8 pb-12 text-white sm:px-6 sm:pt-12 sm:pb-20 lg:pb-24">
          <nav aria-label="Ruta" className="mb-8 flex items-center gap-1.5 text-sm text-white/70">
            <Link to="/carreras" className="inline-flex items-center gap-1.5 hover:text-white"><ArrowLeft size={16} /> Carreras</Link>
            {area && <><span aria-hidden>/</span><span className="truncate">{area.label}</span></>}
          </nav>
          <div className="mb-4 flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white shadow-lg ring-1 ring-white/25" style={{ background: p.color }}><Icon size={21} /></span>
            <span className="text-xs font-bold tracking-[0.16em] text-white/85 uppercase">{p.level || 'Carrera técnica'}{area ? ` · ${area.label}` : ''}</span>
          </div>
          <h1 className="font-display max-w-3xl text-[2.1rem] leading-[1.08] font-semibold break-words sm:text-[3.4rem]">{p.name}</h1>
          {p.description && <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/85 sm:mt-5 sm:text-[17px]">{p.description}</p>}
          <div className="mt-6 flex flex-wrap gap-2 sm:mt-8 sm:gap-3">
            {[[Clock, p.duration], [MonitorSmartphone, p.modality], [GraduationCap, 'Título a nombre de la Nación']].filter(([, t]) => t).map(([I, t]) => (
              <span key={t} className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3.5 py-1.5 text-[13px] ring-1 ring-white/25 backdrop-blur sm:px-4 sm:py-2 sm:text-sm"><I size={16} /> {t}</span>
            ))}
          </div>
          <div className="mt-7 grid grid-cols-1 gap-2 sm:mt-8 sm:flex sm:flex-wrap sm:gap-3">
            <Button to={apply} variant="white" size="lg" iconRight={ArrowRight}>Postula a esta carrera</Button>
            <Button href="#plan" variant="ghost" size="lg" className="text-white ring-1 ring-white/25 hover:bg-white/10">Ver plan de estudios</Button>
          </div>
        </div>
      </div>

      {/* Datos clave */}
      <div className="relative z-10 mx-auto -mt-6 max-w-7xl px-4 sm:-mt-10 sm:px-6">
        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line shadow-lift lg:grid-cols-4">
          {facts.map(([I, k, v]) => (
            <div key={k} className="flex items-start gap-3 bg-surface p-4 sm:p-5">
              <span className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary sm:flex"><I size={19} /></span>
              <div className="min-w-0">
                <dt className="text-xs font-medium tracking-wide text-muted uppercase">{k}</dt>
                <dd className="mt-0.5 text-[15px] font-semibold text-ink sm:text-base">{v}</dd>
              </div>
            </div>
          ))}
        </dl>
      </div>

      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-10 px-4 pt-12 pb-16 sm:px-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-12">
        <section id="plan" className="min-w-0 scroll-mt-28">
          <h2 className="font-display text-[1.75rem] font-semibold text-ink sm:text-3xl">Plan de estudios</h2>
          <p className="mt-2 max-w-2xl text-muted">
            {plan.length} ciclos académicos con unidades didácticas de competencias técnicas, de empleabilidad y experiencias formativas en situaciones reales de trabajo.
          </p>
          {types.length > 0 && (
            <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted" aria-label="Tipos de unidad didáctica">
              {types.map((t) => <li key={t} className="inline-flex items-center gap-2"><span className={cx('h-2 w-2 rounded-full', TYPE_DOT[t])} /> {COURSE_TYPE[t] || t}</li>)}
            </ul>
          )}

          {plan.length === 0 ? (
            <EmptyState className="mt-8" icon={BookOpen} title="Plan de estudios en actualización" description="Escríbenos y un asesor te enviará el plan de estudios completo de esta carrera." />
          ) : (
            <ol className="mt-8 grid grid-cols-1 gap-4 xl:grid-cols-2">
              {plan.map((c) => (
                <li key={c.cycle} className="card overflow-hidden">
                  <div className="flex items-center gap-3 border-b border-line bg-sunken/50 px-4 py-3.5 sm:px-5">
                    <span className="font-display flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg font-semibold text-white" style={{ background: p.color }}>{ROMAN[c.cycle] || c.cycle}</span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-ink">Ciclo {ROMAN[c.cycle] || c.cycle}</div>
                      <div className="text-xs text-muted">Año {Math.ceil(c.cycle / 2)} · {c.courses.length} {c.courses.length === 1 ? 'curso' : 'cursos'}</div>
                    </div>
                    {c.credits != null && (
                      <div className="text-right text-xs text-muted">
                        <div className="text-sm font-semibold text-ink tabular-nums">{c.credits} cr.</div>
                        {c.hours != null && <div className="tabular-nums">{c.hours} h</div>}
                      </div>
                    )}
                  </div>
                  <ul className="divide-y divide-line/70">
                    {c.courses.map((x) => (
                      <li key={x.code || x.name} className="flex items-start gap-3 px-4 py-3 sm:px-5">
                        <span className={cx('mt-[7px] h-2 w-2 shrink-0 rounded-full', TYPE_DOT[x.type] || 'bg-line-strong')} title={COURSE_TYPE[x.type] || undefined} />
                        <div className="min-w-0 flex-1">
                          <div className="text-sm leading-snug font-medium text-ink">{x.name}</div>
                          {(x.code || x.type) && (
                            <div className="mt-0.5 text-xs text-faint">
                              {x.code && <span className="font-mono">{x.code}</span>}
                              {x.code && x.type && ' · '}
                              {x.type && (TYPE_SHORT[x.type] || x.type)}
                            </div>
                          )}
                        </div>
                        {x.credits != null && <span className="shrink-0 rounded-md bg-sunken px-1.5 py-0.5 text-xs font-medium text-ink-2 tabular-nums">{x.credits} cr.</span>}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          )}
        </section>

        <aside className="space-y-5 lg:sticky lg:top-28 lg:self-start">
          {p.profile && (
            <div className="card p-5 sm:p-6">
              <div className="flex items-center gap-2 font-semibold text-ink"><UserCheck size={18} className="text-primary" /> Perfil del egresado</div>
              <p className="mt-2 text-sm leading-relaxed text-muted">{p.profile}</p>
            </div>
          )}
          {fields.length > 0 && (
            <div className="card p-5 sm:p-6">
              <div className="flex items-center gap-2 font-semibold text-ink"><Briefcase size={18} className="text-primary" /> Campo laboral</div>
              <ul className="mt-3 space-y-2">
                {fields.map((f) => <li key={f} className="flex gap-2 text-sm text-ink-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" /> {f}</li>)}
              </ul>
            </div>
          )}
          {(p.degree || p.resolution) && (
            <div className="card p-5 sm:p-6">
              <div className="flex items-center gap-2 font-semibold text-ink"><ScrollText size={18} className="text-primary" /> Título que obtienes</div>
              {p.degree && <p className="mt-2 text-sm font-medium text-ink-2">{p.degree}</p>}
              <p className="mt-1 text-xs leading-relaxed text-muted">Otorgado a nombre de la Nación{p.resolution ? ` · ${p.resolution}` : ''}.</p>
            </div>
          )}
          <div className="rounded-2xl bg-night p-6 text-white">
            <div className="font-display text-xl font-semibold">¿Te interesa esta carrera?</div>
            <p className="mt-2 text-sm text-white/70">Un asesor te contará sobre horarios, becas y facilidades de pago.</p>
            <Button to={apply} className="mt-5 w-full" size="lg">Solicitar información</Button>
          </div>
        </aside>
      </div>

    </>
  );
}
