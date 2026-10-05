import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Printer, ShieldCheck } from 'lucide-react';
import { useApi } from '../../lib/api.js';
import { Button, ErrorState, Skeleton } from '../../components/ui.jsx';
import { LogoMark } from '../../components/brand.jsx';
import { fmtDate, fmtDateTime, fmtGrade, fmtPct, conditionOf } from '../../lib/format.js';

/** Vista imprimible de una constancia, boleta de notas o récord académico emitido por el estudiante. */
export default function DocumentView() {
  const { code } = useParams();
  const { data, loading, error, reload } = useApi(`/documents/${code}`);
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (loading) return <Skeleton className="mx-auto h-[70vh] max-w-3xl rounded-2xl" />;
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Link to="/app/calificaciones" className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink"><ArrowLeft size={16} /> Mis documentos</Link>
        <Button icon={Printer} onClick={() => window.print()}>Imprimir / Guardar PDF</Button>
      </div>
      <Document doc={data} />
    </div>
  );
}

export function Document({ doc }) {
  const p = doc.payload;
  const verifyUrl = `${window.location.origin}/verificar/${doc.code}`;
  return (
    <article className="doc card relative overflow-hidden p-8 sm:p-10 print:border-0 print:p-0 print:shadow-none">
      <header className="flex items-start justify-between gap-4 border-b-2 border-ink pb-5">
        <div className="flex items-center gap-3">
          <LogoMark size={44} />
          <div>
            <div className="font-display text-xl font-semibold text-ink">{p.institution.short}</div>
            <div className="text-xs text-muted">{p.institution.name}</div>
            <div className="text-[11px] text-faint">{p.institution.resolution} · Código {p.institution.code}</div>
          </div>
        </div>
        <div className="text-right text-[11px] text-muted">
          <div className="font-mono text-xs font-semibold text-ink">{doc.code}</div>
          <div>Emitido el {fmtDateTime(p.issued_at)}</div>
          <div>{p.institution.address}</div>
        </div>
      </header>

      <h1 className="font-display mt-8 text-center text-[1.75rem] font-semibold tracking-tight text-ink uppercase">{p.type_label}</h1>

      {doc.type === 'constancia_matricula' && <Constancia p={p} />}
      {doc.type === 'boleta_notas' && <Boleta p={p} />}
      {doc.type === 'record_academico' && <Record p={p} />}

      <footer className="mt-10 border-t border-line pt-5">
        <div className="grid grid-cols-2 gap-10 text-center text-xs">
          <div><div className="mx-auto mb-2 h-px w-44 bg-ink" /><div className="font-semibold text-ink">{p.institution.academic_secretary}</div><div className="text-muted">Secretaría Académica</div></div>
          <div><div className="mx-auto mb-2 h-px w-44 bg-ink" /><div className="font-semibold text-ink">{p.institution.director}</div><div className="text-muted">Dirección General</div></div>
        </div>
        <div className="mt-6 flex items-start gap-3 rounded-xl bg-sunken p-3 text-[11px] leading-relaxed text-muted print:bg-transparent print:p-0">
          <ShieldCheck size={16} className="mt-0.5 shrink-0 text-success" />
          <span>Documento generado por el Aula Virtual {p.institution.short}. Verifique su autenticidad ingresando el código <strong className="font-mono text-ink">{doc.code}</strong> en <strong className="text-ink">{verifyUrl}</strong>. Los datos personales se tratan conforme a la Ley N.° 29733, Ley de Protección de Datos Personales.</span>
        </div>
      </footer>
    </article>
  );
}

const Row = ({ k, v }) => <div className="flex gap-3 border-b border-line/70 py-1.5 text-sm"><dt className="w-44 shrink-0 text-muted">{k}</dt><dd className="font-medium text-ink">{v || '—'}</dd></div>;

function StudentBlock({ p }) {
  return (
    <dl className="mt-6 grid gap-x-10 sm:grid-cols-2">
      <Row k="Apellidos y nombres" v={`${p.student.last_name}, ${p.student.first_name}`} />
      <Row k="Código de estudiante" v={p.student.code} />
      <Row k="DNI" v={p.student.dni} />
      <Row k="Programa de estudios" v={p.program?.name} />
      <Row k="Nivel formativo" v={p.program?.level} />
      <Row k="Modalidad" v={p.program?.modality} />
    </dl>
  );
}

