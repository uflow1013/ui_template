/*
 * Sample content and pure helpers for the prompt studio: models, versions, test cases, simulated replies, variable
 * detection, token estimates, relative dates and the word diff. Nothing here touches the DOM, so it is safe anywhere.
 */

import { people } from "@/shared/arc/pro/lib/media";

/* ---------------------------------------------------------------------------------------------------------------
 * Types
 * ------------------------------------------------------------------------------------------------------------- */

export type Effort = "low" | "medium" | "high" | "xhigh" | "max";
export type ModelMarkId = "claude" | "openai" | "gemini";

export interface PromptModel {
  id: string;
  name: string;
  /** Shorter name for the chip, for example "Sonnet 5.5". */
  short: string;
  mark: ModelMarkId;
  /** US dollars per million input and output tokens. */
  input: number;
  output: number;
  /** Prices are illustrative, not published. */
  sample?: boolean;
  defaultEffort: Effort;
}

export interface PromptTemplate {
  system: string;
  user: string;
}

export interface PromptAuthor {
  name: string;
  avatar?: string;
}

export interface PromptVersion extends PromptTemplate {
  /** Stable id, for example "v4". */
  id: string;
  /** Short label shown in the chip and menu, for example "v4". */
  label: string;
  message: string;
  author: PromptAuthor;
  /** ISO date the version was saved. */
  createdAt: string;
}

export interface PromptTestCase {
  id: string;
  label: string;
  values: Record<string, string>;
}

export interface PromptRunRequest {
  /** The raw template, placeholders included. */
  template: PromptTemplate;
  /** The template with every {{variable}} replaced by its value. */
  rendered: PromptTemplate;
  values: Record<string, string>;
  model: PromptModel;
  effort: Effort;
  testCaseId: string;
  versionId: string;
}

/* ---------------------------------------------------------------------------------------------------------------
 * Models (current lineup, October 2026). Non-Anthropic prices are illustrative sample values.
 * ------------------------------------------------------------------------------------------------------------- */

export const studioModels: PromptModel[] = [
  { id: "claude-sonnet-5-5", name: "Claude Sonnet 5.5", short: "Sonnet 5.5", mark: "claude", input: 2, output: 10, defaultEffort: "high" },
  { id: "claude-opus-5-5", name: "Claude Opus 5.5", short: "Opus 5.5", mark: "claude", input: 4, output: 20, defaultEffort: "medium" },
  { id: "claude-haiku-5-5", name: "Claude Haiku 5.5", short: "Haiku 5.5", mark: "claude", input: .1, output: .5, defaultEffort: "medium" },
  { id: "gpt-6-1-sol", name: "GPT-6.1 Sol", short: "GPT-6.1 Sol", mark: "openai", input: 5, output: 30, sample: true, defaultEffort: "medium" },
  { id: "gemini-4-argon", name: "Gemini 4 Argon", short: "Gemini 4 Argon", mark: "gemini", input: 3.5, output: 21, sample: true, defaultEffort: "medium" },
];

export const efforts: Effort[] = ["low", "medium", "high", "xhigh", "max"];
export const effortLabel: Record<Effort, string> = { low: "Low", medium: "Medium", high: "High", xhigh: "Extra high", max: "Max" };
export const effortShort: Record<Effort, string> = { low: "Low", medium: "Med", high: "High", xhigh: "XHigh", max: "Max" };
/** Simulated time to first token per effort level, in milliseconds. */
export const effortThink: Record<Effort, number> = { low: 480, medium: 620, high: 780, xhigh: 960, max: 1150 };

/* ---------------------------------------------------------------------------------------------------------------
 * Versions of a support reply prompt
 * ------------------------------------------------------------------------------------------------------------- */

const person = (id: string): PromptAuthor => {
  const found = people.find(p => p.id === id);
  return { name: found?.name ?? id, avatar: found?.src };
};

const intro = "You are a support agent for Fernwood, an online home goods store.";
const greet = "- Greet {{customer_name}} by first name, once.";
const quote = "- Quote order {{order_id}} so they can find it.";
const dates = "- Never promise a date the carrier has not confirmed.";
const escalate = "- If the policy does not cover the request, offer to escalate to a team lead.";
const ask = "Reply to the latest message from {{customer_name}} about order {{order_id}}.";

