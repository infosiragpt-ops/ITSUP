import { useState } from 'react';
import { LifeBuoy, Send, MessageCircle, Mail, Clock, CheckCircle2, Video, ClipboardList, ListChecks, Wifi } from 'lucide-react';
import { api, useApi } from '../../lib/api.js';
import { useUi } from '../../lib/context.jsx';
import { Badge, Button, Card, Field, Input, PageHeader, Select, Skeleton, Textarea } from '../../components/ui.jsx';
import { CONTACT } from '../../components/brand.jsx';
import { FaqList } from '../public/Home.jsx';
import { fmtDateTime, relative } from '../../lib/format.js';

const STATUS = { abierto: ['Abierto', 'warn'], en_proceso: ['En proceso', 'info'], resuelto: ['Resuelto', 'success'] };

const GUIDES = [
  [Video, '¿Cómo me uno a una sesión en vivo?', 'Desde Inicio o Calendario, pulsa “Unirme” cuando la sesión esté por empezar (10 minutos antes). Usa Chrome y permite el acceso a tu micrófono.'],
  [ClipboardList, '¿Cómo entrego una tarea?', 'Entra al curso → Tareas → elige la tarea, escribe tu respuesta o adjunta tu archivo y pulsa “Enviar entrega”. Puedes editarla mientras no esté calificada.'],
  [ListChecks, '¿Qué pasa si se corta mi internet en una evaluación?', 'Tus respuestas se guardan en tu dispositivo. Vuelve a ingresar y pulsa “Continuar intento”: el tiempo sigue corriendo. Si no pudiste terminar, registra una solicitud aquí.'],
  [Wifi, '¿Qué requisitos técnicos necesito?', 'Internet de al menos 10 Mbps, Google Chrome actualizado, audífonos con micrófono y cámara web para evaluaciones supervisadas.'],
];

export default function Help() {
  const { data: tickets, loading, setData } = useApi('/tickets');
  const { toast } = useUi();
  const [form, setForm] = useState({ category: 'Aula virtual', subject: '', message: '' });
  const [sending, setSending] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setSending(true);
    try {
      const t = await api.post('/tickets', form);
      setData((l) => [t, ...(l || [])]);
      setForm({ category: 'Aula virtual', subject: '', message: '' });
      toast('Solicitud registrada. Te responderemos en menos de 24 horas.');
    } catch (err) { toast(err.message, 'error'); } finally { setSending(false); }
  };
  return (
    <div className="animate-fade-up">
      <PageHeader title="Ayuda y soporte" subtitle="Encuentra respuestas rápidas o escríbenos. Estamos para ayudarte." />
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        {[
          [MessageCircle, 'WhatsApp', CONTACT.whatsappLabel, 'Opción “Aula Virtual”', `https://wa.me/${CONTACT.whatsapp}`],
          [Mail, 'Correo de soporte', CONTACT.support, 'Respuesta en menos de 24 h', `mailto:${CONTACT.support}`],
          [Clock, 'Horario de atención', 'Lun a Sáb · 8:00 a 22:00', 'Hora de Lima', null],
        ].map(([Icon, t, v, d, href]) => {
          const inner = (<><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary"><Icon size={20} /></span><div className="min-w-0"><div className="text-xs text-muted">{t}</div><div className="truncate font-semibold text-ink">{v}</div><div className="text-xs text-faint">{d}</div></div></>);
          return href ? <a key={t} href={href} target="_blank" rel="noreferrer" className="card flex items-center gap-4 p-4 transition hover:shadow-lift">{inner}</a> : <div key={t} className="card flex items-center gap-4 p-4">{inner}</div>;
        })}
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="space-y-6">
          <div>
            <h2 className="mb-3 font-semibold text-ink">Guías rápidas</h2>
            <FaqList items={GUIDES.map(([, q, a]) => [q, a])} />
          </div>
          <div>
            <h2 className="mb-3 font-semibold text-ink">Mis solicitudes</h2>
            {loading ? <Skeleton className="h-32 rounded-2xl" /> : tickets.length === 0 ? <Card className="p-6 text-center text-sm text-muted">No has registrado solicitudes.</Card> : (
              <div className="space-y-3">
                {tickets.map((t) => {
                  const [label, tone] = STATUS[t.status];
                  return (
                    <Card key={t.id} className="p-5">
                      <div className="flex flex-wrap items-center gap-2"><Badge tone={tone}>{label}</Badge><Badge>{t.category}</Badge><span className="text-xs text-faint">{relative(t.created_at)}</span></div>
                      <div className="mt-2 font-semibold text-ink">{t.subject}</div>
                      <p className="mt-1 text-sm text-muted">{t.message}</p>
                      {t.response && (
                        <div className="mt-3 flex gap-2.5 rounded-xl border border-success/20 bg-success-soft/50 p-3.5 text-sm text-ink-2">
                          <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-success" />
                          <div><div className="mb-0.5 text-xs font-semibold text-success">Respuesta de soporte · {fmtDateTime(t.updated_at)}</div>{t.response}</div>
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        <Card as="form" onSubmit={submit} className="h-fit space-y-4 p-6 lg:sticky lg:top-24">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-white"><LifeBuoy size={19} /></span>
            <div><h2 className="font-semibold text-ink">Nueva solicitud</h2><p className="text-xs text-muted">Te responderemos aquí y por notificación.</p></div>
          </div>
          <Field label="Categoría">
            <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {['Aula virtual', 'Evaluaciones', 'Sesiones en vivo', 'Calificaciones', 'Acceso y contraseña', 'Trámites académicos', 'Otro'].map((c) => <option key={c}>{c}</option>)}
            </Select>
          </Field>
          <Field label="Asunto" required><Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Resume tu problema" /></Field>
          <Field label="Describe lo que pasó" required><Textarea rows={5} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="Curso, actividad, qué intentaste hacer y qué mensaje viste…" /></Field>
          <Button type="submit" icon={Send} loading={sending} className="w-full" disabled={!form.subject.trim() || !form.message.trim()}>Enviar solicitud</Button>
        </Card>
      </div>
    </div>
  );
}
