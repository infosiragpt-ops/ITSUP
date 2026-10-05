import { useState } from 'react';
import { Mail, Search, Users, AlertTriangle, ShieldCheck, Download, UserCheck } from 'lucide-react';
import { useApi } from '../../../lib/api.js';
import { Avatar, Badge, Button, Card, EmptyState, ErrorState, Input, ProgressBar, Skeleton, Segmented, Stat, cx } from '../../../components/ui.jsx';
import { ConditionBadge } from '../../../components/lms.jsx';
import { fullName, relative, fmtGrade, fmtPct, gradeTone, downloadCsv, conditionOf } from '../../../lib/format.js';
import { useCourse } from './CourseLayout.jsx';

export default function CoursePeople() {
  const { course, canEdit } = useCourse();
  return canEdit ? <Tracking course={course} /> : <Classmates course={course} />;
}

/* ---------------- Estudiante: compañeros ---------------- */

function Classmates({ course }) {
  const { data, loading, error, reload } = useApi(`/courses/${course.id}/people`);
  const [q, setQ] = useState('');
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (loading) return <Skeleton className="h-72 rounded-2xl" />;
  const students = data.students.filter((s) => !q || fullName(s).toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="space-y-5">
      {data.teacher && (
        <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
          <Avatar user={data.teacher} size={56} />
          <div className="flex-1">
            <Badge tone="info">Docente del curso</Badge>
            <div className="mt-1 text-lg font-semibold text-ink">{fullName(data.teacher)}</div>
            <div className="text-sm text-muted">{data.teacher.title}</div>
          </div>
          <Button variant="secondary" icon={Mail} href={`mailto:${data.teacher.email}`}>Escribir</Button>
        </Card>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="font-semibold text-ink">Compañeros de clase <span className="text-muted">({data.students.length})</span></h3>
        <div className="relative sm:w-72"><Search size={16} className="absolute top-1/2 left-3 -translate-y-1/2 text-faint" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar" className="pl-9" /></div>
      </div>
      {students.length === 0 ? <Card><EmptyState icon={Users} title="Sin resultados" /></Card> : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {students.map((s) => (
            <Card key={s.id} className="flex items-center gap-3 p-4">
              <Avatar user={s} size={42} />
              <div className="min-w-0 flex-1"><div className="truncate font-medium text-ink">{fullName(s)}</div><div className="truncate text-xs text-muted">{s.code}</div></div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------- Docente: seguimiento y alerta temprana ---------------- */

const toneCls = { danger: 'bg-danger-soft text-danger', warn: 'bg-warn-soft text-warn' };

function Tracking({ course }) {
  const { data, loading, error, reload } = useApi(`/courses/${course.id}/tracking`);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all');
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (loading) return <Skeleton className="h-72 rounded-2xl" />;
  const { rows, at_risk, rules } = data;
  const list = rows.filter((r) => {
    if (q && !fullName(r.student).toLowerCase().includes(q.toLowerCase())) return false;
    if (filter === 'risk') return r.flags.length > 0;
    if (filter === 'ok') return r.flags.length === 0 && r.student.enrollment_status !== 'retirado';
    return true;
  });
  const inactive = rows.filter((r) => !r.last_access || Date.now() - new Date(r.last_access) > 7 * 864e5).length;
  const avgProgress = rows.length ? Math.round(rows.reduce((s, r) => s + r.progress.pct, 0) / rows.length) : 0;

  const exportCsv = () => downloadCsv(`seguimiento-${course.code}.csv`,
    ['Código', 'Estudiante', 'Correo', 'Avance %', 'Promedio', 'Asistencia %', 'Inasistencias %', 'Condición', 'Último acceso', 'Alertas'],
    rows.map((r) => [r.student.code, fullName(r.student), r.student.email, r.progress.pct, r.weighted ?? '', r.attendance.attendance_pct ?? '', r.attendance.absence_pct, conditionOf(r.condition).label, r.last_access || '', r.flags.map((f) => f.label).join('; ')]));

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat icon={Users} label="Estudiantes" value={rows.length} hint={`${rows.filter((r) => r.student.enrollment_status === 'retirado').length} retirados`} tone="info" />
        <Stat icon={AlertTriangle} label="Con alertas" value={at_risk} hint="Requieren acompañamiento" tone={at_risk ? 'warn' : 'success'} />
        <Stat icon={UserCheck} label="Inactivos +7 días" value={inactive} hint="Sin ingresar al curso" tone={inactive ? 'warn' : 'success'} />
        <Stat icon={ShieldCheck} label="Avance promedio" value={`${avgProgress}%`} hint="Contenido completado" tone="success" />
      </div>
      <Card className="flex items-start gap-3 border-info/20 bg-info-soft/50 p-4 text-sm text-ink-2">
        <ShieldCheck size={18} className="mt-0.5 shrink-0 text-info" />
        <span><strong className="text-ink">Sistema de alerta temprana.</strong> Se marca a los estudiantes con promedio bajo {rules.min_grade}, inasistencias cercanas o superiores al {rules.max_absence_pct}%, actividades sin entregar o poco avance, para derivarlos a tutoría académica.</span>
      </Card>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <Segmented value={filter} onChange={setFilter} options={[{ value: 'all', label: 'Todos', count: rows.length }, { value: 'risk', label: 'Con alertas', count: at_risk }, { value: 'ok', label: 'Sin alertas' }]} />
          <div className="relative"><Search size={16} className="absolute top-1/2 left-3 -translate-y-1/2 text-faint" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar" className="pl-9 sm:w-56" /></div>
        </div>
        <Button variant="secondary" size="sm" icon={Download} onClick={exportCsv}>Exportar CSV</Button>
      </div>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="bg-sunken text-left text-xs font-semibold text-muted">
              <tr><th className="px-4 py-3">Estudiante</th><th className="px-3 py-3">Avance</th><th className="px-3 py-3 text-center">Promedio</th><th className="px-3 py-3 text-center">Asistencia</th><th className="px-3 py-3 text-center">Condición</th><th className="px-3 py-3">Alertas</th><th className="px-3 py-3">Último acceso</th><th className="px-3 py-3" /></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {list.map((r) => (
                <tr key={r.student.id} className={cx('hover:bg-sunken/40', r.student.enrollment_status === 'retirado' && 'opacity-50')}>
                  <td className="px-4 py-2.5"><div className="flex items-center gap-2.5"><Avatar user={r.student} size={30} /><div className="min-w-0"><div className="truncate font-medium text-ink">{fullName(r.student)}</div><div className="truncate text-[11px] text-faint">{r.student.code} · {r.student.email}</div></div></div></td>
                  <td className="px-3 py-2.5"><div className="flex w-28 items-center gap-2"><ProgressBar value={r.progress.pct} size="sm" tone={r.progress.pct < 40 ? 'warn' : 'primary'} /><span className="text-xs font-semibold tabular-nums">{r.progress.pct}%</span></div></td>
                  <td className={cx('px-3 py-2.5 text-center font-semibold tabular-nums', r.weighted == null ? 'text-faint' : gradeTone(r.weighted) === 'success' ? 'text-success' : 'text-danger')}>{fmtGrade(r.weighted)}</td>
                  <td className={cx('px-3 py-2.5 text-center tabular-nums', r.attendance.dpi ? 'text-danger' : r.attendance.at_risk ? 'text-warn' : 'text-ink-2')}>{fmtPct(r.attendance.attendance_pct)}</td>
                  <td className="px-3 py-2.5 text-center"><ConditionBadge condition={r.condition} short /></td>
                  <td className="px-3 py-2.5"><div className="flex flex-wrap gap-1">{r.flags.length === 0 ? <span className="text-xs text-faint">—</span> : r.flags.map((f) => <span key={f.key} className={cx('rounded-md px-1.5 py-0.5 text-[11px] font-medium', toneCls[f.tone])}>{f.label}</span>)}</div></td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-xs text-muted">{r.last_access ? relative(r.last_access) : 'Nunca'}</td>
                  <td className="px-3 py-2.5"><a href={`mailto:${r.student.email}?subject=${encodeURIComponent(`Seguimiento académico · ${course.name}`)}`} className="text-muted hover:text-primary" aria-label="Escribir"><Mail size={16} /></a></td>
                </tr>
              ))}
              {list.length === 0 && <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-muted">Sin resultados.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
