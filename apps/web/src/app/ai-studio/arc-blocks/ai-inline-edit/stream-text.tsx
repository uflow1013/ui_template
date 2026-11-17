"use client";

/*
 * Streaming text for the AI blocks (research run, AI inline edit, voice agent). The same file ships in each block's folder so
 * every block stays self contained; keep the copies identical.
 *
 * Arrival and display are decoupled. Incoming text is buffered and drained on a requestAnimationFrame loop at a rate that
 * tracks the measured arrival rate: a backlog speeds the reveal up, a thin buffer slows it down so a stall is bridged instead
 * of sitting and then dumping. Reveal boundaries snap to whole words. Each commit becomes its own chunk span that fades in
 * once and is never rendered again, so earlier lines never re-split, replay or reflow. Markdown renders already formatted:
 * a list, heading, code line or citation appears only once it can render correctly.
 */

import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion, animate, useMotionValue } from "motion/react";
import { CircleAlert, Copy } from "lucide-react";
import { motionTokens } from "@/shared/arc/lib/motion-tokens";
import styles from "./stream-text.module.css";
import { writeClipboard } from "@/shared/arc/lib/use-copy-feedback";

/** Eases the copy label's width to `target` on a spring with no overshoot. The first measurement lands at once, so the control
 *  starts at its current word's width instead of the widest one. */
function useFitWidth(target: number | undefined, reduced: boolean | null | undefined) {
  const width = useMotionValue<number | "auto">("auto");
  const placed = useRef(false);
  useLayoutEffect(() => {
    if (!target) return;
    if (!placed.current || reduced) { placed.current = true; width.jump(target); return; }
    const controls = animate(width, target, { type: "spring", visualDuration: .22, bounce: 0 });
    return () => controls.stop();
  }, [target, reduced, width]);
  return width;
}

const noop = () => () => {};
/** Reduced motion, false until hydrated so server and client agree. */
export function useReducedStream() {
  const prefers = useReducedMotion();
  const hydrated = useSyncExternalStore(noop, () => true, () => false);
  return Boolean(hydrated && prefers);
}

/* ---------------------------------------------------------------------------------------------------------------
 * Pacing
 * ------------------------------------------------------------------------------------------------------------- */

/** Seconds of text held in reserve while streaming, so a late chunk never leaves the reader waiting. */
const RESERVE = .5;
/** Once the stream ends, the rest is shown within about this long, in seconds. */
const DRAIN = .4;

function wordCut(text: string, n: number, streaming: boolean) {
  if (n >= text.length && !streaming) return text.length;
  let i = Math.min(Math.floor(n), text.length);
  if (i < text.length && /\s/.test(text[i])) return i;
  while (i > 0 && !/\s/.test(text[i - 1])) i--;
  return i;
}

export interface StreamBufferOptions {
  /** More text is expected. While true, reveal stops at the last complete word. */
  streaming: boolean;
  /** Pace in characters per second before the arrival rate is known, and the floor for the final drain. Defaults to 70. */
  pace?: number;
  /** Turn off to show text exactly as it arrives. */
  enabled?: boolean;
}

/**
 * Buffers streamed text and returns the part to show now. Pass the full text received so far. The drain rate follows the
 * arrival rate measured over the last second and a half, scaled by how full the buffer is: a burst is absorbed over a few
 * hundred milliseconds, a thin buffer slows to a third of the pace to bridge a stall, and the end drains quickly.
 */
