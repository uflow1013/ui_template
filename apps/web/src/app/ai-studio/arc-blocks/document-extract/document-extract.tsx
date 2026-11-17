"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useReducer, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check, CircleAlert, CircleCheck, RotateCcw, ScanText, Square, TriangleAlert } from "lucide-react";
import { Button } from "@/shared/arc/button/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/arc/tabs/tabs";
import { CopyButton } from "@/shared/arc/copy-button/copy-button";
import { TextShimmer } from "@/shared/arc/text-shimmer/text-shimmer";
import { motionTokens } from "@/shared/arc/lib/motion-tokens";
import { createDemoExtract, fieldTones, haiku, kindOf, parseValue, sampleDocuments, toJsonSchema, type ExtractEvent, type ExtractFn, type ExtractModel, type ExtractSample, type ExtractSchema, type ExtractValue, type SchemaEntry, type SourceDocument } from "./document-extract-data";
import { FieldsForm, JsonView, needsCheck, type FieldState, type FormContext } from "./document-extract-fields";
import { DocumentViewer, type SpanLink } from "./document-extract-page";
import { ClaudeMark } from "./document-extract-marks";
import styles from "./document-extract.module.css";

export type { DocBlock, DocLogo, ExtractEvent, ExtractFn, ExtractModel, ExtractSample, ExtractSchema, ExtractValue, FieldType, Rich, SchemaEntry, SchemaField, SchemaGroup, SchemaTable, Segment, SourceDocument } from "./document-extract-data";
export type { FieldState } from "./document-extract-fields";
export { documentToText, invoiceSchema, sampleEmail, sampleInvoice, shipmentSchema, toJsonSchema } from "./document-extract-data";

const { spring, duration, ease } = motionTokens;
const standard = [...ease.standard] as [number, number, number, number];
const cx = (...names: (string | false | null | undefined)[]) => names.filter(Boolean).join(" ");

/** The typed result: one key per schema field, tables as arrays of row objects. Values that do not fit their type are null. */
export type ExtractOutput = Record<string, unknown>;

export interface DocumentExtractProps {
  /** The document to read. Without it the preview offers its two samples, an invoice and a shipping email. */
  document?: SourceDocument;
  /** The fields to fill. Defaults to the invoice schema, or to each sample's own schema. */
  schema?: ExtractSchema;
  /** Several documents to switch between from the file name, each with its schema. Ignored when `document` is set. */
  samples?: ExtractSample[];
  /** Your model call. Return an async iterable of events (stream values as they arrive) or a promise of all events. Without it the preview simulates the run. */
  extract?: ExtractFn;
  /** Called by Accept all with the typed data once every value is accepted. Throw to undo the accept. Without it the preview simulates the hand-off. */
  onAccept?: (data: ExtractOutput, detail: { document: SourceDocument; schema: ExtractSchema; values: Record<string, FieldState> }) => void | Promise<void>;
  /** The model named in the footer and used for the cost readout. Defaults to Claude Haiku 5.5. */
  model?: ExtractModel;
  /** The model's mark. Defaults to the Claude mark. */
  modelMark?: ReactNode;
  /** Values below this confidence are flagged and ask for a check. Defaults to 0.8. */
  reviewThreshold?: number;
  className?: string;
}

/* ---------------------------------------------------------------------------------------------------------------
 * Run state
 * ------------------------------------------------------------------------------------------------------------- */

type Phase = "idle" | "extracting" | "done" | "failed" | "stopped";
interface RunState {
  phase: Phase;
  run: number;
  values: Record<string, FieldState>;
  edits: Record<string, number>;
  started?: number;
  ended?: number;
  inputTokens: number;
  outputTokens: number;
  error?: string;
  accepted: "no" | "pending" | "yes";
}
type Action =
  | { type: "reset" }
  | { type: "start"; now: number }
  | { type: "value"; value: ExtractValue }
  | { type: "usage"; inputTokens: number; outputTokens: number }
  | { type: "finish"; now: number }
  | { type: "fail"; message: string; now: number }
  | { type: "stop"; now: number }
  | { type: "edit"; path: string; value: string }
  | { type: "check"; path: string; threshold: number }
  | { type: "acceptAll" }
  | { type: "accepted" }
  | { type: "unaccept" };

const initialRun: RunState = { phase: "idle", run: 0, values: {}, edits: {}, inputTokens: 0, outputTokens: 0, accepted: "no" };

