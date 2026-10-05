import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MessagesSquare, Plus, ChevronRight, MessageCircle } from 'lucide-react';
import { api, useApi } from '../../../lib/api.js';
import { useUi } from '../../../lib/context.jsx';
import { Button, Card, EmptyState, ErrorState, Field, Input, Modal, Skeleton, Textarea } from '../../../components/ui.jsx';
import { relative } from '../../../lib/format.js';
import { useCourse } from './CourseLayout.jsx';

export default function CourseForums() {
  const { course, canEdit } = useCourse();
  const { data, loading, error, reload } = useApi(`/courses/${course.id}/forums`);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ title: '', description: '' });
  const [saving, setSaving] = useState(false);
  const { toast } = useUi();
  if (error) return <ErrorState message={error} onRetry={reload} />;

  const create = async () => {
    setSaving(true);
    try {
      await api.post(`/courses/${course.id}/forums`, form);
      setCreating(false); setForm({ title: '', description: '' }); reload();
      toast('Foro creado');
    } catch (e) { toast(e.message, 'error'); } finally { setSaving(false); }
  };

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted">Espacios para resolver dudas, debatir y compartir con tu clase. Sé respetuoso(a) y constructivo(a).</p>
        {canEdit && <Button icon={Plus} onClick={() => setCreating(true)}>Nuevo foro</Button>}
      </div>
      {loading ? <Skeleton className="h-48 rounded-2xl" /> : data.length === 0 ? (
        <Card><EmptyState icon={MessagesSquare} title="Aún no hay foros" description="Cuando el docente cree un foro aparecerá aquí." /></Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {data.map((f) => (
            <Link key={f.id} to={`/app/cursos/${course.id}/foros/${f.id}`} className="group card flex gap-4 p-5 transition hover:-translate-y-0.5 hover:shadow-lift">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary"><MessagesSquare size={22} /></span>
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-ink">{f.title}</h3>
                <p className="mt-1 line-clamp-2 text-sm text-muted">{f.description}</p>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-faint">
                  <span>{f.threads} temas</span><span className="flex items-center gap-1"><MessageCircle size={12} /> {f.posts} respuestas</span>
                  {f.last_activity && <span>Actividad {relative(f.last_activity)}</span>}
                </div>
              </div>
              <ChevronRight size={18} className="self-center text-faint transition group-hover:translate-x-0.5" />
            </Link>
          ))}
        </div>
      )}
      <Modal open={creating} onClose={() => setCreating(false)} title="Nuevo foro"
        footer={<><Button variant="ghost" onClick={() => setCreating(false)}>Cancelar</Button><Button onClick={create} loading={saving}>Crear foro</Button></>}>
        <div className="space-y-4">
          <Field label="Título" required><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Debate · …" /></Field>
          <Field label="Descripción o consigna"><Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
        </div>
      </Modal>
    </div>
  );
}
