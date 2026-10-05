import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ShieldCheck, ShieldAlert, Search, FileBadge2 } from 'lucide-react';
import { api } from '../../lib/api.js';
import { Button, Card, Input, Badge } from '../../components/ui.jsx';
import { fmtDateTime, fmtGrade, conditionOf } from '../../lib/format.js';

/** Verificación pública de documentos emitidos por el aula virtual. */
export default function Verify() {
  const { code: param } = useParams();
  const nav = useNavigate();
  const [code, setCode] = useState(param || '');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const check = async (c) => {
    const clean = String(c || '').trim().toUpperCase();
    if (!clean) return;
    setLoading(true); setError(''); setResult(null);
    try { setResult(await api.get(`/public/verify/${encodeURIComponent(clean)}`)); } catch (e) { setError(e.message); } finally { setLoading(false); }
  };
  useEffect(() => { if (param) check(param); }, [param]); // eslint-disable-line react-hooks/exhaustive-deps

  const p = result?.payload;
  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <div className="text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-soft text-primary"><FileBadge2 size={26} /></span>
        <h1 className="font-display mt-4 text-[2.2rem] leading-tight font-semibold text-ink">Verificación de documentos</h1>
        <p className="mx-auto mt-2 max-w-xl text-muted">Comprueba la autenticidad de constancias de matrícula, boletas de notas y récords académicos emitidos por el Aula Virtual ISUP.</p>
      </div>
      <form onSubmit={(e) => { e.preventDefault(); nav(`/verificar/${code.trim().toUpperCase()}`); check(code); }} className="mx-auto mt-8 flex max-w-xl gap-2">
        <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="ISUP-2026-XXXX-XXXX" className="font-mono uppercase" aria-label="Código del documento" />
        <Button type="submit" icon={Search} loading={loading}>Verificar</Button>
      </form>
      {error && <Card className="mx-auto mt-6 flex max-w-xl items-start gap-3 border-danger/30 bg-danger-soft/40 p-5 text-sm text-ink-2"><ShieldAlert size={20} className="shrink-0 text-danger" /><span><strong className="text-ink">No encontrado.</strong> {error}. Revisa el código o comunícate con Secretaría Académica.</span></Card>}
      {result && (
        <Card className="mx-auto mt-6 max-w-xl overflow-hidden">
          <div className={`flex items-center gap-3 p-5 ${result.valid ? 'bg-success-soft/60' : 'bg-danger-soft/60'}`}>
            {result.valid ? <ShieldCheck size={28} className="text-success" /> : <ShieldAlert size={28} className="text-danger" />}
            <div><div className="font-semibold text-ink">{result.valid ? 'Documento auténtico' : 'Documento alterado o inválido'}</div><div className="text-xs text-muted">{result.valid ? 'La huella digital coincide con el registro original.' : 'El contenido no coincide con el registro original.'}</div></div>
          </div>
          {result.valid && (
            <dl className="divide-y divide-line text-sm">
              {[
                ['Código', <span className="font-mono">{result.code}</span>], ['Tipo de documento', result.type_label], ['Fecha de emisión', fmtDateTime(result.issued_at)],
                ['Titular', `${p.student.name} · ${p.student.code}`], ['Programa de estudios', p.program?.name || '—'], ['Institución', `${p.institution.name} (${p.institution.short})`],
                ...(p.term ? [['Periodo académico', p.term.name]] : []),
                ...(result.type === 'constancia_matricula' ? [['Unidades didácticas', `${p.courses.length} · ${p.credits} créditos`]] : []),
                ...(result.type === 'boleta_notas' ? [['Promedio ponderado', fmtGrade(p.weighted_average)], ['Resultados', <span className="flex flex-wrap gap-1">{p.courses.map((c) => <Badge key={c.code} tone={conditionOf(c.condition).tone}>{c.code}: {fmtGrade(c.final)}</Badge>)}</span>]] : []),
                ...(result.type === 'record_academico' ? [['Promedio acumulado', fmtGrade(p.summary.cumulative_average)], ['Créditos aprobados', p.summary.credits_approved]] : []),
              ].map(([k, v]) => <div key={k} className="flex gap-4 px-5 py-2.5"><dt className="w-40 shrink-0 text-muted">{k}</dt><dd className="min-w-0 font-medium text-ink">{v}</dd></div>)}
            </dl>
          )}
        </Card>
      )}
      <p className="mx-auto mt-8 max-w-xl text-center text-xs text-faint">Esta verificación muestra únicamente los datos necesarios para confirmar la autenticidad del documento, conforme a la Ley N.° 29733 de Protección de Datos Personales.</p>
    </div>
  );
}
