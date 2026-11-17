"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type FormEvent, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ArrowRight, Check, Equal, Play, RotateCcw, Square, ThumbsDown } from "lucide-react";
import { motionTokens } from "@/shared/arc/lib/motion-tokens";
import { AnimatedCounter } from "@/shared/arc/animated-counter/animated-counter";
import { Button } from "@/shared/arc/button/button";
import { Switch } from "@/shared/arc/switch/switch";
import { useReducedStream } from "./stream-text";
import { ArenaRunError, arenaModels, arenaPrompts, openingRounds, type ArenaModel, type ArenaPrompt, type ArenaRun } from "./model-arena-data";
import { createArenaSimulator } from "./model-arena-sim";
import { Leaderboard, rankModels, type BoardRow, type Record3 } from "./model-arena-board";
import { ModelMark, Pane, PaneTabs, cx, letter, measure, standard, working, type PaneState } from "./model-arena-pane";
import styles from "./model-arena.module.css";

export { ArenaRunError, arenaModels, arenaPrompts } from "./model-arena-data";
export type { ArenaModel, ArenaPrompt, ArenaRun, ArenaStreamEvent } from "./model-arena-data";
export type { Record3 as ArenaRecord } from "./model-arena-board";

const { spring, duration } = motionTokens;

/* ---------------------------------------------------------------------------------------------------------------
 * Public types
 * ------------------------------------------------------------------------------------------------------------- */

export type ArenaChoice = "a" | "b" | "tie" | "bad";

export interface ArenaVote {
  round: number;
  prompt: string;
  /** The pairing in pane order, model A first. */
  models: [ArenaModel, ArenaModel];
  choice: ArenaChoice;
  winner?: ArenaModel;
  /** What each pane measured from its stream, in pane order. */
  metrics: { model: ArenaModel; ttftMs?: number; tokensPerSecond?: number; totalMs?: number; outputTokens: number; costUsd: number }[];
}

export interface ModelArenaProps {
  /** The pool each round draws its blind pairing from. Defaults to seven current models. */
  contestants?: ArenaModel[];
  /** Sample prompts shown as chips under the prompt field. The first one prefills it. */
  prompts?: ArenaPrompt[];
  /** Streams one model's answer. Without it, the arena plays scripted sample answers at simulated speeds. */
  run?: ArenaRun;
  /** Called once per vote, with the pairing, the choice and each pane's measurements. */
  onVote?: (vote: ArenaVote) => void;
  /** Hide model names until a vote. Defaults to true. */
  defaultBlind?: boolean;
  /** Run the first round once the card scrolls into view. Defaults to true for the simulation, false with `run`. */
  autoStart?: boolean;
  /** Starting records per model id, such as standings loaded from your own store. */
  initialStandings?: Record<string, Record3>;
  className?: string;
}

/* ---------------------------------------------------------------------------------------------------------------
 * Round state
 * ------------------------------------------------------------------------------------------------------------- */

type Choice = { type: "winner"; slot: 0 | 1 } | { type: "tie" } | { type: "bad" };
type Pair = [ArenaModel, ArenaModel];
interface RoundState {
  id: number;
  prompt: string;
  started: boolean;
  panes: PaneState[];
  vote?: { choice: Choice; models: Pair };
}

const blank = (slot: number, model: ArenaModel): PaneState => ({ slot, model, status: "idle", text: "", attempt: 0, inTokens: 0, outTokens: 0, usage: false });
const zero: Record3 = { wins: 0, ties: 0, losses: 0 };
const pairOf = (panes: PaneState[]): Pair => [panes[0].model, panes[1].model];
const byId = (id: string) => arenaModels.find(model => model.id === id);

/** A fresh blind pairing in random order, never the same two models as last round. */
function pickPair(pool: ArenaModel[], previous: Pair): Pair {
  const before = previous.map(model => model.id).sort().join();
  for (let tries = 0; tries < 12; tries++) {
    const a = Math.floor(Math.random() * pool.length);
    let b = Math.floor(Math.random() * (pool.length - 1));
    if (b >= a) b++;
    const pair: Pair = [pool[a], pool[b]];
    if (pool.length <= 2 || pair.map(model => model.id).sort().join() !== before) return pair;
  }
  return [pool[0], pool[1]];
}

