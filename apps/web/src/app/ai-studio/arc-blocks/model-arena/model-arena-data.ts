import type { ComponentType, SVGProps } from "react";
import { ClaudeMark, DeepseekColorMark, GeminiColorMark, GrokMark, MistralColorMark, OpenaiMark } from "./model-arena-marks";

/* ---------------------------------------------------------------------------------------------------------------
 * Types
 * ------------------------------------------------------------------------------------------------------------- */

export type ArenaMark = ComponentType<SVGProps<SVGSVGElement> & { title?: string }>;

export interface ArenaModel {
  /** Stable id, such as the API model id. */
  id: string;
  /** Full display name, revealed after the vote. */
  name: string;
  /** Shorter name for tabs and tight rows. Defaults to `name`. */
  shortName?: string;
  provider: string;
  /** The provider's mark. Mono marks draw in `markColor`, or the text color without one. */
  mark?: ArenaMark;
  markColor?: string;
  /** List price in US dollars per million tokens, used for the live cost readout. */
  price: { input: number; output: number };
  /** Series color for the model's leaderboard bar, such as `var(--series-2)`. Defaults by position in the pool. */
  color?: string;
}

export interface ArenaPrompt {
  id: string;
  /** Short chip label. */
  label: string;
  /** The full prompt sent to every model. */
  text: string;
}

/**
 * One event from a model's stream. A string is a text delta. An object can carry a delta and the provider's usage
 * numbers; without usage, output tokens are estimated at four characters per token.
 */
export type ArenaStreamEvent = string | { text?: string; inputTokens?: number; outputTokens?: number };

/** Streams one model's answer to one prompt. Throw to fail the column; stop when `signal` aborts. */
export type ArenaRun = (model: ArenaModel, prompt: string, signal: AbortSignal) => AsyncIterable<ArenaStreamEvent>;

/** An error a column shows as is. Set `retryable` to false when a retry cannot help. */
export class ArenaRunError extends Error {
  retryable: boolean;
  constructor(message: string, { retryable = true }: { retryable?: boolean } = {}) {
    super(message);
    this.name = "ArenaRunError";
    this.retryable = retryable;
  }
}

/* ---------------------------------------------------------------------------------------------------------------
 * Models. Anthropic prices are list prices; other providers use sample prices.
 * ------------------------------------------------------------------------------------------------------------- */

const claude = "#D97757";
/** Series colors by provider, so a provider's models read as a family on the leaderboard. With four series, smaller providers share a hue. */
const series = { anthropic: "var(--series-3)", openai: "var(--series-4)", google: "var(--series-1)", xai: "var(--series-2)" };

export const arenaModels: ArenaModel[] = [
  { id: "claude-opus-5-5", name: "Claude Opus 5.5", shortName: "Opus 5.5", provider: "Anthropic", mark: ClaudeMark, markColor: claude, price: { input: 4, output: 20 }, color: series.anthropic },
  { id: "gpt-6-1-sol", name: "GPT-6.1 Sol", provider: "OpenAI", mark: OpenaiMark, price: { input: 5, output: 30 }, color: series.openai },
  { id: "gemini-4-argon", name: "Gemini 4 Argon", provider: "Google", mark: GeminiColorMark, price: { input: 3.5, output: 21 }, color: series.google },
  { id: "grok-4-7", name: "Grok 4.7", provider: "xAI", mark: GrokMark, price: { input: 3, output: 15 }, color: series.xai },
  { id: "claude-sonnet-5-5", name: "Claude Sonnet 5.5", shortName: "Sonnet 5.5", provider: "Anthropic", mark: ClaudeMark, markColor: claude, price: { input: 2, output: 10 }, color: series.anthropic },
  { id: "deepseek-v4-1-flash", name: "DeepSeek V4.1 Flash", shortName: "V4.1 Flash", provider: "DeepSeek", mark: DeepseekColorMark, price: { input: .14, output: .56 }, color: series.google },
  { id: "mistral-large-4", name: "Mistral Large 4", provider: "Mistral AI", mark: MistralColorMark, price: { input: 1.5, output: 6 }, color: series.anthropic },
];

export const arenaPrompts: ArenaPrompt[] = [
  { id: "sql", label: "Top customers in SQL", text: "Write a Postgres query for the top 5 customers by revenue in Q3 2026, with their order count." },
  { id: "mutex", label: "Mutex or semaphore", text: "Explain the difference between a mutex and a semaphore to a junior engineer, with one example each." },
  { id: "decline", label: "Decline a meeting", text: "Write a short, warm reply to Priya declining Thursday's 3pm roadmap sync, and offer async notes instead." },
];

