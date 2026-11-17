"use client";

import { forwardRef, useCallback, useEffect, useId, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, type ChangeEvent, type ClipboardEvent, type KeyboardEvent as ReactKeyboardEvent, type ReactNode, type RefObject } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, FileText, Languages, Lightbulb, Mic, Wrench, X } from "lucide-react";
import { motionTokens } from "@/shared/arc/lib/motion-tokens";
import { Tooltip } from "@/shared/arc/tooltip/tooltip";
import { TextShimmer } from "@/shared/arc/text-shimmer/text-shimmer";
import { contextItems, dictationSentence, slashCommands, type ComposerModel, type ContextItem, type Effort, type SlashCommand } from "./composer-data";
import { AttachMenu, AttachmentChip, ContextGlyph, Elapsed, LimitCounter, ModelMenu, SendButton, ToolChip, Waveform, cx, fileKind, formatBytes, type ComposerAttachment, type SendState } from "./composer-parts";
import styles from "./ai-composer.module.css";

const { spring, duration, ease } = motionTokens;

/** Moves, resizes and swaps settle without overshoot, so nothing wobbles. */
const settle = { type: "spring", visualDuration: 0.24, bounce: 0 } as const;
/** Single line height plus padding, and the most the field grows before it scrolls. */
const MIN_FIELD = 40;
const MAX_FIELD = 208;
const MAX_UPLOAD = 30 * 1024 * 1024;
/** Pastes with at least this many lines, or this many characters, become an attachment. */
const PASTE_LINES = 12;
const PASTE_CHARS = 1200;
const SPEECH_MS = 4200;

export interface ComposerDraft { text: string; tokens: string[]; attachments: ComposerAttachment[] }
export interface ComposerHandle {
  focus: () => void;
  /** Replace the text, keeping any known command or mention as a token. */
  fill: (text: string) => void;
  addFiles: (files: File[]) => void;
}

export interface ComposerProps {
  models: ComposerModel[];
  model: ComposerModel;
  effort: Effort;
  webSearch: boolean;
  thinking: boolean;
  onModel: (id: string) => void;
  onEffort: (effort: Effort) => void;
  onTool: (tool: "search" | "thinking") => void;
  busy: boolean;
  progress: number | null;
  progressSeconds: number;
  /** Changes with every reply, so the send ring starts empty each time. */
  run: number;
  placeholder: string;
  maxLength: number;
  reduced: boolean;
  onSubmit: (draft: ComposerDraft) => void;
  onStop: () => void;
  announce: (message: string) => void;
}

type Range = { start: number; end: number; text: string };
type Trigger = { type: "/" | "@"; start: number; query: string };
type Option = { id: string; group?: string; command?: SlashCommand; context?: ContextItem };

const knownTokens = [...slashCommands.map(c => c.label), ...contextItems.map(c => `@${c.label}`)];
const commandIcon: Record<string, typeof FileText> = { summarize: FileText, translate: Languages, explain: Lightbulb, fix: Wrench };

/** Where each token sits in the text. A token only counts on word boundaries, so editing one turns it back into plain text. */
export function tokenRanges(text: string, tokens: string[]): Range[] {
  const ranges: Range[] = [];
  for (const token of [...new Set(tokens)].sort((a, b) => b.length - a.length)) {
    let from = 0;
    for (;;) {
      const at = text.indexOf(token, from);
      if (at < 0) break;
      const end = at + token.length;
      const open = at === 0 || /\s/.test(text[at - 1] ?? "");
      const close = end === text.length || /[\s.,;:!?)]/.test(text[end] ?? "");
      if (open && close && !ranges.some(r => at < r.end && end > r.start)) ranges.push({ start: at, end, text: token });
      from = end;
    }
  }
  return ranges.sort((a, b) => a.start - b.start);
}

/** "/" at the start of a line, or "@" after a space, followed by the word being typed. */
function findTrigger(text: string, caret: number, ranges: Range[]): Trigger | null {
  if (ranges.some(r => caret > r.start && caret <= r.end)) return null;
  let i = caret - 1;
  while (i >= 0 && !/\s/.test(text[i] ?? "") && text[i] !== "@" && text[i] !== "/") i -= 1;
  const char = text[i];
  if (i < 0 || (char !== "@" && char !== "/")) return null;
  const before = i === 0 ? "" : text[i - 1] ?? "";
  if (before && !/\s/.test(before)) return null;
  if (char === "/" && before && before !== "\n") return null;
  const query = text.slice(i + 1, caret);
  if (query.length > 24) return null;
  return { type: char, start: i, query };
}

