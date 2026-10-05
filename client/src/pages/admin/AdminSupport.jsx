import { useCallback, useEffect, useMemo, useState } from 'react';
import { Headset, Search, Mail, Send, CheckCircle2, Clock, Inbox, X, Tag, MessageSquareReply, ChevronRight } from 'lucide-react';
import { api, useApi } from '../../lib/api.js';
import { useUi } from '../../lib/context.jsx';
import { relative, fmtDateTime, fullName, ROLE_LABEL } from '../../lib/format.js';
import { Button, Card, Badge, PageHeader, Field, Input, Textarea, Modal, PageLoader, ErrorState, EmptyState, Avatar, Segmented, cx } from '../../components/ui.jsx';

const STATUS = {
  abierto: { label: 'Abierto', tone: 'warn' },
  en_proceso: { label: 'En proceso', tone: 'info' },
  resuelto: { label: 'Resuelto', tone: 'success' },
};
const STATUS_ORDER = ['abierto', 'en_proceso', 'resuelto'];

function useMediaQuery(query) {
  const get = () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query).matches : false);
  const [matches, setMatches] = useState(get);
  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const m = window.matchMedia(query);
    const on = () => setMatches(m.matches);
    on();
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, [query]);
  return matches;
}

export default function AdminSupport() {
  const { data, loading, error, reload, setData } = useApi('/tickets');
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const [status, setStatus] = useState('pendientes');
  const [q, setQ] = useState('');
  const [selectedId, setSelectedId] = useState(null);

  const counts = useMemo(() => {
    const c = { pendientes: 0, '': 0, abierto: 0, en_proceso: 0, resuelto: 0 };
    (data || []).forEach((t) => {
      c[''] += 1;
      c[t.status] = (c[t.status] || 0) + 1;
      if (t.status !== 'resuelto') c.pendientes += 1;
    });
    return c;
  }, [data]);

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (data || []).filter((t) => {
      if (status === 'pendientes' ? t.status === 'resuelto' : status && t.status !== status) return false;
      if (!term) return true;
      return [t.subject, t.message, t.category, t.user && fullName(t.user), t.user?.email].some((v) => v?.toLowerCase().includes(term));
    });
  }, [data, status, q]);

  // Switching to the mobile layout shouldn't pop the detail modal open by itself.
  useEffect(() => { if (!isDesktop) setSelectedId(null); }, [isDesktop]);

  // On desktop keep a ticket selected in the right pane.
  useEffect(() => {
    if (!isDesktop) return;
    if (!list.length) { if (selectedId != null) setSelectedId(null); return; }
    if (!list.some((t) => t.id === selectedId)) setSelectedId(list[0].id);
  }, [isDesktop, list, selectedId]);

  const selected = (data || []).find((t) => t.id === selectedId) || null;
  const closeMobile = useCallback(() => setSelectedId(null), []);
  const onSaved = useCallback((updated) => {
    setData((d) => d.map((t) => (t.id === updated.id ? { ...t, ...updated } : t)));
  }, [setData]);

  if (loading) return <PageLoader />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  const options = [
    { value: 'pendientes', label: 'Pendientes', count: counts.pendientes },
    { value: 'abierto', label: 'Abiertos', count: counts.abierto },
    { value: 'en_proceso', label: 'En proceso', count: counts.en_proceso },
    { value: 'resuelto', label: 'Resueltos', count: counts.resuelto },
    { value: '', label: 'Todos', count: counts[''] },
  ];

  return (
    <div className="animate-fade-up">
      <PageHeader
        eyebrow="Mesa de ayuda"
        title="Soporte"
        subtitle="Atiende las solicitudes de estudiantes y docentes. Al responder, el usuario recibe una notificación en el aula."
      />

      <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="no-scrollbar -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <Segmented value={status} onChange={setStatus} options={options} className="whitespace-nowrap" />
        </div>
        <div className="relative w-full xl:max-w-sm">
          <Search size={17} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-faint" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por asunto, usuario o categoría" className="pr-9 pl-9" aria-label="Buscar solicitudes" />
          {q && (
            <button type="button" onClick={() => setQ('')} className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded-md p-1 text-faint hover:text-ink" aria-label="Limpiar búsqueda">
              <X size={15} />
            </button>
          )}
        </div>
      </div>

      {data.length === 0 ? (
        <Card>
          <EmptyState icon={Headset} title="No hay solicitudes de soporte" description="Cuando un estudiante o docente pida ayuda desde el Centro de ayuda, su solicitud aparecerá aquí." />
        </Card>
      ) : (
        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
          <Card className="overflow-hidden">
            {list.length === 0 ? (
              <EmptyState compact icon={status === 'pendientes' ? CheckCircle2 : Inbox}
                title={q.trim() ? 'Sin resultados' : status === 'pendientes' ? '¡Todo al día!' : 'No hay solicitudes en este estado'}
                description={q.trim() ? 'Prueba con otro término de búsqueda.' : status === 'pendientes' ? 'No quedan solicitudes por atender.' : undefined} />
            ) : (
              <ul className="scrollbar-thin divide-y divide-line lg:max-h-[calc(100vh-240px)] lg:overflow-y-auto">
                {list.map((t) => {
                  const st = STATUS[t.status] || STATUS.abierto;
                  const active = isDesktop && t.id === selectedId;
                  return (
                    <li key={t.id}>
                      <button type="button" onClick={() => setSelectedId(t.id)} aria-current={active || undefined}
                        className={cx('relative flex w-full items-start gap-3 px-4 py-3.5 text-left transition', active ? 'bg-primary-soft/60' : 'hover:bg-sunken')}>
                        {active && <span className="absolute inset-y-0 left-0 w-[3px] bg-primary" />}
                        <Avatar user={t.user} size={34} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="truncate text-sm font-medium text-ink">{t.user ? fullName(t.user) : 'Usuario eliminado'}</span>
                            <span className="shrink-0 text-[11px] text-faint">{relative(t.created_at)}</span>
                          </div>
                          <div className={cx('mt-0.5 truncate text-sm', t.status === 'resuelto' ? 'text-muted' : 'text-ink-2')}>{t.subject}</div>
                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                            <Badge tone={st.tone} dot>{st.label}</Badge>
                            {t.category && <Badge>{t.category}</Badge>}
                            {t.response && <span className="inline-flex items-center gap-1 text-[11px] text-faint"><MessageSquareReply size={12} /> Respondido</span>}
                          </div>
                        </div>
                        <ChevronRight size={16} className="mt-2 shrink-0 text-faint lg:hidden" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          {isDesktop && (
            <div className="sticky top-20 min-w-0">
              {selected ? (
                <Card className="p-6">
                  <TicketDetail key={selected.id} ticket={selected} onSaved={onSaved} />
                </Card>
              ) : (
                <Card>
                  <EmptyState icon={Headset} title="Selecciona una solicitud" description="Elige una solicitud de la lista para ver el detalle y responder." />
                </Card>
              )}
            </div>
          )}
        </div>
      )}

      {!isDesktop && (
        <Modal open={!!selected} onClose={closeMobile} size="lg" title="Solicitud de soporte" description={selected ? `#${selected.id} · ${relative(selected.created_at)}` : ''}>
          {selected && <TicketDetail key={selected.id} ticket={selected} onSaved={onSaved} onDone={closeMobile} />}
        </Modal>
      )}
    </div>
  );
}

function TicketDetail({ ticket: t, onSaved, onDone }) {
  const { toast } = useUi();
  const [status, setStatus] = useState(t.status);
  const [response, setResponse] = useState(t.response || '');
  const [saving, setSaving] = useState(null);
  const st = STATUS[t.status] || STATUS.abierto;
  const dirty = status !== t.status || response.trim() !== (t.response || '').trim();

  const save = async (overrideStatus) => {
    const nextStatus = overrideStatus || status;
    const nextResponse = response.trim();
    setSaving(overrideStatus ? 'resolve' : 'save');
    try {
      const updated = await api.put(`/tickets/${t.id}`, { status: nextStatus, response: nextResponse || null });
      onSaved(updated);
      setStatus(updated.status);
      const responded = nextResponse && nextResponse !== (t.response || '').trim();
      toast(responded ? `Respuesta enviada · ${t.user?.first_name || 'El usuario'} fue notificado(a)` : `Estado actualizado a “${STATUS[updated.status]?.label}”`);
      onDone?.();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge tone={st.tone} dot>{st.label}</Badge>
        {t.category && <Badge icon={Tag}>{t.category}</Badge>}
        <span className="text-xs text-faint">#{t.id}</span>
      </div>
      <h2 className="mt-2 font-display text-2xl leading-snug font-semibold break-words text-ink">{t.subject}</h2>

      <div className="mt-4 flex items-center gap-3 rounded-xl border border-line p-3">
        <Avatar user={t.user} size={40} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-ink">{t.user ? fullName(t.user) : 'Usuario eliminado'}</div>
          <div className="truncate text-xs text-muted">{t.user ? `${ROLE_LABEL[t.user.role] || ''}${t.user.title ? ` · ${t.user.title}` : ''}` : ''}</div>
        </div>
        {t.user?.email && (
          <Button size="sm" variant="ghost" icon={Mail} href={`mailto:${t.user.email}?subject=${encodeURIComponent(`Re: ${t.subject}`)}`} className="shrink-0">
            <span className="hidden sm:inline">Correo</span>
          </Button>
        )}
      </div>

      <div className="mt-4">
        <div className="mb-1.5 flex items-center gap-1.5 text-xs text-muted"><Clock size={13} /> Enviado el {fmtDateTime(t.created_at)}</div>
        <div className="rounded-xl bg-sunken px-4 py-3.5 text-sm leading-relaxed break-words whitespace-pre-wrap text-ink-2">{t.message}</div>
      </div>

      {t.response && t.updated_at && (
        <div className="mt-2 text-xs text-faint">Última actualización {relative(t.updated_at)}</div>
      )}

      <div className="mt-6 border-t border-line pt-5">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink"><MessageSquareReply size={16} className="text-primary" /> Respuesta de soporte</h3>
        <div className="mb-3">
          <span className="mb-1.5 block text-[13px] font-medium text-ink-2">Estado</span>
          <Segmented value={status} onChange={setStatus} options={STATUS_ORDER.map((s) => ({ value: s, label: STATUS[s].label }))} />
        </div>
        <Field label="Mensaje para el usuario" hint="Al guardar una respuesta nueva, el usuario recibirá una notificación en el aula virtual.">
          <Textarea rows={5} value={response} onChange={(e) => setResponse(e.target.value)} placeholder="Hola, gracias por escribirnos. Revisamos tu caso y…" />
        </Field>
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          {t.status !== 'resuelto' && (
            <Button variant="secondary" icon={CheckCircle2} loading={saving === 'resolve'} disabled={!!saving} onClick={() => save('resuelto')}>
              {response.trim() && response.trim() !== (t.response || '').trim() ? 'Responder y resolver' : 'Marcar como resuelto'}
            </Button>
          )}
          <Button icon={Send} loading={saving === 'save'} disabled={!dirty || !!saving} onClick={() => save()}>
            {response.trim() && response.trim() !== (t.response || '').trim() ? 'Enviar respuesta' : 'Guardar cambios'}
          </Button>
        </div>
      </div>
    </div>
  );
}
