import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, GraduationCap, ClipboardList, ListChecks, Lock, LockOpen, FileCheck2, UserCheck, AlertTriangle, MoreHorizontal, UserMinus, RotateCcw, Printer, Info } from 'lucide-react';
import { api, useApi } from '../../../lib/api.js';
import { useUi } from '../../../lib/context.jsx';
import { Avatar, Badge, Button, Card, EmptyState, ErrorState, Field, Input, Modal, ProgressRing, Skeleton, Stat, Dropdown, MenuItem, Textarea, cx } from '../../../components/ui.jsx';
import { ConditionBadge } from '../../../components/lms.jsx';
import { fmtDate, fmtDateTime, fmtGrade, fmtPct, fullName, gradeTone, conditionOf, downloadCsv } from '../../../lib/format.js';
import { useCourse } from './CourseLayout.jsx';

const toneText = { success: 'text-success', danger: 'text-danger', neutral: 'text-faint' };
const finalColor = (final) => (final.final == null ? 'var(--c-line)' : final.condition === 'aprobado' ? 'var(--c-success)' : final.condition === 'pendiente' ? 'var(--c-primary)' : 'var(--c-danger)');

export default function CourseGrades() {
  const { course, canEdit } = useCourse();
  const { data, loading, error, reload } = useApi(`/courses/${course.id}/grades`);
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (loading) return <Skeleton className="h-72 rounded-2xl" />;
  return canEdit ? <Gradebook course={course} data={data} reload={reload} /> : <MyGrades course={course} data={data} />;
}

/* ---------------- Estudiante ---------------- */