function reduce(state: RunState, action: Action): RunState {
  switch (action.type) {
    case "reset": return { ...initialRun, run: state.run };
    case "start": return { ...initialRun, phase: "extracting", run: state.run + 1, started: action.now };
    case "value": {
      const { path, value, source, confidence, note } = action.value;
      return { ...state, values: { ...state.values, [path]: { value, source, confidence, note } } };
    }
    case "usage": return { ...state, inputTokens: action.inputTokens, outputTokens: action.outputTokens };
    case "finish": return { ...state, phase: "done", ended: action.now };
    case "fail": return { ...state, phase: "failed", ended: action.now, error: action.message };
    case "stop": return state.phase === "extracting" ? { ...state, phase: "stopped", ended: action.now } : state;
    case "edit": {
      const previous = state.values[action.path];
      if (previous?.value === action.value) return state;
      return { ...state, accepted: "no", edits: { ...state.edits, [action.path]: (state.edits[action.path] ?? 0) + 1 }, values: { ...state.values, [action.path]: { ...previous, value: action.value, review: "edited", accepted: false } } };
    }
    case "check": {
      const values = { ...state.values };
      for (const [path, value] of Object.entries(values)) {
        if ((path === action.path || path.startsWith(`${action.path}.`)) && needsCheck(value, action.threshold)) values[path] = { ...value, review: "checked" };
      }
      return { ...state, values };
    }
    case "acceptAll": return { ...state, accepted: "pending", values: Object.fromEntries(Object.entries(state.values).map(([path, value]) => [path, { ...value, accepted: true }])) };
    case "accepted": return { ...state, accepted: "yes" };
    case "unaccept": return { ...state, accepted: "no", values: Object.fromEntries(Object.entries(state.values).map(([path, value]) => [path, { ...value, accepted: false }])) };
  }
}

const isIterable = (value: unknown): value is AsyncIterable<ExtractEvent> => !!value && typeof (value as AsyncIterable<ExtractEvent>)[Symbol.asyncIterator] === "function";

/** Builds the typed output from the form, parsing each value against its field type. */
function buildOutput(fields: SchemaEntry[], values: Record<string, FieldState>): { data: ExtractOutput; invalid: string[] } {
  const invalid: string[] = [];
  const read = (type: Parameters<typeof parseValue>[0], path: string) => {
    const state = values[path];
    if (!state) return null;
    const parsed = parseValue(type, state.value);
    if (parsed === undefined) { invalid.push(path); return null; }
    return parsed;
  };
  const data: ExtractOutput = {};
  for (const field of fields) {
    if (field.type === "table") {
      const prefix = `${field.key}.`;
      const rows = Object.keys(values).filter(path => path.startsWith(prefix)).reduce((count, path) => Math.max(count, Number(path.split(".")[1]) + 1), 0);
      data[field.key] = Array.from({ length: rows }, (_, row) => Object.fromEntries(field.columns.map(column => [column.key, read(column.type, `${field.key}.${row}.${column.key}`)])));
    } else data[field.key] = read(field.type, field.key);
  }
  return { data, invalid };
}

/** The values that belong to a top level field: itself, or every cell of a table. */
const statesOf = (key: string, values: Record<string, FieldState>) => Object.entries(values).filter(([path]) => path === key || path.startsWith(`${key}.`)).map(([, state]) => state);

/* ---------------------------------------------------------------------------------------------------------------
 * Small hooks and helpers
 * ------------------------------------------------------------------------------------------------------------- */

function useNow(active: boolean, every = 100) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setNow(Date.now()), every);
    return () => window.clearInterval(id);
  }, [active, every]);
  return now;
}

/** Eases a number toward its target on a short requestAnimationFrame tween, so stats roll instead of jumping. */
function useTween(target: number, reduced: boolean, ms = 320) {
  const [shown, setShown] = useState(target);
  const from = useRef(target);
  const shownRef = useRef(target);
  useEffect(() => {
    if (reduced) { shownRef.current = target; return; }
    from.current = shownRef.current;
    const start = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      const value = from.current + (target - from.current) * (1 - Math.pow(1 - t, 3));
      shownRef.current = value;
      setShown(value);
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target, reduced, ms]);
  return reduced ? target : shown;
}

/** Scrolls a pane, never the page, so a target sits inside it, clear of the pane's sticky status. */
function reveal(container: HTMLElement | null, target: Element | null, behavior: ScrollBehavior, margin = 32) {
  if (!container || !target) return;
  const box = container.getBoundingClientRect(), rect = target.getBoundingClientRect();
  const sticky = container.querySelector<HTMLElement>("[data-sticky]");
  const top = box.top + (sticky ? sticky.offsetHeight : 0) + margin;
  const bottom = box.bottom - margin;
  if (rect.top >= top && rect.bottom <= bottom) return;
  const delta = rect.height > bottom - top || rect.top < top ? rect.top - top : rect.bottom - bottom;
  container.scrollTo({ top: container.scrollTop + delta, behavior });
}

