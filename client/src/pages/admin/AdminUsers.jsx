import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Users, UserPlus, Search, Pencil, Power, X, Mail, KeyRound } from 'lucide-react';
import { api, useApi } from '../../lib/api.js';
import { useAuth, useUi } from '../../lib/context.jsx';
import { relative, fullName, ROLE_LABEL } from '../../lib/format.js';
import {
  Button, IconButton, Card, Badge, PageHeader, Field, Input, Select, Modal, Spinner, PageLoader, ErrorState, EmptyState, Avatar, Segmented, cx,
} from '../../components/ui.jsx';

const ROLE_TONE = { student: 'primary', teacher: 'info', admin: 'warn' };
const ROLE_FILTERS = [
  { value: '', label: 'Todos' },
  { value: 'student', label: 'Estudiantes' },
  { value: 'teacher', label: 'Docentes' },
  { value: 'admin', label: 'Admins' },
];
const CYCLES = [1, 2, 3, 4, 5, 6];
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

const EMPTY_FORM = { first_name: '', last_name: '', email: '', role: 'student', program_id: '', cycle: '1', title: '', password: '' };

function useDebounced(value, delay = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

function StatusBadge({ active }) {
  return active ? <Badge tone="success" dot>Activo</Badge> : <Badge tone="neutral" dot>Inactivo</Badge>;
}

export default function AdminUsers() {
  const { user: me } = useAuth();
  const { toast, confirm } = useUi();
  const [q, setQ] = useState('');
  const [role, setRole] = useState('');
  const dq = useDebounced(q.trim(), 300);

  const path = useMemo(() => {
    const p = new URLSearchParams();
    if (role) p.set('role', role);
    if (dq) p.set('q', dq);
    const s = p.toString();
    return `/admin/users${s ? `?${s}` : ''}`;
  }, [role, dq]);

  // Manual fetching keeps the previous rows visible while a new search loads.
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [fetching, setFetching] = useState(true);
  const reqId = useRef(0);
  const load = useCallback(async () => {
    const id = ++reqId.current;
    setFetching(true);
    try {
      const data = await api.get(path);
      if (id === reqId.current) { setRows(data); setError(null); }
    } catch (e) {
      if (id === reqId.current) setError(e.message);
    } finally {
      if (id === reqId.current) setFetching(false);
    }
  }, [path]);
  useEffect(() => { load(); }, [load]);

  const programs = useApi('/admin/programs');

  const [editing, setEditing] = useState(null); // null | 'new' | user
  const [busyId, setBusyId] = useState(null);

  const toggleActive = async (u) => {
    if (u.active) {
      const ok = await confirm({
        title: '¿Desactivar usuario?',
        message: `${fullName(u)} no podrá iniciar sesión en el aula virtual hasta que vuelvas a activar su cuenta. Sus cursos, entregas y calificaciones se conservan.`,
        confirmText: 'Desactivar',
        danger: true,
      });
      if (!ok) return;
    }
    setBusyId(u.id);
    try {
      const updated = await api.put(`/admin/users/${u.id}`, { active: !u.active });
      setRows((list) => list.map((x) => (x.id === u.id ? { ...x, ...updated } : x)));
      toast(updated.active ? `${fullName(u)} fue activado(a)` : `${fullName(u)} fue desactivado(a)`);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusyId(null);
    }
  };

  const closeEditor = useCallback(() => setEditing(null), []);
  const onSaved = useCallback((saved, isNew) => {
    setEditing(null);
    toast(isNew ? `Usuario creado · código ${saved.code}` : 'Cambios guardados');
    load();
  }, [toast, load]);

  const actions = (u) => {
    const self = u.id === me?.id;
    return (
      <div className="flex items-center justify-end gap-0.5">
        <IconButton icon={Pencil} label="Editar" onClick={() => setEditing(u)} />
        <IconButton
          icon={Power}
          label={self ? 'No puedes desactivar tu propia cuenta' : u.active ? 'Desactivar' : 'Activar'}
          onClick={() => toggleActive(u)}
          disabled={self || busyId === u.id}
          className={cx(self && 'cursor-not-allowed opacity-40 hover:bg-transparent', u.active ? 'hover:text-danger' : 'text-success hover:text-success')}
        />
      </div>
    );
  };

  return (
    <div className="animate-fade-up">
      <PageHeader
        eyebrow="Administración"
        title="Usuarios"
        subtitle="Gestiona las cuentas de estudiantes, docentes y administradores del aula virtual."
        actions={<Button icon={UserPlus} onClick={() => setEditing('new')}>Crear usuario</Button>}
      />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full lg:max-w-sm">
          <Search size={17} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-faint" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre, correo o código" className="pr-9 pl-9" aria-label="Buscar usuarios" />
          {q && (
            <button type="button" onClick={() => setQ('')} className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded-md p-1 text-faint hover:text-ink" aria-label="Limpiar búsqueda">
              <X size={15} />
            </button>
          )}
        </div>
        <div className="no-scrollbar -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <Segmented value={role} onChange={setRole} options={ROLE_FILTERS} />
        </div>
      </div>

      {rows == null && error ? (
        <ErrorState message={error} onRetry={load} />
      ) : rows == null ? (
        <PageLoader />
      ) : (
        <>
          <div className="mb-2 flex h-5 items-center gap-2 text-xs text-muted">
            {fetching ? <><Spinner size={14} /> Buscando…</> : <span>{rows.length === 500 ? 'Mostrando los primeros 500 resultados' : `${rows.length} ${rows.length === 1 ? 'usuario' : 'usuarios'}`}</span>}
            {error && !fetching && <span className="text-danger">· {error}</span>}
          </div>

          {rows.length === 0 ? (
            <Card>
              <EmptyState
                icon={Users}
                title={dq || role ? 'No encontramos usuarios' : 'Aún no hay usuarios'}
                description={dq ? `No hay resultados para “${dq}”. Prueba con otro nombre, correo o código.` : 'Crea la primera cuenta para empezar.'}
                action={dq || role
                  ? <Button variant="secondary" size="sm" onClick={() => { setQ(''); setRole(''); }}>Limpiar filtros</Button>
                  : <Button size="sm" icon={UserPlus} onClick={() => setEditing('new')}>Crear usuario</Button>}
              />
            </Card>
          ) : (
            <div className={cx('transition-opacity', fetching && 'opacity-60')}>
              {/* Desktop table */}
              <Card className="hidden overflow-hidden md:block">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[860px] text-sm">
                    <thead>
                      <tr className="border-b border-line bg-sunken/60 text-left text-xs font-medium tracking-wide text-muted uppercase">
                        <th className="px-4 py-3 font-medium">Usuario</th>
                        <th className="px-4 py-3 font-medium">Código</th>
                        <th className="px-4 py-3 font-medium">Rol</th>
                        <th className="px-4 py-3 font-medium">Carrera</th>
                        <th className="px-4 py-3 font-medium">Último ingreso</th>
                        <th className="px-4 py-3 font-medium">Estado</th>
                        <th className="px-4 py-3"><span className="sr-only">Acciones</span></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {rows.map((u) => (
                        <tr key={u.id} className={cx('transition hover:bg-sunken/50', !u.active && 'text-muted')}>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <Avatar user={u} size={34} className={cx(!u.active && 'opacity-50')} />
                              <div className="min-w-0">
                                <div className="truncate font-medium text-ink">
                                  {fullName(u)}
                                  {u.id === me?.id && <span className="ml-1.5 text-xs font-normal text-faint">(tú)</span>}
                                </div>
                                <div className="truncate text-xs text-muted">{u.email}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 font-mono text-[13px] text-ink-2">{u.code || '—'}</td>
                          <td className="px-4 py-3"><Badge tone={ROLE_TONE[u.role]}>{ROLE_LABEL[u.role]}</Badge></td>
                          <td className="px-4 py-3 text-ink-2">
                            {u.program_short || <span className="text-faint">—</span>}
                            {u.role === 'student' && u.cycle && <span className="ml-1 text-xs text-faint">· Ciclo {ROMAN[u.cycle] || u.cycle}</span>}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-muted">{u.last_login ? relative(u.last_login) : <span className="text-faint">Nunca</span>}</td>
                          <td className="px-4 py-3"><StatusBadge active={u.active} /></td>
                          <td className="px-3 py-2">{actions(u)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>

              {/* Mobile cards */}
              <ul className="flex flex-col gap-2.5 md:hidden">
                {rows.map((u) => (
                  <li key={u.id}>
                    <Card className="p-4">
                      <div className="flex items-start gap-3">
                        <Avatar user={u} size={40} className={cx(!u.active && 'opacity-50')} />
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium text-ink">{fullName(u)}{u.id === me?.id && <span className="ml-1.5 text-xs font-normal text-faint">(tú)</span>}</div>
                          <div className="truncate text-xs text-muted">{u.email}</div>
                          <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            <Badge tone={ROLE_TONE[u.role]}>{ROLE_LABEL[u.role]}</Badge>
                            <StatusBadge active={u.active} />
                            {u.program_short && <Badge>{u.program_short}{u.role === 'student' && u.cycle ? ` · Ciclo ${ROMAN[u.cycle] || u.cycle}` : ''}</Badge>}
                          </div>
                          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-faint">
                            <span className="font-mono">{u.code || '—'}</span>
                            <span>Último ingreso: {u.last_login ? relative(u.last_login) : 'nunca'}</span>
                          </div>
                        </div>
                        <div className="-mt-1 -mr-1.5">{actions(u)}</div>
                      </div>
                    </Card>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      <UserFormModal
        open={editing != null}
        user={editing === 'new' ? null : editing}
        isSelf={editing && editing !== 'new' && editing.id === me?.id}
        programs={programs.data || []}
        onClose={closeEditor}
        onSaved={onSaved}
      />
    </div>
  );
}

function UserFormModal({ open, user, isSelf, programs, onClose, onSaved }) {
  const { toast } = useUi();
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const isNew = !user;

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setForm(user
      ? {
        first_name: user.first_name || '', last_name: user.last_name || '', email: user.email || '', role: user.role,
        program_id: user.program_id ? String(user.program_id) : '', cycle: user.cycle ? String(user.cycle) : '1', title: user.title || '', password: '',
      }
      : EMPTY_FORM);
  }, [open, user]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const validate = () => {
    const e = {};
    if (!form.first_name.trim()) e.first_name = 'Ingresa los nombres';
    if (!form.last_name.trim()) e.last_name = 'Ingresa los apellidos';
    if (!form.email.trim()) e.email = 'Ingresa el correo';
    else if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) e.email = 'Ingresa un correo válido';
    if (form.password && form.password.length < 8) e.password = 'Debe tener al menos 8 caracteres';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (ev) => {
    ev?.preventDefault();
    if (!validate()) return;
    setSaving(true);
    const payload = {
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      email: form.email.trim().toLowerCase(),
      role: form.role,
      program_id: form.role !== 'admin' && form.program_id ? Number(form.program_id) : null,
      cycle: form.role === 'student' && form.cycle ? Number(form.cycle) : null,
    };
    if (form.role === 'teacher') payload.title = form.title.trim();
    else if (isNew) payload.title = null;
    if (form.password) payload.password = form.password;
    try {
      const saved = isNew ? await api.post('/admin/users', payload) : await api.put(`/admin/users/${user.id}`, payload);
      onSaved(saved, isNew);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isNew ? 'Crear usuario' : 'Editar usuario'}
      description={isNew ? 'Se generará un código institucional automáticamente y el usuario recibirá un mensaje de bienvenida.' : `${user?.code || ''} · ${user?.email || ''}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} loading={saving} icon={isNew ? UserPlus : undefined}>{isNew ? 'Crear usuario' : 'Guardar cambios'}</Button>
        </>
      }
    >
      <form onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2" noValidate>
        <Field label="Nombres" required error={errors.first_name}>
          <Input value={form.first_name} onChange={set('first_name')} autoComplete="off" />
        </Field>
        <Field label="Apellidos" required error={errors.last_name}>
          <Input value={form.last_name} onChange={set('last_name')} autoComplete="off" />
        </Field>
        <Field label="Correo electrónico" required error={errors.email} className="sm:col-span-2">
          <div className="relative">
            <Mail size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-faint" />
            <Input type="email" value={form.email} onChange={set('email')} placeholder="nombre@isup.edu.pe" className="pl-9" autoComplete="off" />
          </div>
        </Field>
        <Field label="Rol" required hint={isSelf ? 'No puedes cambiar el rol de tu propia cuenta.' : undefined}>
          <Select value={form.role} onChange={set('role')} disabled={isSelf}>
            <option value="student">Estudiante</option>
            <option value="teacher">Docente</option>
            <option value="admin">Administrador(a)</option>
          </Select>
        </Field>
        {form.role !== 'admin' ? (
          <Field label={form.role === 'teacher' ? 'Carrera (área)' : 'Carrera'}>
            <Select value={form.program_id} onChange={set('program_id')}>
              <option value="">{form.role === 'teacher' ? 'Sin carrera asignada' : 'Selecciona una carrera'}</option>
              {programs.map((p) => <option key={p.id} value={p.id}>{p.name}{p.active ? '' : ' (inactiva)'}</option>)}
            </Select>
          </Field>
        ) : <div className="hidden sm:block" />}
        {form.role === 'student' && (
          <Field label="Ciclo">
            <Select value={form.cycle} onChange={set('cycle')}>
              {CYCLES.map((c) => <option key={c} value={c}>Ciclo {ROMAN[c]}</option>)}
            </Select>
          </Field>
        )}
        {form.role === 'teacher' && (
          <Field label="Título o especialidad" hint="Se muestra junto al nombre del docente en sus cursos." className="sm:col-span-2">
            <Input value={form.title} onChange={set('title')} placeholder="Ej. Ing. de Sistemas · Mg. en Ciencia de Datos" />
          </Field>
        )}
        <Field
          label={isNew ? 'Contraseña inicial' : 'Nueva contraseña'}
          error={errors.password}
          hint={isNew
            ? 'Opcional. Si la dejas en blanco se asignará la contraseña demo configurada en el servidor.'
            : 'Dejar en blanco para no cambiar.'}
          className={form.role === 'student' ? '' : 'sm:col-span-2'}
        >
          <div className="relative">
            <KeyRound size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-faint" />
            <Input type="password" value={form.password} onChange={set('password')} placeholder="Mínimo 8 caracteres" className="pl-9" autoComplete="new-password" />
          </div>
        </Field>
        <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
      </form>
    </Modal>
  );
}
