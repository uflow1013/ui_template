/*
 * Eval suite: types, the sample suite (120 support agent cases in five categories), simulated v12 results, the run
 * history and small helpers (scores, deltas, word diff, formatting). Everything here is sample content.
 */
import type { ReactNode } from "react";

export type Outcome = "pass" | "fail" | "error";
export type CaseFilter = "all" | "failed" | "regressions" | "improved";
export type TriageAction = "expected" | "issue";

export interface EvalModel {
  name: string;
  /** Built-in mark. Pass `mark` instead for any other provider. */
  brand?: "claude" | "openai";
  mark?: ReactNode;
}

export interface EvalCase {
  id: string;
  category: string;
  title: string;
  /** Outcome on the baseline version. */
  baseline: Outcome;
  /** The drilldown fields. A case without `input` lists without a drilldown. */
  input?: string;
  expected?: string;
  baselineOutput?: string;
  /** Judge scores for the baseline, one per rubric criterion, 1 to 5. */
  baselineScores?: number[];
}

export interface EvalSuiteData {
  /** The feature under test, such as "Support agent". */
  name: string;
  candidate: { version: string; model: EvalModel };
  baseline: { version: string; model: EvalModel };
  judge: EvalModel;
  /** Category order for the rows. Defaults to the order cases first use them. */
  categories?: string[];
  /** Rubric criteria the judge scores, 1 to 5 each. */
  rubric?: string[];
  cases: EvalCase[];
  /** Shown before the first run. */
  estimate?: { costUsd: number; seconds: number };
}

export interface EvalCaseResult {
  caseId: string;
  outcome: Outcome;
  /** The candidate's reply, diffed against `baselineOutput`. */
  output?: string;
  /** Judge scores for the candidate, one per rubric criterion. */
  scores?: number[];
  rationale?: string;
  /** Why the case could not be scored. */
  error?: string;
  costUsd?: number;
}

export interface EvalRunRecord { id: string; label: string; score: number; date?: string }

/* ---------------------------------------------------------------------------------------------------------------
 * Sample suite
 * ------------------------------------------------------------------------------------------------------------- */

const P = "pass", F = "fail", E = "error";
type Code = typeof P | typeof F | typeof E;
/** [title, v11 outcome, simulated v12 outcome] */
type Row = [string, Code, Code];

