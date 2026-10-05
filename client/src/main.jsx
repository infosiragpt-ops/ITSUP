import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import './index.css';
import { AuthProvider, UiProvider, useAuth } from './lib/context.jsx';
import { PageLoader } from './components/ui.jsx';
import PublicLayout from './layouts/PublicLayout.jsx';
import AppLayout from './layouts/AppLayout.jsx';

const Home = lazy(() => import('./pages/public/Home.jsx'));
const Programs = lazy(() => import('./pages/public/Programs.jsx'));
const ProgramDetail = lazy(() => import('./pages/public/ProgramDetail.jsx'));
const Admission = lazy(() => import('./pages/public/Admission.jsx'));
const VirtualInfo = lazy(() => import('./pages/public/VirtualInfo.jsx'));
const Login = lazy(() => import('./pages/public/Login.jsx'));
const NotFound = lazy(() => import('./pages/public/NotFound.jsx'));

const Dashboard = lazy(() => import('./pages/app/Dashboard.jsx'));
const Courses = lazy(() => import('./pages/app/Courses.jsx'));
const CalendarPage = lazy(() => import('./pages/app/Calendar.jsx'));
const Grades = lazy(() => import('./pages/app/Grades.jsx'));
const Notifications = lazy(() => import('./pages/app/Notifications.jsx'));
const Profile = lazy(() => import('./pages/app/Profile.jsx'));
const Help = lazy(() => import('./pages/app/Help.jsx'));

const CourseLayout = lazy(() => import('./pages/app/course/CourseLayout.jsx'));
const CourseHome = lazy(() => import('./pages/app/course/CourseHome.jsx'));
const CourseContent = lazy(() => import('./pages/app/course/CourseContent.jsx'));
const CourseAssignments = lazy(() => import('./pages/app/course/CourseAssignments.jsx'));
const AssignmentDetail = lazy(() => import('./pages/app/course/AssignmentDetail.jsx'));
const CourseQuizzes = lazy(() => import('./pages/app/course/CourseQuizzes.jsx'));
const QuizDetail = lazy(() => import('./pages/app/course/QuizDetail.jsx'));
const CourseForums = lazy(() => import('./pages/app/course/CourseForums.jsx'));
const ForumThreads = lazy(() => import('./pages/app/course/ForumThreads.jsx'));
const ThreadView = lazy(() => import('./pages/app/course/ThreadView.jsx'));
const CourseSessions = lazy(() => import('./pages/app/course/CourseSessions.jsx'));
const CourseGrades = lazy(() => import('./pages/app/course/CourseGrades.jsx'));
const CoursePeople = lazy(() => import('./pages/app/course/CoursePeople.jsx'));

const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard.jsx'));
const AdminUsers = lazy(() => import('./pages/admin/AdminUsers.jsx'));
const AdminCourses = lazy(() => import('./pages/admin/AdminCourses.jsx'));
const AdminPrograms = lazy(() => import('./pages/admin/AdminPrograms.jsx'));
const AdminApplicants = lazy(() => import('./pages/admin/AdminApplicants.jsx'));
const AdminSupport = lazy(() => import('./pages/admin/AdminSupport.jsx'));
const AdminAnnouncements = lazy(() => import('./pages/admin/AdminAnnouncements.jsx'));

function RequireAuth({ children, role }) {
  const { user, ready } = useAuth();
  const loc = useLocation();
  if (!ready) return <PageLoader label="Preparando tu aula virtual…" />;
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname + loc.search }} />;
  if (role && user.role !== role) return <Navigate to="/app" replace />;
  return children;
}

function HomeRedirect() {
  const { user } = useAuth();
  return user?.role === 'admin' ? <Navigate to="/app/admin" replace /> : <Dashboard />;
}

function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route index element={<Home />} />
          <Route path="carreras" element={<Programs />} />
          <Route path="carreras/:slug" element={<ProgramDetail />} />
          <Route path="admision" element={<Admission />} />
          <Route path="aula-virtual" element={<VirtualInfo />} />
        </Route>
        <Route path="login" element={<Login />} />
        <Route path="app" element={<RequireAuth><AppLayout /></RequireAuth>}>
          <Route index element={<HomeRedirect />} />
          <Route path="inicio" element={<Dashboard />} />
          <Route path="cursos" element={<Courses />} />
          <Route path="cursos/:courseId" element={<CourseLayout />}>
            <Route index element={<CourseHome />} />
            <Route path="contenido" element={<CourseContent />} />
            <Route path="tareas" element={<CourseAssignments />} />
            <Route path="tareas/:assignmentId" element={<AssignmentDetail />} />
            <Route path="evaluaciones" element={<CourseQuizzes />} />
            <Route path="evaluaciones/:quizId" element={<QuizDetail />} />
            <Route path="foros" element={<CourseForums />} />
            <Route path="foros/:forumId" element={<ForumThreads />} />
            <Route path="foros/:forumId/:threadId" element={<ThreadView />} />
            <Route path="sesiones" element={<CourseSessions />} />
            <Route path="calificaciones" element={<CourseGrades />} />
            <Route path="participantes" element={<CoursePeople />} />
          </Route>
          <Route path="calendario" element={<CalendarPage />} />
          <Route path="calificaciones" element={<Grades />} />
          <Route path="notificaciones" element={<Notifications />} />
          <Route path="perfil" element={<Profile />} />
          <Route path="ayuda" element={<Help />} />
          <Route path="admin" element={<RequireAuth role="admin"><AdminDashboard /></RequireAuth>} />
          <Route path="admin/usuarios" element={<RequireAuth role="admin"><AdminUsers /></RequireAuth>} />
          <Route path="admin/cursos" element={<RequireAuth role="admin"><AdminCourses /></RequireAuth>} />
          <Route path="admin/carreras" element={<RequireAuth role="admin"><AdminPrograms /></RequireAuth>} />
          <Route path="admin/postulantes" element={<RequireAuth role="admin"><AdminApplicants /></RequireAuth>} />
          <Route path="admin/soporte" element={<RequireAuth role="admin"><AdminSupport /></RequireAuth>} />
          <Route path="admin/comunicados" element={<RequireAuth role="admin"><AdminAnnouncements /></RequireAuth>} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <UiProvider>
          <App />
        </UiProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);
