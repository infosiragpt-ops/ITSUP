import { useCallback, useEffect, useState } from 'react';
import { Layers, Plus, Pencil, ChevronDown, Users, Library, Clock, MonitorSmartphone, Briefcase, Award, GraduationCap, ScrollText } from 'lucide-react';
import { api, useApi } from '../../lib/api.js';
import { useUi } from '../../lib/context.jsx';
import { pluralize } from '../../lib/format.js';
import { Button, IconButton, Card, Badge, PageHeader, Field, Input, Textarea, Select, Switch, Modal, PageLoader, ErrorState, EmptyState, cx } from '../../components/ui.jsx';
import { PROGRAM_ICONS, AREAS } from '../../components/brand.jsx';

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
const SWATCHES = ['#C96442', '#5B7B6F', '#6A5ACD', '#B8860B', '#2F6F8F', '#8B4C6B', '#4F6D3A', '#A0522D'];
const ICON_LABELS = { code: 'Tecnología', briefcase: 'Negocios', calculator: 'Contabilidad', megaphone: 'Marketing', palette: 'Diseño', shield: 'Seguridad', graduation: 'General' };
const EMPTY_FORM = { name: '', short: '', description: '', duration: '3 años (6 ciclos)', modality: '100% virtual', field: '', profile: '', color: '#C96442', icon: 'graduation', area: '', image: '', level: 'Profesional Técnico', degree: '', total_credits: '120', total_hours: '2550', resolution: '' };
/** Mínimos de la Ley 30512 / LAG por nivel formativo. */
const LEVELS = { 'Auxiliar Técnico': [40, 850], 'Técnico': [80, 1700], 'Profesional Técnico': [120, 2550] };

const tint = (color, pct = 14) => `color-mix(in srgb, ${color} ${pct}%, transparent)`;

export default function AdminPrograms() {
  const { toast, confirm } = useUi();
  const { data, loading, error, reload, setData } = useApi('/admin/programs');
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(null);

  const closeEditor = useCallback(() => setEditing(null), []);
  const onSaved = useCallback((isNew) => {
    setEditing(null);
    toast(isNew ? 'Carrera creada' : 'Carrera actualizada');
    reload();
  }, [toast, reload]);

  const toggleActive = async (p) => {
    if (p.active) {
      const ok = await confirm({
        title: `¿Desactivar ${p.short || p.name}?`,
        message: 'La carrera dejará de mostrarse en la web pública y en el formulario de admisión. Los estudiantes y cursos existentes no se modifican.',
        confirmText: 'Desactivar',
        danger: true,
      });
      if (!ok) return;
    }
    setBusy(p.id);
    try {
      const updated = await api.put(`/admin/programs/${p.id}`, { active: !p.active });
      setData((list) => list.map((x) => (x.id === p.id ? { ...x, active: updated.active } : x)));
      toast(updated.active ? 'Carrera activada' : 'Carrera desactivada');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(null);
    }
  };

  if (loading) return <PageLoader />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  const activeCount = data.filter((p) => p.active).length;

  return (
    <div className="animate-fade-up">
      <PageHeader
        eyebrow="Administración"
        title="Carreras"
        subtitle={`Programas de estudio del instituto · ${activeCount} activa${activeCount === 1 ? '' : 's'} de ${data.length}.`}
        actions={<Button icon={Plus} onClick={() => setEditing('new')}>Nueva carrera</Button>}
      />

      {data.length === 0 ? (
        <Card>
          <EmptyState icon={Layers} title="Aún no hay carreras" description="Crea la primera carrera para publicarla en la web y asignarle estudiantes y cursos."
            action={<Button icon={Plus} onClick={() => setEditing('new')}>Nueva carrera</Button>} />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {data.map((p) => (
            <ProgramCard key={p.id} program={p} busy={busy === p.id} onEdit={() => setEditing(p)} onToggle={() => toggleActive(p)} />
          ))}
        </div>
      )}

      <ProgramFormModal open={editing != null} program={editing === 'new' ? null : editing} onClose={closeEditor} onSaved={onSaved} />
    </div>
  );
}

