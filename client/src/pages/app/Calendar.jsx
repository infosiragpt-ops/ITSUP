import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Video, ClipboardList, ListChecks, Landmark, CalendarDays } from 'lucide-react';
import { useApi } from '../../lib/api.js';
import { Button, Card, EmptyState, PageHeader, Segmented, Skeleton, cx } from '../../components/ui.jsx';
import { dayKey, fmtLong, fmtTime, capitalize, sessionState } from '../../lib/format.js';

const TYPE = {
  assignment: { icon: ClipboardList, label: 'Tarea' },
  quiz: { icon: ListChecks, label: 'Evaluación' },
  session: { icon: Video, label: 'Sesión en vivo' },
  institutional: { icon: Landmark, label: 'Institucional' },
};
const WEEK = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

export default function CalendarPage() {
  const today = dayKey(new Date());
  const [cursor, setCursor] = useState(() => { const [y, m] = today.split('-').map(Number); return { y, m }; });
  const [selected, setSelected] = useState(today);
  const [view, setView] = useState(() => (window.innerWidth < 768 ? 'agenda' : 'month'));
  const [filter, setFilter] = useState('all');

  const from = new Date(Date.UTC(cursor.y, cursor.m - 1, 1) - 7 * 864e5).toISOString();
  const to = new Date(Date.UTC(cursor.y, cursor.m, 1) + 14 * 864e5).toISOString();
  const { data, loading } = useApi(`/calendar?from=${from}&to=${to}`);

  const events = useMemo(() => (data || []).filter((e) => filter === 'all' || e.type === filter), [data, filter]);
  const byDay = useMemo(() => {
    const map = {};
    for (const e of events) {
      const days = [e.all_day ? e.date : dayKey(e.date)];
      if (e.end_date) {
        let d = new Date(`${e.date}T12:00:00Z`);
        const end = new Date(`${e.end_date}T12:00:00Z`);
        while ((d = new Date(d.getTime() + 864e5)) <= end) days.push(d.toISOString().slice(0, 10));
      }
      for (const k of days) (map[k] ||= []).push(e);
    }
    return map;
  }, [events]);

  const first = new Date(Date.UTC(cursor.y, cursor.m - 1, 1));
  const offset = (first.getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(cursor.y, cursor.m, 0)).getUTCDate();
  const cells = Array.from({ length: Math.ceil((offset + daysInMonth) / 7) * 7 }, (_, i) => {
    const d = new Date(Date.UTC(cursor.y, cursor.m - 1, 1 + i - offset));
    return { key: d.toISOString().slice(0, 10), day: d.getUTCDate(), inMonth: d.getUTCMonth() === cursor.m - 1 };
  });
  const monthName = capitalize(new Intl.DateTimeFormat('es-PE', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(first));
  const move = (n) => setCursor(({ y, m }) => { const d = new Date(Date.UTC(y, m - 1 + n, 1)); return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1 }; });
  const goToday = () => { const [y, m] = today.split('-').map(Number); setCursor({ y, m }); setSelected(today); };

  const agendaDays = Object.keys(byDay).filter((k) => k >= (view === 'agenda' ? today : selected)).sort();

  return (
    <div className="animate-fade-up">
      <PageHeader title="Calendario" subtitle="Tus sesiones en vivo, fechas de entrega y eventos institucionales en un solo lugar."
        actions={<Segmented value={view} onChange={setView} options={[{ value: 'month', label: 'Mes' }, { value: 'agenda', label: 'Agenda' }]} />} />
      <div className="no-scrollbar mb-5 flex gap-2 overflow-x-auto">
        {[['all', 'Todo'], ['session', 'Sesiones'], ['assignment', 'Tareas'], ['quiz', 'Evaluaciones'], ['institutional', 'Institucional']].map(([v, l]) => (
          <button key={v} onClick={() => setFilter(v)} className={cx('shrink-0 rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition', filter === v ? 'border-ink bg-ink text-bg' : 'border-line bg-surface text-ink-2 hover:border-line-strong')}>{l}</button>
        ))}
      </div>

      {view === 'month' ? (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          <Card className="overflow-hidden">
            <div className="flex items-center gap-2 border-b border-line p-4">
              <h2 className="font-display flex-1 text-xl font-semibold text-ink">{monthName}</h2>
              <Button variant="secondary" size="sm" onClick={goToday}>Hoy</Button>
              <Button variant="ghost" size="icon" onClick={() => move(-1)} aria-label="Mes anterior"><ChevronLeft size={18} /></Button>
              <Button variant="ghost" size="icon" onClick={() => move(1)} aria-label="Mes siguiente"><ChevronRight size={18} /></Button>
            </div>
            <div className="grid grid-cols-7 border-b border-line bg-sunken/60 text-center text-xs font-semibold text-muted">
              {WEEK.map((w) => <div key={w} className="py-2">{w}</div>)}
            </div>
            <div className="grid grid-cols-7">
              {cells.map((c) => {
                const ev = byDay[c.key] || [];
                const isToday = c.key === today;
                return (
                  <button key={c.key} onClick={() => setSelected(c.key)}
                    className={cx('min-h-[92px] border-r border-b border-line p-1.5 text-left align-top transition last:border-r-0 [&:nth-child(7n)]:border-r-0',
                      !c.inMonth && 'bg-sunken/40', selected === c.key ? 'bg-primary-soft/60' : 'hover:bg-sunken/60')}>
                    <span className={cx('inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold', isToday ? 'bg-primary text-white' : c.inMonth ? 'text-ink' : 'text-faint')}>{c.day}</span>
                    <div className="mt-1 space-y-0.5">
                      {ev.slice(0, 3).map((e) => (
                        <div key={e.id} className="hidden truncate rounded px-1 py-px text-[10.5px] font-medium sm:block"
                          style={{ background: `color-mix(in srgb, ${e.course?.color || 'var(--c-ink)'} 14%, transparent)`, color: e.course?.color || 'var(--c-ink-2)' }}>
                          {e.type === 'session' ? fmtTime(e.date).replace(/\s?[ap]\. m\./, '') + ' ' : ''}{e.title}
                        </div>
                      ))}
                      {ev.length > 0 && <div className="flex gap-0.5 sm:hidden">{ev.slice(0, 4).map((e) => <span key={e.id} className="h-1.5 w-1.5 rounded-full" style={{ background: e.course?.color || 'var(--c-ink-2)' }} />)}</div>}
                      {ev.length > 3 && <div className="hidden px-1 text-[10px] text-muted sm:block">+{ev.length - 3} más</div>}
                    </div>
                  </button>
                );
              })}
            </div>
          </Card>
          <div>
            <h3 className="mb-3 font-semibold text-ink">{fmtLong(selected)}</h3>
            {loading ? <Skeleton className="h-40 rounded-2xl" /> : (byDay[selected] || []).length === 0 ? (
              <Card><EmptyState compact icon={CalendarDays} title="Día libre" description="No hay actividades para este día." /></Card>
            ) : <div className="space-y-2">{byDay[selected].map((e) => <EventCard key={e.id} e={e} />)}</div>}
          </div>
        </div>
      ) : (
        <div className="max-w-3xl space-y-6">
          {loading ? <Skeleton className="h-64 rounded-2xl" /> : agendaDays.length === 0 ? <Card><EmptyState icon={CalendarDays} title="Nada programado" /></Card> :
            agendaDays.map((k) => (
              <div key={k}>
                <div className={cx('mb-2 text-sm font-semibold', k === today ? 'text-primary-ink' : 'text-ink')}>{k === today ? 'Hoy · ' : ''}{fmtLong(k)}</div>
                <div className="space-y-2">{byDay[k].map((e) => <EventCard key={e.id} e={e} />)}</div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

function EventCard({ e }) {
  const t = TYPE[e.type];
  const live = e.type === 'session' && ['live', 'soon'].includes(sessionState({ starts_at: e.date, duration_min: e.duration_min }));
  const body = (
    <div className="flex items-center gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white" style={{ background: e.course?.color || 'var(--c-ink-2)' }}><t.icon size={18} /></span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-ink">{e.title}</div>
        <div className="truncate text-xs text-muted">{e.course?.name || e.description || t.label}{!e.all_day ? ` · ${fmtTime(e.date)}` : ''}</div>
      </div>
      {live && <Button size="sm" variant="danger" icon={Video} href={e.meeting_url} target="_blank" rel="noreferrer" onClick={(ev) => ev.stopPropagation()}>Unirme</Button>}
    </div>
  );
  return e.link
    ? <Link to={e.link} className="card block p-3 transition hover:shadow-lift">{body}</Link>
    : <div className="card p-3">{body}</div>;
}
