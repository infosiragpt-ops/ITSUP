# ISUP Aula Virtual · Alineamiento normativo

Este documento resume cómo el Aula Virtual ISUP implementa las disposiciones del Ministerio de
Educación del Perú para institutos de educación superior y las normas transversales de protección
de datos, seguridad y accesibilidad. Sirve como guía para la Dirección, la Secretaría Académica y
para los procesos de licenciamiento y supervisión.

> **Importante.** El software implementa las reglas y los registros que exige la normativa, pero el
> cumplimiento institucional lo acreditan el Reglamento Institucional, los documentos de gestión y
> la validación de Secretaría Académica. Los umbrales (nota mínima, límite de inasistencias, rango
> de recuperación) son configurables desde **Administración → Gestión académica → Configuración**
> y se registran en la auditoría cuando cambian. Verifica siempre la vigencia de las normas citadas.

## 1. Marco normativo de referencia

| Norma | Materia | Cómo se aplica en la plataforma |
|---|---|---|
| Ley N.° 30512 y D.S. N.° 010-2017-MINEDU | Institutos y Escuelas de Educación Superior | Estructura por programas de estudio, módulos formativos y unidades didácticas; niveles formativos (Auxiliar Técnico, Técnico, Profesional Técnico) con mínimos de créditos y horas; crédito académico de 16 h teóricas o 32 h prácticas. |
| Lineamientos Académicos Generales para IES y EEST (MINEDU) | Evaluación, asistencia, recuperación, sílabo, actas | Motor académico (`server/academic.js`): escala vigesimal, nota mínima 13, redondeo de 0.5 a favor del estudiante, DPI por más del 30 % de inasistencias injustificadas, recuperación para nota final de 10 a 12, sílabo estructurado y acta de evaluación por unidad didáctica. |
| Ley N.° 29733 y D.S. N.° 003-2013-JUS | Protección de datos personales | Consentimiento informado versionado al ingresar, política de privacidad pública, DNI enmascarado en la interfaz del titular, derechos ARCO por soporte, bitácora de auditoría. |
| Ley N.° 29973 · WCAG 2.1 AA | Accesibilidad | Enlaces para saltar al contenido, etiquetas y roles ARIA, foco visible, contraste del sistema de diseño, modo oscuro, reducción de movimiento, diseño adaptable a celular. |
| Buenas prácticas OWASP | Seguridad de la información | Cabeceras de seguridad (CSP, X-Frame-Options, nosniff, Referrer-Policy, HSTS en producción), contraseñas con hash bcrypt y política mínima, bloqueo temporal tras 5 intentos fallidos, control de acceso por rol, sesiones JWT con expiración. |

## 2. Estructura académica

- **Programas de estudio** (`programs`): nivel formativo, título que otorga, créditos y horas del plan,
  resolución de autorización/licenciamiento y plan de estudios por ciclo. El formulario avisa cuando
  el plan está por debajo de los mínimos del nivel (40/850, 80/1 700, 120/2 550).
- **Periodos académicos** (`terms`): nombre, fechas, semanas (16 por defecto), activación única y
  cierre de periodo (cierra todas las actas abiertas).
- **Unidades didácticas** (`courses`): módulo formativo, tipo (competencia específica, para la
  empleabilidad, EFSRT), horas teóricas y prácticas, créditos sugeridos automáticamente, nota mínima
  y límite de inasistencias propios (heredan la configuración institucional).

## 3. Sílabo

Cada unidad didáctica publica un sílabo con las secciones de los Lineamientos Académicos:
información general, sumilla, competencia, capacidades, indicadores de logro, organización de los
aprendizajes por unidades (contenidos, recursos y evaluaciones), metodología, sistema de evaluación
(criterios ponderados y reglas), recursos, bibliografía y aprobación. El docente lo edita en línea y
cualquier usuario del curso lo imprime o exporta a PDF.

## 4. Evaluación

