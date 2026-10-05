import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, ChevronLeft, ChevronRight, Pause, Play, Video, CheckCircle2, CalendarDays, MessagesSquare, Mic, Award, Sparkles, Clock, BookOpen,
} from 'lucide-react';
import { cx } from './ui.jsx';

const DURATION = 7000;

function nextTermName() {
  const d = new Date();
  return d.getMonth() >= 6 ? `${d.getFullYear() + 1}-I` : `${d.getFullYear()}-II`;
}

const SLIDES = [
  {
    id: 'virtual',
    theme: 'light',
    bg: 'linear-gradient(120deg,#F4F1E8 0%,#F3E7DD 55%,#EED8CB 100%)',
    eyebrow: 'Carreras técnicas 100% virtuales',
    title: ['Estudia tu carrera técnica ', 'desde donde estés', '.'],
    text: 'Clases en vivo por las noches, contenidos disponibles 24/7 y un aula virtual que te acompaña en cada paso. Tú pones las metas; nosotros, el camino.',
    cta: [{ to: '/carreras', label: 'Conoce las carreras' }, { to: '/admision', label: 'Postula ahora', secondary: true }],
    Visual: VisualDashboard,
  },
  {
    id: 'aula',
    theme: 'dark',
    bg: 'radial-gradient(ellipse at 80% 20%,rgba(217,119,87,.35),transparent 55%),linear-gradient(135deg,#1F1E1D,#2A2826)',
    eyebrow: 'Aula Virtual ISUP',
    title: ['Todo tu ciclo, ', 'en un solo lugar', '.'],
    text: 'Sesiones en vivo, tareas, cuestionarios, foros y calificaciones con recordatorios inteligentes. Diseñada para usarse igual de bien en el celular que en la laptop.',
    cta: [{ to: '/aula-virtual', label: 'Conoce el aula virtual' }, { to: '/login', label: 'Ingresar', secondary: true }],
    Visual: VisualLive,
  },
  {
    id: 'docentes',
    theme: 'light',
    bg: 'linear-gradient(120deg,#EEF0E8 0%,#E3E9E0 60%,#D7E1D5 100%)',
    eyebrow: 'Docentes de la industria',
    title: ['Aprende de quienes ', 'trabajan en lo que enseñan', '.'],
    text: 'Profesionales en actividad que comparten casos reales, te retroalimentan en cada entrega y responden tus dudas en los foros del curso.',
    cta: [{ to: '/#nosotros', label: 'Por qué ISUP' }, { to: '/carreras', label: 'Ver plan de estudios', secondary: true }],
    Visual: VisualMentor,
  },
  {
    id: 'admision',
    theme: 'clay',
    bg: 'radial-gradient(ellipse at 15% 85%,rgba(255,255,255,.14),transparent 50%),linear-gradient(135deg,#C96442,#A9492D)',
    eyebrow: `Admisión ${nextTermName()}`,
    title: ['Tu futuro empieza ', 'con una decisión', '.'],
    text: 'Postula en minutos, sin exámenes presenciales. Un asesor te acompañará en todo el proceso y te contará sobre nuestras becas y facilidades de pago.',
    cta: [{ to: '/admision', label: 'Postula a ISUP' }, { to: '/carreras', label: 'Explorar carreras', secondary: true }],
    Visual: VisualAdmission,
  },
];

