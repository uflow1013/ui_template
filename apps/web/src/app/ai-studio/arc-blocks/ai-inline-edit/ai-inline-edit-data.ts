/**
 * Scripted content for the AI inline edit preview. A real editor passes onRequestEdit and onSuggest to call a model; both
 * receive the same requests these functions do and return the same shapes: streamed replacement text and one completion.
 */

import { mediaUrl } from "@/shared/arc/pro/lib/media";

export interface EditorDocument {
  title: string;
  paragraphs: string[];
}

export interface EditRequest {
  /** The selected text to rewrite. */
  text: string;
  /** What to do with it, in plain words. */
  instruction: string;
  /** The quick action id when one was picked, such as "shorten". */
  action?: string;
  /** Text in the same paragraph before and after the selection, for context. */
  before: string;
  after: string;
  /** Zero based paragraph index. */
  paragraph: number;
}

export interface CompletionRequest {
  /** The paragraph up to the caret. */
  before: string;
  paragraph: number;
  document: EditorDocument;
}

export interface QuickAction {
  id: string;
  label: string;
  /** Sent as the instruction when the action is picked. */
  instruction: string;
}

export const sampleAuthor = { name: "Chloe Nguyen", photo: mediaUrl("/media/people/chloe-nguyen.svg") };

export const sampleDocument: EditorDocument = {
  title: "Offline mode launch plan",
  paragraphs: [
    "We are going to be launching offline mode for the Field app on October 14. This is a really big release for us, and it basically touches every single part of the sync engine, so we want to be very careful about how we actually roll it out to customers.",
    "Crews in rural areas has been asking for this for over a year. Right now, if a technician loses signal in the middle of an inspection, the form just stops saving and they have to start over when they get back into coverage, which is honestly a really frustrating experience.",
    "The rollout happens in three stages. Internal teams and 20 pilot customers get access on October 14. We expand to every Business plan on October 28 if the sync error rate stays under 0.5 percent, and offline mode becomes the default for everyone in November.",
    "Support should expect questions about conflicts, where two people edits the same record while offline. The app keeps both versions and asks the last person to sync which one to keep, so nothing is lost silently.",
    "Next week we will",
  ],
};

export const quickActions: QuickAction[] = [
  { id: "shorten", label: "Shorten", instruction: "Make this shorter without losing facts" },
  { id: "clearer", label: "Make clearer", instruction: "Rewrite this so it is easier to follow" },
  { id: "friendly", label: "Friendlier tone", instruction: "Make the tone warmer and more casual" },
  { id: "formal", label: "More formal", instruction: "Make the tone more formal" },
  { id: "grammar", label: "Fix grammar", instruction: "Fix spelling and grammar only" },
];

/* ---------------------------------------------------------------------------------------------------------------
 * Rewrites. Whole sentences the preview knows get a hand written rewrite; anything else goes through small phrase rules,
 * so every selection gets a sensible, reviewable diff.
 * ------------------------------------------------------------------------------------------------------------- */

const written: Record<string, Partial<Record<string, string>>> = {
  "We are going to be launching offline mode for the Field app on October 14.": {
    shorten: "Offline mode for the Field app launches October 14.",
    clearer: "We launch offline mode for the Field app on October 14.",
    friendly: "Offline mode lands in the Field app on October 14!",
    formal: "Offline mode for the Field app will launch on October 14.",
  },
  "This is a really big release for us, and it basically touches every single part of the sync engine, so we want to be very careful about how we actually roll it out to customers.": {
    shorten: "It changes every part of the sync engine, so we will roll it out carefully.",
    clearer: "The release changes every part of the sync engine, so we will roll it out to customers in careful stages.",
    friendly: "It's a big one: it touches every part of the sync engine, so we're rolling it out carefully.",
    formal: "This is a significant release that affects every part of the sync engine, so we will roll it out to customers with care.",
  },
  "Right now, if a technician loses signal in the middle of an inspection, the form just stops saving and they have to start over when they get back into coverage, which is honestly a really frustrating experience.": {
    shorten: "Today, a technician who loses signal mid inspection loses the form and has to start over.",
    clearer: "Today, when a technician loses signal during an inspection, the form stops saving. They have to start again once they are back in coverage.",
    friendly: "Right now, if a technician loses signal mid inspection, the form stops saving and they have to start over. That's no fun.",
    formal: "At present, if a technician loses signal during an inspection, the form stops saving and must be restarted once coverage returns.",
  },
};

