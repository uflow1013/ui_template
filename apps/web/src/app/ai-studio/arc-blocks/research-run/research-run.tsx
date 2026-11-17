"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { AnimatePresence, motion, type Transition } from "motion/react";
import { ArrowDown, ArrowUp, Check, ChevronDown, CircleAlert, CornerDownRight, LoaderCircle, Plus, RotateCcw, Square } from "lucide-react";
import { motionTokens } from "@/shared/arc/lib/motion-tokens";
import { CopyLabel, StreamStatus, StreamText, streamPlainText, useCopy, useReducedStream, useStickToBottom } from "./stream-text";
import { sampleQuestion, sampleSuggestions, scriptedResearch, type ResearchEvent, type ResearchSource, type ResearchTurn } from "./research-run-data";
import styles from "./research-run.module.css";

export type { ResearchEvent, ResearchSource, ResearchTurn } from "./research-run-data";

const { spring, duration, ease, stagger } = motionTokens;
const standard = [...ease.standard] as [number, number, number, number];
const cx = (...names: (string | false | null | undefined)[]) => names.filter(Boolean).join(" ");

/* ---------------------------------------------------------------------------------------------------------------
 * State
 * ------------------------------------------------------------------------------------------------------------- */

type Status = "planning" | "searching" | "reading" | "composing" | "writing" | "done" | "stopped" | "error";
type QueryState = { text: string; state: "queued" | "searching" | "done"; results?: number };
type SourceState = { source: ResearchSource; query?: number; progress: number; n: number };
interface Turn {
  id: number;
  question: string;
  status: Status;
  queries: QueryState[];
  sources: SourceState[];
  answer: string;
  followUps: string[];
  started: number;
  researched?: number;
  ended?: number;
  tokens?: number;
  error?: string;
  /** Set when someone opens or closes the research steps by hand; otherwise they follow the run. */
  stepsOpen?: boolean;
}

const researching = (status: Status) => status === "planning" || status === "searching" || status === "reading";
const running = (status: Status) => status !== "done" && status !== "stopped" && status !== "error";

function applyEvent(turn: Turn, event: ResearchEvent, now: number): Turn {
  switch (event.type) {
    case "plan": return { ...turn, status: "searching", queries: event.queries.map(text => ({ text, state: "queued" })) };
    case "search": return { ...turn, queries: turn.queries.map((q, i) => i === event.query ? { ...q, state: "searching" } : q) };
    case "searched": return { ...turn, queries: turn.queries.map((q, i) => i === event.query ? { ...q, state: "done", results: event.results } : q) };
    case "source": return { ...turn, status: turn.status === "searching" ? "reading" : turn.status, sources: [...turn.sources, { source: event.source, query: event.query, progress: 0, n: turn.sources.length + 1 }] };
    case "read": {
      const sources = turn.sources.map(s => s.source.id === event.id ? { ...s, progress: Math.max(s.progress, event.progress) } : s);
      const complete = turn.queries.every(q => q.state === "done") && sources.every(s => s.progress >= 1);
      return complete && researching(turn.status) ? { ...turn, sources, status: "composing", researched: now } : { ...turn, sources };
    }
    case "text": return { ...turn, answer: turn.answer + event.delta, status: "writing", researched: turn.researched ?? now };
    case "followUps": return { ...turn, followUps: event.items };
    case "done": return { ...turn, status: "done", tokens: event.tokens, ended: now, researched: turn.researched ?? now };
  }
}

/* ---------------------------------------------------------------------------------------------------------------
 * Small hooks
 * ------------------------------------------------------------------------------------------------------------- */

/** A clock that ticks while `active`, for live elapsed readouts. */
function useNow(active: boolean, every = 250) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setNow(Date.now()), every);
    return () => window.clearInterval(id);
  }, [active, every]);
  return now;
}

/** Plain text for copying, with the cited sources listed underneath. */
function plainAnswer(turn: Turn) {
  const body = streamPlainText(turn.answer);
  const cited = turn.sources.filter(s => body.includes(`[${s.n}]`));
  return cited.length ? `${body}\n\nSources\n${cited.map(s => `[${s.n}] ${s.source.title}, ${s.source.url}`).join("\n")}` : body;
}

