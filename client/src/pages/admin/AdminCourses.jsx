import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Library, Plus, Search, Pencil, Trash2, Users, UserPlus, UserMinus, ArrowUpRight, Clock, ClipboardCheck, X, Check, GraduationCap, Lock, BookMarked,
} from 'lucide-react';
import { api, useApi } from '../../lib/api.js';
import { useUi } from '../../lib/context.jsx';
import { fullName, pluralize } from '../../lib/format.js';
import {
  Button, IconButton, Card, Badge, PageHeader, Field, Input, Textarea, Select, Switch, Modal, PageLoader, ErrorState, EmptyState, Avatar, Skeleton, cx,
} from '../../components/ui.jsx';
import { CourseCover } from '../../components/brand.jsx';

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
const COURSE_TYPES = [['especifica', 'Competencia técnica o específica'], ['empleabilidad', 'Competencia para la empleabilidad'], ['efsrt', 'Experiencias formativas en situaciones reales de trabajo']];
const EMPTY_FORM = { code: '', name: '', description: '', program_id: '', teacher_id: '', cycle: '1', credits: '3', schedule: '', module_name: '', course_type: 'especifica', hours_theory: '32', hours_practice: '32', term_id: '', min_grade: '13', max_absence_pct: '30' };
/** 1 crédito = 16 h teóricas = 32 h prácticas (Ley 30512 / LAG). */
const creditsFor = (t, p) => Math.round(((Number(t) || 0) / 16 + (Number(p) || 0) / 32) * 10) / 10;