export const sampleVersions: PromptVersion[] = [
  {
    id: "v4", label: "v4", createdAt: "2026-10-16T15:20:00Z", author: person("hannah-walsh"), message: "Escalate when the policy falls short",
    system: `${intro} Write a warm, specific reply in under 120 words.\n\nFollow this policy exactly: {{policy}}\n\n${greet}\n${quote}\n${dates}\n${escalate}`,
    user: `${ask} Sign off as Fernwood Support.`,
  },
  {
    id: "v3", label: "v3", createdAt: "2026-10-09T10:05:00Z", author: person("jordan-reyes"), message: "Shorter replies that quote the order",
    system: `${intro} Write a warm, specific reply in under 150 words.\n\nFollow this policy exactly: {{policy}}\n\n${greet}\n${quote}\n${dates}`,
    user: ask,
  },
  {
    id: "v2", label: "v2", createdAt: "2026-10-02T16:40:00Z", author: person("daniel-kim"), message: "Greet by name, no promised dates",
    system: `${intro} Reply politely and help with the order.\n\nFollow this policy exactly: {{policy}}\n\n${greet}\n${dates}`,
    user: ask,
  },
  {
    id: "v1", label: "v1", createdAt: "2026-09-24T09:15:00Z", author: person("hannah-walsh"), message: "First draft from the support macros",
    system: `${intro} Answer the customer politely.\n\nRefund policy: {{policy}}`,
    user: "Reply to {{customer_name}}.",
  },
];

/** Relative dates in the demo read from this moment, so the sample never ages. */
export const sampleNow = "2026-10-20T12:00:00Z";

/** Variables in the order their colors are assigned: --series-1 to --series-4, then around again. */
export const sampleVariables = ["customer_name", "order_id", "policy"];

/* ---------------------------------------------------------------------------------------------------------------
 * Test cases and simulated replies
 * ------------------------------------------------------------------------------------------------------------- */

export const sampleCases: PromptTestCase[] = [
  { id: "late", label: "Late order", values: { customer_name: "Priya Raman", order_id: "FW-48213", policy: "Orders more than 5 business days late get their shipping fee refunded." } },
  { id: "damaged", label: "Damaged", values: { customer_name: "Lukas Brandt", order_id: "FW-48377", policy: "Damaged items are replaced or refunded, whichever the customer prefers." } },
  { id: "window", label: "Past window", values: { customer_name: "Ana Souza", order_id: "FW-46902", policy: "Returns are accepted within 30 days of delivery." } },
];

const first = (name?: string) => (name ?? "").trim().split(/\s+/)[0] || "there";

/** Simulated replies, filled with the current values so an edited name or order shows up in the output. */
export function simulatedReply(caseId: string, values: Record<string, string>) {
  const name = first(values.customer_name);
  const order = values.order_id?.trim() || "your order";
  switch (caseId) {
    case "damaged":
      return `Hi ${name},\n\nI'm sorry your order arrived damaged. That's not how anything from Fernwood should reach you. I've set up a free replacement for order ${order}, and it ships as soon as the carrier collects it.\n\nThere's no need to send the damaged item back. If you'd rather have a refund instead, reply to this email and I'll switch it over today.\n\nFernwood Support`;
    case "window":
      return `Hi ${name},\n\nThanks for getting in touch about order ${order}. Our policy accepts returns within 30 days of delivery, and this order arrived in August, so it falls outside the standard window.\n\nI don't want to leave you without options, so I've asked a team lead to review your request. You'll hear back from them within one business day.\n\nFernwood Support`;
    default:
      return `Hi ${name},\n\nThanks for flagging this, and I'm sorry the wait has dragged on. I checked order ${order}: it left our warehouse on time, but the carrier hasn't posted a scan since Tuesday. I've opened a trace and will email you as soon as they confirm where it is.\n\nBecause the order is now more than 5 business days late, I've refunded your shipping fee. It should reach your card within 3 to 5 days.\n\nFernwood Support`;
  }
}

/* ---------------------------------------------------------------------------------------------------------------
 * Variables
 * ------------------------------------------------------------------------------------------------------------- */

/** A placeholder: {{name}}, with optional inner spaces. Names start with a letter or underscore. */
export const variablePattern = /\{\{\s*([A-Za-z_]\w*)\s*\}\}/g;

export type TemplatePart = { type: "text"; text: string; start: number } | { type: "var"; name: string; start: number; end: number };

export function tokenize(value: string): TemplatePart[] {
  const parts: TemplatePart[] = [];
  let last = 0;
  for (const match of value.matchAll(variablePattern)) {
    const start = match.index ?? 0;
    if (start > last) parts.push({ type: "text", text: value.slice(last, start), start: last });
    parts.push({ type: "var", name: match[1], start, end: start + match[0].length });
    last = start + match[0].length;
  }
  if (last < value.length) parts.push({ type: "text", text: value.slice(last), start: last });
  return parts;
}

/** Writes every placeholder as {{name}} without inner spaces. */
export const normalizeTemplate = (value: string) => value.replace(variablePattern, "{{$1}}");

/** Variables in order of first appearance across the given texts. */
export function detectVariables(...texts: string[]) {
  const seen: string[] = [];
  for (const text of texts) for (const match of text.matchAll(variablePattern)) if (!seen.includes(match[1])) seen.push(match[1]);
  return seen;
}

