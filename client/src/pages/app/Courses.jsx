import { useState } from 'react';
import { Search, BookOpen } from 'lucide-react';
import { useAuth } from '../../lib/context.jsx';
import { useShell } from '../../layouts/AppLayout.jsx';
import { EmptyState, Input, PageHeader, Segmented, Skeleton } from '../../components/ui.jsx';
import { CourseCard } from '../../components/lms.jsx';

export default function Courses() {
  const { user } = useAuth();
  const { courses } = useShell();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all');
  const list = (courses || []).filter((c) => {
    if (q && !`${c.name} ${c.code} ${c.teacher?.first_name} ${c.teacher?.last_name}`.toLowerCase().includes(q.toLowerCase())) return false;
    if (filter === 'progress') return c.progress?.pct < 100;
    if (filter === 'done') return c.progress?.pct === 100;
    return true;
  });
  return (
    <div className="animate-fade-up">
      <PageHeader eyebrow={courses?.[0]?.term ? `Ciclo ${courses[0].term.name}` : 'Ciclo actual'} title="Mis cursos"
        subtitle={user.role === 'student' ? 'Todos los cursos en los que estás matriculado(a) este ciclo.' : 'Los cursos que tienes a cargo este ciclo.'} />
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative max-w-sm flex-1">
          <Search size={16} className="absolute top-1/2 left-3 -translate-y-1/2 text-faint" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar curso o docente" className="pl-9" />
        </div>
        {user.role === 'student' && (
          <Segmented value={filter} onChange={setFilter} options={[{ value: 'all', label: 'Todos' }, { value: 'progress', label: 'En curso' }, { value: 'done', label: 'Completados' }]} />
        )}
      </div>
      {courses == null ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-60 rounded-2xl" />)}</div>
      ) : list.length === 0 ? (
        <div className="card"><EmptyState icon={BookOpen} title="No encontramos cursos" description={q ? 'Prueba con otra búsqueda.' : 'Aún no tienes cursos asignados en este ciclo.'} /></div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{list.map((c) => <CourseCard key={c.id} c={c} role={user.role} />)}</div>
      )}
    </div>
  );
}
