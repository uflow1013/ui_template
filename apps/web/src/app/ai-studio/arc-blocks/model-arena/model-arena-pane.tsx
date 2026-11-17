"use client";

import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, CircleAlert, CircleDashed, Flag, LoaderCircle, RotateCcw, Square } from "lucide-react";
import { motionTokens } from "@/shared/arc/lib/motion-tokens";
import { AnimatedCounter } from "@/shared/arc/animated-counter/animated-counter";
import { Button } from "@/shared/arc/button/button";
import { TextShimmer } from "@/shared/arc/text-shimmer/text-shimmer";
import { StreamText, useStickToBottom } from "./stream-text";
import type { ArenaModel } from "./model-arena-data";
import styles from "./model-arena.module.css";

const { spring, duration, ease } = motionTokens;
/** Moves, resizes and swaps settle without overshoot, so nothing wobbles. */
export const settle = { type: "spring", visualDuration: 0.24, bounce: 0 } as const;
export const standard = [...ease.standard] as [number, number, number, number];
export const cx = (...names: (string | false | null | undefined)[]) => names.filter(Boolean).join(" ");

/* ---------------------------------------------------------------------------------------------------------------
 * State shapes and measurements
 * ------------------------------------------------------------------------------------------------------------- */

export type PaneStatus = "idle" | "waiting" | "streaming" | "done" | "stopped" | "error";

export interface PaneState {
  /** 0 for model A, 1 for model B. */
  slot: number;
  model: ArenaModel;
  status: PaneStatus;
  text: string;
  attempt: number;
  startedAt?: number;
  firstAt?: number;
  endedAt?: number;
  inTokens: number;
  outTokens: number;
  /** True once the stream reported its own token counts. */
  usage: boolean;
  /** 1 for the first pane to finish. */
  finish?: number;
  error?: { message: string; retryable: boolean };
}

export const working = (status: PaneStatus) => status === "waiting" || status === "streaming";
export const letter = (slot: number) => String.fromCharCode(65 + slot);
export const shortName = (model: ArenaModel) => model.shortName ?? model.name;

export interface Measured { ttft?: number; total?: number; tps?: number; cost: number; outTokens: number }

/** Live readouts for one pane at time `now`. Timing comes from the stream itself, so it holds for a real run too. */
export function measure(pane: PaneState, now: number): Measured {
  const { startedAt, firstAt, status, model } = pane;
  const end = pane.endedAt ?? now;
  const ttft = startedAt === undefined ? undefined : firstAt !== undefined ? firstAt - startedAt : status === "waiting" ? now - startedAt : undefined;
  const total = startedAt === undefined ? undefined : end - startedAt;
  const span = firstAt === undefined ? 0 : end - firstAt;
  // Live speed waits for a few hundred milliseconds of output, so the first reading is already steady; a short answer
  // that has finished still gets its speed.
  const tps = pane.outTokens > 0 && span > (status === "streaming" ? 400 : 120) ? pane.outTokens / (span / 1000) : undefined;
  const cost = (pane.inTokens * model.price.input + pane.outTokens * model.price.output) / 1e6;
  return { ttft, total, tps, cost, outTokens: pane.outTokens };
}

const seconds = (ms: number | undefined) => ms === undefined ? "–" : `${(ms / 1000).toFixed(2)}s`;

