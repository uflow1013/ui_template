"use client";

/*
 * Small parts of the prompt studio: a crossfading label, a sliding segmented control, rolling digits, an auto height
 * frame, the version and model menus, the word diff and the output panel. Every move and resize is critically damped:
 * nothing here bounces.
 */

import { Fragment, useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "motion/react";
import { ArrowUpFromLine, Check, ChevronDown, CircleAlert, GitCompareArrows, Square } from "lucide-react";
import { motionTokens } from "@/shared/arc/lib/motion-tokens";
import { Avatar } from "@/shared/arc/avatar/avatar";
import { Button } from "@/shared/arc/button/button";
import { CopyButton } from "@/shared/arc/copy-button/copy-button";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/arc/popover/popover";
import { effortLabel, effortShort, efforts, formatPrice, relativeDate, tokenize, type DiffOp, type Effort, type ModelMarkId, type PromptModel, type PromptVersion } from "./prompt-studio-data";
import { ClaudeMark, GeminiColorMark, OpenaiMark } from "./prompt-studio-marks";
import type { ToneOf } from "./prompt-editor";
import styles from "./prompt-studio.module.css";

/* ---------------------------------------------------------------------------------------------------------------
 * Motion
 * ------------------------------------------------------------------------------------------------------------- */

/** Small fast moves: highlights, markers and widths. Critically damped. */
export const GLIDE = { type: "spring", visualDuration: .22, bounce: 0 } as const;
const ENTER = [...motionTokens.ease.enter] as [number, number, number, number];
const STANDARD = [...motionTokens.ease.standard] as [number, number, number, number];
const fadeIn = { duration: motionTokens.duration.fast, ease: ENTER };
const fadeOut = { duration: .1, ease: STANDARD };
const instant = { duration: 0 } as const;

/**
 * One minimal crossfade for a label or mark: the old one fades out fast while the new one fades in from 2px, and the box
 * width follows the measured incoming width without overshoot. No blur, no per-letter motion.
 */
export function Swap({ id, children, className }: { id: string; children: ReactNode; className?: string }) {
  const reduced = useReducedMotion();
  const measure = useRef<HTMLSpanElement>(null);
  const [width, setWidth] = useState<number | "auto">("auto");
  const [prevId, setPrevId] = useState(id);
  const [armed, setArmed] = useState(false);
  if (id !== prevId) { setPrevId(id); setArmed(true); }
  useLayoutEffect(() => {
    const node = measure.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(Math.ceil(entry.borderBoxSize?.[0]?.inlineSize ?? node.offsetWidth));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return <motion.span className={[styles.swap, className].filter(Boolean).join(" ")} initial={false} animate={{ width }} transition={armed && !reduced ? GLIDE : instant}>
    <span ref={measure} className={styles.swapMeasure} aria-hidden="true">{children}</span>
    <AnimatePresence initial={false}>
      <motion.span key={id} className={styles.swapItem} initial={reduced ? { opacity: 0 } : { opacity: 0, y: 2 }} animate={{ opacity: 1, y: 0, transition: reduced ? instant : fadeIn }} exit={{ opacity: 0, transition: reduced ? instant : fadeOut }}>{children}</motion.span>
    </AnimatePresence>
  </motion.span>;
}

/* ---------------------------------------------------------------------------------------------------------------
 * Segmented control and tabs with one sliding highlight
 * ------------------------------------------------------------------------------------------------------------- */

export interface SegOption { value: string; label: ReactNode; panel?: string; id?: string }

export function Seg({ options, value, onChange, label, kind, className }: {
  options: SegOption[]; value: string; onChange: (value: string) => void; label: string; kind: "tabs" | "segmented"; className?: string;
}) {
  const group = useId();
  const reduced = useReducedMotion();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const index = Math.max(0, options.findIndex(option => option.value === value));
  const tabs = kind === "tabs";
  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const last = options.length - 1;
    const next = event.key === "ArrowRight" || event.key === "ArrowDown" ? (index === last ? 0 : index + 1)
      : event.key === "ArrowLeft" || event.key === "ArrowUp" ? (index === 0 ? last : index - 1)
        : event.key === "Home" ? 0 : event.key === "End" ? last : -1;
    if (next < 0) return;
    event.preventDefault();
    onChange(options[next].value);
    refs.current[next]?.focus();
  }
  return <LayoutGroup id={group}>
    <div className={[tabs ? styles.tabs : styles.seg, className].filter(Boolean).join(" ")} role={tabs ? "tablist" : "radiogroup"} aria-label={label}>
      {options.map((option, i) => {
        const on = i === index;
        return <button key={option.value} ref={node => { refs.current[i] = node; }} id={option.id} type="button" className={tabs ? styles.tab : styles.segOption}
          role={tabs ? "tab" : "radio"} aria-selected={tabs ? on : undefined} aria-checked={tabs ? undefined : on} aria-controls={option.panel}
          tabIndex={on ? 0 : -1} data-on={on || undefined} onClick={() => onChange(option.value)} onKeyDown={onKeyDown}>
          {on && <motion.span layoutId="highlight" className={tabs ? styles.tabHighlight : styles.segHighlight} style={{ borderRadius: 999 }} transition={reduced ? instant : GLIDE} aria-hidden="true" />}
          <span className={styles.segLabel}>{option.label}</span>
        </button>;
      })}
    </div>
  </LayoutGroup>;
}

/* ---------------------------------------------------------------------------------------------------------------
 * Rolling digits and auto height
 * ------------------------------------------------------------------------------------------------------------- */

const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

/** Digits roll on their own wheels with tabular numerals. Columns are keyed by place, so 999 to 1,000 keeps the ones column. */
export function RollingNumber({ value }: { value: number }) {
  const text = value.toLocaleString("en-US");
  const chars = [...text];
  return <span className={styles.roll}>
    <span className={styles.srOnly}>{text}</span>
    <span className={styles.rollDigits} aria-hidden="true">
      {chars.map((char, i) => {
        const place = chars.length - 1 - i;
        return /\d/.test(char)
          ? <span key={`d${place}`} className={styles.rollCol}><span className={styles.rollStrip} style={{ "--d": char } as CSSProperties}>{DIGITS.map(d => <span key={d}>{d}</span>)}</span></span>
          : <span key={`s${place}`} className={styles.rollSep}>{char}</span>;
      })}
    </span>
  </span>;
}

/**
 * Follows its content's height on the smooth spring. The first measure lands at once; after `armKey` changes once, every
 * later change animates. `sticky={false}` disarms again shortly after, so ordinary typing never waits on a spring.
 */
export function AutoHeight({ children, armKey, sticky = true, className }: { children: ReactNode; armKey: string | number; sticky?: boolean; className?: string }) {
  const reduced = useReducedMotion();
  const inner = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | "auto">("auto");
  const [prevKey, setPrevKey] = useState(armKey);
  const [armed, setArmed] = useState(false);
  if (armKey !== prevKey) { setPrevKey(armKey); setArmed(true); }
  useLayoutEffect(() => {
    const node = inner.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setHeight(Math.ceil(entry.borderBoxSize?.[0]?.blockSize ?? node.offsetHeight));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!armed || sticky) return;
    const timer = window.setTimeout(() => setArmed(false), 700);
    return () => window.clearTimeout(timer);
  }, [armed, sticky, prevKey]);
  return <motion.div className={[styles.autoHeight, className].filter(Boolean).join(" ")} initial={false} animate={{ height }} transition={armed && !reduced ? motionTokens.spring.smooth : instant}>
    <div ref={inner}>{children}</div>
  </motion.div>;
}

/* ---------------------------------------------------------------------------------------------------------------
 * Marks
 * ------------------------------------------------------------------------------------------------------------- */

export function ModelMark({ mark, className }: { mark: ModelMarkId; className?: string }) {
  const props = { className: [styles.mark, className].filter(Boolean).join(" "), "aria-hidden": true as const, title: "" };
  if (mark === "openai") return <OpenaiMark {...props} />;
  if (mark === "gemini") return <GeminiColorMark {...props} />;
  return <ClaudeMark {...props} data-brand="claude" />;
}

/* ---------------------------------------------------------------------------------------------------------------
 * Version menu
 * ------------------------------------------------------------------------------------------------------------- */

export interface Promotion { from: string | null; to: string }

export function VersionMenu({ versions, openId, productionId, now, promotion, onCompare, onPromote, onUndo }: {
  versions: PromptVersion[];
  openId: string;
  productionId: string | null;
  now: number;
  promotion: Promotion | null;
  onCompare: (versionId: string) => void;
  onPromote: (versionId: string) => void;
  onUndo: () => void;
}) {
  const reduced = useReducedMotion();
  const group = useId();
  const [open, setOpen] = useState(false);
  const openIndex = Math.max(0, versions.findIndex(v => v.id === openId));
  const [target, setTarget] = useState(() => versions[openIndex + 1]?.id ?? versions[0]?.id ?? "");
  const rows = useRef<(HTMLButtonElement | null)[]>([]);
  const current = versions[openIndex];
  const chosen = versions.find(v => v.id === target) ?? current;
  const live = productionId === current?.id;
  const production = versions.find(v => v.id === productionId);

  function onRowKey(event: KeyboardEvent<HTMLButtonElement>, i: number) {
    const last = versions.length - 1;
    const next = event.key === "ArrowDown" ? (i === last ? 0 : i + 1) : event.key === "ArrowUp" ? (i === 0 ? last : i - 1) : event.key === "Home" ? 0 : event.key === "End" ? last : -1;
    if (next < 0) return;
    event.preventDefault();
    setTarget(versions[next].id);
    rows.current[next]?.focus();
  }

  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger className={styles.chip} aria-label={`Version ${current?.label}${live ? ", in production" : ""}. Open versions`}>
      <span className={styles.chipVersion}>{current?.label}</span>
      <Swap id={live ? "live" : "latest"} className={styles.chipState}>
        {live ? <><span className={styles.liveDot} aria-hidden="true" />Production</> : <>Latest</>}
      </Swap>
      <ChevronDown className={styles.chevron} aria-hidden="true" />
    </PopoverTrigger>
    <PopoverContent className={`${styles.menu} ${styles.versionMenu}`} align="start" aria-label="Versions">
      <LayoutGroup id={group}>
        <div className={styles.versionList} role="radiogroup" aria-label="Pick a version to compare or promote">
          {versions.map((version, i) => {
            const on = version.id === chosen?.id;
            return <button key={version.id} ref={node => { rows.current[i] = node; }} type="button" role="radio" aria-checked={on} tabIndex={on ? 0 : -1}
              className={styles.versionRow} data-on={on || undefined} onClick={() => setTarget(version.id)} onKeyDown={event => onRowKey(event, i)}>
              <Avatar name={version.author.name} src={version.author.avatar} size="sm" className={styles.versionAvatar} />
              <span className={styles.versionText}>
                <span className={styles.versionMessage}>{version.message}</span>
                <span className={styles.versionMeta}>
                  <span className={styles.versionMetaText}><span className={styles.versionLabel}>{version.label}</span> · {version.author.name} · {relativeDate(version.createdAt, now)}</span>
                  <span className={styles.versionSlot}>
                    {version.id === productionId && <motion.span layoutId="production" className={styles.prodMarker} transition={reduced ? instant : motionTokens.spring.smooth}>
                      <span className={styles.liveDot} aria-hidden="true" />Production
                    </motion.span>}
                  </span>
                </span>
              </span>
            </button>;
          })}
        </div>
      </LayoutGroup>
      <div className={styles.menuActions}>
        <button type="button" className={styles.menuAction} disabled={!chosen || chosen.id === openId} onClick={() => { setOpen(false); onCompare(chosen.id); }}>
          <GitCompareArrows aria-hidden="true" />Compare with {chosen?.label}
        </button>
        <button type="button" className={styles.menuAction} disabled={!chosen || chosen.id === productionId} onClick={() => onPromote(chosen.id)}>
          <ArrowUpFromLine aria-hidden="true" />Promote to production
        </button>
      </div>
      <div className={styles.menuStatus} role="status">
        <Swap id={promotion ? `p-${promotion.to}` : `s-${productionId}`} className={styles.menuStatusText}>
          {promotion
            ? <>{versions.find(v => v.id === promotion.to)?.label} is in production</>
            : <>Production serves {production?.label ?? "no version"}</>}
        </Swap>
        <AnimatePresence initial={false}>
          {promotion && <motion.span key="undo" className={styles.menuUndo} initial={{ opacity: 0 }} animate={{ opacity: 1, transition: reduced ? instant : fadeIn }} exit={{ opacity: 0, transition: reduced ? instant : fadeOut }}>
            <Button variant="ghost" size="sm" onClick={onUndo}>Undo</Button>
          </motion.span>}
        </AnimatePresence>
      </div>
    </PopoverContent>
  </Popover>;
}

/* ---------------------------------------------------------------------------------------------------------------
 * Model and effort menu
 * ------------------------------------------------------------------------------------------------------------- */

export function ModelMenu({ models, modelId, effort, onModel, onEffort }: {
  models: PromptModel[]; modelId: string; effort: Effort; onModel: (id: string) => void; onEffort: (effort: Effort) => void;
}) {
  const rows = useRef<(HTMLButtonElement | null)[]>([]);
  const effortId = useId();
  const model = models.find(m => m.id === modelId) ?? models[0];
  const index = Math.max(0, models.findIndex(m => m.id === model.id));
  const anySample = models.some(m => m.sample);
  function onRowKey(event: KeyboardEvent<HTMLButtonElement>, i: number) {
    const last = models.length - 1;
    const next = event.key === "ArrowDown" ? (i === last ? 0 : i + 1) : event.key === "ArrowUp" ? (i === 0 ? last : i - 1) : event.key === "Home" ? 0 : event.key === "End" ? last : -1;
    if (next < 0) return;
    event.preventDefault();
    onModel(models[next].id);
    rows.current[next]?.focus();
  }
  return <Popover>
    <PopoverTrigger className={`${styles.chip} ${styles.modelChip}`} aria-label={`Model ${model.name}, ${effortLabel[effort]} effort. Change model`}>
      <Swap id={model.id} className={styles.modelSwap}>
        <ModelMark mark={model.mark} />
        <span className={styles.modelName}>{model.short}</span>
      </Swap>
      <Swap id={effort} className={styles.chipState}>{effortShort[effort]}</Swap>
      <ChevronDown className={styles.chevron} aria-hidden="true" />
    </PopoverTrigger>
    <PopoverContent className={`${styles.menu} ${styles.modelMenu}`} align="end" aria-label="Model and effort">
      <div className={styles.modelList} role="radiogroup" aria-label="Model">
        {models.map((item, i) => {
          const on = i === index;
          return <button key={item.id} ref={node => { rows.current[i] = node; }} type="button" role="radio" aria-checked={on} tabIndex={on ? 0 : -1}
            className={styles.modelRow} data-on={on || undefined} onClick={() => onModel(item.id)} onKeyDown={event => onRowKey(event, i)}>
            <ModelMark mark={item.mark} />
            <span className={styles.modelRowName}>{item.name}</span>
            <span className={styles.modelPrice} aria-label={`${formatPrice(item.input)} input, ${formatPrice(item.output)} output per million tokens${item.sample ? ", sample price" : ""}`}>
              {formatPrice(item.input)} · {formatPrice(item.output)}
            </span>
            <Check className={styles.modelCheck} data-on={on || undefined} aria-hidden="true" />
          </button>;
        })}
      </div>
      <div className={styles.effortRow}>
        <span id={effortId} className={styles.effortLabel}>Effort</span>
        <Seg kind="segmented" label="Effort" value={effort} onChange={value => onEffort(value as Effort)} className={styles.effortSeg}
          options={efforts.map(level => ({ value: level, label: effortShort[level] }))} />
      </div>
      <p className={styles.menuNote}>Input · output per 1M tokens.{anySample ? " GPT and Gemini prices are samples." : ""}</p>
    </PopoverContent>
  </Popover>;
}

/* ---------------------------------------------------------------------------------------------------------------
 * Word diff
 * ------------------------------------------------------------------------------------------------------------- */

function withChips(text: string, toneOf: ToneOf, keyBase: string) {
  return tokenize(text).map((part, i) => part.type === "text"
    ? <Fragment key={`${keyBase}-${i}`}>{part.text}</Fragment>
    : <span key={`${keyBase}-${i}`} className={styles.varChip} data-tone={toneOf(part.name)} data-static="">{part.name}</span>);
}

/** Changes read as marks, not color alone: a + or minus sign leads each change, removals are struck through. Leading and
 *  trailing whitespace stays outside the mark, so a new line never starts with a stray sign. */
export function DiffView({ ops, toneOf }: { ops: DiffOp[]; toneOf: ToneOf }) {
  return <div className={styles.diffText}>
    {ops.map((op, i) => {
      if (op.type === "same") return <Fragment key={i}>{withChips(op.text, toneOf, `s${i}`)}</Fragment>;
      const [, lead, core, trail] = /^(\s*)([\s\S]*?)(\s*)$/.exec(op.text) ?? ["", "", op.text, ""];
      if (!core) return op.type === "add" ? <Fragment key={i}>{op.text}</Fragment> : null;
      const Tag = op.type === "add" ? "ins" : "del";
      // The sign stays on the same line as the first word of the change.
      const [, first, rest] = /^(\S+)([\s\S]*)$/.exec(core) ?? ["", core, ""];
      return <Fragment key={i}>
        {lead}
        <Tag className={op.type === "add" ? styles.added : styles.removed}>
          <span className={styles.srOnly}>{op.type === "add" ? "Added: " : "Removed: "}</span>
          <span className={styles.diffLead}><span className={styles.diffSign} aria-hidden="true">{op.type === "add" ? "+" : "−"}</span>{withChips(first, toneOf, `f${i}`)}</span>
          {withChips(rest, toneOf, `r${i}`)}
        </Tag>
        {op.type === "add" ? trail : null}
      </Fragment>;
    })}
  </div>;
}

/* ---------------------------------------------------------------------------------------------------------------
 * Output
 * ------------------------------------------------------------------------------------------------------------- */

export type RunStatus = "thinking" | "streaming" | "done" | "stopped" | "error";

export interface RunView {
  id: number;
  status: RunStatus;
  chunks: string[];
  caseLabel: string;
  model: PromptModel;
  effort: Effort;
  simulated: boolean;
  error?: string;
  stats?: { ms: number; input: number; output: number; cost: string; seconds: string };
}

/** Paragraphs from chunks. A chunk that crosses a blank line opens the next paragraph; chunk keys never change. */
function paragraphs(chunks: string[]) {
  const out: { key: string; text: string }[][] = [[]];
  chunks.forEach((chunk, i) => {
    chunk.split(/\n{2,}/).forEach((part, j) => {
      if (j > 0) out.push([]);
      if (part) out[out.length - 1].push({ key: `${i}-${j}`, text: part });
    });
  });
  return out.map((items, i) => ({ key: i, items })).filter(p => p.items.length);
}

function StatusLabel({ run }: { run: RunView }) {
  const label = run.status === "thinking" ? "Thinking" : run.status === "streaming" ? "Writing" : run.status === "done" ? "Reply" : run.status === "stopped" ? "Stopped" : "Run failed";
  const icon = run.status === "done" ? <Check aria-hidden="true" /> : run.status === "stopped" ? <Square aria-hidden="true" /> : run.status === "error" ? <CircleAlert aria-hidden="true" /> : null;
  const working = run.status === "thinking" || run.status === "streaming";
  return <Swap id={run.status} className={styles.outputStatus}>
    <span className={styles.outputStatusInner} data-status={run.status}>
      {icon}
      <span className={working ? styles.shimmer : undefined}>{label}</span>
      <span className={styles.outputCase}>{run.caseLabel}</span>
    </span>
  </Swap>;
}

export function OutputPanel({ run, idleHint, onRetry, lockHeight, bodyRef }: {
  run: RunView | null; idleHint: ReactNode; onRetry: () => void; lockHeight: number | null; bodyRef: React.RefObject<HTMLDivElement | null>;
}) {
  const reduced = useReducedMotion();
  const text = run ? run.chunks.join("") : "";
  const footer = !run ? null
    : run.status === "error" ? `${run.simulated ? "Simulated error" : "Error"} · ${run.model.name}`
      : run.stats ? [run.simulated ? "Simulated" : null, run.stats.seconds, `${run.stats.input + run.stats.output} tokens`, run.stats.cost].filter(Boolean).join(" · ")
        : `${run.simulated ? "Simulated · " : ""}${run.model.name} · ${effortLabel[run.effort]} effort`;
  return <AutoHeight armKey={run ? "run" : "idle"} className={styles.outputFrame}>
    <div className={styles.output} data-state={run?.status ?? "idle"}>
      {run ? <>
        <div className={styles.outputHead}>
          <StatusLabel run={run} />
          <span className={styles.outputCopy} data-on={(run.status === "done" || run.status === "stopped") && text ? "" : undefined}>
            <CopyButton value={text.trim()} label="Copy reply" iconOnly variant="plain" disabled={!(run.status === "done" || run.status === "stopped") || !text} />
          </span>
        </div>
        <div ref={bodyRef} className={styles.outputBody} style={lockHeight ? { minHeight: lockHeight } : undefined}>
          <AnimatePresence initial={false}>
            <motion.div key={run.id} className={styles.outputRun} initial={{ opacity: 0 }} animate={{ opacity: 1, transition: reduced ? instant : fadeIn }} exit={{ opacity: 0, transition: reduced ? instant : fadeOut }}>
              {run.status === "error"
                ? <div className={styles.errorBox} role="alert">
                    <p className={styles.errorText}>{run.error}</p>
                    <Button variant="secondary" size="sm" onClick={onRetry}>Retry</Button>
                  </div>
                : <div className={styles.reply} aria-busy={run.status === "thinking" || run.status === "streaming" || undefined}>
                    {paragraphs(run.chunks).map(p => <p key={p.key} className={styles.replyParagraph}>
                      {p.items.map(item => <span key={item.key} className={reduced ? undefined : styles.chunk}>{item.text}</span>)}
                    </p>)}
                  </div>}
            </motion.div>
          </AnimatePresence>
        </div>
        <div className={styles.outputFoot}>
          <Swap id={footer ?? ""} className={styles.outputFootText}>{footer}</Swap>
        </div>
      </> : <div className={styles.outputIdle}>{idleHint}</div>}
    </div>
  </AutoHeight>;
}