const rows: Record<string, Row[]> = {
  Refunds: [
    ["Refund for a damaged blender", P, P], ["Refund after partial shipment", P, F], ["Refund outside the 30 day window", F, F],
    ["Duplicate charge on one order", P, P], ["Refund to an expired card", P, F], ["Gift card purchase refund", P, P],
    ["Refund for a late delivery", P, P], ["Return label never arrived", P, P], ["Refund for an opened item", P, P],
    ["Store credit instead of a refund", P, P], ["Refund status after 10 days", P, P], ["Cancel and refund a preorder", P, P],
    ["Refund for a missing accessory", P, P], ["Partial refund on a bundle", P, F], ["Refund in a different currency", P, P],
    ["Refund after a price drop", P, P], ["Subscription refund mid cycle", P, F], ["Refund for the wrong size", P, P],
    ["Chargeback already filed", F, F], ["Refund for a final sale item", P, P], ["Refund to a closed account", P, P],
    ["Shipping fee refund", P, P], ["Refund for a recalled kettle", P, P], ["Refund split across two cards", P, P],
  ],
  Shipping: [
    ["Delivered but not received", P, P], ["Change address after dispatch", P, P], ["Express upgrade on an open order", P, P],
    ["Customs fees on an EU order", F, P], ["Tracking stuck for 6 days", P, P], ["Ship to a parcel locker", P, P],
    ["Split shipment arriving apart", P, P], ["Delivery window for Zurich", P, P], ["Lost package claim", F, P],
    ["Wrong item in the box", P, P], ["Shipping to a PO box", P, P], ["Holiday cutoff dates", P, P],
    ["Left with a neighbor", P, P], ["Damaged outer box", P, P], ["International shipping rates", P, P],
    ["Reschedule a delivery", P, P], ["Signature required delivery", P, P], ["Not shipped after 5 days", P, P],
    ["Combine two orders", P, P], ["Oversized item freight", F, F], ["Return pickup scheduling", P, P],
    ["Pickup point opening hours", P, P], ["Shipping to a hotel", P, P], ["Backordered item date", P, P],
  ],
  Tone: [
    ["Angry customer, third contact", P, P], ["Customer writes in German", F, P], ["Sarcastic complaint about delays", P, P],
    ["Thank you message only", P, P], ["Customer mentions a bereavement", F, P], ["Message written in capitals", P, P],
    ["Threat of a bad review", P, P], ["Unclear request from an older customer", P, P], ["Customer uses profanity", P, P],
    ["One word replies", P, P], ["Customer asks for a human", F, F], ["Apology for a repeated mistake", P, P],
    ["Comparison to a competitor", P, P], ["Very long, rambling message", P, P], ["Customer in a hurry", P, P],
    ["Polite follow-up after silence", P, P], ["Customer shares a medical need", P, P], ["Joke in the opening line", P, P],
    ["Frustrated by bots", P, P], ["Formal business inquiry", P, P], ["Parent asks about a teen's order", P, P],
    ["Customer corrects the agent", P, P], ["Mixed English and Spanish", F, P], ["Praise with a small complaint", P, P],
  ],
  Escalation: [
    ["Legal threat over a refund", P, F], ["Suspected account takeover", F, P], ["Injury from a product", P, P],
    ["Press inquiry", P, P], ["Repeated failed deliveries", P, P], ["Request for a manager", P, P],
    ["Data deletion request", F, P], ["Fraudulent order report", P, P], ["Bulk order over 50 units", P, P],
    ["Safety recall question", P, P], ["Payment dispute", P, P], ["Complaint from a key account", P, P],
    ["Accessibility complaint", P, P], ["Courier harassment report", P, P], ["Order over $5,000", P, P],
    ["Agent loop, fourth attempt", E, F], ["Warranty claim denied twice", P, P], ["Duplicate account merge", P, P],
    ["Chargeback threat", P, P], ["Reseller partner issue", P, P], ["Staff conduct report", P, P],
    ["Allergic reaction report", P, P], ["Subpoena for order records", F, F], ["Complaint to a regulator", F, F],
  ],
  "Tool use": [
    ["Look up an order by email", P, P], ["Issue a refund with the payments tool", P, P], ["Create a return label", P, P],
    ["Check stock in two warehouses", P, P], ["Update a shipping address", P, P], ["Apply a discount code", P, P],
    ["Cancel a subscription", P, P], ["Fetch tracking events", P, P], ["Search the help center", P, P],
    ["Merge duplicate tickets", P, P], ["Verify identity before changes", P, P], ["Retry after a tool timeout", F, P],
    ["Handle an empty search result", P, P], ["Chain a lookup and a refund", P, P], ["Tool returns malformed JSON", E, P],
    ["Skip tools for a simple question", P, P], ["Pass the right order id", P, P], ["Paginate order history", F, P],
    ["Confirm before a destructive call", P, F], ["Parallel lookups for two orders", F, E], ["Read a PDF invoice", P, P],
    ["Rate limited payments API", E, E], ["Choose between two tools", F, P], ["Summarize tool output", P, P],
  ],
};

const slug: Record<string, string> = { Refunds: "refunds", Shipping: "shipping", Tone: "tone", Escalation: "escalation", "Tool use": "tools" };
const caseId = (category: string, index: number) => `${slug[category] ?? category.toLowerCase()}-${String(index + 1).padStart(2, "0")}`;

export const sampleRubric = ["Correctness", "Policy", "Tone", "Completeness"];

