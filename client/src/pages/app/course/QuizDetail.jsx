import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, Timer, RotateCcw, HelpCircle, Calendar, Play, CheckCircle2, XCircle, Send, Trash2, Eye, Trophy, AlertTriangle, Circle, Square, CheckSquare, Wifi,
} from 'lucide-react';
import { api, useApi } from '../../../lib/api.js';
import { useUi } from '../../../lib/context.jsx';
import { Avatar, Badge, Button, Card, EmptyState, ErrorState, Modal, PageLoader, ProgressBar, ProgressRing, cx } from '../../../components/ui.jsx';
import { DueChip } from '../../../components/lms.jsx';
import Markdown from '../../../components/Markdown.jsx';
import { fmtDateTime, fmtGrade, fullName, gradeTone, relative } from '../../../lib/format.js';
import { useCourse } from './CourseLayout.jsx';

const draftKey = (aid) => `isup_quiz_draft_${aid}`;

export default function QuizDetail() {
  const { quizId } = useParams();
  const { course } = useCourse();
  const { data: q, loading, error, reload } = useApi(`/quizzes/${quizId}`);
  const [session, setSession] = useState(null); // { attempt, questions }
  const [result, setResult] = useState(null);
  const [review, setReview] = useState(null);
  const [starting, setStarting] = useState(false);
  const [rules, setRules] = useState(false);
  const { toast, confirm } = useUi();
  const nav = useNavigate();

  if (loading) return <PageLoader />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  const start = async () => {
    setStarting(true);
    try {
      const r = await api.post(`/quizzes/${q.id}/start`);
      setRules(false);
      setSession(r);
    } catch (e) { toast(e.message, 'error'); } finally { setStarting(false); }
  };
  const openReview = async (attemptId) => {
    try { setReview(await api.get(`/quizzes/${q.id}/attempts/${attemptId}`)); } catch (e) { toast(e.message, 'error'); }
  };

  if (session) return <TakeQuiz q={q} session={session} onDone={(r) => { setSession(null); setResult(r); reload(); }} />;
  if (result) return <QuizResult q={q} result={result} onBack={() => setResult(null)} />;

  const submitted = (q.attempts || []).filter((a) => a.submitted_at);
  const best = submitted.length ? Math.max(...submitted.map((a) => a.score)) : null;
  const now = new Date();
  const notYet = q.available_from && now < new Date(q.available_from);
  const closed = now > new Date(q.due_at);
  const canStart = !q.can_edit && !closed && !notYet && (q.open_attempt || submitted.length < q.max_attempts);

  const remove = async () => {
    if (!(await confirm({ title: 'Eliminar evaluación', message: 'Se eliminarán todas las preguntas e intentos.', confirmText: 'Eliminar', danger: true }))) return;
    await api.del(`/quizzes/${q.id}`);
    toast('Evaluación eliminada');
    nav(`/app/cursos/${course.id}/evaluaciones`);
  };

  return (
    <div className="space-y-6">
      <Link to={`/app/cursos/${course.id}/evaluaciones`} className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink"><ArrowLeft size={16} /> Todas las evaluaciones</Link>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Card className="p-5 sm:p-7">
          <div className="mb-2 flex flex-wrap gap-2"><Badge tone="info">Evaluación</Badge><DueChip due={q.due_at} done={!q.can_edit && submitted.length > 0} /></div>
          <div className="flex items-start justify-between gap-3">
            <h2 className="font-display text-[1.7rem] leading-tight font-semibold text-ink sm:text-[2rem]">{q.title}</h2>
            {q.can_edit && <Button variant="ghost" size="sm" icon={Trash2} onClick={remove}>Eliminar</Button>}
          </div>
          {q.description && <p className="mt-3 text-[15px] text-ink-2">{q.description}</p>}
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[[HelpCircle, `${q.question_count}`, 'preguntas'], [Timer, `${q.time_limit_min} min`, 'tiempo límite'], [RotateCcw, `${q.max_attempts}`, q.max_attempts === 1 ? 'intento' : 'intentos'], [Calendar, fmtDateTime(q.due_at), 'cierre']].map(([I, v, l]) => (
              <div key={l} className="rounded-xl border border-line p-3">
                <I size={17} className="text-primary" />
                <div className="mt-2 text-sm font-semibold text-ink">{v}</div>
                <div className="text-xs text-muted">{l}</div>
              </div>
            ))}
          </div>
          {q.can_edit && q.questions && (
            <div className="mt-8">
              <h3 className="mb-3 font-semibold text-ink">Preguntas y respuestas correctas</h3>
              <ol className="space-y-3">
                {q.questions.map((x, i) => (
                  <li key={x.id} className="rounded-xl border border-line p-4">
                    <div className="text-sm font-medium text-ink">{i + 1}. {x.prompt} <span className="text-xs text-faint">· {x.points} pt</span></div>
                    <ul className="mt-2 space-y-1">
                      {x.options.map((o, oi) => (
                        <li key={oi} className={cx('flex items-center gap-2 text-sm', x.correct.includes(oi) ? 'font-medium text-success' : 'text-muted')}>
                          {x.correct.includes(oi) ? <CheckCircle2 size={15} /> : <Circle size={15} className="text-line-strong" />} {o}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </Card>

        <div className="space-y-4">
          {!q.can_edit && (
            <Card className="p-5 text-center">
              {best != null ? (
                <>
                  <ProgressRing value={(best / q.points) * 100} size={96} stroke={8} color={gradeTone(best, q.points) === 'success' ? 'var(--c-success)' : 'var(--c-danger)'}>
                    <span className="font-display text-2xl">{fmtGrade(best)}</span>
                  </ProgressRing>
                  <div className="mt-2 text-sm text-muted">Tu mejor nota de {q.points}</div>
                </>
              ) : (
                <>
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-info-soft text-info"><Play size={28} /></div>
                  <div className="mt-3 font-semibold text-ink">{notYet ? 'Aún no disponible' : closed ? 'Evaluación cerrada' : 'Lista para rendir'}</div>
                </>
              )}
              <div className="mt-2 text-xs text-muted">Intentos usados: {submitted.length} de {q.max_attempts}</div>
              {canStart && (
                <Button size="lg" className="mt-5 w-full" icon={Play} onClick={() => (q.open_attempt ? start() : setRules(true))} loading={starting}>
                  {q.open_attempt ? 'Continuar intento' : submitted.length ? 'Nuevo intento' : 'Comenzar evaluación'}
                </Button>
              )}
              {!canStart && !closed && !notYet && submitted.length >= q.max_attempts && <p className="mt-4 text-xs text-muted">Usaste todos tus intentos.</p>}
            </Card>
          )}
          <Card className="p-5">
            <h3 className="mb-3 font-semibold text-ink">{q.can_edit ? `Intentos (${q.attempts.length})` : 'Historial de intentos'}</h3>
            {q.attempts.filter((a) => a.submitted_at).length === 0 ? <p className="text-sm text-muted">Sin intentos todavía.</p> : (
              <ul className="-mx-2 divide-y divide-line">
                {q.attempts.filter((a) => a.submitted_at).map((a, i) => (
                  <li key={a.id}>
                    <button onClick={() => openReview(a.id)} className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left hover:bg-sunken">
                      {q.can_edit ? <Avatar user={a} size={30} /> : <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sunken text-xs font-semibold text-muted">#{i + 1}</span>}
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-ink">{q.can_edit ? fullName(a) : `Intento ${i + 1}`}</div>
                        <div className="text-xs text-muted">{relative(a.submitted_at)}</div>
                      </div>
                      <Badge tone={gradeTone(a.score, q.points)}>{fmtGrade(a.score)}</Badge>
                      <Eye size={15} className="text-faint" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      <Modal open={rules} onClose={() => setRules(false)} title="Antes de comenzar" size="sm"
        footer={<><Button variant="ghost" onClick={() => setRules(false)}>Ahora no</Button><Button icon={Play} onClick={start} loading={starting} data-autofocus>Comenzar</Button></>}>
        <ul className="space-y-3 text-sm text-ink-2">
          <li className="flex gap-3"><Timer size={18} className="shrink-0 text-primary" /> Tendrás <strong className="text-ink">{q.time_limit_min} minutos</strong>. Al terminar el tiempo, tus respuestas se envían automáticamente.</li>
          <li className="flex gap-3"><Wifi size={18} className="shrink-0 text-primary" /> Usa una conexión estable. Tus respuestas se guardan en este dispositivo mientras avanzas.</li>
          <li className="flex gap-3"><RotateCcw size={18} className="shrink-0 text-primary" /> Este será tu intento {submitted.length + 1} de {q.max_attempts}.</li>
        </ul>
      </Modal>
      {review && <ReviewModal q={q} review={review} onClose={() => setReview(null)} />}
    </div>
  );
}

function TakeQuiz({ q, session, onDone }) {
  const { attempt, questions } = session;
  const { toast, confirm } = useUi();
  const [answers, setAnswers] = useState(() => {
    try { return JSON.parse(localStorage.getItem(draftKey(attempt.id)) || 'null') || attempt.answers || {}; } catch { return attempt.answers || {}; }
  });
  const [index, setIndex] = useState(0);
  const [sending, setSending] = useState(false);
  const deadline = useMemo(() => new Date(attempt.started_at).getTime() + q.time_limit_min * 60e3, [attempt.started_at, q.time_limit_min]);
  const [left, setLeft] = useState(deadline - Date.now());
  const sent = useRef(false);

  useEffect(() => { try { localStorage.setItem(draftKey(attempt.id), JSON.stringify(answers)); } catch {} }, [answers, attempt.id]);

  const submit = useCallback(async (auto = false) => {
    if (sent.current) return;
    sent.current = true;
    setSending(true);
    try {
      const r = await api.post(`/quizzes/${q.id}/attempts/${attempt.id}/submit`, { answers });
      try { localStorage.removeItem(draftKey(attempt.id)); } catch {}
      if (auto) toast('El tiempo terminó: enviamos tus respuestas.', 'info');
      onDone(r);
    } catch (e) {
      sent.current = false;
      setSending(false);
      toast(e.message, 'error');
    }
  }, [answers, attempt.id, q.id, onDone, toast]);

  useEffect(() => {
    const t = setInterval(() => setLeft(deadline - Date.now()), 500);
    return () => clearInterval(t);
  }, [deadline]);
  useEffect(() => { if (left <= 0) submit(true); }, [left, submit]);
  useEffect(() => {
    const warn = (e) => { if (!sent.current) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);

  const answered = questions.filter((x) => (Array.isArray(answers[x.id]) ? answers[x.id].length : answers[x.id] != null)).length;
  const x = questions[index];
  const pick = (oi) => {
    if (x.type === 'multiple') {
      const cur = answers[x.id] || [];
      setAnswers({ ...answers, [x.id]: cur.includes(oi) ? cur.filter((v) => v !== oi) : [...cur, oi] });
    } else setAnswers({ ...answers, [x.id]: oi });
  };
  const finish = async () => {
    const missing = questions.length - answered;
    if (!(await confirm({ title: 'Enviar evaluación', message: missing ? `Tienes ${missing} pregunta(s) sin responder. ¿Deseas enviar de todos modos?` : 'Revisaste todas tus respuestas. ¿Deseas enviar?', confirmText: 'Enviar respuestas' }))) return;
    submit();
  };
  const secs = Math.max(0, Math.floor(left / 1000));
  const lowTime = secs < 120;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="sticky top-16 z-20 -mx-4 mb-6 border-b border-line bg-bg/90 px-4 py-3 backdrop-blur-xl sm:mx-0 sm:rounded-2xl sm:border sm:px-5">
        <div className="flex items-center gap-4">
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-ink">{q.title}</div>
            <div className="text-xs text-muted">{answered} de {questions.length} respondidas</div>
          </div>
          <div className={cx('flex items-center gap-2 rounded-xl px-3 py-1.5 font-mono text-[15px] font-semibold tabular-nums', lowTime ? 'animate-live bg-danger text-white' : 'bg-sunken text-ink')} aria-live="polite">
            <Timer size={16} /> {String(Math.floor(secs / 60)).padStart(2, '0')}:{String(secs % 60).padStart(2, '0')}
          </div>
        </div>
        <ProgressBar value={(answered / questions.length) * 100} size="sm" className="mt-3" />
      </div>

      <Card key={x.id} className="animate-fade-in p-5 sm:p-8">
        <div className="flex items-center justify-between text-xs font-semibold tracking-wide text-muted uppercase">
          <span>Pregunta {index + 1} de {questions.length}</span>
          <span>{x.type === 'multiple' ? 'Selecciona todas las correctas' : 'Selecciona una opción'} · {x.points} pt</span>
        </div>
        <h2 className="mt-3 text-xl leading-snug font-semibold text-ink sm:text-[1.4rem]">{x.prompt}</h2>
        <div className="mt-6 space-y-2.5">
          {x.options.map((o, oi) => {
            const sel = x.type === 'multiple' ? (answers[x.id] || []).includes(oi) : answers[x.id] === oi;
            const Icon = x.type === 'multiple' ? (sel ? CheckSquare : Square) : sel ? CheckCircle2 : Circle;
            return (
              <button key={oi} onClick={() => pick(oi)} aria-pressed={sel}
                className={cx('flex w-full items-center gap-3 rounded-xl border-2 p-4 text-left text-[15px] transition', sel ? 'border-primary bg-primary-soft text-ink' : 'border-line bg-surface text-ink-2 hover:border-line-strong')}>
                <span className={cx('flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold', sel ? 'bg-primary text-white' : 'bg-sunken text-muted')}>{String.fromCharCode(65 + oi)}</span>
                <span className="flex-1">{o}</span>
                <Icon size={20} className={sel ? 'text-primary' : 'text-line-strong'} />
              </button>
            );
          })}
        </div>
        <div className="mt-8 flex items-center justify-between gap-2">
          <Button variant="ghost" icon={ArrowLeft} disabled={index === 0} onClick={() => setIndex(index - 1)}>Anterior</Button>
          {index < questions.length - 1
            ? <Button variant="secondary" iconRight={ArrowRight} onClick={() => setIndex(index + 1)}>Siguiente</Button>
            : <Button icon={Send} onClick={finish} loading={sending}>Enviar respuestas</Button>}
        </div>
      </Card>

      <div className="mt-5 flex flex-wrap justify-center gap-2" aria-label="Navegador de preguntas">
        {questions.map((qq, i) => {
          const done = Array.isArray(answers[qq.id]) ? answers[qq.id].length : answers[qq.id] != null;
          return (
            <button key={qq.id} onClick={() => setIndex(i)} aria-label={`Ir a la pregunta ${i + 1}`}
              className={cx('h-9 w-9 rounded-lg text-sm font-semibold transition', i === index ? 'bg-ink text-bg' : done ? 'bg-primary-soft text-primary-ink' : 'border border-line bg-surface text-muted')}>
              {i + 1}
            </button>
          );
        })}
      </div>
      <div className="mt-6 text-center">
        <Button variant="soft" icon={Send} onClick={finish} loading={sending}>Terminar y enviar</Button>
      </div>
    </div>
  );
}

function ReviewList({ review }) {
  return (
    <ol className="space-y-3">
      {review.map((x, i) => (
        <li key={x.id} className={cx('rounded-xl border p-4', x.ok ? 'border-success/30 bg-success-soft/40' : 'border-danger/30 bg-danger-soft/40')}>
          <div className="flex gap-2">
            {x.ok ? <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-success" /> : <XCircle size={18} className="mt-0.5 shrink-0 text-danger" />}
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-ink">{i + 1}. {x.prompt}</div>
              <ul className="mt-2 space-y-1">
                {x.options.map((o, oi) => {
                  const correct = x.correct.includes(oi);
                  const given = x.given.includes(oi);
                  return (
                    <li key={oi} className={cx('flex items-center gap-2 text-sm', correct ? 'font-medium text-success' : given ? 'text-danger line-through' : 'text-muted')}>
                      {correct ? <CheckCircle2 size={14} /> : given ? <XCircle size={14} /> : <Circle size={14} className="text-line-strong" />} {o}
                      {given && <span className="text-[11px] font-normal text-faint no-underline">(tu respuesta)</span>}
                    </li>
                  );
                })}
              </ul>
              {x.explanation && <p className="mt-2 rounded-lg bg-surface/70 px-3 py-2 text-xs text-ink-2">💡 {x.explanation}</p>}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

function QuizResult({ q, result, onBack }) {
  const pass = (result.score / result.points) * 20 >= 13;
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Card className="animate-scale-in overflow-hidden text-center">
        <div className={cx('p-8', pass ? 'bg-gradient-to-b from-success-soft to-transparent' : 'bg-gradient-to-b from-warn-soft to-transparent')}>
          <div className={cx('mx-auto flex h-16 w-16 items-center justify-center rounded-full', pass ? 'bg-success text-white' : 'bg-warn text-white')}>
            {pass ? <Trophy size={30} /> : <AlertTriangle size={28} />}
          </div>
          <h2 className="font-display mt-4 text-3xl font-semibold text-ink">{pass ? '¡Buen trabajo!' : 'Sigue practicando'}</h2>
          <div className="font-display mt-2 text-6xl font-semibold text-ink tabular-nums">{fmtGrade(result.score)}<span className="text-2xl text-faint">/{result.points}</span></div>
          <p className="mt-2 text-sm text-muted">Respondiste correctamente {result.review.filter((r) => r.ok).length} de {result.review.length} preguntas.</p>
          <Button variant="secondary" icon={ArrowLeft} className="mt-6" onClick={onBack}>Volver a la evaluación</Button>
        </div>
      </Card>
      <div>
        <h3 className="mb-3 font-semibold text-ink">Revisión de respuestas</h3>
        <ReviewList review={result.review} />
      </div>
    </div>
  );
}

function ReviewModal({ q, review, onClose }) {
  return (
    <Modal open onClose={onClose} size="lg" title={`Revisión · ${fmtGrade(review.score)}/${review.points}`}
      description={`${review.student ? fullName(review.student) + ' · ' : ''}Enviado ${fmtDateTime(review.submitted_at)}`}>
      {review.review.length ? <ReviewList review={review.review} /> : <EmptyState title="Sin preguntas" />}
    </Modal>
  );
}