export function useStreamBuffer(target: string, { streaming, pace = 70, enabled = true }: StreamBufferOptions) {
  const [shown, setShown] = useState(() => streaming ? 0 : target.length);
  const [previous, setPrevious] = useState(target);
  let count = shown;
  if (previous !== target) {
    setPrevious(target);
    if (!target.startsWith(previous)) { count = 0; setShown(0); }
  }
  const cursor = useRef(count);
  const last = useRef(target);
  const samples = useRef<[number, number][]>([]);
  const velocity = useRef(0);

  useEffect(() => {
    const now = performance.now();
    if (!target.startsWith(last.current)) { cursor.current = 0; samples.current = []; }
    last.current = target;
    const list = samples.current;
    list.push([now, target.length]);
    while (list.length > 2 && now - list[1][0] > 1500) list.shift();
    if (!enabled) { cursor.current = target.length; return; }
    let frame = 0, then = now, committed = -1, speed = velocity.current;
    const rate = () => {
      const first = list[0], lastSample = list[list.length - 1], span = (lastSample[0] - first[0]) / 1000;
      return list.length > 1 && span > .2 ? Math.max(12, (lastSample[1] - first[1]) / span) : pace;
    };
    const tick = (at: number) => {
      const dt = Math.min(.05, Math.max(0, (at - then) / 1000));
      then = at;
      const backlog = target.length - cursor.current;
      if (backlog > 0) {
        const arrival = rate();
        const goal = streaming
          ? arrival * Math.min(2.5, Math.max(.45, backlog / Math.max(1, arrival * RESERVE)))
          : Math.max(pace * 1.5, backlog / DRAIN);
        // The speed eases toward its goal, so a burst or a stall bends the pace instead of kinking it.
        speed = speed ? speed + (goal - speed) * Math.min(1, dt * (streaming ? 5 : 12)) : goal;
        velocity.current = speed;
        cursor.current = Math.min(target.length, cursor.current + speed * dt);
      }
      const cut = wordCut(target, cursor.current, streaming);
      if (cut !== committed) { committed = cut; setShown(cut); }
      if (cursor.current < target.length) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, streaming, enabled, pace]);

  const text = enabled ? target.slice(0, Math.min(count, target.length)) : target;
  return { text, revealing: text.length < target.length };
}

/* ---------------------------------------------------------------------------------------------------------------
 * Markdown: paragraphs, ### headings, - and 1. lists, **bold**, `code`, fenced code and [n] citations. Units keep their
 * index as text arrives. Each unit knows its sentence, so a citation can light up the claim it supports.
 * ------------------------------------------------------------------------------------------------------------- */

type UnitData =
  | { kind: "text"; text: string; bold: boolean }
  | { kind: "code"; text: string }
  | { kind: "cite"; n: number }
  | { kind: "line"; text: string };
export type StreamUnit = UnitData & { index: number; space: boolean; sentence: number };
type Block =
  | { kind: "p" | "h"; units: StreamUnit[] }
  | { kind: "ul" | "ol"; items: StreamUnit[][] }
  | { kind: "code"; lang: string; units: StreamUnit[]; source: string };

function inline(src: string, counter: { n: number }): StreamUnit[] {
  const units: StreamUnit[] = [];
  let bold = false, buf = "", space = false, i = 0, sentence = counter.n, closing = false;
  const push = (unit: UnitData) => {
    if (closing && unit.kind !== "cite") { sentence = counter.n; closing = false; }
    units.push({ ...unit, space: space && units.length > 0, index: counter.n++, sentence });
    space = false;
    if (unit.kind === "text" && /[.!?]["”)]?$/.test(unit.text)) closing = true;
  };
  const flush = () => {
    for (const token of buf.split(/(\s+)/)) {
      if (!token) continue;
      if (/^\s+$/.test(token)) space = true; else push({ kind: "text", text: token, bold });
    }
    buf = "";
  };
  while (i < src.length) {
    if (src.startsWith("**", i)) { flush(); bold = !bold; i += 2; continue; }
    if (src[i] === "`") {
      flush();
      const close = src.indexOf("`", i + 1);
      if (close === -1) break; // held until the closing tick arrives
      if (close > i + 1) push({ kind: "code", text: src.slice(i + 1, close) });
      i = close + 1;
      continue;
    }
    if (src[i] === "[") {
      const cite = /^\[(\d{1,2})\]/.exec(src.slice(i, i + 4));
      if (cite) { flush(); push({ kind: "cite", n: Number(cite[1]) }); i += cite[0].length; continue; }
      if (/^\[\d{0,2}$/.test(src.slice(i))) break; // a citation still arriving
    }
    buf += src[i++];
  }
  flush();
  return units;
}

/** A last line that is only a list, heading or fence marker waits for its first word. */
const pendingMarker = /^\s*(#{1,6}|[-*+]|\d+[.)]?|`{1,3}\w*)\s*$/;

function parse(source: string, live: boolean) {
  let text = source;
  if (live) {
    const lastBreak = text.lastIndexOf("\n");
    if (pendingMarker.test(text.slice(lastBreak + 1))) text = text.slice(0, lastBreak + 1);
  }
  const counter = { n: 0 };
  const blocks: Block[] = [];
  const lines = text.split("\n");
  let list: Extract<Block, { kind: "ul" | "ol" }> | null = null;
  let para: string[] = [];
  const flushPara = () => { if (para.length) blocks.push({ kind: "p", units: inline(para.join(" "), counter) }); para = []; };
  for (let l = 0; l < lines.length; l++) {
    const line = lines[l].trim();
    const fence = /^```(\w*)/.exec(line);
    if (fence) {
      flushPara(); list = null;
      const body: string[] = [];
      l++;
      while (l < lines.length && !/^\s*```/.test(lines[l])) body.push(lines[l++]);
      // While streaming, the line being written waits for its newline.
      const closed = l < lines.length;
      const complete = closed || !live ? body : body.slice(0, -1);
      blocks.push({ kind: "code", lang: fence[1], source: body.join("\n"), units: complete.map(row => ({ kind: "line", text: row, index: counter.n++, space: false, sentence: -1 })) });
      continue;
    }
    if (!line) { flushPara(); list = null; continue; }
    const bullet = /^[-*+]\s+(.*)$/.exec(line), numbered = /^\d+[.)]\s+(.*)$/.exec(line), heading = /^#{1,6}\s+(.*)$/.exec(line);
    if (bullet || numbered) {
      flushPara();
      const kind = bullet ? "ul" : "ol";
      if (!list || list.kind !== kind) { list = { kind, items: [] }; blocks.push(list); }
      list.items.push(inline((bullet ?? numbered)![1], counter));
      continue;
    }
    list = null;
    if (heading) { flushPara(); blocks.push({ kind: "h", units: inline(heading[1], counter) }); continue; }
    para.push(line);
  }
  flushPara();
  return { blocks, count: counter.n };
}

/** Plain text for copying: markdown syntax removed, bullets kept, citations kept as [n] unless `cites` is false. */
export function streamPlainText(markdown: string, { cites = true } = {}) {
  let text = markdown.replace(/^\s*```.*$/gm, "").replace(/^#{1,6}\s+/gm, "").replace(/^\s*[-*+]\s+/gm, "• ").replace(/\*\*/g, "").replace(/`/g, "");
  if (!cites) text = text.replace(/\s?\[\d{1,2}\]/g, "");
  return text.replace(/\n{3,}/g, "\n\n").trim();
}

/* ---------------------------------------------------------------------------------------------------------------
 * Rendering
 * ------------------------------------------------------------------------------------------------------------- */

type CiteRenderer = (n: number, sentence: number) => ReactNode;

function unitNode(unit: StreamUnit, cite: CiteRenderer | undefined) {
  if (unit.kind === "cite") return <span key={unit.index} className={styles.cite}>{cite ? cite(unit.n, unit.sentence) : <sup>{unit.n}</sup>}</span>;
  if (unit.kind === "line") return <span key={unit.index} className={styles.codeLine}>{unit.text || " "}</span>;
  const body = unit.kind === "code" ? <code className={styles.inlineCode}>{unit.text}</code> : unit.bold ? <strong className={styles.strong}>{unit.text}</strong> : unit.text;
  // The leading space rides inside the unit, so a highlighted sentence reads as one continuous mark.
  return <span key={unit.index} data-s={unit.sentence}>{unit.space ? " " : null}{body}</span>;
}

/** One commit's worth of units. It fades in once and never renders again. */
const Chunk = memo(function Chunk({ units, enter, cite }: { units: StreamUnit[]; enter: boolean; cite: React.RefObject<CiteRenderer | undefined> }) {
  const lead = units[0]?.space && units[0].kind === "cite" ? " " : null;
  return <span className={enter ? styles.enter : undefined}>{lead}{units.map(unit => unitNode(unit, cite.current))}</span>;
}, (a, b) => a.enter === b.enter && a.units.length === b.units.length && a.units[0]?.index === b.units[0]?.index);

function Waiting() {
  return <motion.span className={styles.waiting} aria-hidden="true" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: motionTokens.duration.standard }}><span /></motion.span>;
}

