import { useState } from 'react';
import { Mail, Search, Users } from 'lucide-react';
import { useApi } from '../../../lib/api.js';
import { Avatar, Badge, Button, Card, EmptyState, ErrorState, Input, ProgressBar, Skeleton } from '../../../components/ui.jsx';
import { fullName, relative } from '../../../lib/format.js';
import { useCourse } from './CourseLayout.jsx';

export default function CoursePeople() {
  const { course, canEdit } = useCourse();
  const { data, loading, error, reload } = useApi(`/courses/${course.id}/people`);
  const [q, setQ] = useState('');
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (loading) return <Skeleton className="h-72 rounded-2xl" />;
  const students = data.students.filter((s) => !q || fullName(s).toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="space-y-5">
      {data.teacher && (
        <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
          <Avatar user={data.teacher} size={56} />
          <div className="flex-1">
            <Badge tone="info">Docente del curso</Badge>
            <div className="mt-1 text-lg font-semibold text-ink">{fullName(data.teacher)}</div>
            <div className="text-sm text-muted">{data.teacher.title}</div>
          </div>
          <Button variant="secondary" icon={Mail} href={`mailto:${data.teacher.email}`}>Escribir</Button>
        </Card>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="font-semibold text-ink">Compañeros de clase <span className="text-muted">({data.students.length})</span></h3>
        <div className="relative sm:w-72"><Search size={16} className="absolute top-1/2 left-3 -translate-y-1/2 text-faint" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar" className="pl-9" /></div>
      </div>
      {students.length === 0 ? <Card><EmptyState icon={Users} title="Sin resultados" /></Card> : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {students.map((s) => (
            <Card key={s.id} className="flex items-center gap-3 p-4">
              <Avatar user={s} size={42} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium text-ink">{fullName(s)}</div>
                <div className="truncate text-xs text-muted">{canEdit ? s.email : s.code}</div>
                {canEdit && s.progress && (
                  <div className="mt-2 flex items-center gap-2">
                    <ProgressBar value={s.progress.pct} size="sm" tone={s.progress.pct < 40 ? 'warn' : 'primary'} />
                    <span className="text-[11px] font-semibold text-muted tabular-nums">{s.progress.pct}%</span>
                  </div>
                )}
                {canEdit && <div className="mt-1 text-[11px] text-faint">Último acceso: {s.last_access ? relative(s.last_access) : 'nunca'}</div>}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
