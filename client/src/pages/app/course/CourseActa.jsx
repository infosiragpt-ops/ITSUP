import { Link } from 'react-router-dom';
import { ArrowLeft, Printer, Download } from 'lucide-react';
import { useApi } from '../../../lib/api.js';
import { Button, ErrorState, Skeleton } from '../../../components/ui.jsx';
import { fmtDate, fmtDateTime, fmtGrade, fmtPct, fullName, conditionOf, downloadCsv, ROMAN } from '../../../lib/format.js';
import { useCourse } from './CourseLayout.jsx';

/** Acta de evaluación imprimible (formato de registro oficial de la unidad didáctica). */
export default function CourseActa() {
  const { course } = useCourse();
  const { data, loading, error, reload } = useApi(`/courses/${course.id}/acta`);
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (loading) return <Skeleton className="h-96 rounded-2xl" />;
  const { rows, stats, categories, institution, program, term, teacher, closed, closed_at } = data;
  const c = data.course;

  const exportCsv = () => downloadCsv(`acta-${c.code}-${term?.name || ''}.csv`,
    ['N.°', 'Código', 'DNI', 'Apellidos y nombres', ...categories.map((k) => `${k.name} (${k.weight}%)`), 'Prom. ponderado', 'Asistencia %', 'Recuperación', 'Nota final', 'Condición', 'Observaciones'],
    rows.map((r, i) => [i + 1, r.student.code, r.student.dni || '', `${r.student.last_name}, ${r.student.first_name}`, ...r.grades.categories.map((k) => k.average ?? ''), r.grades.weighted ?? '', r.attendance.attendance_pct ?? '', r.final.recovery ?? '', r.final.final ?? '', conditionOf(r.final.condition).label, r.final.observations || '']));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link to={`/app/cursos/${course.id}/calificaciones`} className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink"><ArrowLeft size={16} /> Registro de evaluación</Link>
        <div className="flex gap-2"><Button variant="secondary" icon={Download} onClick={exportCsv}>CSV</Button><Button icon={Printer} onClick={() => window.print()}>Imprimir / PDF</Button></div>
      </div>

      <div className="doc card min-w-0 p-4 sm:p-8 print:border-0 print:p-0 print:shadow-none">
        <header className="border-b-2 border-ink pb-4 text-center">
          <div className="text-[11px] font-semibold tracking-[0.18em] text-muted uppercase">{institution.name}</div>
          <div className="text-[10px] text-faint">{institution.resolution}</div>
          <h1 className="font-display mt-2 text-xl font-semibold text-ink sm:text-2xl">Acta de evaluación de la unidad didáctica</h1>
          <div className="mt-1 text-sm text-muted">{closed ? `Acta cerrada el ${fmtDateTime(closed_at)}` : 'VISTA PREVIA · acta aún no cerrada'}</div>
        </header>

        <dl className="mt-5 grid grid-cols-1 gap-x-8 gap-y-1.5 text-[13px] sm:grid-cols-2 lg:grid-cols-3 print:grid-cols-3">
          {[
            ['Programa de estudios', program?.name || 'Transversal'], ['Módulo formativo', c.module_name || '—'], ['Unidad didáctica', `${c.code} · ${c.name}`],
            ['Periodo académico', term?.name || '—'], ['Ciclo', c.cycle ? ROMAN[c.cycle] || c.cycle : '—'], ['Créditos / horas', `${c.credits} / ${(c.hours_theory || 0) + (c.hours_practice || 0)} h`],
            ['Docente', teacher ? fullName(teacher) : '—'], ['Nota mínima', c.min_grade ?? 13], ['Límite de inasistencias', `${c.max_absence_pct ?? 30}%`],
          ].map(([k, v]) => <div key={k} className="flex gap-2 border-b border-line/60 py-1"><dt className="shrink-0 text-muted">{k}:</dt><dd className="min-w-0 font-medium text-ink">{v}</dd></div>)}
        </dl>

        <div className="-mx-4 mt-5 overflow-x-auto px-4 sm:mx-0 sm:px-0 print:overflow-visible">
          <table className="w-full min-w-[760px] border-collapse text-[12px] print:min-w-0">
            <thead>
              <tr className="bg-sunken print:bg-transparent">
                <th className="border border-line px-1.5 py-1.5">N.°</th>
                <th className="border border-line px-1.5 py-1.5 text-left">Código</th>
                <th className="border border-line px-1.5 py-1.5 text-left">DNI</th>
                <th className="min-w-[170px] border border-line px-1.5 py-1.5 text-left print:min-w-0">Apellidos y nombres</th>
                {categories.map((k) => <th key={k.id} className="border border-line px-1.5 py-1.5" title={k.name}>{k.name.replace('Evaluación de ', 'Ev. ')}<br /><span className="font-normal text-muted">{k.weight}%</span></th>)}
                <th className="border border-line px-1.5 py-1.5">Prom.</th>
                <th className="border border-line px-1.5 py-1.5">Asist.</th>
                <th className="border border-line px-1.5 py-1.5">Recup.</th>
                <th className="border border-line px-1.5 py-1.5">Nota final</th>
                <th className="border border-line px-1.5 py-1.5">Condición</th>
                <th className="border border-line px-1.5 py-1.5 text-left">Obs.</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const cond = conditionOf(r.final.condition);
                return (
                  <tr key={r.student.id} className={r.student.enrollment_status === 'retirado' ? 'text-muted' : ''}>
                    <td className="border border-line px-1.5 py-1 text-center">{i + 1}</td>
                    <td className="border border-line px-1.5 py-1 font-mono">{r.student.code}</td>
                    <td className="border border-line px-1.5 py-1 font-mono">{r.student.dni || '—'}</td>
                    <td className="border border-line px-1.5 py-1">{r.student.last_name}, {r.student.first_name}</td>
                    {r.grades.categories.map((k) => <td key={k.id} className="border border-line px-1.5 py-1 text-center tabular-nums">{fmtGrade(k.average)}</td>)}
                    <td className="border border-line px-1.5 py-1 text-center tabular-nums">{fmtGrade(r.grades.weighted)}</td>
                    <td className="border border-line px-1.5 py-1 text-center tabular-nums">{fmtPct(r.attendance.attendance_pct)}</td>
                    <td className="border border-line px-1.5 py-1 text-center tabular-nums">{r.final.recovery != null ? fmtGrade(r.final.recovery) : ''}</td>
                    <td className="border border-line px-1.5 py-1 text-center text-sm font-bold tabular-nums">{fmtGrade(r.final.final)}</td>
                    <td className="border border-line px-1.5 py-1 text-center">{cond.short || cond.label}</td>
                    <td className="border border-line px-1.5 py-1 text-[11px]">{r.final.observations || ''}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 text-[12px] sm:grid-cols-6">
          {[['Matriculados', stats.students], ['Aprobados', stats.aprobados], ['Desaprobados', stats.desaprobados], ['DPI', stats.dpi], ['Retirados', stats.retirados], ['Promedio', fmtGrade(stats.average)]].map(([k, v]) => (
            <div key={k} className="rounded-lg border border-line px-3 py-2"><div className="text-[10px] text-muted uppercase">{k}</div><div className="font-semibold text-ink">{v}</div></div>
          ))}
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-muted">
          Leyenda: Prom. = promedio ponderado de los criterios de evaluación (escala vigesimal); la nota final se redondea al entero (fracción 0.5 o más a favor del estudiante). DPI = desaprobado por inasistencia (más del {c.max_absence_pct ?? 30}% de inasistencias injustificadas). Recup. = nota de la evaluación de recuperación, que reemplaza a la nota final cuando corresponde. Emitido por el Aula Virtual ISUP el {fmtDate(new Date())}.
        </p>

        <div className="mt-12 grid grid-cols-1 gap-10 text-center text-[12px] sm:grid-cols-3">
          {[[teacher ? fullName(teacher) : 'Docente', 'Docente de la unidad didáctica'], [institution.academic_secretary, 'Secretaría Académica'], [institution.director, 'Dirección General']].map(([n, r]) => (
            <div key={r}><div className="mx-auto mb-2 h-px w-48 bg-ink" /><div className="font-semibold text-ink">{n}</div><div className="text-muted">{r}</div></div>
          ))}
        </div>
      </div>
    </div>
  );
}