type CopyState = "idle" | "copied" | "failed";
export function useCopy() {
  const [state, setState] = useState<CopyState>("idle");
  const timer = useRef(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const copy = useCallback(async (value: string) => {
    window.clearTimeout(timer.current);
    try { await writeClipboard(value); setState("copied"); } catch { setState("failed"); }
    timer.current = window.setTimeout(() => setState("idle"), 1800);
  }, []);
  return { state, copy };
}

const copyEase = [...motionTokens.ease.standard] as [number, number, number, number];
const copyShow = { duration: .16, ease: copyEase } as const;
const copyHide = { duration: .1, ease: copyEase } as const;
const copyKeys = ["idle", "copied", "failed"] as const;

/** The success tick draws itself in one short stroke. */
function CopyCheck({ reduced }: { reduced: boolean }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
    <motion.path d="M4 12l5 5L20 6" initial={reduced ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: .22, ease: copyEase, delay: .04 }} />
  </svg>;
}

/** Copy icon and label crossfade in place (no blur, no bounce). The label cell eases to the current word's measured width with
 *  no overshoot, so a short word never sits in the space of a longer one and nothing jumps. */
export function CopyLabel({ state, idle = "Copy", done = "Copied" }: { state: CopyState; idle?: string; done?: string }) {
  const reduced = useReducedMotion() ?? false;
  const words: Record<CopyState, string> = { idle, copied: done, failed: "Try again" };
  const measures = useRef<Partial<Record<CopyState, HTMLSpanElement | null>>>({});
  const [widths, setWidths] = useState<Partial<Record<CopyState, number>>>({});
  useLayoutEffect(() => {
    const read = () => setWidths(Object.fromEntries(copyKeys.map(key => [key, measures.current[key]?.offsetWidth ?? 0])));
    read();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(read);
    copyKeys.forEach(key => { const node = measures.current[key]; if (node) observer.observe(node); });
    return () => observer.disconnect();
  }, [idle, done]);
  const width = widths[state];
  const fitWidth = useFitWidth(width, reduced);
  return <>
    <span className={styles.iconSlot} aria-hidden="true">
      <AnimatePresence initial={false}>
        <motion.span key={state} data-state={state} initial={reduced ? { opacity: 0 } : { opacity: 0, scale: .85 }} animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, transition: reduced ? { duration: 0 } : copyHide }} transition={reduced ? { duration: 0 } : copyShow}>
          {state === "copied" ? <CopyCheck reduced={reduced} /> : state === "failed" ? <CircleAlert /> : <Copy />}
        </motion.span>
      </AnimatePresence>
    </span>
    <motion.span className={styles.swap} aria-hidden="true" style={{ width: fitWidth }}>
      {copyKeys.map(key => <span key={key} ref={node => { measures.current[key] = node; }} className={styles.swapMeasure}>{words[key]}</span>)}
      <AnimatePresence initial={false}>
        <motion.span key={state} className={styles.swapText} initial={reduced ? { opacity: 0 } : { opacity: 0, y: 2 }} animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, transition: reduced ? { duration: 0 } : copyHide }} transition={reduced ? { duration: 0 } : copyShow}>{words[state]}</motion.span>
      </AnimatePresence>
    </motion.span>
  </>;
}

