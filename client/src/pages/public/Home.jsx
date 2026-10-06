import { useState } from 'react';
import {
  ArrowRight, Laptop, Globe, Headphones, Camera, Video, ClipboardCheck, BookOpenText, MessagesSquare,
  Lightbulb, TrendingUp, MonitorSmartphone, BadgeCheck, Plus, Minus, CalendarCheck, UserRoundCheck, KeyRound, Sparkles,
} from 'lucide-react';
import HeroCarousel from '../../components/HeroCarousel.jsx';
import { ProgramsExplorer } from '../../components/programs.jsx';
import { Button, cx } from '../../components/ui.jsx';
import { useApi } from '../../lib/api.js';

export function Section({ id, eyebrow, title, subtitle, children, className, center }) {
  return (
    <section id={id} className={cx('scroll-mt-24 py-16 sm:py-24', className)}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        {(title || eyebrow) && (
          <div className={cx('mb-10 sm:mb-14', center && 'mx-auto max-w-2xl text-center')}>
            {eyebrow && <div className="mb-3 text-xs font-bold tracking-[0.16em] text-primary uppercase">{eyebrow}</div>}
            {title && <h2 className="font-display text-[2rem] leading-tight font-semibold text-ink sm:text-[2.6rem]">{title}</h2>}
            {!center && <div className="mt-4 h-1 w-16 rounded-full bg-primary" />}
            {subtitle && <p className={cx('mt-4 text-[16.5px] leading-relaxed text-muted', !center && 'max-w-2xl')}>{subtitle}</p>}
          </div>
        )}
        {children}
      </div>
    </section>
  );
}

const PILLARS = [
  { icon: Lightbulb, title: 'Educación innovadora', text: 'Metodologías activas y proyectos reales desde el primer ciclo.' },
  { icon: TrendingUp, title: 'Empleabilidad', text: 'Prácticas, ferias laborales y bolsa de trabajo con empresas aliadas.' },
  { icon: MonitorSmartphone, title: 'Aula virtual propia', text: 'Diseñada para estudiar desde el celular o la laptop, a tu ritmo.' },
  { icon: BadgeCheck, title: 'Título a nombre de la Nación', text: 'Formación técnica con respaldo académico institucional.' },
];

export const NEEDS = [
  { icon: Laptop, title: 'Un dispositivo con internet', text: 'Computadora, laptop, tablet o smartphone con conexión de al menos 10 Mbps. De preferencia, con cable de red durante tus evaluaciones.' },
  { icon: Globe, title: 'Google Chrome actualizado', text: 'Usa la última versión del navegador para que las sesiones en vivo y los videos funcionen sin interrupciones.' },
  { icon: Headphones, title: 'Audífonos con micrófono', text: 'Un headset mejora el sonido y tu participación en las clases en vivo.' },
  { icon: Camera, title: 'Cámara web', text: 'Necesaria para las evaluaciones supervisadas y para presentar tus proyectos.' },
];

export const FIND = [
  { icon: Video, title: 'Sesiones en vivo', text: 'Videoconferencias donde interactúas con tus compañeros y docentes. Únete con un clic desde tu calendario.' },
  { icon: ClipboardCheck, title: 'Tareas y cuestionarios', text: 'Entregas con fecha clara, recordatorios y calificación con retroalimentación personalizada.' },
  { icon: BookOpenText, title: 'Lecturas y videos', text: 'Contenido organizado por unidades, con tu progreso guardado para continuar donde lo dejaste.' },
  { icon: MessagesSquare, title: 'Foros', text: 'Resuelve dudas, debate y comparte tus trabajos con toda la clase.' },
];

// Logos oficiales de cada institución (marcas registradas de sus titulares), en client/public/img/socios/
const PARTNERS = [
  { name: 'Universidad Continental', logo: '/img/socios/continental.svg', logoClass: 'h-10', text: 'Continuidad de estudios superiores universitarios.' },
  { name: 'Universidad César Vallejo', logo: '/img/socios/ucv.png', logoClass: 'h-9', text: 'Continuidad de estudios superiores universitarios.' },
  { name: 'Universidad Privada del Norte', logo: '/img/socios/upn.svg', logoClass: 'h-[68px] rounded-md', text: 'Continuidad de estudios superiores universitarios.' },
];