export const renderTemplate = (value: string, values: Record<string, string>) =>
  value.replace(variablePattern, (whole, name: string) => values[name]?.trim() ? values[name] : whole);

/* ---------------------------------------------------------------------------------------------------------------
 * Tokens, cost and time (estimates: about four characters per token for English prose)
 * ------------------------------------------------------------------------------------------------------------- */

export function estimateTokens(text: string) {
  if (!text.trim()) return 0;
  const words = text.trim().split(/\s+/).length;
  return Math.max(1, Math.round(text.length / 4.2 + words * .12));
}

export function formatCost(dollars: number) {
  if (dollars <= 0) return "$0.00";
  if (dollars < .0001) return "<$0.0001";
  return `$${dollars < .1 ? dollars.toFixed(4) : dollars.toFixed(3)}`;
}

export const formatSeconds = (ms: number) => `${(ms / 1000).toFixed(2)} s`;

export function formatPrice(dollars: number) {
  return `$${dollars < 1 ? dollars.toFixed(2) : Number.isInteger(dollars) ? dollars : dollars.toFixed(2)}`;
}

const relative = new Intl.RelativeTimeFormat("en-US", { numeric: "auto" });

/** "4 days ago", "last week", "3 weeks ago", from an ISO date and a reference moment. */
export function relativeDate(iso: string, now: number) {
  const days = Math.floor((now - Date.parse(iso)) / 86_400_000);
  if (days < 1) return "today";
  if (days < 7) return relative.format(-days, "day");
  if (days < 30) return relative.format(-Math.floor(days / 7), "week");
  if (days < 365) return relative.format(-Math.floor(days / 30), "month");
  return relative.format(-Math.floor(days / 365), "year");
}

/* ---------------------------------------------------------------------------------------------------------------
 * Word diff (longest common subsequence over words, whitespace and whole placeholders)
 * ------------------------------------------------------------------------------------------------------------- */

export type DiffOp = { type: "same" | "add" | "remove"; text: string };

const diffTokens = (text: string) => text.match(/\{\{\s*[A-Za-z_]\w*\s*\}\}|\s+|[^\s{]+|\{/g) ?? [];

export function wordDiff(before: string, after: string): DiffOp[] {
  const a = diffTokens(before), b = diffTokens(after);
  // Trim the shared start and end first: most edits touch a few lines, so the table stays small.
  let head = 0;
  while (head < a.length && head < b.length && a[head] === b[head]) head++;
  let tail = 0;
  while (tail < a.length - head && tail < b.length - head && a[a.length - 1 - tail] === b[b.length - 1 - tail]) tail++;
  const midA = a.slice(head, a.length - tail), midB = b.slice(head, b.length - tail);
  const n = midA.length, m = midB.length;
  const table = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) {
    table[i][j] = midA[i] === midB[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
  }
  const raw: DiffOp[] = [];
  const push = (type: DiffOp["type"], text: string) => {
    const last = raw[raw.length - 1];
    if (last && last.type === type) last.text += text;
    else raw.push({ type, text });
  };
  if (head) push("same", a.slice(0, head).join(""));
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (midA[i] === midB[j]) { push("same", midA[i]); i++; j++; }
    else if (table[i + 1][j] >= table[i][j + 1]) { push("remove", midA[i]); i++; }
    else { push("add", midB[j]); j++; }
  }
  while (i < n) push("remove", midA[i++]);
  while (j < m) push("add", midB[j++]);
  if (tail) push("same", a.slice(a.length - tail).join(""));
  return tidyDiff(raw);
}

/** Folds each run of changes into one removal then one addition, so a replacement reads old then new. A lone space kept
 *  between two changes would split one edit into four marks, so it joins both sides of the run instead. */
function tidyDiff(ops: DiffOp[]): DiffOp[] {
  const out: DiffOp[] = [];
  let removed = "", added = "";
  const flush = () => {
    if (removed && (removed.trim() || !added)) out.push({ type: "remove", text: removed });
    if (added && (added.trim() || !removed)) out.push({ type: "add", text: added });
    removed = added = "";
  };
  ops.forEach((op, k) => {
    if (op.type === "remove") removed += op.text;
    else if (op.type === "add") added += op.text;
    else if ((removed || added) && /^[ \t]+$/.test(op.text) && ops[k + 1] && ops[k + 1].type !== "same") { removed += op.text; added += op.text; }
    else {
      flush();
      const last = out[out.length - 1];
      if (last?.type === "same") last.text += op.text;
      else out.push({ ...op });
    }
  });
  flush();
  return out;
}

export function diffStats(ops: DiffOp[]) {
  const count = (type: DiffOp["type"]) => ops.filter(o => o.type === type).reduce((sum, o) => sum + (o.text.trim() ? o.text.trim().split(/\s+/).length : 0), 0);
  return { added: count("add"), removed: count("remove") };
}
