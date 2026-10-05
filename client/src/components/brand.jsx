import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  LayoutGrid, Cpu, ChartNoAxesCombined, PenTool,
  BookOpen, PlayCircle, FileText, Link2, ClipboardList, ListChecks, Code2, Briefcase, Calculator, Megaphone, Palette, ShieldCheck, GraduationCap,
} from 'lucide-react';
import { cx } from './ui.jsx';

export const CONTACT = {
  whatsapp: '51900000000', // Reemplazar por el número oficial de ISUP
  whatsappLabel: '+51 900 000 000',
  email: 'informes@isup.edu.pe',
  support: 'soporte@isup.edu.pe',
  phone: '(01) 640 5000',
  address: 'Lima, Perú · Atención 100% virtual',
};

export function LogoMark({ size = 36, className }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" className={className} aria-hidden>
      <rect width="40" height="40" rx="10" fill="var(--c-primary)" />
      <path d="M9 14c3.6-1.2 7.4-.9 11 1.3v14c-3.6-2.2-7.4-2.5-11-1.3z" fill="#fff" />
      <path d="M31 14c-3.6-1.2-7.4-.9-11 1.3v14c3.6-2.2 7.4-2.5 11-1.3z" fill="#fff" fillOpacity=".72" />
      <circle cx="20" cy="9" r="2.2" fill="#fff" />
    </svg>
  );
}

export function Logo({ to = '/', compact, light, className }) {
  return (
    <Link to={to} className={cx('group inline-flex items-center gap-2.5', className)} aria-label="ISUP · Inicio">
      <LogoMark size={compact ? 32 : 38} className="transition-transform group-hover:-rotate-3" />
      <span className="flex flex-col leading-none">
        <span className={cx('font-display text-[1.45rem] font-semibold tracking-tight', light ? 'text-white' : 'text-ink')}>ISUP</span>
        {!compact && (
          <span className={cx('mt-0.5 hidden text-[9.5px] font-medium tracking-[0.08em] uppercase min-[400px]:block', light ? 'text-white/70' : 'text-muted')}>
            Instituto Superior Universitario Privado
          </span>
        )}
      </span>
    </Link>
  );
}

export const ITEM_META = {
  reading: { icon: BookOpen, label: 'Lectura', tone: 'text-primary bg-primary-soft' },
  video: { icon: PlayCircle, label: 'Video', tone: 'text-info bg-info-soft' },
  file: { icon: FileText, label: 'Archivo', tone: 'text-warn bg-warn-soft' },
  link: { icon: Link2, label: 'Enlace', tone: 'text-success bg-success-soft' },
  assignment: { icon: ClipboardList, label: 'Tarea', tone: 'text-primary bg-primary-soft' },
  quiz: { icon: ListChecks, label: 'Evaluación', tone: 'text-info bg-info-soft' },
};

export const PROGRAM_ICONS = { code: Code2, briefcase: Briefcase, calculator: Calculator, megaphone: Megaphone, palette: Palette, shield: ShieldCheck, graduation: GraduationCap };

/** Áreas académicas: agrupan las carreras en el menú y en los filtros (programs.area guarda la clave). */
export const AREAS = [
  { key: 'tecnologia', label: 'Tecnología', icon: Cpu },
  { key: 'negocios', label: 'Negocios', icon: ChartNoAxesCombined },
  { key: 'creatividad', label: 'Diseño y Marketing', icon: PenTool },
];
export const ALL_AREAS = { key: 'all', label: 'Todas las carreras', icon: LayoutGrid };
export const areaOf = (p) => AREAS.find((a) => a.key === p?.area) || null;

/**
 * Foto de una carrera. Las fotos propias viven en /img/carreras/<slug>.jpg con variantes
 * -md (tarjetas) y -sm (miniaturas); una URL externa se usa tal cual en todos los tamaños.
 */
export function programImage(p, size = 'lg') {
  if (!p?.image) return null;
  if (size === 'lg' || !/^\/img\/carreras\/[^/]+\.jpg$/.test(p.image)) return p.image;
  return p.image.replace(/\.jpg$/, `-${size}.jpg`);
}

/** Foto de carrera con respaldo: si no hay imagen o falla la carga, muestra el color y el ícono. */
export function ProgramPhoto({ p, size = 'md', className, eager }) {
  const [failedSrc, setFailedSrc] = useState(null);
  const src = programImage(p, size);
  if (!src || failedSrc === src) {
    const Icon = PROGRAM_ICONS[p?.icon] || GraduationCap;
    const color = p?.color || '#C96442';
    return (
      <div className={cx('flex items-center justify-center overflow-hidden', className)} style={{ background: `linear-gradient(135deg, ${color}, color-mix(in srgb, ${color} 60%, #141413))` }} aria-hidden>
        <Icon className="h-2/5 w-2/5 text-white/30" strokeWidth={1.25} />
      </div>
    );
  }
  return <img src={src} alt="" loading={eager ? 'eager' : 'lazy'} decoding="async" onError={() => setFailedSrc(src)} className={cx('object-cover', className)} />;
}

/** Decorative course cover: tinted gradient + geometric pattern derived from the course color. */
export function CourseCover({ course, className, children }) {
  const color = course?.color || '#C96442';
  const seed = (course?.code || 'X').split('').reduce((s, ch) => s + ch.charCodeAt(0), 0);
  const variant = seed % 3;
  return (
    <div className={cx('relative overflow-hidden', className)} style={{ background: `linear-gradient(135deg, ${color}, color-mix(in srgb, ${color} 70%, #141413))` }}>
      <svg className="absolute inset-0 h-full w-full opacity-[0.22]" preserveAspectRatio="xMidYMid slice" viewBox="0 0 400 160" aria-hidden>
        {variant === 0 && Array.from({ length: 7 }).map((_, i) => <circle key={i} cx={330} cy={30} r={20 + i * 22} fill="none" stroke="#fff" strokeWidth="1.5" />)}
        {variant === 1 && Array.from({ length: 10 }).map((_, i) => <path key={i} d={`M${180 + i * 26} 170 L${260 + i * 26} -10`} stroke="#fff" strokeWidth="10" />)}
        {variant === 2 && Array.from({ length: 6 }).map((_, r) => Array.from({ length: 10 }).map((_, c) => (
          <rect key={`${r}-${c}`} x={160 + c * 26} y={r * 28} width="12" height="12" rx="3" fill="#fff" opacity={(r + c) % 3 === 0 ? 1 : 0.4} />
        )))}
      </svg>
      {children}
    </div>
  );
}
