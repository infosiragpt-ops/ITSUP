import { useEffect, useState } from 'react';
import { CalendarDays, Plus, Pencil, Lock, LockOpen, CheckCircle2, AlertTriangle, FileCheck2, BarChart3, Settings2, Save, ArrowUpRight, UserCheck, ClipboardCheck, Play } from 'lucide-react';
import { api, useApi } from '../../lib/api.js';
import { useUi } from '../../lib/context.jsx';
import { Button, Card, Badge, PageHeader, Field, Input, Select, Modal, PageLoader, ErrorState, EmptyState, Segmented, Stat, Textarea, Switch, cx } from '../../components/ui.jsx';
import { fmtDate, fmtDateTime, fmtGrade, fmtPct, fullName, gradeTone } from '../../lib/format.js';

export default function AdminAcademic() {
  const [tab, setTab] = useState('actas');
  return (
    <div className="animate-fade-up">
      <PageHeader eyebrow="Administración" title="Gestión académica"
        subtitle="Periodos académicos, actas de evaluación, indicadores institucionales y configuración normativa (Ley 30512 · Lineamientos Académicos Generales)."
        actions={<Segmented value={tab} onChange={setTab} options={[{ value: 'actas', label: 'Actas e indicadores' }, { value: 'terms', label: 'Periodos' }, { value: 'settings', label: 'Configuración' }]} />} />
      {tab === 'actas' && <Actas />}
      {tab === 'terms' && <Terms />}
      {tab === 'settings' && <SettingsForm />}
    </div>
  );
}

/* ---------------- Actas e indicadores ---------------- */

