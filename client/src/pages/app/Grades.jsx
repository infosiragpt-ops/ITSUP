import { Link } from 'react-router-dom';
import { GraduationCap, TrendingUp, Award, AlertTriangle } from 'lucide-react';
import { useApi } from '../../lib/api.js';
import { Card, ErrorState, PageHeader, ProgressRing, Skeleton, Stat, Badge, cx } from '../../components/ui.jsx';
import { fmtGrade, fullName, gradeTone } from '../../lib/format.js';

export default function Grades() {
  const { data, loading, error, reload } = useApi('/grades');
  if (error) return <ErrorState message={error} onRetry={reload} />;
  const courses = data?.courses || [];
  const risk = courses.filter((c) => c.average != null && c.average < 13);
  return (
    <div className="animate-fade-up">
      <PageHeader title="Mis calificaciones" subtitle="Promedios en escala vigesimal (0 a 20) calculados con tus tareas y evaluaciones calificadas." />
      {loading ? <Skeleton className="h-80 rounded-2xl" /> : (
        <>
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Stat icon={GraduationCap} label="Promedio ponderado" value={fmtGrade(data.weighted_average)} hint="Ponderado por créditos" tone="success" />
            <Stat icon={Award} label="Mejor curso" value={fmtGrade(Math.max(...courses.map((c) => c.average ?? 0)) || null)} hint={courses.slice().sort((a, b) => (b.average ?? 0) - (a.average ?? 0))[0]?.name} />
            <Stat icon={risk.length ? AlertTriangle : TrendingUp} label="Cursos en riesgo" value={risk.length} hint={risk.length ? 'Habla con tu docente o tutor' : '¡Vas muy bien!'} tone={risk.length ? 'warn' : 'info'} />
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {courses.map((c) => (
              <Link key={c.id} to={`/app/cursos/${c.id}/calificaciones`} className="card flex gap-4 p-5 transition hover:shadow-lift">
                <ProgressRing value={c.average != null ? (c.average / 20) * 100 : 0} size={72} stroke={6}
                  color={c.average == null ? 'var(--c-line)' : gradeTone(c.average) === 'success' ? 'var(--c-success)' : 'var(--c-danger)'}>
                  <span className="font-display text-lg">{fmtGrade(c.average)}</span>
                </ProgressRing>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: c.color }} /><span className="text-xs font-semibold text-muted">{c.code} · {c.credits} créditos</span></div>
                  <div className="mt-1 font-semibold text-ink">{c.name}</div>
                  <div className="text-xs text-muted">{fullName(c.teacher)}</div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {c.items.map((i) => (
                      <span key={`${i.kind}${i.id}`} title={i.title}
                        className={cx('rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums', i.score == null ? 'bg-sunken text-faint' : gradeTone(i.score, i.points) === 'success' ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger')}>
                        {i.score == null ? '—' : fmtGrade(i.score)}
                      </span>
                    ))}
                  </div>
                  <div className="mt-2"><Badge>{c.graded}/{c.total} calificadas</Badge></div>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
