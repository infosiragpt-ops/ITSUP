import { useEffect, useState } from 'react';
import { FileText, Pencil, Printer, Save, X, Plus, Trash2, Target, ListChecks, BookOpen, Scale, Clock, Layers, GraduationCap, CalendarDays } from 'lucide-react';
import { api, useApi } from '../../../lib/api.js';
import { useUi } from '../../../lib/context.jsx';
import { Badge, Button, Card, ErrorState, Field, IconButton, Input, Skeleton, Textarea, cx } from '../../../components/ui.jsx';
import { ClosedNotice } from '../../../components/lms.jsx';
import { fmtDate, fmtShort, fullName, ROMAN } from '../../../lib/format.js';
import { ITEM_META } from '../../../components/brand.jsx';
import { useCourse } from './CourseLayout.jsx';

const Section = ({ icon: Icon, title, children, className }) => (
  <section className={cx('break-inside-avoid', className)}>
    <h3 className="mb-2 flex items-center gap-2 text-[11.5px] font-bold tracking-[0.12em] text-primary uppercase print:text-black">{Icon && <Icon size={14} className="print:hidden" />} {title}</h3>
    {children}
  </section>
);

const List = ({ items, ordered }) => {
  if (!items?.length) return <p className="text-sm text-faint">Por completar.</p>;
  const Tag = ordered ? 'ol' : 'ul';
  return <Tag className={cx('space-y-1 pl-5 text-[14.5px] leading-relaxed text-ink-2', ordered ? 'list-decimal' : 'list-disc')}>{items.map((x, i) => <li key={i}>{x}</li>)}</Tag>;
};

