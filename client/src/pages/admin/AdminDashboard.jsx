import { Link } from 'react-router-dom';
import {
  Users, GraduationCap, Library, Layers, UserPlus, Headset, FileCheck2, LogIn, Megaphone, BookOpen, ArrowRight, CalendarDays, Inbox, UserCheck, ShieldCheck, ScrollText,
} from 'lucide-react';
import { useApi } from '../../lib/api.js';
import { useAuth } from '../../lib/context.jsx';
import { greeting, fmtDate, relative, pluralize, fullName } from '../../lib/format.js';
import { Button, Card, Badge, PageHeader, SectionTitle, PageLoader, ErrorState, EmptyState, Avatar, ProgressBar, Stat } from '../../components/ui.jsx';

const APPLICANT_STATUS = {
  nuevo: { label: 'Nuevo', tone: 'primary' },
  contactado: { label: 'Contactado', tone: 'info' },
  matriculado: { label: 'Matriculado', tone: 'success' },
  descartado: { label: 'Descartado', tone: 'neutral' },
};

const nf = new Intl.NumberFormat('es-PE');

function applicantAsUser(a) {
  const [first = '', ...rest] = (a.full_name || '').trim().split(/\s+/);
  return { first_name: first, last_name: rest.join(' '), avatar_color: '#5B7B6F' };
}

