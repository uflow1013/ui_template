"use client";

/*
 * Small parts of the eval suite: outcome glyphs, rolling digits, an auto height frame, the filter control, model chips,
 * the score bar with its baseline ghost marker and the run history sparkline. Every move and resize is critically
 * damped: nothing here bounces.
 */

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { LayoutGroup, animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { ArrowDown, ArrowUp, Minus, Play, RotateCcw, Square } from "lucide-react";
import { motionTokens } from "@/shared/arc/lib/motion-tokens";
import { formatDelta, type EvalModel, type EvalRunRecord, type Outcome } from "./eval-suite-data";
import { ClaudeMark, OpenaiMark } from "./eval-suite-marks";
import styles from "./eval-suite.module.css";

/** Small fast moves: highlights and markers. Critically damped. */
export const GLIDE = { type: "spring", visualDuration: .22, bounce: 0 } as const;
export const instant = { duration: 0 } as const;
export const cx = (...names: (string | false | null | undefined)[]) => names.filter(Boolean).join(" ");

/* ---------------------------------------------------------------------------------------------------------------
 * Outcome glyphs and cells
 * ------------------------------------------------------------------------------------------------------------- */

const glyphPaths: Record<Outcome, string> = {
  pass: "M3.4 6.3 5.2 8.1 8.7 4.2",
  fail: "M4 4l4 4M8 4 4 8",
  error: "M6 3.4v3.1M6 8.55v.05",
};

export function OutcomeGlyph({ outcome, className }: { outcome: Outcome; className?: string }) {
  return <svg className={cx(styles.glyph, className)} viewBox="0 0 12 12" aria-hidden="true" focusable="false"><path d={glyphPaths[outcome]} /></svg>;
}

/** A small outcome square, the same language as the grid cells. Pending draws an empty square. */
export function MiniCell({ outcome, strong }: { outcome?: Outcome; strong?: boolean }) {
  return <span className={styles.mini} data-outcome={outcome} data-strong={strong || undefined} aria-hidden="true">{outcome && <OutcomeGlyph outcome={outcome} />}</span>;
}

/* ---------------------------------------------------------------------------------------------------------------
 * Counting numbers and auto height
 * ------------------------------------------------------------------------------------------------------------- */

export const formatPercent1 = (value: number) => `${value.toFixed(1)}`;
export const formatPercent0 = (value: number) => `${Math.round(value)}%`;
export const formatDollars = (value: number) => `$${value.toFixed(2)}`;

/**
 * A number that counts to its value on a critically damped spring with tabular numerals, so bursts of results read as
 * one smooth count instead of a flicker. A reset to zero jumps. Reduced motion shows the value at once.
 */
export function CountUp({ value, format, className }: { value: number; format: (value: number) => string; className?: string }) {
  const reduced = useReducedMotion();
  const shown = useMotionValue(value);
  const text = useTransform(shown, format);
  useEffect(() => {
    if (reduced || value === 0) { shown.jump(value); return; }
    const controls = animate(shown, value, { type: "spring", visualDuration: .45, bounce: 0 });
    return () => controls.stop();
  }, [value, reduced, shown]);
  return <span className={cx(styles.count, className)}>
    <span className={styles.srOnly}>{format(value)}</span>
    <motion.span aria-hidden="true">{text}</motion.span>
  </span>;
}

/**
 * Follows its content's height on the smooth spring, but only for a moment after `armKey` changes (a filter switch).
 * Other changes, such as a row expanding with its own animation, are followed at once.
 */
export function AutoHeight({ children, armKey, className }: { children: ReactNode; armKey: string; className?: string }) {
  const reduced = useReducedMotion();
  const inner = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | "auto">("auto");
  const [prevKey, setPrevKey] = useState(armKey);
  const [armed, setArmed] = useState(false);
  if (armKey !== prevKey) { setPrevKey(armKey); setArmed(true); }
  useLayoutEffect(() => {
    const node = inner.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setHeight(Math.ceil(entry.borderBoxSize?.[0]?.blockSize ?? node.offsetHeight));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!armed) return;
    const timer = window.setTimeout(() => setArmed(false), 600);
    return () => window.clearTimeout(timer);
  }, [armed, prevKey]);
  return <motion.div className={cx(styles.autoHeight, className)} initial={false} animate={{ height }} transition={armed && !reduced ? motionTokens.spring.smooth : instant}>
    <div ref={inner}>{children}</div>
  </motion.div>;
}