/** What is lit: a source, and the sentences that cite it. From a chip, only that chip's sentence. */
type Hover = { n: number; sentence?: number } | null;

/* ---------------------------------------------------------------------------------------------------------------
 * Pieces
 * ------------------------------------------------------------------------------------------------------------- */

/** The source's own mark, plain, in the text color. Without one, the domain's first letter stands in. */
function Mark({ source, className }: { source: ResearchSource; className?: string }) {
  if (!source.logo) return <span className={cx(styles.mark, styles.letter, className)} aria-hidden="true">{source.domain[0]?.toUpperCase()}</span>;
  const url = `url("${source.logo}")`;
  return <span className={cx(styles.mark, className)} style={{ maskImage: url, WebkitMaskImage: url } as CSSProperties} aria-hidden="true" />;
}

function Elapsed({ from, to }: { from: number; to?: number }) {
  const now = useNow(to === undefined, 200);
  const seconds = Math.max(0, Math.floor(((to ?? now) - from) / 1000));
  return <span className={styles.tabular}>{seconds}s</span>;
}

function Steps({ turn, reduced, onToggle }: { turn: Turn; reduced: boolean; onToggle: (open: boolean) => void }) {
  const id = useId();
  const live = researching(turn.status);
  const open = turn.stepsOpen ?? live;
  const read = turn.sources.filter(s => s.progress >= 1).length;
  const panel: Transition = reduced ? { duration: 0 } : spring.smooth;
  let label: ReactNode;
  if (turn.status === "planning") label = <span className={styles.shimmer}>Planning the research</span>;
  else if (live) label = <><span className={styles.shimmer}>Researching</span><span className={styles.dotSep} aria-hidden="true" /><Elapsed from={turn.started} /><span className={styles.dotSep} aria-hidden="true" /><span className={styles.tabular}>{read} of {turn.sources.length} read</span></>;
  else if (turn.status === "stopped" && !turn.answer) label = <>Stopped after <Elapsed from={turn.started} to={turn.researched ?? turn.ended} /><span className={styles.dotSep} aria-hidden="true" /><span className={styles.tabular}>{read} sources read</span></>;
  else label = <>Researched for <Elapsed from={turn.started} to={turn.researched ?? turn.ended} /><span className={styles.dotSep} aria-hidden="true" /><span className={styles.tabular}>{turn.sources.length} sources</span></>;

  return <div className={styles.steps}>
    <button type="button" className={styles.stepsToggle} aria-expanded={open} aria-controls={id} onClick={() => onToggle(!open)}>
      <span className={styles.stepsLabel}>{label}</span>
      <ChevronDown className={styles.chevron} data-open={open || undefined} aria-hidden="true" />
    </button>
    <motion.div id={id} className={styles.clip} initial={false} animate={{ height: open ? "auto" : 0, opacity: open ? 1 : 0 }} transition={panel} inert={!open || undefined}>
      <ol className={styles.queries}>
        <AnimatePresence initial={false}>
          {turn.queries.map((query, i) => {
            const picked = turn.sources.filter(s => s.query === i);
            // The row grows from nothing, so the panel opens smoothly as the plan lands instead of snapping to its full height.
            return <motion.li key={query.text} className={styles.queryItem}
              initial={reduced ? { opacity: 0 } : { opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
              transition={reduced ? { duration: duration.fast } : { ...spring.smooth, delay: i * stagger.item * 2, opacity: { duration: duration.standard, ease: standard, delay: i * stagger.item * 2 } }}>
              <div className={styles.query} data-state={query.state}>
              <span className={styles.queryIcon} aria-hidden="true">
                <AnimatePresence initial={false} mode="popLayout">
                  {query.state === "done"
                    ? <motion.span key="done" initial={{ opacity: 0, scale: .6 }} animate={{ opacity: 1, scale: 1 }} transition={reduced ? { duration: 0 } : spring.snappy}><Check /></motion.span>
                    : turn.status === "stopped" ? <motion.span key="stop" initial={false}><Square className={styles.stopGlyph} /></motion.span>
                    : <motion.span key="spin" exit={{ opacity: 0, scale: .6 }} transition={{ duration: duration.instant }}><LoaderCircle className={query.state === "searching" ? styles.spin : styles.idleSpin} /></motion.span>}
                </AnimatePresence>
              </span>
              <span className={styles.queryText}>{query.text}</span>
              <span className={styles.queryMeta}>
                <span className={styles.faviconStack} aria-hidden="true">
                  <AnimatePresence initial={false}>
                    {picked.slice(0, 4).map(s => <motion.span key={s.source.id} initial={reduced ? { opacity: 0 } : { opacity: 0, scale: .5, x: -4 }} animate={{ opacity: 1, scale: 1, x: 0 }} transition={reduced ? { duration: 0 } : spring.snappy}><Mark source={s.source} className={styles.markSmall} /></motion.span>)}
                  </AnimatePresence>
                </span>
                <span className={styles.results} data-shown={query.results !== undefined || undefined}>{query.results ?? 0} results</span>
              </span>
              </div>
            </motion.li>;
          })}
        </AnimatePresence>
      </ol>
    </motion.div>
  </div>;
}

interface SourcesProps { turn: Turn; hover: Hover; flash: number | null; reduced: boolean; onHover: (hover: Hover) => void }

function SourceRow({ state, lit, flash, reduced, onHover, id }: { state: SourceState; lit: boolean; flash: boolean; reduced: boolean; onHover: (hover: Hover) => void; id: string }) {
  const [open, setOpen] = useState(false);
  const reading = state.progress < 1;
  const { source } = state;
  return <motion.li data-source={id} className={styles.source} data-lit={lit || undefined} data-flash={flash || undefined} data-reading={reading || undefined}
    initial={reduced ? { opacity: 0 } : { opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} transition={reduced ? { duration: duration.fast } : spring.smooth}
    onPointerEnter={event => { if (event.pointerType === "mouse") onHover({ n: state.n }); }} onPointerLeave={event => { if (event.pointerType === "mouse") onHover(null); }}>
    <button type="button" className={styles.sourceButton} aria-expanded={open} onClick={() => setOpen(!open)} onFocus={() => onHover({ n: state.n })} onBlur={() => onHover(null)}>
      <Mark source={source} className={styles.markRow} />
      <span className={styles.sourceMain}>
        <span className={styles.sourceTitle}>{source.title}</span>
        <span className={styles.sourceMeta}>{source.domain}{source.date ? <><span className={styles.dotSep} aria-hidden="true" />{source.date}</> : null}</span>
      </span>
      <span className={styles.sourceN} aria-label={reading ? `Reading, ${Math.round(state.progress * 100)} percent` : `Source ${state.n}`}>
        <svg viewBox="0 0 20 20" aria-hidden="true"><circle className={styles.ringTrack} cx="10" cy="10" r="8.75" /><circle className={styles.ring} cx="10" cy="10" r="8.75" pathLength={1} style={{ strokeDashoffset: 1 - state.progress }} /></svg>
        <span aria-hidden="true">{state.n}</span>
      </span>
    </button>
    <motion.div className={styles.clip} initial={false} animate={{ height: open ? "auto" : 0, opacity: open ? 1 : 0 }} transition={reduced ? { duration: 0 } : spring.smooth} inert={!open || undefined}>
      <p className={styles.snippet}>{source.snippet}</p>
      <a className={styles.sourceLink} href={source.url} target="_blank" rel="noreferrer">{source.url.replace(/^https:\/\//, "")}</a>
    </motion.div>
  </motion.li>;
}

function SourceList({ turn, hover, flash, reduced, onHover }: SourcesProps) {
  return <ol className={styles.sourceList}>
    <AnimatePresence initial={false}>
      {turn.sources.map(state => <SourceRow key={state.source.id} id={`${turn.id}-${state.n}`} state={state} reduced={reduced} onHover={onHover}
        lit={hover?.n === state.n} flash={flash === state.n} />)}
    </AnimatePresence>
  </ol>;
}

/** Narrow layouts: a favicon strip that opens into the list, so the stream stays the last thing on screen. */
function SourceStrip(props: SourcesProps & { open: boolean; onOpen: (open: boolean) => void }) {
  const { turn, reduced, open, onOpen } = props;
  const id = useId();
  const read = turn.sources.filter(s => s.progress >= 1).length;
  if (!turn.sources.length) return null;
  // The strip arrives with the first source; it grows into place so the answer below glides down instead of jumping.
  return <motion.div className={styles.strip} initial={reduced ? { opacity: 0 } : { opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} transition={reduced ? { duration: duration.fast } : spring.smooth}>
    <button type="button" className={styles.stripToggle} aria-expanded={open} aria-controls={id} onClick={() => onOpen(!open)}>
      <span className={styles.stripIcons} aria-hidden="true">
        {turn.sources.slice(0, 5).map(s => <Mark key={s.source.id} source={s.source} className={styles.markStrip} />)}
      </span>
      <span className={styles.tabular}>{researching(turn.status) ? `${read} of ${turn.sources.length} sources read` : `${turn.sources.length} sources`}</span>
      <ChevronDown className={styles.chevron} data-open={open || undefined} aria-hidden="true" />
    </button>
    <motion.div id={id} className={styles.clip} initial={false} animate={{ height: open ? "auto" : 0, opacity: open ? 1 : 0 }} transition={reduced ? { duration: 0 } : spring.smooth} inert={!open || undefined}>
      <SourceList {...props} />
    </motion.div>
  </motion.div>;
}

function CopyAction({ text }: { text: string }) {
  const { state, copy } = useCopy();
  return <button type="button" className={styles.action} onClick={() => copy(text)} aria-label={state === "copied" ? "Answer copied" : state === "failed" ? "Copy failed, try again" : "Copy answer"}>
    <CopyLabel state={state} />
  </button>;
}

function formatTokens(n: number) { return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n); }

interface TurnViewProps {
  turn: Turn;
  hover: Hover;
  flash: number | null;
  onHover: (hover: Hover) => void;
  onCite: (n: number) => void;
  last: boolean;
  reduced: boolean;
  pace?: number;
  shown: React.RefObject<Map<number, string>>;
  onToggleSteps: (open: boolean) => void;
  onStop: () => void;
  onRerun: () => void;
  onAsk: (question: string) => void;
}

function TurnView({ turn, hover, flash, onHover, onCite, last, reduced, pace, shown, onToggleSteps, onStop, onRerun, onAsk }: TurnViewProps) {
  const [stripOpen, setStripOpen] = useState(false);
  const [text, setText] = useState(turn.answer);
  const [revealed, setRevealed] = useState(!running(turn.status));
  const streaming = turn.status === "composing" || turn.status === "writing";
  const revealing = !revealed && turn.status === "done";
  const writing = streaming || revealing;
  const finished = !running(turn.status) && !revealing;
  const busy = running(turn.status) || revealing;
  const quick = { duration: reduced ? 0 : duration.fast, ease: standard };
  const onShown = (value: string) => { setText(value); shown.current.set(turn.id, value); };
  const onRevealed = () => setRevealed(true);

  // Chips render once when they land, so their handlers read the latest callbacks through a ref.
  const handlers = useRef({ onHover, onCite });
  useLayoutEffect(() => { handlers.current = { onHover, onCite }; });
  const renderCite = useCallback((n: number, sentence: number) => {
    const source = turn.sources.find(s => s.n === n)?.source;
    return <button type="button" className={styles.chip} data-cite={n} data-s={sentence} aria-label={source ? `Source ${n}: ${source.title}` : `Source ${n}`}
      onPointerEnter={event => { if (event.pointerType === "mouse") handlers.current.onHover({ n, sentence }); }}
      onPointerLeave={event => { if (event.pointerType === "mouse") handlers.current.onHover(null); }}
      onFocus={() => handlers.current.onHover({ n, sentence })} onBlur={() => handlers.current.onHover(null)}
      // On narrow layouts a chip opens the source list under the question first; the root then flashes the row.
      onClick={() => { setStripOpen(true); handlers.current.onCite(n); }}>{n}</button>;
  }, [turn.sources]);

  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const tokens = turn.tokens ?? Math.round(turn.answer.length / 3.6);
  const sourcesProps: SourcesProps = { turn, hover, flash, reduced, onHover };

  return <article className={styles.turn} aria-label={turn.question} data-turn={turn.id}>
    <div className={styles.main}>
      <h3 className={styles.question}>{turn.question}</h3>
      <Steps turn={turn} reduced={reduced} onToggle={onToggleSteps} />
      <SourceStrip {...sourcesProps} open={stripOpen} onOpen={setStripOpen} />

      <div className={styles.stage}>
        {turn.answer || streaming ? <StreamText className={styles.answerText} text={turn.answer} streaming={streaming} smooth={turn.status !== "stopped"} pace={pace}
          placeholder={<StreamStatus reduced={reduced}>Writing the answer</StreamStatus>} renderCite={renderCite} onShown={onShown} onRevealed={onRevealed} /> : null}
        {turn.status === "stopped" && !turn.answer ? <p className={styles.note}>Stopped before the answer. Rerun to research again.</p> : null}
        {turn.status === "error" ? <p className={styles.note} role="alert"><CircleAlert className={styles.inlineIcon} aria-hidden="true" />{turn.error ?? "The research failed."} Rerun to try again.</p> : null}
      </div>

      {/* A reserved row: Stop while working, then Copy and Rerun. It never changes height, so nothing below moves. */}
      <div className={styles.actions}>
        <AnimatePresence initial={false} mode="popLayout">
          {busy ? <motion.div key="busy" className={styles.actionGroup} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: quick }} transition={quick}>
            {running(turn.status) ? <button type="button" className={styles.action} onClick={onStop}>
              <span className={styles.iconSlot} aria-hidden="true"><Square className={styles.stopGlyph} /></span>Stop
            </button> : null}
            {writing && words ? <span className={styles.readout}><span className={styles.tabular}>{words}</span> words</span> : null}
          </motion.div> : finished && last || finished && turn.answer ? <motion.div key="done" className={styles.actionGroup} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: quick }} transition={{ ...quick, delay: reduced ? 0 : .08 }}>
            {turn.answer ? <CopyAction text={plainAnswer(turn)} /> : null}
            {last ? <button type="button" className={cx(styles.action, styles.rerun)} onClick={onRerun}>
              <span className={styles.iconSlot} aria-hidden="true"><RotateCcw /></span>Rerun
            </button> : null}
            <span className={styles.readout}>
              {turn.status === "stopped" ? "Stopped" : turn.status === "error" ? "Failed" : <>
                <Elapsed from={turn.started} to={turn.ended} /><span className={styles.dotSep} aria-hidden="true" /><span className={styles.tabular}>{formatTokens(tokens)}</span> tokens
              </>}
            </span>
          </motion.div> : null}
        </AnimatePresence>
      </div>

      <AnimatePresence initial={false}>
        {last && finished && turn.status === "done" && turn.followUps.length ? <motion.div key="follow" className={styles.followUps} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={quick}>
          <p className={styles.followLabel}>Follow up</p>
          <ul className={styles.followList}>
            {turn.followUps.map((item, i) => <motion.li key={item} initial={reduced ? { opacity: 0 } : { opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: duration.standard, ease: standard, delay: reduced ? 0 : .12 + i * stagger.item * 2 }}>
              <button type="button" className={styles.followButton} onClick={() => onAsk(item)}>
                <CornerDownRight className={styles.followIcon} aria-hidden="true" /><span>{item}</span>
                <ArrowUp className={styles.followGo} aria-hidden="true" />
              </button>
            </motion.li>)}
          </ul>
        </motion.div> : null}
      </AnimatePresence>
    </div>

    <div className={styles.srOnly} aria-live="polite">{finished && turn.answer ? `Answer ${turn.status === "stopped" ? "stopped" : "ready"}, ${turn.sources.length} sources.` : ""}</div>
  </article>;
}

/* ---------------------------------------------------------------------------------------------------------------
 * ResearchRun
 * ------------------------------------------------------------------------------------------------------------- */

export interface ResearchRunProps {
  /** The first question. It runs on mount when autoStart is on. */
  question?: string;
  /** Starts the first question on mount. With it off, the block opens on an empty state with suggestions. Defaults to true. */
  autoStart?: boolean;
  /** Runs one research turn and yields events as they happen. Defaults to the scripted run in research-run-data.ts. Stop aborts `signal`. */
  onAsk?: (question: string, history: ResearchTurn[], signal: AbortSignal) => AsyncIterable<ResearchEvent>;
  /** Questions offered in the empty state. */
  suggestions?: string[];
  /** Reveal pace for the answer before the arrival rate is known, in characters per second. The reveal then follows the stream. */
  pace?: number;
  /** Called when a turn finishes, with its question and answer. */
  onComplete?: (turn: ResearchTurn) => void;
  /** Title in the header. Defaults to a short form of the first question. */
  title?: string;
  className?: string;
}

let nextId = 1;

export function ResearchRun({ question = sampleQuestion, autoStart = true, onAsk = scriptedResearch, suggestions = sampleSuggestions, pace, onComplete, title, className }: ResearchRunProps) {
  const reduced = useReducedStream();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const controller = useRef<AbortController | null>(null);
  const shown = useRef(new Map<number, string>());
  const turnsRef = useRef(turns);
  useLayoutEffect(() => { turnsRef.current = turns; });
  const ask = useRef(onAsk);
  const complete = useRef(onComplete);
  useEffect(() => { ask.current = onAsk; complete.current = onComplete; });
  const { scroller, content, away, jump, scrolled } = useStickToBottom(reduced);
  const input = useRef<HTMLTextAreaElement>(null);
  const active = turns.find(t => running(t.status));
  const [hover, setHover] = useState<(NonNullable<Hover> & { turn: number; sentences: number[] }) | null>(null);
  const [flash, setFlash] = useState<{ turn: number; n: number } | null>(null);
  const [focusTurn, setFocusTurn] = useState<number | null>(null);
  const flashTimer = useRef(0);
  useEffect(() => () => window.clearTimeout(flashTimer.current), []);
  const railRef = useRef<HTMLElement>(null);
  const railTurn = turns.find(t => t.id === (hover?.turn ?? focusTurn)) ?? turns[turns.length - 1];

  const hoverIn = (turn: number) => (next: Hover) => {
    if (!next) { setHover(null); return; }
    // The sentences a source supports are the ones whose chips cite it.
    const sentences = next.sentence !== undefined ? [next.sentence]
      : Array.from(document.querySelectorAll<HTMLElement>(`[data-turn="${turn}"] [data-cite="${next.n}"]`), chip => Number(chip.dataset.s));
    setHover({ ...next, turn, sentences });
    setFocusTurn(turn);
    // Hovering a chip brings its source row into view in the rail, without moving the thread.
    if (next.sentence !== undefined) requestAnimationFrame(() => {
      const row = railRef.current?.querySelector<HTMLElement>(`[data-source="${turn}-${next.n}"]`);
      const box = railRef.current?.querySelector<HTMLElement>(`.${styles.railScroll}`);
      if (!row || !box) return;
      const top = row.offsetTop - box.offsetTop, bottom = top + row.offsetHeight;
      if (top < box.scrollTop || bottom > box.scrollTop + box.clientHeight) box.scrollTo({ top: top - box.clientHeight / 2 + row.offsetHeight / 2, behavior: reduced ? "auto" : "smooth" });
    });
  };
  // A chip click moves its source into view in whichever list is showing and flashes it.
  const cite = (turn: number) => (n: number) => {
    setFocusTurn(turn);
    setFlash({ turn, n });
    window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setFlash(null), 1400);
    window.setTimeout(() => {
      document.querySelectorAll<HTMLElement>(`[data-source="${turn}-${n}"]`).forEach(row => {
        if (row.offsetParent) row.scrollIntoView({ block: "nearest", behavior: reduced ? "auto" : "smooth" });
      });
    }, 60);
  };

  const update = useCallback((id: number, fn: (turn: Turn) => Turn) => setTurns(list => list.map(t => t.id === id ? fn(t) : t)), []);

  const start = useCallback(async (text: string, replace?: number) => {
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    const id = nextId++;
    const fresh: Turn = { id, question: text, status: "planning", queries: [], sources: [], answer: "", followUps: [], started: Date.now() };
    const history = turnsRef.current.filter(t => t.id !== replace && t.answer).map(t => ({ question: t.question, answer: t.answer }));
    setTurns(list => replace === undefined ? [...list, fresh] : list.map(t => t.id === replace ? fresh : t));
    setFocusTurn(id);
    jump();
    try {
      for await (const event of ask.current(text, history, abort.signal)) {
        if (abort.signal.aborted) break;
        update(id, turn => applyEvent(turn, event, Date.now()));
      }
      if (abort.signal.aborted) return;
      update(id, turn => running(turn.status) ? { ...turn, status: "done", ended: Date.now(), researched: turn.researched ?? Date.now() } : turn);
      const done = turnsRef.current.find(t => t.id === id);
      if (done) complete.current?.({ question: done.question, answer: done.answer });
    } catch (error) {
      if (abort.signal.aborted) return;
      update(id, turn => ({ ...turn, status: "error", ended: Date.now(), error: error instanceof Error ? error.message : undefined }));
    }
  }, [jump, update]);

  const stop = useCallback(() => {
    const current = turnsRef.current.find(t => running(t.status));
    controller.current?.abort();
    if (!current) return;
    // Keep exactly what the reader has seen; text still in the buffer is dropped.
    const seen = shown.current.get(current.id) ?? "";
    update(current.id, turn => ({ ...turn, status: "stopped", answer: seen.trimEnd(), ended: Date.now(), researched: turn.researched ?? Date.now(), queries: turn.queries }));
  }, [update]);

  const started = useRef(false);
  useEffect(() => {
    if (!autoStart || started.current) return;
    started.current = true;
    const id = window.setTimeout(() => start(question), 450);
    return () => { window.clearTimeout(id); started.current = false; };
  }, [autoStart, question, start]);
  useEffect(() => () => controller.current?.abort(), []);

  const submit = () => {
    const text = draft.trim();
    if (!text || active) return;
    setDraft("");
    start(text);
  };
  const onKeyDown = (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); submit(); }
    if (event.key === "Escape" && active) { event.preventDefault(); stop(); }
  };
  const reset = () => { controller.current?.abort(); setTurns([]); setDraft(""); requestAnimationFrame(() => input.current?.focus()); };

  const heading = title ?? turns[0]?.question ?? "Research";
  // Chips and sentences render once as they stream in, so hover state reaches them through one small style rule.
  const lit = hover ? [
    ...hover.sentences.map(k => `[data-turn="${hover.turn}"] span[data-s="${k}"]{background:var(--accent-subtle)}`),
    `[data-turn="${hover.turn}"] .${styles.chip}[data-cite="${hover.n}"]${hover.sentence !== undefined ? `[data-s="${hover.sentence}"]` : ""}{border-color:var(--foreground);background:var(--foreground);color:var(--background)}`,
  ].join("") : "";
  const showTitle = Boolean(title) || scrolled || !turns.length;

  return <section className={cx(styles.root, className)} aria-label="Research">
    {lit ? <style>{lit}</style> : null}
    <header className={styles.header}>
      <div className={styles.titleWrap}>
        <AnimatePresence initial={false} mode="popLayout">
          <motion.h2 key={showTitle ? heading : "research"} className={styles.title} initial={{ opacity: 0, y: reduced ? 0 : 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: reduced ? 0 : -6 }} transition={{ duration: duration.standard, ease: standard }}>{showTitle ? heading : "Research"}</motion.h2>
        </AnimatePresence>
      </div>
      <button type="button" className={styles.headerButton} onClick={reset} disabled={!turns.length}>
        <Plus aria-hidden="true" /><span>New research</span>
      </button>
    </header>

    <div className={styles.body}>
    <div className={styles.column}>
    <div ref={scroller} className={styles.scroller} tabIndex={-1}>
      <div ref={content} className={styles.thread}>
        {turns.length === 0 ? <div className={styles.empty}>
          <p className={styles.emptyTitle}>What should we research?</p>
          <ul className={styles.followList}>
            {suggestions.map(item => <li key={item}><button type="button" className={styles.followButton} onClick={() => start(item)}>
              <CornerDownRight className={styles.followIcon} aria-hidden="true" /><span>{item}</span><ArrowUp className={styles.followGo} aria-hidden="true" />
            </button></li>)}
          </ul>
        </div> : null}
        {turns.map((turn, i) => <TurnView key={turn.id} turn={turn} last={i === turns.length - 1} reduced={reduced} pace={pace} shown={shown}
          hover={hover?.turn === turn.id ? hover : null} flash={flash?.turn === turn.id ? flash.n : null} onHover={hoverIn(turn.id)} onCite={cite(turn.id)}
          onToggleSteps={open => update(turn.id, t => ({ ...t, stepsOpen: open }))}
          onStop={stop} onRerun={() => start(turn.question, turn.id)} onAsk={q => start(q)} />)}
      </div>
    </div>

    <div className={styles.dock}>
      <AnimatePresence>
        {away ? <motion.button key="jump" type="button" className={styles.jump} onClick={jump}
          initial={{ opacity: 0, y: reduced ? 0 : 6, x: "-50%" }} animate={{ opacity: 1, y: 0, x: "-50%" }} exit={{ opacity: 0, y: reduced ? 0 : 6, x: "-50%" }} transition={reduced ? { duration: 0 } : spring.snappy}>
          <ArrowDown aria-hidden="true" />Jump to latest
        </motion.button> : null}
      </AnimatePresence>
      <form className={styles.composer} onSubmit={event => { event.preventDefault(); if (active) stop(); else submit(); }}>
        <textarea ref={input} className={styles.input} rows={1} value={draft} onChange={event => setDraft(event.target.value)} onKeyDown={onKeyDown}
          placeholder={turns.length ? "Ask a follow up" : "Ask a research question"} aria-label={turns.length ? "Ask a follow up" : "Ask a research question"} />
        <button type="submit" className={styles.send} data-mode={active ? "stop" : "send"} disabled={!active && !draft.trim()} aria-label={active ? "Stop research" : "Send question"}>
          <AnimatePresence initial={false} mode="popLayout">
            <motion.span key={active ? "stop" : "send"} className={styles.sendIcon} initial={{ opacity: 0, scale: .5, rotate: reduced ? 0 : -45 }} animate={{ opacity: 1, scale: 1, rotate: 0 }} exit={{ opacity: 0, scale: .5 }} transition={reduced ? { duration: 0 } : spring.snappy}>
              {active ? <Square className={styles.stopGlyph} /> : <ArrowUp />}
            </motion.span>
          </AnimatePresence>
        </button>
      </form>
    </div>
    </div>

    <aside ref={railRef} className={styles.rail} aria-label="Sources">
      <div className={styles.railHead}>
        <span>Sources</span>
        <span className={styles.tabular}>{railTurn?.sources.length || ""}</span>
      </div>
      {turns.length > 1 && railTurn ? <p className={styles.railFor}>{railTurn.question}</p> : null}
      <div className={styles.railScroll}>
        {railTurn?.sources.length
          ? <SourceList key={railTurn.id} turn={railTurn} hover={hover?.turn === railTurn.id ? hover : null} flash={flash?.turn === railTurn.id ? flash.n : null} reduced={reduced} onHover={hoverIn(railTurn.id)} />
          : <p className={styles.railEmpty}>{railTurn ? railTurn.status === "planning" ? "Planning searches" : running(railTurn.status) ? "Searching" : "No sources" : "Sources appear here as the research reads them."}</p>}
      </div>
    </aside>
    </div>
  </section>;
}

export default ResearchRun;
