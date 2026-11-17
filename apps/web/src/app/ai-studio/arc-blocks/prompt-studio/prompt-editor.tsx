"use client";

/*
 * A plain text prompt editor where {{variable}} placeholders render as atomic, tinted chips.
 *
 * The string is the model. Every edit is read from `beforeinput`, applied to the string, and the DOM is rebuilt from it with
 * the caret restored, so chips can never be split, styled text never sneaks in, and copy and paste round-trip the braces.
 * Typing {{ opens a list of the known variables; Enter or Tab inserts one as a chip, and typing a new name followed by }}
 * creates a variable. IME composition runs natively and is read back when it ends.
 */

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore, type ClipboardEvent, type DragEvent, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent } from "react";
import { createPortal } from "react-dom";
import { Plus } from "lucide-react";
import { normalizeTemplate, tokenize } from "./prompt-studio-data";
import styles from "./prompt-studio.module.css";

const ZW = "​";

/** A variable's color slot, 1 to 4, read by the stylesheet as --series-1 to --series-4. */
export type ToneOf = (name: string) => number;

/* ---------------------------------------------------------------------------------------------------------------
 * DOM and string mapping
 * ------------------------------------------------------------------------------------------------------------- */

function chipNode(name: string, tone: number) {
  const span = document.createElement("span");
  span.contentEditable = "false";
  span.dataset.var = name;
  span.dataset.tone = String(tone);
  span.className = styles.varChip;
  span.textContent = name;
  return span;
}

/** Rebuilds the editable from the string. A zero width space beside a chip at a line edge gives the caret somewhere to sit. */
function build(root: HTMLElement, value: string, toneOf: ToneOf) {
  const parts = tokenize(value);
  const nodes: Node[] = [];
  parts.forEach((part, i) => {
    if (part.type === "text") { nodes.push(document.createTextNode(part.text)); return; }
    const prev = parts[i - 1], next = parts[i + 1];
    if (!prev || (prev.type === "text" && prev.text.endsWith("\n"))) nodes.push(document.createTextNode(ZW));
    nodes.push(chipNode(part.name, toneOf(part.name)));
    if (!next || next.type === "var" || next.text.startsWith("\n")) nodes.push(document.createTextNode(ZW));
  });
  // A trailing newline only draws its empty line when something follows it.
  if (value.endsWith("\n")) { const br = document.createElement("br"); br.dataset.end = ""; nodes.push(br); }
  root.replaceChildren(...nodes);
}

function serialize(node: Node): string {
  let out = "";
  node.childNodes.forEach(child => {
    if (child.nodeType === Node.TEXT_NODE) out += (child.textContent ?? "").replaceAll(ZW, "");
    else if (child instanceof HTMLElement) {
      if (child.dataset.var !== undefined) out += `{{${child.dataset.var}}}`;
      else if (child.tagName === "BR") out += child.dataset.end !== undefined ? "" : "\n";
      else {
        if ((child.tagName === "DIV" || child.tagName === "P") && out && !out.endsWith("\n")) out += "\n";
        out += serialize(child);
      }
    }
  });
  return out;
}

function offsetOf(root: HTMLElement, node: Node, offset: number) {
  const range = document.createRange();
  range.setStart(root, 0);
  range.setEnd(node, offset);
  const holder = document.createElement("div");
  holder.appendChild(range.cloneContents());
  return serialize(holder).length;
}

function readSelection(root: HTMLElement): [number, number] | null {
  const selection = window.getSelection();
  if (!selection?.rangeCount) return null;
  const range = selection.getRangeAt(0);
  if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) return null;
  const start = offsetOf(root, range.startContainer, range.startOffset);
  return [start, range.collapsed ? start : offsetOf(root, range.endContainer, range.endOffset)];
}

