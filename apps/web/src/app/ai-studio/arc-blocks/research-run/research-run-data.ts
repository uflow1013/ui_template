/**
 * Scripted research for the preview. A real pipeline yields the same ResearchEvent stream from onAsk: plan the query, search,
 * read sources, then stream the answer as a small markdown subset where `[n]` cites the nth source that arrived.
 */

export interface ResearchSource {
  id: string;
  title: string;
  /** Shown beside the mark. */
  domain: string;
  url: string;
  /** URL of a monochrome mark, drawn in the text color. Leave out to show the domain's first letter. */
  logo?: string;
  /** One or two lines shown when the source is opened in the list. */
  snippet?: string;
  /** Publication date or year, shown in the source list. */
  date?: string;
}

export type ResearchEvent =
  /** The query broken into sub-queries. */
  | { type: "plan"; queries: string[] }
  /** A sub-query started searching. */
  | { type: "search"; query: number }
  /** A sub-query finished with this many results. */
  | { type: "searched"; query: number; results: number }
  /** A source was picked for reading. Sources are numbered in the order they arrive; `[n]` in the answer cites the nth. */
  | { type: "source"; source: ResearchSource; query?: number }
  /** Reading progress for a source, from 0 to 1. */
  | { type: "read"; id: string; progress: number }
  /** A piece of the answer. Deltas can split words; the block only ever shows whole words. */
  | { type: "text"; delta: string }
  | { type: "followUps"; items: string[] }
  | { type: "done"; tokens?: number };

export interface ResearchTurn { question: string; answer: string }

type ScriptSource = { source: ResearchSource; query: number; read: number };
interface Script { queries: { text: string; results: number }[]; sources: ScriptSource[]; answer: string; followUps: string[] }

/* Titles and summaries are local sample data; the preview does not fetch the linked sources. */
const src = (id: string, domain: string, title: string, snippet: string, date: string, path = ""): ResearchSource =>
  ({ id, domain, title, snippet, date, url: `https://${domain}/${path}` });

export const sampleQuestion = "How do teams like Stripe and Slack ship risky changes without outages?";

/** Offered in the empty state. The preview answers every first question with the rollout script. */
export const sampleSuggestions = [
  sampleQuestion,
  "What is the safest way to migrate a live database table?",
  "How do feature flags reduce deploy risk?",
];

const first: Script = {
  queries: [
    { text: "staged deploy rollout percentage engineering blog", results: 16 },
    { text: "feature flags separate deploy from release", results: 12 },
    { text: "online data migration dual writes", results: 9 },
    { text: "automatic rollback guardrail metrics canary", results: 11 },
  ],
  sources: [
    { query: 0, read: 1.1, source: src("slack", "slack.engineering", "Deploys at Slack", "Every deploy moves through dogfood and canary stages, then widens in percentage steps while engineers watch error and latency dashboards.", "2020", "deploys-at-slack") },
    { query: 1, read: 1.3, source: src("github", "github.blog", "How we ship code faster and safer with feature flags", "Most changes ship dark behind a flag, so deploying code and turning a feature on become separate, reversible decisions.", "2021", "feature-flags") },
    { query: 2, read: 1.4, source: src("stripe", "stripe.com", "Online migrations at scale", "Live data moves in four steps: dual write to both stores, switch reads, switch writes, then remove the old path.", "2017", "blog/online-migrations") },
    { query: 3, read: 1, source: src("cloudflare", "blog.cloudflare.com", "Gradual deployments for Workers", "A new version can take a small share of traffic first, and the split can be raised or rolled back without a redeploy.", "2023", "gradual-deployments") },
    { query: 0, read: .9, source: src("vercel", "vercel.com", "Rolling releases", "Traffic shifts to a new deployment in stages, with its metrics compared against the current version before each step.", "2025", "docs/rolling-releases") },
    { query: 3, read: 1.2, source: src("spotify", "engineering.atspotify.com", "Risk aware product decisions in A/B tests", "Teams define guardrail metrics up front, and a test that moves them the wrong way is stopped early.", "2024", "risk-aware-decisions") },
    { query: 3, read: .8, source: src("shopify", "shopify.engineering", "Resiliency planning for high traffic events", "Load tests and game days rehearse failure well before the traffic peak, not during it.", "2021", "resiliency-planning") },
    { query: 3, read: 1, source: src("airbnb", "airbnb.tech", "Designing experimentation guardrails", "Guardrails flag launches that hurt key metrics, even when the target metric improves.", "2022", "guardrails") },
    { query: 0, read: .7, source: src("atlassian", "atlassian.com", "Progressive delivery", "Release to a subset of users first and widen exposure as confidence grows.", "2024", "continuous-delivery/progressive-delivery") },
    { query: 2, read: 1.1, source: src("figma", "figma.com", "How our databases team lived to tell the scale", "Tables moved to new databases step by step, and every change stayed reversible until the final cutover.", "2024", "blog/how-figmas-databases-team-lived-to-tell-the-scale") },
    { query: 2, read: .9, source: src("notion", "notion.com", "Lessons learned from sharding Postgres", "The team double wrote to the old and new databases and compared results before switching reads over.", "2021", "blog/sharding-postgres-at-notion") },
    { query: 1, read: .7, source: src("supabase", "supabase.com", "Branching", "Each pull request gets its own preview database, so a schema change runs against real migrations before merge.", "2025", "docs/guides/branching") },
  ],
  answer: `**Separate deploying code from releasing it, and widen exposure in small, reversible steps.** Teams that ship risky changes safely treat every change as something they can turn off.[2][9]

### How they roll out

- **Ship dark behind a flag.** Code reaches production turned off, so turning it on is a separate decision you can undo in seconds.[2]
- **Widen in stages.** A deploy goes to internal users first, then a small share of production, then larger steps while error rates and latency are watched.[1][5]
- **Split traffic at the edge.** A slice of requests can go to the new version and roll back without a redeploy.[4]

### Data changes need their own plan

Schema and data moves are the riskiest part, because a flag cannot undo them. The common pattern is to dual write to the old and new store, switch reads, switch writes, and only then delete the old path.[3][11] Every step stays reversible until the last one.[10] Preview databases per pull request let you run the migration before it merges.[12]

Decide the guardrail metrics before launch and stop automatically when they move the wrong way.[6][8] Rehearse the rollback in a quiet week, so the first time you use it is not during an incident.[7]`,
  followUps: [
    "What should we measure before widening a rollout?",
    "How do we clean up old feature flags?",
    "How does dual writing work in Postgres?",
  ],
};