/** Drilldown content, keyed by case id: the input, the expected behavior, both outputs, both sets of judge scores. */
interface Detail { input: string; expected: string; baselineOutput: string; baselineScores: number[]; output?: string; scores?: number[]; rationale?: string; error?: string }

const details: Record<string, Detail> = {
  "refunds-02": {
    input: "Only 2 of my 3 items arrived (order #48213). The candle set is still missing. Can I get my money back for that part?",
    expected: "Refund only the missing candle set ($34.00), not the whole order, and give the 5 to 7 business day timeline.",
    baselineOutput: "I'm sorry the candle set hasn't arrived. I've refunded $34.00 for it to your original payment method, and you'll see it within 5 to 7 business days. The other two items are yours to keep.",
    output: "I'm sorry the candle set hasn't arrived. I've refunded $112.50 for order #48213 to your original payment method, and you'll see it within 5 to 7 business days.",
    baselineScores: [5, 5, 4, 5], scores: [1, 1, 4, 3],
    rationale: "v12 refunds the full order total ($112.50) when only the candle set ($34.00) was missing. The refund policy covers undelivered items only. Tone is unchanged. Three other refund cases show the same full refund pattern.",
  },
  "refunds-05": {
    input: "You refunded my order but the card I used expired last month. Where does the money go?",
    expected: "Explain that the bank routes the refund to the account behind the expired card, and offer store credit if it does not arrive. Never ask for card details.",
    baselineOutput: "Good question. Refunds to an expired card are still routed by your bank to the same account. If it hasn't appeared after 10 business days, I can send it as store credit instead.",
    output: "No problem. Reply with your new card number and expiry date and I'll move the refund over to it.",
    baselineScores: [4, 5, 4, 4], scores: [2, 1, 4, 2],
    rationale: "v12 asks the customer to send a full card number in chat, which breaks the payment data policy. v11 explained the bank reroute and offered store credit.",
  },
  "refunds-14": {
    input: "I returned just the mouse from the desk bundle. How much will I get back?",
    expected: "Refund the mouse at its share of the bundle price ($18.40), not its standalone price.",
    baselineOutput: "Since the mouse was part of the desk bundle, your refund is its share of the bundle price: $18.40. It will reach your card within 5 to 7 business days.",
    output: "You'll get $29.00 back for the mouse, its regular price. It will reach your card within 5 to 7 business days.",
    baselineScores: [5, 5, 4, 5], scores: [2, 2, 4, 4],
    rationale: "v12 refunds the standalone price instead of the mouse's share of the bundle, $10.60 too much. The timeline is correct.",
  },
  "refunds-17": {
    input: "I cancelled my coffee subscription halfway through the month. Do I get anything back?",
    expected: "Refund the unused half of the month ($12.00) and confirm the cancellation date.",
    baselineOutput: "Your subscription was cancelled on October 14, halfway through the cycle, so I've refunded the unused part: $12.00.",
    output: "Your subscription was cancelled on October 14. I've refunded your full monthly charge of $24.00.",
    baselineScores: [5, 5, 4, 5], scores: [2, 1, 4, 4],
    rationale: "v12 refunds the whole month instead of the unused half. It is the same full refund pattern as the partial shipment case.",
  },
  "escalation-01": {
    input: "This is the third time I'm asking. If the refund isn't processed today my lawyer will be in touch.",
    expected: "Acknowledge, make no promises about the outcome, and hand off to the escalations team with a summary of the ticket.",
    baselineOutput: "I understand, and I'm sorry this has taken three contacts. I'm passing your case to our escalations team now with the full history, and they will reply today.",
    output: "I understand your frustration. Your refund of $64.00 has been processed and should arrive in 5 to 7 business days, so there's no need to involve a lawyer.",
    baselineScores: [5, 5, 5, 4], scores: [2, 1, 3, 3],
    rationale: "A legal threat must go to the escalations team. v12 handles it alone, promises a refund it has not verified and comments on the lawyer, which the policy rules out.",
  },
  "tools-19": {
    input: "Cancel my subscription, I guess. Or maybe pause it? Not sure.",
    expected: "Ask whether to pause or cancel before calling cancel_subscription.",
    baselineOutput: "Happy to help. Would you like to pause it for up to 3 months, or cancel it completely? Pausing keeps your current price.",
    output: "Done. I've cancelled your subscription, and you won't be charged again.",
    baselineScores: [4, 5, 4, 4], scores: [1, 1, 4, 2],
    rationale: "The customer was unsure, yet v12 called cancel_subscription without asking. The policy requires a confirmation before any irreversible tool call.",
  },
  "tone-02": {
    input: "Hallo, meine Bestellung ist noch nicht angekommen. Können Sie bitte nachsehen?",
    expected: "Reply in German with the order status and the delivery date.",
    baselineOutput: "Hi! Your order #51022 shipped on October 15 and should arrive on October 21.",
    output: "Hallo! Ihre Bestellung #51022 wurde am 15. Oktober versandt und sollte am 21. Oktober ankommen.",
    baselineScores: [4, 3, 2, 4], scores: [5, 5, 5, 5],
    rationale: "v12 answers in the customer's language, as the tone guide asks. v11 had the right facts but replied in English.",
  },
  "tools-12": {
    input: "Where is order #49870? It said out for delivery this morning.",
    expected: "Retry the order lookup once after a timeout, then give the status.",
    baselineOutput: "Sorry, I couldn't look up your order right now. Please try again later.",
    output: "The first lookup timed out, so I tried again. Order #49870 is out for delivery and should arrive by 6 pm today.",
    baselineScores: [2, 4, 4, 2], scores: [5, 5, 4, 5],
    rationale: "v12 retries the timed out lookup once and answers. v11 gave up after the first timeout.",
  },
  "tools-20": {
    input: "Can you check orders #50112 and #50177? Both were meant to come this week.",
    expected: "Look up both orders, in parallel if possible, and give the status of each.",
    baselineOutput: "Order #50112 arrives tomorrow. I couldn't find order #50177; could you check the number?",
    baselineScores: [3, 5, 4, 2],
    error: "orders.lookup timed out after 30 s on the second call, so the judge had no reply to score.",
  },
};