function ProgramCard({ program: p, busy, onEdit, onToggle }) {
  const [open, setOpen] = useState(false);
  const Icon = PROGRAM_ICONS[p.icon] || GraduationCap;
  const color = p.color || '#C96442';
  const curriculum = p.curriculum || [];
  const totalCourses = curriculum.reduce((n, c) => n + (c.courses?.length || 0), 0);

  return (
    <Card className={cx('relative flex flex-col overflow-hidden transition', !p.active && 'opacity-75')}>
      <div className="h-1.5 w-full" style={{ background: color }} />
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl" style={{ background: tint(color), color }}>
            <Icon size={22} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              {p.short && <Badge>{p.short}</Badge>}
              {p.active ? <Badge tone="success" dot>Activa</Badge> : <Badge tone="neutral" dot>Inactiva</Badge>}
            </div>
            <h3 className="mt-1.5 font-display text-xl leading-snug font-semibold text-ink">{p.name}</h3>
          </div>
          <IconButton icon={Pencil} label="Editar carrera" onClick={onEdit} className="-mt-1 -mr-2" />
        </div>

        {p.description && <p className="mt-3 line-clamp-3 text-sm text-muted">{p.description}</p>}

        <div className="mt-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
          <Metric icon={Users} label="Estudiantes" value={p.students} />
          <Metric icon={Library} label="Cursos" value={p.courses} />
          <Metric icon={Clock} label="Duración" value={p.duration || '—'} small />
          <Metric icon={MonitorSmartphone} label="Modalidad" value={p.modality || '—'} small />
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
          <span className="inline-flex items-center gap-1"><ScrollText size={12} /> {p.level || 'Profesional Técnico'}</span>
          <span>{p.total_credits || 120} créditos · {p.total_hours || 2550} h</span>
          {p.resolution && <span className="truncate" title={p.resolution}>{p.resolution}</span>}
        </div>
        {p.degree && <div className="mt-1 text-xs text-ink-2">Título: <strong className="text-ink">{p.degree}</strong></div>}

        <div className="mt-4 border-t border-line pt-3">
          <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
            className="flex w-full items-center justify-between gap-2 rounded-lg py-1 text-left text-sm font-medium text-ink-2 hover:text-ink">
            <span>Plan de estudios <span className="font-normal text-faint">· {pluralize(curriculum.length, 'ciclo', 'ciclos')}, {pluralize(totalCourses, 'curso', 'cursos')}</span></span>
            <ChevronDown size={17} className={cx('shrink-0 text-muted transition-transform', open && 'rotate-180')} />
          </button>
          {open && (
            <div className="animate-fade-in mt-3 space-y-4">
              {curriculum.length === 0 ? (
                <p className="rounded-xl bg-sunken px-4 py-3 text-sm text-muted">Esta carrera aún no tiene un plan de estudios registrado.</p>
              ) : (
                <ol className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {curriculum.map((c) => (
                    <li key={c.cycle} className="rounded-xl border border-line bg-sunken/50 p-3">
                      <div className="mb-1.5 text-xs font-semibold tracking-wide uppercase" style={{ color }}>Ciclo {ROMAN[c.cycle] || c.cycle}</div>
                      <ul className="space-y-1 text-[13px] text-ink-2">
                        {(c.courses || []).map((name) => (
                          <li key={name} className="flex gap-2"><span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-current opacity-50" />{name}</li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ol>
              )}
              {(p.field || p.profile) && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {p.profile && <TextBlock icon={Award} title="Perfil del egresado" text={p.profile} />}
                  {p.field && <TextBlock icon={Briefcase} title="Campo laboral" text={p.field} />}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="mt-auto flex items-center justify-between gap-3 pt-4">
          <span className="text-xs text-faint">/{p.slug}</span>
          <div className={cx(busy && 'pointer-events-none opacity-60')}>
            <Switch checked={!!p.active} onChange={onToggle} label={p.active ? 'Publicada' : 'Oculta'} />
          </div>
        </div>
      </div>
    </Card>
  );
}

function Metric({ icon: Icon, label, value, small }) {
  return (
    <div className="min-w-0 rounded-xl bg-sunken px-3 py-2">
      <div className="flex items-center gap-1 text-[11px] text-muted"><Icon size={12} /> {label}</div>
      <div className={cx('truncate font-semibold text-ink', small ? 'text-[13px]' : 'text-base tabular-nums')} title={String(value)}>{value}</div>
    </div>
  );
}

function TextBlock({ icon: Icon, title, text }) {
  return (
    <div className="rounded-xl border border-line p-3">
      <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-ink"><Icon size={13} className="text-primary" /> {title}</div>
      <p className="text-[13px] whitespace-pre-line text-muted">{text}</p>
    </div>
  );
}

function ProgramFormModal({ open, program, onClose, onSaved }) {
  const { toast } = useUi();
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const isNew = !program;

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setForm(program
      ? {
        name: program.name || '', short: program.short || '', description: program.description || '', duration: program.duration || '',
        modality: program.modality || '', field: program.field || '', profile: program.profile || '', color: program.color || '#C96442', icon: program.icon || 'graduation',
        area: program.area || '', image: program.image || '', level: program.level || 'Profesional Técnico', degree: program.degree || '', total_credits: String(program.total_credits ?? 120),
        total_hours: String(program.total_hours ?? 2550), resolution: program.resolution || '',
      }
      : EMPTY_FORM);
  }, [open, program]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const setLevel = (e) => { const [cr, h] = LEVELS[e.target.value] || [120, 2550]; setForm((f) => ({ ...f, level: e.target.value, total_credits: String(cr), total_hours: String(h), degree: f.degree || `${e.target.value} en ${f.name}` })); };
  const PreviewIcon = PROGRAM_ICONS[form.icon] || GraduationCap;
  const [minCr, minH] = LEVELS[form.level] || [0, 0];
  const belowMin = Number(form.total_credits) < minCr || Number(form.total_hours) < minH;

  const submit = async (ev) => {
    ev?.preventDefault();
    const e = {};
    if (!form.name.trim()) e.name = 'Ingresa el nombre de la carrera';
    if (!/^#[0-9a-f]{6}$/i.test(form.color)) e.color = 'Color inválido';
    setErrors(e);
    if (Object.keys(e).length) return;
    setSaving(true);
    const payload = {
      name: form.name.trim(), short: form.short.trim() || form.name.trim(), description: form.description.trim(),
      duration: form.duration.trim(), modality: form.modality.trim(), field: form.field.trim(), profile: form.profile.trim(), color: form.color,
      area: form.area, image: form.image.trim(), level: form.level, degree: form.degree.trim() || `${form.level} en ${form.name.trim()}`,
      total_credits: Number(form.total_credits) || 120, total_hours: Number(form.total_hours) || 2550, resolution: form.resolution.trim(),
    };
    if (isNew) payload.icon = form.icon;
    try {
      if (isNew) await api.post('/admin/programs', payload);
      else await api.put(`/admin/programs/${program.id}`, payload);
      onSaved(isNew);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={isNew ? 'Nueva carrera' : 'Editar carrera'}
      description={isNew ? 'La carrera se publicará en la web de admisión al guardarla.' : program?.name}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} loading={saving}>{isNew ? 'Crear carrera' : 'Guardar cambios'}</Button>
        </>
      }
    >
      <form onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-6" noValidate>
        <Field label="Nombre de la carrera" required error={errors.name} className="sm:col-span-4">
          <Input value={form.name} onChange={set('name')} placeholder="Ej. Desarrollo de Sistemas de Información" />
        </Field>
        <Field label="Nombre corto" hint="Se usa en etiquetas y filtros." className="sm:col-span-2">
          <Input value={form.short} onChange={set('short')} placeholder="Ej. Desarrollo de Sistemas" />
        </Field>
        <Field label="Descripción" className="sm:col-span-6">
          <Textarea rows={3} value={form.description} onChange={set('description')} placeholder="Resumen atractivo de la carrera para la web de admisión." />
        </Field>
        <Field label="Duración" className="sm:col-span-3">
          <Input value={form.duration} onChange={set('duration')} placeholder="3 años (6 ciclos)" />
        </Field>
        <Field label="Modalidad" className="sm:col-span-3">
          <Input value={form.modality} onChange={set('modality')} placeholder="100% virtual" list="isup-modalities" />
          <datalist id="isup-modalities">
            <option value="100% virtual" />
            <option value="Semipresencial" />
            <option value="Virtual con prácticas presenciales" />
          </datalist>
        </Field>
        <Field label="Área académica" hint="Agrupa la carrera en el menú y en los filtros de la web." className="sm:col-span-3">
          <Select value={form.area} onChange={set('area')}>
            <option value="">Sin área</option>
            {AREAS.map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}
          </Select>
        </Field>
        <Field label="Foto de la carrera" hint="Ruta o enlace de una imagen horizontal. Vacío: se usa el color y el ícono." className="sm:col-span-3">
          <Input value={form.image} onChange={set('image')} placeholder="/img/carreras/mi-carrera.jpg o https://…" />
        </Field>
        <Field label="Nivel formativo" className="sm:col-span-2" hint="Ley 30512: Auxiliar Técnico, Técnico o Profesional Técnico.">
          <Select value={form.level} onChange={setLevel}>{Object.keys(LEVELS).map((l) => <option key={l}>{l}</option>)}</Select>
        </Field>
        <Field label="Créditos del plan" className="sm:col-span-2" hint={`Mínimo ${minCr}`} error={Number(form.total_credits) < minCr ? `Mínimo ${minCr} créditos` : undefined}><Input type="number" min={0} value={form.total_credits} onChange={set('total_credits')} /></Field>
        <Field label="Horas del plan" className="sm:col-span-2" hint={`Mínimo ${minH}`} error={Number(form.total_hours) < minH ? `Mínimo ${minH} horas` : undefined}><Input type="number" min={0} value={form.total_hours} onChange={set('total_hours')} /></Field>
        <Field label="Título que otorga" className="sm:col-span-3" hint="A nombre de la Nación al concluir el plan de estudios."><Input value={form.degree} onChange={set('degree')} placeholder={`${form.level} en ${form.name || '…'}`} /></Field>
        <Field label="Resolución de autorización / licenciamiento" className="sm:col-span-3"><Input value={form.resolution} onChange={set('resolution')} placeholder="R.M. N.° 000-2026-MINEDU" /></Field>
        {belowMin && <div className="rounded-xl bg-warn-soft px-3 py-2 text-xs text-warn sm:col-span-6">El plan está por debajo de los mínimos del nivel formativo seleccionado. Verifica los créditos y horas antes de publicar.</div>}
        <Field label="Campo laboral" className="sm:col-span-3">
          <Textarea rows={4} value={form.field} onChange={set('field')} placeholder="¿Dónde podrán trabajar los egresados?" />
        </Field>
        <Field label="Perfil del egresado" className="sm:col-span-3">
          <Textarea rows={4} value={form.profile} onChange={set('profile')} placeholder="Competencias que desarrollará el estudiante." />
        </Field>

        <div className="sm:col-span-6">
          <span className="mb-1.5 block text-[13px] font-medium text-ink-2">Color de la carrera</span>
          <div className="flex flex-wrap items-center gap-2">
            {SWATCHES.map((c) => (
              <button key={c} type="button" onClick={() => setForm((f) => ({ ...f, color: c }))} aria-label={`Usar color ${c}`}
                className={cx('h-8 w-8 rounded-full border-2 transition', form.color.toLowerCase() === c.toLowerCase() ? 'scale-110 border-ink' : 'border-transparent hover:scale-105')}
                style={{ background: c }} />
            ))}
            <label className="ml-1 flex items-center gap-2 rounded-xl border border-line-strong bg-surface py-1 pr-3 pl-1">
              <input type="color" value={/^#[0-9a-f]{6}$/i.test(form.color) ? form.color : '#C96442'} onChange={set('color')}
                className="h-7 w-9 cursor-pointer rounded-lg border-0 bg-transparent p-0" aria-label="Color personalizado" />
              <span className="font-mono text-xs text-muted uppercase">{form.color}</span>
            </label>
          </div>
          {errors.color && <span className="mt-1 block text-xs text-danger">{errors.color}</span>}
        </div>

        {isNew && (
          <Field label="Ícono" className="sm:col-span-3">
            <Select value={form.icon} onChange={set('icon')}>
              {Object.keys(PROGRAM_ICONS).map((k) => <option key={k} value={k}>{ICON_LABELS[k] || k}</option>)}
            </Select>
          </Field>
        )}

        <div className={cx(isNew ? 'sm:col-span-3' : 'sm:col-span-6')}>
          <span className="mb-1.5 block text-[13px] font-medium text-ink-2">Vista previa</span>
          <div className="flex items-center gap-3 rounded-xl border border-line p-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: tint(form.color), color: form.color }}>
              <PreviewIcon size={19} />
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-ink">{form.name || 'Nombre de la carrera'}</div>
              <div className="truncate text-xs text-muted">{form.duration || '—'} · {form.modality || '—'}</div>
            </div>
          </div>
        </div>
        <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
      </form>
    </Modal>
  );
}
