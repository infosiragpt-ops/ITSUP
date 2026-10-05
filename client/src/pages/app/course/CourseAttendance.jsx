import { useEffect, useMemo, useState } from 'react';
import { UserCheck, Download, AlertTriangle, CheckCircle2, CalendarDays, Info, ClipboardCheck } from 'lucide-react';
import { api, useApi } from '../../../lib/api.js';
import { useUi } from '../../../lib/context.jsx';
import { Avatar, Badge, Button, Card, EmptyState, ErrorState, Modal, ProgressBar, Skeleton, Stat, Input, cx } from '../../../components/ui.jsx';
import { ClosedNotice } from '../../../components/lms.jsx';
import { ATTENDANCE, fmtDate, fmtShort, fmtTime, fmtLong, fmtPct, fullName, downloadCsv } from '../../../lib/format.js';
import { useCourse } from './CourseLayout.jsx';

const toneBg = { success: 'bg-success-soft text-success', warn: 'bg-warn-soft text-warn', danger: 'bg-danger-soft text-danger', info: 'bg-info-soft text-info' };

export default function CourseAttendance() {
  const { course, canEdit } = useCourse();
  const { data, loading, error, reload } = useApi(`/courses/${course.id}/attendance`);
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (loading) return <Skeleton className="h-80 rounded-2xl" />;
  return canEdit ? <TeacherAttendance data={data} onChanged={reload} /> : <StudentAttendance mine={data.mine} rules={data.rules} />;
}

/* ---------------- Estudiante ---------------- */

