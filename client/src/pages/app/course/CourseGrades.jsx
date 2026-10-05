import { Link } from 'react-router-dom';
import { Download, GraduationCap, ClipboardList, ListChecks } from 'lucide-react';
import { useApi } from '../../../lib/api.js';
import { Avatar, Badge, Button, Card, EmptyState, ErrorState, ProgressRing, Skeleton, cx } from '../../../components/ui.jsx';
import { fmtDate, fmtGrade, fullName, gradeTone } from '../../../lib/format.js';
import { useCourse } from './CourseLayout.jsx';

const toneText = { success: 'text-success', danger: 'text-danger', neutral: 'text-faint' };

export default function CourseGrades() {
  const { course, canEdit } = useCourse();
  const { data, loading, error, reload } = useApi(`/courses/${course.id}/grades`);
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (loading) return <Skeleton className="h-72 rounded-2xl" />;
  return canEdit ? <Gradebook course={course} data={data} /> : <MyGrades course={course} g={data.mine} />;
}

function MyGrades({ course, g }) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
      <Card className="h-fit p-6 text-center">
        <ProgressRing value={g.average != null ? (g.average / 20) * 100 : 0} size={120} stroke={9} color={g.average == null ? 'var(--c-line)' : gradeTone(g.average) === 'success' ? 'var(--c-success)' : 'var(--c-danger)'}>
          <span className="font-display text-3xl">{fmtGrade(g.average)}</span>
        </ProgressRing>
        <div className="mt-3 font-semibold text-ink">Promedio actual</div>
        <div className="text-sm text-muted">{g.graded} de {g.total} actividades calificadas</div>
        <div className="mt-4 rounded-xl bg-sunken p-3 text-xs text-muted">Escala vigesimal. Nota mínima aprobatoria: <strong className="text-ink">13</strong></div>
      </Card>
      <Card className="overflow-hidden">
        {g.items.length === 0 ? <EmptyState icon={GraduationCap} title="Sin actividades calificables" /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-sunken text-left text-xs font-semibold tracking-wide text-muted uppercase">
                <tr><th className="px-5 py-3">Actividad</th><th className="px-3 py-3">Fecha</th><th className="px-3 py-3">Estado</th><th className="px-5 py-3 text-right">Nota</th></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {g.items.map((i) => (
                  <tr key={`${i.kind}${i.id}`} className="hover:bg-sunken/50">
                    <td className="px-5 py-3.5">
                      <Link to={`/app/cursos/${course.id}/${i.kind === 'quiz' ? 'evaluaciones' : 'tareas'}/${i.id}`} className="flex items-center gap-2.5 font-medium text-ink hover:text-primary-ink">
                        {i.kind === 'quiz' ? <ListChecks size={16} className="shrink-0 text-info" /> : <ClipboardList size={16} className="shrink-0 text-primary" />}{i.title}
                      </Link>
                      {i.feedback && <div className="mt-1 ml-6.5 line-clamp-1 text-xs text-muted">“{i.feedback}”</div>}
                    </td>
                    <td className="px-3 py-3.5 whitespace-nowrap text-muted">{fmtDate(i.due_at)}</td>
                    <td className="px-3 py-3.5">
                      {i.score != null ? <Badge tone="success">Calificado</Badge> : i.submitted ? <Badge tone="info">En revisión</Badge> : new Date(i.due_at) < new Date() ? <Badge tone="danger">No entregado</Badge> : <Badge>Pendiente</Badge>}
                    </td>
                    <td className={cx('px-5 py-3.5 text-right text-base font-semibold tabular-nums', toneText[gradeTone(i.score, i.points)])}>{fmtGrade(i.score)}<span className="text-xs font-normal text-faint">/{i.points}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function Gradebook({ course, data }) {
  const { columns, rows } = data;
  const exportCsv = () => {
    const head = ['Código', 'Estudiante', ...columns.map((c) => c.title), 'Promedio'];
    const lines = rows.map((r) => [r.student.code, fullName(r.student), ...r.items.map((i) => i.score ?? ''), r.average ?? '']);
    const csv = [head, ...lines].map((l) => l.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `notas-${course.code}.csv`;
    a.click();
  };
  const avgs = rows.map((r) => r.average).filter((x) => x != null);
  const classAvg = avgs.length ? avgs.reduce((a, b) => a + b, 0) / avgs.length : null;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <Badge tone="info">{rows.length} estudiantes</Badge>
          <Badge tone={gradeTone(classAvg)}>Promedio del aula: {fmtGrade(classAvg ? Math.round(classAvg * 10) / 10 : null)}</Badge>
          <Badge tone="danger">{avgs.filter((a) => a < 13).length} en riesgo (&lt; 13)</Badge>
        </div>
        <Button variant="secondary" icon={Download} onClick={exportCsv}>Exportar CSV</Button>
      </div>
      <Card className="overflow-hidden">
        <div className="scrollbar-thin overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-sunken text-left text-xs font-semibold text-muted">
              <tr>
                <th className="sticky left-0 z-10 bg-sunken px-4 py-3">Estudiante</th>
                {columns.map((c) => (
                  <th key={`${c.kind}${c.id}`} className="min-w-[96px] px-2 py-3 text-center font-medium">
                    <Link to={`/app/cursos/${course.id}/${c.kind === 'quiz' ? 'evaluaciones' : 'tareas'}/${c.id}`} className="line-clamp-2 hover:text-primary-ink" title={c.title}>{c.title}</Link>
                  </th>
                ))}
                <th className="px-4 py-3 text-center">Promedio</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <tr key={r.student.id} className="hover:bg-sunken/40">
                  <td className="sticky left-0 z-10 bg-surface px-4 py-2.5">
                    <div className="flex items-center gap-2.5"><Avatar user={r.student} size={28} /><div className="min-w-0"><div className="truncate font-medium text-ink">{fullName(r.student)}</div><div className="text-[11px] text-faint">{r.student.code}</div></div></div>
                  </td>
                  {r.items.map((i) => (
                    <td key={`${i.kind}${i.id}`} className={cx('px-2 py-2.5 text-center tabular-nums', toneText[gradeTone(i.score, i.points)])}>
                      {i.score != null ? fmtGrade(i.score) : i.submitted ? <span className="text-xs text-warn">Por calif.</span> : '—'}
                    </td>
                  ))}
                  <td className="px-4 py-2.5 text-center"><Badge tone={gradeTone(r.average)}>{fmtGrade(r.average)}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