function CodeBlock({ lang, source, children }: { lang: string; source: string; children: ReactNode }) {
  const { state, copy } = useCopy();
  return <div className={styles.codeBlock}>
    <div className={styles.codeHeader}>
      <span>{lang || "Code"}</span>
      <button type="button" className={styles.codeCopy} onClick={() => copy(source)} aria-label={state === "copied" ? "Code copied" : "Copy code"}><CopyLabel state={state} /></button>
    </div>
    <pre className={styles.pre}><code>{children}</code></pre>
  </div>;
}

/** A quiet status line with a finite feeling shimmer, for the moment before the first word. */
export function StreamStatus({ children, reduced }: { children: ReactNode; reduced?: boolean }) {
  return <span className={reduced ? styles.statusStatic : styles.shimmer}>{children}</span>;
}

export interface StreamTextProps {
  /** Everything received so far. */
  text: string;
  /** More text is expected. */
  streaming: boolean;
  /** Renders the markdown subset. Off renders plain text with line breaks. Defaults to true. */
  markdown?: boolean;
  /** Buffers and paces the reveal. Turn off when text is already paced upstream, such as words in sync with speech. */
  smooth?: boolean;
  /** Pace before the arrival rate is known, in characters per second. */
  pace?: number;
  /** Shown in place of the first line until the first word lands, such as "Thinking". */
  placeholder?: ReactNode;
  /** Renders a [n] citation. Called once per citation when it lands; use data attributes or CSS for hover state. */
  renderCite?: CiteRenderer;
  /** Called with the text on screen after every commit, for stopping on exactly what the reader has seen. */
  onShown?: (text: string) => void;
  /** Called once when the stream has ended and every word is on screen. */
  onRevealed?: () => void;
  className?: string;
}