function StudentAttendance({ mine, rules }) {
  const { course } = useCourse();
  const past = mine.detail.filter((d) => d.status);
  const tone = mine.dpi ? 'danger' : mine.at_risk ? 'warn' : 'success';
  const remaining = Math.max(0, Math.floor((rules.max_absence_pct / 100) * mine.sessions) - mine.falta);
  return (
    <div className="space-y-5">
      <ClosedNotice course={course} compact />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat icon={UserCheck} label="Asistencia" value={fmtPct(mine.attendance_pct)} hint={`${mine.presente + mine.tardanza} de ${mine.sessions} sesiones`} tone={tone === 'danger' ? 'warn' : tone === 'warn' ? 'warn' : 'success'} />
        <Stat icon={AlertTriangle} label="Inasistencias" value={fmtPct(mine.absence_pct)} hint={`Límite permitido: ${rules.max_absence_pct}%`} tone={mine.dpi ? 'warn' : 'info'} />
        <Stat icon={CalendarDays} label="Tardanzas" value={mine.tardanza} hint="Cuentan como asistencia" />
        <Stat icon={CheckCircle2} label="Justificadas" value={mine.justificada} hint="No cuentan para el límite" tone="success" />
      </div>
      <Card className={cx('p-5', mine.dpi ? 'border-danger/40 bg-danger-soft/40' : mine.at_risk ? 'border-warn/40 bg-warn-soft/40' : '')}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className={cx('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', toneBg[tone])}>{mine.dpi ? <AlertTriangle size={19} /> : <Info size={19} />}</span>
            <div>
              <div className="font-semibold text-ink">
                {mine.dpi ? 'Superaste el límite de inasistencias' : mine.at_risk ? 'Estás cerca del límite de inasistencias' : 'Tu asistencia está en orden'}
              </div>
              <p className="mt-0.5 text-sm text-muted">
                {mine.sessions === 0 ? 'Aún no hay sesiones con asistencia registrada.' : mine.dpi
                  ? `Según los Lineamientos Académicos, más del ${rules.max_absence_pct}% de inasistencias injustificadas desaprueba la unidad didáctica. Comunícate con tu docente o tutor para justificar faltas.`
                  : `Puedes faltar ${remaining} ${remaining === 1 ? 'sesión más' : 'sesiones más'} sin superar el ${rules.max_absence_pct}% permitido. Las faltas justificadas no cuentan.`}
              </p>
            </div>
          </div>
        </div>
        {mine.sessions > 0 && (
          <div className="mt-4">
            <div className="mb-1 flex justify-between text-xs text-muted"><span>Inasistencias acumuladas</span><span>{mine.falta} de {Math.floor((rules.max_absence_pct / 100) * mine.sessions)} permitidas</span></div>
            <ProgressBar value={Math.min(100, (mine.absence_pct / rules.max_absence_pct) * 100)} tone={mine.dpi ? 'warn' : mine.at_risk ? 'warn' : 'success'} />
          </div>
        )}
      </Card>
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-5 py-3"><h3 className="font-semibold text-ink">Registro por sesión</h3><span className="text-xs text-muted">{past.length} sesiones registradas</span></div>
        {past.length === 0 ? <EmptyState compact icon={CalendarDays} title="Sin registros todavía" description="Tu docente registra la asistencia después de cada sesión en vivo." /> : (
          <ul className="divide-y divide-line">
            {mine.detail.map((d) => {
              const a = d.status ? ATTENDANCE[d.status] : null;
              return (
                <li key={d.session_id} className="flex items-center gap-3 px-5 py-3">
                  <div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg bg-sunken text-center leading-none">
                    <span className="text-[9px] font-semibold text-muted uppercase">{fmtShort(d.starts_at).split(' ')[1]}</span><span className="text-sm font-bold text-ink">{fmtShort(d.starts_at).split(' ')[0]}</span>
                  </div>
                  <div className="min-w-0 flex-1"><div className="truncate text-sm font-medium text-ink">{d.title}</div><div className="text-xs text-muted">{fmtTime(d.starts_at)}{d.note ? ` · ${d.note}` : ''}</div></div>
                  {a ? <Badge tone={a.tone} dot>{a.label}</Badge> : <span className="text-xs text-faint">Sin registrar</span>}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}

/* ---------------- Docente ---------------- */

function TeacherAttendance({ data, onChanged }) {
  const { course } = useCourse();
  const [editing, setEditing] = useState(null);
  const [q, setQ] = useState('');
  const { sessions, students, rules, closed } = data;
  const pending = sessions.filter((s) => !s.taken);
  const list = students.filter((s) => !q || fullName(s).toLowerCase().includes(q.toLowerCase()));
  const dpi = students.filter((s) => s.summary.dpi).length;
  const risk = students.filter((s) => s.summary.at_risk && !s.summary.dpi).length;
  const avg = useMemo(() => { const v = students.map((s) => s.summary.attendance_pct).filter((x) => x != null); return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null; }, [students]);

  const exportCsv = () => downloadCsv(`asistencia-${course.code}.csv`,
    ['Código', 'Estudiante', ...sessions.map((s) => fmtDate(s.starts_at)), 'Asistencia %', 'Inasistencia %', 'Faltas', 'Condición'],
    students.map((s) => [s.code, fullName(s), ...s.cells.map((c) => (c ? ATTENDANCE[c].short : '')), s.summary.attendance_pct ?? '', s.summary.absence_pct, s.summary.falta, s.summary.dpi ? 'DPI' : '']));

  return (
    <div className="space-y-5">
      <ClosedNotice course={course} compact />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat icon={UserCheck} label="Asistencia promedio" value={fmtPct(avg)} hint={`${sessions.length} sesiones dictadas`} tone="success" />
        <Stat icon={ClipboardCheck} label="Por registrar" value={pending.length} hint={pending.length ? 'Sesiones sin asistencia' : 'Todo al día'} tone={pending.length ? 'warn' : 'success'} />
        <Stat icon={AlertTriangle} label="Supera el límite (DPI)" value={dpi} hint={`Más del ${rules.max_absence_pct}% de faltas`} tone={dpi ? 'warn' : 'info'} />
        <Stat icon={Info} label="En riesgo" value={risk} hint="Cerca del límite" tone={risk ? 'warn' : 'info'} />
      </div>

      {pending.length > 0 && !closed && (
        <Card className="flex flex-col gap-3 border-warn/30 bg-warn-soft/40 p-4 sm:flex-row sm:items-center">
          <AlertTriangle size={18} className="shrink-0 text-warn" />
          <div className="flex-1 text-sm text-ink-2"><strong className="text-ink">{pending.length} {pending.length === 1 ? 'sesión dictada sin asistencia registrada' : 'sesiones dictadas sin asistencia registrada'}.</strong> El registro de asistencia es parte del registro de evaluación oficial.</div>
          <Button size="sm" onClick={() => setEditing(pending[pending.length - 1])}>Registrar {fmtShort(pending[pending.length - 1].starts_at)}</Button>
        </Card>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar estudiante" className="sm:max-w-xs" />
        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-2 text-[11px] text-muted md:flex">{Object.entries(ATTENDANCE).map(([k, a]) => <span key={k} className="flex items-center gap-1"><span className={cx('inline-flex h-4 w-4 items-center justify-center rounded text-[9px] font-bold', toneBg[a.tone])}>{a.short}</span>{a.label}</span>)}</div>
          <Button variant="secondary" size="sm" icon={Download} onClick={exportCsv}>Exportar CSV</Button>
        </div>
      </div>

      <Card className="overflow-hidden">
        {sessions.length === 0 ? <EmptyState icon={CalendarDays} title="Aún no se dictó ninguna sesión" description="La asistencia se registra por cada sesión en vivo realizada." /> : (
          <div className="scrollbar-thin overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-sunken text-xs text-muted">
                <tr>
                  <th className="sticky left-0 z-10 bg-sunken px-4 py-2.5 text-left font-semibold">Estudiante</th>
                  {sessions.map((s) => (
                    <th key={s.id} className="px-1 py-2 text-center font-medium">
                      <button onClick={() => setEditing(s)} disabled={closed} title={`${s.title} · ${fmtLong(s.starts_at)}`}
                        className={cx('flex w-12 flex-col items-center rounded-lg px-1 py-1 leading-tight transition hover:bg-surface disabled:cursor-default', !s.taken && 'text-warn')}>
                        <span className="text-[10px] uppercase">{fmtShort(s.starts_at).split(' ')[1]}</span><span className="text-[13px] font-bold text-ink">{fmtShort(s.starts_at).split(' ')[0]}</span>
                        {!s.taken && <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-warn" />}
                      </button>
                    </th>
                  ))}
                  <th className="px-3 py-2.5 text-center font-semibold">Asist.</th>
                  <th className="px-3 py-2.5 text-center font-semibold">Faltas</th>
                  <th className="px-3 py-2.5 text-center font-semibold">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {list.map((s) => (
                  <tr key={s.id} className={cx('hover:bg-sunken/40', s.enrollment_status === 'retirado' && 'opacity-50')}>
                    <td className="sticky left-0 z-10 bg-surface px-4 py-2">
                      <div className="flex items-center gap-2.5"><Avatar user={s} size={28} /><div className="min-w-0"><div className="truncate font-medium text-ink">{fullName(s)}</div><div className="text-[11px] text-faint">{s.code}</div></div></div>
                    </td>
                    {s.cells.map((c, i) => {
                      const a = c ? ATTENDANCE[c] : null;
                      return <td key={i} className="px-1 py-2 text-center"><span className={cx('inline-flex h-6 w-6 items-center justify-center rounded-md text-[11px] font-bold', a ? toneBg[a.tone] : 'bg-sunken text-faint')}>{a ? a.short : '·'}</span></td>;
                    })}
                    <td className="px-3 py-2 text-center font-semibold tabular-nums">{fmtPct(s.summary.attendance_pct)}</td>
                    <td className="px-3 py-2 text-center tabular-nums">{s.summary.falta}<span className="text-faint"> / {fmtPct(s.summary.absence_pct)}</span></td>
                    <td className="px-3 py-2 text-center">
                      {s.enrollment_status === 'retirado' ? <Badge>Retirado</Badge> : s.summary.dpi ? <Badge tone="danger">DPI</Badge> : s.summary.at_risk ? <Badge tone="warn">En riesgo</Badge> : <Badge tone="success">OK</Badge>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      {editing && <AttendanceModal session={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); onChanged(); }} />}
    </div>
  );
}

/** Registro de asistencia de una sesión. Reutilizado desde la pestaña Sesiones en vivo. */
export function AttendanceModal({ session, onClose, onSaved }) {
  const { toast } = useUi();
  const [rows, setRows] = useState(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    api.get(`/sessions/${session.id}/attendance`).then((r) => setRows(r.students.map((s) => ({ ...s, status: s.status || 'presente', changed: !s.status })))).catch((e) => toast(e.message, 'error'));
  }, [session.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const setAll = (status) => setRows((r) => r.map((x) => ({ ...x, status })));
  const save = async () => {
    setSaving(true);
    try {
      await api.put(`/sessions/${session.id}/attendance`, { records: rows.filter((r) => r.enrollment_status !== 'retirado').map((r) => ({ user_id: r.id, status: r.status, note: r.note || null })) });
      toast('Asistencia registrada');
      onSaved();
    } catch (e) { toast(e.message, 'error'); } finally { setSaving(false); }
  };
  const counts = (rows || []).reduce((acc, r) => ({ ...acc, [r.status]: (acc[r.status] || 0) + 1 }), {});
  return (
    <Modal open onClose={onClose} size="lg" title="Registro de asistencia" description={`${session.title} · ${fmtLong(session.starts_at)} · ${fmtTime(session.starts_at)}`}
      footer={<>
        <span className="mr-auto self-center text-xs text-muted">{Object.entries(ATTENDANCE).map(([k, a]) => `${a.short} ${counts[k] || 0}`).join(' · ')}</span>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button><Button onClick={save} loading={saving} disabled={!rows}>Guardar asistencia</Button>
      </>}>
      {!rows ? <Skeleton className="h-64" /> : (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="self-center text-muted">Marcar a todos:</span>
            {Object.entries(ATTENDANCE).map(([k, a]) => <button key={k} type="button" onClick={() => setAll(k)} className={cx('rounded-full border border-line px-2.5 py-1 font-medium hover:border-primary', toneBg[a.tone])}>{a.label}</button>)}
          </div>
          <ul className="divide-y divide-line rounded-xl border border-line">
            {rows.map((r, i) => (
              <li key={r.id} className={cx('flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center', r.enrollment_status === 'retirado' && 'opacity-50')}>
                <div className="flex min-w-0 flex-1 items-center gap-2.5"><Avatar user={r} size={30} /><div className="min-w-0"><div className="truncate text-sm font-medium text-ink">{fullName(r)}</div><div className="text-[11px] text-faint">{r.code}{r.enrollment_status === 'retirado' ? ' · Retirado' : ''}</div></div></div>
                <div className="flex items-center gap-1">
                  {Object.entries(ATTENDANCE).map(([k, a]) => (
                    <button key={k} type="button" disabled={r.enrollment_status === 'retirado'} onClick={() => setRows(rows.map((x, j) => (j === i ? { ...x, status: k } : x)))} title={a.label} aria-label={a.label}
                      className={cx('h-8 w-8 rounded-lg text-xs font-bold transition', r.status === k ? toneBg[a.tone] + ' ring-2 ring-current/30' : 'bg-sunken text-faint hover:text-ink')}>{a.short}</button>
                  ))}
                  {r.status === 'justificada' && <Input value={r.note || ''} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, note: e.target.value } : x)))} placeholder="Motivo" className="ml-1 !w-36 !py-1 text-xs" />}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Modal>
  );
}