1. **Criterios de evaluación ponderados** por curso (por ejemplo, proceso 40 %, producto 30 %,
   final 30 %). Cada tarea y evaluación se asigna a un criterio. Los pesos deben sumar 100 %.
2. **Rúbricas** opcionales por tarea: criterios con puntaje; el estudiante las ve antes de entregar
   y la nota se calcula al calificar criterio por criterio.
3. **Promedio ponderado** en escala 0–20 (los criterios sin actividades calificadas se excluyen y los
   pesos restantes se reescalan, de modo que el promedio parcial siempre es comparable).
4. **Nota final** = promedio redondeado al entero con la fracción 0.5 a favor del estudiante.
5. **Condición**: Aprobado (≥ nota mínima), Desaprobado, Desaprobado por inasistencia (DPI),
   Retirado o En proceso.
6. **Recuperación**: habilitada automáticamente para notas finales entre 10 y 12 sin DPI; la nota
   registrada reemplaza a la nota final.
7. **Acta de evaluación**: el docente la cierra al terminar el periodo; congela notas, asistencia y
   condición, bloquea cambios y notifica a los estudiantes. Solo Administración puede reabrirla,
   indicando el motivo, que queda en la auditoría. El acta se imprime con DNI, criterios, promedio,
   asistencia, recuperación, nota final, condición, observaciones y espacios de firma.

## 5. Asistencia

- Registro por sesión en vivo con estados Presente, Tardanza, Falta y Justificada (con motivo).
- Registro automático al unirse a la videoconferencia (tardanza después de 15 minutos).
- Solo cuentan las sesiones dictadas con asistencia registrada; la tardanza es asistencia y la falta
  justificada no cuenta para el límite.
- Alertas al estudiante al acercarse o superar el límite; indicador DPI en el registro de evaluación,
  el acta y el seguimiento.

## 6. Acompañamiento (alerta temprana)

La pestaña **Seguimiento** del docente y el **Inicio** marcan a los estudiantes con promedio bajo la
nota mínima, inasistencias cercanas o superiores al límite, actividades sin entregar o poco avance,
y permiten exportar el listado para tutoría.

## 7. Registros y documentos del estudiante

- **Récord académico** por periodo: créditos matriculados y aprobados, promedio ponderado por
  créditos, promedio acumulado y avance del plan de estudios.
- **Documentos verificables**: constancia de matrícula, boleta de notas y récord académico con
  código único (`ISUP-AAAA-XXXX-XXXX`) y huella HMAC-SHA256. La página pública `/verificar`
  confirma la autenticidad mostrando solo los datos necesarios.

## 8. Trazabilidad y datos personales

- **Auditoría** (`audit_log`): inicios de sesión y bloqueos, calificaciones (valor anterior y nuevo),
  asistencia, cierre y reapertura de actas, recuperación, retiro, sílabos, usuarios, matrículas,
  periodos, configuración, documentos emitidos y aceptación de la política de datos. Exportable a CSV
  y no editable desde la aplicación.
- **Consentimiento**: versión configurable; al cambiarla, todos los usuarios vuelven a aceptarla.
- **DNI**: requerido para actas y constancias; se valida (8 dígitos), se guarda sin duplicados y se
  muestra enmascarado al propio titular en la interfaz.

## 9. Configuración recomendada antes de producción

1. Definir `JWT_SECRET` (firma de sesiones y de la huella de los documentos) y `NODE_ENV=production`.
2. Servir detrás de HTTPS (HSTS se activa en producción) y, si hay proxy, `TRUST_PROXY=1`.
3. Completar los datos institucionales (nombre, código, resolución, director, secretaría académica) en
   **Gestión académica → Configuración**.
4. Cambiar las contraseñas de demostración y desactivar `DEMO_MODE` en `client/src/pages/public/Login.jsx`.
5. Programar copias de seguridad de `data/` (base de datos SQLite y archivos subidos).
