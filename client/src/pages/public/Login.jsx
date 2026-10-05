import { useState } from 'react';
import { Navigate, useLocation, useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff, LogIn, ArrowLeft, GraduationCap, Presentation, ShieldCheck, Video, BellRing, Smartphone, Info } from 'lucide-react';
import { useAuth } from '../../lib/context.jsx';
import { Button, Field, Input, cx } from '../../components/ui.jsx';
import { Logo, CONTACT } from '../../components/brand.jsx';

/**
 * Accesos de demostración (modo local). Desactivar DEMO_MODE en producción.
 * La contraseña coincide con DEMO_PASSWORD en server/seed.js.
 */
const DEMO_MODE = true;
const DEMO_PASSWORD = 'Isup2026!';
const DEMO = [
  { role: 'Estudiante', email: 'estudiante@isup.edu.pe', icon: GraduationCap, name: 'Valeria Mendoza' },
  { role: 'Docente', email: 'docente@isup.edu.pe', icon: Presentation, name: 'Carla Ramírez' },
  { role: 'Administración', email: 'admin@isup.edu.pe', icon: ShieldCheck, name: 'Lucía Paredes' },
];

export default function Login() {
  const { user, login } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [forgot, setForgot] = useState(false);

  if (user) return <Navigate to={loc.state?.from || '/app'} replace />;

  const submit = async (e, creds) => {
    e?.preventDefault();
    const em = creds?.email ?? email;
    const pw = creds?.password ?? password;
    if (!em || !pw) return setError('Ingresa tu correo o código y tu contraseña.');
    setLoading(creds?.email || true);
    setError('');
    try {
      await login(em, pw);
      nav(loc.state?.from || '/app', { replace: true });
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 min-h-dvh bg-bg lg:grid-cols-[1fr_minmax(0,560px)] xl:grid-cols-[1fr_640px]">
      <div className="flex flex-col px-5 py-6 sm:px-10">
        <div className="flex items-center justify-between">
          <Logo />
          <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"><ArrowLeft size={16} /> Volver a la web</Link>
        </div>
        <div className="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center py-10">
          <h1 className="font-display text-[2.2rem] leading-tight font-semibold text-ink">Te damos la bienvenida</h1>
          <p className="mt-2 text-muted">Ingresa a tu Aula Virtual ISUP para continuar aprendiendo.</p>

          <form onSubmit={submit} className="mt-8 space-y-4" noValidate>
            <Field label="Correo institucional o código">
              <Input value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" placeholder="nombre@isup.edu.pe o N0026…" autoFocus />
            </Field>
            <Field label="Contraseña">
              <div className="relative">
                <Input value={password} onChange={(e) => setPassword(e.target.value)} type={show ? 'text' : 'password'} autoComplete="current-password" placeholder="••••••••" className="pr-11" />
                <button type="button" onClick={() => setShow((s) => !s)} className="absolute top-1/2 right-2 -translate-y-1/2 rounded-lg p-1.5 text-muted hover:text-ink" aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
                  {show ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </Field>
            <div className="flex justify-end">
              <button type="button" onClick={() => setForgot((f) => !f)} className="text-sm font-medium text-primary-ink hover:underline">¿Olvidaste tu contraseña?</button>
            </div>
            {forgot && (
              <div className="animate-fade-up flex gap-3 rounded-xl border border-info/20 bg-info-soft p-3.5 text-sm text-info">
                <Info size={18} className="mt-px shrink-0" />
                <span>Escribe a <a className="font-semibold underline" href={`mailto:${CONTACT.support}`}>{CONTACT.support}</a> o por WhatsApp al {CONTACT.whatsappLabel} indicando tu código de estudiante. Restableceremos tu acceso en minutos.</span>
              </div>
            )}
            {error && <div className="animate-fade-up rounded-xl border border-danger/20 bg-danger-soft px-4 py-3 text-sm text-danger" role="alert">{error}</div>}
            <Button type="submit" size="lg" className="w-full" icon={LogIn} loading={loading === true}>Ingresar al aula</Button>
          </form>

          {DEMO_MODE && (
            <div className="mt-10">
              <div className="flex items-center gap-3 text-xs font-semibold tracking-[0.1em] text-faint uppercase">
                <span className="h-px flex-1 bg-line" /> Acceso rápido de demostración <span className="h-px flex-1 bg-line" />
              </div>
              <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
                {DEMO.map((d) => (
                  <button key={d.email} type="button" disabled={!!loading} onClick={() => submit(null, { email: d.email, password: DEMO_PASSWORD })}
                    className={cx('group flex items-center gap-3 rounded-xl border border-line bg-surface p-3 text-left transition hover:border-primary hover:shadow-soft sm:flex-col sm:items-start sm:gap-2',
                      loading === d.email && 'border-primary')}>
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-soft text-primary transition group-hover:bg-primary group-hover:text-white"><d.icon size={18} /></span>
                    <span>
                      <span className="block text-sm font-semibold text-ink">{d.role}</span>
                      <span className="block text-xs text-muted">{d.name}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <p className="text-center text-xs text-faint">¿Problemas para ingresar? Escríbenos a {CONTACT.support}</p>
      </div>

      <div className="relative hidden overflow-hidden bg-[#C96442] lg:block">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_10%,rgba(255,255,255,.22),transparent_50%),radial-gradient(ellipse_at_90%_90%,rgba(20,20,19,.35),transparent_55%)]" />
        <svg className="absolute inset-0 h-full w-full opacity-[0.12]" aria-hidden>
          <defs><pattern id="dots" width="22" height="22" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.6" fill="#fff" /></pattern></defs>
          <rect width="100%" height="100%" fill="url(#dots)" />
        </svg>
        <div className="relative flex h-full flex-col justify-between p-12 text-white xl:p-16">
          <div className="text-sm font-medium text-white/80">Aula Virtual · ISUP</div>
          <div>
            <h2 className="font-display text-[2.6rem] leading-[1.1] font-semibold xl:text-[3rem]">Aprender en línea puede sentirse <em className="font-medium text-[#FCE3D6]">cercano</em>.</h2>
            <div className="mt-10 space-y-3">
              {[
                [Video, 'Únete a tus clases en vivo con un clic'],
                [BellRing, 'Recordatorios antes de cada entrega'],
                [Smartphone, 'Estudia desde el celular o la laptop'],
              ].map(([Icon, t]) => (
                <div key={t} className="flex items-center gap-3 rounded-2xl bg-white/12 px-4 py-3.5 ring-1 ring-white/20 backdrop-blur">
                  <Icon size={19} /> <span className="text-[15px]">{t}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="text-sm text-white/70">Instituto Superior Universitario Privado · Lima, Perú</div>
        </div>
      </div>
    </div>
  );
}