const choiceKey = (choice: Choice): ArenaChoice => choice.type === "winner" ? (choice.slot === 0 ? "a" : "b") : choice.type;

function voteSentence(choice: Choice, models: Pair) {
  if (choice.type === "winner") return `You picked ${models[choice.slot].name}`;
  if (choice.type === "tie") return "You called it a tie";
  return "You marked both as bad";
}

/** What the live region says about the round, derived from its state so it never drifts. */
function roundMessage(round: RoundState, demo: boolean) {
  if (!round.started) return "";
  const { panes } = round;
  if (round.vote) return `${voteSentence(round.vote.choice, round.vote.models)}. Model A was ${round.vote.models[0].name} and model B was ${round.vote.models[1].name}. Leaderboard updated.`;
  const busy = panes.filter(pane => working(pane.status));
  const failed = panes.filter(pane => pane.status === "error");
  if (busy.length === panes.length) return `${demo ? "Simulated run with scripted sample answers. " : ""}Two anonymous models are answering.`;
  if (failed.length) return `Model ${failed.map(pane => letter(pane.slot)).join(" and ")} failed.${busy.length ? "" : " Retry to vote, or start the next round."}`;
  const first = panes.find(pane => pane.finish === 1);
  if (busy.length) return first ? `Model ${letter(first.slot)} finished first.` : "";
  if (panes.some(pane => pane.status === "stopped")) return "Run stopped.";
  return "Both answers are ready. Vote to reveal the models.";
}

/** Height that follows its content on the smooth spring, so the vote row never resizes in one frame. */
function useAutoHeight<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [height, setHeight] = useState<number | "auto">("auto");
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => setHeight(entry.borderBoxSize?.[0]?.blockSize ?? node.offsetHeight));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return { ref, height };
}