/* ---------------------------------------------------------------------------------------------------------------
 * Filter control: one sliding highlight
 * ------------------------------------------------------------------------------------------------------------- */

export interface SegOption { value: string; label: string; count?: number }

export function Seg({ options, value, onChange, label, controls }: { options: SegOption[]; value: string; onChange: (value: string) => void; label: string; controls?: string }) {
  const reduced = useReducedMotion();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const index = Math.max(0, options.findIndex(option => option.value === value));
  function choose(next: number) {
    onChange(options[next].value);
    const node = refs.current[next];
    node?.focus({ preventScroll: true });
    node?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: reduced ? "auto" : "smooth" });
  }
  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const last = options.length - 1;
    const next = event.key === "ArrowRight" || event.key === "ArrowDown" ? (index === last ? 0 : index + 1)
      : event.key === "ArrowLeft" || event.key === "ArrowUp" ? (index === 0 ? last : index - 1)
        : event.key === "Home" ? 0 : event.key === "End" ? last : -1;
    if (next < 0) return;
    event.preventDefault();
    choose(next);
  }
  return <LayoutGroup id={label}>
    <div className={styles.seg} role="radiogroup" aria-label={label} aria-controls={controls}>
      {options.map((option, i) => {
        const on = i === index;
        return <button key={option.value} ref={node => { refs.current[i] = node; }} type="button" className={styles.segOption}
          role="radio" aria-checked={on} tabIndex={on ? 0 : -1} data-on={on || undefined} onClick={() => choose(i)} onKeyDown={onKeyDown}>
          {on && <motion.span layoutId="filter-highlight" className={styles.segHighlight} style={{ borderRadius: 999 }} transition={reduced ? instant : GLIDE} aria-hidden="true" />}
          <span className={styles.segLabel}>
            {option.label}
            {option.count !== undefined && <span className={styles.segCount}>{option.count}</span>}
          </span>
        </button>;
      })}
    </div>
  </LayoutGroup>;
}

/* ---------------------------------------------------------------------------------------------------------------
 * Run button: the label crossfades (Run, Stop, Run again) and the pill width follows the measured label, no bounce
 * ------------------------------------------------------------------------------------------------------------- */

const runLabels = [["run", "Run"], ["stop", "Stop"], ["again", "Run again"]] as const;
export type RunKey = typeof runLabels[number][0];

export function RunButton({ which, onClick, label }: { which: RunKey; onClick: () => void; label: string }) {
  const reduced = useReducedMotion();
  const nodes = useRef<Partial<Record<RunKey, HTMLSpanElement | null>>>({});
  const [widths, setWidths] = useState<Partial<Record<RunKey, number>>>({});
  const [shown, setShown] = useState(which);
  const [armed, setArmed] = useState(false);
  if (which !== shown) { setShown(which); setArmed(true); }
  useLayoutEffect(() => {
    if (typeof ResizeObserver === "undefined") return;
    const measure = () => setWidths(Object.fromEntries(runLabels.map(([key]) => [key, nodes.current[key]?.offsetWidth ?? 0])));
    const observer = new ResizeObserver(measure);
    runLabels.forEach(([key]) => { const node = nodes.current[key]; if (node) observer.observe(node); });
    return () => observer.disconnect();
  }, []);
  const width = widths[which];
  return <button type="button" className={styles.run} data-running={which === "stop" || undefined} onClick={onClick} aria-label={label}>
    <span className={styles.runIcon} aria-hidden="true">
      <Play data-on={which === "run" || undefined} />
      <Square data-on={which === "stop" || undefined} />
      <RotateCcw data-on={which === "again" || undefined} />
    </span>
    <motion.span className={styles.runLabel} aria-hidden="true" initial={false} animate={{ width: width || "auto" }} transition={armed && !reduced ? GLIDE : instant}>
      {runLabels.map(([key, text]) => <span key={key} ref={node => { nodes.current[key] = node; }} data-on={key === which || undefined}>{text}</span>)}
    </motion.span>
  </button>;
}

