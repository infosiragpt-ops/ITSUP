import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Megaphone, Send, CalendarDays, Plus, Trash2, Eye, PencilLine, Users, GraduationCap, BookOpen, History, ChevronDown, CalendarPlus } from 'lucide-react';
import { api, useApi } from '../../lib/api.js';
import { useUi } from '../../lib/context.jsx';
import { relative, fmtDateTime, fmtDate, fmtShort, dayKey, pluralize } from '../../lib/format.js';
import { Button, IconButton, Card, Badge, PageHeader, SectionTitle, Field, Input, Textarea, Select, ErrorState, EmptyState, Segmented, Skeleton, cx } from '../../components/ui.jsx';
import Markdown from '../../components/Markdown.jsx';

const AUDIENCES = [
  { value: 'all', label: 'Todos', desc: 'estudiantes y docentes activos', icon: Users },
  { value: 'student', label: 'Estudiantes', desc: 'estudiantes activos', icon: GraduationCap },
  { value: 'teacher', label: 'Docentes', desc: 'docentes activos', icon: BookOpen },
];
const EVENT_TYPES = {
  academic: { label: 'Académico', tone: 'info' },
  exam: { label: 'Evaluaciones', tone: 'danger' },
  event: { label: 'Evento', tone: 'success' },
  institutional: { label: 'Institucional', tone: 'primary' },
};

export default function AdminAnnouncements() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'calendario' ? 'calendario' : 'comunicados';
  const setTab = (v) => setParams(v === 'calendario' ? { tab: 'calendario' } : {}, { replace: true });

  return (
    <div className="animate-fade-up">
      <PageHeader
        eyebrow="Comunicación institucional"
        title="Comunicados y calendario"
        subtitle="Envía avisos a toda la comunidad ISUP y mantén actualizado el calendario académico."
      />
      <Segmented value={tab} onChange={setTab} className="mb-6"
        options={[{ value: 'comunicados', label: 'Comunicados' }, { value: 'calendario', label: 'Calendario institucional' }]} />
      {tab === 'comunicados' ? <Announcements /> : <EventsManager />}
    </div>
  );
}

/* ---------------- Announcements ---------------- */