/* ---------------------------------------------------------------------------------------------------------------
 * Simulation: speed profiles, the opening rounds, and scripted answers
 * ------------------------------------------------------------------------------------------------------------- */

/**
 * Time to first token in ms and output pace in characters per second, for the preview's simulated streams. The paces sit
 * in a narrow band (about 95 to 110 words a second), so both answers stream at the same visual speed; first token and
 * answer length decide who finishes first.
 */
export const simProfiles: Record<string, { ttft: number; cps: number }> = {
  "claude-opus-5-5": { ttft: 760, cps: 600 },
  "gpt-6-1-sol": { ttft: 560, cps: 620 },
  "gemini-4-argon": { ttft: 980, cps: 640 },
  "grok-4-7": { ttft: 480, cps: 610 },
  "claude-sonnet-5-5": { ttft: 520, cps: 650 },
  "deepseek-v4-1-flash": { ttft: 420, cps: 660 },
  "mistral-large-4": { ttft: 640, cps: 580 },
};

/** The preview's first rounds, so a first visit sees a varied set; later rounds draw at random. */
export const openingRounds: { prompt: string; models: [string, string] }[] = [
  { prompt: "sql", models: ["claude-opus-5-5", "gpt-6-1-sol"] },
  { prompt: "mutex", models: ["gemini-4-argon", "grok-4-7"] },
  { prompt: "decline", models: ["mistral-large-4", "claude-sonnet-5-5"] },
];

/** Fails once, partway through, so the preview shows a column error and its retry. */
export const flakyOnce = { model: "mistral-large-4", at: .46, message: "The connection closed before the answer finished." };

const fence = "```";

