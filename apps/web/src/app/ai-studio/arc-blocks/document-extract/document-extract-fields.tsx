"use client";

import { useId, type CSSProperties, type ReactNode } from "react";
import { AnimatePresence, motion, useIsPresent } from "motion/react";
import { Check, PencilLine, TriangleAlert } from "lucide-react";
import { motionTokens } from "@/shared/arc/lib/motion-tokens";
import { parseValue, typeHint, type ExtractSchema, type FieldType, type SchemaField, type SchemaTable } from "./document-extract-data";
import styles from "./document-extract.module.css";

const { spring, duration, ease, stagger } = motionTokens;
const standard = [...ease.standard] as [number, number, number, number];
const cx = (...names: (string | false | null | undefined)[]) => names.filter(Boolean).join(" ");

/** What the form knows about one value: the text in the field, where it came from, how sure the model was, and what a person did. */
export interface FieldState { value: string; source?: string; confidence?: number; note?: string; review?: "checked" | "edited"; accepted?: boolean }

export const needsCheck = (state: FieldState | undefined, threshold: number) => !!state && state.confidence !== undefined && state.confidence < threshold && !state.review && !state.accepted;

export interface FormContext {
  values: Record<string, FieldState>;
  threshold: number;
  busy: boolean;
  reduced: boolean;
  activePath: string | null;
  /** Series color (1 to 4) per top level field. */
  tones: Record<string, number>;
  /** Place of each top level field in the form, for the accept cascade. */
  order: Record<string, number>;
  onHover: (path: string | null) => void;
  onFocusPath: (path: string) => void;
  onEdit: (path: string, value: string) => void;
  onCheck: (path: string) => void;
}

const inputMode = (type: FieldType) => type === "money" || type === "number" ? "decimal" : type === "integer" ? "numeric" : undefined;
const isNumeric = (type: FieldType) => type === "money" || type === "number" || type === "integer";
const typeName: Record<FieldType, string> = { string: "Text", date: "Date", money: "Amount", currency: "Code", iban: "IBAN", integer: "Number", number: "Number" };
const isActive = (active: string | null, path: string) => !!active && (active === path || active.startsWith(`${path}.`) || path.startsWith(`${active}.`));
const toneStyle = (tone: number | undefined) => ({ "--tone": `var(--series-${tone ?? 1})` }) as CSSProperties;
const mouse = (handler: () => void) => (event: { pointerType: string }) => { if (event.pointerType === "mouse") handler(); };

/* ---------------------------------------------------------------------------------------------------------------
 * Status: confidence as a number, a check, or an edit, always with an icon or text, never color alone
 * ------------------------------------------------------------------------------------------------------------- */

function Status({ state, threshold, reduced, idle, delay = 0 }: { state?: FieldState; threshold: number; reduced: boolean; idle?: string; delay?: number }) {
  const percent = state?.confidence !== undefined ? Math.round(state.confidence * 100) : undefined;
  let key = "idle", icon: ReactNode = null, label: ReactNode = idle ?? null, tone = "muted", spoken: string | undefined;
  if (state?.accepted) { key = "accepted"; icon = <Check aria-hidden="true" />; label = state.review === "edited" ? "Edited" : percent !== undefined ? `${percent}%` : "Done"; tone = "success"; spoken = state.review === "edited" ? "Edited and accepted" : `Accepted, confidence ${percent} percent`; }
  else if (state?.review === "edited") { key = "edited"; icon = <PencilLine aria-hidden="true" />; label = "Edited"; }
  else if (state?.review === "checked") { key = "checked"; icon = <Check aria-hidden="true" />; label = `${percent}%`; tone = "success"; spoken = `Checked, confidence ${percent} percent`; }
  else if (percent !== undefined && state?.confidence !== undefined) {
    if (state.confidence < threshold) { key = "check"; icon = <TriangleAlert aria-hidden="true" />; label = `${percent}%`; tone = "warning"; spoken = `Low confidence, ${percent} percent, check this value`; }
    else { key = "ok"; label = `${percent}%`; spoken = `Confidence ${percent} percent`; }
  }
  const pop = key === "accepted" || key === "checked";
  return <span className={styles.conf} data-tone={tone}>
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.span key={key} className={styles.confInner}
        initial={reduced ? { opacity: 0 } : { opacity: 0, y: 2 }} animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, transition: { duration: .1, delay } }}
        transition={{ duration: duration.fast, ease: standard, delay }}>
        {icon && (pop && !reduced
          ? <motion.span className={styles.confIcon} initial={{ scale: .4 }} animate={{ scale: 1 }} transition={{ ...spring.snappy, delay }}>{icon}</motion.span>
          : <span className={styles.confIcon}>{icon}</span>)}
        <span aria-hidden={spoken ? true : undefined}>{label}</span>
        {spoken && <span className={styles.srOnly}>{spoken}</span>}
      </motion.span>
    </AnimatePresence>
  </span>;
}

