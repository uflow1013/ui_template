"use client";

import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { AnimatePresence, animate, motion, useMotionValue, type AnimationPlaybackControls } from "motion/react";
import { Briefcase, Check, CornerDownLeft, LoaderCircle, Minimize2, Redo2, Smile, Sparkles, SpellCheck, Square, Undo2, WandSparkles, X, type LucideIcon } from "lucide-react";
import { motionTokens } from "@/shared/arc/lib/motion-tokens";
import { useReducedStream, useStreamBuffer } from "./stream-text";
import { quickActions, sampleAuthor, sampleDocument, scriptedCompletion, scriptedEdit, type CompletionRequest, type EditRequest, type EditorDocument, type QuickAction } from "./ai-inline-edit-data";
import styles from "./ai-inline-edit.module.css";

export type { CompletionRequest, EditRequest, EditorDocument, QuickAction } from "./ai-inline-edit-data";

const { spring, duration, ease } = motionTokens;
const standard = [...ease.standard] as [number, number, number, number];
const cx = (...names: (string | false | null | undefined)[]) => names.filter(Boolean).join(" ");
const ICONS: Record<string, LucideIcon> = { shorten: Minimize2, clearer: WandSparkles, friendly: Smile, formal: Briefcase, grammar: SpellCheck };
const VERBS: Record<string, string> = { shorten: "Shortening", clearer: "Clarifying", friendly: "Warming up the tone", formal: "Making it formal", grammar: "Fixing grammar" };

/* ---------------------------------------------------------------------------------------------------------------
 * Word diff. The suggestion is compared with the selection word by word. While it streams, original words the model has
 * not reached yet stay as they are (pending) instead of showing as deleted, so the diff only ever grows at the stream edge.
 * ------------------------------------------------------------------------------------------------------------- */

type OpType = "equal" | "delete" | "insert" | "pending";
interface Op { type: OpType; text: string; a?: number; b?: number; hunk?: number }

const wordsOf = (text: string) => text.match(/\S+\s*/g) ?? [];
const norm = (word: string) => word.trim();

function diffWords(original: string, suggestion: string, live: boolean): Op[] {
  const a = wordsOf(original), b = wordsOf(suggestion);
  const n = a.length, m = b.length;
  const table = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) {
    table[i][j] = norm(a[i]) === norm(b[j]) ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
  }
  let ops: Op[] = [];
  let i = 0, j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && norm(a[i]) === norm(b[j])) { ops.push({ type: "equal", text: a[i], a: i++, b: j++ }); continue; }
    if (i < n && (j >= m || table[i + 1][j] >= table[i][j + 1])) ops.push({ type: "delete", text: a[i], a: i++ });
    else ops.push({ type: "insert", text: b[j], b: j++ });
  }
  if (live) {
    // A lone short word matched far ahead is usually a coincidence ("the", "to"); let the stream reach it first.
    for (let guard = 0; guard < 4; guard++) {
      const end = ops.findLastIndex(op => op.type === "equal");
      if (end < 0) break;
      let start = end;
      while (start > 0 && ops[start - 1].type === "equal") start--;
      let skipped = 0;
      for (let k = start - 1; k >= 0 && ops[k].type !== "equal"; k--) if (ops[k].type === "delete") skipped++;
      const run = ops.slice(start, end + 1);
      const weak = run.length === 1 && norm(run[0].text).length <= 4 || run.length <= 2 && skipped >= 6;
      if (!weak || skipped < 3) break;
      ops = [...ops.slice(0, start), ...run.flatMap(op => [{ type: "delete" as const, text: op.text, a: op.a }, { type: "insert" as const, text: wordsOf(suggestion)[op.b!] ?? op.text, b: op.b }]), ...ops.slice(end + 1)];
    }
    // After the last matched word, original text is still ahead of the stream: new words first, then the pending original.
    const last = ops.findLastIndex(op => op.type === "equal");
    const head = ops.slice(0, last + 1), tail = ops.slice(last + 1);
    ops = [...head, ...tail.filter(op => op.type === "insert"), ...tail.filter(op => op.type === "delete").map(op => ({ ...op, type: "pending" as const }))];
  }
  let hunk = -1, open = false;
  for (const op of ops) {
    if (op.type === "delete" || op.type === "insert") { if (!open) { hunk++; open = true; } op.hunk = hunk; }
    else open = false;
  }
  return ops;
}

type Decision = "accepted" | "rejected";
function compose(ops: Op[], decisions: Record<number, Decision>) {
  return ops.map(op => {
    if (op.type === "equal" || op.type === "pending") return op.text;
    const choice = decisions[op.hunk!] ?? "rejected";
    return op.type === "delete" ? (choice === "rejected" ? op.text : "") : (choice === "accepted" ? op.text : "");
  }).join("");
}

/* ---------------------------------------------------------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------------------------------------------------------- */

const noop = () => () => {};
function useIsMac() {
  return useSyncExternalStore(noop, () => /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent), () => true);
}