const FAQ = [
  ['¿Las clases son realmente 100% virtuales?', 'Sí. Todas las clases, evaluaciones y trámites se realizan en línea a través del Aula Virtual ISUP. Las sesiones en vivo se programan en horario nocturno y fines de semana para que puedas estudiar y trabajar.'],
  ['¿Qué pasa si no puedo asistir a una sesión en vivo?', 'Los materiales de cada unidad (lecturas, videos y recursos) están disponibles 24/7. Además, tu docente puede publicar la grabación de la sesión y responder tus dudas en el foro del curso.'],
  ['¿Cómo ingreso al aula virtual?', 'Al matricularte recibirás tu código de estudiante y tu correo institucional. Con ellos ingresas desde el botón “Ingresar” de esta página. Si olvidas tu contraseña, nuestro equipo de soporte te ayuda.'],
  ['¿Cómo se califica?', 'Usamos la escala vigesimal (0 a 20). Tu nota del curso es el promedio de tareas y cuestionarios, y puedes seguirla en tiempo real desde la sección Calificaciones.'],
  ['¿Puedo estudiar desde el celular?', 'Sí. El aula virtual está diseñada para funcionar en celulares, tablets y computadoras. Para las evaluaciones supervisadas recomendamos usar una computadora con cámara.'],
];

