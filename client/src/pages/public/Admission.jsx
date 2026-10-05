import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle2, Send, ShieldCheck, Clock, MessageCircle, Award } from 'lucide-react';
import { api, useApi } from '../../lib/api.js';
import { Button, Field, Input, Select, Textarea } from '../../components/ui.jsx';
import { CONTACT } from '../../components/brand.jsx';
import { FaqList } from './Home.jsx';

export default function Admission() {
  const [params] = useSearchParams();
  const { data: programs } = useApi('/public/programs');
  const [form, setForm] = useState({ full_name: '', dni: '', email: '', phone: '', program_id: params.get('carrera') || '', message: '', accept: false });
  const [errors, setErrors] = useState({});
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [serverError, setServerError] = useState('');
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    const er = {};
    if (!form.full_name.trim()) er.full_name = 'Ingresa tu nombre completo';
    if (!/^\S+@\S+\.\S+$/.test(form.email)) er.email = 'Ingresa un correo válido';
    if (form.dni && !/^\d{8}$/.test(form.dni)) er.dni = 'El DNI tiene 8 dígitos';
    if (!form.program_id) er.program_id = 'Elige una carrera';
    if (!form.accept) er.accept = 'Debes aceptar para continuar';
    setErrors(er);
    if (Object.keys(er).length) return;
    setSending(true);
    setServerError('');
    try {
      await api.post('/public/applicants', form);
      setDone(true);
    } catch (err) {
      setServerError(err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <div className="relative overflow-hidden bg-gradient-to-br from-[#C96442] to-[#A9492D]">
        <div className="absolute -top-20 -right-20 h-80 w-80 rounded-full bg-white/10 blur-2xl" />
        <div className="relative mx-auto max-w-7xl px-4 py-14 text-white sm:px-6 sm:py-16">
          <div className="mb-3 text-xs font-bold tracking-[0.16em] text-white/80 uppercase">Admisión</div>
          <h1 className="font-display max-w-3xl text-[2.4rem] leading-[1.08] font-semibold sm:text-[3.2rem]">Postula a ISUP en menos de 3 minutos</h1>
          <p className="mt-4 max-w-2xl text-[17px] text-white/85">Sin exámenes presenciales. Completa el formulario y un asesor de admisión te contactará en menos de 24 horas.</p>
        </div>
      </div>

      <div className="mx-auto grid grid-cols-1 max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1fr_420px]">
        <div className="card p-6 sm:p-8">
          {done ? (
            <div className="animate-fade-up py-10 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success-soft text-success"><CheckCircle2 size={32} /></div>
              <h2 className="font-display mt-5 text-3xl font-semibold text-ink">¡Recibimos tu postulación!</h2>
              <p className="mx-auto mt-3 max-w-md text-muted">Gracias, {form.full_name.split(' ')[0]}. Un asesor te escribirá a <strong className="text-ink">{form.email}</strong> en menos de 24 horas para continuar con tu proceso.</p>
              <div className="mt-7 flex flex-wrap justify-center gap-3">
                <Button to="/" variant="secondary">Volver al inicio</Button>
                <Button href={`https://wa.me/${CONTACT.whatsapp}`} target="_blank" rel="noreferrer" icon={MessageCircle}>Escribir por WhatsApp</Button>
              </div>
            </div>
          ) : (
            <form onSubmit={submit} noValidate className="space-y-5">
              <div>
                <h2 className="font-display text-2xl font-semibold text-ink">Formulario de postulación</h2>
                <p className="mt-1 text-sm text-muted">Los campos con * son obligatorios.</p>
              </div>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <Field label="Nombres y apellidos" required error={errors.full_name} className="sm:col-span-2">
                  <Input value={form.full_name} onChange={set('full_name')} autoComplete="name" placeholder="Ej. María José Llanos Pérez" />
                </Field>
                <Field label="DNI" error={errors.dni}>
                  <Input value={form.dni} onChange={set('dni')} inputMode="numeric" maxLength={8} placeholder="8 dígitos" />
                </Field>
                <Field label="Celular">
                  <Input value={form.phone} onChange={set('phone')} type="tel" autoComplete="tel" placeholder="9XX XXX XXX" />
                </Field>
                <Field label="Correo electrónico" required error={errors.email} className="sm:col-span-2">
                  <Input value={form.email} onChange={set('email')} type="email" autoComplete="email" placeholder="tucorreo@ejemplo.com" />
                </Field>
                <Field label="Carrera de interés" required error={errors.program_id} className="sm:col-span-2">
                  <Select value={form.program_id} onChange={set('program_id')}>
                    <option value="">Selecciona una carrera</option>
                    {programs?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </Select>
                </Field>
                <Field label="¿Tienes alguna consulta?" className="sm:col-span-2">
                  <Textarea value={form.message} onChange={set('message')} rows={3} placeholder="Horarios, becas, convalidaciones…" />
                </Field>
              </div>
              <label className="flex items-start gap-3 text-sm text-ink-2">
                <input type="checkbox" checked={form.accept} onChange={set('accept')} className="mt-0.5 h-4 w-4 accent-[var(--c-primary)]" />
                <span>Autorizo a ISUP a contactarme para brindarme información sobre el proceso de admisión, de acuerdo con su política de privacidad.
                  {errors.accept && <span className="mt-1 block text-xs text-danger">{errors.accept}</span>}
                </span>
              </label>
              {serverError && <div className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">{serverError}</div>}
              <Button type="submit" size="lg" icon={Send} loading={sending} className="w-full sm:w-auto">Enviar postulación</Button>
            </form>
          )}
        </div>
        <aside className="space-y-4">
          {[
            [Clock, 'Respuesta en 24 horas', 'Un asesor te contactará por correo o WhatsApp.'],
            [Award, 'Becas y beneficios', 'Consulta por becas por rendimiento y convenios con empresas.'],
            [ShieldCheck, 'Tus datos están protegidos', 'Solo los usamos para tu proceso de admisión.'],
          ].map(([Icon, t, d]) => (
            <div key={t} className="card flex gap-4 p-5">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary"><Icon size={20} /></span>
              <div><div className="font-semibold text-ink">{t}</div><p className="text-sm text-muted">{d}</p></div>
            </div>
          ))}
          <div className="pt-4">
            <h3 className="mb-3 font-semibold text-ink">Preguntas frecuentes</h3>
            <FaqList items={[
              ['¿Necesito rendir un examen?', 'No. La admisión es por evaluación de expediente y una entrevista virtual con un asesor.'],
              ['¿Qué documentos necesito?', 'DNI, certificado de estudios secundarios y una foto tamaño carné en formato digital.'],
              ['¿Cuándo empiezan las clases?', 'Al inicio de cada ciclo académico. Tu asesor te indicará la fecha exacta.'],
            ]} />
          </div>
        </aside>
      </div>
    </>
  );
}
