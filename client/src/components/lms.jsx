import { Link } from 'react-router-dom';
import { Video, Clock, Users, ClipboardCheck, ArrowUpRight } from 'lucide-react';
import { Avatar, Badge, Button, ProgressBar, cx } from './ui.jsx';
import { CourseCover, ITEM_META } from './brand.jsx';
import { dueInfo, fmtDateTime, fmtTime, fmtWeekday, fmtShort, fullName, sessionState, fmtGrade, gradeTone } from '../lib/format.js';

export function CourseCard({ c, role }) {
  const live = c.next_session && sessionState(c.next_session) === 'live';
  return (
    <Link to={`/app/cursos/${c.id}`} className="group card flex flex-col overflow-hidden transition duration-200 hover:-translate-y-0.5 hover:shadow-lift">
      <CourseCover course={c} className="h-[104px]">
        <div className="absolute inset-x-4 top-3.5 flex items-start justify-between">
          <span className="rounded-md bg-black/20 px-2 py-0.5 text-[11px] font-semibold tracking-wide text-white backdrop-blur">{c.code}</span>
          {live && <span className="animate-live flex items-center gap-1.5 rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-danger"><span className="h-1.5 w-1.5 rounded-full bg-danger" /> EN VIVO</span>}
          {role !== 'student' && c.to_grade > 0 && <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-primary-ink">{c.to_grade} por calificar</span>}
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
              <div className="mt-3 flex items-center justify-between border-t border-line pt-3 text-xs text-muted">
                <span className="flex items-center gap-1.5 truncate"><Clock size={13} /> {c.schedule}</span>
                {c.grades?.average != null && <Badge tone={gradeTone(c.grades.average)}>{fmtGrade(c.grades.average)}</Badge>}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-between border-t border-line pt-3 text-xs text-muted">
              <span className="flex items-center gap-1.5 truncate"><Clock size={13} /> {c.schedule}</span>
              <span className="flex items-center gap-1"><ClipboardCheck size={13} /> {c.to_grade}</span>
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
        <Button size="sm" variant={st === 'live' ? 'danger' : 'primary'} icon={Video} href={s.meeting_url} target="_blank" rel="noreferrer">Unirme</Button>
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
