import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, Pin, MessageCircle, MessagesSquare, Search } from 'lucide-react';
import { api, useApi } from '../../../lib/api.js';
import { useUi } from '../../../lib/context.jsx';
import { Avatar, Badge, Button, Card, EmptyState, ErrorState, Field, Input, Modal, PageLoader, Switch, Textarea } from '../../../components/ui.jsx';
import { fullName, relative } from '../../../lib/format.js';
import { useCourse } from './CourseLayout.jsx';

export default function ForumThreads() {
  const { forumId } = useParams();
  const { course, canEdit } = useCourse();
  const { data, loading, error, reload } = useApi(`/forums/${forumId}/threads`);
  const [composing, setComposing] = useState(false);
  const [form, setForm] = useState({ title: '', body: '', pinned: false });
  const [saving, setSaving] = useState(false);
  const [q, setQ] = useState('');
  const { toast } = useUi();
  const nav = useNavigate();
  if (loading) return <PageLoader />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  const create = async () => {
    setSaving(true);
    try {
      const t = await api.post(`/forums/${forumId}/threads`, form);
      toast('Tema publicado');
      nav(`/app/cursos/${course.id}/foros/${forumId}/${t.id}`);
    } catch (e) { toast(e.message, 'error'); setSaving(false); }
  };
  const threads = data.threads.filter((t) => !q || `${t.title} ${t.body}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-5">
      <Link to={`/app/cursos/${course.id}/foros`} className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink"><ArrowLeft size={16} /> Foros del curso</Link>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-display text-[1.8rem] font-semibold text-ink">{data.forum.title}</h2>
          {data.forum.description && <p className="mt-1 max-w-2xl text-[15px] text-muted">{data.forum.description}</p>}
        </div>
        <Button icon={Plus} onClick={() => setComposing(true)}>Nuevo tema</Button>
      </div>
      <div className="relative max-w-sm"><Search size={16} className="absolute top-1/2 left-3 -translate-y-1/2 text-faint" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar en este foro" className="pl-9" /></div>
      {threads.length === 0 ? (
        <Card><EmptyState icon={MessagesSquare} title={q ? 'Sin resultados' : 'Sé el primero en participar'} description={q ? 'Prueba con otras palabras.' : 'Publica una pregunta o comparte una idea con tu clase.'}
          action={!q && <Button icon={Plus} onClick={() => setComposing(true)}>Crear tema</Button>} /></Card>
      ) : (
        <Card className="divide-y divide-line overflow-hidden">
          {threads.map((t) => (
            <Link key={t.id} to={`/app/cursos/${course.id}/foros/${forumId}/${t.id}`} className="flex gap-4 p-4 transition hover:bg-sunken/60 sm:px-5">
              <Avatar user={t.author} size={40} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  {t.pinned ? <Badge tone="primary" icon={Pin}>Fijado</Badge> : null}
                  {t.author?.role === 'teacher' && <Badge tone="info">Docente</Badge>}
                  <h3 className="font-semibold text-ink">{t.title}</h3>
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-muted">{t.body}</p>
                <div className="mt-2 text-xs text-faint">{fullName(t.author)} · {relative(t.created_at)}</div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1 text-xs text-muted">
                <span className="flex items-center gap-1 rounded-full bg-sunken px-2 py-1 font-semibold"><MessageCircle size={13} /> {t.replies}</span>
                <span className="hidden sm:block">{relative(t.last_activity)}</span>
              </div>
            </Link>
          ))}
        </Card>
      )}
      <Modal open={composing} onClose={() => setComposing(false)} title="Nuevo tema" size="lg"
        footer={<><Button variant="ghost" onClick={() => setComposing(false)}>Cancelar</Button><Button onClick={create} loading={saving}>Publicar</Button></>}>
        <div className="space-y-4">
          <Field label="Título" required><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Resume tu pregunta o idea" /></Field>
          <Field label="Mensaje" required hint="Admite **negrita**, listas y `código`."><Textarea rows={6} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} /></Field>
          {canEdit && <Switch checked={form.pinned} onChange={(v) => setForm({ ...form, pinned: v })} label="Fijar este tema arriba" />}
        </div>
      </Modal>
    </div>
  );
}