export const scriptedAnswers: Record<string, Record<string, string>> = {
  sql: {
    "claude-opus-5-5": `Here's a query that ranks customers by paid revenue for Q3 2026 (July 1 to September 30):

${fence}sql
select
  c.id,
  c.name,
  count(o.id)                as orders,
  sum(o.total_cents) / 100.0 as revenue
from orders o
join customers c on c.id = o.customer_id
where o.status = 'paid'
  and o.created_at >= '2026-07-01'
  and o.created_at <  '2026-10-01'
group by c.id, c.name
order by revenue desc
limit 5;
${fence}

A few choices worth checking against your schema:

- **Half-open range.** \`< '2026-10-01'\` keeps every order placed on September 30, which \`between\` would cut off at midnight.
- **Paid orders only.** Refunds and drafts are left out. Drop the status filter if you report gross bookings.
- **Ties.** If two customers share fifth place, swap \`limit 5\` for \`fetch first 5 rows with ties\`.`,

    "gpt-6-1-sol": `${fence}sql
with q3 as (
  select customer_id, count(*) as order_count, sum(total_cents) as revenue_cents
  from orders
  where status = 'paid'
    and created_at >= date '2026-07-01'
    and created_at <  date '2026-10-01'
  group by customer_id
)
select c.name, q3.order_count, round(q3.revenue_cents / 100.0, 2) as revenue_usd
from q3
join customers c on c.id = q3.customer_id
order by q3.revenue_cents desc
limit 5;
${fence}

**Why a CTE:** orders are aggregated first, so the join touches one row per customer instead of one per order.

**Speed tip:** an index on \`orders (status, created_at) include (customer_id, total_cents)\` turns this into an index-only scan.`,

    "gemini-4-argon": `Sure. Below is a query that returns the five highest-revenue customers for Q3 2026, along with how many orders each placed and their share of the quarter's revenue.

${fence}sql
select
  c.name,
  count(*)                                    as orders,
  sum(o.total_cents) / 100.0                  as revenue,
  round(100.0 * sum(o.total_cents)
        / sum(sum(o.total_cents)) over (), 1) as share_pct
from orders o
join customers c on c.id = o.customer_id
where o.status = 'paid'
  and o.created_at >= timestamptz '2026-07-01 00:00 UTC'
  and o.created_at <  timestamptz '2026-10-01 00:00 UTC'
group by c.id, c.name
order by revenue desc
limit 5;
${fence}

How it works:

1. **Filter** to paid orders inside the quarter, with explicit UTC boundaries so the result does not shift with the session time zone.
2. **Group** by customer to count orders and sum revenue.
3. **Window** over the grouped rows to get each customer's share of the quarter's total.
4. **Sort and limit** to the top five.

Note that the window is evaluated before \`limit\`, so \`share_pct\` is measured against every customer, not only the top five.`,

    "grok-4-7": `Here you go, no fluff:

${fence}sql
select c.name, count(*) as orders, sum(o.total_cents) / 100.0 as revenue
from orders o join customers c on c.id = o.customer_id
where o.created_at >= '2026-07-01' and o.created_at < '2026-10-01'
  and o.status = 'paid'
group by c.name
order by revenue desc
limit 5;
${fence}

Heads up: grouping by \`name\` merges two customers who share one. Group by \`c.id\` too if your data has duplicates.`,

    "claude-sonnet-5-5": `${fence}sql
select c.id, c.name,
       count(o.id) as orders,
       sum(o.total_cents) / 100.0 as revenue
from customers c
join orders o on o.customer_id = c.id
where o.status = 'paid'
  and o.created_at >= '2026-07-01'
  and o.created_at <  '2026-10-01'
group by c.id, c.name
order by revenue desc
limit 5;
${fence}

This assumes amounts are stored in cents and only \`paid\` orders count as revenue. To sanity check it, compare the top five's total with a plain \`sum(total_cents)\` over the same date range.`,

    "deepseek-v4-1-flash": `${fence}sql
select c.name, count(o.id) orders, sum(o.total_cents) / 100.0 revenue
from orders o
join customers c on c.id = o.customer_id
where o.status = 'paid'
  and o.created_at >= '2026-07-01' and o.created_at < '2026-10-01'
group by c.id, c.name
order by revenue desc
limit 5;
${fence}

Assumes \`total_cents\` and a \`paid\` status.`,

    "mistral-large-4": `The following query uses \`date_trunc\` to select the third quarter of 2026:

${fence}sql
select
  c.name,
  count(o.id) as order_count,
  sum(o.total_cents) / 100.0 as revenue
from orders o
join customers c on c.id = o.customer_id
where date_trunc('quarter', o.created_at) = date '2026-07-01'
  and o.status = 'paid'
group by c.id, c.name
order by revenue desc
limit 5;
${fence}

It reads well, but wrapping \`created_at\` in a function stops a plain index on that column from being used. On large tables, prefer an explicit range: \`created_at >= '2026-07-01' and created_at < '2026-10-01'\`.`,
  },

  mutex: {
    "claude-opus-5-5": `Both control access to something shared, but they answer different questions.

### Mutex: who holds it
A mutex is a lock with an owner. One thread takes it, does its work, and the same thread releases it. Everyone else waits.

**Example:** two requests updating the same cart. Each takes the cart's mutex, reads, writes, then releases, so neither overwrites the other's change.

### Semaphore: how many may enter
A semaphore is a counter of permits. Any thread can take a permit while one is left, and any thread can return one. It has no owner.

**Example:** your database allows 10 connections. A semaphore of 10 lets ten workers query at once; the eleventh waits until a permit comes back.

A useful rule of thumb: reach for a mutex to protect data, and a semaphore to limit capacity.`,

    "gpt-6-1-sol": `**Mutex:** one at a time, and whoever locks it unlocks it.
**Semaphore:** up to N at a time, and anyone can signal.

- **Ownership:** a mutex belongs to the thread that locked it. A semaphore is just a count.
- **Capacity:** a mutex is effectively 1. A semaphore can be any N.
- **Typical bug:** forgetting to unlock a mutex stalls everyone; releasing a semaphore twice quietly raises the limit.

**Mutex example:** guarding a shared \`Map\` in an in-memory cache so two writers never interleave.

**Semaphore example:** a crawler that allows at most 4 concurrent requests to one site, to stay polite.`,

    "gemini-4-argon": `Great question, and a common source of confusion. A helpful analogy is a coffee shop.

1. **A mutex is the single restroom key.** Whoever has the key goes in; everyone else waits. Only the person holding the key can hand it back.
2. **A semaphore is the count of free tables.** The host tracks a number. While tables are free, people sit down. At zero, new arrivals wait until someone leaves.

### Key differences
- **Count:** a mutex allows exactly one holder. A semaphore allows up to N.
- **Ownership:** a mutex must be released by the thread that acquired it. A semaphore can be released by any thread, which also makes it useful for signaling between threads.
- **Use case:** mutexes protect a critical section. Semaphores manage a pool of identical resources.

### Examples
- **Mutex:** incrementing a shared \`requestCount\` from many threads. Without the lock, two threads can both read 41 and both write 42, and one increment disappears.
- **Semaphore:** a print server with 3 printers. A semaphore initialized to 3 lets three jobs print at once and queues the rest.

One last tip: a semaphore with a count of 1 behaves like a mutex, but without ownership, so it will not catch a thread releasing a lock it never took.`,

    "grok-4-7": `Short version: a mutex is a bathroom lock, a semaphore is a bouncer with a clicker.

**Mutex.** One person in, door locked, and only they can unlock it. Use it when two threads must never touch the same thing at once, like appending to one log file.

**Semaphore.** The bouncer lets in up to N people and counts them out. Use it to cap concurrency, like allowing only 5 image resizes at a time so the server doesn't melt.

If you remember one thing: a mutex says **mine**, a semaphore says **how many**.`,

    "claude-sonnet-5-5": `A **mutex** gives one thread exclusive access and must be released by that same thread. A **semaphore** holds a number of permits that any thread can take or return.

Mutex, protecting a shared balance:

${fence}python
lock = threading.Lock()

def deposit(amount):
    with lock:
        account.balance += amount
${fence}

Semaphore, capping parallel downloads at 3:

${fence}python
slots = threading.Semaphore(3)

def download(url):
    with slots:
        fetch(url)
${fence}

Same shape in code, different intent: the lock keeps one writer at a time, the semaphore keeps three workers at a time.`,

    "deepseek-v4-1-flash": `- **Mutex:** a lock with an owner. One thread at a time. Example: protecting a shared counter.
- **Semaphore:** a counter of permits, no owner. Up to N threads at a time. Example: limiting a pool to 10 database connections.

A binary semaphore is close to a mutex, minus the ownership check.`,

    "mistral-large-4": `A mutex provides mutual exclusion: exactly one thread may hold it, and only that thread may release it. A semaphore maintains a count of available permits and has no notion of ownership.

**Example of a mutex.** A logging service writes entries to one file. Each write acquires the mutex, so lines from different threads never interleave.

**Example of a semaphore.** An API client may send at most 8 requests in parallel. A semaphore initialised to 8 is decremented before each request and incremented after it.

In short, use a mutex for the correctness of shared state and a semaphore to control concurrency.`,
  },

  decline: {
    "claude-opus-5-5": `Hi Priya,

Thanks for pulling the roadmap sync together. I'm going to sit out Thursday at 3pm so I can stay heads down on the billing migration, but I don't want to slow anything down.

I'll leave notes on the three open items in the doc by Wednesday evening, and I'm happy to pick up follow-ups async. If something really needs a live conversation, grab 15 minutes on my calendar Friday morning.

Thanks for understanding,

Sam`,

    "gpt-6-1-sol": `**Option 1, warm**

Hi Priya, thanks for the invite! I can't make Thursday's 3pm sync, but I'll leave my comments on the roadmap doc by Wednesday night so you have them going in. Happy to answer anything async.

**Option 2, shorter**

Hi Priya, I'll skip Thursday's sync to protect some focus time. My notes will be in the doc by Wednesday. Ping me if anything needs me live.`,

    "gemini-4-argon": `Here's a reply that declines clearly while keeping things warm:

**Subject:** Re: Roadmap sync, Thursday 3pm

Hi Priya,

Thank you for including me. Unfortunately I won't be able to join on Thursday at 3pm, as I've blocked that afternoon for the billing migration cutover.

So that my input still makes it into the discussion, I'll add written notes to the roadmap doc by end of day Wednesday, covering the pricing page timeline, the onboarding experiment and the API deprecation dates. Feel free to tag me with questions and I'll reply the same day.

Looking forward to seeing where the group lands.

Best,

Sam

Why this works:
- It gives a specific reason without over-explaining.
- It commits to a concrete deliverable and a deadline.
- It keeps the door open for follow-up.`,

    "grok-4-7": `Hey Priya! Going to pass on Thursday's 3pm, my calendar is already a crime scene. I'll drop async notes in the doc before then, so you get my hot takes without me eating 30 minutes of everyone's afternoon. Ping me if anything's on fire.`,

    "claude-sonnet-5-5": `Hi Priya,

Thanks for the invite. I won't make Thursday's 3pm sync, but I'll add my notes to the roadmap doc by Wednesday evening so they're ready for the discussion. Feel free to tag me on anything you want my take on.

Thanks,

Sam`,

    "deepseek-v4-1-flash": `Hi Priya, thanks for the invite. I can't join Thursday at 3pm, but I'll share my notes in the doc beforehand. Happy to follow up async.`,

    "mistral-large-4": `Hi Priya,

Thank you for the invitation to Thursday's roadmap sync. Regrettably, I will not be able to attend at 3pm. I will share my written notes in the roadmap document on Wednesday, so that my points can be discussed in my absence.

Kind regards,

Sam`,
  },
};
