import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import ErrorBoundary from '../components/ErrorBoundary.jsx';
import {
  Home, BookOpen, CalendarDays, GraduationCap, Bell, LifeBuoy, Search, Menu, X, Moon, Sun, LogOut, User, ChevronDown, ShieldCheck,
  LayoutDashboard, Users, Library, Layers, UserPlus, Headset, Megaphone, ClipboardList, ListChecks, MessagesSquare, FileText, CornerDownLeft, UserCheck, FileCheck2, ScrollText,
} from 'lucide-react';
import { useAuth, useTheme } from '../lib/context.jsx';
import { api } from '../lib/api.js';
import { Avatar, Dropdown, MenuItem, IconButton, cx, Spinner, useClickOutside, Modal, Button } from '../components/ui.jsx';
import { Logo, ITEM_META } from '../components/brand.jsx';
import { fullName, relative, ROLE_LABEL } from '../lib/format.js';

/* Shared "my courses" + notifications state for the whole app shell */
const ShellCtx = createContext(null);
export const useShell = () => useContext(ShellCtx);

const NAV = {
  student: [
    { to: '/app', label: 'Inicio', icon: Home, end: true },
    { to: '/app/cursos', label: 'Mis cursos', icon: BookOpen },
    { to: '/app/calendario', label: 'Calendario', icon: CalendarDays },
    { to: '/app/calificaciones', label: 'Calificaciones y récord', icon: GraduationCap },
    { to: '/app/notificaciones', label: 'Notificaciones', icon: Bell, badge: 'notif' },
    { to: '/app/ayuda', label: 'Ayuda y soporte', icon: LifeBuoy },
  ],
  teacher: [
    { to: '/app', label: 'Inicio', icon: Home, end: true },
    { to: '/app/cursos', label: 'Mis cursos', icon: BookOpen },
    { to: '/app/calendario', label: 'Calendario', icon: CalendarDays },
    { to: '/app/notificaciones', label: 'Notificaciones', icon: Bell, badge: 'notif' },
    { to: '/app/ayuda', label: 'Ayuda y soporte', icon: LifeBuoy },
  ],
  admin: [
    { to: '/app/admin', label: 'Panel general', icon: LayoutDashboard, end: true },
    { to: '/app/admin/academico', label: 'Gestión académica', icon: FileCheck2 },
    { to: '/app/admin/usuarios', label: 'Usuarios', icon: Users },
    { to: '/app/admin/cursos', label: 'Cursos y matrícula', icon: Library },
    { to: '/app/admin/carreras', label: 'Programas de estudio', icon: Layers },
    { to: '/app/admin/postulantes', label: 'Postulantes', icon: UserPlus },
    { to: '/app/admin/soporte', label: 'Soporte', icon: Headset },
    { to: '/app/admin/comunicados', label: 'Comunicados', icon: Megaphone },
    { to: '/app/admin/auditoria', label: 'Auditoría', icon: ScrollText },
    { to: '/app/calendario', label: 'Calendario', icon: CalendarDays },
    { to: '/app/notificaciones', label: 'Notificaciones', icon: Bell, badge: 'notif' },
  ],
};

