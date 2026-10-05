import { useMemo, useState } from 'react';
import { UserPlus, Search, Mail, Phone, Download, IdCard, GraduationCap, MessageSquareText, X, MessageCircle } from 'lucide-react';
import { api, useApi } from '../../lib/api.js';
import { useUi } from '../../lib/context.jsx';
import { relative, fmtDateTime, dayKey } from '../../lib/format.js';
import { Button, Card, Badge, PageHeader, Input, Select, PageLoader, ErrorState, EmptyState, Avatar, Segmented, cx } from '../../components/ui.jsx';

const STATUSES = [
  { value: 'nuevo', label: 'Nuevo', plural: 'Nuevos', tone: 'primary' },
  { value: 'contactado', label: 'Contactado', plural: 'Contactados', tone: 'info' },
  { value: 'matriculado', label: 'Matriculado', plural: 'Matriculados', tone: 'success' },
  { value: 'descartado', label: 'Descartado', plural: 'Descartados', tone: 'neutral' },
];
const STATUS = Object.fromEntries(STATUSES.map((s) => [s.value, s]));
const AVATAR_COLORS = ['#C96442', '#5B7B6F', '#6A5ACD', '#B8860B', '#2F6F8F', '#8B4C6B', '#4F6D3A', '#A0522D'];

function asUser(a) {
  const [first = '', ...rest] = (a.full_name || '').trim().split(/\s+/);
  return { first_name: first, last_name: rest.join(' '), avatar_color: AVATAR_COLORS[a.id % AVATAR_COLORS.length] };
}

const waLink = (phone) => {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length < 9) return null;
  return `https://wa.me/${digits.length === 9 ? `51${digits}` : digits}`;
};

