import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardList, Plus, ChevronRight, CheckCircle2, Users } from 'lucide-react';
import { api, useApi } from '../../../lib/api.js';
import { useUi } from '../../../lib/context.jsx';
import { Badge, Button, Card, EmptyState, ErrorState, Field, Input, Modal, Segmented, Select, Skeleton, Switch, Textarea, cx } from '../../../components/ui.jsx';
import { DueChip } from '../../../components/lms.jsx';
import { fmtDateTime, fmtGrade, gradeTone, fromLocalInput, toLocalInput } from '../../../lib/format.js';
import { useCourse } from './CourseLayout.jsx';

export default function CourseAssignments() {
  const { course, canEdit } = useCourse();
  const { data, loading, error, reload } = useApi(`/courses/${course.id}/assignments`);
  const [filter, setFilter] = useState('pending');
  const [creating, setCreating] = useState(false);
  if (error) return <ErrorState message={error} onRetry={reload} />;

  const now = new Date();
  const status = (a) => (canEdit ? (new Date(a.due_at) > now ? 'pending' : 'closed') : a.submission ? (a.submission.grade != null ? 'graded' : 'submitted') : 'pending');
  const counts = (data || []).reduce((acc, a) => ({ ...acc, [status(a)]: (acc[status(a)] || 0) + 1 }), {});
  const options = canEdit
    ? [{ value: 'pending', label: 'Abiertas', count: counts.pending || 0 }, { value: 'closed', label: 'Cerradas', count: counts.closed || 0 }, { value: 'all', label: 'Todas' }]
    : [{ value: 'pending', label: 'Pendientes', count: counts.pending || 0 }, { value: 'submitted', label: 'Entregadas', count: counts.submitted || 0 }, { value: 'graded', label: 'Calificadas', count: counts.graded || 0 }, { value: 'all', label: 'Todas' }];
  const list = (data || []).filter((a) => filter === 'all' || status(a) === filter);

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="no-scrollbar overflow-x-auto"><Segmented value={filter} onChange={setFilter} options={options} /></div>
        {canEdit && <Button icon={Plus} onClick={() => setCreating(true)}>Nueva tarea</Button>}
      </div>
      {loading ? <Skeleton className="h-64 rounded-2xl" /> : list.length === 0 ? (
        <Card><EmptyState icon={filter === 'pending' && !canEdit ? CheckCircle2 : ClipboardList}
          title={filter === 'pending' && !canEdit ? '¡Estás al día!' : 'No hay tareas en esta vista'}
          description={filter === 'pending' && !canEdit ? 'No tienes tareas pendientes en este curso.' : 'Cambia el filtro para ver otras tareas.'} /></Card>
      ) : (
        <Card className="divide-y divide-line overflow-hidden">
          {list.map((a) => (
            <Link key={a.id} to={`/app/cursos/${course.id}/tareas/${a.id}`} className="flex flex-col gap-3 p-4 transition hover:bg-sunken/60 sm:flex-row sm:items-center sm:px-5">
              <span className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary sm:flex"><ClipboardList size={20} /></span>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-ink">{a.title}</div>
                <div className="text-sm text-muted">Fecha límite: {fmtDateTime(a.due_at)} · {a.points} puntos</div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {canEdit ? (
                  <>
                    <Badge icon={Users}>{a.stats.submitted}/{a.stats.students} entregas</Badge>
                    {a.stats.pending > 0 && <Badge tone="warn">{a.stats.pending} por calificar</Badge>}
                    <DueChip due={a.due_at} />
                  </>
                ) : a.submission?.grade != null ? (
                  <Badge tone={gradeTone(a.submission.grade, a.points)}>Nota: {fmtGrade(a.submission.grade)}/{a.points}</Badge>
                ) : (
                  <DueChip due={a.due_at} done={!!a.submission} />
                )}
                <ChevronRight size={18} className="hidden text-faint sm:block" />
              </div>
            </Link>
          ))}
        </Card>
      )}
      {creating && <AssignmentModal courseId={course.id} onClose={() => setCreating(false)} onSaved={() => { setCreating(false); reload(); }} />}
    </div>
  );
}

export function AssignmentModal({ courseId, assignment, onClose, onSaved }) {
  const { toast } = useUi();
  const modules = useApi(`/courses/${courseId}/modules`);
  const defaultDue = new Date(Date.now() + 7 * 864e5);
  defaultDue.setUTCHours(4, 59, 0, 0); // 23:59 Lima
  const [form, setForm] = useState({
    title: assignment?.title || '', instructions: assignment?.instructions || '', points: assignment?.points || 20,
    due_at: toLocalInput(assignment?.due_at || defaultDue), module_id: assignment?.module_id || '', allow_late: assignment ? !!assignment.allow_late : true,
  });
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      const body = { ...form, due_at: fromLocalInput(form.due_at) };
      const r = assignment ? await api.put(`/assignments/${assignment.id}`, body) : await api.post(`/courses/${courseId}/assignments`, body);
      toast(assignment ? 'Tarea actualizada' : 'Tarea publicada y notificada a tus estudiantes');
      onSaved(r);
    } catch (e) { toast(e.message, 'error'); } finally { setSaving(false); }
  };
  return (
    <Modal open onClose={onClose} size="lg" title={assignment ? 'Editar tarea' : 'Nueva tarea'}
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button onClick={save} loading={saving}>{assignment ? 'Guardar' : 'Publicar tarea'}</Button></>}>
      <div className="space-y-4">
        <Field label="Título" required><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Tarea 4 · …" /></Field>
        <Field label="Instrucciones" hint="Explica qué deben entregar, el formato y cómo se evaluará.">
          <Textarea rows={7} value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} />
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Fecha límite (hora Lima)" required><Input type="datetime-local" value={form.due_at} onChange={(e) => setForm({ ...form, due_at: e.target.value })} /></Field>
          <Field label="Puntaje máximo"><Input type="number" min="1" max="100" value={form.points} onChange={(e) => setForm({ ...form, points: e.target.value })} /></Field>
          {!assignment && (
            <Field label="Unidad">
              <Select value={form.module_id} onChange={(e) => setForm({ ...form, module_id: e.target.value })}>
                <option value="">Sin unidad</option>
                {modules.data?.modules.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
              </Select>
            </Field>
          )}
        </div>
        {!assignment && <Switch checked={form.allow_late} onChange={(v) => setForm({ ...form, allow_late: v })} label="Permitir entregas fuera de plazo (se marcarán como tardías)" />}
      </div>
    </Modal>
  );
}

