import {
  Home as HomeIcon, UserRound, CalendarDays, Cpu, MonitorPlay, LayoutGrid, HandHeart, ArrowRight, Mail, Video, Library, LifeBuoy,
  GraduationCap, HeartHandshake, Briefcase, MessageCircle, Clock,
} from 'lucide-react';
import { useApi } from '../../lib/api.js';
import { fmtDate } from '../../lib/format.js';
import { Button, Badge, cx } from '../../components/ui.jsx';
import { CONTACT } from '../../components/brand.jsx';
import { NEEDS, FIND } from './Home.jsx';

const TABS = [
  ['inicio', 'Inicio', HomeIcon], ['estudiante', 'Información del estudiante', UserRound], ['fechas', 'Fechas importantes', CalendarDays],
  ['requisitos', 'Requisitos técnicos', Cpu], ['aula', 'Aula Virtual', MonitorPlay], ['plataformas', 'Plataformas digitales', LayoutGrid],
  ['servicios', 'Servicios al estudiante', HandHeart],
];

const TYPE = { academic: ['Académico', 'primary'], exam: ['Evaluaciones', 'danger'], event: ['Evento', 'info'], institutional: ['Institucional', 'neutral'] };

function Block({ id, title, children, tinted }) {
  return (
    <section id={id} className={cx('scroll-mt-40 py-14 sm:py-20', tinted && 'bg-sunken')}>
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <h2 className="font-display text-[1.9rem] leading-tight font-semibold text-ink sm:text-[2.3rem]">{title}</h2>
        <div className="mt-3 mb-10 h-1 w-16 rounded-full bg-primary" />
        {children}
      </div>
    </section>
  );
}