/** A clock that ticks on animation frames, about ten times a second, while `active`. */
function useNow(active: boolean, every = 90) {
  const [now, setNow] = useState(() => (typeof performance === "undefined" ? 0 : performance.now()));
  useEffect(() => {
    if (!active) return;
    let frame = 0, last = 0;
    const tick = (at: number) => {
      if (at - last >= every) { last = at; setNow(at); }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active, every]);
  return now;
}

/** Measurements taken every `every` ms while `active`, for the pane's current run only. Null when there is no sample. */
function useSampled(pane: PaneState, active: boolean, every = 500) {
  const latest = useRef(pane);
  useEffect(() => { latest.current = pane; });
  const [sample, setSample] = useState<{ run?: number; value: Measured } | null>(null);
  useEffect(() => {
    if (!active) return;
    let frame = 0, last = -Infinity;
    const tick = (at: number) => {
      if (at - last >= every) { last = at; setSample({ run: latest.current.startedAt, value: measure(latest.current, at) }); }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active, every]);
  return active && sample && sample.run === pane.startedAt ? sample.value : null;
}

/* ---------------------------------------------------------------------------------------------------------------
 * Swap: one minimal crossfade. The old content fades out fast while the new one fades in, and the slot's width follows
 * the measured width of the new content on a spring with no bounce.
 * ------------------------------------------------------------------------------------------------------------- */

export function Swap({ swapKey, children, measure: sizer, reduced, className }: { swapKey: string; children: ReactNode; measure?: ReactNode; reduced: boolean; className?: string }) {
  const measureRef = useRef<HTMLSpanElement>(null);
  const measuredKey = useRef<string | null>(null);
  const [size, setSize] = useState<{ width: number | "auto"; animate: boolean }>({ width: "auto", animate: false });

  useLayoutEffect(() => {
    const node = measureRef.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const current = node.dataset.key ?? "";
      // Only a new key animates; a late font or a first measure snaps, so nothing wobbles on first paint.
      const animate = measuredKey.current !== null && measuredKey.current !== current;
      measuredKey.current = current;
      setSize({ width: Math.ceil(entry.borderBoxSize?.[0]?.inlineSize ?? node.offsetWidth), animate });
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return <motion.span className={cx(styles.swap, className)} initial={false} animate={{ width: size.width }} transition={size.animate && !reduced ? settle : { duration: 0 }}>
    <span ref={measureRef} data-key={swapKey} className={cx(styles.swapInner, styles.swapMeasure)} aria-hidden="true">{sizer ?? children}</span>
    <AnimatePresence initial={false} mode="popLayout">
      <motion.span key={swapKey} className={styles.swapInner}
        initial={reduced ? { opacity: 0 } : { opacity: 0, y: 2 }} animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, transition: { duration: reduced ? 0 : .1, ease: standard } }}
        transition={{ duration: reduced ? 0 : duration.fast, ease: standard }}>
        {children}
      </motion.span>
    </AnimatePresence>
  </motion.span>;
}

/* ---------------------------------------------------------------------------------------------------------------
 * Identity: "Model A" until the vote, then the real mark and name crossfade in where it stood
 * ------------------------------------------------------------------------------------------------------------- */

export function ModelMark({ model, className }: { model: ArenaModel; className?: string }) {
  const Mark = model.mark;
  if (!Mark) return <span className={cx(styles.markLetter, className)} aria-hidden="true">{model.name[0]}</span>;
  return <Mark className={cx(styles.mark, className)} style={model.markColor ? { color: model.markColor } : undefined} aria-hidden="true" title={model.name} />;
}

export function Identity({ model, slot, revealed, reduced, short = false }: { model: ArenaModel; slot: number; revealed: boolean; reduced: boolean; short?: boolean }) {
  const label = revealed ? (short ? shortName(model) : model.name) : `Model ${letter(slot)}`;
  return <Swap swapKey={revealed ? `model-${model.id}` : `blind-${slot}`} reduced={reduced} className={styles.identity}>
    {revealed && <span className={styles.identityMark}><ModelMark model={model} /></span>}
    <span className={styles.identityName}>{label}</span>
  </Swap>;
}

/* ---------------------------------------------------------------------------------------------------------------
 * Status: an icon and a short word. Working words shimmer; the first pane to finish gets a small accent marker.
 * ------------------------------------------------------------------------------------------------------------- */

function statusOf(pane: PaneState, compact: boolean) {
  switch (pane.status) {
    case "waiting": return { key: "thinking", label: "Thinking", icon: <LoaderCircle className={styles.spin} />, busy: true };
    case "streaming": return { key: "writing", label: "Writing", icon: <LoaderCircle className={styles.spin} />, busy: true };
    case "done": return pane.finish === 1 ? { key: "first", label: compact ? "First" : "Finished first", icon: <Flag /> } : { key: "done", label: "Done", icon: <Check /> };
    case "stopped": return { key: "stopped", label: "Stopped", icon: <Square className={styles.stopGlyph} /> };
    case "error": return { key: "error", label: "Failed", icon: <CircleAlert /> };
    default: return { key: "idle", label: "Ready", icon: <CircleDashed /> };
  }
}

export function Status({ pane, reduced, compact = false }: { pane: PaneState; reduced: boolean; compact?: boolean }) {
  const { key, label, icon, busy } = statusOf(pane, compact);
  const body = (text: ReactNode) => <span className={styles.status} data-status={key}>
    <span className={styles.statusIcon} aria-hidden="true">{icon}</span>
    {text}
  </span>;
  // Each word mounts with its own shimmer, so a status change is one crossfade and never a morph inside the label.
  return <Swap swapKey={key} reduced={reduced} className={cx(styles.statusSlot, compact && styles.statusCompact)} measure={body(<span>{label}</span>)}>
    {body(busy ? <TextShimmer className={styles.statusLabel}>{label}</TextShimmer> : <span className={styles.statusLabel}>{label}</span>)}
  </Swap>;
}

/* ---------------------------------------------------------------------------------------------------------------
 * Metrics: first token, speed and cost on one quiet line. Speed and cost roll on tabular digits.
 * ------------------------------------------------------------------------------------------------------------- */

function Rolling({ value, decimals = 0, prefix }: { value: number; decimals?: number; prefix?: string }) {
  return <span className={cx(styles.num, styles.appear)}><AnimatedCounter value={value} decimals={decimals} prefix={prefix} /></span>;
}

export function Metrics({ pane }: { pane: PaneState }) {
  // The first token counts live while the model thinks. Speed and cost are sampled twice a second while it writes, so
  // each roll settles before the next one starts instead of spinning on every chunk.
  const now = useNow(pane.status === "waiting");
  const sampled = useSampled(pane, pane.status === "streaming");
  const m = sampled ?? measure(pane, Math.max(now, pane.startedAt ?? 0));
  const started = pane.startedAt !== undefined;
  const cents = Math.round(m.cost * 1e4) / 1e4;
  return <dl className={styles.metrics} aria-label={`Model ${letter(pane.slot)} metrics`}>
    <div className={styles.metric}>
      <dt>First token</dt>
      <dd><span className={styles.value} data-live={pane.status === "waiting" || undefined}>{seconds(m.ttft)}</span></dd>
    </div>
    <div className={styles.metric}>
      <dt className={styles.srOnly}>Speed</dt>
      <dd><span className={styles.value} style={{ minWidth: "3ch" }}>{m.tps === undefined ? "–" : <Rolling value={Math.round(m.tps)} />}</span> <span className={styles.unit}>tok/s</span></dd>
    </div>
    <div className={styles.metric}>
      <dt className={styles.srOnly}>Cost</dt>
      <dd><span className={styles.value}>{started ? <Rolling value={cents} decimals={cents >= 1 ? 2 : 4} prefix="$" /> : "–"}</span></dd>
    </div>
  </dl>;
}

/* ---------------------------------------------------------------------------------------------------------------
 * Pane: identity and status, the streamed answer in a fixed height, and the metrics line
 * ------------------------------------------------------------------------------------------------------------- */

export interface PaneProps {
  pane: PaneState;
  revealed: boolean;
  reduced: boolean;
  /** Buffer and pace the stream. Off for scripted text that is already paced. */
  smooth: boolean;
  /** Narrow layouts move the header into the tab strip and show one pane at a time. */
  panel?: { id: string; labelledBy: string; active: boolean };
  onRetry: (slot: number) => void;
  onPromptHelp?: () => void;
}

export function Pane({ pane, revealed, reduced, smooth, panel, onRetry, onPromptHelp }: PaneProps) {
  const { scroller, content } = useStickToBottom(reduced);
  const busy = working(pane.status);
  const name = `Model ${letter(pane.slot)}`;
  return <section className={styles.pane} data-slot={pane.slot} id={panel?.id} role={panel ? "tabpanel" : undefined} aria-labelledby={panel?.labelledBy}
    aria-label={panel ? undefined : revealed ? `${name}, ${pane.model.name}` : name} hidden={(panel && !panel.active) || undefined}>
    {panel ? null : <header className={styles.paneHead}>
      <Identity model={pane.model} slot={pane.slot} revealed={revealed} reduced={reduced} />
      <Status pane={pane} reduced={reduced} />
    </header>}
    <div ref={scroller} className={styles.scroller} tabIndex={0} aria-label={`${name} answer`} aria-busy={busy || undefined}>
      <div ref={content} className={styles.content}>
        {pane.status === "idle" && !pane.text ? <p className={styles.empty}>The answer streams here</p> : null}
        {pane.text ? <StreamText text={pane.text} streaming={busy} smooth={smooth} className={styles.answer} /> : null}
        <AnimatePresence initial={false}>
          {pane.status === "error" && pane.error ? <motion.div key={`error-${pane.attempt}`} className={styles.error} role="alert"
            initial={reduced ? { opacity: 0 } : { opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
            transition={reduced ? { duration: 0 } : { ...spring.smooth, opacity: { duration: duration.fast, ease: standard } }}>
            <div className={styles.errorInner}>
              <p className={styles.errorTitle}><CircleAlert aria-hidden="true" />{pane.text ? "Stream interrupted" : "No answer"}</p>
              <p className={styles.errorText}>{pane.error.message}</p>
              {pane.error.retryable
                ? <Button variant="secondary" size="sm" onClick={() => onRetry(pane.slot)}><RotateCcw aria-hidden="true" />Retry model {letter(pane.slot)}</Button>
                : onPromptHelp ? <Button variant="secondary" size="sm" onClick={onPromptHelp}>Use a sample prompt</Button> : null}
            </div>
          </motion.div> : null}
        </AnimatePresence>
      </div>
    </div>
    <Metrics pane={pane} />
  </section>;
}

/* ---------------------------------------------------------------------------------------------------------------
 * Narrow layouts: two tabs that keep both statuses in view, with a highlight that slides on a tween
 * ------------------------------------------------------------------------------------------------------------- */

export function PaneTabs({ id, panes, active, revealed, reduced, onSelect }: { id: string; panes: PaneState[]; active: number; revealed: boolean[]; reduced: boolean; onSelect: (index: number, focus?: boolean) => void }) {
  const onKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    const last = panes.length - 1;
    const next = event.key === "ArrowRight" ? (active === last ? 0 : active + 1) : event.key === "ArrowLeft" ? (active === 0 ? last : active - 1) : event.key === "Home" ? 0 : event.key === "End" ? last : -1;
    if (next < 0) return;
    event.preventDefault();
    onSelect(next, true);
  };
  return <div className={styles.tabs} role="tablist" aria-label="Answers">
    <motion.span className={styles.tabHighlight} aria-hidden="true" initial={false} animate={{ x: `${active * 100}%` }} transition={reduced ? { duration: 0 } : { duration: .22, ease: standard }} />
    {panes.map((pane, index) => <button key={pane.slot} type="button" role="tab" id={`${id}-tab-${pane.slot}`} aria-controls={`${id}-panel-${pane.slot}`} aria-selected={index === active} tabIndex={index === active ? 0 : -1}
      className={styles.tab} data-active={index === active || undefined} onClick={() => onSelect(index)} onKeyDown={onKeyDown}>
      <Identity model={pane.model} slot={pane.slot} revealed={revealed[index]} reduced={reduced} short />
      <Status pane={pane} reduced={reduced} compact />
    </button>)}
  </div>;
}