/** Text of a paragraph element, leaving out ghost text. */
function paragraphText(el: HTMLElement) {
  let text = "";
  el.childNodes.forEach(node => { if (!(node instanceof HTMLElement && node.dataset.ghost !== undefined)) text += node.textContent ?? ""; });
  return text;
}
function offsetIn(root: HTMLElement, node: Node, offset: number) {
  const range = document.createRange();
  range.setStart(root, 0);
  range.setEnd(node, offset);
  return range.toString().length;
}
function placeCaret(el: HTMLElement, start: number, end = start) {
  const text = el.firstChild && el.firstChild.nodeType === Node.TEXT_NODE ? el.firstChild : null;
  const selection = window.getSelection();
  if (!selection) return;
  const range = document.createRange();
  if (text) { const len = text.textContent?.length ?? 0; range.setStart(text, Math.min(start, len)); range.setEnd(text, Math.min(end, len)); }
  else { range.selectNodeContents(el); range.collapse(start === 0); }
  selection.removeAllRanges();
  selection.addRange(range);
}
/** Grows a range to whole words and trims surrounding spaces. */
function snapToWords(text: string, start: number, end: number) {
  while (start > 0 && /\S/.test(text[start - 1]) && /\S/.test(text[start] ?? " ")) start--;
  while (end < text.length && /\S/.test(text[end]) && end > 0 && /\S/.test(text[end - 1])) end++;
  while (start < end && /\s/.test(text[start])) start++;
  while (end > start && /\s/.test(text[end - 1])) end--;
  return [start, end] as const;
}
/** The sentence around an offset, for opening the prompt with nothing selected. */
function sentenceAt(text: string, offset: number) {
  const re = /[^.!?]+[.!?]*["”)]?\s*/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) {
    if (offset <= match.index + match[0].length) return snapToWords(text, match.index, match.index + match[0].length);
  }
  return snapToWords(text, 0, text.length);
}
const countWords = (paragraphs: { text: string }[]) => paragraphs.reduce((sum, p) => sum + (p.text.trim() ? p.text.trim().split(/\s+/).length : 0), 0);

/* ---------------------------------------------------------------------------------------------------------------
 * Paragraphs
 * ------------------------------------------------------------------------------------------------------------- */

interface Para { id: number; text: string; v: number }

/** An uncontrolled editable paragraph. It renders its text once; typing never re-renders it, so the caret never jumps. */
const EditableParagraph = memo(function EditableParagraph({ para, handlers }: { para: Para; handlers: React.RefObject<ParagraphHandlers> }) {
  const [initial] = useState(para.text);
  return <p data-para={para.id} className={styles.para} contentEditable suppressContentEditableWarning spellCheck={false}
    data-placeholder={initial ? undefined : "Write, or press ⌘K to ask AI"}
    onInput={event => handlers.current.input(para.id, event.currentTarget)}
    onKeyDown={event => handlers.current.keyDown(para.id, event)}
    onBeforeInput={event => handlers.current.beforeInput(para.id, event.nativeEvent as InputEvent)}
    onPaste={event => { event.preventDefault(); document.execCommand("insertText", false, event.clipboardData.getData("text/plain").replace(/\s*\n\s*/g, " ")); }}
    onKeyUp={() => handlers.current.caret(para.id)} onPointerUp={() => handlers.current.caret(para.id)}
    onBlur={() => handlers.current.blur(para.id)}>{initial}</p>;
}, (a, b) => a.para.id === b.para.id && a.para.v === b.para.v);

interface ParagraphHandlers {
  input: (id: number, el: HTMLElement) => void;
  keyDown: (id: number, event: ReactKeyboardEvent<HTMLElement>) => void;
  beforeInput: (id: number, event: InputEvent) => void;
  caret: (id: number) => void;
  blur: (id: number) => void;
}

/* ---------------------------------------------------------------------------------------------------------------
 * Session: one AI edit from prompt to review
 * ------------------------------------------------------------------------------------------------------------- */

type Phase = "prompt" | "streaming" | "review" | "error";
interface Session {
  para: number;
  start: number;
  end: number;
  original: string;
  phase: Phase;
  instruction: string;
  label: string;
  action?: string;
  suggestion: string;
  received: boolean;
  stopped: boolean;
  decisions: Record<number, Decision>;
  error?: string;
}

function DiffRegion({ ops, phase, decisions, reduced, onDecide }: { ops: Op[]; phase: Phase; decisions: Record<number, Decision>; reduced: boolean; onDecide: (hunk: number, choice: Decision) => void }) {
  if (phase !== "review") {
    return <>{ops.map(op => {
      const key = op.type === "insert" ? `b${op.b}` : `a${op.a}`;
      if (op.type === "insert") return <ins key={key} className={cx(styles.ins, !reduced && styles.insEnter)}>{op.text}</ins>;
      if (op.type === "delete") return <del key={key} className={cx(styles.del, !reduced && styles.delEnter)}>{op.text}</del>;
      return <span key={key} className={op.type === "pending" ? styles.pending : undefined}>{op.text}</span>;
    })}</>;
  }
  const out: ReactNode[] = [];
  for (let k = 0; k < ops.length;) {
    const op = ops[k];
    if (op.hunk === undefined) { out.push(<span key={`a${op.a}`}>{op.text}</span>); k++; continue; }
    const hunk = op.hunk, parts: Op[] = [];
    while (k < ops.length && ops[k].hunk === hunk) parts.push(ops[k++]);
    const decided = decisions[hunk];
    const deleted = parts.filter(p => p.type === "delete").map(p => p.text).join("");
    const inserted = parts.filter(p => p.type === "insert").map(p => p.text).join("");
    if (decided) {
      out.push(<span key={`h${hunk}`} className={styles.resolved} data-choice={decided}>{decided === "accepted" ? inserted : deleted}</span>);
      continue;
    }
    const label = deleted && inserted ? `Change "${deleted.trim()}" to "${inserted.trim()}"` : deleted ? `Remove "${deleted.trim()}"` : `Add "${inserted.trim()}"`;
    out.push(<span key={`h${hunk}`} className={styles.hunk} tabIndex={0} role="group" aria-label={`${label}. Enter accepts, Backspace rejects.`} data-hunk={hunk}
      onKeyDown={event => {
        if (event.key === "Enter" && !event.metaKey && !event.ctrlKey) { event.preventDefault(); onDecide(hunk, "accepted"); }
        if (event.key === "Backspace" || event.key === "Delete") { event.preventDefault(); onDecide(hunk, "rejected"); }
      }}>
      {deleted ? <del className={styles.del}>{deleted}</del> : null}
      {inserted ? <ins className={styles.ins}>{inserted}</ins> : null}
      <span className={styles.hunkBar} contentEditable={false}>
        <button type="button" tabIndex={-1} className={styles.hunkButton} aria-label="Accept change" onPointerDown={event => event.preventDefault()} onClick={() => onDecide(hunk, "accepted")}><Check /></button>
        <button type="button" tabIndex={-1} className={styles.hunkButton} aria-label="Reject change" onPointerDown={event => event.preventDefault()} onClick={() => onDecide(hunk, "rejected")}><X /></button>
      </span>
    </span>);
  }
  return <>{out}</>;
}

