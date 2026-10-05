import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ListChecks, Plus, Timer, RotateCcw, ChevronRight, Trash2, CheckCircle2, Circle, Square, CheckSquare, HelpCircle } from 'lucide-react';
import { api, useApi } from '../../../lib/api.js';
import { useUi } from '../../../lib/context.jsx';
import { Badge, Button, Card, EmptyState, ErrorState, Field, IconButton, Input, Modal, Select, Skeleton, Textarea, cx } from '../../../components/ui.jsx';
import { DueChip, ClosedNotice } from '../../../components/lms.jsx';
import { fmtDateTime, fmtGrade, gradeTone, fromLocalInput, toLocalInput } from '../../../lib/format.js';
import { useCourse } from './CourseLayout.jsx';

export default function CourseQuizzes() {
  const { course, canEdit, closed } = useCourse();
  const { data, loading, error, reload } = useApi(`/courses/${course.id}/quizzes`);
  const [creating, setCreating] = useState(false);
  if (error) return <ErrorState message={error} onRetry={reload} />;
  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted">Cuestionarios con tiempo límite y calificación automática. Se considera tu mejor intento.</p>
        {canEdit && !closed && <Button icon={Plus} onClick={() => setCreating(true)}>Nueva evaluación</Button>}
      </div>
      {closed && <div className="mb-4"><ClosedNotice course={course} compact /></div>}
      {loading ? <Skeleton className="h-56 rounded-2xl" /> : data.length === 0 ? (
        <Card><EmptyState icon={ListChecks} title="Sin evaluaciones" description={canEdit ? 'Crea un cuestionario con calificación automática.' : 'Tu docente aún no publicó evaluaciones en este curso.'} /></Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {data.map((q) => {
            const open = new Date(q.due_at) > new Date() && (!q.available_from || new Date(q.available_from) <= new Date());
            return (
              <Link key={q.id} to={`/app/cursos/${course.id}/evaluaciones/${q.id}`} className="group card flex flex-col p-5 transition hover:-translate-y-0.5 hover:shadow-lift">
                <div className="flex items-start gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-info-soft text-info"><ListChecks size={20} /></span>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-ink">{q.title}</h3>
                    <div className="mt-0.5 text-sm text-muted">Cierra: {fmtDateTime(q.due_at)}</div>
                  </div>
                  <ChevronRight size={18} className="text-faint transition group-hover:translate-x-0.5" />
                </div>
                <div className="mt-4 flex flex-wrap gap-2 text-xs">
                  <Badge icon={HelpCircle}>{q.questions} preguntas</Badge>
                  <Badge icon={Timer}>{q.time_limit_min} min</Badge>
                  <Badge icon={RotateCcw}>{q.max_attempts} {q.max_attempts === 1 ? 'intento' : 'intentos'}</Badge>
                  {q.category && <Badge tone="primary">{q.category}</Badge>}
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-line pt-4">
                  {canEdit ? (
                    <><span className="text-sm text-muted">{q.stats.students} estudiantes rindieron</span>{q.stats.average != null && <Badge tone={gradeTone(q.stats.average)}>Promedio {fmtGrade(q.stats.average)}</Badge>}</>
                  ) : q.best != null ? (
                    <><span className="text-sm text-muted">Mejor nota</span><Badge tone={gradeTone(q.best, q.points)}>{fmtGrade(q.best)}/{q.points}</Badge></>
                  ) : (
                    <><span className="text-sm text-muted">{open ? 'Disponible ahora' : 'No rendido'}</span><DueChip due={q.due_at} /></>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
      {creating && <QuizBuilder courseId={course.id} onClose={() => setCreating(false)} onSaved={() => { setCreating(false); reload(); }} />}
    </div>
  );
}

const blankQ = () => ({ type: 'single', prompt: '', options: ['', '', '', ''], correct: [], points: 1, explanation: '' });

function QuizBuilder({ courseId, onClose, onSaved }) {
  const { toast } = useUi();
  const { course } = useCourse();
  const categories = course?.categories || [];
  const modules = useApi(`/courses/${courseId}/modules`);
  const due = new Date(Date.now() + 7 * 864e5); due.setUTCHours(4, 59, 0, 0);
  const [meta, setMeta] = useState({ title: '', description: '', due_at: toLocalInput(due), time_limit_min: 20, max_attempts: 2, module_id: '', category_id: categories[0]?.id || '' });
  const [questions, setQuestions] = useState([blankQ()]);
  const [saving, setSaving] = useState(false);

  const upd = (i, patch) => setQuestions((qs) => qs.map((q, j) => (j === i ? { ...q, ...patch } : q)));
  const toggleCorrect = (i, oi) => {
    const q = questions[i];
    if (q.type === 'multiple') upd(i, { correct: q.correct.includes(oi) ? q.correct.filter((x) => x !== oi) : [...q.correct, oi] });
    else upd(i, { correct: [oi] });
  };

  const save = async () => {
    setSaving(true);
    try {
      await api.post(`/courses/${courseId}/quizzes`, { ...meta, due_at: fromLocalInput(meta.due_at), questions });
      toast('Evaluación publicada y notificada');
      onSaved();
    } catch (e) { toast(e.message, 'error'); } finally { setSaving(false); }
  };

  return (
    <Modal open onClose={onClose} size="xl" title="Nueva evaluación" description="Las preguntas se califican automáticamente sobre 20 puntos."
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button onClick={save} loading={saving}>Publicar evaluación</Button></>}>
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Título" required className="sm:col-span-2"><Input value={meta.title} onChange={(e) => setMeta({ ...meta, title: e.target.value })} placeholder="Cuestionario 3 · …" /></Field>
          <Field label="Indicaciones" className="sm:col-span-2"><Textarea rows={2} value={meta.description} onChange={(e) => setMeta({ ...meta, description: e.target.value })} /></Field>
          <Field label="Cierra (hora Lima)" required><Input type="datetime-local" value={meta.due_at} onChange={(e) => setMeta({ ...meta, due_at: e.target.value })} /></Field>
          <Field label="Unidad"><Select value={meta.module_id} onChange={(e) => setMeta({ ...meta, module_id: e.target.value })}><option value="">Sin unidad</option>{modules.data?.modules.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}</Select></Field>
          <Field label="Tiempo límite (min)"><Input type="number" min="1" value={meta.time_limit_min} onChange={(e) => setMeta({ ...meta, time_limit_min: e.target.value })} /></Field>
          <Field label="Intentos permitidos"><Input type="number" min="1" max="5" value={meta.max_attempts} onChange={(e) => setMeta({ ...meta, max_attempts: e.target.value })} /></Field>
          <Field label="Criterio de evaluación" className="sm:col-span-2" hint={categories.length ? 'Define el peso de esta evaluación en el promedio.' : 'Este curso usa promedio simple.'}>
            <Select value={meta.category_id} onChange={(e) => setMeta({ ...meta, category_id: e.target.value })} disabled={!categories.length}>
              <option value="">Sin criterio (no pondera)</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name} · {c.weight}%</option>)}
            </Select>
          </Field>
        </div>
        <div className="space-y-4">
          {questions.map((q, i) => (
            <div key={i} className="rounded-2xl border border-line bg-sunken/40 p-4">
              <div className="mb-3 flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-white">{i + 1}</span>
                <Select value={q.type} onChange={(e) => upd(i, { type: e.target.value, correct: [], options: e.target.value === 'truefalse' ? ['Verdadero', 'Falso'] : q.options.length < 2 ? ['', '', '', ''] : q.options })} className="!w-auto !py-1.5 text-sm">
                  <option value="single">Opción única</option><option value="multiple">Opción múltiple</option><option value="truefalse">Verdadero / Falso</option>
                </Select>
                <div className="ml-auto flex items-center gap-2">
                  <Input type="number" min="1" value={q.points} onChange={(e) => upd(i, { points: e.target.value })} className="!w-16 !py-1.5 text-sm" aria-label="Puntos" />
                  <span className="text-xs text-muted">pts</span>
                  {questions.length > 1 && <IconButton icon={Trash2} size={16} label="Quitar pregunta" onClick={() => setQuestions((qs) => qs.filter((_, j) => j !== i))} />}
                </div>
              </div>
              <Textarea rows={2} value={q.prompt} onChange={(e) => upd(i, { prompt: e.target.value })} placeholder="Escribe el enunciado de la pregunta" />
              <div className="mt-3 space-y-2">
                {(q.type === 'truefalse' ? ['Verdadero', 'Falso'] : q.options).map((o, oi) => {
                  const ok = q.correct.includes(oi);
                  const Icon = q.type === 'multiple' ? (ok ? CheckSquare : Square) : ok ? CheckCircle2 : Circle;
                  return (
                    <div key={oi} className="flex items-center gap-2">
                      <button type="button" onClick={() => toggleCorrect(i, oi)} aria-label="Marcar como correcta" className={ok ? 'text-success' : 'text-line-strong hover:text-success'}><Icon size={20} /></button>
                      {q.type === 'truefalse' ? <span className="text-sm text-ink">{o}</span> : (
                        <Input value={o} onChange={(e) => upd(i, { options: q.options.map((x, k) => (k === oi ? e.target.value : x)) })} placeholder={`Opción ${oi + 1}`} className={cx('!py-1.5 text-sm', ok && '!border-success')} />
                      )}
                    </div>
                  );
                })}
                {q.type !== 'truefalse' && q.options.length < 6 && (
                  <button type="button" onClick={() => upd(i, { options: [...q.options, ''] })} className="text-xs font-medium text-primary-ink hover:underline">+ Agregar opción</button>
                )}
              </div>
              <Input value={q.explanation} onChange={(e) => upd(i, { explanation: e.target.value })} placeholder="Explicación (se muestra al estudiante tras enviar) · opcional" className="mt-3 !py-1.5 text-sm" />
            </div>
          ))}
          <Button variant="secondary" icon={Plus} className="w-full" onClick={() => setQuestions((qs) => [...qs, blankQ()])}>Agregar pregunta</Button>
        </div>
      </div>
    </Modal>
  );
}