const csvCell = (v) => {
  const s = v == null ? '' : String(v);
  return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export default function AdminApplicants() {
  const { toast } = useUi();
  const { data, loading, error, reload, setData } = useApi('/admin/applicants');
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [saving, setSaving] = useState(null);

  const counts = useMemo(() => {
    const c = { '': 0 };
    STATUSES.forEach((s) => { c[s.value] = 0; });
    (data || []).forEach((a) => { c[''] += 1; c[a.status] = (c[a.status] || 0) + 1; });
    return c;
  }, [data]);

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (data || []).filter((a) => {
      if (status && a.status !== status) return false;
      if (!term) return true;
      return [a.full_name, a.dni, a.email, a.phone, a.program].some((v) => v?.toLowerCase().includes(term));
    });
  }, [data, status, q]);

  const changeStatus = async (a, next) => {
    if (next === a.status) return;
    const prev = a.status;
    setSaving(a.id);
    setData((d) => d.map((x) => (x.id === a.id ? { ...x, status: next } : x)));
    try {
      await api.put(`/admin/applicants/${a.id}`, { status: next });
      toast(`${a.full_name} · estado actualizado a “${STATUS[next].label}”`);
    } catch (e) {
      setData((d) => d.map((x) => (x.id === a.id ? { ...x, status: prev } : x)));
      toast(e.message, 'error');
    } finally {
      setSaving(null);
    }
  };

  const exportCsv = () => {
    const header = ['Fecha', 'Nombre completo', 'DNI', 'Correo', 'Teléfono', 'Carrera de interés', 'Estado', 'Mensaje'];
    const rows = list.map((a) => [
      fmtDateTime(a.created_at), a.full_name, a.dni, a.email, a.phone, a.program, STATUS[a.status]?.label || a.status, a.message,
    ]);
    const csv = [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `postulantes-isup-${status || 'todos'}-${dayKey(new Date())}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast(`Se exportaron ${list.length} postulante${list.length === 1 ? '' : 's'}`, 'info');
  };

  if (loading) return <PageLoader />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  const options = [{ value: '', label: 'Todos', count: counts[''] }, ...STATUSES.map((s) => ({ value: s.value, label: s.plural, count: counts[s.value] }))];

  return (
    <div className="animate-fade-up">
      <PageHeader
        eyebrow="Admisión"
        title="Postulantes"
        subtitle="Solicitudes de información recibidas desde el formulario de admisión de la web."
        actions={<Button variant="secondary" icon={Download} onClick={exportCsv} disabled={list.length === 0}>Exportar CSV</Button>}
      />

      <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="no-scrollbar -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <Segmented value={status} onChange={setStatus} options={options} className="whitespace-nowrap" />
        </div>
        <div className="relative w-full xl:max-w-sm">
          <Search size={17} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-faint" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre, DNI, correo o carrera" className="pr-9 pl-9" aria-label="Buscar postulantes" />
          {q && (
            <button type="button" onClick={() => setQ('')} className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded-md p-1 text-faint hover:text-ink" aria-label="Limpiar búsqueda">
              <X size={15} />
            </button>
          )}
        </div>
      </div>

      {data.length === 0 ? (
        <Card>
          <EmptyState icon={UserPlus} title="Aún no hay postulantes" description="Cuando alguien complete el formulario de admisión en la web, aparecerá aquí para que el equipo lo contacte." />
        </Card>
      ) : list.length === 0 ? (
        <Card>
          <EmptyState icon={Search} title="Sin resultados"
            description={q.trim() ? `No hay postulantes que coincidan con “${q.trim()}”.` : `No hay postulantes con estado “${STATUS[status]?.label.toLowerCase()}”.`}
            action={<Button variant="secondary" size="sm" onClick={() => { setQ(''); setStatus(''); }}>Ver todos</Button>} />
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {list.map((a) => {
            const st = STATUS[a.status] || STATUS.nuevo;
            const wa = waLink(a.phone);
            return (
              <li key={a.id}>
                <Card className={cx('p-4 sm:p-5', a.status === 'descartado' && 'opacity-70')}>
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                    <div className="flex min-w-0 flex-1 gap-3">
                      <Avatar user={asUser(a)} size={42} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <h3 className="font-semibold text-ink">{a.full_name}</h3>
                          <Badge tone={st.tone} dot>{st.label}</Badge>
                          <span className="text-xs text-faint" title={fmtDateTime(a.created_at)}>{relative(a.created_at)}</span>
                        </div>
                        <div className="mt-1 flex items-center gap-1.5 text-sm text-ink-2">
                          <GraduationCap size={15} className="shrink-0 text-primary" />
                          <span className="truncate">{a.program || 'Carrera por definir'}</span>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 text-[13px] text-muted">
                          {a.dni && <span className="inline-flex items-center gap-1.5"><IdCard size={14} /> DNI <span className="font-mono text-ink-2">{a.dni}</span></span>}
                          <a href={`mailto:${a.email}`} className="inline-flex min-w-0 items-center gap-1.5 text-primary-ink hover:underline">
                            <Mail size={14} className="shrink-0" /> <span className="truncate">{a.email}</span>
                          </a>
                          {a.phone && (
                            <a href={`tel:${a.phone.replace(/\s/g, '')}`} className="inline-flex items-center gap-1.5 hover:text-ink">
                              <Phone size={14} /> {a.phone}
                            </a>
                          )}
                          {wa && (
                            <a href={wa} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-success hover:underline">
                              <MessageCircle size={14} /> WhatsApp
                            </a>
                          )}
                        </div>
                        {a.message && (
                          <div className="mt-3 flex gap-2 rounded-xl bg-sunken px-3.5 py-2.5 text-sm text-ink-2">
                            <MessageSquareText size={15} className="mt-0.5 shrink-0 text-faint" />
                            <p className="min-w-0 break-words whitespace-pre-line">{a.message}</p>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="sm:w-48 sm:shrink-0">
                      <label className="mb-1 block text-xs font-medium text-muted" htmlFor={`st-${a.id}`}>Estado</label>
                      <Select id={`st-${a.id}`} value={a.status} onChange={(e) => changeStatus(a, e.target.value)} disabled={saving === a.id} className="h-10 py-0 text-sm">
                        {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                      </Select>
                    </div>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