/**
 * Streams text in place. Earlier chunks never re-render, so long answers stay cheap and stable, and new chunks fade in with
 * a breath of blur. While the buffer is empty mid stream, a quiet dot appears at the end; it leaves with the last word.
 */
export function StreamText({ text: incoming, streaming, markdown = true, smooth = true, pace, placeholder, renderCite, onShown, onRevealed, className }: StreamTextProps) {
  const reduced = useReducedStream();
  const { text, revealing } = useStreamBuffer(incoming, { streaming, pace, enabled: smooth });
  const live = streaming || revealing;
  const { blocks, count } = markdown ? parse(text, live) : plain(text);
  const cite = useRef(renderCite);
  useEffect(() => { cite.current = renderCite; });

  // Chunk starts: every commit that adds units opens a new chunk at the old count. Text present at mount does not animate.
  const [marks, setMarks] = useState(() => ({ count, starts: [0], enterFrom: streaming ? 0 : count }));
  let current = marks;
  if (count !== marks.count) {
    current = count > marks.count
      ? { ...marks, count, starts: marks.starts[marks.starts.length - 1] === marks.count ? marks.starts : [...marks.starts, marks.count] }
      : { count, starts: marks.starts.filter(start => start < count), enterFrom: Math.min(marks.enterFrom, count) };
    setMarks(current);
  }
  const chunkOf = (index: number) => {
    let lo = 0, hi = current.starts.length - 1;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (current.starts[mid] <= index) lo = mid; else hi = mid - 1; }
    return current.starts[lo];
  };
  const chunks = (units: StreamUnit[]) => {
    const groups: { start: number; units: StreamUnit[] }[] = [];
    for (const unit of units) {
      const start = chunkOf(unit.index);
      const group = groups[groups.length - 1];
      if (group && group.start === start) group.units.push(unit); else groups.push({ start, units: [unit] });
    }
    return groups.map(group => <Chunk key={group.units[0].index} units={group.units} enter={!reduced && group.start >= current.enterFrom} cite={cite} />);
  };

  // A dot appears only when the reader has caught up and the stream is still open for a moment.
  const [waitedAt, setWaitedAt] = useState(-1);
  useEffect(() => {
    if (!streaming || revealing) return;
    const id = window.setTimeout(() => setWaitedAt(count), 450);
    return () => window.clearTimeout(id);
  }, [streaming, revealing, count]);
  const waiting = streaming && !revealing && waitedAt === count && count > 0;
  const tail = <AnimatePresence initial={false}>{waiting ? <Waiting key="wait" /> : null}</AnimatePresence>;

  const shownRef = useRef(onShown);
  const revealedRef = useRef(onRevealed);
  useEffect(() => { shownRef.current = onShown; revealedRef.current = onRevealed; });
  useEffect(() => { shownRef.current?.(text); }, [text]);
  const done = !live && text.length > 0;
  useEffect(() => { if (done) revealedRef.current?.(); }, [done]);

  const lastBlock = blocks.length - 1;
  const quick = { duration: reduced ? 0 : motionTokens.duration.fast, ease: [...motionTokens.ease.standard] as [number, number, number, number] };
  return <div className={[styles.stage, className].filter(Boolean).join(" ")} aria-busy={live || undefined}>
    <AnimatePresence initial={false}>
      {placeholder && streaming && !text.trim() ? <motion.div key="placeholder" className={styles.placeholder} role="status" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: quick }} transition={quick}>{placeholder}</motion.div> : null}
    </AnimatePresence>
    {blocks.length ? <div className={markdown ? styles.markdown : styles.plain}>
      {blocks.map((block, index) => {
        const end = index === lastBlock ? tail : null;
        if (block.kind === "code") return <CodeBlock key={`c${index}`} lang={block.lang} source={block.source}>{chunks(block.units)}{end}</CodeBlock>;
        if ("items" in block) {
          const List = block.kind;
          return <List key={`${block.kind}${index}`} className={styles.list}>
            {block.items.map((item, row) => <ListItem key={row} enter={!reduced && (item[0]?.index ?? 0) >= current.enterFrom}>{chunks(item)}{row === block.items.length - 1 ? end : null}</ListItem>)}
          </List>;
        }
        if (block.kind === "h") return <h4 key={`h${index}`} className={styles.heading}>{chunks(block.units)}{end}</h4>;
        return <p key={`p${index}`} className={styles.paragraph}>{chunks(block.units)}{end}</p>;
      })}
    </div> : null}
  </div>;
}