/** A note under a value that opens and closes its height. While it leaves it is inert, so its button cannot be pressed twice. */
function Reveal({ children, className, reduced }: { children: ReactNode; className?: string; reduced: boolean }) {
  const present = useIsPresent();
  return <motion.div className={cx(styles.reveal, className)} inert={!present || undefined} initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
    transition={reduced ? { duration: 0 } : { ...spring.smooth, opacity: { duration: duration.fast, ease: standard } }}>{children}</motion.div>;
}

/* ---------------------------------------------------------------------------------------------------------------
 * A single value
 * ------------------------------------------------------------------------------------------------------------- */

function Field({ field, ctx }: { field: SchemaField; ctx: FormContext }) {
  const id = useId();
  const state = ctx.values[field.key];
  const low = needsCheck(state, ctx.threshold);
  const invalid = !!state?.value.trim() && parseValue(field.type, state.value) === undefined;
  const described = [low && state?.note ? `${id}-note` : "", invalid ? `${id}-error` : ""].filter(Boolean).join(" ") || undefined;
  const delay = state?.accepted && !ctx.reduced ? (ctx.order[field.key] ?? 0) * stagger.item : 0;
  return <div className={styles.row} data-anchor="" data-active={isActive(ctx.activePath, field.key) ? "" : undefined} data-tone={low ? "check" : undefined} style={toneStyle(ctx.tones[field.key])}
    onPointerEnter={mouse(() => ctx.onHover(field.key))} onPointerLeave={mouse(() => ctx.onHover(null))}>
    <label htmlFor={id} className={styles.rowLabel}>{field.label}</label>
    <input id={id} className={styles.input} data-link={field.key} data-numeric={isNumeric(field.type) ? "" : undefined} data-landed={state?.confidence !== undefined ? "" : undefined}
      value={state?.value ?? ""} readOnly={ctx.busy} aria-invalid={invalid || undefined} aria-describedby={described}
      spellCheck={false} autoComplete="off" inputMode={inputMode(field.type)}
      onChange={event => ctx.onEdit(field.key, event.target.value)} onFocus={() => ctx.onFocusPath(field.key)} />
    <Status state={state} threshold={ctx.threshold} reduced={ctx.reduced} idle={typeName[field.type]} delay={delay} />
    <AnimatePresence initial={false}>
      {low && state?.note && <Reveal key="note" className={styles.rowExtra} reduced={ctx.reduced}>
        <div className={styles.note}>
          <p id={`${id}-note`} className={styles.noteText}>{state.note}</p>
          <button type="button" className={styles.noteButton} onClick={() => ctx.onCheck(field.key)}><Check aria-hidden="true" />Looks right</button>
        </div>
      </Reveal>}
      {invalid && <Reveal key="error" className={styles.rowExtra} reduced={ctx.reduced}><p id={`${id}-error`} className={styles.fieldError}>{typeHint[field.type]}</p></Reveal>}
    </AnimatePresence>
  </div>;
}

/* ---------------------------------------------------------------------------------------------------------------
 * A table of rows, such as line items
 * ------------------------------------------------------------------------------------------------------------- */