/** Cost per case for the candidate plus the judge, in dollars. Varies a little by case. */
const costOf = (index: number) => .0212 + ((index * 37) % 11) * .0008;

function buildSample() {
  const cases: EvalCase[] = [];
  const results: Record<string, EvalCaseResult> = {};
  let n = 0;
  for (const [category, list] of Object.entries(rows)) {
    list.forEach(([title, before, after], index) => {
      const id = caseId(category, index);
      const detail = details[id];
      cases.push({ id, category, title, baseline: before, ...(detail ? { input: detail.input, expected: detail.expected, baselineOutput: detail.baselineOutput, baselineScores: detail.baselineScores } : {}) });
      results[id] = { caseId: id, outcome: after, costUsd: costOf(n++), ...(detail ? { output: detail.output, scores: detail.scores, rationale: detail.rationale, error: detail.error } : {}) };
    });
  }
  return { cases, results };
}

const built = buildSample();

export const sampleSuite: EvalSuiteData = {
  name: "Support agent",
  candidate: { version: "v12", model: { name: "Claude Sonnet 5.5", brand: "claude" } },
  baseline: { version: "v11", model: { name: "GPT-6 Luna", brand: "openai" } },
  judge: { name: "Claude Opus 5.5", brand: "claude" },
  categories: Object.keys(rows),
  rubric: sampleRubric,
  cases: built.cases,
  estimate: { costUsd: 2.9, seconds: 190 },
};

/** What the simulated v12 run returns for each case. */
export const sampleResults = built.results;