/* ---------------------------------------------------------------------------------------------------------------
 * Models
 * ------------------------------------------------------------------------------------------------------------- */

export function ModelMark({ model }: { model: EvalModel }) {
  if (model.mark) return <span className={styles.mark} aria-hidden="true">{model.mark}</span>;
  if (model.brand === "claude") return <ClaudeMark className={styles.mark} data-brand="claude" aria-hidden="true" title="" />;
  if (model.brand === "openai") return <OpenaiMark className={styles.mark} aria-hidden="true" title="" />;
  return null;
}

export function ModelChip({ model, version }: { model: EvalModel; version?: string }) {
  return <span className={styles.chip}>
    <ModelMark model={model} />
    <span className={styles.chipName}>{model.name}</span>
    {version && <span className={styles.chipVersion}>{version}</span>}
  </span>;
}

/* ---------------------------------------------------------------------------------------------------------------
 * Score bars and deltas
 * ------------------------------------------------------------------------------------------------------------- */

export type Direction = "up" | "down" | "flat";
export const directionOf = (delta: number): Direction => Math.abs(delta) < .05 ? "flat" : delta > 0 ? "up" : "down";

/** A thin bar: the fill is the new value, the ghost tick is the baseline. Both are fractions from 0 to 1. */
export function ScoreBar({ value, baseline, tone, className }: { value: number; baseline?: number; tone?: Direction; className?: string }) {
  return <span className={cx(styles.bar, className)} data-tone={tone} aria-hidden="true">
    <span className={styles.barFill} style={{ "--p": Math.max(0, Math.min(1, value)) } as CSSProperties} />
    {baseline !== undefined && <span className={styles.ghost} style={{ "--b": Math.max(0, Math.min(1, baseline)) } as CSSProperties} />}
  </span>;
}

/** A change in points with an arrow and a status color. `unit` adds " pts". */
export function Delta({ value, unit, className }: { value: number; unit?: boolean; className?: string }) {
  const direction = directionOf(value);
  const Icon = direction === "up" ? ArrowUp : direction === "down" ? ArrowDown : Minus;
  const text = formatDelta(value).replace(/^[+−]/, "");
  return <span className={cx(styles.delta, className)} data-dir={direction}>
    <Icon className={styles.deltaIcon} aria-hidden="true" />
    <span>{text}{unit ? " pts" : ""}</span>
  </span>;
}

export const deltaWords = (value: number) => {
  const direction = directionOf(value);
  const amount = formatDelta(value).replace(/^[+−]/, "");
  return direction === "flat" ? "no change" : `${direction} ${amount} points`;
};

/* ---------------------------------------------------------------------------------------------------------------
 * Run history sparkline
 * ------------------------------------------------------------------------------------------------------------- */

/**
 * The last runs as dots on a line. The baseline run is ringed, the current run lands as a colored dot with a short
 * drawn segment, and a dashed slot waits for it before the run. Hover or arrow keys read out any run.
 */