function TableField({ field, ctx }: { field: SchemaTable; ctx: FormContext }) {
  const id = useId();
  const prefix = `${field.key}.`;
  const paths = Object.keys(ctx.values).filter(path => path.startsWith(prefix));
  const rows = paths.reduce((count, path) => Math.max(count, Number(path.split(".")[1]) + 1), 0);
  const states = paths.map(path => ctx.values[path]).filter((state): state is FieldState => !!state);
  const lowCells = paths.filter(path => needsCheck(ctx.values[path], ctx.threshold));
  const scored = states.filter(state => state.confidence !== undefined);
  const lowest = (list: FieldState[]) => Math.min(...list.map(state => state.confidence ?? 1));
  const accepted = states.length > 0 && states.every(state => state.accepted);
  const summary: FieldState | undefined = !scored.length ? undefined
    : accepted ? { value: "", accepted: true, confidence: lowest(scored), review: states.some(state => state.review === "edited") ? "edited" : undefined }
      : lowCells.length ? { value: "", confidence: lowest(lowCells.map(path => ctx.values[path] as FieldState)) }
        : states.some(state => state.review === "edited") ? { value: "", review: "edited" }
          : { value: "", confidence: lowest(scored) };
  const delay = accepted && !ctx.reduced ? (ctx.order[field.key] ?? 0) * stagger.item : 0;
  return <div className={styles.tableField} data-active={isActive(ctx.activePath, field.key) ? "" : undefined} style={toneStyle(ctx.tones[field.key])}>
    <div className={styles.tableTitle} onPointerEnter={mouse(() => ctx.onHover(field.key))} onPointerLeave={mouse(() => ctx.onHover(null))}>
      <span className={styles.groupDot} aria-hidden="true" />
      <span id={`${id}-label`} className={styles.tableLabel}>{field.label}</span>
      <span className={styles.rowCount}>{rows ? `${rows} ${rows === 1 ? "row" : "rows"}` : "Table"}</span>
      <Status state={summary} threshold={ctx.threshold} reduced={ctx.reduced} delay={delay} />
    </div>
    <div className={styles.grid} data-anchor="" role="table" aria-labelledby={`${id}-label`} data-columns={field.columns.length}>
      <div className={styles.gridHead} role="row">
        {field.columns.map(column => <span key={column.key} role="columnheader" className={styles.th} data-numeric={isNumeric(column.type) ? "" : undefined}>{column.label}</span>)}
      </div>
      {rows === 0 && <p className={styles.gridEmpty}>{ctx.busy ? "Rows appear here as they are found" : "No rows yet"}</p>}
      <AnimatePresence initial={false}>
        {Array.from({ length: rows }, (_, row) => <motion.div key={row} role="row" className={styles.tr}
          initial={ctx.reduced ? false : { height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
          transition={ctx.reduced ? { duration: 0 } : { ...spring.smooth, opacity: { duration: duration.fast, ease: standard } }}>
          <div className={styles.trInner}>
            {field.columns.map(column => {
              const path = `${field.key}.${row}.${column.key}`;
              const state = ctx.values[path];
              const low = needsCheck(state, ctx.threshold);
              const invalid = !!state?.value.trim() && parseValue(column.type, state.value) === undefined;
              const numeric = isNumeric(column.type);
              return <span key={column.key} role="cell" className={styles.td} data-numeric={numeric ? "" : undefined}
                onPointerEnter={mouse(() => ctx.onHover(path))} onPointerLeave={mouse(() => ctx.onHover(null))}>
                <input className={styles.cellInput} data-link={path} data-numeric={numeric ? "" : undefined} data-landed={state?.confidence !== undefined ? "" : undefined}
                  data-active={ctx.activePath === path ? "" : undefined} data-tone={low ? "check" : undefined}
                  value={state?.value ?? ""} readOnly={ctx.busy} aria-label={`${column.label}, row ${row + 1}${low ? ", needs a check" : ""}`} aria-invalid={invalid || undefined}
                  spellCheck={false} autoComplete="off" inputMode={inputMode(column.type)}
                  onChange={event => ctx.onEdit(path, event.target.value)} onFocus={() => ctx.onFocusPath(path)} />
              </span>;
            })}
          </div>
        </motion.div>)}
      </AnimatePresence>
    </div>
    <AnimatePresence initial={false}>
      {lowCells.length > 0 && <Reveal key="note" reduced={ctx.reduced}>
        <div className={styles.note}>
          <p className={styles.noteText}>{lowCells.length === 1 ? "One cell is marked with low confidence." : `${lowCells.length} cells are marked with low confidence.`}</p>
          <button type="button" className={styles.noteButton} onClick={() => ctx.onCheck(field.key)}><Check aria-hidden="true" />Looks right</button>
        </div>
      </Reveal>}
    </AnimatePresence>
  </div>;
}

/** The schema's fields in their groups. Each group carries its series color on a small dot, its rows and its spans. */
export function FieldsForm({ schema, ctx }: { schema: ExtractSchema; ctx: FormContext }) {
  const groups = schema.groups?.length ? schema.groups : [];
  const sections: { key: string; label?: string; fields: typeof schema.fields }[] = groups.map(group => ({ key: group.key, label: group.label, fields: schema.fields.filter(field => field.group === group.key) }));
  const loose = schema.fields.filter(field => !field.group || !groups.some(group => group.key === field.group));
  if (loose.length) sections.push({ key: "__rest", fields: loose });
  return <div className={styles.form}>
    {sections.filter(section => section.fields.length).map(section => {
      const first = section.fields[0];
      // A group that is just one field of the same name, such as Line items, lets the field carry the dot instead of repeating its name.
      const solo = section.fields.length === 1 && first?.label === section.label;
      return <section key={section.key} className={styles.group} aria-label={section.label} data-solo={solo ? "" : undefined} style={toneStyle(first ? ctx.tones[first.key] : 1)}>
        {section.label && !solo && <p className={styles.groupHead} aria-hidden="true"><span className={styles.groupDot} />{section.label}</p>}
        {section.fields.map(field => field.type === "table" ? <TableField key={field.key} field={field} ctx={ctx} /> : <Field key={field.key} field={field} ctx={ctx} />)}
      </section>;
    })}
  </div>;
}

/* ---------------------------------------------------------------------------------------------------------------
 * JSON, lightly colored, one line per value so a line can point at its source
 * ------------------------------------------------------------------------------------------------------------- */

const tokenPattern = String.raw`("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)`;

function tokens(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const token = new RegExp(tokenPattern, "g");
  let last = 0, match: RegExpExecArray | null;
  while ((match = token.exec(text))) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    const kind = match[1] ? (match[2] ? "key" : "string") : match[3] ? "literal" : "number";
    parts.push(<span key={match.index} className={styles[`json_${kind}`]}>{match[1] ?? match[0]}</span>);
    if (match[2]) parts.push(match[2]);
    last = token.lastIndex;
  }
  parts.push(text.slice(last));
  return parts;
}

interface JsonLine { text: string; path?: string; leaf?: boolean }

function toLines(value: unknown): JsonLine[] {
  const lines: JsonLine[] = [];
  const walk = (item: unknown, indent: number, path: string | undefined, key: string | null, comma: boolean) => {
    const pad = "  ".repeat(indent), head = key !== null ? `${JSON.stringify(key)}: ` : "", tail = comma ? "," : "";
    if (Array.isArray(item) || (item && typeof item === "object")) {
      const entries: [string, unknown][] = Array.isArray(item) ? item.map((child, index) => [String(index), child]) : Object.entries(item as Record<string, unknown>);
      const [open, close] = Array.isArray(item) ? ["[", "]"] : ["{", "}"];
      if (!entries.length) { lines.push({ text: `${pad}${head}${open}${close}${tail}`, path }); return; }
      lines.push({ text: `${pad}${head}${open}`, path });
      entries.forEach(([childKey, child], index) => walk(child, indent + 1, path ? `${path}.${childKey}` : childKey, Array.isArray(item) ? null : childKey, index < entries.length - 1));
      lines.push({ text: `${pad}${close}${tail}`, path });
    } else lines.push({ text: `${pad}${head}${JSON.stringify(item)}${tail}`, path, leaf: true });
  };
  walk(value, 0, undefined, null, false);
  return lines;
}

export interface JsonLinking {
  activePath: string | null;
  tones: Record<string, number>;
  /** Edit count per path; a line flashes when its count changes while it is on screen. */
  edits: Record<string, number>;
  onHover: (path: string | null) => void;
  onSelect: (path: string) => void;
}

export function JsonView({ value, label, linking }: { value: unknown; label: string; linking?: JsonLinking }) {
  const lines = toLines(value);
  const pathFrom = (target: EventTarget) => (target as HTMLElement).closest<HTMLElement>("[data-link]")?.dataset.link ?? null;
  return <pre className={styles.code} aria-label={label} tabIndex={0} data-linked={linking ? "" : undefined}
    onPointerOver={linking ? event => { if (event.pointerType === "mouse") linking.onHover(pathFrom(event.target)); } : undefined}
    onPointerLeave={linking ? event => { if (event.pointerType === "mouse") linking.onHover(null); } : undefined}
    onClick={linking ? event => { const path = pathFrom(event.target); if (path) linking.onSelect(path); } : undefined}>
    <code>{lines.map((line, index) => {
      const top = line.path?.split(".")[0];
      const linked = !!linking && !!line.path;
      const edits = linked && line.leaf && line.path ? linking.edits[line.path] : undefined;
      return <span key={`${index}-${edits ?? 0}`} className={styles.jsonLine} data-link={linked ? line.path : undefined}
        data-active={linked && line.path && linking.activePath && (line.path === linking.activePath || line.path.startsWith(`${linking.activePath}.`)) ? "" : undefined}
        data-changed={edits ? "" : undefined} style={linked && top ? toneStyle(linking.tones[top]) : undefined}>{tokens(line.text)}</span>;
    })}</code>
  </pre>;
}