const noop = () => () => {};
/** The shortcut hint for Run: Command on Apple platforms, Ctrl elsewhere. */
function useShortcutHint() {
  return useSyncExternalStore(noop, () => /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘↵" : "Ctrl ↵", () => "⌘↵");
}

/** Run and Stop share one cell, so the button keeps its width and the words crossfade. */
function RunLabel({ busy, hint }: { busy: boolean; hint: string }) {
  return <span className={styles.runLabel}>
    <span data-on={!busy || undefined} aria-hidden={busy || undefined}><Play aria-hidden="true" />Run<span className={styles.hint} aria-hidden="true">{hint}</span></span>
    <span data-on={busy || undefined} aria-hidden={!busy || undefined}><Square className={styles.stopIcon} aria-hidden="true" />Stop</span>
  </span>;
}

/* ---------------------------------------------------------------------------------------------------------------
 * Arena
 * ------------------------------------------------------------------------------------------------------------- */

/**
 * Runs one prompt against two models side by side, blind. Each pane streams its answer with live timing and cost; once
 * both answers land, a vote reveals the models and the leaderboard re-ranks.
 */
export function ModelArena({ contestants = arenaModels, prompts = arenaPrompts, run, onVote, defaultBlind = true, autoStart, initialStandings, className }: ModelArenaProps) {
  const reduced = useReducedStream();
  const hint = useShortcutHint();
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const demo = !run;
  const opening = contestants === arenaModels && prompts === arenaPrompts;
  const [simulate] = useState(createArenaSimulator);
  const runner = run ?? simulate;
  const runnerRef = useRef(runner);
  useEffect(() => { runnerRef.current = runner; });

  const [prompt, setPrompt] = useState(() => (opening ? arenaPrompts.find(item => item.id === openingRounds[0].prompt)?.text : prompts[0]?.text) ?? "");
  const [blind, setBlind] = useState(defaultBlind);
  const [round, setRound] = useState<RoundState>(() => {
    const scripted = opening ? openingRounds[0].models.map(byId) : [];
    const pair: Pair = scripted[0] && scripted[1] ? [scripted[0], scripted[1]] : [contestants[0], contestants[1] ?? contestants[0]];
    return { id: 0, prompt: "", started: false, panes: pair.map((model, slot) => blank(slot, model)) };
  });
  const [standings, setStandings] = useState<Record<string, Record3>>(() => ({ ...initialStandings }));
  const [votes, setVotes] = useState(0);
  const [fresh, setFresh] = useState(false);
  const [before, setBefore] = useState<BoardRow[] | null>(null);
  const [notice, setNotice] = useState("");
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState(0);

  const live = useRef({ id: 0, sequence: 0 });
  const controllers = useRef(new Map<number, AbortController>());
  const rootRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<HTMLInputElement>(null);
  const runButton = useRef<HTMLButtonElement>(null);
  const nextButton = useRef<HTMLButtonElement>(null);
  const focusNext = useRef(false);

  const busy = round.panes.some(pane => working(pane.status));
  const pool = useMemo(() => {
    const extra = round.panes.map(pane => pane.model).filter(model => !contestants.some(item => item.id === model.id));
    return [...contestants, ...extra];
  }, [contestants, round.panes]);
  const rows = useMemo(() => rankModels(pool, standings), [pool, standings]);
  // Below 560px the panes become two tabs.
  const narrow = width > 0 && width < 560;

  /* Streaming ------------------------------------------------------------------------------------------------ */

  const launch = useCallback((roundId: number, slot: number, attempt: number, model: ArenaModel, text: string) => {
    controllers.current.get(slot)?.abort();
    const controller = new AbortController();
    controllers.current.set(slot, controller);
    const update = (fn: (pane: PaneState, panes: PaneState[]) => PaneState) => setRound(current => current.id !== roundId ? current
      : { ...current, panes: current.panes.map(pane => pane.slot === slot && pane.attempt === attempt ? fn(pane, current.panes) : pane) });
    const startedAt = performance.now();
    const inTokens = Math.ceil(text.length / 4) + 12;
    update(pane => ({ ...pane, status: "waiting", startedAt, inTokens }));

    void (async () => {
      try {
        for await (const event of runnerRef.current(model, text, controller.signal)) {
          if (controller.signal.aborted) return;
          const delta = typeof event === "string" ? event : event.text ?? "";
          const usage = typeof event === "string" ? undefined : event;
          const at = performance.now();
          update(pane => {
            const answer = pane.text + delta;
            const reported = usage?.outputTokens !== undefined;
            return {
              ...pane, text: answer, status: answer ? "streaming" : pane.status,
              firstAt: pane.firstAt ?? (delta ? at : undefined),
              inTokens: usage?.inputTokens ?? pane.inTokens,
              outTokens: reported ? usage!.outputTokens! : pane.usage ? pane.outTokens : Math.ceil(answer.trim().length / 4),
              usage: pane.usage || reported,
            };
          });
        }
        if (controller.signal.aborted) return;
        const at = performance.now();
        update((pane, panes) => pane.text
          ? { ...pane, status: "done", endedAt: at, finish: 1 + panes.filter(other => other.finish).length }
          : { ...pane, status: "error", endedAt: at, error: { message: "The stream ended without an answer.", retryable: true } });
      } catch (error) {
        if (controller.signal.aborted) return;
        const at = performance.now();
        const message = error instanceof Error && error.message ? error.message : "The model did not respond.";
        update(pane => ({ ...pane, status: "error", endedAt: at, error: { message, retryable: error instanceof ArenaRunError ? error.retryable : true } }));
      } finally {
        if (controllers.current.get(slot) === controller) controllers.current.delete(slot);
      }
    })();
  }, []);

  const abortAll = useCallback(() => {
    controllers.current.forEach(controller => controller.abort());
    controllers.current.clear();
  }, []);
  useEffect(() => abortAll, [abortAll]);

  const startRound = (text: string, pair: Pair) => {
    abortAll();
    const roundId = ++live.current.id;
    const panes = pair.map((model, slot) => blank(slot, model));
    setRound({ id: roundId, prompt: text, started: true, panes });
    setNotice("");
    panes.forEach(pane => launch(roundId, pane.slot, 0, pane.model, text));
  };

  const stop = () => {
    abortAll();
    const at = performance.now();
    setRound(current => ({ ...current, panes: current.panes.map(pane => working(pane.status) ? { ...pane, status: "stopped", endedAt: at } : pane) }));
  };

  /** Runs `text`. After a vote has revealed the pairing, a new prompt gets a new blind pairing. */
  const runPrompt = (text: string) => startRound(text, round.vote ? pickPair(pool, round.vote.models) : pairOf(round.panes));

  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    if (busy) { stop(); return; }
    const text = prompt.trim();
    if (!text) { fieldRef.current?.focus(); return; }
    runPrompt(text);
  };

  const pickChip = (text: string) => {
    setPrompt(text);
    runPrompt(text);
  };

  const retry = (slot: number) => {
    const pane = round.panes.find(item => item.slot === slot);
    if (!pane) return;
    const attempt = pane.attempt + 1;
    setRound(current => ({ ...current, panes: current.panes.map(item => item.slot === slot ? { ...blank(slot, item.model), attempt } : item) }));
    launch(round.id, slot, attempt, pane.model, round.prompt);
  };

  const nextRound = () => {
    const sequence = ++live.current.sequence;
    const scripted = opening ? openingRounds[sequence] : undefined;
    const models = scripted?.models.map(byId);
    let pair: Pair, text: string;
    if (scripted && models?.[0] && models[1]) {
      pair = [models[0], models[1]];
      text = arenaPrompts.find(item => item.id === scripted.prompt)?.text ?? prompt;
    } else {
      pair = pickPair(pool, pairOf(round.panes));
      const at = prompts.findIndex(item => item.text === prompt.trim());
      text = prompts.length ? prompts[(at + 1) % prompts.length].text : prompt;
    }
    setPrompt(text);
    startRound(text, pair);
    runButton.current?.focus({ preventScroll: true });
  };

  /* Votes ---------------------------------------------------------------------------------------------------- */

  const castVote = (choice: Choice) => {
    if (round.vote || busy) return;
    const models = pairOf(round.panes);
    const next = { ...standings };
    models.forEach((model, slot) => {
      const record = { ...(next[model.id] ?? zero) };
      // A tie is half a win for each; "both bad" is a loss for each, so it can never lift a model up the board.
      if (choice.type === "winner") { if (slot === choice.slot) record.wins++; else record.losses++; }
      else if (choice.type === "tie") record.ties++;
      else record.losses++;
      next[model.id] = record;
    });
    setBefore(rows);
    setStandings(next);
    setVotes(total => total + 1);
    setFresh(true);
    setRound(current => ({ ...current, vote: { choice, models } }));
    focusNext.current = Boolean(rootRef.current?.querySelector("[data-vote-group]")?.contains(document.activeElement));
    const now = performance.now();
    onVote?.({
      round: round.id, prompt: round.prompt, models, choice: choiceKey(choice), winner: choice.type === "winner" ? models[choice.slot] : undefined,
      metrics: round.panes.map(pane => { const m = measure(pane, now); return { model: pane.model, ttftMs: m.ttft, tokensPerSecond: m.tps, totalMs: m.total, outputTokens: m.outTokens, costUsd: m.cost }; }),
    });
  };
  useEffect(() => {
    if (!round.vote || !focusNext.current) return;
    focusNext.current = false;
    nextButton.current?.focus({ preventScroll: true });
  }, [round.vote]);

  const reset = () => {
    setStandings({});
    setVotes(0);
    setFresh(false);
    setBefore(null);
    setNotice("Leaderboard reset.");
  };

  /* Layout: two tabs below 560px ----------------------------------------------------------------------------- */

  useLayoutEffect(() => {
    const node = rootRef.current;
    if (!node) return;
    setWidth(node.getBoundingClientRect().width);
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const select = (index: number, focus = false) => {
    setActive(index);
    if (focus) document.getElementById(`${id}-tab-${index}`)?.focus();
  };

  /* Auto start ------------------------------------------------------------------------------------------------ */

  const startFirst = useRef(() => {});
  useEffect(() => { startFirst.current = () => { if (live.current.id === 0) submit(); }; });
  const shouldAutoStart = autoStart ?? demo;
  useEffect(() => {
    const node = rootRef.current;
    if (!shouldAutoStart || !node || typeof IntersectionObserver === "undefined") return;
    let timer = 0;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting) return;
      observer.disconnect();
      timer = window.setTimeout(() => startFirst.current(), 420);
    }, { threshold: .2 });
    observer.observe(node);
    return () => { observer.disconnect(); window.clearTimeout(timer); };
  }, [shouldAutoStart]);

  /* Keys ------------------------------------------------------------------------------------------------------ */

  const onFormKey = (event: ReactKeyboardEvent<HTMLFormElement>) => {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey) && !event.nativeEvent.isComposing) { event.preventDefault(); submit(); }
    else if (event.key === "Escape" && busy) { event.preventDefault(); stop(); }
  };

  const sampleInstead = () => {
    const first = prompts[0];
    if (first) pickChip(first.text);
  };

  /* Render ---------------------------------------------------------------------------------------------------- */

  const isRevealed = !blind || Boolean(round.vote);
  const done = round.panes.filter(pane => pane.status === "done").length;
  const phase = !round.started ? "idle" : round.vote ? "voted" : busy ? "pending"
    : round.panes.some(pane => pane.status === "error") ? "failed"
    : round.panes.some(pane => pane.status === "stopped") ? "stopped"
    : round.panes.every(pane => pane.status === "done") ? "vote" : "pending";
  const bar = useAutoHeight<HTMLDivElement>();
  const swap = {
    initial: { opacity: 0 }, animate: { opacity: 1 },
    exit: { opacity: 0, transition: { duration: reduced ? 0 : .1, ease: standard } },
    transition: { duration: reduced ? 0 : duration.fast, ease: standard },
  };

  const voteOptions: { choice: Choice; label: string; before?: ReactNode; after?: ReactNode }[] = [
    { choice: { type: "winner", slot: 0 }, label: "A is better", before: <ArrowLeft aria-hidden="true" /> },
    { choice: { type: "tie" }, label: "Tie", before: <Equal aria-hidden="true" /> },
    { choice: { type: "winner", slot: 1 }, label: "B is better", after: <ArrowRight aria-hidden="true" /> },
    { choice: { type: "bad" }, label: "Both bad", before: <ThumbsDown aria-hidden="true" /> },
  ];

  let barContent: ReactNode;
  if (phase === "vote") barContent = <motion.div key="vote" className={styles.voteRow} data-kind="vote" {...swap}>
    <p className={styles.voteLabel} id={`${id}-vote`}>Which answer is better?</p>
    <div className={styles.voteGroup} role="group" aria-labelledby={`${id}-vote`} data-vote-group="">
      {voteOptions.map(option => <Button key={option.label} variant="secondary" size="sm" className={styles.voteButton} onClick={() => castVote(option.choice)}>{option.before}{option.label}{option.after}</Button>)}
    </div>
  </motion.div>;
  else if (phase === "voted" && round.vote) {
    const { choice, models } = round.vote;
    const winner = choice.type === "winner" ? models[choice.slot] : undefined;
    barContent = <motion.div key="voted" className={styles.voteRow} data-kind="voted" {...swap}>
      <p className={styles.result}>
        <Check className={styles.resultIcon} aria-hidden="true" />
        <span className={styles.resultText}>{winner ? <>You picked<span className={styles.resultName}><ModelMark model={winner} />{winner.name}</span></> : voteSentence(choice, models)}</span>
      </p>
      <Button ref={nextButton} size="sm" className={cx(styles.accent, styles.nextButton)} onClick={nextRound}>Next round<ArrowRight aria-hidden="true" /></Button>
    </motion.div>;
  } else if (phase === "failed") {
    const failedPanes = round.panes.filter(pane => pane.status === "error");
    const canRetry = failedPanes.some(pane => pane.error?.retryable);
    barContent = <motion.div key="failed" className={styles.voteRow} data-kind="failed" {...swap}>
      <p className={styles.voteLabel}>Model {failedPanes.map(pane => letter(pane.slot)).join(" and ")} failed.{canRetry ? " Retry to vote, or move on." : ""}</p>
      <Button variant="secondary" size="sm" className={styles.nextButton} onClick={nextRound}>Next round<ArrowRight aria-hidden="true" /></Button>
    </motion.div>;
  } else if (phase === "stopped") barContent = <motion.div key="stopped" className={styles.voteRow} data-kind="stopped" {...swap}>
    <p className={styles.voteLabel}>Stopped before both answers finished</p>
    <Button variant="secondary" size="sm" onClick={() => submit()}><RotateCcw aria-hidden="true" />Run again</Button>
  </motion.div>;
  else if (phase === "pending") barContent = <motion.div key="pending" className={styles.voteRow} data-kind="pending" {...swap}>
    <p className={styles.voteLabel}>Voting opens when both answers finish<span className={styles.voteCount}>{done} of 2 done</span></p>
  </motion.div>;
  else barContent = <motion.div key="idle" className={styles.voteRow} data-kind="idle" {...swap}>
    <p className={styles.voteLabel}>Run a prompt, then vote for the better answer</p>
  </motion.div>;

  const activeTab = Math.min(active, 1);
  return <div ref={rootRef} className={cx(styles.root, className)}>
    <header className={styles.head}>
      <h2 className={styles.title}>Arena</h2>
      <span className={styles.round}><span>Round <span className={styles.num}><AnimatedCounter value={Math.max(1, round.id)} /></span></span></span>
      <div className={styles.tools}>
        <Leaderboard rows={rows} votes={votes} fresh={fresh} before={before} reduced={reduced} onOpen={() => setFresh(false)} onReset={reset} />
        <Switch className={styles.blind} label="Blind" checked={blind} onCheckedChange={setBlind} />
      </div>
    </header>

    <form className={styles.prompt} onSubmit={submit} onKeyDown={onFormKey}>
      <div className={styles.field}>
        <label className={styles.srOnly} htmlFor={`${id}-prompt`}>Prompt for both models</label>
        <input ref={fieldRef} id={`${id}-prompt`} className={styles.input} type="text" value={prompt} placeholder="Ask both models the same thing" autoComplete="off" enterKeyHint="go"
          onChange={event => setPrompt(event.target.value)} />
        <Button ref={runButton} type="submit" size="sm" variant={busy ? "secondary" : "primary"} className={cx(!busy && styles.accent, styles.runButton)}
          disabled={!busy && !prompt.trim()} aria-label={busy ? "Stop" : "Run"} aria-keyshortcuts={busy ? "Escape" : "Meta+Enter Control+Enter"}>
          <RunLabel busy={busy} hint={hint} />
        </Button>
      </div>
      <div className={styles.chips} role="group" aria-label="Sample prompts">
        {prompts.map(item => <button key={item.id} type="button" className={styles.chip} aria-pressed={item.text === prompt.trim()} onClick={() => pickChip(item.text)}>{item.label}</button>)}
      </div>
    </form>

    <div className={styles.stage} data-tabs={narrow || undefined}>
      {narrow ? <PaneTabs id={id} panes={round.panes} active={activeTab} revealed={round.panes.map(() => isRevealed)} reduced={reduced} onSelect={select} /> : null}
      <div className={styles.panes}>
        {round.panes.map(pane => <Pane key={pane.slot} pane={pane} revealed={isRevealed} reduced={reduced} smooth={!demo}
          panel={narrow ? { id: `${id}-panel-${pane.slot}`, labelledBy: `${id}-tab-${pane.slot}`, active: pane.slot === activeTab } : undefined}
          onRetry={retry} onPromptHelp={demo ? sampleInstead : undefined} />)}
      </div>
    </div>

    <motion.div className={styles.voteClip} initial={false} animate={{ height: bar.height }} transition={reduced ? { duration: 0 } : spring.smooth}>
      <div ref={bar.ref} className={styles.voteBar}>
        <AnimatePresence initial={false} mode="popLayout">{barContent}</AnimatePresence>
      </div>
    </motion.div>

    <p className={styles.srOnly} role="status" aria-live="polite">{notice || roundMessage(round, demo)}</p>
  </div>;
}

export default ModelArena;
