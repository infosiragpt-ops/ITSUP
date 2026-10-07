import { useState } from 'react';
import { Search, BookOpen, History } from 'lucide-react';
import { useAuth } from '../../lib/context.jsx';
import { useApi } from '../../lib/api.js';
import { useShell } from '../../layouts/AppLayout.jsx';
import { EmptyState, Input, PageHeader, Segmented, Skeleton } from '../../components/ui.jsx';
import { CourseCard } from '../../components/lms.jsx';

export default function Courses() {
  const { user } = useAuth();
  const shell = useShell();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all');
  const [scope, setScope] = useState('current');
  const past = useApi(scope === 'past' ? '/courses?term=all' : null);
  const courses = scope === 'past' ? (past.data ? past.data.filter((c) => !c.term?.is_active) : null) : shell.courses;
  const list = (courses || []).filter((c) => {
    if (q && !`${c.name} ${c.code} ${c.teacher?.first_name} ${c.teacher?.last_name}`.toLowerCase().includes(q.toLowerCase())) return false;
    if (filter === 'progress') return c.progress?.pct < 100;
    if (filter === 'done') return c.progress?.pct === 100;
    return true;
  });
  const termName = shell.courses?.find((c) => c.term?.is_active)?.term?.name;
  return (
    <div className="animate-fade-up">
      <PageHeader eyebrow={termName ? `Periodo ${termName}` : 'Periodo actual'} title="Mis cursos"
        subtitle={user.role === 'student' ? 'Las unidades didácticas en las que estás matriculado(a). Los periodos anteriores quedan disponibles para consulta.' : 'Las unidades didácticas que tienes a cargo. Los periodos anteriores quedan disponibles para consulta.'}
        actions={<Segmented value={scope} onChange={setScope} options={[{ value: 'current', label: 'Periodo actual' }, { value: 'past', label: 'Anteriores' }]} />} />
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative max-w-sm flex-1">
          <Search size={16} className="absolute top-1/2 left-3 -translate-y-1/2 text-faint" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar curso o docente" className="pl-9" />
        </div>
        {user.role === 'student' && scope === 'current' && (
          <Segmented value={filter} onChange={setFilter} options={[{ value: 'all', label: 'Todos' }, { value: 'progress', label: 'En curso' }, { value: 'done', label: 'Completados' }]} />
        )}
      </div>
      {courses == null ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-60 rounded-2xl" />)}</div>
      ) : list.length === 0 ? (
        <div className="card"><EmptyState icon={scope === 'past' ? History : BookOpen} title="No encontramos cursos" description={q ? 'Prueba con otra búsqueda.' : scope === 'past' ? 'No tienes cursos en periodos anteriores.' : 'Aún no tienes cursos asignados en este periodo.'} /></div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{list.map((c) => <CourseCard key={c.id} c={c} role={user.role} />)}</div>
      )}
    </div>
  );
}
