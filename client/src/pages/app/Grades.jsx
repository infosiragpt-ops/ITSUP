import { useState } from 'react';
import { Link } from 'react-router-dom';
import { GraduationCap, TrendingUp, Award, AlertTriangle, FileBadge2, FileText, ScrollText, ShieldCheck, ExternalLink, Plus, UserCheck, History, BookOpen } from 'lucide-react';
import { api, useApi } from '../../lib/api.js';
import { useUi } from '../../lib/context.jsx';
import { Button, Card, EmptyState, ErrorState, PageHeader, ProgressRing, Segmented, Skeleton, Stat, Badge, Select, Field, cx } from '../../components/ui.jsx';
import { ConditionBadge } from '../../components/lms.jsx';
import { fmtGrade, fullName, gradeTone, fmtPct, fmtDate, fmtDateTime, conditionOf } from '../../lib/format.js';

export default function Grades() {
  const [tab, setTab] = useState('current');
  return (
    <div className="animate-fade-up">
      <PageHeader title="Calificaciones y récord académico" subtitle="Escala vigesimal (0 a 20), nota mínima aprobatoria 13. El promedio ponderado del periodo se calcula con los créditos de cada unidad didáctica."
        actions={<Segmented value={tab} onChange={setTab} options={[{ value: 'current', label: 'Periodo actual' }, { value: 'history', label: 'Historial' }, { value: 'documents', label: 'Documentos' }]} />} />
      {tab === 'current' && <CurrentTerm />}
      {tab === 'history' && <History_ />}
      {tab === 'documents' && <Documents />}
    </div>
  );
}

/* ---------------- Periodo actual ---------------- */