function Constancia({ p }) {
  return (
    <>
      <p className="mt-6 text-justify text-[15px] leading-relaxed text-ink-2">
        La Secretaría Académica del <strong className="text-ink">{p.institution.name}</strong> deja constancia de que <strong className="text-ink">{p.student.name}</strong>, identificado(a) con DNI N.° {p.student.dni || '—'} y código {p.student.code}, se encuentra <strong className="text-ink">matriculado(a)</strong> en el periodo académico <strong className="text-ink">{p.term.name}</strong> ({fmtDate(p.term.start_date)} al {fmtDate(p.term.end_date)}) en el programa de estudios de <strong className="text-ink">{p.program?.name}</strong>, en las siguientes unidades didácticas:
      </p>
      <table className="mt-5 w-full text-sm">
        <thead className="border-b-2 border-ink text-left text-xs text-muted uppercase"><tr><th className="py-2">Código</th><th className="py-2">Unidad didáctica</th><th className="py-2">Docente</th><th className="py-2 text-center">Créditos</th><th className="py-2 text-center">Horas</th></tr></thead>
        <tbody className="divide-y divide-line">
          {p.courses.map((c) => <tr key={c.code}><td className="py-1.5 font-mono text-xs">{c.code}</td><td className="py-1.5 text-ink">{c.name}</td><td className="py-1.5 text-muted">{c.teacher || '—'}</td><td className="py-1.5 text-center tabular-nums">{c.credits}</td><td className="py-1.5 text-center tabular-nums">{(c.hours_theory || 0) + (c.hours_practice || 0)}</td></tr>)}
        </tbody>
        <tfoot><tr className="border-t-2 border-ink font-semibold"><td colSpan={3} className="py-2 text-right">Total</td><td className="py-2 text-center tabular-nums">{p.credits}</td><td className="py-2 text-center tabular-nums">{p.courses.reduce((s, c) => s + (c.hours_theory || 0) + (c.hours_practice || 0), 0)}</td></tr></tfoot>
      </table>
      <p className="mt-5 text-sm text-muted">Se expide la presente a solicitud del (de la) interesado(a) para los fines que estime conveniente. {p.institution.address}, {fmtDate(p.issued_at)}.</p>
    </>
  );
}

function Boleta({ p }) {
  return (
    <>
      <StudentBlock p={p} />
      <div className="mt-5 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-sunken px-4 py-3 text-sm print:bg-transparent print:px-0">
        <span className="font-semibold text-ink">Periodo académico {p.term.name}</span>
        <span className="text-muted">{fmtDate(p.term.start_date)} – {fmtDate(p.term.end_date)} · {p.closed ? 'Periodo cerrado' : 'Notas parciales (periodo en curso)'}</span>
      </div>
      <table className="mt-4 w-full text-sm">
        <thead className="border-b-2 border-ink text-left text-xs text-muted uppercase"><tr><th className="py-2">Código</th><th className="py-2">Unidad didáctica</th><th className="py-2 text-center">Créd.</th><th className="py-2 text-center">Asist.</th><th className="py-2 text-center">Nota</th><th className="py-2">Condición</th></tr></thead>
        <tbody className="divide-y divide-line">
          {p.courses.map((c) => <tr key={c.code}><td className="py-1.5 font-mono text-xs">{c.code}</td><td className="py-1.5 text-ink">{c.name}</td><td className="py-1.5 text-center tabular-nums">{c.credits}</td><td className="py-1.5 text-center tabular-nums">{fmtPct(c.attendance_pct)}</td><td className="py-1.5 text-center text-base font-bold tabular-nums">{fmtGrade(c.final)}</td><td className="py-1.5">{conditionOf(c.condition).label}</td></tr>)}
        </tbody>
      </table>
      <div className="mt-4 grid grid-cols-3 gap-3 text-center text-sm">
        {[['Promedio ponderado', fmtGrade(p.weighted_average)], ['Créditos aprobados', p.credits_approved], ['Créditos matriculados', p.credits_enrolled]].map(([k, v]) => <div key={k} className="rounded-xl border border-line p-3"><div className="text-[11px] text-muted uppercase">{k}</div><div className="font-display text-xl text-ink">{v}</div></div>)}
      </div>
      <p className="mt-4 text-[11px] leading-relaxed text-muted">Escala vigesimal; nota mínima aprobatoria 13; la fracción 0.5 se redondea a favor del estudiante. DPI: desaprobado por inasistencia (más del 30 % de inasistencias injustificadas).</p>
    </>
  );
}

function Record({ p }) {
  return (
    <>
      <StudentBlock p={p} />
      {p.terms.map((t) => (
        <div key={t.term.id} className="mt-5 break-inside-avoid">
          <div className="flex items-center justify-between border-b-2 border-ink pb-1 text-sm"><span className="font-semibold text-ink">Periodo {t.term.name}{t.closed ? '' : ' (en curso)'}</span><span className="text-muted">Promedio ponderado {fmtGrade(t.weighted_average)} · {t.credits_approved} créditos aprobados</span></div>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-line">
              {t.courses.map((c) => <tr key={c.code}><td className="w-24 py-1.5 font-mono text-xs">{c.code}</td><td className="py-1.5 text-ink">{c.name}</td><td className="w-14 py-1.5 text-center tabular-nums">{c.credits}</td><td className="w-14 py-1.5 text-center font-bold tabular-nums">{fmtGrade(c.final)}</td><td className="w-36 py-1.5 text-xs">{conditionOf(c.condition).label}</td></tr>)}
            </tbody>
          </table>
        </div>
      ))}
      <div className="mt-6 grid grid-cols-2 gap-3 text-center text-sm sm:grid-cols-4">
        {[['Promedio acumulado', fmtGrade(p.summary.cumulative_average)], ['Créditos aprobados', `${p.summary.credits_approved}${p.program?.total_credits ? ` / ${p.program.total_credits}` : ''}`], ['UD aprobadas', p.summary.courses_approved], ['UD desaprobadas', p.summary.courses_failed]].map(([k, v]) => <div key={k} className="rounded-xl border border-line p-3"><div className="text-[11px] text-muted uppercase">{k}</div><div className="font-display text-xl text-ink">{v}</div></div>)}
      </div>
    </>
  );
}
