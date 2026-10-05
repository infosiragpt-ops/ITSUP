import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, Calendar, Award, Upload, Paperclip, Send, CheckCircle2, Clock, Pencil, Trash2, Download, MessageSquareText, AlertTriangle, Search, FileText,
} from 'lucide-react';
import { api, useApi, fileUrl } from '../../../lib/api.js';
import { useUi } from '../../../lib/context.jsx';
import { Avatar, Badge, Button, Card, EmptyState, ErrorState, Field, Input, PageLoader, Segmented, Textarea, cx } from '../../../components/ui.jsx';
import { DueChip } from '../../../components/lms.jsx';
import Markdown from '../../../components/Markdown.jsx';
import { fmtDateTime, fmtGrade, fullName, gradeTone, relative } from '../../../lib/format.js';
import { useCourse } from './CourseLayout.jsx';
import { AssignmentModal } from './CourseAssignments.jsx';

export default function AssignmentDetail() {
  const { assignmentId } = useParams();
  const { course } = useCourse();
  const { data: a, loading, error, reload, setData } = useApi(`/assignments/${assignmentId}`);
  const [editing, setEditing] = useState(false);
  const { confirm, toast } = useUi();
  const nav = useNavigate();
  if (loading) return <PageLoader />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  const remove = async () => {
    if (!(await confirm({ title: 'Eliminar tarea', message: 'Se eliminarán también todas las entregas y notas asociadas.', confirmText: 'Eliminar', danger: true }))) return;
    await api.del(`/assignments/${a.id}`);
    toast('Tarea eliminada');
    nav(`/app/cursos/${course.id}/tareas`);
  };

  return (
    <div className="space-y-6">
      <Link to={`/app/cursos/${course.id}/tareas`} className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink"><ArrowLeft size={16} /> Todas las tareas</Link>
      <div className={cx('grid gap-6', !a.can_edit && 'lg:grid-cols-[minmax(0,1fr)_380px]')}>
        <Card className="min-w-0 p-5 sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="mb-2 flex flex-wrap gap-2"><Badge tone="primary">Tarea</Badge><DueChip due={a.due_at} done={!!a.submission} /></div>
              <h2 className="font-display text-[1.7rem] leading-tight font-semibold text-ink sm:text-[2rem]">{a.title}</h2>
            </div>
            {a.can_edit && (
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" icon={Pencil} onClick={() => setEditing(true)}>Editar</Button>
                <Button variant="ghost" size="sm" icon={Trash2} onClick={remove}>Eliminar</Button>
              </div>
            )}
          </div>
          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
            <span className="flex items-center gap-1.5"><Calendar size={15} /> Entrega hasta el {fmtDateTime(a.due_at)}</span>
            <span className="flex items-center gap-1.5"><Award size={15} /> {a.points} puntos</span>
            <span className="flex items-center gap-1.5"><Clock size={15} /> {a.allow_late ? 'Acepta entregas tardías' : 'No acepta entregas tardías'}</span>
          </div>
          <div className="my-6 h-px bg-line" />
          <h3 className="mb-2 text-sm font-semibold tracking-wide text-muted uppercase">Instrucciones</h3>
          <Markdown>{a.instructions || 'Sin instrucciones adicionales.'}</Markdown>
        </Card>
        {!a.can_edit && <StudentSubmission a={a} onSaved={(s) => setData((x) => ({ ...x, submission: s }))} />}
      </div>
      {a.can_edit && <Grader a={a} onChange={reload} />}
      {editing && <AssignmentModal courseId={course.id} assignment={a} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); reload(); }} />}
    </div>
  );
}