function optionsFor(trigger: Trigger | null): Option[] {
  if (!trigger) return [];
  const q = trigger.query.toLowerCase();
  if (trigger.type === "/") return slashCommands.filter(c => c.id.startsWith(q)).map(c => ({ id: c.id, command: c }));
  return contextItems.filter(c => c.label.toLowerCase().includes(q) || c.meta.toLowerCase().includes(q)).map(c => ({ id: c.id, group: c.group, context: c }));
}

/** The text drawn under the transparent textarea: tokens as marks, plus an empty anchor where the popover attaches. */
function Mirror({ text, placeholder, ranges, anchor, anchorRef }: { text: string; placeholder: string; ranges: Range[]; anchor: number | null; anchorRef: RefObject<HTMLSpanElement | null> }) {
  // Empty, the mirror carries the placeholder invisibly, so a placeholder that wraps on a phone still gets its lines.
  if (!text) return <span className={styles.mirrorPlaceholder}>{placeholder}</span>;
  const nodes: ReactNode[] = [];
  let pos = 0;
  const plain = (to: number) => {
    if (to <= pos) return;
    if (anchor !== null && anchor >= pos && anchor < to) {
      nodes.push(text.slice(pos, anchor), <span key="anchor" ref={anchorRef} />, text.slice(anchor, to));
    } else nodes.push(text.slice(pos, to));
    pos = to;
  };
  for (const range of ranges) {
    plain(range.start);
    nodes.push(<mark key={range.start} className={styles.token} data-kind={range.text.startsWith("/") ? "command" : "mention"}>{range.text}</mark>);
    pos = range.end;
  }
  plain(text.length);
  return <>{nodes}{"\u200b"}</>;
}

/* A small hand-drawn interface, standing in for a captured screenshot. */
const screenshotThumb = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><rect width="96" height="96" fill="#f4f4f5"/><rect x="0" y="0" width="96" height="12" fill="#e4e4e7"/><circle cx="7" cy="6" r="2" fill="#d4d4d8"/><circle cx="13" cy="6" r="2" fill="#d4d4d8"/><rect x="0" y="12" width="22" height="84" fill="#fafafa"/><rect x="5" y="20" width="12" height="3" rx="1.5" fill="#d4d4d8"/><rect x="5" y="28" width="12" height="3" rx="1.5" fill="#d4d4d8"/><rect x="5" y="36" width="12" height="3" rx="1.5" fill="#d4d4d8"/><rect x="30" y="20" width="40" height="5" rx="2.5" fill="#a1a1aa"/><rect x="30" y="32" width="58" height="26" rx="4" fill="#ffffff"/><rect x="35" y="46" width="6" height="8" rx="1" fill="#71717a"/><rect x="44" y="41" width="6" height="13" rx="1" fill="#71717a"/><rect x="53" y="44" width="6" height="10" rx="1" fill="#71717a"/><rect x="62" y="37" width="6" height="17" rx="1" fill="#3f3f46"/><rect x="71" y="43" width="6" height="11" rx="1" fill="#71717a"/><rect x="30" y="64" width="27" height="22" rx="4" fill="#ffffff"/><rect x="61" y="64" width="27" height="22" rx="4" fill="#ffffff"/></svg>`)}`;

let uid = 0;
const nextId = () => `att-${Date.now().toString(36)}-${(uid += 1)}`;