const followUp: Script = {
  queries: [
    { text: "rollout guardrail metrics error rate latency", results: 10 },
    { text: "canary analysis compare against baseline", results: 8 },
  ],
  sources: [
    { query: 0, read: 1, source: src("spotify-metrics", "engineering.atspotify.com", "Choosing sequential testing frameworks", "Stop rules written before a test starts keep teams from peeking and widening too early.", "2023", "sequential-testing") },
    { query: 0, read: .8, source: src("airbnb-guardrails", "airbnb.tech", "Designing experimentation guardrails", "A launch that improves its goal but hurts bookings or support contacts is paused for review.", "2022", "guardrails") },
    { query: 1, read: .9, source: src("cloudflare-docs", "developers.cloudflare.com", "Gradual deployments", "Compare the new version's errors against the current one on the same share of traffic.", "2025", "workers/configuration/versions-and-deployments/gradual-deployments") },
    { query: 1, read: .7, source: src("vercel-metrics", "vercel.com", "Rolling releases metrics", "Each stage shows the new deployment's error rate and response times beside the current one.", "2025", "docs/rolling-releases") },
  ],
  answer: `Pick a small set of metrics before the first step, and write the stop rule down.[1]

- **Error rate** of the new version against the current one, on the same slice of traffic.[3]
- **Latency** at p95 and p99, since averages hide the slow tail.[4]
- **One business guardrail**, such as checkout success or sign ups, so a change that is technically healthy but hurts people still stops.[2]

Compare against a live baseline rather than last week, and widen only after each step holds for a full traffic cycle.[1][3]`,
  followUps: [
    "How long should each rollout stage last?",
    "Can the rollback be automatic?",
  ],
};

const sleep = (ms: number, signal: AbortSignal) => new Promise<void>((resolve, reject) => {
  if (signal.aborted) return reject(signal.reason);
  const id = window.setTimeout(() => { signal.removeEventListener("abort", stop); resolve(); }, ms);
  const stop = () => { window.clearTimeout(id); reject(signal.reason); };
  signal.addEventListener("abort", stop, { once: true });
});

/** Splits text into uneven network sized pieces, sometimes mid word, with the odd stall, the way a model stream arrives. */
function* bursts(text: string) {
  let i = 0, n = 0;
  while (i < text.length) {
    const size = 3 + Math.floor(Math.random() * 16);
    yield { delta: text.slice(i, i + size), wait: n++ % 17 === 9 ? 420 : 24 + Math.random() * 90 };
    i += size;
  }
}

/** The preview's research. The first question runs the full script; any follow up runs the shorter one. */
export async function* scriptedResearch(_question: string, history: ResearchTurn[], signal: AbortSignal): AsyncGenerator<ResearchEvent> {
  const script = history.length ? followUp : first;
  await sleep(500, signal);
  yield { type: "plan", queries: script.queries.map(query => query.text) };
  await sleep(450, signal);
  const done = new Set<number>();
  // Queries fan out together; each lands after its own delay, and its sources start arriving as it does.
  for (let q = 0; q < script.queries.length; q++) { yield { type: "search", query: q }; await sleep(160, signal); }
  const reading: { id: string; left: number; total: number }[] = [];
  const queue = [...script.sources];
  let clock = 0, next = 0;
  const landAt = script.queries.map((_, q) => 700 + q * 520);
  while (queue.length || reading.length || done.size < script.queries.length) {
    await sleep(90, signal);
    clock += 90;
    for (let q = 0; q < script.queries.length; q++) {
      if (!done.has(q) && clock >= landAt[q]) { done.add(q); yield { type: "searched", query: q, results: script.queries[q].results }; }
    }
    // Up to three sources read at once. They arrive in script order, each once its query has landed, so [n] in the answer
    // always cites the nth source in the list.
    if (reading.length < 3 && clock >= next && queue.length && done.has(queue[0].query)) {
      const item = queue.shift()!;
      yield { type: "source", source: item.source, query: item.query };
      reading.push({ id: item.source.id, left: item.read * 1000, total: item.read * 1000 });
      next = clock + 260;
    }
    for (const item of [...reading]) {
      item.left -= 90;
      const progress = Math.min(1, 1 - item.left / item.total);
      yield { type: "read", id: item.id, progress };
      if (progress >= 1) reading.splice(reading.indexOf(item), 1);
    }
  }
  await sleep(500, signal);
  for (const { delta, wait } of bursts(script.answer)) { yield { type: "text", delta }; await sleep(wait, signal); }
  yield { type: "followUps", items: script.followUps };
  yield { type: "done", tokens: Math.round(script.answer.length / 3.6) + script.sources.length * 1850 };
}