function StudentSubmission({ a, onSaved }) {
  const { toast } = useUi();
  const s = a.submission;
  const [editing, setEditing] = useState(!s);
  const [body, setBody] = useState(s?.body || '');
  const [file, setFile] = useState(null);
  const [sending, setSending] = useState(false);
  const late = new Date() > new Date(a.due_at);
  const closed = late && !a.allow_late;

  const submit = async (e) => {
    e.preventDefault();
    if (!body.trim() && !file && !s?.file_name) return toast('Escribe una respuesta o adjunta un archivo', 'error');
    setSending(true);
    try {
      const fd = new FormData();
      fd.append('body', body);
      if (file) fd.append('file', file);
      const r = await api.form(`/assignments/${a.id}/submit`, fd);
      onSaved(r);
      setEditing(false);
      setFile(null);
      toast('¡Entrega enviada! Tu docente fue notificado.');
    } catch (err) { toast(err.message, 'error'); } finally { setSending(false); }
  };

  if (s && s.grade != null) {
    return (
      <Card className="h-fit overflow-hidden">
        <div className="bg-gradient-to-br from-success-soft to-transparent p-6 text-center">
          <div className="text-sm font-medium text-muted">Tu calificación</div>
          <div className={cx('font-display mt-1 text-5xl font-semibold tabular-nums', gradeTone(s.grade, a.points) === 'success' ? 'text-success' : 'text-danger')}>
            {fmtGrade(s.grade)}<span className="text-2xl text-faint">/{a.points}</span>
          </div>
          <div className="mt-1 text-xs text-muted">Calificado {relative(s.graded_at)}</div>
        </div>
        {s.feedback && (
          <div className="border-t border-line p-5">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink"><MessageSquareText size={16} className="text-primary" /> Retroalimentación del docente</div>
            <p className="rounded-xl bg-sunken p-3.5 text-sm leading-relaxed text-ink-2">{s.feedback}</p>
          </div>
        )}
        <SubmittedBox s={s} />
      </Card>
    );
  }

  if (s && !editing) {
    return (
      <Card className="h-fit overflow-hidden">
        <div className="flex items-center gap-3 border-b border-line bg-success-soft/60 p-5">
          <CheckCircle2 size={26} className="text-success" />
          <div><div className="font-semibold text-ink">Entrega enviada</div><div className="text-xs text-muted">{fmtDateTime(s.submitted_at)}{new Date(s.submitted_at) > new Date(a.due_at) ? ' · Tardía' : ''}</div></div>
        </div>
        <SubmittedBox s={s} />
        <div className="border-t border-line p-4">
          <p className="mb-3 text-xs text-muted">Puedes editar tu entrega mientras no haya sido calificada.</p>
          {!closed && <Button variant="secondary" icon={Pencil} className="w-full" onClick={() => setEditing(true)}>Editar entrega</Button>}
        </div>
      </Card>
    );
  }

  return (
    <Card as="form" onSubmit={submit} className="h-fit space-y-4 p-5">
      <div>
        <h3 className="font-semibold text-ink">{s ? 'Editar mi entrega' : 'Mi entrega'}</h3>
        <p className="text-xs text-muted">Escribe tu respuesta, adjunta un archivo o ambos.</p>
      </div>
      {closed ? (
        <div className="flex gap-2 rounded-xl bg-danger-soft p-3 text-sm text-danger"><AlertTriangle size={17} className="shrink-0" /> El plazo de entrega venció y esta tarea no acepta entregas tardías.</div>
      ) : (
        <>
          {late && <div className="flex gap-2 rounded-xl bg-warn-soft p-3 text-sm text-warn"><AlertTriangle size={17} className="shrink-0" /> La fecha límite ya pasó. Tu entrega se registrará como tardía.</div>}
          <Field label="Respuesta o comentarios"><Textarea rows={6} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Escribe aquí o pega el enlace de tu repositorio…" /></Field>
          <label className={cx('flex cursor-pointer items-center gap-3 rounded-xl border border-dashed p-4 text-sm transition', file ? 'border-primary bg-primary-soft text-primary-ink' : 'border-line-strong bg-sunken text-muted hover:border-primary')}>
            {file ? <Paperclip size={18} /> : <Upload size={18} className="text-primary" />}
            <span className="min-w-0 flex-1 truncate">{file ? file.name : s?.file_name ? `Reemplazar ${s.file_name}` : 'Adjuntar archivo (máx. 25 MB)'}</span>
            <input type="file" className="hidden" onChange={(e) => setFile(e.target.files[0])} />
          </label>
          <div className="flex gap-2">
            {s && <Button variant="ghost" type="button" onClick={() => setEditing(false)}>Cancelar</Button>}
            <Button type="submit" icon={Send} loading={sending} className="flex-1">Enviar entrega</Button>
          </div>
        </>
      )}
    </Card>
  );
}

