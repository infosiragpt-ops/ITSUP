import { useMemo, useState } from 'react';
import { ScrollText, Search, Download, ShieldCheck } from 'lucide-react';
import { useApi } from '../../lib/api.js';
import { Avatar, Badge, Card, Input, PageHeader, PageLoader, ErrorState, EmptyState, Select, Button } from '../../components/ui.jsx';
import { fmtDateTime, fullName, ROLE_LABEL, downloadCsv } from '../../lib/format.js';

const ACTION_LABEL = {
  'auth.login': 'Inicio de sesión', 'auth.logout': 'Cierre de sesión', 'auth.failed': 'Intento fallido', 'auth.locked': 'Cuenta bloqueada',
  'consent.accept': 'Aceptó política de datos', 'password.change': 'Cambio de contraseña', 'profile.update': 'Actualizó perfil',
  'grade.set': 'Calificó entrega', 'grade.change': 'Modificó calificación', 'attendance.record': 'Registró asistencia',
  'acta.close': 'Cerró acta', 'acta.reopen': 'Reabrió acta', 'acta.recovery': 'Recuperación / observación', 'enrollment.status': 'Cambió estado de matrícula',
  'syllabus.update': 'Actualizó sílabo', 'categories.update': 'Actualizó criterios de evaluación', 'document.issue': 'Emitió documento',
  'user.create': 'Creó usuario', 'user.update': 'Editó usuario', 'user.deactivate': 'Desactivó usuario',
  'course.create': 'Creó curso', 'course.update': 'Editó curso', 'course.delete': 'Eliminó curso', 'enrollment.add': 'Matriculó estudiantes', 'enrollment.remove': 'Eliminó matrícula',
  'program.create': 'Creó programa', 'program.update': 'Editó programa', 'term.create': 'Creó periodo', 'term.update': 'Editó periodo', 'term.activate': 'Activó periodo', 'term.close': 'Cerró periodo',
  'settings.update': 'Cambió configuración', 'announcement.global': 'Comunicado institucional',
  'assignment.create': 'Creó tarea', 'assignment.update': 'Editó tarea', 'assignment.delete': 'Eliminó tarea', 'quiz.create': 'Creó evaluación', 'quiz.update': 'Editó evaluación', 'quiz.delete': 'Eliminó evaluación',
};
const tone = (a) => (a.startsWith('auth.failed') || a.startsWith('auth.locked') || a.includes('delete') || a.includes('deactivate') || a === 'acta.reopen' ? 'danger' : a.startsWith('grade') || a.startsWith('acta') || a.startsWith('attendance') ? 'primary' : a.startsWith('auth') ? 'neutral' : 'info');

export default function AdminAudit() {
  const [q, setQ] = useState('');
  const [action, setAction] = useState('');
  const path = useMemo(() => { const p = new URLSearchParams(); if (q.trim()) p.set('q', q.trim()); if (action) p.set('action', action); p.set('limit', '300'); return `/admin/audit?${p}`; }, [q, action]);
  const { data, loading, error, reload } = useApi(path);
  if (error) return <ErrorState message={error} onRetry={reload} />;
  const groups = [...new Set((data?.actions || []).map((a) => a.split('.')[0]))];
  const exportCsv = () => downloadCsv('auditoria-isup.csv', ['Fecha', 'Usuario', 'Rol', 'Acción', 'Entidad', 'ID', 'Detalle', 'IP'],
    data.rows.map((r) => [r.created_at, r.first_name ? `${r.first_name} ${r.last_name}` : '—', r.role ? ROLE_LABEL[r.role] : '', ACTION_LABEL[r.action] || r.action, r.entity || '', r.entity_id ?? '', r.details ? JSON.stringify(r.details) : '', r.ip || '']));
  return (
    <div className="animate-fade-up">
      <PageHeader eyebrow="Administración" title="Auditoría" subtitle="Bitácora inmutable de accesos y acciones sobre calificaciones, asistencia, actas, usuarios y datos personales (trazabilidad exigida por la normativa de registros académicos y la Ley 29733)."
        actions={<Button variant="secondary" icon={Download} onClick={exportCsv} disabled={!data}>Exportar CSV</Button>} />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative w-full sm:max-w-sm"><Search size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-faint" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por usuario, acción o detalle" className="pl-9" /></div>
        <Select value={action} onChange={(e) => setAction(e.target.value)} className="sm:max-w-xs">
          <option value="">Todas las acciones</option>
          {groups.map((g) => <option key={g} value={g}>{{ auth: 'Autenticación', grade: 'Calificaciones', attendance: 'Asistencia', acta: 'Actas', user: 'Usuarios', course: 'Cursos', enrollment: 'Matrícula', term: 'Periodos', document: 'Documentos', settings: 'Configuración', consent: 'Consentimientos', syllabus: 'Sílabos', categories: 'Criterios', program: 'Programas', assignment: 'Tareas', quiz: 'Evaluaciones', announcement: 'Comunicados', password: 'Contraseñas', profile: 'Perfiles' }[g] || g}</option>)}
        </Select>
        <span className="text-xs text-muted sm:ml-auto">{data ? `${data.rows.length} registros` : ''}</span>
      </div>
      {loading && !data ? <PageLoader /> : data.rows.length === 0 ? <Card><EmptyState icon={ScrollText} title="Sin registros" description="No hay eventos que coincidan con el filtro." /></Card> : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="bg-sunken text-left text-xs font-semibold text-muted"><tr><th className="px-4 py-3">Fecha y hora</th><th className="px-3 py-3">Usuario</th><th className="px-3 py-3">Acción</th><th className="px-3 py-3">Entidad</th><th className="px-3 py-3">Detalle</th><th className="px-3 py-3">IP</th></tr></thead>
              <tbody className="divide-y divide-line">
                {data.rows.map((r) => (
                  <tr key={r.id} className="hover:bg-sunken/40">
                    <td className="px-4 py-2.5 whitespace-nowrap text-muted">{fmtDateTime(r.created_at)}</td>
                    <td className="px-3 py-2.5">{r.first_name ? <div className="flex items-center gap-2"><Avatar user={r} size={26} /><div><div className="text-ink">{fullName(r)}</div><div className="text-[11px] text-faint">{ROLE_LABEL[r.role]} · {r.code}</div></div></div> : <span className="text-faint">Sistema</span>}</td>
                    <td className="px-3 py-2.5"><Badge tone={tone(r.action)}>{ACTION_LABEL[r.action] || r.action}</Badge></td>
                    <td className="px-3 py-2.5 text-xs text-muted">{r.entity ? `${r.entity}${r.entity_id ? ` #${r.entity_id}` : ''}` : '—'}</td>
                    <td className="max-w-[320px] truncate px-3 py-2.5 font-mono text-[11px] text-ink-2" title={r.details ? JSON.stringify(r.details) : ''}>{r.details ? (typeof r.details === 'string' ? r.details : Object.entries(r.details).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : typeof v === 'object' && v ? JSON.stringify(v) : v}`).join(' · ')) : '—'}</td>
                    <td className="px-3 py-2.5 font-mono text-[11px] text-faint">{r.ip || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      <p className="mt-4 flex items-start gap-2 text-xs text-faint"><ShieldCheck size={14} className="mt-0.5 shrink-0" /> Los registros de auditoría no pueden editarse ni eliminarse desde la aplicación.</p>
    </div>
  );
}