export default function VirtualInfo() {
  const { data: events } = useApi('/public/events');
  const { data: term } = useApi('/public/term');
  return (
    <>
      <div className="border-b border-line bg-gradient-to-b from-sunken to-bg" id="inicio">
        <div className="mx-auto max-w-6xl px-4 pt-14 pb-10 text-center sm:px-6">
          <div className="mb-3 text-xs font-bold tracking-[0.16em] text-primary uppercase">Zona del estudiante {term ? `· Ciclo ${term.name}` : ''}</div>
          <h1 className="font-display text-[2.4rem] leading-[1.08] font-semibold text-ink sm:text-[3.4rem]">Aula Virtual ISUP</h1>
          <p className="mx-auto mt-4 max-w-2xl text-[17px] text-muted">Todo lo que necesitas saber para empezar tus clases virtuales con el pie derecho.</p>
        </div>
      </div>

      <nav className="sticky top-[72px] z-30 border-b border-line bg-bg/90 backdrop-blur-xl md:top-[108px]" aria-label="Secciones">
        <div className="no-scrollbar mx-auto flex max-w-6xl gap-2 overflow-x-auto px-4 py-3 sm:px-6">
          {TABS.map(([id, label, Icon]) => (
            <a key={id} href={`#${id}`} className="group flex min-w-[118px] shrink-0 flex-col items-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-3 text-center text-[12.5px] leading-tight font-medium text-ink-2 transition hover:border-primary hover:bg-primary hover:text-white">
              <Icon size={22} className="text-primary transition group-hover:text-white" />
              {label}
            </a>
          ))}
        </div>
      </nav>

      <Block id="aula" title="Prepárate para tu primer día de clases">
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2">
          <div className="text-center lg:text-left">
            <h3 className="text-xl font-semibold text-ink">Inicia tus clases este ciclo aquí</h3>
            <p className="mt-3 text-muted">Ingresa con tu correo institucional o tu código de estudiante. Al entrar por primera vez verás una guía de inicio con todo lo que necesitas revisar.</p>
            <Button to="/login" size="lg" iconRight={ArrowRight} className="mt-7">Ingresa al Aula Virtual</Button>
          </div>
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#C96442] via-[#B9573A] to-[#7E3A24] p-8 text-white">
            <div className="absolute -top-12 -right-12 h-48 w-48 rounded-full bg-white/10" />
            <div className="absolute -bottom-16 -left-10 h-56 w-56 rounded-full bg-white/10" />
            <div className="relative space-y-3">
              {['Revisa el sílabo de cada curso', 'Agrega tus sesiones en vivo al calendario', 'Preséntate en el foro de cada curso', 'Configura tus notificaciones'].map((t, i) => (
                <div key={t} className="flex items-center gap-3 rounded-2xl bg-white/12 px-4 py-3 ring-1 ring-white/20 backdrop-blur">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-[13px] font-bold text-[#9A4529]">{i + 1}</span>
                  <span className="text-[15px]">{t}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Block>

      <Block id="requisitos" title="¿Qué necesito para empezar mis clases?" tinted>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {NEEDS.map((n) => (
            <div key={n.title} className="card p-6 text-center">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-info-soft text-info"><n.icon size={26} /></span>
              <h3 className="mt-4 font-semibold text-ink">{n.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{n.text}</p>
            </div>
          ))}
        </div>
        <div className="mt-8 rounded-2xl border border-line bg-surface p-6 text-center">
          <p className="text-ink-2">¿Necesitas una capacitación sobre tu aula virtual?</p>
          <Button to="/login" variant="soft" className="mt-4">Ver tutoriales dentro del aula</Button>
        </div>
      </Block>

      <Block id="estudiante" title="¿Qué encontraré en mi aula virtual?">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {FIND.map((n) => (
            <div key={n.title} className="text-center">
              <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-primary-soft text-primary"><n.icon size={34} strokeWidth={1.6} /></span>
              <h3 className="mt-5 font-semibold text-ink">{n.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{n.text}</p>
            </div>
          ))}
        </div>
      </Block>

      <Block id="fechas" title="Fechas importantes del ciclo" tinted>
        <ol className="relative space-y-4 border-l-2 border-line pl-6 sm:pl-8">
          {(events || []).map((e) => {
            const [label, tone] = TYPE[e.type] || TYPE.institutional;
            const past = new Date(`${e.end_date || e.date}T23:59:00-05:00`) < new Date();
            return (
              <li key={e.id} className={cx('relative', past && 'opacity-60')}>
                <span className={cx('absolute top-5 -left-[33px] h-4 w-4 rounded-full border-4 border-sunken sm:-left-[41px]', past ? 'bg-faint' : 'bg-primary')} />
                <div className="card flex flex-col gap-2 p-5 sm:flex-row sm:items-center">
                  <div className="w-44 shrink-0 text-sm font-semibold text-primary-ink">{fmtDate(e.date)}{e.end_date ? ` – ${fmtDate(e.end_date)}` : ''}</div>
                  <div className="flex-1">
                    <div className="font-semibold text-ink">{e.title}</div>
                    <div className="text-sm text-muted">{e.description}</div>
                  </div>
                  <Badge tone={past ? 'neutral' : tone}>{past ? 'Finalizado' : label}</Badge>
                </div>
              </li>
            );
          })}
        </ol>
      </Block>

      <Block id="plataformas" title="Plataformas digitales">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {[
            [MonitorPlay, 'Aula Virtual ISUP', 'Cursos, tareas, evaluaciones, foros y notas.', '/login'],
            [Video, 'Sesiones en vivo', 'Videoconferencias integradas desde tu calendario.', '/login'],
            [Mail, 'Correo institucional', 'Tu cuenta @isup.edu.pe para comunicaciones oficiales.', null],
            [Library, 'Biblioteca virtual', 'Libros digitales y bases de datos académicas.', null],
          ].map(([Icon, t, d, to]) => (
            <div key={t} className="card flex flex-col p-6">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-white"><Icon size={22} /></span>
              <h3 className="mt-4 font-semibold text-ink">{t}</h3>
              <p className="mt-1 flex-1 text-sm text-muted">{d}</p>
              {to ? <Button to={to} variant="soft" size="sm" className="mt-4 self-start">Ingresar</Button> : <Badge className="mt-4 self-start">Acceso con tu cuenta ISUP</Badge>}
            </div>
          ))}
        </div>
      </Block>

      <Block id="servicios" title="Servicios al estudiante" tinted>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {[
            [LifeBuoy, 'Soporte técnico', 'Ayuda con accesos, videos, entregas y evaluaciones.'],
            [GraduationCap, 'Tutoría académica', 'Acompañamiento para organizar tu tiempo y mejorar tu rendimiento.'],
            [HeartHandshake, 'Bienestar estudiantil', 'Orientación psicopedagógica y actividades de integración.'],
            [Briefcase, 'Bolsa de trabajo', 'Ofertas de prácticas y empleo de empresas aliadas.'],
          ].map(([Icon, t, d]) => (
            <div key={t} className="card p-6">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-success-soft text-success"><Icon size={22} /></span>
              <h3 className="mt-4 font-semibold text-ink">{t}</h3>
              <p className="mt-1 text-sm text-muted">{d}</p>
            </div>
          ))}
        </div>
      </Block>

      <Block id="asesoria" title="¿Dónde puedo solicitar asesoría personalizada para mi aula virtual?">
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div className="card flex gap-4 p-6">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#25D366]/15 text-[#1DA851]"><MessageCircle size={22} /></span>
            <div>
              <h3 className="font-semibold text-ink">WhatsApp {CONTACT.whatsappLabel}</h3>
              <p className="mt-1 text-sm text-muted">Escríbenos y elige la opción “Aula Virtual”. Agrega este número a tus contactos.</p>
            </div>
          </div>
          <div className="card flex gap-4 p-6">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary"><Clock size={22} /></span>
            <div>
              <h3 className="font-semibold text-ink">Solicitud de soporte en línea</h3>
              <p className="mt-1 text-sm text-muted">Desde tu aula, entra a <strong className="text-ink">Ayuda y soporte</strong> y registra tu caso. Te respondemos en menos de 24 horas.</p>
            </div>
          </div>
        </div>
      </Block>
    </>
  );
}