function SubmittedBox({ s }) {
  if (!s.body && !s.file_name) return null;
  return (
    <div className="space-y-3 border-t border-line p-5">
      <div className="text-xs font-semibold tracking-wide text-muted uppercase">Lo que enviaste</div>
      {s.body && <p className="text-sm whitespace-pre-wrap text-ink-2">{s.body}</p>}
      {s.file_name && (
        <a href={fileUrl(s.file_path, s.file_name)} className="flex items-center gap-3 rounded-xl border border-line p-3 text-sm hover:bg-sunken">
          <FileText size={18} className="text-primary" /> <span className="min-w-0 flex-1 truncate text-ink">{s.file_name}</span> <Download size={16} className="text-muted" />
        </a>
      )}
    </div>
  );
}

function Grader({ a, onChange }) {
  const [params] = useSearchParams();
  const [filter, setFilter] = useState('pending');
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState(() => Number(params.get('entrega')) || null);
  const rows = a.submissions;
  const submitted = rows.filter((r) => r.submission);
  const pending = submitted.filter((r) => r.submission.grade == null);
  const list = rows.filter((r) => {
    if (q && !fullName(r.student).toLowerCase().includes(q.toLowerCase())) return false;
    if (filter === 'pending') return r.submission && r.submission.grade == null;
    if (filter === 'graded') return r.submission?.grade != null;
    if (filter === 'missing') return !r.submission;
    return true;
  });
  const current = rows.find((r) => r.submission?.id === selected) || null;
  useEffect(() => { if (!selected && pending[0]) setSelected(pending[0].submission.id); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const nextPending = () => {
    const n = pending.find((r) => r.submission.id !== selected);
    setSelected(n?.submission.id || null);
  };

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <h3 className="font-display text-2xl font-semibold text-ink">Entregas de estudiantes</h3>
        <div className="flex flex-wrap gap-2 text-sm">
          <Badge tone="info">{submitted.length}/{rows.length} entregaron</Badge>
          <Badge tone="warn">{pending.length} por calificar</Badge>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
        <Card className="h-fit overflow-hidden">
          <div className="space-y-3 border-b border-line p-3">
            <div className="relative"><Search size={15} className="absolute top-1/2 left-3 -translate-y-1/2 text-faint" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar estudiante" className="pl-9 !py-2" /></div>
            <div className="no-scrollbar overflow-x-auto">
              <Segmented value={filter} onChange={setFilter} options={[
                { value: 'pending', label: 'Por calificar', count: pending.length },
                { value: 'graded', label: 'Calificadas' },
                { value: 'missing', label: 'Sin entrega', count: rows.length - submitted.length },
                { value: 'all', label: 'Todas' },
              ]} />
            </div>
          </div>
          <ul className="scrollbar-thin max-h-[520px] divide-y divide-line overflow-y-auto">
            {list.length === 0 && <li className="p-6 text-center text-sm text-muted">Nada por aquí.</li>}
            {list.map((r) => (
              <li key={r.student.id}>
                <button disabled={!r.submission} onClick={() => setSelected(r.submission.id)}
                  className={cx('flex w-full items-center gap-3 px-4 py-3 text-left transition disabled:cursor-default', selected === r.submission?.id ? 'bg-primary-soft' : r.submission && 'hover:bg-sunken')}>
                  <Avatar user={r.student} size={32} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-ink">{fullName(r.student)}</div>
                    <div className="text-xs text-muted">{r.submission ? `Entregó ${relative(r.submission.submitted_at)}` : 'Sin entrega'}</div>
                  </div>
                  {r.submission?.grade != null ? <Badge tone={gradeTone(r.submission.grade, a.points)}>{fmtGrade(r.submission.grade)}</Badge>
                    : r.submission ? <span className="h-2 w-2 rounded-full bg-warn" /> : null}
                </button>
              </li>
            ))}
          </ul>
        </Card>
        {current ? <GradeForm key={current.submission.id} a={a} row={current} onSaved={() => { onChange(); nextPending(); }} /> : (
          <Card><EmptyState icon={CheckCircle2} title={pending.length ? 'Selecciona una entrega' : '¡Todo calificado!'} description={pending.length ? 'Elige un estudiante de la lista para revisar su trabajo.' : 'No quedan entregas pendientes para esta tarea.'} /></Card>
        )}
      </div>
    </div>
  );
}

function GradeForm({ a, row, onSaved }) {
  const { toast } = useUi();
  const s = row.submission;
  const [grade, setGrade] = useState(s.grade ?? '');
  const [feedback, setFeedback] = useState(s.feedback || '');
  const [saving, setSaving] = useState(false);
  const quick = ['¡Excelente trabajo! Sigue así.', 'Buen trabajo. Revisa los comentarios para mejorar.', 'Cumple con lo solicitado; profundiza más en el análisis.', 'Falta completar algunos puntos de la consigna.'];
  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put(`/submissions/${s.id}/grade`, { grade: Number(grade), feedback });
      toast(`Nota publicada para ${row.student.first_name}`);
      onSaved();
    } catch (err) { toast(err.message, 'error'); } finally { setSaving(false); }
  };
  return (
    <Card className="animate-fade-in overflow-hidden">
      <div className="flex items-center gap-3 border-b border-line p-5">
        <Avatar user={row.student} size={42} />
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-ink">{fullName(row.student)}</div>
          <div className="text-xs text-muted">{row.student.code} · Entregado {fmtDateTime(s.submitted_at)}{new Date(s.submitted_at) > new Date(a.due_at) ? ' · Tardía' : ''}</div>
        </div>
      </div>
      <div className="space-y-4 p-5">
        {s.body && <p className="rounded-xl bg-sunken p-4 text-sm leading-relaxed whitespace-pre-wrap text-ink-2">{s.body}</p>}
        {s.file_name && (
          <a href={fileUrl(s.file_path, s.file_name)} className="flex items-center gap-3 rounded-xl border border-line p-3 text-sm hover:bg-sunken">
            <FileText size={18} className="text-primary" /><span className="min-w-0 flex-1 truncate text-ink">{s.file_name}</span><Download size={16} className="text-muted" />
          </a>
        )}
      </div>
      <form onSubmit={save} className="space-y-4 border-t border-line bg-sunken/40 p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[160px_1fr]">
          <Field label={`Nota (0 – ${a.points})`} required>
            <Input type="number" step="0.5" min="0" max={a.points} value={grade} onChange={(e) => setGrade(e.target.value)} className="text-lg font-semibold" required />
          </Field>
          <Field label="Retroalimentación">
            <Textarea rows={3} value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="Comentarios para el estudiante…" />
          </Field>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {quick.map((t) => <button type="button" key={t} onClick={() => setFeedback(t)} className="rounded-full border border-line bg-surface px-3 py-1 text-xs text-ink-2 hover:border-primary">{t}</button>)}
        </div>
        <div className="flex justify-end"><Button type="submit" icon={Send} loading={saving}>{s.grade != null ? 'Actualizar nota' : 'Publicar nota'}</Button></div>
      </form>
    </Card>
  );
}
