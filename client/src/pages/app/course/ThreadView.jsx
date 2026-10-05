import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Send, Trash2, Pin } from 'lucide-react';
import { api, useApi } from '../../../lib/api.js';
import { useAuth, useUi } from '../../../lib/context.jsx';
import { Avatar, Badge, Button, Card, ErrorState, IconButton, PageLoader, Textarea } from '../../../components/ui.jsx';
import Markdown from '../../../components/Markdown.jsx';
import { fmtDateTime, fullName, relative } from '../../../lib/format.js';
import { useCourse } from './CourseLayout.jsx';

export default function ThreadView() {
  const { forumId, threadId } = useParams();
  const { course } = useCourse();
  const { user } = useAuth();
  const { data, loading, error, reload, setData } = useApi(`/threads/${threadId}`);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const { toast, confirm } = useUi();
  const nav = useNavigate();
  if (loading) return <PageLoader />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  const { thread, posts, can_edit } = data;

  const reply = async (e) => {
    e.preventDefault();
    if (!body.trim()) return;
    setSending(true);
    try {
      const p = await api.post(`/threads/${thread.id}/posts`, { body });
      setData((d) => ({ ...d, posts: [...d.posts, p] }));
      setBody('');
      toast('Respuesta publicada');
    } catch (err) { toast(err.message, 'error'); } finally { setSending(false); }
  };
  const delPost = async (p) => {
    if (!(await confirm({ title: 'Eliminar respuesta', message: 'Esta acción no se puede deshacer.', confirmText: 'Eliminar', danger: true }))) return;
    await api.del(`/posts/${p.id}`);
    setData((d) => ({ ...d, posts: d.posts.filter((x) => x.id !== p.id) }));
  };
  const delThread = async () => {
    if (!(await confirm({ title: 'Eliminar tema', message: 'Se eliminarán también todas las respuestas.', confirmText: 'Eliminar', danger: true }))) return;
    await api.del(`/threads/${thread.id}`);
    toast('Tema eliminado');
    nav(`/app/cursos/${course.id}/foros/${forumId}`);
  };
  const Role = ({ u }) => (u?.role === 'teacher' ? <Badge tone="info">Docente</Badge> : null);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link to={`/app/cursos/${course.id}/foros/${forumId}`} className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink"><ArrowLeft size={16} /> {data.forum.title}</Link>
      <Card className="p-5 sm:p-7">
        <div className="flex items-start gap-3">
          <Avatar user={thread.author} size={44} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 text-sm"><span className="font-semibold text-ink">{fullName(thread.author)}</span><Role u={thread.author} /><span className="text-muted">· {fmtDateTime(thread.created_at)}</span></div>
            <h1 className="font-display mt-2 text-[1.6rem] leading-tight font-semibold text-ink">{thread.pinned ? <Pin size={18} className="mr-1 inline text-primary" /> : null}{thread.title}</h1>
          </div>
          {(can_edit || thread.author_id === user.id) && <IconButton icon={Trash2} size={16} label="Eliminar tema" onClick={delThread} />}
        </div>
        <Markdown className="mt-4">{thread.body}</Markdown>
      </Card>

      <div className="flex items-center gap-3 px-1 text-sm font-semibold text-ink">{posts.length} {posts.length === 1 ? 'respuesta' : 'respuestas'}<span className="h-px flex-1 bg-line" /></div>

      <div className="space-y-3">
        {posts.map((p) => (
          <div key={p.id} className={`flex gap-3 ${p.author?.role === 'teacher' ? 'rounded-2xl border border-info/20 bg-info-soft/40 p-4' : 'px-1'}`}>
            <Avatar user={p.author} size={36} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 text-sm"><span className="font-semibold text-ink">{fullName(p.author)}</span><Role u={p.author} /><span className="text-xs text-faint">{relative(p.created_at)}</span></div>
              <Markdown className="mt-1 !text-[14.5px]">{p.body}</Markdown>
            </div>
            {(can_edit || p.author_id === user.id) && <IconButton icon={Trash2} size={15} label="Eliminar respuesta" onClick={() => delPost(p)} />}
          </div>
        ))}
      </div>

      <Card as="form" onSubmit={reply} className="flex gap-3 p-4">
        <Avatar user={user} size={36} />
        <div className="flex-1 space-y-3">
          <Textarea rows={3} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Escribe tu respuesta…"
            onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') reply(e); }} />
          <div className="flex items-center justify-between gap-2">
            <span className="hidden text-xs text-faint sm:block">⌘/Ctrl + Enter para enviar</span>
            <Button type="submit" icon={Send} loading={sending} disabled={!body.trim()} className="ml-auto">Responder</Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