function placeCaret(root: HTMLElement, offset: number) {
  const selection = window.getSelection();
  if (!selection) return;
  const range = document.createRange();
  let remaining = offset;
  let placed = false;
  for (const child of Array.from(root.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      const text = child.textContent ?? "";
      const length = text.replaceAll(ZW, "").length;
      if (remaining <= length) {
        let dom = 0, seen = 0;
        while (seen < remaining && dom < text.length) { if (text[dom] !== ZW) seen++; dom++; }
        if (length === 0) dom = text.length;
        range.setStart(child, dom);
        placed = true;
        break;
      }
      remaining -= length;
    } else if (child instanceof HTMLElement) {
      const length = child.dataset.var !== undefined ? child.dataset.var.length + 4 : child.tagName === "BR" && child.dataset.end === undefined ? 1 : 0;
      if (remaining < length) { range.setStartAfter(child); placed = true; break; }
      remaining -= length;
    }
  }
  if (!placed) {
    const last = root.lastChild;
    if (last instanceof HTMLElement && last.dataset.end !== undefined) range.setStartBefore(last);
    else range.setStart(root, root.childNodes.length);
  }
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

/* ---------------------------------------------------------------------------------------------------------------
 * Deletion targets that treat a placeholder as one character
 * ------------------------------------------------------------------------------------------------------------- */

const varEndingAt = (value: string, at: number) => tokenize(value).find(p => p.type === "var" && p.end === at);
const varStartingAt = (value: string, at: number) => tokenize(value).find(p => p.type === "var" && p.start === at);

function back(value: string, at: number) {
  const token = varEndingAt(value, at);
  if (token) return token.start;
  const code = value.charCodeAt(at - 1);
  return Math.max(0, at - (code >= 0xdc00 && code <= 0xdfff ? 2 : 1));
}
function forward(value: string, at: number) {
  const token = varStartingAt(value, at);
  if (token && token.type === "var") return token.end;
  const code = value.charCodeAt(at);
  return Math.min(value.length, at + (code >= 0xd800 && code <= 0xdbff ? 2 : 1));
}
function wordBack(value: string, at: number) {
  const token = varEndingAt(value, at);
  if (token) return token.start;
  let i = at;
  while (i > 0 && /\s/.test(value[i - 1]) && value[i - 1] !== "\n") i--;
  if (i === at && value[i - 1] === "\n") return i - 1;
  while (i > 0 && !/\s/.test(value[i - 1]) && !varEndingAt(value, i)) i--;
  return i;
}
function wordForward(value: string, at: number) {
  const token = varStartingAt(value, at);
  if (token && token.type === "var") return token.end;
  let i = at;
  while (i < value.length && /\s/.test(value[i]) && value[i] !== "\n") i++;
  if (i === at && value[i] === "\n") return i + 1;
  while (i < value.length && !/\s/.test(value[i]) && !varStartingAt(value, i)) i++;
  return i;
}

/* ---------------------------------------------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------------------------------------------- */

type Suggest = { start: number; query: string; active: number; top: number; left: number };
type Snapshot = { value: string; caret: number };

export interface PromptEditorProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  /** Variables offered after typing {{. */
  variables: string[];
  /** Color slot (1 to 4) for each variable. */
  toneOf: ToneOf;
  /** Variables without a value; their chips draw a dashed outline. */
  missing?: string[];
  /** A variable to light up, for example while its value field has focus. */
  activeVariable?: string | null;
  /** Flashes every chip of a variable once, for example when its value changes. Pass a new `at` to flash again. */
  flash?: { name: string; at: number } | null;
  /** Clicking a chip calls this with its name. */
  onChipClick?: (name: string) => void;
  /** Called on Mod+Enter. */
  onSubmit?: () => void;
  placeholder?: string;
  label: string;
  describedBy?: string;
  /** Hidden editors (an inactive tab) skip focus and keep their content. */
  inert?: boolean;
}

const OPTION_HEIGHT = 34;
const noop = () => () => {};

/** Matching variables for a query, plus an "Add" row for a new, valid name. */
function optionsFor(query: string, variables: string[]) {
  const q = query.toLowerCase();
  const list = variables.filter(name => name.toLowerCase().includes(q)).slice(0, 6).map(name => ({ name, create: false }));
  if (query && /^[A-Za-z_]\w*$/.test(query) && !variables.includes(query)) list.push({ name: query, create: true });
  return list;
}

