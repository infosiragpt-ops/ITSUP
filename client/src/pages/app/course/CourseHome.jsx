import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Megaphone, Pin, Trash2, Send, Info, CalendarDays, ClipboardList, Mail, ArrowRight, Layers } from 'lucide-react';
import { api, useApi } from '../../../lib/api.js';
import { useUi } from '../../../lib/context.jsx';
import { Avatar, Button, Card, EmptyState, Field, IconButton, Input, SectionTitle, Skeleton, Switch, Textarea } from '../../../components/ui.jsx';
import { SessionRow, ActivityRow } from '../../../components/lms.jsx';
import Markdown from '../../../components/Markdown.jsx';
import { fullName, relative, sessionState } from '../../../lib/format.js';
import { useCourse } from './CourseLayout.jsx';

export default function CourseHome() {
  const { course, canEdit, isStudent } = useCourse();
  const ann = useApi(`/courses/${course.id}/announcements`);
  const sessions = useApi(`/courses/${course.id}/sessions`);
  const assignments = useApi(`/courses/${course.id}/assignments`);
  const quizzes = useApi(`/courses/${course.id}/quizzes`);
  const { toast, confirm } = useUi();

  const upcomingSessions = (sessions.data || []).filter((s) => sessionState(s) !== 'past').slice(0, 3).map((s) => ({ ...s, course }));
  const upcoming = [
    ...(assignments.data || []).filter((a) => new Date(a.due_at) > new Date() && (!isStudent || !a.submission)).map((a) => ({ ...a, kind: 'assignment', course })),
    ...(quizzes.data || []).filter((q) => new Date(q.due_at) > new Date() && (!isStudent || !q.attempts)).map((q) => ({ ...q, kind: 'quiz', course })),
  ].sort((a, b) => a.due_at.localeCompare(b.due_at));

  const remove = async (a) => {
    if (!(await confirm({ title: 'Eliminar anuncio', message: `Se eliminará “${a.title}”.`, confirmText: 'Eliminar', danger: true }))) return;
    await api.del(`/announcements/${a.id}`);
    ann.setData((l) => l.filter((x) => x.id !== a.id));
    toast('Anuncio eliminado');
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0 space-y-6">
        {canEdit && <Composer courseId={course.id} onCreated={(a) => ann.setData((l) => [a, ...(l || [])])} />}
        <div>
          <SectionTitle title="Anuncios del curso" icon={Megaphone} />
          {ann.loading ? <Skeleton className="h-40 rounded-2xl" /> : ann.data.length === 0 ? (
            <Card><EmptyState compact icon={Megaphone} title="Sin anuncios todavía" description={canEdit ? 'Publica el primer anuncio para tus estudiantes.' : 'Tu docente publicará aquí las novedades del curso.'} /></Card>
          ) : (
            <div className="space-y-3">
              {ann.data.map((a) => (
                <Card key={a.id} className="p-5">
                  <div className="flex items-start gap-3">
                    <Avatar user={a.author} size={38} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 text-[13px] text-muted">
                        <span className="font-semibold text-ink">{fullName(a.author)}</span> · {relative(a.created_at)}
                        {a.pinned ? <span className="flex items-center gap-1 text-primary-ink"><Pin size={12} /> Fijado</span> : null}
                      </div>
                      <h3 className="mt-1 font-semibold text-ink">{a.title}</h3>
                      <Markdown className="mt-1.5 !text-[14.5px]">{a.body}</Markdown>
                    </div>
                    {canEdit && <IconButton icon={Trash2} label="Eliminar anuncio" size={16} onClick={() => remove(a)} />}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
        <Card className="p-5 sm:p-6">
          <SectionTitle title="Acerca del curso" icon={Info} />
          <p className="text-[15px] leading-relaxed text-ink-2">{course.description}</p>
          {course.syllabus && <p className="mt-3 text-sm text-muted">{course.syllabus}</p>}
          <Button to={`/app/cursos/${course.id}/contenido`} variant="soft" size="sm" iconRight={ArrowRight} className="mt-4">Ir al contenido</Button>
        </Card>
      </div>

      <div className="space-y-6">
        <Card className="p-5">
          <SectionTitle title="Próximas sesiones" icon={CalendarDays} action={<Link to={`/app/cursos/${course.id}/sesiones`} className="text-xs font-medium text-primary-ink hover:underline">Ver todas</Link>} />
          {sessions.loading ? <Skeleton className="h-24" /> : upcomingSessions.length === 0 ? <p className="text-sm text-muted">No hay sesiones próximas.</p> :
            <div className="-mx-1 space-y-1">{upcomingSessions.map((s) => <SessionRow key={s.id} s={s} />)}</div>}
        </Card>
        <Card className="p-5">
          <SectionTitle title={isStudent ? 'Pendientes del curso' : 'Próximos cierres'} icon={ClipboardList} />
          {assignments.loading ? <Skeleton className="h-24" /> : upcoming.length === 0 ? <p className="text-sm text-muted">No hay actividades pendientes. 🎉</p> :
            <div className="-mx-2.5">{upcoming.slice(0, 5).map((a) => (
              <ActivityRow key={`${a.kind}${a.id}`} a={a} to={`/app/cursos/${course.id}/${a.kind === 'quiz' ? 'evaluaciones' : 'tareas'}/${a.id}`} />
            ))}</div>}
        </Card>
        {course.teacher && (
          <Card className="p-5">
            <SectionTitle title="Tu docente" />
            <div className="flex items-center gap-3">
              <Avatar user={course.teacher} size={48} />
              <div className="min-w-0">
                <div className="font-semibold text-ink">{fullName(course.teacher)}</div>
                <div className="text-sm text-muted">{course.teacher.title}</div>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button href={`mailto:${course.teacher.email}`} variant="secondary" size="sm" icon={Mail}>Correo</Button>
              <Button to={`/app/cursos/${course.id}/foros`} variant="secondary" size="sm" icon={Layers}>Foros</Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

function Composer({ courseId, onCreated }) {
  const { toast } = useUi();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: '', body: '', pinned: false });
  const [saving, setSaving] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const a = await api.post(`/courses/${courseId}/announcements`, form);
      onCreated(a);
      setForm({ title: '', body: '', pinned: false });
      setOpen(false);
      toast('Anuncio publicado y notificado a tus estudiantes');
    } catch (err) { toast(err.message, 'error'); } finally { setSaving(false); }
  };
  if (!open) return (
    <button onClick={() => setOpen(true)} className="card flex w-full items-center gap-3 p-4 text-left text-sm text-muted transition hover:border-line-strong">
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-soft text-primary"><Megaphone size={17} /></span>
      Escribe un anuncio para tu clase…
    </button>
  );
  return (
    <Card as="form" onSubmit={submit} className="animate-scale-in space-y-4 p-5">
      <Field label="Título"><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ej. Material nuevo para la Unidad 3" required /></Field>
      <Field label="Mensaje" hint="Puedes usar **negrita**, listas con guiones y enlaces [texto](https://…)">
        <Textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} rows={4} required />
      </Field>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Switch checked={form.pinned} onChange={(v) => setForm({ ...form, pinned: v })} label="Fijar arriba" />
        <div className="flex gap-2">
          <Button variant="ghost" type="button" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button type="submit" icon={Send} loading={saving}>Publicar</Button>
        </div>
      </div>
    </Card>
  );
}
