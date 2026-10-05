import { NavLink, Outlet, useOutletContext, useParams, Link } from 'react-router-dom';
import {
  Home, Layers, ClipboardList, ListChecks, MessagesSquare, Video, GraduationCap, Users, Clock, ChevronLeft, Pencil,
} from 'lucide-react';
import { useApi } from '../../../lib/api.js';
import { useAuth } from '../../../lib/context.jsx';
import { Avatar, ErrorState, ProgressRing, Skeleton, cx } from '../../../components/ui.jsx';
import { CourseCover } from '../../../components/brand.jsx';
import { fullName } from '../../../lib/format.js';

export const useCourse = () => useOutletContext();

export default function CourseLayout() {
  const { courseId } = useParams();
  const { user } = useAuth();
  const { data: course, error, reload, setData } = useApi(`/courses/${courseId}`);

  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!course) return (
    <div className="space-y-4"><Skeleton className="h-44 rounded-2xl" /><Skeleton className="h-10 rounded-xl" /><Skeleton className="h-64 rounded-2xl" /></div>
  );

  const base = `/app/cursos/${course.id}`;
  const tabs = [
    { to: base, label: 'Inicio', icon: Home, end: true },
    { to: `${base}/contenido`, label: 'Contenido', icon: Layers },
    { to: `${base}/tareas`, label: 'Tareas', icon: ClipboardList },
    { to: `${base}/evaluaciones`, label: 'Evaluaciones', icon: ListChecks },
    { to: `${base}/foros`, label: 'Foros', icon: MessagesSquare },
    { to: `${base}/sesiones`, label: 'Sesiones en vivo', icon: Video },
    { to: `${base}/calificaciones`, label: 'Calificaciones', icon: GraduationCap },
    { to: `${base}/participantes`, label: 'Participantes', icon: Users },
  ];
  const isStudent = user.role === 'student';

  return (
    <div className="animate-fade-up">
      <Link to="/app/cursos" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-ink"><ChevronLeft size={16} /> Mis cursos</Link>
      <CourseCover course={course} className="rounded-2xl">
        <div className="relative flex flex-col gap-5 p-5 text-white sm:flex-row sm:items-end sm:p-7">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 text-[12px] font-semibold">
              <span className="rounded-md bg-black/20 px-2 py-0.5 tracking-wide backdrop-blur">{course.code}</span>
              <span className="rounded-md bg-black/20 px-2 py-0.5 backdrop-blur">{course.credits} créditos</span>
              {course.term && <span className="rounded-md bg-black/20 px-2 py-0.5 backdrop-blur">Ciclo {course.term.name}</span>}
              {course.can_edit && !isStudent && <span className="flex items-center gap-1 rounded-md bg-white px-2 py-0.5 text-primary-ink"><Pencil size={11} /> Modo docente</span>}
            </div>
            <h1 className="font-display mt-3 text-[1.75rem] leading-tight font-semibold sm:text-[2.2rem]">{course.name}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-white/85">
              {course.teacher && <span className="flex items-center gap-2"><Avatar user={course.teacher} size={24} className="ring-2 ring-white/40" /> {fullName(course.teacher)}</span>}
              <span className="flex items-center gap-1.5"><Clock size={15} /> {course.schedule}</span>
              <span className="flex items-center gap-1.5"><Users size={15} /> {course.students} estudiantes</span>
            </div>
          </div>
          {isStudent && course.progress && (
            <div className="flex items-center gap-3 self-start rounded-2xl bg-black/20 p-3 pr-5 backdrop-blur sm:self-auto">
              <ProgressRing value={course.progress.pct} size={54} stroke={5} color="#fff" track="rgba(255,255,255,.25)">
                <span className="text-white">{course.progress.pct}%</span>
              </ProgressRing>
              <div className="text-sm leading-tight"><div className="font-semibold">Tu avance</div><div className="text-white/75">{course.progress.done} de {course.progress.total}</div></div>
            </div>
          )}
        </div>
      </CourseCover>

      <nav className="no-scrollbar sticky top-16 z-20 -mx-4 mt-4 mb-6 overflow-x-auto border-b border-line bg-bg/90 px-4 backdrop-blur-xl sm:mx-0 sm:px-0" aria-label="Secciones del curso">
        <ul className="flex min-w-max gap-1">
          {tabs.map((t) => (
            <li key={t.to}>
              <NavLink to={t.to} end={t.end} className={({ isActive }) => cx(
                'relative flex items-center gap-2 px-3 py-3 text-[13.5px] font-medium whitespace-nowrap transition',
                isActive ? 'text-ink after:absolute after:inset-x-2 after:-bottom-px after:h-[2px] after:rounded-full after:bg-primary' : 'text-muted hover:text-ink'
              )}>
                {({ isActive }) => <><t.icon size={16} className={isActive ? 'text-primary' : ''} /> {t.label}</>}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <Outlet context={{ course, reloadCourse: reload, setCourse: setData, canEdit: course.can_edit, isStudent }} />
    </div>
  );
}
