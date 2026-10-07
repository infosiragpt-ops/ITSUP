import { Link } from 'react-router-dom';
import { Video, Clock, Users, ClipboardCheck, ArrowUpRight, Lock, UserCheck } from 'lucide-react';
import { api } from '../lib/api.js';
import { Avatar, Badge, Button, ProgressBar, cx } from './ui.jsx';
import { CourseCover, ITEM_META } from './brand.jsx';
import { dueInfo, fmtDateTime, fmtTime, fmtWeekday, fmtShort, fullName, sessionState, fmtGrade, gradeTone, conditionOf, fmtPct } from '../lib/format.js';

/**
 * Abre la videoconferencia y registra la asistencia automática del estudiante.
 * La ventana se abre de forma síncrona (evita bloqueadores de ventanas emergentes) y luego se avisa al servidor.
 */
export function joinSession(s) {
  if (!s?.meeting_url) {
    window.alert('Esta sesión aún no tiene sala de videoconferencia. El docente debe agregar el enlace desde "Sesiones en vivo".');
    return;
  }
  window.open(s.meeting_url, '_blank', 'noopener');
  api.post(`/sessions/${s.id}/join`).catch(() => {});
}

export function CourseCard({ c, role }) {
  const live = c.next_session && sessionState(c.next_session) === 'live';
  const cond = c.final ? conditionOf(c.final.condition) : null;
  return (
    <Link to={`/app/cursos/${c.id}`} className="group card flex flex-col overflow-hidden transition duration-200 hover:-translate-y-0.5 hover:shadow-lift">
      <CourseCover course={c} className="h-[104px]">
        <div className="absolute inset-x-4 top-3.5 flex items-start justify-between gap-2">
          <span className="rounded-md bg-black/20 px-2 py-0.5 text-[11px] font-semibold tracking-wide text-white backdrop-blur">{c.code}</span>
          {c.closed ? <span className="flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-ink"><Lock size={11} /> Acta cerrada</span>
            : live ? <span className="animate-live flex items-center gap-1.5 rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-danger"><span className="h-1.5 w-1.5 rounded-full bg-danger" /> EN VIVO</span>
            : role !== 'student' && c.to_grade > 0 ? <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-primary-ink">{c.to_grade} por calificar</span> : null}
        </div>
        <ArrowUpRight size={18} className="absolute right-4 bottom-3 text-white/0 transition group-hover:text-white/90" />
      </CourseCover>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="line-clamp-2 leading-snug font-semibold text-ink">{c.name}</h3>
        <div className="mt-1.5 flex items-center gap-2 text-[13px] text-muted">
          {role === 'student' ? (
            <><Avatar user={c.teacher} size={20} /> <span className="truncate">{fullName(c.teacher)}</span></>
          ) : (
            <><Users size={14} /> {c.students} estudiantes</>
          )}
        </div>
        <div className="mt-auto pt-4">
          {role === 'student' ? (
            <>
              <div className="mb-1.5 flex items-center justify-between text-xs">
                <span className="text-muted">{c.progress.done}/{c.progress.total} actividades</span>
                <span className="font-semibold text-ink tabular-nums">{c.progress.pct}%</span>
              </div>
              <ProgressBar value={c.progress.pct} size="sm" tone={c.progress.pct === 100 ? 'success' : 'primary'} />
              <div className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-3 text-xs text-muted">
                <span className="flex min-w-0 items-center gap-1.5 truncate"><Clock size={13} className="shrink-0" /> <span className="truncate">{c.schedule}</span></span>
                <span className="flex shrink-0 items-center gap-1.5">
                  {c.attendance?.attendance_pct != null && (
                    <span className={cx('flex items-center gap-1 tabular-nums', c.attendance.dpi ? 'text-danger' : c.attendance.at_risk ? 'text-warn' : '')} title="Asistencia">
                      <UserCheck size={12} /> {fmtPct(c.attendance.attendance_pct)}
                    </span>
                  )}
                  {c.closed && cond ? <Badge tone={cond.tone}>{fmtGrade(c.final.final)} · {cond.short || cond.label}</Badge>
                    : c.grades?.average != null && <Badge tone={gradeTone(c.grades.average)}>{fmtGrade(c.grades.average)}</Badge>}
                </span>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-between border-t border-line pt-3 text-xs text-muted">
              <span className="flex items-center gap-1.5 truncate"><Clock size={13} /> {c.schedule}</span>
              <span className="flex items-center gap-3">
                {c.attendance_pending > 0 && <span className="flex items-center gap-1 text-warn" title="Sesiones sin asistencia registrada"><UserCheck size={13} /> {c.attendance_pending}</span>}
                <span className="flex items-center gap-1"><ClipboardCheck size={13} /> {c.to_grade}</span>
              </span>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

export function SessionRow({ s, compact }) {
  const st = sessionState(s);
  return (
    <div className={cx('flex items-center gap-3 rounded-xl', st === 'live' ? 'bg-danger-soft p-3' : compact ? 'py-2' : 'p-3 hover:bg-sunken')}>
      <div className={cx('flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl text-center leading-none', st === 'live' ? 'bg-danger text-white' : 'bg-sunken text-ink')}>
        <span className="text-[10px] font-semibold uppercase">{fmtWeekday(s.starts_at)}</span>
        <span className="mt-0.5 text-[15px] font-bold">{fmtShort(s.starts_at).split(' ')[0]}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-ink">{s.course?.name || s.title}</div>
        <div className="truncate text-xs text-muted">{st === 'live' ? 'En vivo ahora · ' : ''}{fmtTime(s.starts_at)} · {s.duration_min} min</div>
      </div>
      {(st === 'live' || st === 'soon') && s.meeting_url ? (
        <Button size="sm" variant={st === 'live' ? 'danger' : 'primary'} icon={Video} onClick={() => joinSession(s)}>Unirme</Button>
      ) : null}
    </div>
  );
}

export function DueChip({ due, done }) {
  const d = dueInfo(due, done);
  return <Badge tone={d.tone}>{d.label}</Badge>;
}

export function ActivityRow({ a, to }) {
  const meta = ITEM_META[a.kind] || ITEM_META.assignment;
  return (
    <Link to={to} className="flex items-center gap-3 rounded-xl p-2.5 transition hover:bg-sunken">
      <span className={cx('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', meta.tone)}><meta.icon size={17} /></span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-ink">{a.title}</div>
        <div className="truncate text-xs text-muted">{a.course?.name} · {fmtDateTime(a.due_at)}</div>
      </div>
      <DueChip due={a.due_at} />
    </Link>
  );
}

/** Etiqueta de condición final (Aprobado / Desaprobado / DPI / Retirado / En proceso). */
export function ConditionBadge({ condition, short, className }) {
  const c = conditionOf(condition);
  return <Badge tone={c.tone} className={className}>{short ? c.short || c.label : c.label}</Badge>;
}

/** Aviso de acta cerrada para las vistas del curso. */
export function ClosedNotice({ course, compact }) {
  if (course?.status !== 'closed' && !course?.closed) return null;
  return (
    <div className={cx('flex items-start gap-3 rounded-xl border border-line bg-sunken text-sm text-ink-2', compact ? 'p-3' : 'p-4')}>
      <Lock size={17} className="mt-0.5 shrink-0 text-muted" />
      <span>El <strong className="text-ink">acta de evaluación está cerrada</strong>. Las notas y la asistencia quedaron registradas de forma definitiva; el contenido sigue disponible para consulta.</span>
    </div>
  );
}