const escape = (value: string) => typeof CSS !== "undefined" && CSS.escape ? CSS.escape(value) : value.replace(/"/g, '\\"');
const visibleLink = (root: HTMLElement | null, path: string) => root ? [...root.querySelectorAll<HTMLElement>(`[data-link="${escape(path)}"]`)].find(node => node.getClientRects().length > 0) ?? null : null;

function formatCost(value: number) {
  if (value <= 0) return "$0.00";
  return value < .01 ? `$${value.toFixed(4)}` : `$${value.toFixed(3)}`;
}

/** Animates its height to fit its content, so a status that changes size never jumps. */
function AutoHeight({ children, reduced, className }: { children: ReactNode; reduced: boolean; className?: string }) {
  const inner = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | "auto">("auto");
  useLayoutEffect(() => {
    const node = inner.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => setHeight(node.offsetHeight));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return <motion.div className={className} initial={false} animate={{ height }} transition={reduced ? { duration: 0 } : spring.smooth} style={{ overflow: "hidden" }}>
    <div ref={inner}>{children}</div>
  </motion.div>;
}

/* ---------------------------------------------------------------------------------------------------------------
 * The connector: one curve from a span to its value, measured every frame while it shows
 * ------------------------------------------------------------------------------------------------------------- */

/** The path draws in over 220ms in CSS; the sheen starts as it lands and travels once. */
const SHEEN_DELAY = 120, SHEEN_MS = 640, SHEEN_WIDTH = .2;

interface ConnectorProps { source: string; path: string; color: number; reduced: boolean; bodyRef: RefObject<HTMLDivElement | null>; docRef: RefObject<HTMLDivElement | null>; formRef: RefObject<HTMLDivElement | null> }

function Connector({ source, path, color, reduced, bodyRef, docRef, formRef }: ConnectorProps) {
  const gid = `de-sheen-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const group = useRef<SVGGElement>(null), line = useRef<SVGPathElement>(null), sheen = useRef<SVGPathElement>(null);
  const start = useRef<SVGCircleElement>(null), end = useRef<SVGCircleElement>(null), gradient = useRef<SVGLinearGradientElement>(null);
  const stops = useRef<(SVGStopElement | null)[]>([]);

  useLayoutEffect(() => {
    let frame = 0, last = "";
    const born = performance.now();
    const tick = (now: number) => {
      const body = bodyRef.current, doc = docRef.current, form = formRef.current;
      const span = doc?.querySelector<HTMLElement>(`[data-span="${escape(source)}"]`);
      const target = visibleLink(form, path);
      if (body && doc && form && span && target) {
        const origin = body.getBoundingClientRect(), docBox = doc.getBoundingClientRect(), formBox = form.getBoundingClientRect();
        const rects = span.getClientRects(), tail = rects[rects.length - 1] ?? span.getBoundingClientRect();
        const value = target.getBoundingClientRect(), anchor = (target.closest("[data-anchor]") ?? target).getBoundingClientRect();
        const ceiling = Math.max(formBox.top, form.querySelector<HTMLElement>("[data-sticky]")?.getBoundingClientRect().bottom ?? formBox.top);
        // The curve leaves the span's end and meets the row's left edge, level with the value. Stacked on a phone it would cross the form,
        // so it stays hidden there and the matching tints carry the link.
        const stacked = formBox.top >= docBox.bottom - 1;
        let x1 = tail.right + 2, y1 = tail.top + tail.height / 2, x2 = anchor.left - 7, y2 = value.top + value.height / 2;
        const visible = !stacked && y1 > docBox.top + 2 && y1 < docBox.bottom - 2 && x1 < docBox.right + 2 && x1 > docBox.left && y2 > ceiling + 2 && y2 < formBox.bottom - 2;
        const k = Math.max(28, (x2 - x1) * .5);
        x1 -= origin.left; x2 -= origin.left; y1 -= origin.top; y2 -= origin.top;
        const d = `M${x1.toFixed(1)} ${y1.toFixed(1)}C${(x1 + k).toFixed(1)} ${y1.toFixed(1)} ${(x2 - k).toFixed(1)} ${y2.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`;
        const key = `${d}|${visible}`;
        if (key !== last) {
          last = key;
          line.current?.setAttribute("d", d);
          sheen.current?.setAttribute("d", d);
          start.current?.setAttribute("cx", x1.toFixed(1)); start.current?.setAttribute("cy", y1.toFixed(1));
          end.current?.setAttribute("cx", x2.toFixed(1)); end.current?.setAttribute("cy", y2.toFixed(1));
          gradient.current?.setAttribute("x1", x1.toFixed(1)); gradient.current?.setAttribute("y1", y1.toFixed(1));
          gradient.current?.setAttribute("x2", x2.toFixed(1)); gradient.current?.setAttribute("y2", y2.toFixed(1));
          group.current?.toggleAttribute("data-hidden", !visible);
        }
      } else if (last !== "none") { last = "none"; group.current?.toggleAttribute("data-hidden", true); }
      // One soft band of light travels along the curve once, then the line rests.
      const t = (now - born - SHEEN_DELAY) / SHEEN_MS;
      if (!reduced && t <= 1.05) {
        const eased = t <= 0 ? 0 : t >= 1 ? 1 : t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        const center = -SHEEN_WIDTH + eased * (1 + SHEEN_WIDTH * 2);
        [center - SHEEN_WIDTH, center, center + SHEEN_WIDTH].forEach((offset, index) => stops.current[index]?.setAttribute("offset", String(Math.min(1, Math.max(0, offset)))));
      }
      frame = requestAnimationFrame(tick);
    };
    tick(performance.now());
    return () => cancelAnimationFrame(frame);
  }, [source, path, reduced, bodyRef, docRef, formRef]);

  return <motion.g style={{ "--tone": `var(--series-${color})` } as CSSProperties}
    initial={{ opacity: 1 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: reduced ? 0 : .12, ease: standard } }}>
    <defs>
      <linearGradient ref={gradient} id={gid} gradientUnits="userSpaceOnUse">
        {[0, 1, 2].map(index => <stop key={index} ref={node => { stops.current[index] = node; }} offset="0" className={styles.sheenStop} data-peak={index === 1 ? "" : undefined} />)}
      </linearGradient>
    </defs>
    <g ref={group} className={styles.linkBody}>
      <path ref={line} className={styles.linkPath} pathLength={1} data-draw={reduced ? undefined : ""} />
      {!reduced && <path ref={sheen} className={styles.linkSheen} stroke={`url(#${gid})`} />}
      <circle ref={start} r={3} className={styles.linkStart} />
      <circle ref={end} r={3} className={styles.linkEnd} data-draw={reduced ? undefined : ""} />
    </g>
  </motion.g>;
}

/* ---------------------------------------------------------------------------------------------------------------
 * Confidence summary: one small bar per field
 * ------------------------------------------------------------------------------------------------------------- */

function ConfidenceBars({ fields, values, threshold, order, onHover }: { fields: SchemaEntry[]; values: Record<string, FieldState>; threshold: number; order: Record<string, number>; onHover: (path: string | null) => void }) {
  return <span className={styles.bars} aria-hidden="true">
    {fields.map(field => {
      const states = statesOf(field.key, values).filter(state => state.confidence !== undefined);
      const lowest = states.length ? Math.min(...states.map(state => state.confidence ?? 1)) : 0;
      const tone = !states.length ? "pending" : states.every(state => state.accepted) ? "accepted" : states.some(state => needsCheck(state, threshold)) ? "check" : "ok";
      const height = states.length ? 5 + Math.max(0, (lowest - .5) / .5) * 13 : 3;
      return <span key={field.key} className={styles.bar} data-tone={tone} style={{ "--h": `${height.toFixed(1)}px`, "--i": order[field.key] ?? 0 } as CSSProperties}
        onPointerEnter={event => { if (event.pointerType === "mouse" && states.length) onHover(field.key); }} onPointerLeave={event => { if (event.pointerType === "mouse") onHover(null); }} />;
    })}
  </span>;
}

/* ---------------------------------------------------------------------------------------------------------------
 * Block
 * ------------------------------------------------------------------------------------------------------------- */

export function DocumentExtract({ document, schema, samples, extract, onAccept, model = haiku, modelMark, reviewThreshold = .8, className }: DocumentExtractProps) {
  const reduced = useReducedMotion() ?? false;
  const list = useMemo<ExtractSample[]>(() => document ? [{ document, schema: schema ?? sampleDocuments[0].schema }] : samples?.length ? samples : sampleDocuments, [document, schema, samples]);
  const [sampleId, setSampleId] = useState(list[0].document.id);
  const sample = list.find(item => item.document.id === sampleId) ?? list[0];
  const doc = sample.document, fields = sample.schema.fields;

  const [run, dispatch] = useReducer(reduce, initialRun);
  const [tab, setTab] = useState("fields");
  const [hover, setHover] = useState<{ path: string; from: "doc" | "form" } | null>(null);
  const hoverPath = hover?.path ?? null;
  const [selected, setSelected] = useState<string | null>(null);
  const [announce, setAnnounce] = useState("");

  const bodyRef = useRef<HTMLDivElement>(null);
  const docScroll = useRef<HTMLDivElement>(null);
  const formScroll = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const demo = useMemo(() => createDemoExtract(), []);
  const extractFn = extract ?? demo;
  const simulated = !extract;

  const busy = run.phase === "extracting";
  const activePath = hoverPath ?? selected;
  const tones = useMemo(() => fieldTones(sample.schema), [sample.schema]);
  const order = useMemo(() => Object.fromEntries(fields.map((field, index) => [field.key, index])), [fields]);

  /* Derived */
  const unresolved = useMemo(() => Object.entries(run.values).filter(([, state]) => needsCheck(state, reviewThreshold)).map(([path]) => path), [run.values, reviewThreshold]);
  const flaggedFields = useMemo(() => new Set(unresolved.map(path => path.split(".")[0])).size, [unresolved]);
  const found = fields.filter(field => statesOf(field.key, run.values).some(state => state.value.trim())).length;
  const scored = Object.values(run.values).filter(state => state.confidence !== undefined);
  const average = scored.length ? scored.reduce((sum, state) => sum + (state.confidence ?? 0), 0) / scored.length : 0;
  const cost = (run.inputTokens * model.inputPrice + run.outputTokens * model.outputPrice) / 1_000_000;
  const now = useNow(busy);
  const elapsed = run.started ? ((run.ended ?? now) - run.started) / 1000 : 0;
  const output = useMemo(() => buildOutput(fields, run.values), [fields, run.values]);
  const jsonSchema = useMemo(() => toJsonSchema(sample.schema), [sample.schema]);

  const shownAverage = useTween(Math.round(average * 100), reduced);
  const shownCost = useTween(cost, reduced);

  /** Span id to field path, label, tone and series color. */
  const links = useMemo(() => {
    const map = new Map<string, SpanLink>();
    for (const [path, state] of Object.entries(run.values)) {
      if (!state.source || map.has(state.source)) continue;
      const key = path.split(".")[0];
      map.set(state.source, { path, label: fields.find(item => item.key === key)?.label ?? path, tone: needsCheck(state, reviewThreshold) ? "check" : "ok", color: tones[key] ?? 1 });
    }
    return map;
  }, [run.values, fields, reviewThreshold, tones]);

  const litSpans = useMemo(() => {
    const set = new Set<string>();
    if (!activePath) return set;
    for (const [path, state] of Object.entries(run.values)) if (state.source && (path === activePath || path.startsWith(`${activePath}.`))) set.add(state.source);
    return set;
  }, [activePath, run.values]);

  /* Running */
  const flash = useCallback((source: string) => {
    const span = docScroll.current?.querySelector<HTMLElement>(`[data-span="${escape(source)}"]`);
    if (!span) return;
    span.dataset.fresh = "";
    window.setTimeout(() => { delete span.dataset.fresh; }, 520);
    reveal(docScroll.current, span, reduced ? "auto" : "smooth", 56);
  }, [reduced]);

  const start = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    dispatch({ type: "start", now: Date.now() });
    setAnnounce(""); setSelected(null); setHover(null);
    formScroll.current?.scrollTo({ top: 0 });
    docScroll.current?.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
    try {
      const result = extractFn(doc, sample.schema, { signal: controller.signal });
      const events: AsyncIterable<ExtractEvent> = isIterable(result) ? result : (async function* () { for (const event of await result) yield event; })();
      for await (const event of events) {
        if (controller.signal.aborted) return;
        if (event.type === "error") throw new Error(event.message);
        if (event.type === "usage") dispatch({ type: "usage", inputTokens: event.inputTokens, outputTokens: event.outputTokens });
        else {
          dispatch({ type: "value", value: event });
          const path = event.path, source = event.source;
          // The value's field and a table row mount with this value, so look for them after the next paint.
          window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
            if (source) flash(source);
            reveal(formScroll.current, visibleLink(formScroll.current, path), reduced ? "auto" : "smooth", 24);
          }));
        }
      }
      if (!controller.signal.aborted) dispatch({ type: "finish", now: Date.now() });
    } catch (error) {
      if (controller.signal.aborted) return;
      dispatch({ type: "fail", message: error instanceof Error ? error.message : String(error), now: Date.now() });
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
    }
  }, [doc, sample.schema, extractFn, flash, reduced]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    dispatch({ type: "stop", now: Date.now() });
  }, []);

  useEffect(() => () => abortRef.current?.abort(), []);

  const phaseMessage = run.phase === "extracting" ? `Extracting ${fields.length} fields with ${model.name}${simulated ? ", simulated in this preview" : ""}.`
    : run.phase === "done" ? (unresolved.length ? `Extracted ${found} of ${fields.length} fields. ${flaggedFields === 1 ? "One field needs" : `${flaggedFields} fields need`} a check.` : `Extracted all ${fields.length} fields.`)
      : run.phase === "failed" ? `Extraction failed after ${found} of ${fields.length} fields. ${run.error ?? ""}`
        : run.phase === "stopped" ? `Stopped after ${found} of ${fields.length} fields.` : "";

  const switchSample = (id: string) => {
    if (id === sampleId) return;
    abortRef.current?.abort();
    abortRef.current = null;
    dispatch({ type: "reset" });
    setSampleId(id);
    setHover(null); setSelected(null); setAnnounce("");
    docScroll.current?.scrollTo({ top: 0 });
    formScroll.current?.scrollTo({ top: 0 });
  };

  const showTab = (next: string) => { setTab(next); formScroll.current?.scrollTo({ top: 0 }); };

  /* Linking: hover lights, a click or focus selects */
  const focusField = useCallback((path: string) => {
    const node = visibleLink(formScroll.current, path);
    if (!node) return;
    reveal(formScroll.current, node, reduced ? "auto" : "smooth", 24);
    if (node instanceof HTMLInputElement) node.focus({ preventScroll: true });
    // Stacked on a phone the form sits below the page, so a press on a span may need the window to follow it there.
    const form = formScroll.current?.getBoundingClientRect(), doc = docScroll.current?.getBoundingClientRect();
    if (form && doc && form.top >= doc.bottom - 1) window.requestAnimationFrame(() => {
      const rect = node.getBoundingClientRect();
      if (rect.top < 0 || rect.bottom > window.innerHeight) node.scrollIntoView({ block: "nearest", behavior: reduced ? "auto" : "smooth" });
    });
  }, [reduced]);

  const pressSpan = (path: string) => {
    setSelected(path);
    if (tab === "schema") { showTab("fields"); window.setTimeout(() => focusField(path), 80); return; }
    focusField(path);
  };

  // A new selection brings its source into view in the page.
  const selectedSource = selected ? run.values[selected]?.source : undefined;
  useEffect(() => {
    if (!selectedSource) return;
    reveal(docScroll.current, docScroll.current?.querySelector(`[data-span="${escape(selectedSource)}"]`) ?? null, reduced ? "auto" : "smooth", 56);
  }, [selectedSource, reduced]);

  // Resting on a value for a moment brings its other end into view, so the curve always has two ends to join.
  const valuesRef = useRef(run.values);
  useLayoutEffect(() => { valuesRef.current = run.values; }, [run.values]);
  useEffect(() => {
    if (!hover || busy) return;
    const id = window.setTimeout(() => {
      if (hover.from === "form") {
        const source = valuesRef.current[hover.path]?.source;
        if (source) reveal(docScroll.current, docScroll.current?.querySelector(`[data-span="${escape(source)}"]`) ?? null, reduced ? "auto" : "smooth", 56);
      } else reveal(formScroll.current, visibleLink(formScroll.current, hover.path), reduced ? "auto" : "smooth", 24);
    }, 180);
    return () => window.clearTimeout(id);
  }, [hover, busy, reduced]);
  const hoverFrom = useCallback((from: "doc" | "form", path: string | null) => setHover(previous => !path ? null : previous?.path === path && previous.from === from ? previous : { path, from }), []);
  const hoverForm = useCallback((path: string | null) => hoverFrom("form", path), [hoverFrom]);
  const hoverDoc = useCallback((path: string | null) => hoverFrom("doc", path), [hoverFrom]);

  const linkPath = activePath && run.values[activePath]?.source ? activePath : null;
  const linkSource = linkPath ? run.values[linkPath]?.source : undefined;
  const linkOn = !!linkPath && !!linkSource && tab !== "schema";

  /* Form wiring */
  const ctx: FormContext = {
    values: run.values,
    threshold: reviewThreshold,
    busy,
    reduced,
    activePath,
    tones,
    order,
    onHover: hoverForm,
    onFocusPath: setSelected,
    onEdit: (path, value) => dispatch({ type: "edit", path, value }),
    onCheck: path => {
      dispatch({ type: "check", path, threshold: reviewThreshold });
      setAnnounce(`${fields.find(field => field.key === path)?.label ?? "Value"} marked as checked.`);
      window.requestAnimationFrame(() => formScroll.current?.querySelector<HTMLInputElement>(`[data-link="${escape(path)}"], [data-link^="${escape(path)}."]`)?.focus({ preventScroll: true }));
    },
  };

  const reviewNext = () => {
    const first = unresolved[0];
    if (!first) return;
    if (tab !== "fields") showTab("fields");
    window.requestAnimationFrame(() => focusField(first));
  };

  const ready = (run.phase === "done" || run.phase === "stopped") && scored.length > 0;
  const acceptAll = async () => {
    if (!ready || run.accepted !== "no") return;
    if (output.invalid.length) {
      const first = output.invalid[0];
      if (tab !== "fields") showTab("fields");
      window.requestAnimationFrame(() => focusField(first));
      setAnnounce(output.invalid.length === 1 ? "One value does not fit its type. Fix it before accepting." : `${output.invalid.length} values do not fit their types. Fix them before accepting.`);
      return;
    }
    dispatch({ type: "acceptAll" });
    try {
      if (onAccept) await onAccept(output.data, { document: doc, schema: sample.schema, values: run.values });
      else await new Promise(resolve => window.setTimeout(resolve, 560));
      dispatch({ type: "accepted" });
      setAnnounce(`All ${found} fields accepted. ${onAccept ? "The data was sent." : "Sending the data is simulated in this preview."}`);
    } catch (error) {
      dispatch({ type: "unaccept" });
      setAnnounce(`Could not accept. ${error instanceof Error ? error.message : ""}`);
    }
  };

  /* Extract button */
  let action: ReactNode, actionVariant: "primary" | "secondary" = "primary", onAction = () => { void start(); };
  if (busy) { action = <><Square aria-hidden="true" className={styles.stopIcon} />Stop</>; actionVariant = "secondary"; onAction = stop; }
  else if (run.phase === "failed") action = <><RotateCcw aria-hidden="true" />Retry</>;
  else if (run.phase === "idle") action = <><ScanText aria-hidden="true" />Extract</>;
  else { action = <><RotateCcw aria-hidden="true" /><span>Extract<span className={styles.againWord}> again</span></span></>; actionVariant = "secondary"; }

  /* Status above the fields */
  const count = `${found} of ${fields.length}`;
  let status: ReactNode;
  if (busy) status = <p className={styles.statusLine}><TextShimmer className={styles.statusShimmer}>{found ? "Extracting fields" : "Reading the document"}</TextShimmer><span className={styles.statusMeta}>{count}</span></p>;
  else if (run.phase === "idle") status = <p className={styles.statusLine}><span className={styles.statusQuiet}>{fields.length} fields to fill from this {kindOf(doc) === "email" ? "email" : "document"}</span></p>;
  else if (run.phase === "failed") status = <div className={styles.statusBlock} role="alert" data-tone="danger">
    <p className={styles.statusLine}><CircleAlert aria-hidden="true" className={styles.statusIcon} /><span>Extraction failed after {count} fields</span></p>
    <p className={styles.statusBody}>{model.name} returned {run.error ?? "an error."} Retry reads the whole document again{simulated ? "; in this preview only the first run fails" : ""}.</p>
  </div>;
  else if (run.phase === "stopped") status = <div className={styles.statusBlock}>
    <p className={styles.statusLine}><Square aria-hidden="true" className={styles.stopIcon} /><span>Stopped after {count} fields</span></p>
    <p className={styles.statusBody}>The values found so far are kept. Extract again reads the whole document.</p>
  </div>;
  else if (run.accepted === "yes") status = <p className={styles.statusLine}><CircleCheck aria-hidden="true" className={styles.statusOk} /><span>All fields accepted{simulated ? ". Sending is simulated in this preview" : " and sent"}</span></p>;
  else if (unresolved.length) status = <p className={styles.statusLine} data-tone="warning">
    <TriangleAlert aria-hidden="true" className={styles.statusIcon} /><span>{flaggedFields === 1 ? "One field needs a check" : `${flaggedFields} fields need a check`}</span>
    <button type="button" className={styles.textButton} onClick={reviewNext}>Review</button>
  </p>;
  else status = <p className={styles.statusLine}><CircleCheck aria-hidden="true" className={styles.statusOk} /><span>Found {count} fields in {elapsed.toFixed(1)} s</span></p>;
  const statusKey = busy ? "busy" : run.phase === "done" ? (run.accepted === "yes" ? "accepted" : unresolved.length ? "review" : "done") : run.phase;

  /* Footer summary */
  let summary: ReactNode;
  if (!scored.length) summary = <span className={styles.summaryQuiet}>{busy ? "Reading" : "No values yet"}</span>;
  else summary = <>
    <span><span className={styles.summaryStrong}>{Math.round(shownAverage)}%</span> average</span>
    {run.accepted !== "no" && unresolved.length === 0 ? <span className={styles.summaryOk}><Check aria-hidden="true" />{run.accepted === "yes" ? "All accepted" : "Accepting"}</span>
      : unresolved.length ? <span className={styles.summaryWarn}><TriangleAlert aria-hidden="true" />{flaggedFields} to check</span>
        : !busy && <span className={styles.summaryOk}><CircleCheck aria-hidden="true" />Ready</span>}
  </>;

  let acceptLabel: ReactNode = "Accept all";
  if (run.accepted === "yes") acceptLabel = <><Check aria-hidden="true" />Accepted</>;

  return <div className={cx(styles.root, className)}
    onKeyDown={event => {
      if (event.key !== "Escape") return;
      if (busy) { event.preventDefault(); stop(); }
      else if (selected) { setSelected(null); }
    }}>
    <div ref={bodyRef} className={styles.body}>
      <DocumentViewer document={doc} canvasRef={docScroll} links={links} lit={litSpans} scanKey={run.run} reduced={reduced}
        files={list.length > 1 ? list.map(item => ({ id: item.document.id, name: item.document.name, label: item.document.label, kind: kindOf(item.document), meta: item.document.meta })) : undefined}
        onFileChange={switchSample} onSpanHover={hoverDoc} onSpanPress={pressSpan} onBackgroundPress={() => setSelected(null)} />

      <Tabs value={tab} onValueChange={showTab} className={styles.formPane}>
        <div className={styles.formHead}>
          <TabsList aria-label="Output">
            <TabsTrigger value="fields">Fields</TabsTrigger>
            <TabsTrigger value="json">JSON</TabsTrigger>
            <TabsTrigger value="schema">Schema</TabsTrigger>
          </TabsList>
          <Button size="sm" variant={actionVariant} className={cx(actionVariant === "primary" && styles.accentButton, styles.action)} onClick={onAction} aria-keyshortcuts={busy ? "Escape" : undefined}>{action}</Button>
        </div>
        <div ref={formScroll} className={styles.formScroll} onScroll={event => event.currentTarget.toggleAttribute("data-scrolled", event.currentTarget.scrollTop > 2)}>
          <TabsContent value="fields" className={styles.tabPanel}>
            <div className={styles.status} data-sticky="">
              <AutoHeight reduced={reduced}>
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.div key={statusKey} initial={reduced ? { opacity: 0 } : { opacity: 0, y: 2 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: { duration: .1 } }} transition={{ duration: duration.fast, ease: standard }}>{status}</motion.div>
                </AnimatePresence>
              </AutoHeight>
            </div>
            <FieldsForm schema={sample.schema} ctx={ctx} />
          </TabsContent>
          <TabsContent value="json" className={styles.tabPanel}>
            <div className={styles.codeBar}>
              <span className={styles.codeNote}>
                {output.invalid.length ? <><TriangleAlert aria-hidden="true" className={styles.codeWarn} />{output.invalid.length === 1 ? "One value does not fit its type and is null" : `${output.invalid.length} values do not fit their types and are null`}</>
                  : run.phase === "idle" ? "Typed output appears here as values arrive" : <><CircleCheck aria-hidden="true" className={styles.statusOk} />Matches the {sample.schema.title.toLowerCase()} schema, updates as you edit</>}
              </span>
              <CopyButton value={JSON.stringify(output.data, null, 2)} label="Copy" />
            </div>
            <JsonView value={output.data} label="Typed output as JSON" linking={{ activePath, tones, edits: run.edits, onHover: hoverForm, onSelect: setSelected }} />
          </TabsContent>
          <TabsContent value="schema" className={styles.tabPanel}>
            <div className={styles.codeBar}>
              <span className={styles.codeNote}>Sent to {model.id} as the output format</span>
              <CopyButton value={JSON.stringify(jsonSchema, null, 2)} label="Copy" />
            </div>
            <JsonView value={jsonSchema} label="JSON schema" />
          </TabsContent>
        </div>
      </Tabs>

      <svg className={styles.links} aria-hidden="true">
        <AnimatePresence>
          {linkOn && linkPath && linkSource && <Connector key={linkPath} source={linkSource} path={linkPath} color={tones[linkPath.split(".")[0]] ?? 1} reduced={reduced} bodyRef={bodyRef} docRef={docScroll} formRef={formScroll} />}
        </AnimatePresence>
      </svg>
    </div>

    <footer className={styles.footer}>
      <div className={styles.summary}>
        <ConfidenceBars fields={fields} values={run.values} threshold={reviewThreshold} order={order} onHover={hoverForm} />
        <p className={styles.summaryText}>{summary}</p>
      </div>
      <p className={styles.meta}>
        <span className={styles.modelMark} aria-hidden="true">{modelMark ?? <ClaudeMark title="" />}</span>
        <span className={styles.modelName}>{model.name}</span>
        <span className={styles.metaDot} aria-hidden="true" />
        <span className={styles.tabular}>{formatCost(shownCost)}</span>
        <span className={styles.metaDot} aria-hidden="true" />
        <span className={styles.tabular}>{elapsed.toFixed(1)} s</span>
      </p>
      <Button size="sm" variant={run.accepted === "yes" ? "secondary" : "primary"} className={cx(run.accepted !== "yes" && styles.accentButton, styles.accept)}
        disabled={!ready || run.accepted === "yes"} loading={run.accepted === "pending"} onClick={() => { void acceptAll(); }}>{acceptLabel}</Button>
    </footer>

    <p className={styles.srOnly} role="status" aria-live="polite">{phaseMessage}</p>
    <p className={styles.srOnly} aria-live="polite">{announce}</p>
  </div>;
}

export default DocumentExtract;