function Actas() {
  const { toast } = useUi();
  const terms = useApi('/admin/terms');
  const [termId, setTermId] = useState('');
  const path = `/admin/actas${termId ? `?term=${termId}` : ''}`;
  const { data, loading, error, reload } = useApi(path);
  const [reopening, setReopening] = useState(null);
  if (error) return <ErrorState message={error} onRetry={reload} />;
  const t = data?.totals;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Select value={termId} onChange={(e) => setTermId(e.target.value)} className="sm:max-w-xs" aria-label="Periodo">
          <option value="">Periodo activo</option>
          {(terms.data || []).map((x) => <option key={x.id} value={x.id}>{x.name}{x.is_active ? ' (activo)' : x.closed_at ? ' (cerrado)' : ''}</option>)}
        </Select>
        {data?.term && <span className="text-sm text-muted">{data.term.name} · {fmtDate(data.term.start_date)} – {fmtDate(data.term.end_date)}</span>}
      </div>
      {loading || !t ? <PageLoader /> : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-7">
            {[
              ['Actas cerradas', `${t.closed}/${t.courses}`, 'info', FileCheck2], ['Matrículas', t.students, 'primary', UserCheck], ['Aprobados', t.aprobados, 'success', CheckCircle2],
              ['Desaprobados', t.desaprobados, 'warn', AlertTriangle], ['DPI', t.dpi, 'warn', AlertTriangle], ['Tasa de aprobación', fmtPct(t.approval_rate), 'success', BarChart3], ['Asistencia', fmtPct(t.attendance), 'info', UserCheck],
            ].map(([l, v, tone, Icon]) => (
              <Card key={l} className="p-3.5"><div className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-muted uppercase"><Icon size={12} /> {l}</div><div className={cx('mt-1 text-2xl font-semibold tabular-nums', tone === 'success' ? 'text-success' : tone === 'warn' ? 'text-warn' : 'text-ink')}>{v}</div></Card>
            ))}
          </div>
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-5 py-3"><h3 className="font-semibold text-ink">Actas por unidad didáctica</h3><span className="text-xs text-muted">Promedio general {fmtGrade(t.average)}</span></div>
            {data.rows.length === 0 ? <EmptyState icon={FileCheck2} title="No hay cursos en este periodo" /> : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-sm">
                  <thead className="bg-sunken text-left text-xs font-semibold text-muted">
                    <tr><th className="px-5 py-2.5">Curso</th><th className="px-3 py-2.5">Docente</th><th className="px-3 py-2.5 text-center">Matric.</th><th className="px-3 py-2.5 text-center">Aprob.</th><th className="px-3 py-2.5 text-center">Desap.</th><th className="px-3 py-2.5 text-center">DPI</th><th className="px-3 py-2.5 text-center">Prom.</th><th className="px-3 py-2.5 text-center">Asist.</th><th className="px-3 py-2.5">Pendientes</th><th className="px-3 py-2.5">Acta</th><th className="px-3 py-2.5" /></tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {data.rows.map((r) => (
                      <tr key={r.id} className="hover:bg-sunken/40">
                        <td className="px-5 py-2.5"><div className="flex items-center gap-2"><span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: r.color }} /><div><div className="font-medium text-ink">{r.name}</div><div className="text-[11px] text-faint">{r.code} · {r.program || 'Transversal'} · {r.credits} créd.</div></div></div></td>
                        <td className="px-3 py-2.5 text-ink-2">{r.teacher ? fullName(r.teacher) : <span className="text-warn">Sin docente</span>}</td>
                        <td className="px-3 py-2.5 text-center tabular-nums">{r.stats.students}</td>
                        <td className="px-3 py-2.5 text-center tabular-nums text-success">{r.stats.aprobados}</td>
                        <td className="px-3 py-2.5 text-center tabular-nums text-danger">{r.stats.desaprobados}</td>
                        <td className="px-3 py-2.5 text-center tabular-nums text-danger">{r.stats.dpi}</td>
                        <td className={cx('px-3 py-2.5 text-center font-semibold tabular-nums', gradeTone(r.stats.average) === 'success' ? 'text-success' : r.stats.average == null ? 'text-faint' : 'text-danger')}>{fmtGrade(r.stats.average)}</td>
                        <td className="px-3 py-2.5 text-center tabular-nums">{fmtPct(r.stats.attendance)}</td>
                        <td className="px-3 py-2.5"><div className="flex flex-wrap gap-1">{r.pending_grading > 0 && <Badge tone="warn" icon={ClipboardCheck}>{r.pending_grading} por calificar</Badge>}{r.attendance_pending > 0 && <Badge tone="warn" icon={UserCheck}>{r.attendance_pending} asist.</Badge>}{r.stats.pendientes > 0 && <Badge tone="danger">{r.stats.pendientes} sin notas</Badge>}{!r.pending_grading && !r.attendance_pending && !r.stats.pendientes && <span className="text-xs text-success">Al día</span>}</div></td>
                        <td className="px-3 py-2.5">{r.status === 'closed' ? <Badge tone="success" icon={Lock}>Cerrada · {fmtDate(r.closed_at)}</Badge> : <Badge icon={LockOpen}>Abierta</Badge>}</td>
                        <td className="px-3 py-2.5"><div className="flex justify-end gap-1"><Button size="sm" variant="ghost" icon={ArrowUpRight} to={`/app/cursos/${r.id}/calificaciones`}>Abrir</Button>{r.status === 'closed' && <Button size="sm" variant="ghost" icon={LockOpen} onClick={() => setReopening(r)}>Reabrir</Button>}</div></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
          <Card className="p-5">
            <h3 className="mb-3 font-semibold text-ink">Tasa de aprobación por curso</h3>
            <ul className="space-y-3">
              {data.rows.filter((r) => r.stats.students > 0).map((r) => {
                const ev = r.stats.aprobados + r.stats.desaprobados + r.stats.dpi;
                const pct = ev ? Math.round((r.stats.aprobados / ev) * 100) : 0;
                return (
                  <li key={r.id}>
                    <div className="mb-1 flex justify-between text-sm"><span className="font-medium text-ink">{r.code} · {r.name}</span><span className="tabular-nums text-muted"><strong className="text-ink">{pct}%</strong> aprobación · {r.stats.aprobados}/{ev}</span></div>
                    <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-sunken">
                      <div className="h-full bg-success" style={{ width: `${ev ? (r.stats.aprobados / ev) * 100 : 0}%` }} /><div className="h-full bg-danger/70" style={{ width: `${ev ? (r.stats.desaprobados / ev) * 100 : 0}%` }} /><div className="h-full bg-danger" style={{ width: `${ev ? (r.stats.dpi / ev) * 100 : 0}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="mt-3 flex gap-4 text-[11px] text-muted"><span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-success" /> Aprobados</span><span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-danger/70" /> Desaprobados</span><span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-danger" /> DPI</span></div>
          </Card>
        </>
      )}
      {reopening && <ReopenModal course={reopening} onClose={() => setReopening(null)} onDone={() => { setReopening(null); reload(); toast('Acta reabierta. El docente fue notificado.'); }} />}
    </div>
  );
}

function ReopenModal({ course, onClose, onDone }) {
  const { toast } = useUi();
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const go = async () => {
    setSaving(true);
    try { await api.post(`/admin/courses/${course.id}/acta/reopen`, { reason }); onDone(); } catch (e) { toast(e.message, 'error'); setSaving(false); }
  };
  return (
    <Modal open onClose={onClose} size="sm" title="Reabrir acta" description={`${course.code} · ${course.name}`}
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button variant="danger" onClick={go} loading={saving} disabled={reason.trim().length < 10}>Reabrir acta</Button></>}>
      <div className="space-y-3 text-sm text-ink-2">
        <p>La reapertura permite al docente corregir notas o asistencia. Queda registrada en la bitácora de auditoría con tu usuario, fecha y motivo.</p>
        <Field label="Motivo de la reapertura" required hint="Mínimo 10 caracteres."><Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ej. Error de digitación en la nota de recuperación del estudiante N00260004." /></Field>
      </div>
    </Modal>
  );
}

/* ---------------- Periodos ---------------- */

function Terms() {
  const { toast, confirm } = useUi();
  const { data, loading, error, reload } = useApi('/admin/terms');
  const [editing, setEditing] = useState(null);
  if (loading) return <PageLoader />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  const activate = async (t) => {
    if (!(await confirm({ title: `Activar el periodo ${t.name}`, message: 'Los cursos nuevos se crearán en este periodo y será el que vean estudiantes y docentes en su aula.', confirmText: 'Activar' }))) return;
    try { await api.put(`/admin/terms/${t.id}`, { activate: true }); toast(`Periodo ${t.name} activado`); reload(); } catch (e) { toast(e.message, 'error'); }
  };
  const close = async (t) => {
    if (!(await confirm({ title: `Cerrar el periodo ${t.name}`, message: `Se cerrarán las actas de los ${t.courses - t.closed_courses} cursos que siguen abiertos y el periodo dejará de estar activo. Esta acción se registra en la auditoría.`, confirmText: 'Cerrar periodo', danger: true }))) return;
    try { await api.post(`/admin/terms/${t.id}/close`); toast(`Periodo ${t.name} cerrado`); reload(); } catch (e) { toast(e.message, 'error'); }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end"><Button icon={Plus} onClick={() => setEditing('new')}>Nuevo periodo</Button></div>
      <div className="grid gap-4 md:grid-cols-2">
        {data.map((t) => (
          <Card key={t.id} className={cx('p-5', t.is_active && 'border-primary/40 ring-2 ring-primary/10')}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className={cx('flex h-11 w-11 items-center justify-center rounded-xl', t.is_active ? 'bg-primary text-white' : 'bg-sunken text-muted')}><CalendarDays size={20} /></span>
                <div><div className="font-display text-xl font-semibold text-ink">{t.name}</div><div className="text-xs text-muted">{fmtDate(t.start_date)} – {fmtDate(t.end_date)} · {t.weeks} semanas</div></div>
              </div>
              {t.is_active ? <Badge tone="success" dot>Activo</Badge> : t.closed_at ? <Badge icon={Lock}>Cerrado {fmtDate(t.closed_at)}</Badge> : <Badge tone="info">Planificado</Badge>}
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center text-sm">
              {[['Cursos', t.courses], ['Actas cerradas', `${t.closed_courses}/${t.courses}`], ['Estudiantes', t.students]].map(([k, v]) => <div key={k} className="rounded-xl bg-sunken p-2.5"><div className="text-[11px] text-muted">{k}</div><div className="font-semibold text-ink">{v}</div></div>)}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {!t.closed_at && <Button size="sm" variant="secondary" icon={Pencil} onClick={() => setEditing(t)}>Editar</Button>}
              {!t.is_active && !t.closed_at && <Button size="sm" variant="soft" icon={Play} onClick={() => activate(t)}>Activar</Button>}
              {!t.closed_at && t.courses > 0 && <Button size="sm" variant="ghost" icon={Lock} onClick={() => close(t)}>Cerrar periodo</Button>}
            </div>
          </Card>
        ))}
      </div>
      {editing && <TermModal term={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />}
    </div>
  );
}

function TermModal({ term, onClose, onSaved }) {
  const { toast } = useUi();
  const y = new Date().getFullYear();
  const [form, setForm] = useState({ name: term?.name || `${y}-`, start_date: term?.start_date || '', end_date: term?.end_date || '', weeks: term?.weeks || 16, activate: false });
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!term && form.start_date && !form.end_date) {
      const d = new Date(`${form.start_date}T12:00:00`); d.setDate(d.getDate() + Number(form.weeks || 16) * 7 - 2);
      setForm((f) => ({ ...f, end_date: d.toISOString().slice(0, 10) }));
    }
  }, [form.start_date]); // eslint-disable-line react-hooks/exhaustive-deps
  const save = async () => {
    setSaving(true);
    try {
      if (term) await api.put(`/admin/terms/${term.id}`, form); else await api.post('/admin/terms', form);
      toast(term ? 'Periodo actualizado' : 'Periodo creado');
      onSaved();
    } catch (e) { toast(e.message, 'error'); } finally { setSaving(false); }
  };
  return (
    <Modal open onClose={onClose} size="sm" title={term ? 'Editar periodo' : 'Nuevo periodo académico'} description="Los Lineamientos Académicos establecen periodos de al menos 16 semanas."
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button onClick={save} loading={saving}>{term ? 'Guardar' : 'Crear periodo'}</Button></>}>
      <div className="space-y-4">
        <Field label="Nombre" required hint="Formato sugerido: AAAA-I / AAAA-II"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="2027-I" /></Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Inicio" required><Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></Field>
          <Field label="Fin" required><Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></Field>
        </div>
        <Field label="Semanas"><Input type="number" min="1" max="30" value={form.weeks} onChange={(e) => setForm({ ...form, weeks: e.target.value })} /></Field>
        {!term && <Switch checked={form.activate} onChange={(v) => setForm({ ...form, activate: v })} label="Activar este periodo al crearlo" />}
      </div>
    </Modal>
  );
}

/* ---------------- Configuración institucional ---------------- */

const FIELDS = [
  ['institution_name', 'Nombre de la institución'], ['institution_short', 'Sigla'], ['institution_code', 'Código modular / institucional'], ['institution_resolution', 'Resolución de licenciamiento'],
  ['institution_address', 'Dirección'], ['institution_director', 'Director(a) general'], ['academic_secretary', 'Secretario(a) académico(a)'], ['privacy_contact', 'Correo de protección de datos'],
];
const RULES = [
  ['min_grade', 'Nota mínima aprobatoria', 'LAG: 13 en escala vigesimal'], ['max_absence_pct', 'Límite de inasistencias (%)', 'LAG: más del 30 % desaprueba (DPI)'],
  ['recovery_min', 'Recuperación desde', 'Nota final mínima para rendir recuperación (10)'], ['recovery_max', 'Recuperación hasta', 'Nota final máxima para rendir recuperación (12)'],
];

function SettingsForm() {
  const { toast } = useUi();
  const { data, loading, error, reload } = useApi('/admin/settings');
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (data) setForm(data.values); }, [data]);
  if (loading || !form) return <PageLoader />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  const save = async () => {
    setSaving(true);
    try { await api.put('/admin/settings', form); toast('Configuración guardada'); } catch (e) { toast(e.message, 'error'); } finally { setSaving(false); }
  };
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
      <Card className="space-y-4 p-5 sm:p-6">
        <h3 className="flex items-center gap-2 font-semibold text-ink"><Settings2 size={17} className="text-primary" /> Datos institucionales</h3>
        <p className="text-xs text-muted">Aparecen en sílabos, actas, constancias y boletas emitidas por el aula virtual.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          {FIELDS.map(([k, l]) => <Field key={k} label={l} className={k === 'institution_name' ? 'sm:col-span-2' : ''}><Input value={form[k] || ''} onChange={(e) => setForm({ ...form, [k]: e.target.value })} /></Field>)}
        </div>
        <div className="flex justify-end"><Button icon={Save} loading={saving} onClick={save}>Guardar cambios</Button></div>
      </Card>
      <div className="space-y-4">
        <Card className="space-y-4 p-5">
          <h3 className="font-semibold text-ink">Reglas de evaluación</h3>
          {RULES.map(([k, l, h]) => <Field key={k} label={l} hint={h}><Input type="number" step="1" value={form[k] ?? ''} onChange={(e) => setForm({ ...form, [k]: e.target.value })} /></Field>)}
          <Field label="Versión de la política de privacidad" hint="Al cambiarla, todos los usuarios deberán aceptarla nuevamente al ingresar."><Input value={form.consent_version || ''} onChange={(e) => setForm({ ...form, consent_version: e.target.value })} /></Field>
        </Card>
        <Card className="p-4 text-xs leading-relaxed text-muted">
          <div className="mb-1 font-semibold text-ink">Marco normativo de referencia</div>
          Ley N.° 30512 · D.S. N.° 010-2017-MINEDU · Lineamientos Académicos Generales para IES y EEST (MINEDU) · Ley N.° 29733 (datos personales) · Ley N.° 29973 (accesibilidad). Los umbrales se aplican a todos los cursos salvo que un curso defina los suyos.
        </Card>
      </div>
    </div>
  );
}