export default function AppLayout() {
  const { user, logout } = useAuth();
  const [courses, setCourses] = useState(null);
  const [notif, setNotif] = useState({ items: [], unread: 0 });
  const [drawer, setDrawer] = useState(false);
  const [palette, setPalette] = useState(false);
  const loc = useLocation();

  const loadCourses = useCallback(() => {
    if (user.role === 'admin') return setCourses([]);
    api.get('/courses').then(setCourses).catch(() => setCourses([]));
  }, [user.role]);
  const loadNotif = useCallback(() => api.get('/notifications').then(setNotif).catch(() => {}), []);

  useEffect(() => { loadCourses(); loadNotif(); }, [loadCourses, loadNotif]);
  useEffect(() => { const t = setInterval(loadNotif, 45000); return () => clearInterval(t); }, [loadNotif]);
  useEffect(() => { setDrawer(false); window.scrollTo({ top: 0 }); }, [loc.pathname]);
  useEffect(() => {
    const k = (e) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPalette((p) => !p); } };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, []);

  const shell = { courses, reloadCourses: loadCourses, notif, reloadNotif: loadNotif, setNotif };
  const termName = courses?.find((c) => c.term?.is_active)?.term?.name;
  const needsConsent = user.consent_required && user.consent_version !== user.consent_required;

  return (
    <ShellCtx.Provider value={shell}>
      <div className="min-h-dvh bg-bg">
        <a href="#contenido-app" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2">Saltar al contenido</a>
        {/* Sidebar */}
        <aside className={cx(
          'fixed inset-y-0 left-0 z-50 flex w-[272px] flex-col border-r border-line bg-sunken/70 backdrop-blur-xl transition-transform duration-300 lg:translate-x-0 lg:bg-sunken/60 print:hidden',
          drawer ? 'translate-x-0 bg-sunken shadow-lift' : '-translate-x-full'
        )}>
          <div className="flex h-16 items-center justify-between px-5">
            <Logo to="/app" compact />
            <IconButton icon={X} label="Cerrar menú" className="lg:hidden" onClick={() => setDrawer(false)} />
          </div>
          <nav className="scrollbar-thin flex-1 overflow-y-auto px-3 pb-4" aria-label="Menú principal">
            <ul className="space-y-0.5">
              {NAV[user.role].map((n) => (
                <li key={n.to}>
                  <NavLink to={n.to} end={n.end} className={({ isActive }) => cx(
                    'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-medium transition',
                    isActive ? 'bg-surface text-ink shadow-soft' : 'text-ink-2 hover:bg-surface/60 hover:text-ink'
                  )}>
                    {({ isActive }) => (
                      <>
                        <n.icon size={18} className={isActive ? 'text-primary' : 'text-muted group-hover:text-ink-2'} />
                        <span className="flex-1">{n.label}</span>
                        {n.badge === 'notif' && notif.unread > 0 && (
                          <span className="rounded-full bg-primary px-1.5 py-px text-[11px] font-semibold text-white tabular-nums">{notif.unread}</span>
                        )}
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
            {user.role !== 'admin' && (
              <div className="mt-6">
                <div className="mb-2 px-3 text-[11px] font-semibold tracking-[0.1em] text-faint uppercase">{termName ? `Periodo ${termName}` : 'Cursos del periodo'}</div>
                <ul className="space-y-0.5">
                  {courses == null && [1, 2, 3].map((i) => <li key={i} className="skeleton mx-3 my-2 h-5" />)}
                  {courses?.map((c) => (
                    <li key={c.id}>
                      <NavLink to={`/app/cursos/${c.id}`} className={({ isActive }) => cx(
                        'flex items-center gap-3 rounded-xl px-3 py-2 text-[13.5px] transition',
                        isActive ? 'bg-surface text-ink shadow-soft' : 'text-ink-2 hover:bg-surface/60'
                      )}>
                        <span className="h-2.5 w-2.5 shrink-0 rounded-[4px]" style={{ background: c.color }} />
                        <span className="truncate">{c.name}</span>
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </nav>
          <div className="border-t border-line p-3">
            <Link to="/app/perfil" className="flex items-center gap-3 rounded-xl p-2 transition hover:bg-surface/70">
              <Avatar user={user} size={36} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-ink">{fullName(user)}</div>
                <div className="truncate text-xs text-muted">{ROLE_LABEL[user.role]}{user.code ? ` · ${user.code}` : ''}</div>
              </div>
            </Link>
          </div>
        </aside>
        {drawer && <div className="animate-fade-in fixed inset-0 z-40 bg-[#141413]/40 lg:hidden" onClick={() => setDrawer(false)} />}

        {/* Main */}
        <div className="lg:pl-[272px] print:pl-0">
          <header className="sticky top-0 z-30 border-b border-line/70 bg-bg/80 backdrop-blur-xl print:hidden">
            <div className="mx-auto flex h-16 max-w-[1320px] items-center gap-2 px-4 sm:px-6 lg:px-8">
              <IconButton icon={Menu} label="Abrir menú" className="-ml-2 lg:hidden" onClick={() => setDrawer(true)} />
              <button onClick={() => setPalette(true)}
                className="flex h-10 max-w-md min-w-0 flex-1 items-center gap-2.5 rounded-xl border border-line bg-surface px-3 text-left text-sm text-faint transition hover:border-line-strong">
                <Search size={16} />
                <span className="flex-1 truncate">Buscar cursos, lecturas, tareas…</span>
                <kbd className="hidden rounded-md border border-line bg-sunken px-1.5 py-0.5 font-sans text-[11px] text-muted sm:block">⌘K</kbd>
              </button>
              <div className="ml-auto flex items-center gap-1">
                <ThemeToggle />
                <NotificationsMenu />
                <Dropdown width="w-64" trigger={({ toggle, open }) => (
                  <button onClick={toggle} className={cx('flex items-center gap-1.5 rounded-xl p-1 pr-2 transition hover:bg-sunken', open && 'bg-sunken')} aria-label="Menú de usuario">
                    <Avatar user={user} size={32} />
                    <ChevronDown size={15} className="hidden text-muted sm:block" />
                  </button>
                )}>
                  <div className="px-2.5 py-2">
                    <div className="text-sm font-semibold text-ink">{fullName(user)}</div>
                    <div className="truncate text-xs text-muted">{user.email}</div>
                  </div>
                  <div className="my-1 h-px bg-line" />
                  <MenuItem icon={User} to="/app/perfil">Mi perfil</MenuItem>
                  <MenuItem icon={LifeBuoy} to="/app/ayuda">Ayuda y soporte</MenuItem>
                  <MenuItem icon={ShieldCheck} to="/privacidad">Privacidad y condiciones</MenuItem>
                  <MenuItem icon={Home} to="/">Ir a la web de ISUP</MenuItem>
                  <div className="my-1 h-px bg-line" />
                  <MenuItem icon={LogOut} onClick={() => { api.post('/auth/logout').catch(() => {}); logout(); }} danger>Cerrar sesión</MenuItem>
                </Dropdown>
              </div>
            </div>
          </header>
          <main id="contenido-app" className="mx-auto max-w-[1320px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8 print:max-w-none print:p-0">
            <ErrorBoundary><Outlet /></ErrorBoundary>
          </main>
        </div>
        {palette && <CommandPalette onClose={() => setPalette(false)} />}
        {needsConsent && <ConsentModal />}
      </div>
    </ShellCtx.Provider>
  );
}

/** Aceptación de la política de privacidad (Ley N.° 29733) en el primer ingreso o al cambiar la versión. */
function ConsentModal() {
  const { user, setUser } = useAuth();
  const [checked, setChecked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const accept = async () => {
    setSaving(true); setError('');
    try { const r = await api.put('/auth/consent', { accept: true }); setUser(r.user); } catch (e) { setError(e.message); setSaving(false); }
  };
  return (
    <Modal open onClose={() => {}} size="md" title="Tratamiento de datos personales"
      description={`Antes de continuar, ${user.first_name}, necesitamos tu autorización.`}
      footer={<Button onClick={accept} loading={saving} disabled={!checked} icon={ShieldCheck}>Acepto y continúo</Button>}>
      <div className="space-y-4 text-sm leading-relaxed text-ink-2">
        <p>El Aula Virtual ISUP registra tus datos de identificación, tu actividad académica (asistencia, entregas, calificaciones) y tus accesos para gestionar tu formación, emitir constancias y cumplir con las obligaciones de información ante el Ministerio de Educación.</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Tus datos se tratan conforme a la <strong className="text-ink">Ley N.° 29733, Ley de Protección de Datos Personales</strong>, y su reglamento.</li>
          <li>No se comparten con terceros con fines comerciales. Puedes ejercer tus derechos de acceso, rectificación, cancelación y oposición desde “Ayuda y soporte”.</li>
          <li>Las sesiones en vivo pueden grabarse con fines académicos.</li>
        </ul>
        <p>Lee la <Link to="/privacidad" target="_blank" className="font-medium text-primary-ink underline">política de privacidad y condiciones de uso</Link> completa (versión {user.consent_required}).</p>
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-sunken p-3">
          <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--c-primary)]" />
          <span>He leído la política y <strong className="text-ink">autorizo el tratamiento de mis datos personales</strong> para las finalidades descritas.</span>
        </label>
        {error && <div className="rounded-xl bg-danger-soft px-3 py-2 text-danger">{error}</div>}
      </div>
    </Modal>
  );
}

function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return <IconButton icon={theme === 'dark' ? Sun : Moon} label={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'} onClick={toggle} />;
}

const NOTIF_ICON = { grade: GraduationCap, announcement: Megaphone, assignment: ClipboardList, quiz: ListChecks, forum: MessagesSquare, session: CalendarDays, content: FileText, submission: ClipboardList, ticket: Headset, attendance: UserCheck };

export function NotifIcon({ type }) {
  const Icon = NOTIF_ICON[type] || Bell;
  return <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary"><Icon size={16} /></span>;
}

function NotificationsMenu() {
  const { notif, setNotif } = useShell();
  const nav = useNavigate();
  const open = async (n, close) => {
    close();
    if (!n.read_at) {
      api.post(`/notifications/${n.id}/read`).catch(() => {});
      setNotif((s) => ({ unread: Math.max(0, s.unread - 1), items: s.items.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)) }));
    }
    if (n.link) nav(n.link);
  };
  const readAll = async () => {
    await api.post('/notifications/read-all');
    setNotif((s) => ({ unread: 0, items: s.items.map((x) => ({ ...x, read_at: x.read_at || new Date().toISOString() })) }));
  };
  return (
    <Dropdown width="w-[min(92vw,380px)]" trigger={({ toggle }) => (
      <button onClick={toggle} className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted transition hover:bg-sunken hover:text-ink" aria-label="Notificaciones">
        <Bell size={18} />
        {notif.unread > 0 && <span className="absolute top-1.5 right-1.5 h-2.5 w-2.5 rounded-full border-2 border-bg bg-primary" />}
      </button>
    )}>
      {({ close }) => (
        <>
          <div className="flex items-center justify-between px-2.5 py-2">
            <span className="text-sm font-semibold text-ink">Notificaciones</span>
            {notif.unread > 0 && <button onClick={readAll} className="text-xs font-medium text-primary hover:underline">Marcar todo como leído</button>}
          </div>
          <div className="scrollbar-thin max-h-[60vh] overflow-y-auto">
            {notif.items.length === 0 && <div className="px-3 py-8 text-center text-sm text-muted">No tienes notificaciones.</div>}
            {notif.items.slice(0, 8).map((n) => (
              <button key={n.id} onClick={() => open(n, close)} className="flex w-full items-start gap-3 rounded-lg px-2.5 py-2.5 text-left transition hover:bg-sunken">
                <NotifIcon type={n.type} />
                <div className="min-w-0 flex-1">
                  <div className={cx('text-[13.5px] leading-snug', n.read_at ? 'text-ink-2' : 'font-semibold text-ink')}>{n.title}</div>
                  {n.body && <div className="truncate text-xs text-muted">{n.body}</div>}
                  <div className="mt-0.5 text-[11px] text-faint">{relative(n.created_at)}</div>
                </div>
                {!n.read_at && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />}
              </button>
            ))}
          </div>
          <div className="mt-1 border-t border-line pt-1">
            <MenuItem to="/app/notificaciones">Ver todas las notificaciones</MenuItem>
          </div>
        </>
      )}
    </Dropdown>
  );
}

const RESULT_META = {
  course: { icon: BookOpen, label: 'Curso' },
  item: { icon: FileText, label: 'Material' },
  assignment: { icon: ITEM_META.assignment.icon, label: 'Tarea' },
  quiz: { icon: ITEM_META.quiz.icon, label: 'Evaluación' },
  thread: { icon: MessagesSquare, label: 'Foro' },
  page: { icon: CornerDownLeft, label: 'Ir a' },
};

function CommandPalette({ onClose }) {
  const { user } = useAuth();
  const { courses } = useShell();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const box = useRef(null);
  useClickOutside(box, onClose);

  const pages = NAV[user.role].map((n) => ({ id: n.to, title: n.label, link: n.to, type: 'page' }));
  const courseResults = (courses || []).map((c) => ({ id: `c${c.id}`, title: c.name, subtitle: c.code, link: `/app/cursos/${c.id}`, type: 'course' }));

  useEffect(() => {
    if (q.trim().length < 2) { setResults([]); return; }
    setLoading(true);
    const t = setTimeout(() => {
      api.get(`/search?q=${encodeURIComponent(q.trim())}`).then(setResults).catch(() => setResults([])).finally(() => setLoading(false));
    }, 200);
    return () => clearTimeout(t);
  }, [q]);

  const list = q.trim().length < 2 ? [...pages, ...courseResults] : results;
  useEffect(() => setActive(0), [q, results.length]);

  const go = (r) => { onClose(); nav(r.link); };
  const onKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(list.length - 1, a + 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    if (e.key === 'Enter' && list[active]) go(list[active]);
    if (e.key === 'Escape') onClose();
  };

  return (
    <div className="fixed inset-0 z-[95] flex items-start justify-center bg-[#141413]/40 px-4 pt-[12vh] backdrop-blur-[2px]">
      <div ref={box} className="animate-scale-in w-full max-w-xl overflow-hidden rounded-2xl border border-line bg-surface shadow-lift">
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Search size={18} className="text-muted" />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey} placeholder="¿Qué estás buscando?"
            className="h-14 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-faint" />
          {loading && <Spinner size={16} />}
        </div>
        <ul className="scrollbar-thin max-h-[50vh] overflow-y-auto p-2">
          {list.length === 0 && <li className="px-3 py-8 text-center text-sm text-muted">{loading ? 'Buscando…' : 'Sin resultados. Prueba con otra palabra.'}</li>}
          {list.map((r, i) => {
            const m = RESULT_META[r.type] || RESULT_META.page;
            return (
              <li key={`${r.type}-${r.id}`}>
                <button onMouseEnter={() => setActive(i)} onClick={() => go(r)}
                  className={cx('flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left', i === active ? 'bg-sunken' : '')}>
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-soft text-primary"><m.icon size={16} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-ink">{r.title}</span>
                    {r.subtitle && <span className="block truncate text-xs text-muted">{r.subtitle}</span>}
                  </span>
                  <span className="text-[11px] text-faint">{m.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
        <div className="flex items-center gap-4 border-t border-line bg-sunken/60 px-4 py-2 text-[11px] text-faint">
          <span>↑↓ navegar</span><span>↵ abrir</span><span>esc cerrar</span>
        </div>
      </div>
    </div>
  );
}