export default function HeroCarousel() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hover, setHover] = useState(false);
  const touch = useRef(null);
  const go = useCallback((i) => setIndex((i + SLIDES.length) % SLIDES.length), []);
  const running = !paused && !hover;

  useEffect(() => {
    if (!running) return;
    const t = setTimeout(() => go(index + 1), DURATION);
    return () => clearTimeout(t);
  }, [index, running, go]);

  const onKey = (e) => {
    if (e.key === 'ArrowRight') go(index + 1);
    if (e.key === 'ArrowLeft') go(index - 1);
  };
  const slide = SLIDES[index];
  const dark = slide.theme !== 'light';

  return (
    <section
      className="relative isolate overflow-hidden"
      aria-roledescription="carrusel" aria-label="Destacados ISUP"
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} onKeyDown={onKey}
      onTouchStart={(e) => (touch.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touch.current == null) return;
        const dx = e.changedTouches[0].clientX - touch.current;
        if (Math.abs(dx) > 50) go(index + (dx < 0 ? 1 : -1));
        touch.current = null;
      }}
    >
      {SLIDES.map((s, i) => (
        <div key={s.id} className={cx('absolute inset-0 -z-10 transition-opacity duration-1000', i === index ? 'opacity-100' : 'opacity-0')} style={{ background: s.bg }} aria-hidden />
      ))}

      <div className="relative mx-auto grid grid-cols-1 min-h-[620px] max-w-7xl items-center gap-10 px-4 pt-12 pb-24 sm:px-6 md:min-h-[600px] lg:min-h-[640px] lg:grid-cols-[1.05fr_1fr] lg:pt-10">
        {SLIDES.map((s, i) => {
          const active = i === index;
          const isDark = s.theme !== 'light';
          return (
            <div key={s.id} role="group" aria-roledescription="diapositiva" aria-label={`${i + 1} de ${SLIDES.length}`} aria-hidden={!active}
              className={cx('col-start-1 row-start-1 transition-all duration-700', active ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-4 opacity-0')}>
              <div className={cx('mb-5 inline-flex items-center gap-2 rounded-full px-3 py-1 text-[12.5px] font-semibold tracking-wide',
                isDark ? 'bg-white/12 text-white ring-1 ring-white/20' : 'bg-white/70 text-[#9A4529] ring-1 ring-[#C96442]/20')}>
                <Sparkles size={14} /> {s.eyebrow}
              </div>
              <h1 className={cx('font-display text-[2.6rem] leading-[1.05] font-semibold sm:text-[3.4rem] lg:text-[4rem]', isDark ? 'text-white' : 'text-[#141413]')}>
                {s.title[0]}
                <em className={cx('font-medium', s.theme === 'clay' ? 'text-[#FCE3D6]' : isDark ? 'text-[#E8916F]' : 'text-[#C96442]')}>{s.title[1]}</em>
                {s.title[2]}
              </h1>
              <p className={cx('mt-5 max-w-xl text-[17px] leading-relaxed', isDark ? 'text-white/78' : 'text-[#3D3D3A]')}>{s.text}</p>
              <div className="mt-8 flex flex-wrap gap-3">
                {s.cta.map((c) => (
                  <Link key={c.label} to={c.to} tabIndex={active ? 0 : -1}
                    className={cx('inline-flex h-12 items-center gap-2 rounded-xl px-6 text-[15px] font-semibold transition active:scale-[.98]',
                      c.secondary
                        ? isDark ? 'text-white ring-1 ring-white/35 hover:bg-white/10' : 'text-[#141413] ring-1 ring-[#141413]/20 hover:bg-white/60'
                        : s.theme === 'clay' ? 'bg-white text-[#9A4529] hover:bg-[#FFF5EF]' : 'bg-[#C96442] text-white shadow-[0_8px_24px_-8px_rgba(201,100,66,.7)] hover:bg-[#B4553A]')}>
                    {c.label} {!c.secondary && <ArrowRight size={17} />}
                  </Link>
                ))}
              </div>
            </div>
          );
        })}

        <div className="relative hidden h-[460px] md:block lg:h-[500px]">
          {SLIDES.map((s, i) => (
            <div key={s.id} aria-hidden className={cx('absolute inset-0 transition-all duration-700', i === index ? 'scale-100 opacity-100' : 'pointer-events-none scale-95 opacity-0')}>
              <s.Visual active={i === index} />
            </div>
          ))}
        </div>
      </div>

      {/* Controls */}
      <div className="absolute inset-x-0 bottom-6">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 sm:px-6">
          <div className="flex flex-1 gap-2 sm:max-w-md">
            {SLIDES.map((s, i) => (
              <button key={s.id} onClick={() => go(i)} aria-label={`Ir a la diapositiva ${i + 1}: ${s.eyebrow}`} aria-current={i === index}
                className="group flex-1 py-2 text-left">
                <span className={cx('block h-1 overflow-hidden rounded-full', dark ? 'bg-white/25' : 'bg-[#141413]/12')}>
                  <span key={`${index}-${i}-${running}`}
                    className={cx('block h-full origin-left rounded-full', dark ? 'bg-white' : 'bg-[#C96442]', i < index ? 'scale-x-100' : i > index ? 'scale-x-0' : running ? '' : 'scale-x-100')}
                    style={i === index && running ? { animation: `progress ${DURATION}ms linear forwards` } : undefined} />
                </span>
                <span className={cx('mt-2 hidden truncate text-[11.5px] font-medium lg:block', dark ? (i === index ? 'text-white' : 'text-white/55') : i === index ? 'text-[#141413]' : 'text-[#141413]/50')}>
                  {s.eyebrow}
                </span>
              </button>
            ))}
          </div>
          <div className="ml-auto flex gap-1.5">
            {[
              { icon: paused ? Play : Pause, label: paused ? 'Reanudar' : 'Pausar', on: () => setPaused((p) => !p) },
              { icon: ChevronLeft, label: 'Anterior', on: () => go(index - 1) },
              { icon: ChevronRight, label: 'Siguiente', on: () => go(index + 1) },
            ].map((b) => (
              <button key={b.label} onClick={b.on} aria-label={b.label}
                className={cx('flex h-10 w-10 items-center justify-center rounded-full backdrop-blur transition',
                  dark ? 'bg-white/10 text-white ring-1 ring-white/20 hover:bg-white/20' : 'bg-white/70 text-[#141413] ring-1 ring-[#141413]/10 hover:bg-white')}>
                <b.icon size={18} />
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ----------------------------- Slide visuals ----------------------------- */

const glass = 'rounded-2xl bg-white shadow-[0_24px_60px_-20px_rgba(20,20,19,.35)] ring-1 ring-[#141413]/5';

function VisualDashboard() {
  return (
    <div className="absolute inset-0">
      <div className="absolute top-6 right-0 h-[380px] w-[380px] rounded-full bg-[#C96442]/15 blur-3xl" />
      <div className={cx(glass, 'absolute top-10 right-4 left-6 p-5 lg:left-10')}>
        <div className="mb-4 flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-[#E8B4A0]" /><span className="h-2.5 w-2.5 rounded-full bg-[#E9D7A7]" /><span className="h-2.5 w-2.5 rounded-full bg-[#BFD3BE]" />
          <span className="ml-3 h-5 flex-1 rounded-md bg-[#F4F2EA]" />
        </div>
        <div className="font-display text-xl font-semibold text-[#141413]">Buenas noches, Valeria</div>
        <div className="text-[13px] text-[#6F6E68]">Tienes 2 entregas esta semana y una clase en vivo hoy.</div>
        <div className="mt-4 grid grid-cols-3 gap-3">
          {[['Desarrollo Web', '#C96442', 68], ['Base de Datos', '#2F6F8F', 54], ['Diseño UX/UI', '#8B4C6B', 75]].map(([n, c, p]) => (
            <div key={n} className="overflow-hidden rounded-xl ring-1 ring-[#E8E5DA]">
              <div className="h-12" style={{ background: `linear-gradient(135deg,${c},${c}cc)` }} />
              <div className="p-2.5">
                <div className="truncate text-[12px] font-semibold text-[#141413]">{n}</div>
                <div className="mt-2 h-1.5 rounded-full bg-[#F4F2EA]"><div className="h-full rounded-full" style={{ width: `${p}%`, background: c }} /></div>
                <div className="mt-1 text-[10.5px] text-[#9A988F]">{p}% completado</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className={cx(glass, 'animate-float absolute bottom-16 left-0 flex items-center gap-3 px-4 py-3')}>
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FBE3DE] text-[#B03E35]"><Video size={19} /></span>
        <div>
          <div className="flex items-center gap-1.5 text-[13px] font-semibold text-[#141413]"><span className="h-2 w-2 rounded-full bg-[#B03E35]" /> En vivo · 19:00</div>
          <div className="text-[11.5px] text-[#6F6E68]">Desarrollo Web Full Stack</div>
        </div>
      </div>
      <div className={cx(glass, 'absolute right-10 bottom-4 flex items-center gap-3 px-4 py-3')} style={{ animation: 'float 7s ease-in-out infinite 1.5s' }}>
        <CheckCircle2 size={22} className="text-[#3F7A4F]" />
        <div>
          <div className="text-[13px] font-semibold text-[#141413]">Tarea entregada</div>
          <div className="text-[11.5px] text-[#6F6E68]">Landing page responsive · 18/20</div>
        </div>
      </div>
    </div>
  );
}

function VisualLive() {
  const people = [['VM', '#C96442'], ['DC', '#5B7B6F'], ['CR', '#6A5ACD'], ['LF', '#B8860B'], ['MV', '#2F6F8F'], ['XP', '#8B4C6B']];
  return (
    <div className="absolute inset-0">
      <div className="absolute top-8 right-2 left-8 rounded-2xl bg-[#30302E] p-4 shadow-[0_30px_80px_-20px_rgba(0,0,0,.6)] ring-1 ring-white/10">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-[13px] font-semibold text-white"><span className="animate-live h-2.5 w-2.5 rounded-full bg-[#E57C72]" /> Sesión en vivo · Base de Datos</div>
          <span className="rounded-md bg-white/10 px-2 py-0.5 text-[11px] text-white/70">42:18</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {people.map(([n, c], i) => (
            <div key={n} className={cx('relative flex aspect-video items-center justify-center rounded-xl', i === 0 ? 'ring-2 ring-[#E8916F]' : '')} style={{ background: `${c}33` }}>
              <span className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold text-white" style={{ background: c }}>{n}</span>
              <span className="absolute bottom-1.5 left-1.5 rounded bg-black/40 px-1.5 text-[9.5px] text-white">{i === 0 ? 'Prof. Jorge' : 'Estudiante'}</span>
              {i === 2 && <Mic size={12} className="absolute top-1.5 right-1.5 text-white/80" />}
            </div>
          ))}
        </div>
      </div>
      <div className="animate-float absolute bottom-14 left-0 w-[260px] rounded-2xl bg-white p-4 shadow-[0_24px_60px_-20px_rgba(0,0,0,.6)]">
        <div className="mb-2 flex items-center gap-2 text-[12px] font-semibold text-[#6F6E68]"><MessagesSquare size={14} /> Foro de consultas</div>
        <div className="text-[13px] leading-snug text-[#141413]">“¿Diferencia entre WHERE y HAVING?”</div>
        <div className="mt-2 rounded-lg bg-[#F6E8E1] px-3 py-2 text-[12px] text-[#9A4529]">WHERE filtra filas; HAVING filtra grupos ✓</div>
      </div>
      <div className="absolute right-6 bottom-6 flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-[0_24px_60px_-20px_rgba(0,0,0,.6)]" style={{ animation: 'float 7s ease-in-out infinite 1s' }}>
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F6E8E1] text-[#C96442]"><CalendarDays size={19} /></span>
        <div><div className="text-[13px] font-semibold text-[#141413]">Recordatorio</div><div className="text-[11.5px] text-[#6F6E68]">Cuestionario 2 vence mañana</div></div>
      </div>
    </div>
  );
}

function VisualMentor() {
  return (
    <div className="absolute inset-0">
      <div className="absolute top-10 right-10 h-[340px] w-[340px] rounded-full bg-[#5B7B6F]/20 blur-3xl" />
      <div className={cx(glass, 'absolute top-8 left-8 w-[300px] p-5')}>
        <div className="flex items-center gap-3">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#C96442] text-lg font-semibold text-white">CR</span>
          <div>
            <div className="font-semibold text-[#141413]">Ing. Carla Ramírez</div>
            <div className="text-[12px] text-[#6F6E68]">10 años en desarrollo web</div>
          </div>
        </div>
        <div className="mt-4 rounded-xl bg-[#F4F2EA] p-3 text-[13px] leading-relaxed text-[#3D3D3A]">
          “Excelente uso de Grid. Para la siguiente entrega, cuida el contraste del botón principal.”
        </div>
        <div className="mt-3 flex items-center justify-between text-[12px]">
          <span className="rounded-full bg-[#E5EFE6] px-2 py-0.5 font-semibold text-[#3F7A4F]">Nota 18/20</span>
          <span className="text-[#9A988F]">Retroalimentación en 48 h</span>
        </div>
      </div>
      <div className={cx(glass, 'animate-float absolute right-0 bottom-24 w-[250px] p-4')}>
        <div className="mb-3 flex items-center gap-2 text-[12px] font-semibold text-[#6F6E68]"><BookOpen size={14} /> Unidad 3 · Backend</div>
        {['Tu primera API REST', 'Middlewares y JWT', 'Conectando el frontend'].map((t, i) => (
          <div key={t} className="flex items-center gap-2 py-1.5 text-[13px] text-[#141413]">
            <CheckCircle2 size={16} className={i < 2 ? 'text-[#3F7A4F]' : 'text-[#D8D4C6]'} /> {t}
          </div>
        ))}
      </div>
      <div className={cx(glass, 'absolute bottom-4 left-16 flex items-center gap-3 px-4 py-3')} style={{ animation: 'float 7s ease-in-out infinite 2s' }}>
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F7EDD8] text-[#A86A12]"><Award size={19} /></span>
        <div><div className="text-[13px] font-semibold text-[#141413]">Título a nombre de la Nación</div><div className="text-[11.5px] text-[#6F6E68]">Profesional técnico</div></div>
      </div>
    </div>
  );
}

function VisualAdmission() {
  const steps = ['Completa tu solicitud', 'Habla con un asesor', 'Envía tus documentos', 'Recibe tu código ISUP'];
  return (
    <div className="absolute inset-0">
      <div className="absolute top-8 right-4 left-10 rounded-2xl bg-white p-6 shadow-[0_30px_80px_-20px_rgba(60,20,10,.55)]">
        <div className="text-[12px] font-semibold tracking-[0.12em] text-[#C96442] uppercase">Postulación en línea</div>
        <div className="font-display mt-1 text-2xl font-semibold text-[#141413]">4 pasos, 100% virtual</div>
        <ol className="mt-4 space-y-2.5">
          {steps.map((s, i) => (
            <li key={s} className="flex items-center gap-3">
              <span className={cx('flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold', i === 0 ? 'bg-[#C96442] text-white' : 'bg-[#F4F2EA] text-[#6F6E68]')}>{i + 1}</span>
              <span className="text-[14px] text-[#141413]">{s}</span>
            </li>
          ))}
        </ol>
      </div>
      <div className="animate-float absolute bottom-10 left-0 flex items-center gap-3 rounded-2xl bg-[#1F1E1D] px-4 py-3 text-white shadow-2xl">
        <Clock size={20} className="text-[#E8916F]" />
        <div><div className="text-[13px] font-semibold">Respuesta en 24 horas</div><div className="text-[11.5px] text-white/60">Un asesor te contactará</div></div>
      </div>
      <div className="absolute right-8 bottom-2 flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-2xl" style={{ animation: 'float 7s ease-in-out infinite 1.2s' }}>
        <Award size={20} className="text-[#C96442]" />
        <div><div className="text-[13px] font-semibold text-[#141413]">Becas y beneficios</div><div className="text-[11.5px] text-[#6F6E68]">Consulta tu elegibilidad</div></div>
      </div>
    </div>
  );
}