type Rule = [RegExp, string];
const rules: Record<string, Rule[]> = {
  shorten: [
    [/\bgoing to be (\w+ing)\b/gi, "$1"], [/\bin the middle of\b/gi, "during"], [/\bevery single\b/gi, "every"], [/\bfor over a year\b/gi, "for a year"],
    [/,? which is honestly a really frustrating experience/gi, ""], [/\b(really|basically|actually|honestly|just|very) /gi, ""],
    [/\bin order to\b/gi, "to"], [/\bat this point in time\b/gi, "now"], [/\bif the sync error rate stays under\b/gi, "if sync errors stay under"],
    [/\bshould expect questions about\b/gi, "will get questions about"], [/, so nothing is lost silently/gi, ""],
  ],
  clearer: [
    [/\bget back into coverage\b/gi, "regain signal"], [/\btouches every single part of\b/gi, "changes all of"], [/\bbasically /gi, ""],
    [/\bconflicts, where\b/gi, "sync conflicts, which happen when"], [/\bthe last person to sync\b/gi, "whoever syncs last"],
    [/\bthe default\b/gi, "on by default"], [/\bThe rollout happens\b/g, "We will roll it out"],
  ],
  friendly: [
    [/\bWe are\b/g, "We're"], [/\bwe are\b/g, "we're"], [/\bwe will\b/gi, "we'll"], [/\bIt is\b/g, "It's"], [/\bit is\b/g, "it's"], [/\bdo not\b/gi, "don't"],
    [/\bSupport should expect\b/g, "Support will probably hear"], [/\bso nothing is lost silently\b/gi, "so nobody loses their work"], [/\bThe app keeps\b/g, "The app hangs on to"],
  ],
  formal: [
    [/\bWe're\b/g, "We are"], [/\bwe'll\b/gi, "we will"], [/\bit's\b/gi, "it is"], [/\bdon't\b/gi, "do not"], [/\b(really|basically|honestly|just) /gi, ""],
    [/\bhas been asking for\b/gi, "have requested"], [/\bhave been asking for\b/gi, "have requested"], [/\bget access\b/gi, "receive access"], [/\bexpect questions about\b/gi, "anticipate questions regarding"],
  ],
  grammar: [[/\bCrews in rural areas has\b/g, "Crews in rural areas have"], [/\btwo people edits\b/g, "two people edit"], [/\s{2,}/g, " "]],
};

function pickRules(action: string | undefined, instruction: string) {
  if (action && rules[action]) return action;
  const text = instruction.toLowerCase();
  if (/short|concise|trim|tight/.test(text)) return "shorten";
  if (/formal|professional/.test(text)) return "formal";
  if (/friend|casual|warm/.test(text)) return "friendly";
  if (/grammar|spell|typo|fix/.test(text)) return "grammar";
  return "clearer";
}

/** The rewrite the preview suggests for a request. Returns the text unchanged when nothing applies. */
export function scriptedRewrite(request: EditRequest) {
  const kind = pickRules(request.action, request.instruction);
  const sentences = request.text.match(/[^.!?]+[.!?]+["”)]?\s*|[^.!?]+$/g) ?? [request.text];
  let out = sentences.map(sentence => {
    const trimmed = sentence.trim(), trailing = sentence.slice(sentence.trimEnd().length);
    const hand = written[trimmed]?.[kind];
    if (hand) return hand + trailing;
    return rules[kind].reduce((text, [pattern, value]) => text.replace(pattern, value), sentence);
  }).join("");
  if (kind !== "grammar") out = rules.grammar.reduce((text, [pattern, value]) => text.replace(pattern, value), out);
  return out.replace(/\s+([,.])/g, "$1").replace(/^\s*(\w)/, (_, ch: string) => /^[a-z]/.test(request.text.trim()) ? ch : ch.toUpperCase());
}

const sleep = (ms: number, signal: AbortSignal) => new Promise<void>((resolve, reject) => {
  if (signal.aborted) return reject(signal.reason);
  const id = window.setTimeout(() => { signal.removeEventListener("abort", stop); resolve(); }, ms);
  const stop = () => { window.clearTimeout(id); reject(signal.reason); };
  signal.addEventListener("abort", stop, { once: true });
});

/** Streams the scripted rewrite in uneven network sized pieces, sometimes splitting words, the way a model stream arrives. */
export async function* scriptedEdit(request: EditRequest, signal: AbortSignal): AsyncGenerator<string> {
  const text = scriptedRewrite(request);
  await sleep(420 + Math.random() * 200, signal);
  let i = 0, n = 0;
  while (i < text.length) {
    const size = 2 + Math.floor(Math.random() * 9);
    yield text.slice(i, i + size);
    i += size;
    await sleep(n++ % 13 === 7 ? 260 : 30 + Math.random() * 70, signal);
  }
}

const completions: [RegExp, string][] = [
  [/next week we will\s*$/i, "share the support macros and a short walkthrough video, so the team can answer conflict questions before the pilot starts."],
  [/\bwe will\s*$/i, "check in with every pilot customer during the first week."],
  [/\bsupport\s*$/i, "will get a preview build on October 7."],
  [/\bpilot\s*$/i, "customers will get a direct line to the Field team."],
  [/\bthe\s*$/i, "pilot group gets a feedback form inside the app."],
];
const nextSentences = [
  "Everything a technician captures offline syncs automatically once the device is back online.",
  "Pilot customers were picked from the crews who reported the most dropped forms.",
  "We will review the error rate every Monday and can pause the rollout at any stage.",
  "The help center article goes live on launch day.",
];

/** One completion for the text before the caret, or null. The preview matches a few endings and offers a next sentence. */
export async function scriptedCompletion(request: CompletionRequest, signal: AbortSignal): Promise<string | null> {
  await sleep(260, signal);
  const before = request.before;
  const hit = completions.find(([pattern]) => pattern.test(before));
  if (hit) return (/\s$/.test(before) ? "" : " ") + hit[1];
  if (/[.!?]\s*$/.test(before) && before.length > 40) {
    const used = request.document.paragraphs.join(" ");
    const next = nextSentences.find(sentence => !used.includes(sentence));
    return next ? (/\s$/.test(before) ? "" : " ") + next : null;
  }
  return null;
}