export default function AdminCourses() {
  const { toast, confirm } = useUi();
  const terms = useApi('/admin/terms');
  const [termId, setTermId] = useState('');
  const courses = useApi(`/admin/courses?term=${termId || 'all'}`);
  const programs = useApi('/admin/programs');
  const teachers = useApi('/admin/users?role=teacher');

  const [q, setQ] = useState('');
  const [program, setProgram] = useState('');
  useEffect(() => { if (!termId && terms.data) { const a = terms.data.find((t) => t.is_active); if (a) setTermId(String(a.id)); } }, [terms.data]); // eslint-disable-line react-hooks/exhaustive-deps
  const [editing, setEditing] = useState(null); // null | 'new' | course
  const [enrolling, setEnrolling] = useState(null);

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (courses.data || []).filter((c) => {
      if (program === 'none' ? c.program_id : program && String(c.program_id) !== program) return false;
      if (!term) return true;
      return [c.code, c.name, c.teacher && fullName(c.teacher)].some((v) => v?.toLowerCase().includes(term));
    });
  }, [courses.data, q, program]);

  const closeEditor = useCallback(() => setEditing(null), []);
  const closeEnroll = useCallback(() => setEnrolling(null), []);
  const reloadCourses = courses.reload;
  const onSaved = useCallback((isNew) => {
    setEditing(null);
    toast(isNew ? 'Curso creado con su primera unidad y foro de consultas' : 'Curso actualizado');
    reloadCourses();
  }, [toast, reloadCourses]);

  const remove = async (c) => {
    const ok = await confirm({
      title: `¿Eliminar ${c.code}?`,
      message: `Se eliminará “${c.name}” junto con sus unidades, materiales, tareas, entregas, evaluaciones, foros y matrículas (${pluralize(c.students, 'estudiante', 'estudiantes')}). Esta acción no se puede deshacer.`,
      confirmText: 'Eliminar curso',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.del(`/admin/courses/${c.id}`);
      courses.setData((d) => d.filter((x) => x.id !== c.id));
      toast('Curso eliminado');
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  if (courses.loading) return <PageLoader />;
  if (courses.error) return <ErrorState message={courses.error} onRetry={courses.reload} />;

  const total = courses.data.length;
  const filtered = q.trim() || program;

  return (
    <div className="animate-fade-up">
      <PageHeader
        eyebrow="Administración"
        title="Cursos y matrícula"
        subtitle="Crea cursos, asigna docentes y matricula estudiantes en el periodo académico activo."
        actions={<Button icon={Plus} onClick={() => setEditing('new')}>Nuevo curso</Button>}
      />

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative w-full sm:max-w-sm">
          <Search size={17} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-faint" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por código, nombre o docente" className="pl-9" aria-label="Buscar cursos" />
        </div>
        <Select value={program} onChange={(e) => setProgram(e.target.value)} className="sm:max-w-xs" aria-label="Filtrar por carrera">
          <option value="">Todas las carreras</option>
          {(programs.data || []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          <option value="none">Sin carrera (transversales)</option>
        </Select>
        <Select value={termId} onChange={(e) => setTermId(e.target.value)} className="sm:max-w-[200px]" aria-label="Periodo académico">
          <option value="">Todos los periodos</option>
          {(terms.data || []).map((t) => <option key={t.id} value={t.id}>{t.name}{t.is_active ? ' (activo)' : t.closed_at ? ' (cerrado)' : ''}</option>)}
        </Select>
        <span className="text-xs text-muted sm:ml-auto">{filtered ? `${list.length} de ${total}` : pluralize(total, 'curso', 'cursos')}</span>
      </div>

      {total === 0 ? (
        <Card>
          <EmptyState icon={Library} title="Aún no hay cursos" description="Crea el primer curso del periodo. Se generará automáticamente una unidad inicial y un foro de consultas."
            action={<Button icon={Plus} onClick={() => setEditing('new')}>Nuevo curso</Button>} />
        </Card>
      ) : list.length === 0 ? (
        <Card>
          <EmptyState icon={Search} title="Sin resultados" description="Ningún curso coincide con los filtros aplicados."
            action={<Button variant="secondary" size="sm" onClick={() => { setQ(''); setProgram(''); }}>Limpiar filtros</Button>} />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((c) => (
            <Card key={c.id} className="flex flex-col overflow-hidden">
              <CourseCover course={c} className="h-24 px-4 pt-3.5">
                <div className="relative flex items-start justify-between gap-2">
                  <span className="rounded-md bg-black/20 px-2 py-0.5 font-mono text-xs font-medium text-white backdrop-blur-sm">{c.code}{c.term ? ` · ${c.term.name}` : ''}</span>
                  {c.closed ? <span className="flex items-center gap-1 rounded-md bg-white px-2 py-0.5 text-xs font-medium text-ink"><Lock size={11} /> Acta cerrada</span>
                    : c.program && <span className="truncate rounded-md bg-white/20 px-2 py-0.5 text-xs font-medium text-white backdrop-blur-sm">{c.program.short}</span>}
                </div>
              </CourseCover>
              <div className="flex flex-1 flex-col p-4">
                <h3 className="line-clamp-2 font-display text-lg leading-snug font-semibold text-ink">{c.name}</h3>
                <div className="mt-2.5 flex items-center gap-2 text-sm">
                  {c.teacher ? (
                    <>
                      <Avatar user={c.teacher} size={24} />
                      <span className="truncate text-ink-2">{fullName(c.teacher)}</span>
                    </>
                  ) : (
                    <Badge tone="warn">Sin docente asignado</Badge>
                  )}
                </div>
                {c.module_name && <div className="mt-1.5 flex items-center gap-1 truncate text-xs text-muted"><BookMarked size={12} className="shrink-0" /> <span className="truncate">{c.module_name}</span></div>}
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted">
                  <span className="inline-flex items-center gap-1"><Users size={13} /> {pluralize(c.students, 'matriculado', 'matriculados')}</span>
                  {c.cycle && <span className="inline-flex items-center gap-1"><GraduationCap size={13} /> Ciclo {ROMAN[c.cycle] || c.cycle}</span>}
                  <span>{pluralize(c.credits || 0, 'crédito', 'créditos')} · {c.hours} h</span>
                  {c.to_grade > 0 && <span className="inline-flex items-center gap-1 text-warn"><ClipboardCheck size={13} /> {c.to_grade} por calificar</span>}
                </div>
                {c.schedule && <div className="mt-1.5 flex items-center gap-1 truncate text-xs text-faint"><Clock size={13} className="shrink-0" /> <span className="truncate">{c.schedule}</span></div>}
                <div className="mt-auto flex items-center gap-1.5 pt-4">
                  <Button size="sm" variant="secondary" icon={ArrowUpRight} to={`/app/cursos/${c.id}`}>Abrir aula</Button>
                  <Button size="sm" variant="soft" icon={UserPlus} onClick={() => setEnrolling(c)} disabled={c.closed}>Matrícula</Button>
                  <div className="ml-auto flex">
                    <IconButton icon={Pencil} label="Editar curso" onClick={() => setEditing(c)} />
                    <IconButton icon={Trash2} label="Eliminar curso" onClick={() => remove(c)} disabled={c.closed} className={cx('hover:bg-danger-soft hover:text-danger', c.closed && 'opacity-30')} />
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <CourseFormModal
        open={editing != null}
        course={editing === 'new' ? null : editing}
        programs={programs.data || []}
        terms={terms.data || []}
        teachers={(teachers.data || []).filter((t) => t.active || (editing && editing !== 'new' && editing.teacher_id === t.id))}
        onClose={closeEditor}
        onSaved={onSaved}
      />
      <EnrollmentModal course={enrolling} onClose={closeEnroll} onChanged={reloadCourses} />
    </div>
  );
}

/* ---------------- Create / edit ---------------- */

function CourseFormModal({ open, course, programs, teachers, terms, onClose, onSaved }) {
  const { toast } = useUi();
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const isNew = !course;

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setForm(course
      ? {
        code: course.code || '', name: course.name || '', description: course.description || '',
        program_id: course.program_id ? String(course.program_id) : '', teacher_id: course.teacher_id ? String(course.teacher_id) : '',
        cycle: course.cycle ? String(course.cycle) : '', credits: String(course.credits ?? 3), schedule: course.schedule || '',
        module_name: course.module_name || '', course_type: course.course_type || 'especifica', hours_theory: String(course.hours_theory ?? 32), hours_practice: String(course.hours_practice ?? 32),
        term_id: course.term_id ? String(course.term_id) : '', min_grade: String(course.min_grade ?? 13), max_absence_pct: String(course.max_absence_pct ?? 30),
      }
      : { ...EMPTY_FORM, term_id: String(terms.find((t) => t.is_active)?.id || '') });
  }, [open, course, terms]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const setHours = (k) => (e) => setForm((f) => { const n = { ...f, [k]: e.target.value }; const c = creditsFor(n.hours_theory, n.hours_practice); return { ...n, credits: String(Math.max(1, Math.round(c))) }; });
  const suggested = creditsFor(form.hours_theory, form.hours_practice);

  const submit = async (ev) => {
    ev?.preventDefault();
    const e = {};
    if (!form.code.trim()) e.code = 'Ingresa el código';
    if (!form.name.trim()) e.name = 'Ingresa el nombre';
    const cr = Number(form.credits);
    if (!Number.isFinite(cr) || cr < 1 || cr > 10) e.credits = 'Entre 1 y 10';
    setErrors(e);
    if (Object.keys(e).length) return;
    setSaving(true);
    const payload = {
      code: form.code.trim().toUpperCase(),
      name: form.name.trim(),
      description: form.description.trim(),
      program_id: form.program_id ? Number(form.program_id) : null,
      teacher_id: form.teacher_id ? Number(form.teacher_id) : null,
      cycle: form.cycle ? Number(form.cycle) : null,
      credits: cr,
      schedule: form.schedule.trim(),
      module_name: form.module_name.trim(), course_type: form.course_type, hours_theory: Number(form.hours_theory) || 0, hours_practice: Number(form.hours_practice) || 0,
      term_id: form.term_id ? Number(form.term_id) : null, min_grade: Number(form.min_grade) || 13, max_absence_pct: Number(form.max_absence_pct) || 30,
    };
    try {
      if (isNew) await api.post('/admin/courses', payload);
      else await api.put(`/admin/courses/${course.id}`, payload);
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
      title={isNew ? 'Nuevo curso' : 'Editar curso'}
      description={isNew ? 'El curso se crea en el periodo académico activo.' : `${course?.code} · ${course?.name}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} loading={saving}>{isNew ? 'Crear curso' : 'Guardar cambios'}</Button>
        </>
      }
    >
      <form onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-6" noValidate>
        <Field label="Código" required error={errors.code} className="sm:col-span-2">
          <Input value={form.code} onChange={set('code')} placeholder="Ej. DSW301" className="font-mono uppercase" />
        </Field>
        <Field label="Nombre del curso" required error={errors.name} className="sm:col-span-4">
          <Input value={form.name} onChange={set('name')} placeholder="Ej. Desarrollo Web Full Stack" />
        </Field>
        <Field label="Descripción" className="sm:col-span-6">
          <Textarea rows={3} value={form.description} onChange={set('description')} placeholder="¿Qué aprenderán los estudiantes en este curso?" />
        </Field>
        <Field label="Carrera" className="sm:col-span-3">
          <Select value={form.program_id} onChange={set('program_id')}>
            <option value="">Transversal (sin carrera)</option>
            {programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </Field>
        <Field label="Docente" className="sm:col-span-3" hint={isNew ? 'El docente recibirá una notificación.' : undefined}>
          <Select value={form.teacher_id} onChange={set('teacher_id')}>
            <option value="">Sin asignar</option>
            {teachers.map((t) => <option key={t.id} value={t.id}>{fullName(t)}</option>)}
          </Select>
        </Field>
        <Field label="Módulo formativo" className="sm:col-span-3" hint="Según el plan de estudios (p. ej. Módulo II · Desarrollo de software).">
          <Input value={form.module_name} onChange={set('module_name')} placeholder="Módulo I · …" />
        </Field>
        <Field label="Tipo de unidad didáctica" className="sm:col-span-3">
          <Select value={form.course_type} onChange={set('course_type')}>{COURSE_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select>
        </Field>
        <Field label="Periodo académico" className="sm:col-span-2">
          <Select value={form.term_id} onChange={set('term_id')}>
            <option value="">Sin periodo</option>
            {terms.map((t) => <option key={t.id} value={t.id} disabled={!!t.closed_at}>{t.name}{t.is_active ? ' (activo)' : t.closed_at ? ' (cerrado)' : ''}</option>)}
          </Select>
        </Field>
        <Field label="Ciclo" className="sm:col-span-2">
          <Select value={form.cycle} onChange={set('cycle')}>
            <option value="">—</option>
            {[1, 2, 3, 4, 5, 6].map((c) => <option key={c} value={c}>Ciclo {ROMAN[c]}</option>)}
          </Select>
        </Field>
        <Field label="Horario" className="sm:col-span-2" hint="Texto libre que verán los estudiantes.">
          <Input value={form.schedule} onChange={set('schedule')} placeholder="Lun y Mié · 19:00 – 20:30" />
        </Field>
        <Field label="Horas teóricas" className="sm:col-span-2"><Input type="number" min={0} step={16} value={form.hours_theory} onChange={setHours('hours_theory')} /></Field>
        <Field label="Horas prácticas" className="sm:col-span-2"><Input type="number" min={0} step={32} value={form.hours_practice} onChange={setHours('hours_practice')} /></Field>
        <Field label="Créditos" error={errors.credits} className="sm:col-span-2" hint={`Sugerido: ${suggested} (16 h T o 32 h P = 1 crédito)`}>
          <Input type="number" min={1} max={10} value={form.credits} onChange={set('credits')} inputMode="numeric" />
        </Field>
        <Field label="Nota mínima aprobatoria" className="sm:col-span-3" hint="LAG: 13. Cambia solo si el reglamento institucional lo dispone."><Input type="number" min={0} max={20} value={form.min_grade} onChange={set('min_grade')} /></Field>
        <Field label="Límite de inasistencias (%)" className="sm:col-span-3" hint="LAG: más del 30 % desaprueba por inasistencia."><Input type="number" min={0} max={100} value={form.max_absence_pct} onChange={set('max_absence_pct')} /></Field>
        <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
      </form>
    </Modal>
  );
}

/* ---------------- Enrollment ---------------- */

function EnrollmentModal({ course, onClose, onChanged }) {
  const { toast } = useUi();
  const open = !!course;
  const [enrolled, setEnrolled] = useState(null);
  const [students, setStudents] = useState(null);
  const [error, setError] = useState(null);
  const [q, setQ] = useState('');
  const [sameProgram, setSameProgram] = useState(true);
  const [selected, setSelected] = useState(() => new Set());
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState(null);

  const load = useCallback(async () => {
    if (!course) return;
    setError(null);
    try {
      const [e, s] = await Promise.all([
        api.get(`/admin/courses/${course.id}/enrollments`),
        api.get('/admin/users?role=student'),
      ]);
      setEnrolled(e);
      setStudents(s);
    } catch (err) {
      setError(err.message);
    }
  }, [course]);

  useEffect(() => {
    if (!course) return;
    setEnrolled(null); setStudents(null); setQ(''); setSelected(new Set()); setSameProgram(!!course.program_id);
    load();
  }, [course, load]);

  const enrolledIds = useMemo(() => new Set((enrolled || []).map((u) => u.id)), [enrolled]);
  const candidates = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (students || []).filter((s) => {
      if (!s.active || enrolledIds.has(s.id)) return false;
      if (sameProgram && course?.program_id && s.program_id !== course.program_id) return false;
      if (!term) return true;
      return [fullName(s), s.email, s.code].some((v) => v?.toLowerCase().includes(term));
    });
  }, [students, enrolledIds, q, sameProgram, course]);

  const toggle = (id) => setSelected((prev) => {
    const n = new Set(prev);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });
  const allVisibleSelected = candidates.length > 0 && candidates.every((c) => selected.has(c.id));
  const toggleAll = () => setSelected((prev) => {
    const n = new Set(prev);
    if (allVisibleSelected) candidates.forEach((c) => n.delete(c.id));
    else candidates.forEach((c) => n.add(c.id));
    return n;
  });

  const add = async () => {
    if (!selected.size) return;
    setAdding(true);
    try {
      const r = await api.post(`/admin/courses/${course.id}/enrollments`, { user_ids: [...selected] });
      toast(r.added === 1 ? '1 estudiante matriculado' : `${r.added} estudiantes matriculados`);
      setSelected(new Set());
      const e = await api.get(`/admin/courses/${course.id}/enrollments`);
      setEnrolled(e);
      onChanged?.();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setAdding(false);
    }
  };

  const remove = async (u) => {
    setRemoving(u.id);
    try {
      await api.del(`/admin/courses/${course.id}/enrollments/${u.id}`);
      setEnrolled((list) => list.filter((x) => x.id !== u.id));
      toast(`${fullName(u)} fue retirado(a) del curso`);
      onChanged?.();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setRemoving(null);
    }
  };

  const loadingData = !error && (enrolled == null || students == null);

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title="Matrícula"
      description={course ? `${course.code} · ${course.name}` : ''}
      footer={
        <>
          <span className="mr-auto self-center text-xs text-muted">{selected.size > 0 && `${selected.size} seleccionado${selected.size === 1 ? '' : 's'}`}</span>
          <Button variant="ghost" onClick={onClose}>Cerrar</Button>
          <Button icon={UserPlus} onClick={add} loading={adding} disabled={!selected.size}>
            {selected.size ? `Matricular (${selected.size})` : 'Matricular'}
          </Button>
        </>
      }
    >
      {error ? (
        <ErrorState message={error} onRetry={load} />
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Enrolled */}
          <section className="min-w-0">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink">
              <Users size={16} className="text-primary" /> Matriculados
              {enrolled && <Badge>{enrolled.length}</Badge>}
            </h3>
            {loadingData ? (
              <div className="space-y-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-12" />)}</div>
            ) : enrolled.length === 0 ? (
              <div className="rounded-xl border border-dashed border-line-strong">
                <EmptyState compact icon={Users} title="Sin estudiantes matriculados" description="Selecciona estudiantes de la lista para matricularlos." />
              </div>
            ) : (
              <ul className="scrollbar-thin max-h-[46vh] divide-y divide-line overflow-y-auto rounded-xl border border-line">
                {enrolled.map((u) => (
                  <li key={u.id} className="flex items-center gap-3 px-3 py-2.5">
                    <Avatar user={u} size={32} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-ink">{fullName(u)}</div>
                      <div className="truncate text-xs text-muted"><span className="font-mono">{u.code}</span> · {u.email}</div>
                    </div>
                    <Button size="sm" variant="ghost" icon={removing === u.id ? undefined : UserMinus} loading={removing === u.id}
                      onClick={() => remove(u)} className="text-danger hover:bg-danger-soft" aria-label={`Retirar a ${fullName(u)}`}>
                      <span className="hidden sm:inline">Retirar</span>
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Candidates */}
          <section className="min-w-0">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink">
              <UserPlus size={16} className="text-primary" /> Agregar estudiantes
            </h3>
            <div className="relative mb-2.5">
              <Search size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-faint" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre, correo o código" className="pr-9 pl-9" />
              {q && (
                <button type="button" onClick={() => setQ('')} className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded-md p-1 text-faint hover:text-ink" aria-label="Limpiar búsqueda">
                  <X size={15} />
                </button>
              )}
            </div>
            <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
              {course?.program_id ? (
                <Switch checked={sameProgram} onChange={setSameProgram} label={`Solo de ${course.program?.short || 'la carrera del curso'}`} />
              ) : <span className="text-xs text-muted">Curso transversal · todas las carreras</span>}
              {candidates.length > 0 && (
                <button type="button" onClick={toggleAll} className="text-xs font-medium text-primary hover:underline">
                  {allVisibleSelected ? 'Quitar selección' : `Seleccionar ${candidates.length === 1 ? 'el visible' : `los ${candidates.length} visibles`}`}
                </button>
              )}
            </div>
            {loadingData ? (
              <div className="space-y-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-12" />)}</div>
            ) : candidates.length === 0 ? (
              <div className="rounded-xl border border-dashed border-line-strong">
                <EmptyState compact icon={Check}
                  title={q.trim() ? 'Sin coincidencias' : 'No hay más estudiantes por matricular'}
                  description={q.trim() ? 'Prueba con otro término de búsqueda.' : sameProgram && course?.program_id ? 'Desactiva el filtro de carrera para ver estudiantes de otras carreras.' : 'Todos los estudiantes activos ya están en este curso.'} />
              </div>
            ) : (
              <ul className="scrollbar-thin max-h-[46vh] divide-y divide-line overflow-y-auto rounded-xl border border-line">
                {candidates.map((s) => {
                  const on = selected.has(s.id);
                  return (
                    <li key={s.id}>
                      <label className={cx('flex cursor-pointer items-center gap-3 px-3 py-2.5 transition', on ? 'bg-primary-soft/60' : 'hover:bg-sunken')}>
                        <input type="checkbox" checked={on} onChange={() => toggle(s.id)} className="h-4 w-4 shrink-0 accent-[var(--c-primary)]" />
                        <Avatar user={s} size={30} />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium text-ink">{fullName(s)}</div>
                          <div className="truncate text-xs text-muted">
                            <span className="font-mono">{s.code}</span>
                            {s.program_short && ` · ${s.program_short}`}
                            {s.cycle && ` · Ciclo ${ROMAN[s.cycle] || s.cycle}`}
                          </div>
                        </div>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      )}
    </Modal>
  );
}
