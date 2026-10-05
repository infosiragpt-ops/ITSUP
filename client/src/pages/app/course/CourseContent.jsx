import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ChevronDown, CheckCircle2, Circle, Lock, Plus, Trash2, Pencil, ArrowLeft, ArrowRight, ExternalLink, Download, Clock, Layers, Check, Upload, PlayCircle,
} from 'lucide-react';
import { api, useApi, fileUrl } from '../../../lib/api.js';
import { useUi } from '../../../lib/context.jsx';
import { Badge, Button, Card, EmptyState, ErrorState, Field, IconButton, Input, Modal, ProgressBar, Select, Skeleton, Textarea, cx } from '../../../components/ui.jsx';
import { ITEM_META } from '../../../components/brand.jsx';
import { DueChip } from '../../../components/lms.jsx';
import Markdown from '../../../components/Markdown.jsx';
import { fmtDate, fromLocalInput, toLocalInput } from '../../../lib/format.js';
import { useCourse } from './CourseLayout.jsx';

const isLocked = (m, canEdit) => !canEdit && m.start_date && new Date(m.start_date) > new Date();

export default function CourseContent() {
  const { course, canEdit, setCourse } = useCourse();
  const { data, loading, error, reload, setData } = useApi(`/courses/${course.id}/modules`);
  const [params, setParams] = useSearchParams();
  const [openMods, setOpenMods] = useState({});
  const [modModal, setModModal] = useState(null);
  const [itemModal, setItemModal] = useState(null);
  const { toast, confirm } = useUi();

  const flat = useMemo(() => (data?.modules || []).flatMap((m) => (isLocked(m, canEdit) ? [] : m.items.map((i) => ({ ...i, module: m })))), [data, canEdit]);
  const selectedId = Number(params.get('item')) || null;
  const selected = flat.find((i) => i.id === selectedId) || null;

  // Open the module of the selected item, or the current one
  useEffect(() => {
    if (!data) return;
    const init = {};
    const current = selected?.module || data.modules.find((m) => !isLocked(m, canEdit) && m.items.some((i) => !i.completed)) || data.modules[0];
    if (current) init[current.id] = true;
    setOpenMods((o) => ({ ...init, ...o }));
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  const select = (id) => { setParams(id ? { item: String(id) } : {}); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  const toggleComplete = async (item, completed) => {
    const r = await api.post(`/items/${item.id}/complete`, { completed });
    setData((d) => ({ ...d, progress: r.progress, modules: d.modules.map((m) => ({ ...m, items: m.items.map((i) => (i.id === item.id ? { ...i, completed } : i)) })) }));
    setCourse((c) => ({ ...c, progress: r.progress }));
    if (completed) toast(r.progress.pct === 100 ? '¡Completaste todo el contenido del curso! 🎉' : 'Lección completada');
  };

  const removeItem = async (item) => {
    if (!(await confirm({ title: 'Eliminar recurso', message: `Se eliminará “${item.title}” para todos los estudiantes.`, confirmText: 'Eliminar', danger: true }))) return;
    await api.del(`/items/${item.id}`);
    if (selectedId === item.id) select(null);
    reload();
    toast('Recurso eliminado');
  };
  const removeModule = async (m) => {
    if (!(await confirm({ title: 'Eliminar unidad', message: `Se eliminará “${m.title}” y todos sus recursos.`, confirmText: 'Eliminar unidad', danger: true }))) return;
    await api.del(`/modules/${m.id}`);
    reload();
    toast('Unidad eliminada');
  };

  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (loading) return <div className="grid grid-cols-1 gap-6 lg:grid-cols-[360px_1fr]"><Skeleton className="h-96 rounded-2xl" /><Skeleton className="h-96 rounded-2xl" /></div>;

  const idx = selected ? flat.findIndex((i) => i.id === selected.id) : -1;

  return (
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(300px,380px)_minmax(0,1fr)]">
      {/* Outline */}
      <div className={cx('space-y-3 lg:sticky lg:top-[132px] lg:max-h-[calc(100dvh-150px)] lg:overflow-y-auto lg:pr-1 scrollbar-thin', selected && 'hidden lg:block')}>
        {!canEdit && (
          <Card className="p-4">
            <div className="mb-2 flex items-center justify-between text-sm"><span className="font-medium text-ink">Progreso del curso</span><span className="font-semibold text-primary-ink tabular-nums">{data.progress.pct}%</span></div>
            <ProgressBar value={data.progress.pct} tone={data.progress.pct === 100 ? 'success' : 'primary'} />
          </Card>
        )}
        {canEdit && <Button icon={Plus} variant="secondary" className="w-full" onClick={() => setModModal({})}>Nueva unidad</Button>}
        {data.modules.length === 0 && <Card><EmptyState compact icon={Layers} title="Aún no hay unidades" description={canEdit ? 'Crea la primera unidad para organizar tu contenido.' : 'Tu docente publicará pronto el contenido.'} /></Card>}
        {data.modules.map((m, mi) => {
          const locked = isLocked(m, canEdit);
          const done = m.items.filter((i) => i.completed).length;
          const open = openMods[m.id] && !locked;
          return (
            <Card key={m.id} className="overflow-hidden">
              <div className="flex items-center">
                <button onClick={() => !locked && setOpenMods((o) => ({ ...o, [m.id]: !o[m.id] }))} className="flex flex-1 items-center gap-3 p-4 text-left" aria-expanded={open} disabled={locked}>
                  <span className={cx('font-display flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[15px] font-semibold',
                    locked ? 'bg-sunken text-faint' : done === m.items.length && m.items.length ? 'bg-success-soft text-success' : 'bg-primary-soft text-primary-ink')}>
                    {locked ? <Lock size={15} /> : done === m.items.length && m.items.length ? <Check size={17} /> : mi + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={cx('block text-[14px] leading-snug font-semibold', locked ? 'text-muted' : 'text-ink')}>{m.title}</span>
                    <span className="block text-xs text-muted">
                      {locked ? `Disponible desde el ${fmtDate(m.start_date)}` : `${done}/${m.items.length} completados${m.assignments.length + m.quizzes.length ? ` · ${m.assignments.length + m.quizzes.length} actividades` : ''}`}
                    </span>
                  </span>
                  {!locked && <ChevronDown size={18} className={cx('shrink-0 text-muted transition', open && 'rotate-180')} />}
                </button>
                {canEdit && (
                  <div className="flex pr-2">
                    <IconButton icon={Pencil} size={15} label="Editar unidad" onClick={() => setModModal(m)} />
                    <IconButton icon={Trash2} size={15} label="Eliminar unidad" onClick={() => removeModule(m)} />
                  </div>
                )}
              </div>
              {open && (
                <div className="border-t border-line px-2 py-2">
                  {m.description && <p className="px-2 pt-1 pb-2 text-[13px] text-muted">{m.description}</p>}
                  <ul>
                    {m.items.map((i) => {
                      const meta = ITEM_META[i.type];
                      const active = selectedId === i.id;
                      return (
                        <li key={i.id}>
                          <button onClick={() => select(i.id)} className={cx('group flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition', active ? 'bg-primary-soft' : 'hover:bg-sunken')}>
                            <span className={cx('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', meta.tone)}><meta.icon size={15} /></span>
                            <span className="min-w-0 flex-1">
                              <span className={cx('block truncate text-[13.5px]', active ? 'font-semibold text-ink' : 'text-ink-2')}>{i.title}</span>
                              <span className="block text-[11.5px] text-faint">{meta.label}{i.duration_min ? ` · ${i.duration_min} min` : ''}</span>
                            </span>
                            {!canEdit && (i.completed ? <CheckCircle2 size={18} className="shrink-0 text-success" /> : <Circle size={18} className="shrink-0 text-line-strong" />)}
                          </button>
                        </li>
                      );
                    })}
                    {m.assignments.map((a) => (
                      <li key={`a${a.id}`}>
                        <Link to={`/app/cursos/${course.id}/tareas/${a.id}`} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-sunken">
                          <span className={cx('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', ITEM_META.assignment.tone)}><ITEM_META.assignment.icon size={15} /></span>
                          <span className="min-w-0 flex-1"><span className="block truncate text-[13.5px] text-ink-2">{a.title}</span><span className="block text-[11.5px] text-faint">Tarea · {a.points} pts</span></span>
                          {!canEdit && <DueChip due={a.due_at} done={a.submitted} />}
                        </Link>
                      </li>
                    ))}
                    {m.quizzes.map((q) => (
                      <li key={`q${q.id}`}>
                        <Link to={`/app/cursos/${course.id}/evaluaciones/${q.id}`} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-sunken">
                          <span className={cx('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', ITEM_META.quiz.tone)}><ITEM_META.quiz.icon size={15} /></span>
                          <span className="min-w-0 flex-1"><span className="block truncate text-[13.5px] text-ink-2">{q.title}</span><span className="block text-[11.5px] text-faint">Evaluación · {q.time_limit_min} min</span></span>
                          {!canEdit && <DueChip due={q.due_at} done={q.submitted} />}
                        </Link>
                      </li>
                    ))}
                  </ul>
                  {canEdit && <Button size="sm" variant="ghost" icon={Plus} className="mt-1 w-full" onClick={() => setItemModal({ module: m })}>Agregar recurso</Button>}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Viewer */}
      <div className={cx('min-w-0', !selected && 'hidden lg:block')}>
        {selected ? (
          <ItemViewer key={selected.id} item={selected} canEdit={canEdit}
            prev={flat[idx - 1]} next={flat[idx + 1]} onSelect={select}
            onToggle={toggleComplete} onEdit={() => setItemModal({ module: selected.module, item: selected })} onDelete={() => removeItem(selected)} />
        ) : (
          <Card className="flex min-h-[420px] items-center justify-center">
            <EmptyState icon={PlayCircle} title="Elige una lección para empezar"
              description="Selecciona una lectura, video o recurso de la lista. Tu avance se guarda automáticamente."
              action={flat.find((i) => !i.completed) && <Button iconRight={ArrowRight} onClick={() => select(flat.find((i) => !i.completed).id)}>Continuar con la siguiente lección</Button>} />
          </Card>
        )}
      </div>

      {modModal && <ModuleModal courseId={course.id} module={modModal.id ? modModal : null} onClose={() => setModModal(null)} onSaved={() => { setModModal(null); reload(); }} />}
      {itemModal && <ItemModal {...itemModal} onClose={() => setItemModal(null)} onSaved={(it) => { setItemModal(null); reload(); if (it) select(it.id); }} />}
    </div>
  );
}

function youtubeEmbed(url) {
  if (!url) return null;
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{11})/);
  return m ? `https://www.youtube-nocookie.com/embed/${m[1]}` : null;
}

function ItemViewer({ item, canEdit, prev, next, onSelect, onToggle, onEdit, onDelete }) {
  const meta = ITEM_META[item.type];
  const [busy, setBusy] = useState(false);
  const embed = item.type === 'video' && youtubeEmbed(item.url);
  const isPdf = item.type === 'file' && /\.pdf$/i.test(item.file_name || '');
  const toggle = async () => { setBusy(true); try { await onToggle(item, !item.completed); } finally { setBusy(false); } };

  return (
    <Card className="animate-fade-in overflow-hidden">
      <div className="border-b border-line p-5 sm:p-7">
        <button onClick={() => onSelect(null)} className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-ink lg:hidden"><ArrowLeft size={16} /> Volver a las unidades</button>
        <div className="flex flex-wrap items-center gap-2">
          <span className={cx('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold', meta.tone)}><meta.icon size={13} /> {meta.label}</span>
          {item.duration_min && <span className="flex items-center gap-1 text-xs text-muted"><Clock size={13} /> {item.duration_min} min</span>}
          <span className="text-xs text-faint">· {item.module.title}</span>
          {canEdit && (
            <div className="ml-auto flex">
              <IconButton icon={Pencil} size={16} label="Editar" onClick={onEdit} />
              <IconButton icon={Trash2} size={16} label="Eliminar" onClick={onDelete} />
            </div>
          )}
        </div>
        <h2 className="font-display mt-3 text-[1.7rem] leading-tight font-semibold text-ink sm:text-[2rem]">{item.title}</h2>
      </div>

      <div className="p-5 sm:p-7">
        {item.type === 'reading' && <Markdown className="max-w-[72ch]">{item.content}</Markdown>}

        {item.type === 'video' && (
          embed ? (
            <div className="aspect-video overflow-hidden rounded-xl bg-night"><iframe src={embed} title={item.title} className="h-full w-full" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowFullScreen /></div>
          ) : (
            <div className="relative flex aspect-video flex-col items-center justify-center overflow-hidden rounded-xl bg-night text-center text-white">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(201,100,66,.35),transparent_60%)]" />
              <PlayCircle size={64} strokeWidth={1.2} className="relative text-white/90" />
              <p className="relative mt-3 max-w-sm px-4 text-sm text-white/70">Este video se abre en una pestaña nueva.</p>
              {item.url && <Button href={item.url} target="_blank" rel="noreferrer" variant="white" icon={ExternalLink} className="relative mt-4">Ver video</Button>}
            </div>
          )
        )}
        {item.type === 'video' && item.content && <p className="mt-4 text-[15px] text-ink-2">{item.content}</p>}

        {item.type === 'file' && (
          <div className="space-y-4">
            {item.content && <p className="text-[15px] text-ink-2">{item.content}</p>}
            <div className="flex items-center gap-4 rounded-xl border border-line bg-sunken p-4">
              <span className={cx('flex h-12 w-12 items-center justify-center rounded-xl', meta.tone)}><meta.icon size={22} /></span>
              <div className="min-w-0 flex-1"><div className="truncate font-medium text-ink">{item.file_name}</div><div className="text-xs text-muted">{isPdf ? 'Documento PDF' : 'Archivo adjunto'}</div></div>
              <Button href={fileUrl(item.file_path, item.file_name)} icon={Download} variant="secondary" size="sm">Descargar</Button>
            </div>
            {isPdf && <iframe src={fileUrl(item.file_path)} title={item.file_name} className="h-[70vh] w-full rounded-xl border border-line bg-white" />}
          </div>
        )}

        {item.type === 'link' && (
          <div className="space-y-4">
            {item.content && <p className="text-[15px] text-ink-2">{item.content}</p>}
            <a href={item.url} target="_blank" rel="noreferrer" className="group flex items-center gap-4 rounded-xl border border-line p-4 transition hover:border-primary hover:bg-primary-soft/40">
              <span className={cx('flex h-12 w-12 items-center justify-center rounded-xl', meta.tone)}><meta.icon size={22} /></span>
              <div className="min-w-0 flex-1"><div className="font-medium text-ink">{item.title}</div><div className="truncate text-xs text-muted">{item.url}</div></div>
              <ExternalLink size={18} className="text-muted group-hover:text-primary" />
            </a>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 border-t border-line bg-sunken/50 p-4 sm:flex-row sm:items-center sm:px-7">
        {!canEdit ? (
          <Button onClick={toggle} loading={busy} variant={item.completed ? 'secondary' : 'primary'} icon={item.completed ? CheckCircle2 : Check} className={item.completed ? '!text-success' : ''}>
            {item.completed ? 'Completado' : 'Marcar como completado'}
          </Button>
        ) : <Badge tone="info">Vista previa del docente</Badge>}
        <div className="flex gap-2 sm:ml-auto">
          <Button variant="ghost" icon={ArrowLeft} disabled={!prev} onClick={() => onSelect(prev.id)}>Anterior</Button>
          <Button variant="secondary" iconRight={ArrowRight} disabled={!next} onClick={async () => { if (!canEdit && !item.completed) await onToggle(item, true); onSelect(next.id); }}>Siguiente</Button>
        </div>
      </div>
    </Card>
  );
}

function ModuleModal({ courseId, module, onClose, onSaved }) {
  const { toast } = useUi();
  const [form, setForm] = useState({ title: module?.title || '', description: module?.description || '', start_date: module?.start_date ? toLocalInput(module.start_date) : '' });
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      const body = { ...form, start_date: form.start_date ? fromLocalInput(form.start_date) : null };
      if (module) await api.put(`/modules/${module.id}`, body); else await api.post(`/courses/${courseId}/modules`, body);
      toast(module ? 'Unidad actualizada' : 'Unidad creada');
      onSaved();
    } catch (e) { toast(e.message, 'error'); } finally { setSaving(false); }
  };
  return (
    <Modal open onClose={onClose} title={module ? 'Editar unidad' : 'Nueva unidad'} footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button onClick={save} loading={saving}>Guardar</Button></>}>
      <div className="space-y-4">
        <Field label="Título" required><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Unidad 5 · Despliegue" /></Field>
        <Field label="Descripción"><Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
        <Field label="Disponible desde" hint="Opcional. Antes de esta fecha los estudiantes verán la unidad bloqueada."><Input type="datetime-local" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}

function ItemModal({ module, item, onClose, onSaved }) {
  const { toast } = useUi();
  const [form, setForm] = useState({ type: item?.type || 'reading', title: item?.title || '', content: item?.content || '', url: item?.url || '', duration_min: item?.duration_min || '' });
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const save = async () => {
    setSaving(true);
    try {
      let saved;
      if (item) saved = await api.put(`/items/${item.id}`, form);
      else {
        const fd = new FormData();
        Object.entries(form).forEach(([k, v]) => fd.append(k, v));
        if (file) fd.append('file', file);
        saved = await api.form(`/modules/${module.id}/items`, fd);
      }
      toast(item ? 'Recurso actualizado' : 'Recurso publicado y notificado');
      onSaved(saved);
    } catch (e) { toast(e.message, 'error'); } finally { setSaving(false); }
  };
  return (
    <Modal open onClose={onClose} size="lg" title={item ? 'Editar recurso' : 'Agregar recurso'} description={module.title}
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button onClick={save} loading={saving}>{item ? 'Guardar cambios' : 'Publicar'}</Button></>}>
      <div className="space-y-4">
        {!item && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {['reading', 'video', 'file', 'link'].map((t) => {
              const m = ITEM_META[t];
              return (
                <button key={t} type="button" onClick={() => setForm({ ...form, type: t })}
                  className={cx('flex flex-col items-center gap-2 rounded-xl border p-3 text-sm font-medium transition', form.type === t ? 'border-primary bg-primary-soft text-primary-ink' : 'border-line text-ink-2 hover:bg-sunken')}>
                  <m.icon size={20} /> {m.label}
                </button>
              );
            })}
          </div>
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_140px]">
          <Field label="Título" required><Input value={form.title} onChange={set('title')} /></Field>
          <Field label="Duración (min)"><Input type="number" min="0" value={form.duration_min} onChange={set('duration_min')} /></Field>
        </div>
        {(form.type === 'video' || form.type === 'link') && (
          <Field label="Enlace" hint={form.type === 'video' ? 'Los enlaces de YouTube se reproducen dentro del aula.' : 'Se abrirá en una pestaña nueva.'}>
            <Input type="url" value={form.url} onChange={set('url')} placeholder="https://" />
          </Field>
        )}
        {form.type === 'file' && !item && (
          <Field label="Archivo" required hint="PDF, Word, Excel, PowerPoint, imágenes o ZIP. Máximo 25 MB.">
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-line-strong bg-sunken p-4 text-sm text-muted hover:border-primary">
              <Upload size={18} className="text-primary" /> {file ? file.name : 'Haz clic para seleccionar un archivo'}
              <input type="file" className="hidden" onChange={(e) => setFile(e.target.files[0])} />
            </label>
          </Field>
        )}
        <Field label={form.type === 'reading' ? 'Contenido de la lectura' : 'Descripción'} hint="Admite formato: ## Títulos, **negrita**, listas con -, ```código``` y enlaces.">
          <Textarea rows={form.type === 'reading' ? 12 : 3} value={form.content} onChange={set('content')} className="font-mono text-[13px]" />
        </Field>
      </div>
    </Modal>
  );
}
