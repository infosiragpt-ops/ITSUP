import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck } from 'lucide-react';
import { api } from '../../lib/api.js';
import { useShell, NotifIcon } from '../../layouts/AppLayout.jsx';
import { Button, Card, EmptyState, PageHeader, Segmented, cx } from '../../components/ui.jsx';
import { relative, dayKey, fmtLong } from '../../lib/format.js';

export default function Notifications() {
  const { notif, setNotif } = useShell();
  const [filter, setFilter] = useState('all');
  const nav = useNavigate();
  const list = notif.items.filter((n) => filter === 'all' || !n.read_at);
  const groups = list.reduce((acc, n) => { const k = dayKey(n.created_at); (acc[k] ||= []).push(n); return acc; }, {});
  const today = dayKey(new Date());
  const yesterday = dayKey(new Date(Date.now() - 864e5));

  const open = (n) => {
    if (!n.read_at) {
      api.post(`/notifications/${n.id}/read`).catch(() => {});
      setNotif((s) => ({ unread: Math.max(0, s.unread - 1), items: s.items.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)) }));
    }
    if (n.link) nav(n.link);
  };
  const readAll = async () => {
    await api.post('/notifications/read-all');
    setNotif((s) => ({ unread: 0, items: s.items.map((x) => ({ ...x, read_at: x.read_at || new Date().toISOString() })) }));
  };

  return (
    <div className="animate-fade-up mx-auto max-w-3xl">
      <PageHeader title="Notificaciones" subtitle="Calificaciones, anuncios, nuevas tareas y recordatorios."
        actions={notif.unread > 0 && <Button variant="secondary" icon={CheckCheck} onClick={readAll}>Marcar todo como leído</Button>} />
      <Segmented className="mb-5" value={filter} onChange={setFilter} options={[{ value: 'all', label: 'Todas' }, { value: 'unread', label: 'No leídas', count: notif.unread }]} />
      {list.length === 0 ? (
        <Card><EmptyState icon={Bell} title={filter === 'unread' ? 'Estás al día' : 'Sin notificaciones'} description="Aquí verás las novedades de tus cursos." /></Card>
      ) : Object.entries(groups).map(([k, items]) => (
        <div key={k} className="mb-6">
          <div className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">{k === today ? 'Hoy' : k === yesterday ? 'Ayer' : fmtLong(k)}</div>
          <Card className="divide-y divide-line overflow-hidden">
            {items.map((n) => (
              <button key={n.id} onClick={() => open(n)} className={cx('flex w-full items-start gap-3 p-4 text-left transition hover:bg-sunken/60', !n.read_at && 'bg-primary-soft/30')}>
                <NotifIcon type={n.type} />
                <div className="min-w-0 flex-1">
                  <div className={cx('text-sm', n.read_at ? 'text-ink-2' : 'font-semibold text-ink')}>{n.title}</div>
                  {n.body && <div className="text-sm text-muted">{n.body}</div>}
                  <div className="mt-1 text-xs text-faint">{relative(n.created_at)}</div>
                </div>
                {!n.read_at && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" />}
              </button>
            ))}
          </Card>
        </div>
      ))}
    </div>
  );
}