export const Composer = forwardRef<ComposerHandle, ComposerProps>(function Composer(props, ref) {
  const { models, model, effort, webSearch, thinking, onModel, onEffort, onTool, busy, progress, progressSeconds, run, placeholder, maxLength, reduced, onSubmit, onStop, announce } = props;
  const [text, setText] = useState("");
  const [tokens, setTokens] = useState<string[]>([]);
  const [caret, setCaret] = useState(0);
  const [focused, setFocused] = useState(false);
  const [dismissed, setDismissed] = useState<number | null>(null);
  const [highlight, setHighlight] = useState({ key: "", index: 0 });
  const [attachments, setAttachments] = useState<ComposerAttachment[]>([]);
  const [dictation, setDictation] = useState<{ startedAt: number; phase: "listening" | "transcribing" } | null>(null);
  const [fieldHeight, setFieldHeight] = useState(MIN_FIELD);
  const [popPos, setPopPos] = useState<{ left: number; bottom: number } | null>(null);

  const surfaceRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const mirrorRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLSpanElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const lastCaret = useRef(0);
  const caretBeforeDictation = useRef<number | null>(null);
  const urls = useRef(new Set<string>());

  const popId = useId();
  const hintId = useId();
  const ranges = useMemo(() => tokenRanges(text, tokens), [text, tokens]);
  const rawTrigger = useMemo(() => (focused && !dictation ? findTrigger(text, caret, ranges) : null), [focused, dictation, text, caret, ranges]);
  const trigger = rawTrigger && rawTrigger.start !== dismissed ? rawTrigger : null;
  const options = useMemo(() => optionsFor(trigger), [trigger]);
  const popOpen = Boolean(trigger && (options.length || trigger.type === "@"));
  // The highlight belongs to one query; a new query starts again at the first option.
  const queryKey = trigger ? `${trigger.type}${trigger.start}${trigger.query}` : "";
  const activeIndex = Math.min(highlight.key === queryKey ? highlight.index : 0, Math.max(0, options.length - 1));
  const setActive = (index: number) => setHighlight({ key: queryKey, index });
  const activeOption = popOpen ? options[activeIndex] : undefined;

  /* Field height follows the mirror, so the textarea grows line by line on a short transition instead of jumping. */
  useLayoutEffect(() => {
    const node = mirrorRef.current;
    if (!node) return;
    const observer = new ResizeObserver(() => setFieldHeight(Math.min(MAX_FIELD, Math.max(MIN_FIELD, Math.ceil(node.offsetHeight)))));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  /* The popover sits above the line being typed and starts near the trigger character. */
  useLayoutEffect(() => {
    if (!popOpen) return;
    const anchor = anchorRef.current;
    const surface = surfaceRef.current;
    if (!anchor || !surface) return;
    const a = anchor.getBoundingClientRect();
    const s = surface.getBoundingClientRect();
    const width = Math.min(300, s.width - 12);
    const left = Math.max(6, Math.min(a.left - s.left - 12, s.width - width - 6));
    setPopPos(current => (current && current.left === left && current.bottom === s.bottom - a.top + 8 ? current : { left, bottom: s.bottom - a.top + 8 }));
  }, [popOpen, trigger?.start, text, fieldHeight]);

  /* Upload simulation: every pending file fills its ring, shows a check, then hands over to the remove control. */
  const uploading = attachments.some(a => a.status === "uploading");
  useEffect(() => {
    if (!uploading) return;
    const id = window.setInterval(() => {
      setAttachments(list => list.map(item => {
        if (item.status !== "uploading") return item;
        const span = 700 + Math.min(1800, item.size / 6000);
        const progress = Math.min(1, item.progress + 60 / span);
        return progress >= 1 ? { ...item, progress: 1, status: "done" } : { ...item, progress };
      }));
    }, 60);
    return () => window.clearInterval(id);
  }, [uploading]);
  const settling = attachments.filter(a => a.status === "done").map(a => a.id).join(",");
  useEffect(() => {
    if (!settling) return;
    const ids = settling.split(",");
    const names = attachments.filter(a => ids.includes(a.id)).map(a => a.name);
    announce(names.length === 1 ? `${names[0]} uploaded` : `${names.length} files uploaded`);
    const id = window.setTimeout(() => setAttachments(list => list.map(a => (ids.includes(a.id) && a.status === "done" ? { ...a, status: "ready" } : a))), 900);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once per batch of finished uploads
  }, [settling]);

  useEffect(() => {
    const created = urls.current;
    return () => { created.forEach(url => URL.revokeObjectURL(url)); };
  }, []);

  const focusInput = useCallback((at?: number) => {
    const el = inputRef.current;
    if (!el) return;
    el.focus({ preventScroll: true });
    if (at !== undefined) { el.setSelectionRange(at, at); lastCaret.current = at; setCaret(at); }
  }, []);

  /** Replace part of the text through the browser's editing commands, so undo keeps working, with a state fallback. */
  const replace = useCallback((start: number, end: number, insert: string) => {
    const el = inputRef.current;
    if (!el) return;
    el.focus({ preventScroll: true });
    el.setSelectionRange(start, end);
    const ok = insert ? document.execCommand("insertText", false, insert) : document.execCommand("delete");
    if (!ok) {
      const next = el.value.slice(0, start) + insert + el.value.slice(end);
      setText(next);
      requestAnimationFrame(() => focusInput(start + insert.length));
    }
    const at = start + insert.length;
    lastCaret.current = at;
    setCaret(at);
  }, [focusInput]);

  const addAttachments = useCallback((items: ComposerAttachment[]) => {
    if (!items.length) return;
    setAttachments(list => [...list, ...items]);
    const failed = items.filter(i => i.status === "error");
    if (failed.length) announce(`${failed.map(f => f.name).join(", ")} is over the 30 MB limit`);
    else announce(items.length === 1 ? `Uploading ${items[0]?.name}` : `Uploading ${items.length} files`);
  }, [announce]);

  const addFiles = useCallback((files: File[]) => {
    addAttachments(files.map(file => {
      const kind = fileKind(file.name, file.type);
      const thumb = kind === "image" ? URL.createObjectURL(file) : undefined;
      if (thumb) urls.current.add(thumb);
      const tooBig = file.size > MAX_UPLOAD;
      const ext = file.name.includes(".") ? file.name.split(".").pop()?.toUpperCase() : undefined;
      return {
        id: nextId(), source: "file", kind, name: file.name || "Pasted image", size: file.size, file, thumb,
        meta: `${kind === "image" ? "Image" : ext ?? "File"}, ${formatBytes(file.size)}`,
        status: tooBig ? "error" : "uploading", progress: 0, error: tooBig ? "Over 30 MB" : undefined,
      } satisfies ComposerAttachment;
    }));
  }, [addAttachments]);

  const fill = useCallback((value: string) => {
    setTokens(knownTokens.filter(t => value.includes(t)));
    const el = inputRef.current;
    if (!el) return;
    replace(0, el.value.length, value);
    if (el.value !== value) setText(value);
  }, [replace]);

  useImperativeHandle(ref, () => ({ focus: () => focusInput(), fill, addFiles }), [focusInput, fill, addFiles]);

  /* ----- Text editing ----- */

  function syncCaret(el: HTMLTextAreaElement) {
    const start = el.selectionStart;
    const end = el.selectionEnd;
    if (start === end) {
      // The caret never rests inside a token: arrows hop over it, a click lands on the nearer edge.
      const inside = ranges.find(r => start > r.start && start < r.end);
      if (inside) {
        const step = Math.abs(start - lastCaret.current) <= 1;
        const to = step ? (start > lastCaret.current ? inside.end : inside.start) : (start - inside.start < inside.end - start ? inside.start : inside.end);
        el.setSelectionRange(to, to);
        lastCaret.current = to;
        setCaret(to);
        return;
      }
    }
    lastCaret.current = start;
    setCaret(start);
  }

  function onChange(event: ChangeEvent<HTMLTextAreaElement>) {
    const value = event.target.value;
    const at = event.target.selectionStart;
    setText(value);
    setTokens(list => list.filter(token => tokenRanges(value, [token]).length));
    // A dismissed popover stays closed only until its trigger is gone.
    if (dismissed !== null && !findTrigger(value, at, tokenRanges(value, tokens))) setDismissed(null);
    lastCaret.current = at;
    setCaret(at);
  }

  function pick(option: Option) {
    if (!trigger) return;
    const token = option.command ? option.command.label : `@${option.context?.label ?? ""}`;
    setTokens(list => [...list, token]);
    replace(trigger.start, caret, `${token} `);
    announce(option.command ? `${token} command added` : `${option.context?.label} added as context`);
  }

  const hasText = text.trim().length > 0;
  const usable = attachments.filter(a => a.status !== "error");
  const over = text.length > maxLength;
  const sendState: SendState = busy ? "generating" : !hasText && !usable.length ? "empty" : uploading || over || dictation ? "blocked" : "ready";
  const sendLabel = sendState === "generating" ? "Stop generating" : sendState === "empty" ? "Send message" : uploading ? "Send, after uploads finish" : over ? "Send, message is over the limit" : "Send message";

  function submit() {
    if (sendState !== "ready") return;
    const cleanTokens = tokenRanges(text, tokens).map(r => r.text);
    onSubmit({ text: text.trim(), tokens: [...new Set(cleanTokens)], attachments: usable });
    setText("");
    setTokens([]);
    setAttachments([]);
    setCaret(0);
    lastCaret.current = 0;
  }

  function onKeyDown(event: ReactKeyboardEvent<HTMLTextAreaElement>) {
    const el = event.currentTarget;
    if (popOpen && trigger) {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        if (options.length) setActive((activeIndex + (event.key === "ArrowDown" ? 1 : -1) + options.length) % options.length);
        return;
      }
      if ((event.key === "Enter" || event.key === "Tab") && !event.shiftKey && activeOption) { event.preventDefault(); pick(activeOption); return; }
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); setDismissed(trigger.start); return; }
    }
    if (event.key === "Escape") {
      if (dictation) { event.preventDefault(); cancelDictation(); return; }
      if (busy) { event.preventDefault(); onStop(); return; }
    }
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit();
      return;
    }
    const start = el.selectionStart;
    if (start !== el.selectionEnd) return;
    if (event.key === "Backspace") {
      const range = ranges.find(r => r.end === start);
      if (range) { event.preventDefault(); replace(range.start, range.end, ""); }
    } else if (event.key === "Delete") {
      const range = ranges.find(r => r.start === start);
      if (range) { event.preventDefault(); replace(range.start, range.end, ""); }
    }
  }

  function onPaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    const files = Array.from(event.clipboardData.files);
    if (files.length) { event.preventDefault(); addFiles(files); return; }
    const pasted = event.clipboardData.getData("text/plain");
    const lines = pasted.split(/\r\n|\r|\n/).length;
    if (lines < PASTE_LINES && pasted.length < PASTE_CHARS) return;
    event.preventDefault();
    const item: ComposerAttachment = { id: nextId(), source: "paste", kind: "text", name: "Pasted text", meta: `${lines} ${lines === 1 ? "line" : "lines"}`, size: pasted.length, status: "ready", progress: 1, text: pasted };
    setAttachments(list => [...list, item]);
    announce(`Long paste added as an attachment, ${lines} lines`);
  }

  /* ----- Attach menu actions (simulated where they would reach a service) ----- */

  const simulated = (item: Omit<ComposerAttachment, "id" | "status" | "progress">, message: string) => {
    setAttachments(list => [...list, { ...item, id: nextId(), status: "uploading", progress: 0 }]);
    announce(message);
  };
  const actions = {
    onUpload: () => fileRef.current?.click(),
    onDrive: () => simulated({ source: "drive", kind: "sheet", name: "Q4 pricing model", meta: "Google Sheets, 412 KB", size: 412_000 }, "Adding Q4 pricing model from Google Drive, simulated"),
    onGithub: () => simulated({ source: "github", kind: "code", name: "acme/storefront", meta: "main, 214 files", size: 2_400_000 }, "Adding acme/storefront from GitHub, simulated"),
    onScreenshot: () => {
      const stamp = "Screenshot 2026-10-20 at 14.32";
      simulated({ source: "screenshot", kind: "image", name: `${stamp}.png`, meta: "Image, 284 KB", size: 284_000, thumb: screenshotThumb }, "Screenshot captured, simulated");
    },
    onMention: () => {
      const el = inputRef.current;
      if (!el) return;
      const at = el.selectionStart ?? el.value.length;
      const needsSpace = at > 0 && !/\s/.test(el.value[at - 1] ?? "");
      requestAnimationFrame(() => replace(at, el.selectionEnd ?? at, needsSpace ? " @" : "@"));
    },
    onClosedAfterPick: () => focusInput(),
  };

  function removeAttachment(id: string) {
    setAttachments(list => {
      const item = list.find(a => a.id === id);
      if (item?.thumb?.startsWith("blob:")) { URL.revokeObjectURL(item.thumb); urls.current.delete(item.thumb); }
      if (item) announce(item.status === "uploading" ? `Upload of ${item.name} canceled` : `${item.name} removed`);
      return list.filter(a => a.id !== id);
    });
    focusInput();
  }

  /* ----- Dictation (simulated) ----- */

  function startDictation() {
    caretBeforeDictation.current = inputRef.current?.selectionStart ?? text.length;
    setDictation({ startedAt: Date.now(), phase: "listening" });
    announce("Listening. Dictation is simulated in this preview");
  }
  function cancelDictation() {
    setDictation(null);
    announce("Dictation canceled");
    focusInput();
  }
  const finishDictation = useCallback(() => {
    setDictation(current => (current && current.phase === "listening" ? { ...current, phase: "transcribing" } : current));
  }, []);

  useEffect(() => {
    if (!dictation) return;
    if (dictation.phase === "listening") {
      const id = window.setTimeout(finishDictation, SPEECH_MS + 1400);
      return () => window.clearTimeout(id);
    }
    const spoken = Math.min(1, (Date.now() - dictation.startedAt) / SPEECH_MS);
    const id = window.setTimeout(() => {
      const words = dictationSentence.split(" ");
      const count = spoken >= 1 ? words.length : Math.max(0, Math.round(words.length * spoken));
      const sentence = words.slice(0, count).join(" ");
      setDictation(null);
      if (!sentence) { announce("Nothing was heard"); focusInput(); return; }
      const el = inputRef.current;
      const at = Math.min(caretBeforeDictation.current ?? text.length, el?.value.length ?? 0);
      const before = el?.value.slice(0, at) ?? "";
      const lead = before && !/\s$/.test(before) ? " " : "";
      requestAnimationFrame(() => {
        replace(at, at, `${lead}${sentence}`);
        announce(`Inserted: ${sentence}`);
      });
    }, reduced ? 120 : 520);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- driven by the dictation phase only
  }, [dictation?.phase, dictation?.startedAt]);

  /* ----- Render ----- */

  const pressedFocus = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target === event.currentTarget || target.dataset.focusArea !== undefined) { event.preventDefault(); focusInput(); }
  };
  const nearLimit = text.length >= maxLength * .8;
  const limitState = over ? "over" : nearLimit ? "near" : "calm";
  useEffect(() => {
    if (limitState === "near") announce(`${(maxLength - text.length).toLocaleString("en-US")} characters left`);
    else if (limitState === "over") announce(`Over the ${maxLength.toLocaleString("en-US")} character limit. Shorten the message to send it`);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- announce when the limit state changes, not on every keystroke
  }, [limitState]);
  const groups = trigger?.type === "@" ? (["Files", "Docs"] as const).map(g => ({ name: g, items: options.filter(o => o.group === g) })).filter(g => g.items.length) : null;
  const optionId = (option: Option) => `${popId}-${option.id}`;

  const renderOption = (option: Option) => {
    const selected = option === activeOption;
    const Icon = option.command ? commandIcon[option.command.id] ?? FileText : null;
    return <div key={option.id} id={optionId(option)} role="option" aria-selected={selected} className={styles.option}
      onMouseDown={event => event.preventDefault()} onClick={() => pick(option)} onMouseMove={() => { if (!selected) setActive(options.indexOf(option)); }}>
      {Icon ? <Icon className={styles.optionGlyph} aria-hidden="true" /> : option.context ? <ContextGlyph kind={option.context.kind} /> : null}
      <span className={styles.optionText}>
        <span className={styles.optionLabel}>{option.command?.label ?? option.context?.label}</span>
        <span className={styles.optionHint}>{option.command?.hint ?? option.context?.meta}</span>
      </span>
    </div>;
  };

  return <div className={styles.composer}>
    <div ref={surfaceRef} className={styles.surface} data-focused={focused || undefined} onMouseDown={pressedFocus}>
      <AnimatePresence initial={false}>
        {attachments.length > 0 && <motion.div key="attachments" className={styles.attachmentsClip}
          initial={reduced ? { opacity: 0 } : { opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
          exit={reduced ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, height: 0 }} transition={reduced ? { duration: duration.fast } : spring.smooth}>
          <ul className={styles.attachments} aria-label="Attachments">
            <AnimatePresence initial={false} mode="popLayout">
              {attachments.map(item => <AttachmentChip key={item.id} item={item} reduced={reduced} onRemove={removeAttachment} />)}
            </AnimatePresence>
          </ul>
        </motion.div>}
      </AnimatePresence>

      <div className={styles.field} data-focus-area="" data-dictating={dictation ? "" : undefined}>
        <div ref={backdropRef} className={styles.backdrop} aria-hidden="true">
          <div ref={mirrorRef} className={styles.mirror}><Mirror text={text} placeholder={placeholder} ranges={ranges} anchor={popOpen ? trigger?.start ?? null : null} anchorRef={anchorRef} /></div>
        </div>
        <textarea ref={inputRef} className={styles.input} value={text} rows={1} placeholder={placeholder} aria-label="Message"
          aria-describedby={hintId} aria-controls={popOpen ? popId : undefined} aria-activedescendant={activeOption ? optionId(activeOption) : undefined}
          aria-autocomplete="list" readOnly={Boolean(dictation)} spellCheck
          style={{ height: fieldHeight, overflowY: fieldHeight >= MAX_FIELD ? "auto" : "hidden" }}
          onChange={onChange} onKeyDown={onKeyDown} onPaste={onPaste} onSelect={event => syncCaret(event.currentTarget)}
          onScroll={event => { if (backdropRef.current) backdropRef.current.scrollTop = event.currentTarget.scrollTop; }}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} />
        <span id={hintId} className={styles.srOnly}>Enter sends, Shift Enter adds a line. Type slash for commands and at for files and docs.</span>
        <AnimatePresence>
          {dictation && <motion.div key="dictation" className={styles.dictation}
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: { duration: duration.fast } }}
            transition={{ duration: duration.standard, ease: [...ease.enter] }}>
            <Tooltip content="Cancel dictation"><button type="button" className={styles.dictationButton} aria-label="Cancel dictation" onClick={cancelDictation}><X aria-hidden="true" /></button></Tooltip>
            {dictation.phase === "listening"
              ? <Waveform startedAt={dictation.startedAt} speechMs={SPEECH_MS} reduced={reduced} />
              : <span className={styles.transcribing}><TextShimmer>Transcribing</TextShimmer></span>}
            <Elapsed from={dictation.startedAt} />
            <Tooltip content="Insert the transcript"><button type="button" className={cx(styles.dictationButton, styles.dictationDone)} aria-label="Insert the transcript" onClick={finishDictation} disabled={dictation.phase !== "listening"}><Check aria-hidden="true" /></button></Tooltip>
          </motion.div>}
        </AnimatePresence>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.toolGroup}>
          <AttachMenu {...actions} />
          <ToolChip tool="search" on={webSearch} onToggle={() => onTool("search")} />
          <ToolChip tool="thinking" on={thinking} onToggle={() => onTool("thinking")} />
        </div>
        <div className={styles.toolGroup}>
          <AnimatePresence initial={false}>
            {nearLimit && <motion.span key="counter" className={styles.counterWrap}
              initial={reduced ? { opacity: 0 } : { opacity: 0, width: 0 }} animate={{ opacity: 1, width: "auto" }} exit={reduced ? { opacity: 0 } : { opacity: 0, width: 0 }}
              transition={reduced ? { duration: duration.fast } : settle}>
              <LimitCounter length={text.length} max={maxLength} />
            </motion.span>}
          </AnimatePresence>
          <ModelMenu models={models} model={model} effort={effort} reduced={reduced} onModel={onModel} onEffort={onEffort} />
          <Tooltip content={dictation ? "Insert the transcript" : "Dictate"}>
            <button type="button" className={styles.iconButton} aria-label={dictation ? "Stop dictation and insert" : "Dictate"} aria-pressed={Boolean(dictation)}
              data-live={dictation ? "" : undefined} onClick={() => (dictation ? finishDictation() : startDictation())} disabled={busy && !dictation}>
              <Mic aria-hidden="true" />
            </button>
          </Tooltip>
          <SendButton state={sendState} progress={progress} progressSeconds={progressSeconds} run={run} label={sendLabel} reduced={reduced} onSend={submit} onStop={onStop} />
        </div>
      </div>

      <AnimatePresence>
        {popOpen && popPos && trigger && <motion.div key={trigger.type} id={popId} role="listbox" aria-label={trigger.type === "/" ? "Commands" : "Files and docs"}
          className={styles.pop} style={{ left: popPos.left, bottom: popPos.bottom }}
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: 6, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={reduced ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, y: 4, scale: .99, transition: { duration: duration.instant } }}
          transition={reduced ? { duration: duration.instant } : settle}>
          {groups
            ? groups.length
              ? groups.map(group => <div key={group.name} role="group" aria-label={group.name}>
                  <div className={styles.popGroup} aria-hidden="true">{group.name}</div>
                  {group.items.map(renderOption)}
                </div>)
              : <div className={styles.popEmpty}>No files or docs match “{trigger.query}”</div>
            : options.map(renderOption)}
        </motion.div>}
      </AnimatePresence>
    </div>
    <input ref={fileRef} type="file" multiple hidden tabIndex={-1} onChange={event => { addFiles(Array.from(event.target.files ?? [])); event.target.value = ""; focusInput(); }} />
  </div>;
});