/** Earlier runs of the suite, oldest first. The baseline is the last one. */
export const sampleRuns: EvalRunRecord[] = [
  { id: "run-v5", label: "v5", score: 76.7, date: "Sep 8" },
  { id: "run-v6", label: "v6", score: 79.2, date: "Sep 15" },
  { id: "run-v7", label: "v7", score: 78.3, date: "Sep 22" },
  { id: "run-v8", label: "v8", score: 81.7, date: "Sep 29" },
  { id: "run-v9", label: "v9", score: 80.8, date: "Oct 6" },
  { id: "run-v10", label: "v10", score: 82.5, date: "Oct 13" },
  { id: "run-v11", label: "v11", score: 83.3, date: "Oct 17" },
];

/* ---------------------------------------------------------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------------------------------------------------------- */

export const isPass = (outcome: Outcome | undefined) => outcome === "pass";
export const percent = (part: number, whole: number) => whole ? (part / whole) * 100 : 0;

/** Points with one decimal and a true minus sign: "+4.2", "−16.7", "0.0". */
export function formatDelta(value: number) {
  const rounded = Math.round(value * 10) / 10;
  if (rounded === 0) return "0.0";
  return `${rounded > 0 ? "+" : "−"}${Math.abs(rounded).toFixed(1)}`;
}

export const formatCost = (usd: number) => `$${usd.toFixed(2)}`;

export function formatDuration(seconds: number) {
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  return m ? `${m}m ${String(s % 60).padStart(2, "0")}s` : `${s}s`;
}

export const outcomeLabel: Record<Outcome, string> = { pass: "Pass", fail: "Fail", error: "Error" };

/** A run of words both versions share, or a change: what the baseline said there and what the candidate says instead. */
export interface DiffPart { type: "same" | "change"; before: string; after: string }

/**
 * Word diff: longest common subsequence over words (compared without their trailing space), then a cleanup pass that
 * folds a single shared word sitting between two changes into one change, so the highlights read as phrases instead of
 * confetti. `rewritten` is true when the replies share too little for highlights to help.
 */
export function wordDiff(before: string, after: string): { parts: DiffPart[]; rewritten: boolean } {
  const a = before.match(/\S+\s*/g) ?? [], b = after.match(/\S+\s*/g) ?? [];
  const same = (i: number, j: number) => a[i].trimEnd() === b[j].trimEnd();
  const table: number[][] = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) for (let j = b.length - 1; j >= 0; j--) {
    table[i][j] = same(i, j) ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
  }
  let parts: DiffPart[] = [];
  const push = (type: DiffPart["type"], from = "", to = "") => {
    const last = parts[parts.length - 1];
    if (last && last.type === type) { last.before += from; last.after += to; } else parts.push({ type, before: from, after: to });
  };
  let i = 0, j = 0;
  while (i < a.length && j < b.length) {
    if (same(i, j)) { push("same", a[i++], b[j++]); }
    else if (table[i + 1][j] >= table[i][j + 1]) push("change", a[i++]);
    else push("change", "", b[j++]);
  }
  while (i < a.length) push("change", a[i++]);
  while (j < b.length) push("change", "", b[j++]);

  for (let changed = true; changed;) {
    changed = false;
    for (let k = 1; k < parts.length - 1; k++) {
      const part = parts[k];
      if (part.type !== "same" || part.before.trim().split(/\s+/).length > 1 || parts[k - 1].type !== "change" || parts[k + 1].type !== "change") continue;
      const prev = parts[k - 1], next = parts[k + 1];
      parts = [...parts.slice(0, k - 1), { type: "change", before: prev.before + part.before + next.before, after: prev.after + part.after + next.after }, ...parts.slice(k + 2)];
      changed = true;
      break;
    }
  }
  const shared = parts.reduce((sum, part) => sum + (part.type === "same" ? part.after.length : 0), 0);
  return { parts, rewritten: shared / Math.max(1, before.length, after.length) < .3 };
}
