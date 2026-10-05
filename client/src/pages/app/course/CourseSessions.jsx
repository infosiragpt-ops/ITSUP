import { useState } from 'react';
import { Video, Plus, PlayCircle, Trash2, Link2, Clock, CalendarDays } from 'lucide-react';
import { api, useApi } from '../../../lib/api.js';
import { useUi } from '../../../lib/context.jsx';
import { Badge, Button, Card, EmptyState, ErrorState, Field, IconButton, Input, Modal, Segmented, Skeleton, Textarea, cx } from '../../../components/ui.jsx';
import { fmtLong, fmtTime, fromLocalInput, relative, sessionState, toLocalInput } from '../../../lib/format.js';
import { useCourse } from './CourseLayout.jsx';

const STATE = { live: ['En vivo', 'danger'], soon: ['Por empezar', 'warn'], upcoming: ['Programada', 'info'], past: ['Finalizada', 'neutral'] };

export default function CourseSessions() {
  const { course, canEdit } = useCourse();
  const { data, loading, error, reload, setData } = useApi(`/courses/${course.id}/sessions`);
  const [tab, setTab] = useState('next');
  const [creating, setCreating] = useState(false);
  const [recording, setRecording] = useState(null);
  const { toast, confirm } = useUi();
  if (error) return <ErrorState message={error} onRetry={reload} />;

  const next = (data || []).filter((s) => sessionState(s) !== 'past');
  const past = (data || []).filter((s) => sessionState(s) === 'past').reverse();
  const list = tab === 'next' ? next : past;

  const remove = async (s) => {
    if (!(await confirm({ title: 'Cancelar sesión', message: `Se eliminará “${s.title}” del calendario.`, confirmText: 'Eliminar', danger: true }))) return;
    await api.del(`/sessions/${s.id}`);
    setData((l) => l.filter((x) => x.id !== s.id));
    toast('Sesión eliminada');
  };

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Segmented value={tab} onChange={setTab} options={[{ value: 'next', label: 'Próximas', count: next.length }, { value: 'past', label: 'Anteriores', count: past.length }]} />
        {canEdit && <Button icon={Plus} onClick={() => setCreating(true)}>Programar sesión</Button>}
      </div>
      <Card className="mb-5 flex items-start gap-3 border-info/20 bg-info-soft/50 p-4 text-sm text-ink-2">
        <Video size={18} className="mt-0.5 shrink-0 text-info" />
        Las sesiones se realizan por videoconferencia. Ingresa 5 minutos antes con Google Chrome actualizado y audífonos con micrófono. El botón “Unirme” se activa 10 minutos antes del inicio.
      </Card>
      {loading ? <Skeleton className="h-56 rounded-2xl" /> : list.length === 0 ? (
        <Card><EmptyState icon={CalendarDays} title={tab === 'next' ? 'No hay sesiones programadas' : 'Aún no hay sesiones anteriores'} /></Card>
      ) : (
        <div className="space-y-3">
          {list.map((s) => {
            const st = sessionState(s);
            const [label, tone] = STATE[st];
            return (
              <Card key={s.id} className={cx('flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-5', st === 'live' && 'border-danger/40 ring-2 ring-danger/15')}>
                <div className={cx('flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl leading-none', st === 'live' ? 'animate-live bg-danger text-white' : 'bg-sunken text-ink')}>
                  <span className="text-[11px] font-semibold uppercase">{fmtLong(s.starts_at).split(',')[0].slice(0, 3)}</span>
                  <span className="mt-1 text-lg font-bold">{new Date(s.starts_at).toLocaleDateString('es-PE', { day: 'numeric', timeZone: 'America/Lima' })}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-ink">{s.title}</h3><Badge tone={tone} dot={st === 'live'}>{label}</Badge></div>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
                    <span>{fmtLong(s.starts_at)}</span>
                    <span className="flex items-center gap-1"><Clock size={14} /> {fmtTime(s.starts_at)} · {s.duration_min} min</span>
                    {st === 'upcoming' && <span className="text-faint">{relative(s.starts_at)}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {st !== 'past' && (
                    <Button icon={Video} variant={st === 'live' ? 'danger' : st === 'soon' ? 'primary' : 'secondary'} href={s.meeting_url} target="_blank" rel="noreferrer"
                      className={st === 'upcoming' && !canEdit ? 'pointer-events-none opacity-50' : ''}>
                      {canEdit ? 'Abrir sala' : 'Unirme'}
                    </Button>
                  )}
                  {st === 'past' && (s.recording_url
                    ? <Button variant="soft" icon={PlayCircle} href={s.recording_url} target="_blank" rel="noreferrer">Ver grabación</Button>
                    : canEdit ? <Button variant="ghost" size="sm" icon={Link2} onClick={() => setRecording(s)}>Agregar grabación</Button> : <span className="text-xs text-faint">Sin grabación</span>)}
                  {canEdit && <IconButton icon={Trash2} size={16} label="Eliminar sesión" onClick={() => remove(s)} />}
                </div>
              </Card>
            );
          })}
        </div>
      )}
      {creating && <SessionModal courseId={course.id} onClose={() => setCreating(false)} onSaved={() => { setCreating(false); reload(); }} />}
      {recording && <RecordingModal s={recording} onClose={() => setRecording(null)} onSaved={(u) => { setData((l) => l.map((x) => (x.id === u.id ? u : x))); setRecording(null); }} />}
    </div>
  );
}

function SessionModal({ courseId, onClose, onSaved }) {
  const { toast } = useUi();
  const d = new Date(Date.now() + 864e5); d.setUTCHours(0, 0, 0, 0);
  const [form, setForm] = useState({ title: '', description: '', starts_at: toLocalInput(d), duration_min: 90, meeting_url: '' });
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      await api.post(`/courses/${courseId}/sessions`, { ...form, starts_at: fromLocalInput(form.starts_at) });
      toast('Sesión programada y notificada');
      onSaved();
    } catch (e) { toast(e.message, 'error'); } finally { setSaving(false); }
  };
  return (
    <Modal open onClose={onClose} title="Programar sesión en vivo"
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button onClick={save} loading={saving}>Programar</Button></>}>
      <div className="space-y-4">
        <Field label="Título" required><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Sesión de repaso · …" /></Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Fecha y hora (Lima)" required><Input type="datetime-local" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} /></Field>
          <Field label="Duración (min)"><Input type="number" min="15" step="15" value={form.duration_min} onChange={(e) => setForm({ ...form, duration_min: e.target.value })} /></Field>
        </div>
        <Field label="Enlace de videoconferencia" hint="Opcional. Si lo dejas vacío, creamos una sala automáticamente."><Input type="url" value={form.meeting_url} onChange={(e) => setForm({ ...form, meeting_url: e.target.value })} placeholder="https://meet…" /></Field>
        <Field label="Descripción"><Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}

function RecordingModal({ s, onClose, onSaved }) {
  const { toast } = useUi();
  const [url, setUrl] = useState('');
  const save = async () => {
    try { onSaved(await api.put(`/sessions/${s.id}`, { recording_url: url })); toast('Grabación publicada'); } catch (e) { toast(e.message, 'error'); }
  };
  return (
    <Modal open onClose={onClose} title="Agregar grabación" description={s.title} size="sm"
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button onClick={save} disabled={!url}>Guardar</Button></>}>
      <Field label="Enlace de la grabación"><Input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" /></Field>
    </Modal>
  );
}