export default function Home() {
  const { data: programs } = useApi('/public/programs');
  return (
    <>
      <HeroCarousel />

      {/* Pillars strip */}
      <div className="relative z-10 mx-auto -mt-2 max-w-7xl px-4 sm:px-6">
        <div className="grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-line bg-line shadow-lift sm:grid-cols-2 lg:grid-cols-4">
          {PILLARS.map((p) => (
            <div key={p.title} className="flex gap-4 bg-surface p-6">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary"><p.icon size={21} /></span>
              <div>
                <div className="font-semibold text-ink">{p.title}</div>
                <p className="mt-1 text-sm leading-relaxed text-muted">{p.text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Programs */}
      <Section id="carreras" eyebrow="Carreras técnicas" title="Elige la carrera que impulsa tu futuro"
        subtitle="Seis carreras de 3 años diseñadas con empresas, 100% virtuales y con horarios pensados para quienes estudian y trabajan.">
        <ProgramsExplorer programs={programs} />
      </Section>

      {/* Aula virtual */}
      <section id="aula" className="scroll-mt-24 bg-sunken py-16 sm:py-24">
        <div className="mx-auto grid grid-cols-1 max-w-7xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2">
          <div>
            <div className="mb-3 text-xs font-bold tracking-[0.16em] text-primary uppercase">Aula Virtual ISUP</div>
            <h2 className="font-display text-[2rem] leading-tight font-semibold text-ink sm:text-[2.6rem]">Prepárate para tu primer día de clases</h2>
            <div className="mt-4 h-1 w-16 rounded-full bg-primary" />
            <p className="mt-5 text-[16.5px] leading-relaxed text-muted">
              Nuestra plataforma reúne en un solo lugar tus cursos, clases en vivo, tareas y calificaciones. Al ingresar por primera vez, una guía te acompaña paso a paso para que no te pierdas de nada.
            </p>
            <ol className="mt-8 space-y-5">
              {[
                [KeyRound, 'Recibe tus accesos', 'Tu código de estudiante y correo institucional llegan a tu correo personal al matricularte.'],
                [UserRoundCheck, 'Completa tu checklist de inicio', 'Verifica tu equipo, actualiza tu perfil y conoce a tus docentes.'],
                [CalendarCheck, 'Únete a tu primera sesión', 'Tu calendario te muestra cada clase en vivo con un botón para ingresar.'],
              ].map(([Icon, t, d], i) => (
                <li key={t} className="flex gap-4">
                  <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface text-primary shadow-soft ring-1 ring-line">
                    <Icon size={19} />
                    <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-white">{i + 1}</span>
                  </span>
                  <div><div className="font-semibold text-ink">{t}</div><p className="text-sm text-muted">{d}</p></div>
                </li>
              ))}
            </ol>
            <div className="mt-9 flex flex-wrap gap-3">
              <Button to="/login" size="lg" iconRight={ArrowRight}>Ingresa al Aula Virtual</Button>
              <Button to="/aula-virtual" size="lg" variant="secondary">Guía completa</Button>
            </div>
          </div>
          <AulaPreview />
        </div>
      </section>

      <Section id="requisitos" eyebrow="Antes de empezar" title="¿Qué necesito para empezar mis clases?">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {NEEDS.map((n) => (
            <div key={n.title} className="card p-6 transition hover:-translate-y-0.5 hover:shadow-lift">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-info-soft text-info"><n.icon size={22} /></span>
              <h3 className="mt-5 font-semibold text-ink">{n.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{n.text}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section className="!pt-0" eyebrow="Tu aula" title="¿Qué encontrarás en tu aula virtual?">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {FIND.map((n, i) => (
            <div key={n.title} className="group relative overflow-hidden rounded-2xl border border-line bg-surface p-6">
              <div className="absolute -top-10 -right-10 h-28 w-28 rounded-full bg-primary-soft transition-transform duration-500 group-hover:scale-150" />
              <span className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-white"><n.icon size={22} /></span>
              <div className="relative mt-5 text-xs font-semibold text-faint">0{i + 1}</div>
              <h3 className="relative mt-1 font-semibold text-ink">{n.title}</h3>
              <p className="relative mt-2 text-sm leading-relaxed text-muted">{n.text}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Partners */}
      <section id="nosotros" className="scroll-mt-24 bg-[color-mix(in_srgb,var(--c-info-soft)_55%,var(--c-bg))] py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <div className="mb-3 text-xs font-bold tracking-[0.16em] text-info uppercase">Respaldo académico</div>
            <h2 className="font-display text-[2rem] leading-tight font-semibold text-ink sm:text-[2.6rem]">Socios estratégicos</h2>
            <p className="mt-4 text-[16.5px] leading-relaxed text-muted">
              Nuestros egresados cuentan con título a nombre de la Nación, carné institucional y la posibilidad de continuar sus estudios gracias a nuestros socios estratégicos.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            {PARTNERS.map((p) => (
              <div key={p.name} className="card flex flex-col items-center p-6 text-center transition hover:-translate-y-0.5 hover:shadow-lift sm:p-7">
                <div className="flex h-28 w-full items-center justify-center rounded-xl bg-white px-6 ring-1 ring-[#E8E5DA]">
                  <img src={p.logo} alt={`Logo de ${p.name}`} loading="lazy" decoding="async" className={cx('w-auto max-w-full object-contain', p.logoClass)} />
                </div>
                <h3 className="mt-5 text-lg font-semibold text-ink">{p.name}</h3>
                <p className="mt-2 text-sm text-muted">{p.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Admission steps */}
      <Section eyebrow="Admisión" title="Postula en 4 pasos, sin salir de casa" center>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-4">
          {[
            ['Elige tu carrera', 'Revisa el plan de estudios y el campo laboral.'],
            ['Completa el formulario', 'Te toma menos de 3 minutos.'],
            ['Conversa con un asesor', 'Resolvemos tus dudas y te contamos sobre becas.'],
            ['Matricúlate', 'Recibe tus accesos al aula virtual ISUP.'],
          ].map(([t, d], i) => (
            <div key={t} className="relative text-center">
              {i < 3 && <div className="absolute top-7 left-[calc(50%+36px)] hidden h-px w-[calc(100%-72px)] border-t-2 border-dashed border-line-strong md:block" />}
              <div className="font-display mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary text-2xl font-semibold text-white shadow-[0_10px_24px_-10px_var(--c-primary)]">{i + 1}</div>
              <h3 className="mt-4 font-semibold text-ink">{t}</h3>
              <p className="mt-1 text-sm text-muted">{d}</p>
            </div>
          ))}
        </div>
        <div className="relative mt-16 overflow-hidden rounded-3xl bg-night px-6 py-12 text-center sm:px-12">
          <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-[#C96442]/40 blur-3xl" />
          <div className="absolute -right-24 -bottom-24 h-72 w-72 rounded-full bg-[#C96442]/25 blur-3xl" />
          <div className="relative">
            <Sparkles className="mx-auto text-[#E8916F]" />
            <h3 className="font-display mt-3 text-3xl font-semibold text-white sm:text-4xl">¿List@ para empezar?</h3>
            <p className="mx-auto mt-3 max-w-lg text-white/70">Déjanos tus datos y un asesor te contactará en menos de 24 horas.</p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <Button to="/admision" size="lg" iconRight={ArrowRight}>Postula a ISUP</Button>
              <Button to="/carreras" size="lg" variant="white">Ver carreras</Button>
            </div>
          </div>
        </div>
      </Section>

      <Section className="!pt-0" eyebrow="Preguntas frecuentes" title="Resolvemos tus dudas" center>
        <FaqList items={FAQ} />
      </Section>
    </>
  );
}

export function FaqList({ items }) {
  const [open, setOpen] = useState(0);
  return (
    <div className="mx-auto max-w-3xl divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
      {items.map(([q, a], i) => (
        <div key={q}>
          <button onClick={() => setOpen(open === i ? -1 : i)} className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left" aria-expanded={open === i}>
            <span className="font-semibold text-ink">{q}</span>
            <span className={cx('flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition', open === i ? 'bg-primary text-white' : 'bg-sunken text-muted')}>
              {open === i ? <Minus size={16} /> : <Plus size={16} />}
            </span>
          </button>
          <div className={cx('grid transition-all duration-300', open === i ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0')}>
            <div className="overflow-hidden"><p className="px-6 pb-5 text-[15px] leading-relaxed text-muted">{a}</p></div>
          </div>
        </div>
      ))}
    </div>
  );
}

function AulaPreview() {
  return (
    <div className="relative">
      <div className="absolute -inset-2 -z-0 sm:-inset-6 rounded-[2rem] bg-gradient-to-br from-primary/15 to-transparent blur-2xl" />
      <div className="card relative overflow-hidden">
        <div className="flex items-center gap-2 border-b border-line bg-sunken/70 px-4 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-[#E8B4A0]" /><span className="h-2.5 w-2.5 rounded-full bg-[#E9D7A7]" /><span className="h-2.5 w-2.5 rounded-full bg-[#BFD3BE]" />
          <span className="ml-2 rounded-md bg-surface px-3 py-1 text-[11px] text-faint ring-1 ring-line">aula.isup.edu.pe</span>
        </div>
        <div className="grid grid-cols-[120px_1fr] sm:grid-cols-[150px_1fr]">
          <div className="space-y-1 border-r border-line bg-sunken/40 p-3 text-[12px]">
            {['Inicio', 'Mis cursos', 'Calendario', 'Calificaciones', 'Ayuda'].map((x, i) => (
              <div key={x} className={cx('rounded-lg px-2.5 py-1.5', i === 0 ? 'bg-surface font-semibold text-ink shadow-soft' : 'text-muted')}>{x}</div>
            ))}
          </div>
          <div className="space-y-3 p-4">
            <div className="font-display text-lg font-semibold text-ink">Buenas noches, Valeria 👋</div>
            <div className="flex items-center gap-3 rounded-xl border border-danger/20 bg-danger-soft p-3">
              <span className="animate-live h-2.5 w-2.5 rounded-full bg-danger" />
              <div className="flex-1 text-[12.5px]"><span className="font-semibold text-ink">En vivo ahora</span> <span className="text-muted">· Desarrollo Web</span></div>
              <span className="rounded-lg bg-danger px-2.5 py-1 text-[11px] font-semibold text-white">Unirme</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[['Promedio', '16.4', 'text-success'], ['Progreso', '62%', 'text-primary']].map(([l, v, c]) => (
                <div key={l} className="rounded-xl border border-line p-3">
                  <div className="text-[11px] text-muted">{l}</div>
                  <div className={cx('text-xl font-semibold', c)}>{v}</div>
                </div>
              ))}
            </div>
            <div className="rounded-xl border border-line p-3">
              <div className="mb-2 text-[11px] font-semibold text-muted">Próximas entregas</div>
              {[['Tarea 3 · API REST', 'en 3 días', 'bg-warn-soft text-warn'], ['Cuestionario 2', 'en 5 días', 'bg-sunken text-muted']].map(([t, d, c]) => (
                <div key={t} className="flex items-center justify-between py-1 text-[12.5px]">
                  <span className="text-ink">{t}</span><span className={cx('rounded-full px-2 py-px text-[10.5px] font-medium', c)}>{d}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
