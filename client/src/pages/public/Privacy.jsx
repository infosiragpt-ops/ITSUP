import { ShieldCheck, Scale, Accessibility, Lock } from 'lucide-react';
import { useApi } from '../../lib/api.js';
import { CONTACT } from '../../components/brand.jsx';

const H = ({ children }) => <h2 className="font-display mt-10 text-2xl font-semibold text-ink">{children}</h2>;
const P = ({ children }) => <p className="mt-3 text-[15px] leading-relaxed text-ink-2">{children}</p>;
const Ul = ({ items }) => <ul className="mt-3 list-disc space-y-1.5 pl-6 text-[15px] leading-relaxed text-ink-2">{items.map((i, k) => <li key={k}>{i}</li>)}</ul>;

/** Política de privacidad (Ley N.° 29733), condiciones de uso del aula virtual y marco normativo académico. */
export default function Privacy() {
  const { data: inst } = useApi('/public/institution');
  const name = inst?.name || 'Instituto Superior Universitario Privado';
  const contact = inst?.privacy_contact || CONTACT.email;
  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <div className="text-xs font-bold tracking-[0.16em] text-primary uppercase">Transparencia y cumplimiento</div>
      <h1 className="font-display mt-2 text-[2.4rem] leading-tight font-semibold text-ink">Política de privacidad y condiciones de uso del Aula Virtual</h1>
      <p className="mt-3 text-muted">Versión {inst?.consent_version || '2026-1'} · Aplica a estudiantes, docentes, personal administrativo y postulantes del {name}.</p>

      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        {[
          [ShieldCheck, 'Protección de datos', 'Ley N.° 29733 y su Reglamento (D.S. N.° 003-2013-JUS).'],
          [Scale, 'Marco académico', 'Ley N.° 30512, D.S. N.° 010-2017-MINEDU y Lineamientos Académicos Generales del MINEDU.'],
          [Accessibility, 'Accesibilidad', 'Ley N.° 29973 y pautas WCAG 2.1 nivel AA.'],
          [Lock, 'Seguridad', 'Cifrado en tránsito, contraseñas protegidas, bloqueo por intentos y auditoría de accesos.'],
        ].map(([Icon, t, d]) => <div key={t} className="card flex gap-3 p-4"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary"><Icon size={18} /></span><div><div className="text-sm font-semibold text-ink">{t}</div><div className="text-xs text-muted">{d}</div></div></div>)}
      </div>

      <H>1. Responsable del tratamiento</H>
      <P>El {name} es responsable del banco de datos personales de estudiantes, docentes y postulantes que se registran en el Aula Virtual ISUP. Para consultas sobre esta política o para ejercer tus derechos escríbenos a <a className="font-medium text-primary-ink underline" href={`mailto:${contact}`}>{contact}</a>.</P>

      <H>2. Datos que tratamos</H>
      <Ul items={[
        'Identificación: nombres y apellidos, DNI, código institucional, correo, teléfono.',
        'Académicos: matrícula, asistencia, entregas, calificaciones, actas, constancias y documentos emitidos.',
        'De uso de la plataforma: fecha y hora de acceso, dirección IP y acciones registradas en la bitácora de auditoría.',
        'De comunicación: mensajes en foros, anuncios y solicitudes de soporte.',
      ]} />

      <H>3. Finalidades</H>
      <Ul items={[
        'Gestionar el proceso formativo: matrícula, desarrollo de las unidades didácticas, evaluación y certificación.',
        'Cumplir las obligaciones de registro e información ante el Ministerio de Educación y los organismos competentes.',
        'Emitir constancias, boletas de notas y récords académicos con código de verificación.',
        'Brindar soporte, acompañamiento académico (alertas tempranas, tutoría) y comunicaciones institucionales.',
        'Garantizar la seguridad de la plataforma y prevenir usos indebidos.',
      ]} />

      <H>4. Conservación y seguridad</H>
      <P>Los registros académicos (actas, notas, asistencia) se conservan de forma permanente por su valor institucional y legal. Los demás datos se conservan mientras dure la relación con la institución y los plazos legales aplicables. Aplicamos medidas técnicas y organizativas: cifrado en tránsito, contraseñas protegidas con algoritmos de hash, bloqueo temporal tras intentos fallidos, control de acceso por rol, enmascarado del DNI en la interfaz y bitácora de auditoría de las acciones sobre datos académicos.</P>

      <H>5. Derechos ARCO</H>
      <P>Puedes ejercer tus derechos de acceso, rectificación, cancelación y oposición, así como revocar tu consentimiento, mediante solicitud escrita a <a className="font-medium text-primary-ink underline" href={`mailto:${contact}`}>{contact}</a> o desde “Ayuda y soporte” en el aula virtual. Atenderemos tu solicitud en los plazos que establece la Ley N.° 29733. También puedes acudir a la Autoridad Nacional de Protección de Datos Personales.</P>

      <H>6. Transferencias y encargados</H>
      <P>No vendemos ni cedemos tus datos a terceros con fines comerciales. Compartimos información únicamente con el Ministerio de Educación y entidades públicas cuando la ley lo exige, y con proveedores tecnológicos (videoconferencia, alojamiento) que actúan como encargados del tratamiento bajo acuerdos de confidencialidad. Las sesiones en vivo pueden grabarse con fines académicos; se informa a los participantes al inicio de cada sesión.</P>

      <H>7. Condiciones de uso del aula virtual</H>
      <Ul items={[
        'La cuenta es personal e intransferible. Eres responsable de la confidencialidad de tu contraseña.',
        'Está prohibida la suplantación, el plagio y cualquier forma de deshonestidad académica; las sanciones se rigen por el Reglamento Institucional.',
        'Los contenidos del aula (lecturas, videos, evaluaciones) son de uso exclusivo para fines formativos de la comunidad ISUP.',
        'Las comunicaciones en foros y mensajes deben mantener el respeto y las normas de convivencia.',
      ]} />

      <H>8. Marco académico aplicable</H>
      <P>El sistema de evaluación del aula virtual aplica las disposiciones de la Ley N.° 30512 (Ley de Institutos y Escuelas de Educación Superior), su Reglamento aprobado por D.S. N.° 010-2017-MINEDU y los Lineamientos Académicos Generales del MINEDU para los IES y EEST: escala vigesimal con nota mínima aprobatoria de {inst?.min_grade ?? 13}, redondeo de la fracción 0.5 a favor del estudiante, desaprobación por inasistencia cuando se supera el {inst?.max_absence_pct ?? 30} % de inasistencias injustificadas, evaluación de recuperación para notas entre {inst?.recovery_min ?? 10} y {inst?.recovery_max ?? 12}, y equivalencia de 1 crédito a 16 horas teóricas o 32 horas prácticas.</P>

      <H>9. Cambios en esta política</H>
      <P>Cuando actualicemos esta política te pediremos aceptar la nueva versión al ingresar al aula virtual. La fecha y versión aceptadas quedan registradas en tu cuenta.</P>
    </div>
  );
}