function CurrentTerm() {
  const { data, loading, error, reload } = useApi('/grades');
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (loading) return <Skeleton className="h-80 rounded-2xl" />;
  const courses = data.courses || [];
  const risk = courses.filter((c) => (c.final.condition === 'desaprobado' || c.final.condition === 'dpi' || c.attendance?.at_risk) && c.final.condition !== 'retirado');
  const best = courses.slice().sort((a, b) => (b.average ?? 0) - (a.average ?? 0))[0];
  const atts = courses.map((c) => c.attendance?.attendance_pct).filter((x) => x != null);
  return (
    <>
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat icon={GraduationCap} label="Promedio ponderado" value={fmtGrade(data.weighted_average)} hint={data.term ? `Periodo ${data.term.name} · por créditos` : 'Ponderado por créditos'} tone="success" />
        <Stat icon={Award} label="Mejor curso" value={fmtGrade(best?.average ?? null)} hint={best?.name} />
        <Stat icon={UserCheck} label="Asistencia" value={fmtPct(atts.length ? atts.reduce((a, b) => a + b, 0) / atts.length : null)} hint="Límite: 30% de inasistencias" tone="info" />
        <Stat icon={risk.length ? AlertTriangle : TrendingUp} label="Cursos en riesgo" value={risk.length} hint={risk.length ? 'Habla con tu docente o tutor' : '¡Vas muy bien!'} tone={risk.length ? 'warn' : 'info'} />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {courses.map((c) => (
          <Link key={c.id} to={`/app/cursos/${c.id}/calificaciones`} className="card flex gap-4 p-5 transition hover:shadow-lift">
            <ProgressRing value={c.average != null ? (c.average / 20) * 100 : 0} size={72} stroke={6}
              color={c.average == null ? 'var(--c-line)' : gradeTone(c.average) === 'success' ? 'var(--c-success)' : 'var(--c-danger)'}>
              <span className="font-display text-lg">{fmtGrade(c.closed ? c.final.final : c.average)}</span>
            </ProgressRing>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: c.color }} /><span className="text-xs font-semibold text-muted">{c.code} · {c.credits} créditos</span></div>
              <div className="mt-1 font-semibold text-ink">{c.name}</div>
              <div className="text-xs text-muted">{fullName(c.teacher)}</div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {c.categories.length ? c.categories.map((k) => (
                  <span key={k.id} title={`${k.name} · ${k.weight}%`} className={cx('rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums', k.average == null ? 'bg-sunken text-faint' : gradeTone(k.average) === 'success' ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger')}>
                    {k.weight}% · {fmtGrade(k.average)}
                  </span>
                )) : c.items.map((i) => (
                  <span key={`${i.kind}${i.id}`} title={i.title} className={cx('rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums', i.score == null ? 'bg-sunken text-faint' : gradeTone(i.score, i.points) === 'success' ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger')}>{fmtGrade(i.score)}</span>
                ))}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <ConditionBadge condition={c.final.condition} short />
                <Badge>{c.graded}/{c.total} calificadas</Badge>
                {c.attendance?.attendance_pct != null && <Badge tone={c.attendance.dpi ? 'danger' : c.attendance.at_risk ? 'warn' : 'neutral'} icon={UserCheck}>{fmtPct(c.attendance.attendance_pct)}</Badge>}
              </div>
            </div>
          </Link>
        ))}
        {courses.length === 0 && <Card className="md:col-span-2"><EmptyState icon={BookOpen} title="Sin cursos en el periodo actual" /></Card>}
      </div>
    </>
  );
}

/* ---------------- Historial ---------------- */

function History_() {
  const { data, loading, error, reload } = useApi('/record');
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (loading) return <Skeleton className="h-80 rounded-2xl" />;
  const { terms, summary, program } = data;
  const progress = program?.total_credits ? Math.round((summary.credits_approved / program.total_credits) * 100) : null;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat icon={GraduationCap} label="Promedio acumulado" value={fmtGrade(summary.cumulative_average)} hint={`${summary.terms_closed} ${summary.terms_closed === 1 ? 'periodo cerrado' : 'periodos cerrados'}`} tone="success" />
        <Stat icon={Award} label="Créditos aprobados" value={`${summary.credits_approved}${program?.total_credits ? ` / ${program.total_credits}` : ''}`} hint={progress != null ? `${progress}% del plan de estudios` : 'Créditos acumulados'} />
        <Stat icon={BookOpen} label="Unidades didácticas aprobadas" value={summary.courses_approved} hint={`${summary.courses_failed} desaprobadas`} tone="info" />
        <Stat icon={ScrollText} label="Título al egresar" value={program?.level || 'Profesional Técnico'} hint={program?.degree || program?.name} tone="warn" />
      </div>
      {terms.map((t) => (
        <Card key={t.term.id} className="overflow-hidden">
          <div className="flex flex-col gap-2 border-b border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-primary"><History size={18} /></span>
              <div><div className="font-semibold text-ink">Periodo {t.term.name}</div><div className="text-xs text-muted">{fmtDate(t.term.start_date)} – {fmtDate(t.term.end_date)} · {t.closed ? 'Cerrado' : 'En curso'}</div></div>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge tone="primary">Promedio ponderado {fmtGrade(t.weighted_average)}</Badge>
              <Badge tone="success">{t.credits_approved} créditos aprobados</Badge>
              <Badge>{t.credits_enrolled} matriculados</Badge>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-sunken text-left text-xs font-semibold text-muted uppercase"><tr><th className="px-5 py-2.5">Unidad didáctica</th><th className="px-3 py-2.5">Módulo</th><th className="px-3 py-2.5 text-center">Créd.</th><th className="px-3 py-2.5 text-center">Asist.</th><th className="px-3 py-2.5 text-center">Nota final</th><th className="px-5 py-2.5">Condición</th></tr></thead>
              <tbody className="divide-y divide-line">
                {t.courses.map((c) => (
                  <tr key={c.id} className="hover:bg-sunken/40">
                    <td className="px-5 py-2.5"><Link to={`/app/cursos/${c.id}/calificaciones`} className="font-medium text-ink hover:text-primary-ink">{c.name}</Link><div className="text-[11px] text-faint">{c.code}{c.teacher ? ` · ${fullName(c.teacher)}` : ''}</div></td>
                    <td className="px-3 py-2.5 text-xs text-muted">{c.module_name || '—'}</td>
                    <td className="px-3 py-2.5 text-center tabular-nums">{c.credits}</td>
                    <td className="px-3 py-2.5 text-center tabular-nums text-muted">{fmtPct(c.attendance_pct)}</td>
                    <td className={cx('px-3 py-2.5 text-center text-base font-bold tabular-nums', c.final == null ? 'text-faint' : c.condition === 'aprobado' ? 'text-success' : 'text-danger')}>{fmtGrade(c.closed ? c.final : c.weighted)}{!c.closed && <span className="block text-[10px] font-normal text-faint">parcial</span>}</td>
                    <td className="px-5 py-2.5"><ConditionBadge condition={c.condition} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ))}
    </div>
  );
}

/* ---------------- Documentos ---------------- */

const DOC_META = {
  constancia_matricula: { icon: FileBadge2, title: 'Constancia de matrícula', desc: 'Acredita tu matrícula en el periodo académico con el detalle de unidades didácticas y créditos.' },
  boleta_notas: { icon: FileText, title: 'Boleta de notas', desc: 'Notas finales, condición y promedio ponderado de un periodo.' },
  record_academico: { icon: ScrollText, title: 'Récord académico', desc: 'Historial completo de periodos, créditos aprobados y promedio acumulado.' },
};

function Documents() {
  const { toast } = useUi();
  const docs = useApi('/documents');
  const record = useApi('/record');
  const [issuing, setIssuing] = useState(null);
  const [termId, setTermId] = useState('');
  const issue = async (type) => {
    setIssuing(type);
    try {
      const d = await api.post('/documents', { type, term_id: termId || undefined });
      toast(`${DOC_META[type].title} emitida · código ${d.code}`);
      docs.reload();
      window.open(`/app/documentos/${d.code}`, '_blank', 'noopener');
    } catch (e) { toast(e.message, 'error'); } finally { setIssuing(null); }
  };
  const terms = record.data?.terms || [];
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="space-y-4">
        <Card className="flex items-start gap-3 border-info/20 bg-info-soft/50 p-4 text-sm text-ink-2">
          <ShieldCheck size={18} className="mt-0.5 shrink-0 text-info" />
          <span>Cada documento se emite con un <strong className="text-ink">código único y una huella digital</strong>. Cualquier persona puede comprobar su autenticidad en <Link to="/verificar" target="_blank" className="font-medium text-primary-ink underline">isup.edu.pe/verificar</Link> sin necesidad de iniciar sesión. Los documentos con valor oficial requieren además la firma de Secretaría Académica.</span>
        </Card>
        <div className="grid gap-4 sm:grid-cols-3">
          {Object.entries(DOC_META).map(([type, m]) => (
            <Card key={type} className="flex flex-col p-5">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-soft text-primary"><m.icon size={20} /></span>
              <h3 className="mt-3 font-semibold text-ink">{m.title}</h3>
              <p className="mt-1 flex-1 text-xs leading-relaxed text-muted">{m.desc}</p>
              <Button size="sm" className="mt-4" icon={Plus} loading={issuing === type} onClick={() => issue(type)}>Emitir</Button>
            </Card>
          ))}
        </div>
        {terms.length > 1 && (
          <Field label="Periodo para la constancia o boleta" hint="Si no eliges, se usa el periodo activo (constancia) o el más reciente (boleta).">
            <Select value={termId} onChange={(e) => setTermId(e.target.value)} className="sm:max-w-xs"><option value="">Automático</option>{terms.map((t) => <option key={t.term.id} value={t.term.id}>{t.term.name}{t.closed ? ' (cerrado)' : ''}</option>)}</Select>
          </Field>
        )}
      </div>
      <Card className="h-fit overflow-hidden">
        <div className="border-b border-line px-5 py-3 font-semibold text-ink">Documentos emitidos</div>
        {docs.loading ? <Skeleton className="m-4 h-32" /> : !docs.data?.length ? <EmptyState compact icon={FileText} title="Aún no emitiste documentos" /> : (
          <ul className="divide-y divide-line">
            {docs.data.map((d) => (
              <li key={d.code} className="flex items-center gap-3 px-5 py-3">
                <div className="min-w-0 flex-1"><div className="truncate text-sm font-medium text-ink">{d.type_label}</div><div className="font-mono text-[11px] text-muted">{d.code} · {fmtDateTime(d.created_at)}</div></div>
                <Link to={`/app/documentos/${d.code}`} target="_blank" className="rounded-lg p-1.5 text-muted hover:bg-sunken hover:text-ink" aria-label="Abrir"><ExternalLink size={16} /></Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