function Announcements() {
  const { toast, confirm } = useUi();
  const { data, loading, error, reload, setData } = useApi('/admin/announcements');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState('all');
  const [mode, setMode] = useState('write');
  const [errors, setErrors] = useState({});
  const [sending, setSending] = useState(false);

  const aud = AUDIENCES.find((a) => a.value === audience);

  const send = async (e) => {
    e?.preventDefault();
    const er = {};
    if (!title.trim()) er.title = 'Escribe un título';
    if (!body.trim()) er.body = 'Escribe el mensaje';
    setErrors(er);
    if (Object.keys(er).length) { if (er.body && !er.title) setMode('write'); return; }
    const ok = await confirm({
      title: '¿Enviar comunicado?',
      message: `“${title.trim()}” se publicará en el aula virtual y se notificará a todos los ${aud.desc}. No se puede editar después de enviarlo.`,
      confirmText: 'Enviar comunicado',
    });
    if (!ok) return;
    setSending(true);
    try {
      const created = await api.post('/admin/announcements', { title: title.trim(), body: body.trim(), audience });
      setData((d) => [{ ...created, _audience: audience }, ...(d || [])]);
      setTitle(''); setBody(''); setMode('write'); setAudience('all');
      toast('Comunicado enviado');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] xl:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <Card className="p-5 sm:p-6 lg:sticky lg:top-20">
        <SectionTitle title="Nuevo comunicado" icon={Megaphone} />
        <form onSubmit={send} className="flex flex-col gap-4" noValidate>
          <Field label="Título" required error={errors.title}>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej. Inicio de matrícula 2026-II" maxLength={140} />
          </Field>
          <div>
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <span className="text-[13px] font-medium text-ink-2">Mensaje <span className="text-primary">*</span></span>
              <div className="inline-flex rounded-lg border border-line bg-sunken p-0.5 text-xs">
                {[{ v: 'write', l: 'Escribir', i: PencilLine }, { v: 'preview', l: 'Vista previa', i: Eye }].map((o) => (
                  <button key={o.v} type="button" onClick={() => setMode(o.v)}
                    className={cx('inline-flex items-center gap-1 rounded-md px-2 py-1 font-medium transition', mode === o.v ? 'bg-surface text-ink shadow-soft' : 'text-muted hover:text-ink')}>
                    <o.i size={13} /> {o.l}
                  </button>
                ))}
              </div>
            </div>
            {mode === 'write' ? (
              <Textarea rows={8} value={body} onChange={(e) => setBody(e.target.value)}
                placeholder={'Estimada comunidad ISUP:\n\nLes recordamos que…\n\nPuedes usar **negritas**, listas con - y [enlaces](https://isup.edu.pe).'} />
            ) : (
              <div className="min-h-[196px] rounded-[10px] border border-line-strong bg-surface px-4 py-3">
                {body.trim() ? <Markdown>{body}</Markdown> : <p className="text-sm text-faint">Nada que previsualizar todavía.</p>}
              </div>
            )}
            {errors.body ? <span className="mt-1 block text-xs text-danger">{errors.body}</span>
              : <span className="mt-1 block text-xs text-faint">Admite formato Markdown básico.</span>}
          </div>
          <div>
            <span className="mb-1.5 block text-[13px] font-medium text-ink-2">Destinatarios</span>
            <Segmented value={audience} onChange={setAudience} options={AUDIENCES.map((a) => ({ value: a.value, label: a.label }))} />
            <p className="mt-1.5 text-xs text-faint">Se notificará a todos los {aud.desc}.</p>
          </div>
          <div className="flex justify-end">
            <Button type="submit" icon={Send} loading={sending}>Enviar comunicado</Button>
          </div>
        </form>
      </Card>

      <div className="min-w-0">
        <SectionTitle title="Historial" icon={History}
          action={data && data.length > 0 && <span className="text-xs text-faint">{pluralize(data.length, 'comunicado', 'comunicados')}</span>} />
        {loading ? (
          <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-32" />)}</div>
        ) : error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : data.length === 0 ? (
          <Card>
            <EmptyState icon={Megaphone} title="Aún no se ha enviado ningún comunicado" description="Los comunicados institucionales aparecen fijados en el inicio de cada usuario." />
          </Card>
        ) : (
          <ul className="flex flex-col gap-3">
            {data.map((a) => (
              <li key={a.id}>
                <Card className="p-5">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <Badge tone="primary" icon={Megaphone}>Comunicado ISUP</Badge>
                    {a._audience && a._audience !== 'all' && <Badge>{AUDIENCES.find((x) => x.value === a._audience)?.label}</Badge>}
                    <span className="text-xs text-faint" title={fmtDateTime(a.created_at)}>{relative(a.created_at)}</span>
                  </div>
                  <h3 className="mt-2 font-display text-lg leading-snug font-semibold break-words text-ink">{a.title}</h3>
                  <Markdown className="mt-2 text-[15px]">{a.body}</Markdown>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/* ---------------- Calendar events ---------------- */

const EMPTY_EVENT = { title: '', description: '', date: '', end_date: '', type: 'institutional' };

function EventsManager() {
  const { toast, confirm } = useUi();
  const { data, loading, error, reload, setData } = useApi('/public/events');
  const [form, setForm] = useState(EMPTY_EVENT);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [showPast, setShowPast] = useState(false);
  const [typeFilter, setTypeFilter] = useState('');

  const today = dayKey(new Date());
  const { upcoming, past } = useMemo(() => {
    const rows = (data || []).filter((e) => !typeFilter || e.type === typeFilter);
    return {
      upcoming: rows.filter((e) => (e.end_date || e.date) >= today),
      past: rows.filter((e) => (e.end_date || e.date) < today).reverse(),
    };
  }, [data, today, typeFilter]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const create = async (e) => {
    e?.preventDefault();
    const er = {};
    if (!form.title.trim()) er.title = 'Escribe un título';
    if (!form.date) er.date = 'Elige la fecha';
    if (form.end_date && form.date && form.end_date < form.date) er.end_date = 'Debe ser posterior al inicio';
    setErrors(er);
    if (Object.keys(er).length) return;
    setSaving(true);
    try {
      const created = await api.post('/admin/events', {
        title: form.title.trim(), description: form.description.trim(), date: form.date, end_date: form.end_date || null, type: form.type,
      });
      setData((d) => [...(d || []), created].sort((a, b) => a.date.localeCompare(b.date)));
      setForm(EMPTY_EVENT);
      toast('Evento agregado al calendario');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (ev) => {
    const ok = await confirm({
      title: '¿Eliminar evento?',
      message: `“${ev.title}” se quitará del calendario institucional para todos los usuarios.`,
      confirmText: 'Eliminar',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.del(`/admin/events/${ev.id}`);
      setData((d) => d.filter((x) => x.id !== ev.id));
      toast('Evento eliminado');
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  return (
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
      <Card className="p-5 sm:p-6 lg:sticky lg:top-20">
        <SectionTitle title="Nuevo evento" icon={CalendarPlus} />
        <form onSubmit={create} className="grid grid-cols-2 gap-4" noValidate>
          <Field label="Título" required error={errors.title} className="col-span-2">
            <Input value={form.title} onChange={set('title')} placeholder="Ej. Semana de exámenes parciales" />
          </Field>
          <Field label="Tipo" className="col-span-2">
            <Select value={form.type} onChange={set('type')}>
              {Object.entries(EVENT_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </Select>
          </Field>
          <Field label="Fecha de inicio" required error={errors.date} className="col-span-2 sm:col-span-1 lg:col-span-2 xl:col-span-1">
            <Input type="date" value={form.date} onChange={set('date')} />
          </Field>
          <Field label="Fecha de fin" error={errors.end_date} hint="Opcional" className="col-span-2 sm:col-span-1 lg:col-span-2 xl:col-span-1">
            <Input type="date" value={form.end_date} min={form.date || undefined} onChange={set('end_date')} />
          </Field>
          <Field label="Descripción" className="col-span-2">
            <Textarea rows={3} value={form.description} onChange={set('description')} placeholder="Detalles para estudiantes y docentes (opcional)." />
          </Field>
          <div className="col-span-2 flex justify-end">
            <Button type="submit" icon={Plus} loading={saving}>Agregar evento</Button>
          </div>
        </form>
      </Card>

      <div className="min-w-0">
        <SectionTitle title="Próximos eventos" icon={CalendarDays}
          action={
            <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="h-8 w-auto py-0 pr-8 text-[13px]" aria-label="Filtrar por tipo">
              <option value="">Todos los tipos</option>
              {Object.entries(EVENT_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </Select>
          } />
        {loading ? (
          <div className="space-y-3">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-20" />)}</div>
        ) : error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : (
          <>
            {upcoming.length === 0 ? (
              <Card>
                <EmptyState compact icon={CalendarDays} title="No hay eventos próximos" description="Agrega fechas clave del periodo: inicio de clases, exámenes, feriados o ceremonias." />
              </Card>
            ) : (
              <ul className="flex flex-col gap-2.5">
                {upcoming.map((ev) => <EventRow key={ev.id} ev={ev} today={today} onDelete={() => remove(ev)} />)}
              </ul>
            )}

            {past.length > 0 && (
              <div className="mt-6">
                <button type="button" onClick={() => setShowPast((s) => !s)} aria-expanded={showPast}
                  className="flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
                  <ChevronDown size={16} className={cx('transition-transform', showPast && 'rotate-180')} />
                  {showPast ? 'Ocultar' : 'Mostrar'} eventos pasados ({past.length})
                </button>
                {showPast && (
                  <ul className="animate-fade-in mt-3 flex flex-col gap-2.5 opacity-80">
                    {past.map((ev) => <EventRow key={ev.id} ev={ev} today={today} onDelete={() => remove(ev)} />)}
                  </ul>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function EventRow({ ev, today, onDelete }) {
  const type = EVENT_TYPES[ev.type] || EVENT_TYPES.institutional;
  const [day, month] = fmtShort(ev.date).split(' ');
  const ongoing = ev.date <= today && (ev.end_date || ev.date) >= today;
  return (
    <li>
      <Card className="flex items-start gap-4 p-4">
        <div className={cx('flex w-14 shrink-0 flex-col items-center rounded-xl py-2', ongoing ? 'bg-primary text-white' : 'bg-sunken text-ink')}>
          <span className="text-xl leading-none font-semibold tabular-nums">{day}</span>
          <span className={cx('mt-1 text-[11px] font-medium uppercase', ongoing ? 'text-white/80' : 'text-muted')}>{month}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone={type.tone}>{type.label}</Badge>
            {ongoing && <Badge tone="success" dot>En curso</Badge>}
          </div>
          <h3 className="mt-1.5 text-[15px] leading-snug font-semibold break-words text-ink">{ev.title}</h3>
          <div className="mt-0.5 text-xs text-muted">
            {ev.end_date && ev.end_date !== ev.date ? `${fmtDate(ev.date)} — ${fmtDate(ev.end_date)}` : fmtDate(ev.date)}
          </div>
          {ev.description && <p className="mt-1.5 text-sm break-words text-muted">{ev.description}</p>}
        </div>
        <IconButton icon={Trash2} label="Eliminar evento" onClick={onDelete} className="-mt-1 -mr-1.5 hover:bg-danger-soft hover:text-danger" />
      </Card>
    </li>
  );
}