/* ---------------------------------------------------------------------------------------------------------------
 * The floating layer: prompt, then status, then review, then the applied receipt, all one surface that morphs in place
 * ------------------------------------------------------------------------------------------------------------- */

type LayerMode = "prompt" | "streaming" | "review" | "empty" | "error" | "applied";

function Kbd({ children }: { children: ReactNode }) {
  return <kbd className={styles.kbd}>{children}</kbd>;
}

interface PromptProps { actions: QuickAction[]; mac: boolean; onRun: (instruction: string, action?: QuickAction) => void; onClose: () => void }

function Prompt({ actions, mac, onRun, onClose }: PromptProps) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { input.current?.focus({ preventScroll: true }); }, []);
  const q = query.trim().toLowerCase();
  const matches = q ? actions.filter(a => a.label.toLowerCase().includes(q) || a.id.includes(q)) : actions;
  const items: { key: string; label: ReactNode; icon: LucideIcon; run: () => void }[] = [
    ...(q ? [{ key: "custom", label: <><span className={styles.muted}>Ask </span>{query.trim()}</>, icon: CornerDownLeft, run: () => onRun(query.trim()) }] : []),
    ...matches.map(action => ({ key: action.id, label: action.label, icon: ICONS[action.id] ?? Sparkles, run: () => onRun(action.instruction, action) })),
  ];
  const current = Math.min(active, items.length - 1);
  const onKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") { event.preventDefault(); setActive((current + 1) % items.length); }
    else if (event.key === "ArrowUp") { event.preventDefault(); setActive((current - 1 + items.length) % items.length); }
    else if (event.key === "Enter") { event.preventDefault(); items[current]?.run(); }
    else if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); onClose(); }
    else if (event.key === "Tab") event.preventDefault();
  };
  return <div className={styles.prompt}>
    <div className={styles.promptRow}>
      <Sparkles className={styles.promptIcon} aria-hidden="true" />
      <input ref={input} className={styles.promptInput} value={query} placeholder="Ask AI to edit the selection" aria-label="Edit instruction"
        role="combobox" aria-expanded="true" aria-controls="ai-edit-actions" aria-activedescendant={items[current] ? `ai-edit-${items[current].key}` : undefined}
        onChange={event => { setQuery(event.target.value); setActive(0); }} onKeyDown={onKeyDown} />
      <Kbd>esc</Kbd>
    </div>
    <ul className={styles.menu} role="listbox" id="ai-edit-actions" aria-label="Quick edits">
      {items.map((item, index) => {
        const Icon = item.icon;
        return <li key={item.key} id={`ai-edit-${item.key}`} role="option" aria-selected={index === current} className={styles.menuItem} data-active={index === current || undefined}
          onPointerMove={() => setActive(index)} onPointerDown={event => event.preventDefault()} onClick={item.run}>
          {index === current ? <motion.span layoutId="ai-edit-highlight" className={styles.menuHighlight} transition={spring.snappy} /> : null}
          <Icon className={styles.menuIcon} aria-hidden="true" /><span className={styles.menuLabel}>{item.label}</span>
          {index === current ? <CornerDownLeft className={styles.menuEnter} aria-hidden="true" /> : null}
        </li>;
      })}
      {items.length === 0 ? <li className={styles.menuEmpty}>Type an instruction</li> : null}
    </ul>
    <p className={styles.promptHint}><Kbd>↑</Kbd><Kbd>↓</Kbd> to choose, <Kbd>↵</Kbd> to run. {mac ? "⌘K" : "Ctrl K"} opens this on any selection.</p>
  </div>;
}

/* ---------------------------------------------------------------------------------------------------------------
 * AiInlineEdit
 * ------------------------------------------------------------------------------------------------------------- */

export interface AiInlineEditProps {
  /** The document to start from. Paragraphs are plain text. */
  defaultDocument?: EditorDocument;
  /** Streams replacement text for a selection. Return an async iterable of text deltas or a promise of the whole text. Defaults to the scripted rewrites. Stop aborts `signal`. */
  onRequestEdit?: (request: EditRequest, signal: AbortSignal) => AsyncIterable<string> | Promise<string>;
  /** Suggests ghost text to continue a paragraph from the caret, or null for none. Defaults to scripted completions. */
  onSuggest?: (request: CompletionRequest, signal: AbortSignal) => Promise<string | null>;
  /** Quick actions offered in the prompt. */
  actions?: QuickAction[];
  /** Called after typing settles, an edit is applied, a completion is accepted, or history moves. */
  onChange?: (document: EditorDocument) => void;
  /** The person shown as the author in the header. */
  author?: { name: string; photo: string };
  className?: string;
}