export default function CourseSyllabus() {
  const { course, canEdit } = useCourse();
  const { data, loading, error, reload, setData } = useApi(`/courses/${course.id}/syllabus`);
  const [editing, setEditing] = useState(false);
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (loading) return <div className="space-y-4"><Skeleton className="h-40 rounded-2xl" /><Skeleton className="h-80 rounded-2xl" /></div>;
  if (editing) return <SyllabusEditor data={data} onCancel={() => setEditing(false)} onSaved={(r) => { setData((d) => ({ ...d, syllabus: r.syllabus, categories: r.categories })); setEditing(false); }} />;

  const { syllabus: s, course: c, program, term, teacher, units, categories, rules, institution } = data;
  const info = [
    ['Programa de estudios', program?.name || 'Transversal'], ['Módulo formativo', c.module_name || '—'], ['Unidad didáctica', `${c.code} · ${c.name}`],
    ['Tipo', c.course_type_label], ['Periodo académico', term?.name || '—'], ['Ciclo', c.cycle ? `Ciclo ${ROMAN[c.cycle] || c.cycle}` : '—'],
    ['Créditos', c.credits], ['Horas', `${c.hours_total} h (${c.hours_theory} teóricas · ${c.hours_practice} prácticas)`],
    ['Modalidad', c.modality || 'A distancia'], ['Horario', c.schedule || '—'], ['Docente', teacher ? `${fullName(teacher)}${teacher.title ? ` · ${teacher.title}` : ''}` : '—'], ['Correo', teacher?.email || '—'],
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <p className="max-w-2xl text-sm text-muted">Sílabo oficial de la unidad didáctica según los Lineamientos Académicos Generales del MINEDU: competencia, capacidades, indicadores de logro, contenidos y sistema de evaluación.</p>
        <div className="flex gap-2">
          <Button variant="secondary" icon={Printer} onClick={() => window.print()}>Imprimir / PDF</Button>
          {canEdit && <Button icon={Pencil} onClick={() => setEditing(true)}>Editar sílabo</Button>}
        </div>
      </div>
      <ClosedNotice course={course} compact />

      <Card className="doc p-6 sm:p-8 print:border-0 print:p-0 print:shadow-none">
        <header className="flex flex-col gap-4 border-b border-line pb-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-xs font-semibold tracking-[0.14em] text-muted uppercase">{institution.name}</div>
            <h2 className="font-display mt-1 text-[1.75rem] leading-tight font-semibold text-ink">Sílabo · {c.name}</h2>
            <div className="mt-1 text-sm text-muted">{program?.short || 'Área transversal'} · {term?.name} · {c.credits} créditos · {c.hours_total} horas</div>
          </div>
          <div className="flex flex-wrap gap-2 print:hidden">
            <Badge tone="primary">{c.code}</Badge>
            {c.status === 'closed' && <Badge>Periodo cerrado</Badge>}
          </div>
        </header>

        <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px] print:grid-cols-1">
          <div className="space-y-7">
            <Section icon={FileText} title="I. Información general">
              <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                {info.map(([k, v]) => (
                  <div key={k} className="flex gap-2 border-b border-line/60 py-1.5">
                    <dt className="w-40 shrink-0 text-muted">{k}</dt><dd className="min-w-0 font-medium text-ink">{v}</dd>
                  </div>
                ))}
              </dl>
            </Section>
            <Section icon={BookOpen} title="II. Sumilla"><p className="text-[14.5px] leading-relaxed text-ink-2">{s.summary || 'Por completar.'}</p></Section>
            <Section icon={Target} title="III. Competencia">{s.competency ? <p className="rounded-xl bg-primary-soft/60 p-4 text-[14.5px] leading-relaxed text-ink print:bg-transparent print:p-0">{s.competency}</p> : <p className="text-sm text-faint">Por completar.</p>}</Section>
            <div className="grid gap-6 sm:grid-cols-2">
              <Section icon={ListChecks} title="IV. Capacidades"><List items={s.capacities} ordered /></Section>
              <Section icon={ListChecks} title="V. Indicadores de logro"><List items={s.indicators} ordered /></Section>
            </div>
            <Section icon={Layers} title="VI. Organización de los aprendizajes (unidades)">
              <div className="space-y-3">
                {units.map((u, i) => (
                  <div key={u.id} className="rounded-xl border border-line p-4 break-inside-avoid">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <div className="font-semibold text-ink">{u.title}</div>
                      {u.start_date && <span className="text-xs text-muted">Desde el {fmtShort(u.start_date)}</span>}
                    </div>
                    {u.description && <p className="mt-1 text-sm text-muted">{u.description}</p>}
                    <div className="mt-2 grid gap-x-6 gap-y-1 text-[13px] sm:grid-cols-2">
                      <div>
                        <div className="mb-1 text-[11px] font-semibold text-faint uppercase">Contenidos y recursos</div>
                        <ul className="space-y-0.5 text-ink-2">{u.items.map((it) => { const m = ITEM_META[it.type]; return <li key={it.id} className="flex items-center gap-1.5"><m.icon size={12} className="shrink-0 text-muted print:hidden" /> {it.title}</li>; })}{u.items.length === 0 && <li className="text-faint">—</li>}</ul>
                      </div>
                      <div>
                        <div className="mb-1 text-[11px] font-semibold text-faint uppercase">Evaluación de la unidad</div>
                        <ul className="space-y-0.5 text-ink-2">
                          {[...u.assignments.map((a) => ({ ...a, k: 'Tarea' })), ...u.quizzes.map((q) => ({ ...q, k: 'Evaluación' }))].map((a) => <li key={`${a.k}${a.id}`}>{a.k}: {a.title} <span className="text-faint">· {fmtShort(a.due_at)}</span></li>)}
                          {!u.assignments.length && !u.quizzes.length && <li className="text-faint">—</li>}
                        </ul>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
            {Array.isArray(s.weekly_plan) && s.weekly_plan.length > 0 && (
              <Section icon={CalendarDays} title="VI-A. Cronograma semanal">
                <div className="overflow-hidden rounded-xl border border-line">
                  <table className="w-full text-[13px]">
                    <thead className="bg-sunken/70 text-left text-[11px] font-semibold text-faint uppercase">
                      <tr><th className="px-3 py-2">Sem.</th><th className="px-3 py-2">Unidad</th><th className="px-3 py-2">Tema</th><th className="px-3 py-2">Actividades</th><th className="px-3 py-2">Evidencia</th></tr>
                    </thead>
                    <tbody>
                      {s.weekly_plan.map((w, i) => (
                        <tr key={i} className="border-t border-line align-top break-inside-avoid">
                          <td className="px-3 py-2 font-semibold text-ink">{w.week}</td>
                          <td className="px-3 py-2 text-muted">{w.unit}</td>
                          <td className="px-3 py-2 text-ink">{w.topic}</td>
                          <td className="px-3 py-2 text-ink-2">{w.activity}</td>
                          <td className="px-3 py-2 text-muted">{w.evidence}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Section>
            )}
            <Section icon={GraduationCap} title="VII. Metodología"><p className="text-[14.5px] leading-relaxed text-ink-2">{s.methodology}</p></Section>
            <Section icon={Scale} title="VIII. Sistema de evaluación">
              <div className="overflow-hidden rounded-xl border border-line">
                <table className="w-full text-sm">
                  <thead className="bg-sunken text-left text-xs font-semibold text-muted uppercase print:bg-transparent"><tr><th className="px-4 py-2">Criterio de evaluación</th><th className="px-4 py-2 text-right">Peso</th></tr></thead>
                  <tbody className="divide-y divide-line">
                    {categories.map((cat) => <tr key={cat.id}><td className="px-4 py-2 text-ink">{cat.name}</td><td className="px-4 py-2 text-right font-semibold tabular-nums">{cat.weight}%</td></tr>)}
                    {categories.length === 0 && <tr><td colSpan={2} className="px-4 py-3 text-muted">Promedio simple de todas las actividades calificadas.</td></tr>}
                  </tbody>
                </table>
              </div>
              <ul className="mt-3 space-y-1 text-[13.5px] text-ink-2">
                <li>• Escala vigesimal (0 a 20). Nota mínima aprobatoria: <strong className="text-ink">{rules.min_grade}</strong>. La fracción igual o mayor a 0.5 se redondea a favor del estudiante.</li>
                <li>• Inasistencia injustificada mayor al <strong className="text-ink">{rules.max_absence_pct}%</strong> de las sesiones: desaprobado por inasistencia (DPI).</li>
                <li>• Nota final entre {rules.recovery_min} y {rules.recovery_max}: derecho a evaluación de recuperación; la nota obtenida reemplaza a la nota final.</li>
              </ul>
              {s.policies && <p className="mt-3 text-[13.5px] leading-relaxed text-muted">{s.policies}</p>}
            </Section>
            <div className="grid gap-6 sm:grid-cols-2">
              <Section icon={Layers} title="IX. Recursos"><List items={s.resources} /></Section>
              <Section icon={BookOpen} title="X. Bibliografía"><List items={s.bibliography} /></Section>
            </div>
            {(s.approved_by || s.approved_at) && (
              <div className="border-t border-line pt-4 text-xs text-muted">Aprobado por {s.approved_by || '—'}{s.approved_at ? ` · ${fmtDate(s.approved_at)}` : ''}</div>
            )}
          </div>

          <aside className="space-y-4 print:hidden">
            <Card className="p-4">
              <div className="text-xs font-semibold tracking-wide text-muted uppercase">Carga académica</div>
              <div className="mt-3 grid grid-cols-2 gap-3 text-center">
                <div className="rounded-xl bg-sunken p-3"><div className="font-display text-2xl text-ink">{c.credits}</div><div className="text-[11px] text-muted">créditos</div></div>
                <div className="rounded-xl bg-sunken p-3"><div className="font-display text-2xl text-ink">{c.hours_total}</div><div className="text-[11px] text-muted">horas</div></div>
              </div>
              <p className="mt-3 flex gap-1.5 text-[11.5px] leading-relaxed text-faint"><Clock size={12} className="mt-0.5 shrink-0" /> 1 crédito equivale a 16 horas teóricas o 32 horas prácticas (Ley 30512 y LAG).</p>
            </Card>
            <Card className="p-4">
              <div className="text-xs font-semibold tracking-wide text-muted uppercase">Criterios de evaluación</div>
              <div className="mt-3 space-y-2.5">
                {categories.map((cat) => (
                  <div key={cat.id}>
                    <div className="mb-1 flex justify-between text-[13px]"><span className="text-ink-2">{cat.name}</span><span className="font-semibold tabular-nums">{cat.weight}%</span></div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-sunken"><div className="h-full rounded-full bg-primary" style={{ width: `${cat.weight}%` }} /></div>
                  </div>
                ))}
              </div>
            </Card>
          </aside>
        </div>
      </Card>
    </div>
  );
}

const linesOf = (arr) => (arr || []).join('\n');

function SyllabusEditor({ data, onCancel, onSaved }) {
  const { toast } = useUi();
  const { course } = useCourse();
  const s = data.syllabus;
  const [form, setForm] = useState({
    summary: s.summary, competency: s.competency, capacities: linesOf(s.capacities), indicators: linesOf(s.indicators), methodology: s.methodology,
    resources: linesOf(s.resources), bibliography: linesOf(s.bibliography), policies: s.policies, approved_by: s.approved_by, approved_at: s.approved_at,
  });
  const [cats, setCats] = useState(data.categories.map((c) => ({ id: c.id, name: c.name, weight: c.weight })));
  const [saving, setSaving] = useState(false);
  const total = cats.reduce((t, c) => t + (Number(c.weight) || 0), 0);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const closed = course.status === 'closed';

  useEffect(() => { window.scrollTo({ top: 0 }); }, []);

  const save = async () => {
    if (cats.length && Math.abs(total - 100) > 0.01) return toast('Los pesos de los criterios deben sumar 100 %', 'error');
    setSaving(true);
    try {
      const body = { ...form, capacities: form.capacities.split('\n'), indicators: form.indicators.split('\n'), resources: form.resources.split('\n'), bibliography: form.bibliography.split('\n') };
      if (!closed) body.categories = cats;
      const r = await api.put(`/courses/${course.id}/syllabus`, body);
      toast('Sílabo actualizado');
      onSaved(r);
    } catch (e) { toast(e.message, 'error'); } finally { setSaving(false); }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="font-display text-2xl font-semibold text-ink">Editar sílabo</h2><p className="text-sm text-muted">Un ítem por línea en capacidades, indicadores, recursos y bibliografía.</p></div>
        <div className="flex gap-2"><Button variant="ghost" icon={X} onClick={onCancel}>Cancelar</Button><Button icon={Save} loading={saving} onClick={save}>Guardar sílabo</Button></div>
      </div>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="space-y-4 p-5 sm:p-6">
          <Field label="Sumilla" hint="Descripción breve de la unidad didáctica."><Textarea rows={3} value={form.summary} onChange={set('summary')} /></Field>
          <Field label="Competencia (unidad de competencia del perfil de egreso)"><Textarea rows={3} value={form.competency} onChange={set('competency')} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Capacidades"><Textarea rows={6} value={form.capacities} onChange={set('capacities')} placeholder={'Una capacidad por línea'} /></Field>
            <Field label="Indicadores de logro"><Textarea rows={6} value={form.indicators} onChange={set('indicators')} placeholder={'Un indicador por línea'} /></Field>
          </div>
          <Field label="Metodología"><Textarea rows={3} value={form.methodology} onChange={set('methodology')} /></Field>
          <Field label="Normas de evaluación y convivencia"><Textarea rows={3} value={form.policies} onChange={set('policies')} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Recursos"><Textarea rows={4} value={form.resources} onChange={set('resources')} /></Field>
            <Field label="Bibliografía"><Textarea rows={4} value={form.bibliography} onChange={set('bibliography')} placeholder="Apellido, N. (Año). Título. Editorial." /></Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Aprobado por"><Input value={form.approved_by} onChange={set('approved_by')} placeholder="Coordinación Académica" /></Field>
            <Field label="Fecha de aprobación"><Input type="date" value={form.approved_at} onChange={set('approved_at')} /></Field>
          </div>
        </Card>
        <Card className="h-fit space-y-3 p-5">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-ink">Criterios de evaluación</h3>
            <span className={cx('text-sm font-semibold tabular-nums', Math.abs(total - 100) < 0.01 ? 'text-success' : 'text-danger')}>{total}%</span>
          </div>
          <p className="text-xs text-muted">Cada tarea y evaluación se asigna a un criterio. Los pesos deben sumar 100 %.{closed && ' Con el acta cerrada no se modifican.'}</p>
          <div className="space-y-2">
            {cats.map((c, i) => (
              <div key={c.id || `n${i}`} className="flex items-center gap-2">
                <Input value={c.name} disabled={closed} onChange={(e) => setCats(cats.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} placeholder="Nombre del criterio" className="!py-1.5 text-sm" />
                <Input type="number" min="0" max="100" disabled={closed} value={c.weight} onChange={(e) => setCats(cats.map((x, j) => (j === i ? { ...x, weight: e.target.value } : x)))} className="!w-20 !py-1.5 text-sm" aria-label="Peso" />
                <span className="text-xs text-muted">%</span>
                {!closed && <IconButton icon={Trash2} size={15} label="Quitar criterio" onClick={() => setCats(cats.filter((_, j) => j !== i))} />}
              </div>
            ))}
          </div>
          {!closed && <Button variant="secondary" size="sm" icon={Plus} onClick={() => setCats([...cats, { name: '', weight: 0 }])}>Agregar criterio</Button>}
          <div className="rounded-xl bg-sunken p-3 text-xs text-muted">
            Sugerencia LAG: evaluación de proceso 40 % · producto 30 % · final 30 %. Al quitar un criterio, sus actividades pasan a no ponderar hasta que se les asigne otro.
          </div>
        </Card>
      </div>
    </div>
  );
}
