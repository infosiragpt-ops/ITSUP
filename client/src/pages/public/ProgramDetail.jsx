import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Clock, MonitorSmartphone, Briefcase, UserCheck, GraduationCap, CheckCircle2 } from 'lucide-react';
import { useApi } from '../../lib/api.js';
import { PROGRAM_ICONS, ProgramPhoto, areaOf } from '../../components/brand.jsx';
import { Button, PageLoader, ErrorState } from '../../components/ui.jsx';

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI'];

export default function ProgramDetail() {
  const { slug } = useParams();
  const { data: p, loading, error } = useApi(`/public/programs/${slug}`);
  if (loading) return <PageLoader />;
  if (error) return <div className="mx-auto max-w-xl px-4 py-20"><ErrorState message={error} /></div>;
  const Icon = PROGRAM_ICONS[p.icon] || GraduationCap;
  const area = areaOf(p);

  return (
    <>
      <div className="relative isolate overflow-hidden bg-night">
        {/* Foto de la carrera con un velo oscuro para que el texto siempre se lea */}
        <ProgramPhoto p={p} size="lg" eager className="absolute inset-0 -z-20 h-full w-full" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-[#141413]/95 via-[#141413]/80 to-[#141413]/60 md:bg-gradient-to-r md:from-[#141413]/95 md:via-[#141413]/75 md:to-[#141413]/10" />
        <div className="absolute inset-x-0 bottom-0 h-1.5" style={{ background: p.color }} />
        <div className="relative mx-auto max-w-7xl px-4 py-14 text-white sm:px-6 sm:py-20 lg:py-24">
          <Link to="/carreras" className="mb-7 inline-flex items-center gap-1.5 text-sm text-white/75 hover:text-white"><ArrowLeft size={16} /> Todas las carreras</Link>
          <div className="mb-4 flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl text-white shadow-lg ring-1 ring-white/25" style={{ background: p.color }}><Icon size={21} /></span>
            <span className="text-xs font-bold tracking-[0.16em] text-white/85 uppercase">Carrera técnica{area ? ` · ${area.label}` : ''}</span>
          </div>
          <h1 className="font-display max-w-3xl text-[2.4rem] leading-[1.08] font-semibold sm:text-[3.4rem]">{p.name}</h1>
          <p className="mt-5 max-w-2xl text-[17px] leading-relaxed text-white/85">{p.description}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            {[[Clock, p.duration], [MonitorSmartphone, p.modality], [GraduationCap, 'Título a nombre de la Nación']].map(([I, t]) => (
              <span key={t} className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-sm ring-1 ring-white/25 backdrop-blur"><I size={16} /> {t}</span>
            ))}
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button to={`/admision?carrera=${p.id}`} variant="white" size="lg" iconRight={ArrowRight}>Postula a esta carrera</Button>
          </div>
        </div>
      </div>

      <div className="mx-auto grid grid-cols-1 max-w-7xl gap-8 px-4 py-14 sm:px-6 lg:grid-cols-[1fr_380px]">
        <div>
          <h2 className="font-display text-3xl font-semibold text-ink">Plan de estudios</h2>
          <p className="mt-2 text-muted">Seis ciclos académicos con cursos teóricos, talleres prácticos y experiencias formativas en situación real de trabajo.</p>
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {p.curriculum.map((c) => (
              <div key={c.cycle} className="card p-5">
                <div className="mb-3 flex items-center gap-3">
                  <span className="font-display flex h-10 w-10 items-center justify-center rounded-xl text-lg font-semibold text-white" style={{ background: p.color }}>{ROMAN[c.cycle - 1]}</span>
                  <div><div className="text-sm font-semibold text-ink">Ciclo {ROMAN[c.cycle - 1]}</div><div className="text-xs text-muted">{c.courses.length} cursos</div></div>
                </div>
                <ul className="space-y-1.5">
                  {c.courses.map((x) => <li key={x} className="flex gap-2 text-sm text-ink-2"><CheckCircle2 size={16} className="mt-0.5 shrink-0 text-faint" /> {x}</li>)}
                </ul>
              </div>
            ))}
          </div>
        </div>
        <aside className="space-y-5 lg:sticky lg:top-28 lg:self-start">
          <div className="card p-6">
            <div className="flex items-center gap-2 font-semibold text-ink"><UserCheck size={18} className="text-primary" /> Perfil del egresado</div>
            <p className="mt-2 text-sm leading-relaxed text-muted">{p.profile}</p>
          </div>
          <div className="card p-6">
            <div className="flex items-center gap-2 font-semibold text-ink"><Briefcase size={18} className="text-primary" /> Campo laboral</div>
            <ul className="mt-3 space-y-2">
              {p.field.split('·').map((f) => <li key={f} className="flex gap-2 text-sm text-ink-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" /> {f.trim()}</li>)}
            </ul>
          </div>
          <div className="rounded-2xl bg-night p-6 text-white">
            <div className="font-display text-xl font-semibold">¿Te interesa esta carrera?</div>
            <p className="mt-2 text-sm text-white/70">Un asesor te contará sobre horarios, becas y facilidades de pago.</p>
            <Button to={`/admision?carrera=${p.id}`} className="mt-5 w-full" size="lg">Solicitar información</Button>
          </div>
        </aside>
      </div>
    </>
  );
}