export function AiInlineEdit({ defaultDocument = sampleDocument, onRequestEdit = scriptedEdit, onSuggest = scriptedCompletion, actions = quickActions, onChange, author = sampleAuthor, className }: AiInlineEditProps) {
  const reduced = useReducedStream();
  const mac = useIsMac();
  const [title] = useState(defaultDocument.title);
  // Ids come from position at first render, so server and client agree; new paragraphs count up from there.
  const [paras, setParas] = useState<Para[]>(() => defaultDocument.paragraphs.map((text, i) => ({ id: i + 1, text, v: 0 })));
  const nextId = useRef(defaultDocument.paragraphs.length + 1);
  const parasRef = useRef(paras);
  useLayoutEffect(() => { parasRef.current = paras; });
  const [past, setPast] = useState<string[][]>([]);
  const [future, setFuture] = useState<string[][]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const sessionRef = useRef(session);
  useLayoutEffect(() => { sessionRef.current = session; });
  const [receipt, setReceipt] = useState<{ applied: number; total: number } | null>(null);
  const [bubble, setBubble] = useState<{ top: number; left: number } | null>(null);
  const [ghostOn, setGhostOn] = useState(false);
  const [saved, setSaved] = useState<"saved" | "saving">("saved");
  const [focusRequest, setFocusRequest] = useState<{ id: number; start: number; end?: number } | null>(null);
  const root = useRef<HTMLElement>(null);
  const page = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const layer = useRef<HTMLDivElement>(null);
  const controller = useRef<AbortController | null>(null);
  const ghost = useRef<{ para: number; el: HTMLSpanElement; text: string } | null>(null);
  const suggestTimer = useRef(0);
  const suggestAbort = useRef<AbortController | null>(null);
  const saveTimer = useRef(0);
  const receiptTimer = useRef(0);
  const callbacks = useRef({ onRequestEdit, onSuggest, onChange });
  useEffect(() => { callbacks.current = { onRequestEdit, onSuggest, onChange }; });
  useEffect(() => () => { window.clearTimeout(suggestTimer.current); window.clearTimeout(saveTimer.current); window.clearTimeout(receiptTimer.current); controller.current?.abort(); suggestAbort.current?.abort(); }, []);

  const toDocument = (list: Para[]): EditorDocument => ({ title, paragraphs: list.map(p => p.text) });
  const touch = (list: Para[]) => {
    setSaved("saving");
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => { setSaved("saved"); callbacks.current.onChange?.(toDocument(list)); }, 700);
  };

  /* Streaming suggestion, paced like any other stream */
  const streaming = session?.phase === "streaming";
  const buffer = useStreamBuffer(session?.suggestion ?? "", { streaming: Boolean(streaming && !session?.received), enabled: Boolean(session && !session.stopped) });
  const shownSuggestion = buffer.text;
  const shownRef = useRef("");
  useEffect(() => { shownRef.current = shownSuggestion; }, [shownSuggestion]);
  const ops = useMemo(() => session && session.phase !== "prompt" && session.phase !== "error"
    ? diffWords(session.original, shownSuggestion, session.phase === "streaming")
    : null, [session, shownSuggestion]);
  const hunkCount = ops ? new Set(ops.filter(op => op.hunk !== undefined).map(op => op.hunk)).size : 0;
  // Review starts once every received word is on screen.
  const reviewReady = session?.phase === "streaming" && session.received && !buffer.revealing;

  /* Ghost text */
  const clearGhost = useCallback(() => {
    window.clearTimeout(suggestTimer.current);
    suggestAbort.current?.abort();
    if (ghost.current) { ghost.current.el.remove(); ghost.current = null; }
    setGhostOn(false);
  }, []);
  const renderGhost = useCallback((el: HTMLSpanElement, text: string, animate: boolean) => {
    el.textContent = "";
    text.split(/(\s+)/).forEach((part, index) => {
      if (!part) return;
      const span = document.createElement("span");
      span.textContent = part;
      if (animate && !reduced) { span.className = styles.ghostWord; span.style.animationDelay = `${Math.min(index * 18, 360)}ms`; }
      el.appendChild(span);
    });
  }, [reduced]);
  const showGhost = useCallback((id: number, text: string) => {
    const el = page.current?.querySelector<HTMLElement>(`[data-para="${id}"][contenteditable]`);
    if (!el || !text) return;
    if (ghost.current) ghost.current.el.remove();
    const span = document.createElement("span");
    span.dataset.ghost = "";
    span.contentEditable = "false";
    span.className = styles.ghost;
    span.setAttribute("aria-hidden", "true");
    renderGhost(span, text, true);
    el.appendChild(span);
    ghost.current = { para: id, el: span, text };
    setGhostOn(true);
  }, [renderGhost]);

  const caretAtEnd = (id: number) => {
    const el = page.current?.querySelector<HTMLElement>(`[data-para="${id}"][contenteditable]`);
    const selection = window.getSelection();
    if (!el || !selection || !selection.isCollapsed || !selection.rangeCount) return null;
    const range = selection.getRangeAt(0);
    if (!el.contains(range.startContainer)) return null;
    const text = paragraphText(el);
    const offset = offsetIn(el, range.startContainer, range.startOffset);
    return offset >= text.trimEnd().length && text.trim().length > 8 ? { el, text } : null;
  };
  const scheduleSuggest = (id: number, wait: number) => {
    window.clearTimeout(suggestTimer.current);
    suggestAbort.current?.abort();
    if (sessionRef.current) return;
    suggestTimer.current = window.setTimeout(async () => {
      const at = caretAtEnd(id);
      if (!at || ghost.current) return;
      const abort = new AbortController();
      suggestAbort.current = abort;
      const index = parasRef.current.findIndex(p => p.id === id);
      try {
        const text = await callbacks.current.onSuggest({ before: at.text, paragraph: index, document: toDocument(parasRef.current) }, abort.signal);
        if (abort.signal.aborted || !text || !caretAtEnd(id)) return;
        showGhost(id, text);
      } catch { /* a cancelled or failed suggestion shows nothing */ }
    }, wait);
  };
  const acceptGhost = (el: HTMLElement) => {
    const current = ghost.current;
    if (!current) return;
    current.el.remove();
    ghost.current = null;
    setGhostOn(false);
    const start = paragraphText(el).length;
    placeCaret(el, start);
    document.execCommand("insertText", false, current.text);
    // The accepted words glow briefly, drawn with the CSS highlight API so the text itself is never touched.
    const node = el.firstChild;
    if (!reduced && node && "highlights" in CSS && typeof Highlight !== "undefined") {
      const range = document.createRange();
      range.setStart(node, Math.min(start, node.textContent?.length ?? 0));
      range.setEnd(node, node.textContent?.length ?? 0);
      CSS.highlights.set("ai-accepted", new Highlight(range));
      window.setTimeout(() => CSS.highlights.delete("ai-accepted"), 900);
    }
  };

  /* Selection bubble */
  const readSelection = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) return null;
    const range = selection.getRangeAt(0);
    const startNode = range.startContainer.nodeType === Node.ELEMENT_NODE ? range.startContainer as Element : range.startContainer.parentElement;
    const el = startNode?.closest<HTMLElement>("[data-para][contenteditable]");
    if (!el || !page.current?.contains(el)) return null;
    const id = Number(el.dataset.para);
    const text = paragraphText(el);
    let start = offsetIn(el, range.startContainer, range.startOffset);
    let end = el.contains(range.endContainer) ? offsetIn(el, range.endContainer, range.endOffset) : text.length;
    end = Math.min(end, text.length);
    if (range.collapsed) [start, end] = sentenceAt(text, start); else [start, end] = snapToWords(text, start, end);
    if (end <= start) return null;
    return { id, el, start, end, text, collapsed: range.collapsed };
  }, []);

  const updateBubble = useCallback(() => {
    const selection = window.getSelection();
    if (sessionRef.current || !selection || selection.isCollapsed || !selection.rangeCount || !page.current) { setBubble(null); return; }
    const found = readSelection();
    if (!found || found.collapsed) { setBubble(null); return; }
    const rects = selection.getRangeAt(0).getClientRects();
    const first = rects[0], box = page.current.getBoundingClientRect();
    if (!first) { setBubble(null); return; }
    setBubble({ top: first.top - box.top - 40, left: Math.max(0, Math.min(first.left - box.left, box.width - 132)) });
  }, [readSelection]);

  useEffect(() => {
    const onChange = () => { if (!pointerDown.current) updateBubble(); };
    document.addEventListener("selectionchange", onChange);
    return () => document.removeEventListener("selectionchange", onChange);
  }, [updateBubble]);
  const pointerDown = useRef(false);

  /* Opening and running a session */
  const openPrompt = useCallback(() => {
    const found = readSelection();
    if (!found || sessionRef.current) return false;
    clearGhost();
    const text = found.text;
    // Save what was typed before the paragraph leaves edit mode.
    setParas(list => list.map(p => p.id === found.id ? { ...p, text } : p));
    setSession({ para: found.id, start: found.start, end: found.end, original: text.slice(found.start, found.end), phase: "prompt", instruction: "", label: "", suggestion: "", received: false, stopped: false, decisions: {} });
    setBubble(null);
    setReceipt(null);
    window.getSelection()?.removeAllRanges();
    return true;
  }, [readSelection, clearGhost]);

  const closeSession = useCallback((restore = true) => {
    controller.current?.abort();
    const current = sessionRef.current;
    setSession(null);
    if (current && restore) setFocusRequest({ id: current.para, start: current.start, end: current.end });
  }, []);

  const run = async (instruction: string, action?: QuickAction) => {
    const current = sessionRef.current;
    if (!current) return;
    const para = parasRef.current.find(p => p.id === current.para);
    if (!para) return;
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    const label = action ? VERBS[action.id] ?? action.label : "Editing";
    setSession(s => s && { ...s, phase: "streaming", instruction, action: action?.id, label, suggestion: "", received: false, stopped: false, decisions: {}, error: undefined });
    const request: EditRequest = { text: current.original, instruction, action: action?.id, before: para.text.slice(0, current.start), after: para.text.slice(current.end), paragraph: parasRef.current.indexOf(para) };
    try {
      const result = callbacks.current.onRequestEdit(request, abort.signal);
      if (typeof (result as Promise<string>).then === "function") {
        const text = await (result as Promise<string>);
        if (!abort.signal.aborted) setSession(s => s && { ...s, suggestion: text, received: true });
      } else {
        for await (const delta of result as AsyncIterable<string>) {
          if (abort.signal.aborted) return;
          setSession(s => s && { ...s, suggestion: s.suggestion + delta });
        }
        if (!abort.signal.aborted) setSession(s => s && { ...s, received: true });
      }
    } catch (error) {
      if (abort.signal.aborted) return;
      setSession(s => s && { ...s, phase: "error", error: error instanceof Error ? error.message : "The edit failed" });
    }
  };

  const stop = () => {
    controller.current?.abort();
    // Keep exactly the words already on screen; the original after them stays as it was.
    setSession(s => s && { ...s, suggestion: shownRef.current, received: true, stopped: true });
  };

  // When the stream is fully on screen, the diff becomes reviewable. No changes at all closes with a note.
  useEffect(() => {
    if (!reviewReady) return;
    const id = window.setTimeout(() => {
      setSession(s => s && s.phase === "streaming" ? { ...s, phase: "review" } : s);
    }, 0);
    return () => window.clearTimeout(id);
  }, [reviewReady]);

  const apply = useCallback((decisions: Record<number, Decision>) => {
    const current = sessionRef.current;
    if (!current || !ops) return;
    const composed = compose(ops, decisions);
    const total = Object.keys(decisions).length;
    const applied = Object.values(decisions).filter(d => d === "accepted").length;
    const list = parasRef.current;
    const next = list.map(p => p.id === current.para ? { ...p, text: p.text.slice(0, current.start) + composed + p.text.slice(current.end), v: p.v + 1 } : p);
    if (applied) { setPast(h => [...h, list.map(p => p.text)]); setFuture([]); setParas(next); touch(next); }
    setSession(null);
    setReceipt({ applied, total });
    window.clearTimeout(receiptTimer.current);
    receiptTimer.current = window.setTimeout(() => setReceipt(null), 4200);
    setFocusRequest({ id: current.para, start: current.start + composed.length });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ops]);

  const decide = (hunk: number, choice: Decision) => {
    const current = sessionRef.current;
    if (!current) return;
    const decisions = { ...current.decisions, [hunk]: choice };
    setSession({ ...current, decisions });
    if (Object.keys(decisions).length >= hunkCount) window.setTimeout(() => apply(decisions), reduced ? 0 : 320);
    else requestAnimationFrame(() => {
      // Keyboard review moves on to the next open change.
      const next = page.current?.querySelector<HTMLElement>(`[data-hunk]:not([data-hunk="${hunk}"])`);
      if (document.activeElement?.closest("[data-hunk]")) next?.focus({ preventScroll: false });
    });
  };
  const decideAll = (choice: Decision) => {
    if (!ops) return;
    const decisions: Record<number, Decision> = {};
    for (let h = 0; h < hunkCount; h++) decisions[h] = sessionRef.current?.decisions[h] ?? choice;
    apply(decisions);
  };

  const restore = (snapshot: string[]) => {
    setParas(list => {
      const next = snapshot.map((text, i) => list[i] ? { ...list[i], text, v: list[i].text === text ? list[i].v : list[i].v + 1 } : { id: nextId.current++, text, v: 0 });
      touch(next);
      return next;
    });
  };
  const undo = () => {
    if (!past.length || session) return;
    clearGhost();
    setFuture(f => [...f, parasRef.current.map(p => p.text)]);
    restore(past[past.length - 1]);
    setPast(h => h.slice(0, -1));
    setReceipt(null);
  };
  const redo = () => {
    if (!future.length || session) return;
    setPast(h => [...h, parasRef.current.map(p => p.text)]);
    restore(future[future.length - 1]);
    setFuture(f => f.slice(0, -1));
  };

  // Focus requests land after the paragraph has remounted as editable.
  useLayoutEffect(() => {
    if (!focusRequest) return;
    const el = page.current?.querySelector<HTMLElement>(`[data-para="${focusRequest.id}"][contenteditable]`);
    if (!el) return;
    el.focus({ preventScroll: true });
    placeCaret(el, focusRequest.start, focusRequest.end);
    const id = window.setTimeout(() => setFocusRequest(null), 0);
    return () => window.clearTimeout(id);
  }, [focusRequest, paras, session]);

  /* Paragraph handlers, read through a ref so paragraphs never re-render */
  const handlers = useRef<ParagraphHandlers>(null!);
  handlers.current = {
    input: (id, el) => {
      const text = paragraphText(el);
      setParas(list => { const next = list.map(p => p.id === id ? { ...p, text } : p); touch(next); return next; });
      if (!ghost.current || ghost.current.para !== id) scheduleSuggest(id, 650);
      setBubble(null);
    },
    beforeInput: (id, event) => {
      const current = ghost.current;
      if (!current || current.para !== id) return;
      // Typing the ghost's next letters keeps the rest of it; anything else dismisses it.
      if (event.inputType === "insertText" && event.data && current.text.startsWith(event.data)) {
        current.text = current.text.slice(event.data.length);
        if (!current.text.trim()) clearGhost(); else renderGhost(current.el, current.text, false);
      } else clearGhost();
    },
    keyDown: (id, event) => {
      const el = event.currentTarget;
      if (event.key === "Tab" && ghost.current?.para === id) { event.preventDefault(); acceptGhost(el); return; }
      if (event.key === "Escape" && ghost.current) { event.preventDefault(); clearGhost(); return; }
      if (event.key === "Enter" && !event.shiftKey && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        clearGhost();
        const selection = window.getSelection();
        if (!selection?.rangeCount) return;
        const text = paragraphText(el), range = selection.getRangeAt(0);
        const start = offsetIn(el, range.startContainer, range.startOffset), end = offsetIn(el, range.endContainer, range.endOffset);
        const fresh = { id: nextId.current++, text: text.slice(end).trimStart(), v: 0 };
        setParas(list => { const i = list.findIndex(p => p.id === id); const next = [...list]; next.splice(i, 1, { ...list[i], text: text.slice(0, start).trimEnd(), v: list[i].v + 1 }, fresh); touch(next); return next; });
        setFocusRequest({ id: fresh.id, start: 0 });
        return;
      }
      if (event.key === "Backspace") {
        const selection = window.getSelection();
        if (!selection?.isCollapsed || !selection.rangeCount) return;
        const range = selection.getRangeAt(0);
        if (offsetIn(el, range.startContainer, range.startOffset) !== 0) return;
        const list = parasRef.current, i = list.findIndex(p => p.id === id);
        if (i <= 0) return;
        event.preventDefault();
        clearGhost();
        const previous = list[i - 1], text = paragraphText(el);
        const joiner = previous.text && text && !/\s$/.test(previous.text) ? " " : "";
        const next = list.filter(p => p.id !== id).map(p => p.id === previous.id ? { ...p, text: previous.text + joiner + text, v: p.v + 1 } : p);
        setParas(next);
        touch(next);
        setFocusRequest({ id: previous.id, start: previous.text.length + joiner.length });
      }
    },
    caret: id => {
      pointerDown.current = false;
      updateBubble();
      if (!ghost.current) scheduleSuggest(id, 380);
    },
    blur: () => { clearGhost(); },
  };

  /* Keyboard across the block */
  const onKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    const mod = event.metaKey || event.ctrlKey;
    // The editor owns Cmd/Ctrl + K while focus is inside it, so an app wide command menu does not open as well.
    if (mod && event.key.toLowerCase() === "k") { event.preventDefault(); event.stopPropagation(); if (session?.phase === "prompt") closeSession(); else openPrompt(); return; }
    if (session?.phase === "review") {
      if (mod && event.key === "Enter") { event.preventDefault(); decideAll("accepted"); return; }
      if (event.key === "Escape") { event.preventDefault(); decideAll("rejected"); return; }
    }
    if (session?.phase === "streaming" && event.key === "Escape") { event.preventDefault(); stop(); return; }
    if ((session?.phase === "error") && event.key === "Escape") { event.preventDefault(); closeSession(); return; }
    const editing = (event.target as HTMLElement).isContentEditable;
    if (mod && event.key.toLowerCase() === "z" && !editing) { event.preventDefault(); if (event.shiftKey) redo(); else undo(); }
  };

  /* Where the floating layer sits: under the selection's last line, clamped inside the page */
  const [anchor, setAnchor] = useState<{ top: number; left: number; room: number } | null>(null);
  const layerSize = useRef<HTMLDivElement>(null);
  const mode: LayerMode | null = session ? (session.phase === "review" && hunkCount === 0 ? "empty" : session.phase) : receipt ? "applied" : null;
  useLayoutEffect(() => {
    const el = page.current;
    if (!el) return;
    const measure = () => {
      const region = el.querySelector<HTMLElement>("[data-region]") ?? (receipt && focusRequest === null ? null : null);
      if (!region) { if (!sessionRef.current && !receipt) setAnchor(null); return; }
      const rects = Array.from(region.getClientRects()).filter(r => r.width > 0);
      if (!rects.length) return;
      const box = el.getBoundingClientRect(), last = rects[rects.length - 1], first = rects[0];
      // Clamp against the size the layer is heading to, not the size it is passing through.
      const width = layerSize.current ? layerSize.current.offsetWidth + 2 : 320;
      const left = Math.max(0, Math.min((rects.length > 1 ? Math.min(...rects.map(r => r.left)) : first.left) - box.left, box.width - width));
      const top = last.bottom - box.top + 10, room = box.width;
      setAnchor(current => current && current.top === top && current.left === left && current.room === room ? current : { top, left, room });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [session, ops, receipt, focusRequest]);

  // Keep the layer in view when it opens or grows.
  useEffect(() => {
    if (!mode || !layer.current || !scroller.current) return;
    const id = window.setTimeout(() => {
      const box = layer.current?.getBoundingClientRect(), view = scroller.current?.getBoundingClientRect();
      if (!box || !view || !scroller.current) return;
      if (box.bottom > view.bottom - 12) scroller.current.scrollBy({ top: box.bottom - view.bottom + 24, behavior: reduced ? "auto" : "smooth" });
    }, 60);
    return () => window.clearTimeout(id);
  }, [mode, anchor?.top, reduced]);

  const words = countWords(paras);
  const hint = session?.phase === "review" ? <>Tab through changes, <Kbd>↵</Kbd> accept, <Kbd>⌫</Kbd> reject</>
    : ghostOn ? <><Kbd>Tab</Kbd> to accept, <Kbd>esc</Kbd> to dismiss</>
    : <>Select text and press <Kbd>{mac ? "⌘K" : "Ctrl K"}</Kbd> to edit with AI</>;
  const layerTransition = reduced ? { duration: 0 } : spring.smooth;

  // The layer springs its own width and height to the content it holds, so its border, corners, and shadow never stretch
  // the way a scale based layout animation would. The content inside always lays out at its final width.
  const layerWidth = useMotionValue<number | "auto">("auto");
  const layerHeight = useMotionValue<number | "auto">("auto");
  const layerOpen = Boolean(mode && anchor);
  useLayoutEffect(() => {
    const node = layerSize.current;
    if (!layerOpen || !node) return;
    let first = true;
    let controls: AnimationPlaybackControls[] = [];
    const measure = () => {
      const width = node.offsetWidth + 2, height = node.offsetHeight + 2;
      controls.forEach(control => control.stop());
      if (first || reduced) { layerWidth.set(width); layerHeight.set(height); controls = []; }
      else controls = [animate(layerWidth as never, width, spring.smooth), animate(layerHeight as never, height, spring.smooth)];
      first = false;
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => { observer.disconnect(); controls.forEach(control => control.stop()); };
  }, [layerOpen, reduced, layerWidth, layerHeight]);

  return <section ref={root} className={cx(styles.root, className)} aria-label={`${title}, editor`} onKeyDown={onKeyDown}
    onPointerDown={event => { pointerDown.current = true; if (session?.phase === "prompt" && !layer.current?.contains(event.target as Node)) closeSession(false); }}
    onPointerUp={() => { pointerDown.current = false; window.setTimeout(updateBubble, 0); }}>
    <header className={styles.header}>
      <div className={styles.docMeta}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={styles.avatar} src={author.photo} alt="" width={28} height={28} />
        <div className={styles.docText}>
          <span className={styles.docTitle}>{title}</span>
          <span className={styles.docSub}>{author.name}<span className={styles.dot} aria-hidden="true" />
            <span className={styles.swap} aria-live="polite">
              <span data-on={saved === "saving" || undefined} aria-hidden={saved !== "saving" || undefined}>Saving</span>
              <span data-on={saved === "saved" || undefined} aria-hidden={saved !== "saved" || undefined}>Saved</span>
            </span>
          </span>
        </div>
      </div>
      <div className={styles.headerActions}>
        <button type="button" className={styles.iconButton} onClick={undo} disabled={!past.length || Boolean(session)} aria-label="Undo AI edit" title={`Undo AI edit (${mac ? "⌘Z" : "Ctrl Z"})`}><Undo2 /></button>
        <button type="button" className={styles.iconButton} onClick={redo} disabled={!future.length || Boolean(session)} aria-label="Redo AI edit" title="Redo AI edit"><Redo2 /></button>
      </div>
    </header>

    <div ref={scroller} className={styles.scroller}>
      <div ref={page} className={styles.page}>
        <h1 className={styles.title}>{title}</h1>
        {paras.map(para => {
          if (session?.para !== para.id) return <EditableParagraph key={`${para.id}-${para.v}`} para={para} handlers={handlers} />;
          const before = para.text.slice(0, session.start), after = para.text.slice(session.end);
          return <p key={`${para.id}-session`} data-para={para.id} className={cx(styles.para, styles.sessionPara)}>
            {before}
            <span data-region className={styles.region} data-phase={session.phase}>
              {session.phase === "prompt" || session.phase === "error" || !ops ? <mark className={styles.selected}>{session.original}</mark>
                : <DiffRegion ops={ops} phase={session.phase} decisions={session.decisions} reduced={reduced} onDecide={decide} />}
            </span>
            {after}
          </p>;
        })}

        <AnimatePresence>
          {bubble && !session ? <motion.button key="bubble" type="button" className={styles.bubble} style={{ top: bubble.top, left: bubble.left }}
            initial={{ opacity: 0, y: reduced ? 0 : 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: { duration: duration.instant } }} transition={reduced ? { duration: 0 } : spring.snappy}
            onPointerDown={event => event.preventDefault()} onClick={() => openPrompt()}>
            <Sparkles aria-hidden="true" /><span>Edit</span><Kbd>{mac ? "⌘K" : "Ctrl K"}</Kbd>
          </motion.button> : null}
        </AnimatePresence>

        <AnimatePresence>
          {mode && anchor ? <motion.div ref={layer} key="layer" className={styles.layer} data-mode={mode} role="dialog" aria-label="Edit with AI"
            initial={{ opacity: 0, y: reduced ? 0 : -4, top: anchor.top, left: anchor.left, borderRadius: mode === "prompt" ? 18 : 14 }}
            animate={{ opacity: 1, y: 0, top: anchor.top, left: anchor.left, borderRadius: mode === "prompt" ? 18 : 14 }}
            exit={{ opacity: 0, y: reduced ? 0 : -4, transition: { duration: duration.exit, ease: standard } }} transition={layerTransition}
            style={{ width: layerWidth, height: layerHeight }}>
            <div ref={layerSize} className={styles.layerSize} data-mode={mode} style={{ ["--layer-room" as string]: `${anchor.room}px` }}>
            <AnimatePresence initial={false} mode="popLayout">
              <motion.div key={mode} className={styles.layerBody} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: duration.fast, ease: standard }}>
                {mode === "prompt" ? <Prompt actions={actions} mac={mac} onRun={run} onClose={() => closeSession()} /> : null}
                {mode === "streaming" ? <div className={styles.bar} role="status">
                  <LoaderCircle className={cx(styles.barIcon, styles.spin)} aria-hidden="true" />
                  <span className={styles.shimmer}>{session?.label}</span>
                  <button type="button" className={styles.barButton} onClick={stop}><Square className={styles.stopGlyph} aria-hidden="true" />Stop<Kbd>esc</Kbd></button>
                </div> : null}
                {mode === "review" ? <div className={styles.bar}>
                  <span className={styles.barLabel}><span className={styles.tabular}>{hunkCount - Object.keys(session?.decisions ?? {}).length}</span> of {hunkCount} {hunkCount === 1 ? "change" : "changes"}{session?.stopped ? ", stopped" : ""}</span>
                  <button type="button" className={styles.barButton} onClick={() => decideAll("rejected")}>Reject all</button>
                  <button type="button" className={cx(styles.barButton, styles.primary)} onClick={() => decideAll("accepted")}>Accept all<Kbd>{mac ? "⌘↵" : "Ctrl ↵"}</Kbd></button>
                </div> : null}
                {mode === "empty" ? <div className={styles.bar} role="status">
                  <span className={styles.barLabel}>No changes suggested</span>
                  <button type="button" className={styles.barButton} onClick={() => closeSession()}>Close</button>
                </div> : null}
                {mode === "error" ? <div className={styles.bar} role="alert">
                  <span className={styles.barLabel}>{session?.error ?? "The edit failed"}</span>
                  <button type="button" className={styles.barButton} onClick={() => session && run(session.instruction)}>Try again</button>
                  <button type="button" className={styles.barButton} onClick={() => closeSession()}>Close</button>
                </div> : null}
                {mode === "applied" && receipt ? <div className={styles.bar} role="status">
                  <Check className={cx(styles.barIcon, styles.ok)} aria-hidden="true" />
                  <span className={styles.barLabel}>{receipt.applied ? `Applied ${receipt.applied} of ${receipt.total}` : "Kept the original"}</span>
                  {receipt.applied ? <button type="button" className={styles.barButton} onClick={undo}><Undo2 aria-hidden="true" />Undo</button> : null}
                </div> : null}
              </motion.div>
            </AnimatePresence>
            </div>
          </motion.div> : null}
        </AnimatePresence>
      </div>
    </div>

    <footer className={styles.footer}>
      <span className={styles.hint}>{hint}</span>
      <span className={styles.count}><span className={styles.tabular}>{words}</span> words</span>
    </footer>
  </section>;
}

export default AiInlineEdit;