function ListItem({ enter, children }: { enter: boolean; children: ReactNode }) {
  const [entrance] = useState(enter);
  return <li className={entrance ? styles.itemEnter : undefined}>{children}</li>;
}

/** Plain mode: paragraphs split on blank lines, words as units. */
function plain(text: string) {
  const counter = { n: 0 };
  const blocks: Block[] = text.split(/\n{2,}/).filter(part => part.trim()).map(part => ({
    kind: "p" as const,
    units: part.trim().split(/\s+/).map((word, i) => ({ kind: "text" as const, text: word, bold: false, index: counter.n++, space: i > 0, sentence: -1 })),
  }));
  return { blocks, count: counter.n };
}

/* ---------------------------------------------------------------------------------------------------------------
 * Scrolling
 * ------------------------------------------------------------------------------------------------------------- */

/**
 * Keeps a scroller pinned to its newest content while the reader is at the bottom, easing toward it rather than jumping.
 * Only a person lets go: wheel, touch, keys and scrollbar drags count; the block's own follow never does. Returning to the
 * bottom pins again. `away` is true once the reader is more than a screenful of lines from the end.
 */
export function useStickToBottom(reduced: boolean) {
  const scroller = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);
  const frame = useRef(0);
  const [away, setAway] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const follow = useCallback((instant = false) => {
    const el = scroller.current;
    if (!el) return;
    cancelAnimationFrame(frame.current);
    const step = () => {
      const target = el.scrollHeight - el.clientHeight;
      const gap = target - el.scrollTop;
      if (gap <= .5 || !pinned.current) return;
      el.scrollTop = instant || reduced ? target : el.scrollTop + Math.max(1, gap * .16);
      frame.current = requestAnimationFrame(step);
    };
    step();
  }, [reduced]);

  useEffect(() => {
    const el = scroller.current, inner = content.current;
    if (!el || !inner) return;
    let dragging = false, lastTop = el.scrollTop, touchY = 0;
    const release = () => { if (pinned.current) { pinned.current = false; cancelAnimationFrame(frame.current); } };
    const check = () => {
      const gap = el.scrollHeight - el.clientHeight - el.scrollTop;
      if (dragging && el.scrollTop < lastTop - 1) release();
      if (gap < 6) pinned.current = true;
      lastTop = el.scrollTop;
      setAway(!pinned.current && gap > 60);
      setScrolled(el.scrollTop > 56);
    };
    const onWheel = (event: WheelEvent) => { if (event.deltaY < 0) release(); };
    const onTouchStart = (event: TouchEvent) => { touchY = event.touches[0]?.clientY ?? 0; };
    const onTouchMove = (event: TouchEvent) => { if ((event.touches[0]?.clientY ?? 0) > touchY + 2) release(); };
    const onKey = (event: KeyboardEvent) => { if (["ArrowUp", "PageUp", "Home"].includes(event.key) || (event.key === " " && event.shiftKey)) release(); };
    const onDown = (event: PointerEvent) => { if (event.target === el) dragging = true; };
    const onUp = () => { dragging = false; };
    const observer = new ResizeObserver(() => { if (pinned.current) follow(); else check(); });
    observer.observe(inner);
    el.addEventListener("scroll", check, { passive: true });
    el.addEventListener("wheel", onWheel, { passive: true });
    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: true });
    el.addEventListener("keydown", onKey);
    el.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", onUp);
    return () => {
      observer.disconnect();
      el.removeEventListener("scroll", check);
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("keydown", onKey);
      el.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      cancelAnimationFrame(frame.current);
    };
  }, [follow]);

  const jump = useCallback(() => { pinned.current = true; setAway(false); follow(); }, [follow]);
  return { scroller, content, away, scrolled, jump };
}