function MyGrades({ course, data }) {
  const { mine: g, attendance: att, final, rules, categories, closed } = data;
  const byCat = (id) => g.items.filter((i) => i.category_id === id);
  const uncategorized = categories.length ? g.items.filter((i) => !i.category_id) : g.items;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="space-y-4">
          <Card className="p-6 text-center">
            <ProgressRing value={final.final != null ? (final.final / 20) * 100 : g.average != null ? (g.average / 20) * 100 : 0} size={132} stroke={10} color={finalColor(final)}>
              <div className="leading-none"><span className="font-display text-4xl">{fmtGrade(closed ? final.final : g.average)}</span><div className="mt-1 text-[10px] font-semibold text-muted uppercase">{closed ? 'Nota final' : 'Promedio'}</div></div>
            </ProgressRing>
            <div className="mt-3"><ConditionBadge condition={final.condition} /></div>
            <div className="mt-2 text-sm text-muted">{g.graded} de {g.total} actividades calificadas</div>
            {!closed && g.average != null && (
              <div className="mt-3 rounded-xl bg-sunken p-3 text-left text-xs text-muted">
                <div className="flex justify-between"><span>Promedio ponderado</span><strong className="text-ink">{fmtGrade(g.average)}</strong></div>
                <div className="flex justify-between"><span>Nota final proyectada (redondeo 0.5↑)</span><strong className="text-ink">{fmtGrade(final.base)}</strong></div>
                {final.recovery != null && <div className="flex justify-between"><span>Recuperación</span><strong className="text-ink">{fmtGrade(final.recovery)}</strong></div>}
              </div>
            )}
            {closed && (
              <div className="mt-3 flex items-start gap-2 rounded-xl bg-sunken p-3 text-left text-xs text-muted">
                <Lock size={13} className="mt-0.5 shrink-0" /> Acta cerrada el {fmtDate(final.closed_at)}. {final.recovery != null ? `Incluye evaluación de recuperación (${fmtGrade(final.recovery)}).` : ''}{final.observations ? ` Observación: ${final.observations}` : ''}
              </div>
            )}
            {final.can_recover && (
              <div className="mt-3 flex items-start gap-2 rounded-xl bg-warn-soft p-3 text-left text-xs text-warn"><Info size={13} className="mt-0.5 shrink-0" /> Con nota final entre {rules.recovery_min} y {rules.recovery_max} tienes derecho a una evaluación de recuperación. Coordina con tu docente.</div>
            )}
          </Card>
          <Card className="p-5">
            <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-semibold text-ink">Asistencia</h3><Link to={`/app/cursos/${course.id}/asistencia`} className="text-xs font-medium text-primary-ink hover:underline">Ver detalle</Link></div>
            <div className="flex items-center gap-4">
              <ProgressRing value={att.attendance_pct ?? 0} size={56} stroke={6} color={att.dpi ? 'var(--c-danger)' : att.at_risk ? 'var(--c-warn)' : 'var(--c-success)'}>{fmtPct(att.attendance_pct)}</ProgressRing>
              <div className="text-xs text-muted">
                <div><strong className="text-ink">{att.falta}</strong> {att.falta === 1 ? 'falta' : 'faltas'} de {att.sessions} sesiones ({fmtPct(att.absence_pct)})</div>
                <div className="mt-0.5">Límite: {rules.max_absence_pct}% de inasistencias</div>
                {att.dpi && <div className="mt-1 font-semibold text-danger">Supera el límite (DPI)</div>}
              </div>
            </div>
          </Card>
          <Card className="p-4 text-xs leading-relaxed text-muted">
            <div className="mb-1 font-semibold text-ink">Reglas de evaluación</div>
            Escala vigesimal (0–20). Nota mínima aprobatoria <strong className="text-ink">{rules.min_grade}</strong>. La fracción 0.5 o más se redondea a favor del estudiante. Más del {rules.max_absence_pct}% de inasistencias injustificadas desaprueba la unidad didáctica.
          </Card>
        </div>

        <div className="space-y-4">
          {categories.length > 0 && (
            <Card className="p-5">
              <h3 className="mb-3 text-sm font-semibold text-ink">Criterios de evaluación</h3>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {g.categories.map((c) => (
                  <div key={c.id} className="rounded-xl border border-line p-3.5">
                    <div className="flex items-start justify-between gap-2"><div className="text-[13px] font-medium text-ink">{c.name}</div><Badge>{c.weight}%</Badge></div>
                    <div className={cx('mt-2 text-2xl font-semibold tabular-nums', c.average == null ? 'text-faint' : toneText[gradeTone(c.average)])}>{fmtGrade(c.average)}</div>
                    <div className="text-[11px] text-muted">{c.graded}/{c.items} calificadas · aporta {c.average != null ? fmtGrade(Math.round(c.average * c.weight) / 100) : '—'} pts</div>
                  </div>
                ))}
              </div>
            </Card>
          )}
          <Card className="overflow-hidden">
            {g.items.length === 0 ? <EmptyState icon={GraduationCap} title="Sin actividades calificables" /> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-sunken text-left text-xs font-semibold tracking-wide text-muted uppercase">
                    <tr><th className="px-5 py-3">Actividad</th><th className="px-3 py-3">Fecha</th><th className="px-3 py-3">Estado</th><th className="px-5 py-3 text-right">Nota</th></tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {(categories.length ? categories : [{ id: null, name: 'Actividades' }]).map((cat) => {
                      const items = categories.length ? byCat(cat.id) : g.items;
                      if (!items.length) return null;
                      return [
                        categories.length > 0 && <tr key={`h${cat.id}`} className="bg-sunken/50"><td colSpan={4} className="px-5 py-1.5 text-[11px] font-semibold text-muted uppercase">{cat.name} · {cat.weight}%</td></tr>,
                        ...items.map((i) => <GradeRow key={`${i.kind}${i.id}`} i={i} course={course} />),
                      ];
                    })}
                    {uncategorized.length > 0 && categories.length > 0 && [
                      <tr key="hu" className="bg-sunken/50"><td colSpan={4} className="px-5 py-1.5 text-[11px] font-semibold text-muted uppercase">Sin criterio asignado (no pondera)</td></tr>,
                      ...uncategorized.map((i) => <GradeRow key={`${i.kind}${i.id}`} i={i} course={course} />),
                    ]}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function GradeRow({ i, course }) {
  return (
    <tr className="hover:bg-sunken/50">
      <td className="px-5 py-3">
        <Link to={`/app/cursos/${course.id}/${i.kind === 'quiz' ? 'evaluaciones' : 'tareas'}/${i.id}`} className="flex items-center gap-2.5 font-medium text-ink hover:text-primary-ink">
          {i.kind === 'quiz' ? <ListChecks size={16} className="shrink-0 text-info" /> : <ClipboardList size={16} className="shrink-0 text-primary" />}{i.title}
        </Link>
        {i.feedback && <div className="mt-1 ml-6.5 line-clamp-1 text-xs text-muted">“{i.feedback}”</div>}
      </td>
      <td className="px-3 py-3 whitespace-nowrap text-muted">{fmtDate(i.due_at)}</td>
      <td className="px-3 py-3">
        {i.score != null ? <Badge tone="success">Calificado</Badge> : i.submitted ? <Badge tone="info">En revisión</Badge> : new Date(i.due_at) < new Date() ? <Badge tone="danger">No entregado</Badge> : <Badge>Pendiente</Badge>}
      </td>
      <td className={cx('px-5 py-3 text-right text-base font-semibold tabular-nums', toneText[gradeTone(i.score, i.points)])}>{fmtGrade(i.score)}<span className="text-xs font-normal text-faint">/{i.points}</span></td>
    </tr>
  );
}

/* ---------------- Docente: registro de evaluación ---------------- */

function Gradebook({ course, data, reload }) {
  const { toast, confirm } = useUi();
  const { reloadCourse } = useCourse();
  const { columns, rows, categories, rules, stats, closed, closed_at } = data;
  const [view, setView] = useState('summary');
  const [editing, setEditing] = useState(null);
  const [closing, setClosing] = useState(false);
  const colsByCat = useMemo(() => {
    const groups = categories.map((c) => ({ cat: c, cols: columns.filter((x) => x.category_id === c.id) }));
    const rest = columns.filter((x) => !x.category_id);
    if (rest.length || !categories.length) groups.push({ cat: null, cols: rest });
    return groups.filter((g) => g.cols.length);
  }, [columns, categories]);

  const exportCsv = () => downloadCsv(`registro-${course.code}.csv`,
    ['Código', 'Estudiante', ...columns.map((c) => c.title), ...categories.map((c) => `${c.name} (${c.weight}%)`), 'Promedio ponderado', 'Asistencia %', 'Recuperación', 'Nota final', 'Condición'],
    rows.map((r) => [r.student.code, fullName(r.student), ...r.items.map((i) => i.score ?? ''), ...r.categories.map((c) => c.average ?? ''), r.weighted ?? '', r.attendance.attendance_pct ?? '', r.final.recovery ?? '', r.final.final ?? '', conditionOf(r.final.condition).label]));

  const closeActa = async () => {
    if (stats.pendientes > 0) return toast(`${stats.pendientes} estudiante(s) no tienen calificaciones. Califica o retíralos antes de cerrar.`, 'error');
    const ok = await confirm({
      title: 'Cerrar acta de evaluación',
      message: `Se registrará la nota final y la condición de ${stats.students} estudiantes (${stats.aprobados} aprobados, ${stats.desaprobados} desaprobados, ${stats.dpi} DPI). Después del cierre no se podrán modificar notas, asistencia ni actividades; solo Administración puede reabrir el acta.`,
      confirmText: 'Cerrar acta', danger: true,
    });
    if (!ok) return;
    setClosing(true);
    try {
      await api.post(`/courses/${course.id}/acta/close`);
      toast('Acta cerrada. Los estudiantes fueron notificados.');
      reload(); reloadCourse();
    } catch (e) { toast(e.message, 'error'); } finally { setClosing(false); }
  };

  const withdraw = async (r) => {
    const ok = await confirm({ title: `Retirar a ${fullName(r.student)}`, message: 'El estudiante dejará de recibir actividades del curso y figurará como "Retirado" en el acta. Su historial se conserva.', confirmText: 'Retirar', danger: true });
    if (!ok) return;
    try { await api.put(`/courses/${course.id}/enrollments/${r.student.id}/status`, { status: 'retirado' }); toast('Estudiante retirado del curso'); reload(); } catch (e) { toast(e.message, 'error'); }
  };
  const reinstate = async (r) => {
    try { await api.put(`/courses/${course.id}/enrollments/${r.student.id}/status`, { status: 'matriculado' }); toast('Matrícula restablecida'); reload(); } catch (e) { toast(e.message, 'error'); }
  };

  return (
    <div className="space-y-5">
      {closed ? (
        <Card className="flex flex-col gap-3 border-line bg-sunken p-4 sm:flex-row sm:items-center">
          <Lock size={18} className="shrink-0 text-muted" />
          <div className="flex-1 text-sm text-ink-2"><strong className="text-ink">Acta cerrada</strong> el {fmtDateTime(closed_at)}. Las notas son definitivas. Para corregir un error, solicita la reapertura a Administración (queda registrada en la auditoría).</div>
          <Button variant="secondary" icon={Printer} to={`/app/cursos/${course.id}/acta`}>Ver acta</Button>
        </Card>
      ) : (
        <Card className="flex flex-col gap-3 border-primary/20 bg-primary-soft/40 p-4 sm:flex-row sm:items-center">
          <FileCheck2 size={18} className="shrink-0 text-primary" />
          <div className="flex-1 text-sm text-ink-2"><strong className="text-ink">Registro de evaluación abierto.</strong> Al terminar el periodo, revisa las notas y cierra el acta para oficializar la nota final y la condición de cada estudiante.</div>
          <div className="flex gap-2"><Button variant="secondary" icon={Printer} to={`/app/cursos/${course.id}/acta`}>Vista previa del acta</Button><Button icon={LockOpen} loading={closing} onClick={closeActa}>Cerrar acta</Button></div>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        {[
          ['Estudiantes', stats.students, 'neutral'], ['Aprobados', stats.aprobados, 'success'], ['Desaprobados', stats.desaprobados, 'danger'], ['DPI', stats.dpi, 'danger'],
          ['Promedio', fmtGrade(stats.average), gradeTone(stats.average)], ['Asistencia', fmtPct(stats.attendance), 'info'],
        ].map(([l, v, t]) => (
          <Card key={l} className="p-3.5"><div className="text-[11px] font-semibold tracking-wide text-muted uppercase">{l}</div><div className={cx('mt-1 text-2xl font-semibold tabular-nums', t === 'success' ? 'text-success' : t === 'danger' ? 'text-danger' : 'text-ink')}>{v}</div></Card>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-xl border border-line bg-sunken p-1 text-[13px] font-medium">
          {[['summary', 'Resumen por criterio'], ['detail', 'Detalle por actividad']].map(([v, l]) => <button key={v} onClick={() => setView(v)} className={cx('rounded-lg px-3 py-1.5 transition', view === v ? 'bg-surface text-ink shadow-soft' : 'text-muted hover:text-ink')}>{l}</button>)}
        </div>
        <div className="flex items-center gap-2"><span className="hidden text-xs text-muted sm:block">Nota mínima {rules.min_grade} · límite de inasistencias {rules.max_absence_pct}%</span><Button variant="secondary" size="sm" icon={Download} onClick={exportCsv}>Exportar CSV</Button></div>
      </div>

      <Card className="overflow-hidden">
        <div className="scrollbar-thin overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-sunken text-xs text-muted">
              {view === 'detail' && (
                <tr className="border-b border-line">
                  <th className="sticky left-0 z-10 bg-sunken" />
                  {colsByCat.map((g, i) => <th key={i} colSpan={g.cols.length} className="px-2 pt-2 text-center font-semibold text-ink-2">{g.cat ? `${g.cat.name} · ${g.cat.weight}%` : 'Sin criterio'}</th>)}
                  <th colSpan={5} />
                </tr>
              )}
              <tr>
                <th className="sticky left-0 z-10 bg-sunken px-4 py-3 text-left font-semibold">Estudiante</th>
                {view === 'summary'
                  ? categories.map((c) => <th key={c.id} className="min-w-[90px] px-2 py-3 text-center font-medium">{c.name}<div className="text-[10px] font-normal text-faint">{c.weight}%</div></th>)
                  : colsByCat.flatMap((g) => g.cols).map((c) => (
                    <th key={`${c.kind}${c.id}`} className="min-w-[92px] px-2 py-3 text-center font-medium">
                      <Link to={`/app/cursos/${course.id}/${c.kind === 'quiz' ? 'evaluaciones' : 'tareas'}/${c.id}`} className="line-clamp-2 hover:text-primary-ink" title={c.title}>{c.title}</Link>
                    </th>
                  ))}
                <th className="px-2 py-3 text-center font-semibold">Prom.</th>
                <th className="px-2 py-3 text-center font-semibold"><span className="inline-flex items-center gap-1"><UserCheck size={12} /> Asist.</span></th>
                <th className="px-2 py-3 text-center font-semibold">Recup.</th>
                <th className="px-2 py-3 text-center font-semibold">Final</th>
                <th className="px-3 py-3 text-center font-semibold">Condición</th>
                <th className="px-2 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => {
                const retired = r.student.enrollment_status === 'retirado';
                return (
                  <tr key={r.student.id} className={cx('hover:bg-sunken/40', retired && 'opacity-50')}>
                    <td className="sticky left-0 z-10 bg-surface px-4 py-2">
                      <div className="flex items-center gap-2.5"><Avatar user={r.student} size={28} /><div className="min-w-0"><div className="truncate font-medium text-ink">{fullName(r.student)}</div><div className="text-[11px] text-faint">{r.student.code}{retired ? ' · Retirado' : ''}</div></div></div>
                    </td>
                    {view === 'summary'
                      ? r.categories.map((c) => <td key={c.id} className={cx('px-2 py-2 text-center tabular-nums', toneText[gradeTone(c.average)])}>{c.average == null ? <span className="text-faint">—</span> : fmtGrade(c.average)}<div className="text-[10px] text-faint">{c.graded}/{c.items}</div></td>)
                      : colsByCat.flatMap((g) => g.cols).map((c) => {
                        const i = r.items.find((x) => x.kind === c.kind && x.id === c.id);
                        return <td key={`${c.kind}${c.id}`} className={cx('px-2 py-2 text-center tabular-nums', toneText[gradeTone(i?.score, c.points)])}>{i?.score != null ? fmtGrade(i.score) : i?.submitted ? <span className="text-xs text-warn">Por calif.</span> : '—'}</td>;
                      })}
                    <td className={cx('px-2 py-2 text-center font-semibold tabular-nums', toneText[gradeTone(r.weighted)])}>{fmtGrade(r.weighted)}</td>
                    <td className={cx('px-2 py-2 text-center tabular-nums', r.attendance.dpi ? 'text-danger' : r.attendance.at_risk ? 'text-warn' : 'text-ink-2')}>{fmtPct(r.attendance.attendance_pct)}{r.attendance.dpi && <AlertTriangle size={11} className="ml-1 inline" />}</td>
                    <td className="px-2 py-2 text-center tabular-nums">{r.final.recovery != null ? fmtGrade(r.final.recovery) : r.final.can_recover ? <span className="text-[11px] text-warn">Habilitado</span> : '—'}</td>
                    <td className="px-2 py-2 text-center"><span className={cx('inline-flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-base font-bold tabular-nums', r.final.final == null ? 'bg-sunken text-faint' : r.final.condition === 'aprobado' ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger')}>{fmtGrade(r.final.final)}</span></td>
                    <td className="px-3 py-2 text-center"><ConditionBadge condition={r.final.condition} short /></td>
                    <td className="px-2 py-2">
                      {!closed && (
                        <Dropdown trigger={({ toggle }) => <button onClick={toggle} className="rounded-lg p-1.5 text-muted hover:bg-sunken hover:text-ink" aria-label="Acciones"><MoreHorizontal size={16} /></button>}>
                          <MenuItem icon={RotateCcw} onClick={() => setEditing(r)}>{r.final.can_recover || r.final.recovery != null ? 'Nota de recuperación' : 'Observación del acta'}</MenuItem>
                          {retired ? <MenuItem icon={UserCheck} onClick={() => reinstate(r)}>Restablecer matrícula</MenuItem> : <MenuItem icon={UserMinus} danger onClick={() => withdraw(r)}>Retirar del curso</MenuItem>}
                        </Dropdown>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
      {editing && <RecoveryModal course={course} row={editing} rules={rules} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />}
    </div>
  );
}

function RecoveryModal({ course, row, rules, onClose, onSaved }) {
  const { toast } = useUi();
  const eligible = row.final.can_recover || row.final.recovery != null;
  const [recovery, setRecovery] = useState(row.final.recovery ?? '');
  const [observations, setObservations] = useState(row.final.observations || '');
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      const body = { observations };
      if (eligible) body.recovery = recovery === '' ? null : Number(recovery);
      await api.put(`/courses/${course.id}/acta/${row.student.id}`, body);
      toast('Registro actualizado');
      onSaved();
    } catch (e) { toast(e.message, 'error'); } finally { setSaving(false); }
  };
  return (
    <Modal open onClose={onClose} size="sm" title={fullName(row.student)} description={`${row.student.code} · Promedio ${fmtGrade(row.weighted)} · Nota final ${fmtGrade(row.final.final)}`}
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button onClick={save} loading={saving}>Guardar</Button></>}>
      <div className="space-y-4">
        {eligible ? (
          <Field label="Nota de la evaluación de recuperación (0–20)" hint={`Reemplaza la nota final. Habilitada por nota final entre ${rules.recovery_min} y ${rules.recovery_max}.`}>
            <Input type="number" min="0" max="20" step="1" value={recovery} onChange={(e) => setRecovery(e.target.value)} className="text-lg font-semibold" />
          </Field>
        ) : (
          <div className="rounded-xl bg-sunken p-3 text-xs text-muted">La recuperación solo se habilita con nota final entre {rules.recovery_min} y {rules.recovery_max} y sin DPI. Condición actual: <strong className="text-ink">{conditionOf(row.final.condition).label}</strong>.</div>
        )}
        <Field label="Observación para el acta" hint="Opcional. Aparece en el acta y en el récord del estudiante."><Textarea rows={3} value={observations} onChange={(e) => setObservations(e.target.value)} maxLength={300} /></Field>
      </div>
    </Modal>
  );
}