function termProgress(term) {
  if (!term?.start_date || !term?.end_date) return null;
  const start = new Date(`${term.start_date}T00:00:00-05:00`).getTime();
  const end = new Date(`${term.end_date}T23:59:59-05:00`).getTime();
  const now = Date.now();
  const totalWeeks = Math.max(1, Math.round((end - start) / (7 * 864e5)));
  if (now < start) return { pct: 0, label: `Inicia el ${fmtDate(term.start_date)}` };
  if (now > end) return { pct: 100, label: 'Periodo finalizado' };
  const week = Math.min(totalWeeks, Math.floor((now - start) / (7 * 864e5)) + 1);
  return { pct: Math.round(((now - start) / (end - start)) * 100), label: `Semana ${week} de ${totalWeeks}` };
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useApi('/admin/stats');

  if (loading) return <PageLoader />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  const s = data;
  const term = s.term;
  const tp = termProgress(term);
  const byProgram = s.by_program || [];
  const maxStudents = Math.max(1, ...byProgram.map((p) => p.students));
  const totalByProgram = byProgram.reduce((acc, p) => acc + p.students, 0);

  const stats = [
    { icon: Users, label: 'Estudiantes activos', value: s.students, tone: 'primary' },
    { icon: GraduationCap, label: 'Docentes activos', value: s.teachers, tone: 'info' },
    { icon: Library, label: 'Cursos', value: s.courses, hint: term?.name, tone: 'success' },
    { icon: Layers, label: 'Carreras activas', value: s.programs, tone: 'warn' },
    { icon: UserPlus, label: 'Postulantes nuevos', value: s.applicants_new, hint: 'Pendientes de contacto', tone: 'primary' },
    { icon: Headset, label: 'Soporte abierto', value: s.tickets_open, hint: 'Solicitudes sin resolver', tone: s.tickets_open > 0 ? 'warn' : 'success' },
    { icon: FileCheck2, label: 'Actas cerradas', value: `${s.actas_closed}/${s.actas_total}`, hint: 'Unidades didácticas del periodo', tone: s.actas_closed === s.actas_total && s.actas_total ? 'success' : 'info' },
    { icon: UserCheck, label: 'Asistencia sin registrar', value: s.attendance_pending, hint: 'Sesiones finalizadas', tone: s.attendance_pending > 0 ? 'warn' : 'success' },
  ];

  return (
    <div className="animate-fade-up">
      <PageHeader
        eyebrow={term?.name || 'Administración'}
        title="Panel general"
        subtitle={`${greeting()}, ${user?.first_name || ''}. Este es el resumen de la actividad del instituto.`}
        actions={
          <>
            <Button variant="secondary" icon={Megaphone} to="/app/admin/comunicados">Enviar comunicado</Button>
            <Button icon={UserPlus} to="/app/admin/usuarios">Crear usuario</Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((st) => <Stat key={st.label} {...st} value={typeof st.value === 'number' ? nf.format(st.value ?? 0) : st.value} />)}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-6">
          <Card className="p-5 sm:p-6">
            <SectionTitle
              title="Estudiantes por carrera"
              icon={Layers}
              action={<span className="text-xs text-faint">{pluralize(totalByProgram, 'estudiante', 'estudiantes')}</span>}
            />
            {byProgram.length === 0 ? (
              <EmptyState compact icon={Layers} title="Aún no hay carreras activas" description="Crea una carrera para empezar a matricular estudiantes."
                action={<Button size="sm" variant="soft" to="/app/admin/carreras">Ir a carreras</Button>} />
            ) : (
              <ul className="mt-2 space-y-4">
                {byProgram.map((p) => {
                  const share = totalByProgram ? Math.round((p.students / totalByProgram) * 100) : 0;
                  return (
                    <li key={p.name}>
                      <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
                        <span className="flex min-w-0 items-center gap-2 font-medium text-ink">
                          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: p.color || 'var(--c-primary)' }} />
                          <span className="truncate">{p.name}</span>
                        </span>
                        <span className="shrink-0 tabular-nums text-muted">
                          <span className="font-semibold text-ink">{nf.format(p.students)}</span>
                          <span className="ml-1.5 text-xs text-faint">{share}%</span>
                        </span>
                      </div>
                      <div className="h-2.5 w-full overflow-hidden rounded-full bg-sunken">
                        <div className="h-full rounded-full transition-[width] duration-700 ease-out"
                          style={{ width: `${Math.max(p.students ? 2 : 0, (p.students / maxStudents) * 100)}%`, background: p.color || 'var(--c-primary)' }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card className="p-5 sm:p-6">
            <SectionTitle
              title="Postulantes recientes"
              icon={UserPlus}
              action={<Link to="/app/admin/postulantes" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">Ver todos <ArrowRight size={14} /></Link>}
            />
            {(s.recent_applicants || []).length === 0 ? (
              <EmptyState compact icon={Inbox} title="Sin postulantes por ahora" description="Las solicitudes del formulario de admisión aparecerán aquí." />
            ) : (
              <ul className="-mx-2 divide-y divide-line">
                {s.recent_applicants.map((a) => {
                  const st = APPLICANT_STATUS[a.status] || APPLICANT_STATUS.nuevo;
                  return (
                    <li key={a.id}>
                      <Link to="/app/admin/postulantes" className="flex items-center gap-3 rounded-xl px-2 py-3 transition hover:bg-sunken">
                        <Avatar user={applicantAsUser(a)} size={36} />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium text-ink">{a.full_name}</div>
                          <div className="truncate text-xs text-muted">{a.program || 'Carrera por definir'} · {relative(a.created_at)}</div>
                        </div>
                        <Badge tone={st.tone}>{st.label}</Badge>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <Card className="p-5 sm:p-6">
            <SectionTitle title="Acciones rápidas" />
            <div className="flex flex-col gap-2">
              {[
                { to: '/app/admin/academico', icon: FileCheck2, title: 'Actas e indicadores', desc: 'Cierre de periodo, tasa de aprobación y asistencia.' },
                { to: '/app/admin/usuarios', icon: UserPlus, title: 'Crear usuario', desc: 'Registra estudiantes, docentes o administradores.' },
                { to: '/app/admin/cursos', icon: BookOpen, title: 'Nuevo curso', desc: 'Crea una unidad didáctica y matricula estudiantes.' },
                { to: '/app/admin/comunicados', icon: Megaphone, title: 'Enviar comunicado', desc: 'Notifica a toda la comunidad ISUP.' },
              ].map((a) => (
                <Link key={a.to} to={a.to} className="group flex items-center gap-3 rounded-xl border border-line px-3.5 py-3 transition hover:border-line-strong hover:bg-sunken">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary"><a.icon size={18} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-ink">{a.title}</span>
                    <span className="block text-xs text-muted">{a.desc}</span>
                  </span>
                  <ArrowRight size={16} className="shrink-0 text-faint transition group-hover:translate-x-0.5 group-hover:text-primary" />
                </Link>
              ))}
            </div>
          </Card>

          {term && (
            <Card className="p-5 sm:p-6">
              <SectionTitle title="Periodo académico" icon={CalendarDays} />
              <div className="font-display text-xl font-semibold text-ink">{term.name}</div>
              <div className="mt-1 text-sm text-muted">{fmtDate(term.start_date)} — {fmtDate(term.end_date)}</div>
              {tp && (
                <div className="mt-4">
                  <div className="mb-1.5 flex justify-between text-xs text-muted">
                    <span>{tp.label}</span>
                    <span className="tabular-nums">{tp.pct}%</span>
                  </div>
                  <ProgressBar value={tp.pct} />
                </div>
              )}
            </Card>
          )}

          <Card className="p-5 sm:p-6">
            <SectionTitle title="Actividad reciente" icon={ScrollText} action={<Link to="/app/admin/auditoria" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">Auditoría <ArrowRight size={14} /></Link>} />
            <ul className="space-y-2.5 text-sm">
              {(s.recent_audit || []).map((a) => (
                <li key={a.id} className="flex items-start gap-2.5">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  <span className="min-w-0 flex-1"><span className="font-medium text-ink">{a.first_name ? `${a.first_name} ${a.last_name}` : 'Sistema'}</span> <span className="text-muted">· {a.action}</span><span className="block text-[11px] text-faint">{relative(a.created_at)}</span></span>
                </li>
              ))}
            </ul>
          </Card>

          {s.consent_pending > 0 && (
            <Card className="flex items-start gap-3 border-info/30 bg-info-soft p-4">
              <ShieldCheck size={18} className="mt-0.5 shrink-0 text-info" />
              <div className="min-w-0 flex-1 text-sm"><div className="font-medium text-ink">{pluralize(s.consent_pending, 'usuario sin aceptar', 'usuarios sin aceptar')} la política de datos vigente</div><div className="mt-0.5 text-xs text-muted">Se les solicitará al ingresar al aula virtual.</div></div>
            </Card>
          )}

          {s.tickets_open > 0 && (
            <Card className="flex items-start gap-3 border-warn/30 bg-warn-soft p-4">
              <Headset size={18} className="mt-0.5 shrink-0 text-warn" />
              <div className="min-w-0 flex-1 text-sm">
                <div className="font-medium text-ink">{pluralize(s.tickets_open, 'solicitud de soporte pendiente', 'solicitudes de soporte pendientes')}</div>
                <Link to="/app/admin/soporte" className="mt-0.5 inline-flex items-center gap-1 font-medium text-warn hover:underline">Atender ahora <ArrowRight size={14} /></Link>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
