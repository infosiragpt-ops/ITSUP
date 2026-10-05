import { Link } from 'react-router-dom';
import {
  Video, GraduationCap, Gauge, ClipboardList, BookOpen, ArrowRight, PlayCircle, Megaphone, CalendarDays, Users, ClipboardCheck,
  MessagesSquare, CheckCircle2, Circle, Wifi, Globe, Headphones, UserRound, FileText, X, Sparkles, PartyPopper, UserCheck, AlertTriangle, ShieldAlert,
} from 'lucide-react';
import { useApi, api } from '../../lib/api.js';
import { useAuth, useUi } from '../../lib/context.jsx';
import { Avatar, Badge, Button, Card, EmptyState, ErrorState, SectionTitle, Stat, Skeleton, ProgressBar, cx } from '../../components/ui.jsx';
import { CourseCard, SessionRow, ActivityRow, joinSession } from '../../components/lms.jsx';
import { ITEM_META } from '../../components/brand.jsx';
import Markdown from '../../components/Markdown.jsx';
import { fmtLong, greeting, relative, fullName, sessionState, fmtTime, fmtGrade, fmtPct, fmtShort } from '../../lib/format.js';

export default function Dashboard() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useApi('/dashboard');
  if (error) return <ErrorState message={error} onRetry={reload} />;

  const live = data?.sessions.find((s) => ['live', 'soon'].includes(sessionState(s)));
  const isStudent = user.role === 'student';

  return (
    <div className="animate-fade-up space-y-6">
      <div className="flex flex-col gap-1">
        <div className="text-sm text-muted">{fmtLong(new Date())}</div>
        <h1 className="font-display text-[2rem] leading-tight font-semibold text-ink sm:text-[2.4rem]">
          {greeting()}, {user.first_name}
        </h1>
        <p className="text-[15px] text-muted">
          {loading ? 'Preparando tu resumen…' : isStudent
            ? data.stats.pending ? `Tienes ${data.stats.pending} ${data.stats.pending === 1 ? 'actividad pendiente' : 'actividades pendientes'} en las próximas semanas.` : 'Estás al día con tus actividades. ¡Excelente!'
            : data.stats.to_grade ? `Tienes ${data.stats.to_grade} entregas esperando tu calificación.` : 'No tienes entregas pendientes de calificar.'}
        </p>
      </div>

      {live && <LiveBanner s={live} teacher={!isStudent} />}
      {isStudent && !user.onboarding?.done && <Onboarding />}

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-[82px] rounded-2xl" />)}</div>
      ) : isStudent ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat icon={GraduationCap} label="Promedio general" value={fmtGrade(data.stats.average)} hint="Escala vigesimal (0–20)" tone="success" />
          <Stat icon={Gauge} label="Avance del ciclo" value={`${data.stats.progress}%`} hint="Contenido completado" />
          <Stat icon={ClipboardList} label="Pendientes" value={data.stats.pending} hint="Tareas y evaluaciones" tone="warn" />
          <Stat icon={UserCheck} label="Asistencia" value={fmtPct(data.stats.attendance)} hint="Límite: 30% de inasistencias" tone="info" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat icon={BookOpen} label="Cursos a cargo" value={data.stats.courses} hint={`${data.stats.students} estudiantes`} tone="info" />
          <Stat icon={ClipboardCheck} label="Por calificar" value={data.stats.to_grade} tone="warn" />
          <Stat icon={UserCheck} label="Asistencia por registrar" value={data.stats.attendance_pending} hint="Sesiones finalizadas" tone={data.stats.attendance_pending ? 'warn' : 'success'} />
          <Stat icon={ShieldAlert} label="Estudiantes en riesgo" value={data.stats.at_risk} hint="Alerta temprana" tone={data.stats.at_risk ? 'warn' : 'success'} />
        </div>
      )}
      {isStudent && data?.alerts?.length > 0 && <StudentAlerts alerts={data.alerts} />}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-6">
          {isStudent && data?.continue && <ContinueCard item={data.continue} />}
          {!isStudent && data && <AtRisk list={data.at_risk} pending={data.attendance_pending} />}
          {!isStudent && data && <ToGrade list={data.to_grade} />}
          <div>
            <SectionTitle title={isStudent ? 'Mis cursos' : 'Mis cursos a cargo'} icon={BookOpen} action={<Link to="/app/cursos" className="text-sm font-medium text-primary-ink hover:underline">Ver todos</Link>} />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-3">
              {loading ? [1, 2, 3].map((i) => <Skeleton key={i} className="h-60 rounded-2xl" />) : data.courses.map((c) => <CourseCard key={c.id} c={c} role={user.role} />)}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {isStudent && (
            <Card className="p-5">
              <SectionTitle title="Próximas entregas" icon={ClipboardList} action={<Link to="/app/calendario" className="text-xs font-medium text-primary-ink hover:underline">Calendario</Link>} />
              {loading ? <Skeleton className="h-32" /> : data.upcoming.length === 0 ? (
                <EmptyState compact icon={PartyPopper} title="¡Nada pendiente!" description="Disfruta tu tiempo libre o adelanta lecturas." />
              ) : (
                <div className="-mx-2.5 space-y-0.5">
                  {data.upcoming.slice(0, 6).map((a) => (
                    <ActivityRow key={`${a.kind}${a.id}`} a={a} to={`/app/cursos/${a.course.id}/${a.kind === 'quiz' ? 'evaluaciones' : 'tareas'}/${a.id}`} />
                  ))}
                </div>
              )}
            </Card>
          )}
          <Card className="p-5">
            <SectionTitle title="Sesiones en vivo" icon={CalendarDays} />
            {loading ? <Skeleton className="h-32" /> : data.sessions.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted">No hay sesiones programadas esta semana.</p>
            ) : (
              <div className="-mx-1 space-y-1">{data.sessions.slice(0, 5).map((s) => <SessionRow key={s.id} s={s} />)}</div>
            )}
          </Card>
          {!isStudent && data?.forum_activity?.length > 0 && (
            <Card className="p-5">
              <SectionTitle title="Actividad en foros" icon={MessagesSquare} />
              <div className="space-y-3">
                {data.forum_activity.map((p) => (
                  <Link key={p.id} to={`/app/cursos/${p.course_id}/foros/${p.forum_id}/${p.thread_id}`} className="flex gap-3 rounded-xl p-1.5 hover:bg-sunken">
                    <Avatar user={p.author} size={30} />
                    <div className="min-w-0 text-sm">
                      <div className="truncate"><span className="font-semibold text-ink">{p.author.first_name}</span> <span className="text-muted">en</span> <span className="text-ink-2">{p.title}</span></div>
                      <div className="truncate text-xs text-muted">{p.course?.name} · {relative(p.created_at)}</div>
                    </div>
                  </Link>
                ))}
              </div>
            </Card>
          )}
          <Card className="p-5">
            <SectionTitle title="Anuncios recientes" icon={Megaphone} />
            {loading ? <Skeleton className="h-32" /> : data.announcements.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted">Sin anuncios por ahora.</p>
            ) : (
              <div className="space-y-4">
                {data.announcements.map((a) => (
                  <div key={a.id} className="border-l-2 pl-3" style={{ borderColor: a.course?.color || 'var(--c-primary)' }}>
                    <div className="flex items-center gap-2 text-[11.5px] text-muted">
                      <span className="font-semibold" style={{ color: a.course?.color || 'var(--c-primary)' }}>{a.course?.name || 'Comunicado ISUP'}</span> · {relative(a.created_at)}
                    </div>
                    <div className="mt-0.5 text-sm font-semibold text-ink">{a.title}</div>
                    <Markdown className="mt-1 line-clamp-3 !text-[13px] !leading-relaxed">{a.body}</Markdown>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function LiveBanner({ s, teacher }) {
  const st = sessionState(s);
  return (
    <div className="animate-fade-up relative overflow-hidden rounded-2xl bg-night p-5 text-white sm:p-6">
      <div className="absolute -top-16 -right-10 h-48 w-48 rounded-full bg-[#C96442]/45 blur-3xl" />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center">
        <span className="animate-live flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#E57C72]"><Video size={22} /></span>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-bold tracking-[0.12em] text-[#F2A99F] uppercase">{st === 'live' ? 'En vivo ahora' : `Empieza a las ${fmtTime(s.starts_at)}`}</div>
          <div className="mt-0.5 truncate text-lg font-semibold">{s.course?.name}</div>
          <div className="truncate text-sm text-white/65">{s.title} · {s.duration_min} min</div>
        </div>
        <div className="flex gap-2">
          <Button variant="white" icon={Video} onClick={() => joinSession(s)} size="lg">{teacher ? 'Iniciar sesión' : 'Unirme ahora'}</Button>
        </div>
      </div>
    </div>
  );
}

function ContinueCard({ item }) {
  const meta = ITEM_META[item.type];
  return (
    <Link to={`/app/cursos/${item.course_id}/contenido?item=${item.id}`} className="group card flex items-center gap-4 overflow-hidden p-4 transition hover:shadow-lift sm:p-5">
      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-white" style={{ background: item.course?.color }}>
        <meta.icon size={28} strokeWidth={1.75} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-xs font-semibold tracking-[0.1em] text-primary uppercase">Continúa donde lo dejaste</div>
        <div className="mt-0.5 truncate font-semibold text-ink">{item.title}</div>
        <div className="truncate text-sm text-muted">{item.course?.name} · {item.module_title}{item.duration_min ? ` · ${item.duration_min} min` : ''}</div>
      </div>
      <span className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-white transition group-hover:scale-105 sm:flex"><PlayCircle size={22} /></span>
    </Link>
  );
}

function StudentAlerts({ alerts }) {
  return (
    <Card className="border-warn/30 bg-warn-soft/30 p-5">
      <SectionTitle title="Alertas académicas" icon={AlertTriangle} action={<span className="text-xs text-muted">Habla con tu docente o tutor</span>} />
      <ul className="space-y-2">
        {alerts.map((a, i) => (
          <li key={i}>
            <Link to={`/app/cursos/${a.course.id}/${a.key === 'grade' ? 'calificaciones' : a.key === 'missing' ? 'tareas' : 'asistencia'}`} className="flex items-center gap-3 rounded-xl bg-surface px-3 py-2.5 text-sm transition hover:shadow-soft">
              <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: a.course.color }} />
              <span className="min-w-0 flex-1"><span className="font-semibold text-ink">{a.course.name}</span> <span className="text-muted">· {a.label}</span></span>
              <ArrowRight size={14} className="shrink-0 text-faint" />
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function AtRisk({ list, pending }) {
  if (!list?.length && !pending?.length) return null;
  return (
    <Card className="p-5">
      <SectionTitle title="Alerta temprana y asistencia" icon={ShieldAlert} />
      {pending?.length > 0 && (
        <div className="mb-4 rounded-xl border border-warn/30 bg-warn-soft/40 p-3 text-sm">
          <div className="mb-1.5 font-semibold text-ink">Sesiones sin asistencia registrada</div>
          <ul className="space-y-1">
            {pending.map((s) => <li key={s.id}><Link to={`/app/cursos/${s.course_id}/sesiones`} className="flex items-center justify-between gap-2 text-ink-2 hover:text-primary-ink"><span className="truncate">{s.course?.name} · {s.title}</span><span className="shrink-0 text-xs text-muted">{fmtShort(s.starts_at)}</span></Link></li>)}
          </ul>
        </div>
      )}
      {list?.length > 0 && (
        <div className="-mx-2 divide-y divide-line">
          {list.map((r) => (
            <Link key={`${r.course.id}${r.student.id}`} to={`/app/cursos/${r.course.id}/participantes`} className="flex items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-sunken">
              <Avatar user={r.student} size={34} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-ink">{fullName(r.student)} <span className="font-normal text-muted">· {r.course?.name}</span></div>
                <div className="mt-0.5 flex flex-wrap gap-1">{r.flags.map((f) => <span key={f.key} className={cx('rounded px-1.5 py-px text-[11px] font-medium', f.tone === 'danger' ? 'bg-danger-soft text-danger' : 'bg-warn-soft text-warn')}>{f.label}</span>)}</div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </Card>
  );
}

function ToGrade({ list }) {
  return (
    <Card className="p-5">
      <SectionTitle title="Entregas por calificar" icon={ClipboardCheck} />
      {list.length === 0 ? (
        <EmptyState compact icon={CheckCircle2} title="Todo calificado" description="No tienes entregas pendientes. ¡Buen trabajo!" />
      ) : (
        <div className="-mx-2 divide-y divide-line">
          {list.map((s) => (
            <Link key={s.id} to={`/app/cursos/${s.course_id}/tareas/${s.assignment_id}?entrega=${s.id}`} className="flex items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-sunken">
              <Avatar user={s} size={34} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-ink">{fullName(s)}</div>
                <div className="truncate text-xs text-muted">{s.title} · {s.course?.name}</div>
              </div>
              <span className="text-xs text-faint">{relative(s.submitted_at)}</span>
            </Link>
          ))}
        </div>
      )}
    </Card>
  );
}

const CHECKLIST = [
  { key: 'internet', icon: Wifi, title: 'Verifica tu conexión', text: 'Al menos 10 Mbps, de preferencia con cable de red.' },
  { key: 'chrome', icon: Globe, title: 'Actualiza Google Chrome', text: 'La última versión evita problemas con videos y sesiones.' },
  { key: 'headset', icon: Headphones, title: 'Prepara tu headset', text: 'Audífonos con micrófono para participar en clase.' },
  { key: 'profile', icon: UserRound, title: 'Completa tu perfil', text: 'Agrega tu celular y una breve presentación.', to: '/app/perfil' },
  { key: 'syllabus', icon: FileText, title: 'Revisa el sílabo', text: 'Lo encontrarás en la Unidad 1 de cada curso.', to: '/app/cursos' },
];

function Onboarding() {
  const { user, setUser } = useAuth();
  const { toast } = useUi();
  const ob = user.onboarding || {};
  const done = CHECKLIST.filter((c) => ob[c.key]).length;
  const toggle = async (key, value) => {
    const r = await api.put('/auth/onboarding', { key, value });
    setUser((u) => ({ ...u, onboarding: r.onboarding }));
    if (value && done + 1 === CHECKLIST.length) toast('¡Checklist completo! Ya estás listo(a) para tus clases.');
  };
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-4 border-b border-line bg-gradient-to-r from-primary-soft to-transparent p-5 sm:flex-row sm:items-center">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-white"><Sparkles size={20} /></span>
        <div className="flex-1">
          <div className="font-semibold text-ink">Prepárate para tus clases virtuales</div>
          <div className="text-sm text-muted">{done} de {CHECKLIST.length} pasos completados</div>
          <ProgressBar value={(done / CHECKLIST.length) * 100} size="sm" className="mt-2 max-w-xs" />
        </div>
        <Button variant="ghost" size="sm" icon={X} onClick={() => toggle('done', true)}>Ocultar</Button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
        {CHECKLIST.map((c) => {
          const checked = !!ob[c.key];
          return (
            <div key={c.key} className={cx('flex gap-3 border-line p-4 sm:border-r', checked && 'opacity-70')}>
              <button onClick={() => toggle(c.key, !checked)} className="mt-0.5 shrink-0" aria-label={checked ? `Desmarcar ${c.title}` : `Marcar ${c.title}`}>
                {checked ? <CheckCircle2 size={22} className="text-success" /> : <Circle size={22} className="text-line-strong hover:text-primary" />}
              </button>
              <div className="min-w-0">
                <div className={cx('text-sm font-semibold text-ink', checked && 'line-through decoration-faint')}>{c.title}</div>
                <p className="mt-0.5 text-xs leading-relaxed text-muted">{c.text}</p>
                {c.to && !checked && <Link to={c.to} className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-primary-ink hover:underline">Ir ahora <ArrowRight size={12} /></Link>}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