export function PromptEditor({ id, value, onChange, variables, toneOf, missing, activeVariable, flash, onChipClick, onSubmit, placeholder, label, describedBy, inert }: PromptEditorProps) {
  const listId = useId();
  const root = useRef<HTMLDivElement>(null);
  const model = useRef<string | null>(null);
  const composing = useRef(false);
  const history = useRef<{ past: Snapshot[]; future: Snapshot[]; lastAt: number; lastKind: string }>({ past: [], future: [], lastAt: 0, lastKind: "" });
  const dismissed = useRef<number | null>(null);
  const [suggest, setSuggest] = useState<Suggest | null>(null);
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  const suggestRef = useRef(suggest);
  const variablesRef = useRef(variables);
  const onChangeRef = useRef(onChange);
  const toneRef = useRef(toneOf);
  useLayoutEffect(() => {
    suggestRef.current = suggest;
    variablesRef.current = variables;
    onChangeRef.current = onChange;
    toneRef.current = toneOf;
  });
  const tone = useCallback((name: string) => toneRef.current(name), []);

  // External values (a test reset, an undo from outside) rebuild the DOM; the editor's own edits are already in it.
  useLayoutEffect(() => {
    const node = root.current;
    if (!node || model.current === value) return;
    const focused = document.activeElement === node;
    const caret = focused ? readSelection(node)?.[0] ?? value.length : 0;
    model.current = value;
    build(node, value, tone);
    history.current = { past: [], future: [], lastAt: 0, lastKind: "" };
    if (focused) placeCaret(node, Math.min(caret, value.length));
  }, [value, tone]);

  // Chip states follow props without a rebuild.
  useLayoutEffect(() => {
    root.current?.querySelectorAll<HTMLElement>("[data-var]").forEach(chip => {
      const name = chip.dataset.var ?? "";
      chip.dataset.tone = String(toneOf(name));
      chip.toggleAttribute("data-missing", Boolean(missing?.includes(name)));
      chip.toggleAttribute("data-active", activeVariable === name);
    });
  });

  // A changed value flashes its chips once. The attribute is cleared and set again so the keyframes restart per keystroke.
  useEffect(() => {
    if (!flash) return;
    const chips = root.current?.querySelectorAll<HTMLElement>(`[data-var="${CSS.escape(flash.name)}"]`);
    chips?.forEach(chip => {
      chip.removeAttribute("data-flash");
      void chip.offsetWidth;
      chip.setAttribute("data-flash", "");
    });
  }, [flash]);

  const options = useCallback((query: string) => optionsFor(query, variablesRef.current), []);

  /** Opens, moves or closes the {{ list for the caret position. */
  const updateSuggest = useCallback((text: string, caret: number) => {
    const node = root.current;
    const match = /\{\{\s*([A-Za-z_]\w*)?$/.exec(text.slice(0, caret));
    if (!node || !match || dismissed.current === match.index) { setSuggest(null); return; }
    const selection = window.getSelection();
    const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
    const rects = range?.getClientRects();
    const rect = rects?.length ? rects[rects.length - 1] : (range?.startContainer instanceof Element ? range.startContainer : range?.startContainer.parentElement)?.getBoundingClientRect();
    if (!rect) { setSuggest(null); return; }
    const query = match[1] ?? "";
    const count = Math.max(1, options(query).length);
    const height = count * OPTION_HEIGHT + 10;
    const above = rect.bottom + 6 + height > window.innerHeight - 8 && rect.top - 6 - height > 8;
    const width = Math.min(240, window.innerWidth - 16);
    setSuggest(previous => ({
      start: match.index, query,
      active: previous && previous.start === match.index ? Math.min(previous.active, count - 1) : 0,
      top: above ? rect.top - 6 - height : rect.bottom + 6,
      left: Math.max(8, Math.min(rect.left - 10, window.innerWidth - width - 8)),
    }));
  }, [options]);

  const commit = useCallback((next: string, caret: number, kind: string) => {
    const node = root.current;
    if (!node) return;
    const before = model.current ?? "";
    const normalized = normalizeTemplate(next);
    const at = normalizeTemplate(next.slice(0, caret)).length;
    const h = history.current;
    const now = performance.now();
    // Typing within a short window is one undo step; anything else starts a new one.
    if (!(kind === "type" && h.lastKind === "type" && now - h.lastAt < 900)) h.past.push({ value: before, caret: readSelection(node)?.[0] ?? at });
    if (h.past.length > 200) h.past.shift();
    h.future = [];
    h.lastAt = now;
    h.lastKind = kind;
    model.current = normalized;
    build(node, normalized, tone);
    placeCaret(node, at);
    onChangeRef.current(normalized);
    updateSuggest(normalized, at);
  }, [updateSuggest, tone]);

  const restore = useCallback((direction: "undo" | "redo") => {
    const node = root.current;
    const h = history.current;
    const from = direction === "undo" ? h.past : h.future;
    const to = direction === "undo" ? h.future : h.past;
    const snapshot = from.pop();
    if (!node || !snapshot) return;
    to.push({ value: model.current ?? "", caret: readSelection(node)?.[0] ?? 0 });
    h.lastKind = "";
    model.current = snapshot.value;
    build(node, snapshot.value, tone);
    placeCaret(node, snapshot.caret);
    onChangeRef.current(snapshot.value);
    setSuggest(null);
  }, [tone]);

  const replaceSelection = useCallback((text: string, kind: string) => {
    const node = root.current;
    const range = node && readSelection(node);
    if (!node || !range) return;
    const current = model.current ?? "";
    commit(current.slice(0, range[0]) + text + current.slice(range[1]), range[0] + text.length, kind);
  }, [commit]);

  // Every edit goes through beforeinput, so the DOM never holds anything the string cannot describe.
  useEffect(() => {
    const node = root.current;
    if (!node) return;
    const onBeforeInput = (event: InputEvent) => {
      if (event.isComposing || event.inputType === "insertCompositionText") return;
      const range = readSelection(node);
      if (!range) return;
      const current = model.current ?? "";
      let [start, end] = range;
      let insert = "";
      let kind = "edit";
      switch (event.inputType) {
        case "insertText": case "insertReplacementText":
          insert = event.data ?? event.dataTransfer?.getData("text/plain") ?? "";
          kind = /\s/.test(insert) ? "space" : "type";
          dismissed.current = null;
          break;
        case "insertLineBreak": case "insertParagraph": insert = "\n"; break;
        case "insertFromPaste": case "insertFromDrop": case "insertFromYank": insert = event.dataTransfer?.getData("text/plain") ?? ""; break;
        case "deleteContentBackward": if (start === end) start = back(current, start); kind = "delete"; break;
        case "deleteContentForward": if (start === end) end = forward(current, end); kind = "delete"; break;
        case "deleteWordBackward": if (start === end) start = wordBack(current, start); break;
        case "deleteWordForward": if (start === end) end = wordForward(current, end); break;
        case "deleteSoftLineBackward": case "deleteHardLineBackward":
          if (start === end) start = start > 0 && current[start - 1] === "\n" ? start - 1 : current.lastIndexOf("\n", start - 1) + 1;
          break;
        case "deleteSoftLineForward": case "deleteHardLineForward": {
          if (start !== end) break;
          const lineEnd = current.indexOf("\n", end);
          end = lineEnd === -1 ? current.length : lineEnd === end ? end + 1 : lineEnd;
          break;
        }
        case "deleteByCut": case "deleteByDrag": case "deleteContent": break;
        case "historyUndo": event.preventDefault(); restore("undo"); return;
        case "historyRedo": event.preventDefault(); restore("redo"); return;
        default: event.preventDefault(); return;
      }
      event.preventDefault();
      if (start === end && !insert) return;
      commit(current.slice(0, start) + insert + current.slice(end), start + insert.length, kind);
    };
    // Composition and anything the browser did on its own are read back from the DOM.
    const onInput = () => {
      if (composing.current) return;
      const next = serialize(node);
      if (next === model.current) return;
      const caret = readSelection(node)?.[0] ?? next.length;
      commit(next, caret, "edit");
    };
    const onCompositionStart = () => { composing.current = true; };
    const onCompositionEnd = () => { composing.current = false; onInput(); };
    node.addEventListener("beforeinput", onBeforeInput);
    node.addEventListener("input", onInput);
    node.addEventListener("compositionstart", onCompositionStart);
    node.addEventListener("compositionend", onCompositionEnd);
    return () => {
      node.removeEventListener("beforeinput", onBeforeInput);
      node.removeEventListener("input", onInput);
      node.removeEventListener("compositionstart", onCompositionStart);
      node.removeEventListener("compositionend", onCompositionEnd);
    };
  }, [commit, restore]);

  // The list follows the caret: moving away from the {{ closes it, scrolling the page moves it.
  useEffect(() => {
    if (!suggest) return;
    const node = root.current;
    const sync = () => {
      if (!node || document.activeElement !== node) { setSuggest(null); return; }
      const caret = readSelection(node)?.[0];
      if (caret === undefined) setSuggest(null);
      else updateSuggest(model.current ?? "", caret);
    };
    document.addEventListener("selectionchange", sync);
    window.addEventListener("scroll", sync, true);
    window.addEventListener("resize", sync);
    return () => {
      document.removeEventListener("selectionchange", sync);
      window.removeEventListener("scroll", sync, true);
      window.removeEventListener("resize", sync);
    };
  }, [suggest, updateSuggest]);

  const choose = useCallback((name: string) => {
    const node = root.current;
    const open = suggestRef.current;
    const caret = node && readSelection(node)?.[0];
    if (!node || !open || caret == null) return;
    const current = model.current ?? "";
    // Swallow closing braces the person already typed after the caret.
    const tail = /^\s*\}\}/.exec(current.slice(caret))?.[0].length ?? 0;
    const insert = `{{${name}}}`;
    commit(current.slice(0, open.start) + insert + current.slice(caret + tail), open.start + insert.length, "edit");
    setSuggest(null);
  }, [commit]);

  function onKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    const mod = event.metaKey || event.ctrlKey;
    if (mod && event.key === "Enter") { event.preventDefault(); setSuggest(null); onSubmit?.(); return; }
    if (mod && !event.altKey && event.key.toLowerCase() === "z") { event.preventDefault(); restore(event.shiftKey ? "redo" : "undo"); return; }
    if (mod && !event.altKey && event.key.toLowerCase() === "y") { event.preventDefault(); restore("redo"); return; }
    if (mod && ["b", "i", "u"].includes(event.key.toLowerCase())) { event.preventDefault(); return; }
    const open = suggestRef.current;
    if (!open) return;
    const list = options(open.query);
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!list.length) return;
      const step = event.key === "ArrowDown" ? 1 : -1;
      setSuggest({ ...open, active: (open.active + step + list.length) % list.length });
    } else if ((event.key === "Enter" || event.key === "Tab") && list.length) {
      event.preventDefault();
      choose(list[open.active]?.name ?? list[0].name);
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      dismissed.current = open.start;
      setSuggest(null);
    }
  }

  function onCopy(event: ClipboardEvent<HTMLDivElement>, cut = false) {
    const node = root.current;
    const range = node && readSelection(node);
    if (!node || !range || range[0] === range[1]) return;
    event.preventDefault();
    event.clipboardData.setData("text/plain", (model.current ?? "").slice(range[0], range[1]));
    if (cut) replaceSelection("", "edit");
  }

  function onPaste(event: ClipboardEvent<HTMLDivElement>) {
    event.preventDefault();
    replaceSelection(event.clipboardData.getData("text/plain").replace(/\r\n?/g, "\n"), "edit");
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    // Drops from outside arrive as plain text at the caret; dragging chips around inside is not supported.
    event.preventDefault();
    const text = event.dataTransfer.getData("text/plain");
    if (text) replaceSelection(text, "edit");
  }

  function onClick(event: ReactMouseEvent<HTMLDivElement>) {
    const chip = (event.target as HTMLElement).closest<HTMLElement>("[data-var]");
    if (chip?.dataset.var) onChipClick?.(chip.dataset.var);
  }

  const list = suggest ? optionsFor(suggest.query, variables) : [];
  const activeId = suggest && list.length ? `${listId}-${suggest.active}` : undefined;

  return <>
    <div
      ref={root}
      id={id}
      className={styles.editable}
      contentEditable={!inert}
      suppressContentEditableWarning
      role="textbox"
      aria-multiline="true"
      aria-label={label}
      aria-describedby={describedBy}
      aria-autocomplete="list"
      aria-controls={suggest ? listId : undefined}
      aria-activedescendant={activeId}
      tabIndex={inert ? -1 : 0}
      spellCheck={false}
      data-empty={value === "" || undefined}
      data-placeholder={placeholder}
      onKeyDown={onKeyDown}
      onCopy={event => onCopy(event)}
      onCut={event => onCopy(event, true)}
      onPaste={onPaste}
      onDrop={onDrop}
      onClick={onClick}
      onBlur={() => setSuggest(null)}
    />
    {mounted && suggest && createPortal(
      <div className={styles.suggest} style={{ top: suggest.top, left: suggest.left }}>
        <ul id={listId} role="listbox" aria-label="Variables" className={styles.suggestList}>
          {list.length ? list.map((option, index) => <li key={`${option.name}-${option.create}`} id={`${listId}-${index}`} role="option" aria-selected={index === suggest.active}
            className={styles.suggestOption} data-tone={option.create ? undefined : toneOf(option.name)}
            onPointerDown={event => { event.preventDefault(); choose(option.name); }}
            onPointerMove={() => { if (index !== suggest.active) setSuggest({ ...suggest, active: index }); }}>
            {option.create ? <Plus className={styles.suggestIcon} aria-hidden="true" /> : <span className={styles.suggestDot} aria-hidden="true" />}
            <span className={styles.suggestName}>{option.create ? <>Add <span className={styles.suggestNew}>{option.name}</span></> : option.name}</span>
          </li>) : <li className={styles.suggestEmpty} role="presentation">Type a name, then close with {"}}"}</li>}
        </ul>
      </div>,
      document.body,
    )}
  </>;
}