export function HistorySparkline({ runs, current, currentLabel, tone }: {
  runs: EvalRunRecord[]; current: number | null; currentLabel: string; tone: Direction;
}) {
  const reduced = useReducedMotion();
  const history = runs.slice(-7);
  const points = [...history.map(run => ({ label: run.label, score: run.score, date: run.date })), { label: currentLabel, score: current, date: undefined as string | undefined }];
  const known = points.map(point => point.score).filter((score): score is number => score !== null);
  const lo0 = Math.min(...known), hi0 = Math.max(...known);
  const pad = Math.max(2, (hi0 - lo0) * .18);
  let lo = lo0 - pad, hi = hi0 + pad;
  if (hi - lo < 8) { const mid = (hi + lo) / 2; lo = mid - 4; hi = mid + 4; }
  const n = points.length;
  const xAt = (i: number) => n > 1 ? (i / (n - 1)) * 100 : 50;
  const yAt = (score: number) => 100 - ((score - lo) / (hi - lo)) * 100;
  const pastLine = history.map((run, i) => `${i ? "L" : "M"}${xAt(i).toFixed(2)} ${yAt(run.score).toFixed(2)}`).join(" ");
  const last = history.length - 1;
  const tail = current !== null && last >= 0 ? `M${xAt(last).toFixed(2)} ${yAt(history[last].score).toFixed(2)} L${xAt(n - 1).toFixed(2)} ${yAt(current).toFixed(2)}` : null;

  const [active, setActive] = useState<number | null>(null);
  const plot = useRef<HTMLDivElement>(null);
  const focusIndex = active ?? (current !== null ? n - 1 : last);
  const shown = points[Math.max(0, focusIndex)];
  const readout = shown ? `${shown.label}${focusIndex === last && last < n - 1 ? " baseline" : ""} · ${shown.score === null ? "not run" : `${shown.score.toFixed(1)}%`}${shown.date ? ` · ${shown.date}` : ""}` : "";
  const indexAt = (clientX: number) => {
    const rect = plot.current?.getBoundingClientRect();
    if (!rect?.width) return null;
    return Math.max(0, Math.min(n - 1, Math.round(((clientX - rect.left) / rect.width) * (n - 1))));
  };
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const from = active ?? focusIndex;
    const next = ({ ArrowLeft: from - 1, ArrowDown: from - 1, ArrowRight: from + 1, ArrowUp: from + 1, Home: 0, End: n - 1 } as Record<string, number>)[event.key];
    if (event.key === "Escape") { setActive(null); return; }
    if (next === undefined) return;
    event.preventDefault();
    setActive(Math.max(0, Math.min(n - 1, next)));
  }

  return <div className={styles.spark}>
    <div className={styles.statLabel}>
      <span>Last {n} runs</span>
      <span className={styles.sparkReadout} aria-hidden="true">{readout}</span>
    </div>
    <div ref={plot} className={styles.sparkPlot} role="slider" tabIndex={0} aria-label="Run history"
      aria-valuemin={1} aria-valuemax={n} aria-valuenow={focusIndex + 1} aria-valuetext={readout}
      onPointerMove={(event: PointerEvent<HTMLDivElement>) => setActive(indexAt(event.clientX))}
      onPointerLeave={() => setActive(null)} onBlur={() => setActive(null)} onKeyDown={onKeyDown}>
      <svg className={styles.sparkSvg} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" focusable="false">
        <path className={styles.sparkLine} d={pastLine} vectorEffect="non-scaling-stroke" />
        {tail && <motion.path key={tail} className={styles.sparkTail} data-tone={tone} d={tail} vectorEffect="non-scaling-stroke"
          initial={reduced ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: motionTokens.duration.standard, ease: [...motionTokens.ease.standard] as [number, number, number, number] }} />}
      </svg>
      {current === null && <span className={styles.sparkSlot} style={{ left: `${xAt(n - 1)}%` }} aria-hidden="true" />}
      {points.map((point, i) => point.score === null ? null : <span key={point.label + i} aria-hidden="true"
        className={styles.sparkDot} data-kind={i === n - 1 ? "current" : i === last ? "baseline" : undefined} data-tone={i === n - 1 ? tone : undefined} data-active={active === i || undefined}
        style={{ left: `${xAt(i)}%`, top: `${yAt(point.score)}%` }} />)}
    </div>
    <div className={styles.sparkAxis} aria-hidden="true">
      <span>{points[0]?.label}</span>
      <span>{currentLabel}</span>
    </div>
  </div>;
}
