import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { Menu, X, ChevronDown, ArrowRight, MessageCircle, Mail, Phone, LifeBuoy, MapPin, LogIn } from 'lucide-react';
import { Logo, CONTACT } from '../components/brand.jsx';
import { CareersMega, CareersMobileList } from '../components/programs.jsx';
import { Button, cx, useClickOutside } from '../components/ui.jsx';
import { useAuth } from '../lib/context.jsx';
import { useApi } from '../lib/api.js';

export default function PublicLayout() {
  const loc = useLocation();
  useEffect(() => {
    if (loc.hash) {
      setTimeout(() => document.getElementById(loc.hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
    } else window.scrollTo({ top: 0 });
  }, [loc.pathname, loc.hash]);
  return (
    <div className="min-h-dvh bg-bg">
      <a href="#contenido" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2">Saltar al contenido</a>
      <SiteHeader />
      <main id="contenido"><Outlet /></main>
      <SiteFooter />
      <HelpWidget />
    </div>
  );
}

function SiteHeader() {
  const { user } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [mega, setMega] = useState(false);
  const megaRef = useRef(null);
  const loc = useLocation();
  const { data: programs } = useApi('/public/programs');
  useClickOutside(megaRef, () => setMega(false), mega);

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  useEffect(() => { setMobile(false); setMega(false); }, [loc.pathname, loc.hash]);
  useEffect(() => { document.body.style.overflow = mobile ? 'hidden' : ''; }, [mobile]);

  const link = 'rounded-lg px-3 py-2 text-[14.5px] font-medium text-ink-2 transition hover:bg-sunken hover:text-ink';

  return (
    <header className={cx('sticky top-0 z-50 transition-all duration-300', scrolled ? 'border-b border-line bg-bg/85 backdrop-blur-xl' : 'border-b border-transparent bg-bg')}>
      <div className="hidden border-b border-line/70 bg-sunken/60 md:block">
        <div className="mx-auto flex h-9 max-w-7xl items-center justify-end gap-5 px-6 text-[12.5px] text-muted">
          <Link to="/aula-virtual" className="hover:text-ink">Estudiantes</Link>
          <Link to="/aula-virtual#requisitos" className="hover:text-ink">Requisitos técnicos</Link>
          <a href={`mailto:${CONTACT.email}`} className="hover:text-ink">{CONTACT.email}</a>
          <Link to="/login" className="font-semibold text-primary-ink hover:underline">Mi aula ISUP</Link>
        </div>
      </div>
      <div className="relative mx-auto flex h-[72px] max-w-7xl items-center gap-4 px-4 sm:px-6">
        <Logo />
        <nav className="ml-auto hidden items-center gap-1 lg:flex" aria-label="Principal">
          <div ref={megaRef}>
            <button onClick={() => setMega((m) => !m)} className={cx(link, 'inline-flex items-center gap-1', mega && 'bg-sunken text-ink')} aria-expanded={mega}>
              Carreras <ChevronDown size={15} className={cx('transition', mega && 'rotate-180')} />
            </button>
            {/* Se posiciona respecto al contenedor del encabezado para quedar centrado en la página */}
            {mega && programs?.length > 0 && (
              <div className="animate-scale-in absolute top-full left-1/2 mt-1 w-[min(940px,calc(100vw-2rem))] -translate-x-1/2">
                <CareersMega programs={programs} />
              </div>
            )}
          </div>
          <NavLink to="/admision" className={link}>Admisión</NavLink>
          <NavLink to="/aula-virtual" className={link}>Aula Virtual</NavLink>
          <Link to="/#nosotros" className={link}>Nosotros</Link>
          <Link to="/#contacto" className={link}>Contacto</Link>
        </nav>
        <div className="ml-auto flex items-center gap-2 lg:ml-3">
          {user ? (
            <Button to="/app" size="md" iconRight={ArrowRight} className="hidden sm:inline-flex">Ir a mi aula</Button>
          ) : (
            <>
              <Button to="/login" variant="secondary" icon={LogIn} className="hidden sm:inline-flex">Ingresar</Button>
              <Button to="/admision" className="hidden sm:inline-flex">Postula a ISUP</Button>
            </>
          )}
          <button className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-ink hover:bg-sunken lg:hidden" onClick={() => setMobile(true)} aria-label="Abrir menú">
            <Menu size={22} />
          </button>
        </div>
      </div>

      {mobile && (
        <div className="animate-fade-in fixed inset-0 z-[60] flex flex-col bg-bg lg:hidden">
          <div className="flex h-[72px] items-center justify-between px-4">
            <Logo />
            <button className="inline-flex h-10 w-10 items-center justify-center rounded-xl hover:bg-sunken" onClick={() => setMobile(false)} aria-label="Cerrar menú"><X size={22} /></button>
          </div>
          <nav className="flex-1 overflow-y-auto px-4 pb-6">
            {programs && <CareersMobileList programs={programs} />}
            <div className="my-4 h-px bg-line" />
            {[['/admision', 'Admisión'], ['/aula-virtual', 'Aula Virtual'], ['/#nosotros', 'Nosotros'], ['/#contacto', 'Contacto']].map(([to, l]) => (
              <Link key={to} to={to} className="block rounded-xl px-2 py-3 text-lg font-medium text-ink">{l}</Link>
            ))}
          </nav>
          <div className="grid grid-cols-2 gap-2 border-t border-line p-4">
            <Button to={user ? '/app' : '/login'} variant="secondary" size="lg">{user ? 'Mi aula' : 'Ingresar'}</Button>
            <Button to="/admision" size="lg">Postula</Button>
          </div>
        </div>
      )}
    </header>
  );
}

function SiteFooter() {
  const { data: programs } = useApi('/public/programs');
  return (
    <footer id="contacto" className="scroll-mt-24 bg-night text-[#E9E6DC]">
      <div className="mx-auto grid grid-cols-1 max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1.2fr]">
        <div>
          <Logo light />
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/60">
            Formamos profesionales técnicos con educación 100% virtual, docentes de la industria y un aula virtual diseñada para que aprendas desde cualquier lugar del Perú.
          </p>
        </div>
        <div>
          <h3 className="mb-3 text-sm font-semibold text-white">Carreras</h3>
          <ul className="space-y-2 text-sm text-white/60">
            {programs?.map((p) => <li key={p.id}><Link to={`/carreras/${p.slug}`} className="hover:text-white">{p.short}</Link></li>)}
          </ul>
        </div>
        <div>
          <h3 className="mb-3 text-sm font-semibold text-white">Estudiantes</h3>
          <ul className="space-y-2 text-sm text-white/60">
            <li><Link to="/login" className="hover:text-white">Aula Virtual ISUP</Link></li>
            <li><Link to="/aula-virtual" className="hover:text-white">Guía del aula virtual</Link></li>
            <li><Link to="/aula-virtual#fechas" className="hover:text-white">Fechas importantes</Link></li>
            <li><Link to="/aula-virtual#requisitos" className="hover:text-white">Requisitos técnicos</Link></li>
            <li><Link to="/admision" className="hover:text-white">Admisión</Link></li>
          </ul>
        </div>
        <div>
          <h3 className="mb-3 text-sm font-semibold text-white">Contáctanos</h3>
          <ul className="space-y-3 text-sm text-white/60">
            <li className="flex gap-2.5"><MessageCircle size={17} className="mt-px shrink-0 text-[#E3886A]" /> WhatsApp {CONTACT.whatsappLabel}</li>
            <li className="flex gap-2.5"><Mail size={17} className="mt-px shrink-0 text-[#E3886A]" /> <a href={`mailto:${CONTACT.email}`} className="hover:text-white">{CONTACT.email}</a></li>
            <li className="flex gap-2.5"><Phone size={17} className="mt-px shrink-0 text-[#E3886A]" /> {CONTACT.phone}</li>
            <li className="flex gap-2.5"><MapPin size={17} className="mt-px shrink-0 text-[#E3886A]" /> {CONTACT.address}</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-5 text-xs text-white/45 sm:flex-row sm:justify-between sm:px-6">
          <span>© {new Date().getFullYear()} ISUP · Instituto Superior Universitario Privado. Todos los derechos reservados.</span>
          <span>Libro de reclamaciones · Políticas de privacidad</span>
        </div>
      </div>
    </footer>
  );
}

export function HelpWidget() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useClickOutside(ref, () => setOpen(false), open);
  return (
    <div ref={ref} className="fixed right-4 bottom-4 z-40 flex flex-col items-end gap-3 sm:right-6 sm:bottom-6">
      {open && (
        <div className="animate-scale-in w-[300px] overflow-hidden rounded-2xl border border-line bg-surface shadow-lift">
          <div className="bg-primary px-5 py-4 text-white">
            <div className="font-display text-lg font-semibold">¡Hola! 👋</div>
            <p className="text-sm text-white/85">¿En qué podemos ayudarte hoy?</p>
          </div>
          <div className="p-2">
            <a href={`https://wa.me/${CONTACT.whatsapp}?text=${encodeURIComponent('Hola ISUP, quisiera información sobre sus carreras.')}`} target="_blank" rel="noreferrer"
              className="flex items-center gap-3 rounded-xl p-3 hover:bg-sunken">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#25D366]/15 text-[#1DA851]"><MessageCircle size={18} /></span>
              <span><span className="block text-sm font-semibold text-ink">Escríbenos por WhatsApp</span><span className="text-xs text-muted">Admisión e informes</span></span>
            </a>
            <Link to="/app/ayuda" className="flex items-center gap-3 rounded-xl p-3 hover:bg-sunken">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-soft text-primary"><LifeBuoy size={18} /></span>
              <span><span className="block text-sm font-semibold text-ink">Soporte del aula virtual</span><span className="text-xs text-muted">Para estudiantes y docentes</span></span>
            </Link>
            <a href={`mailto:${CONTACT.email}`} className="flex items-center gap-3 rounded-xl p-3 hover:bg-sunken">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-info-soft text-info"><Mail size={18} /></span>
              <span><span className="block text-sm font-semibold text-ink">{CONTACT.email}</span><span className="text-xs text-muted">Respondemos en menos de 24 h</span></span>
            </a>
          </div>
        </div>
      )}
      <button onClick={() => setOpen((o) => !o)} className="group flex items-center gap-2 rounded-full bg-ink py-2 pr-2 pl-4 text-sm font-medium text-bg shadow-lift transition hover:scale-[1.03]" aria-expanded={open}>
        <span className="hidden sm:inline">Te ayudamos aquí</span>
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-white">
          {open ? <X size={19} /> : <MessageCircle size={19} />}
        </span>
      </button>
    </div>
  );
}
