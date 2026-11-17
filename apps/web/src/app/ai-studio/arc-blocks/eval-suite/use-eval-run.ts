"use client";

/*
 * Runs the suite. With `onRun`, results come from the developer (an async iterable that yields each case as it is
 * scored, or a promise of every result). Without it, a simulation scores the cases on eight workers, interleaved
 * across categories so every row fills at once, and maps about four seconds of real time onto the run's duration.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { EvalCase, EvalCaseResult, EvalSuiteData } from "./eval-suite-data";

export type RunStatus = "idle" | "running" | "done" | "stopped" | "failed";

export interface RunContext {
  signal: AbortSignal;
  /** Optional: report that a case started, so its cell shows it is being scored. */
  started: (caseId: string) => void;
}

export type OnRun = (suite: EvalSuiteData, context: RunContext) => AsyncIterable<EvalCaseResult> | Promise<EvalCaseResult[]>;

export interface RunState {
  status: RunStatus;
  /** Keyed by case id, in the order results arrived. */
  results: Record<string, EvalCaseResult>;
  inflight: string[];
  /** Seconds, as shown in the summary. */
  elapsed: number;
  error?: string;
  simulated: boolean;
  id: number;
}

const WORKERS = 8;
const idle: RunState = { status: "idle", results: {}, inflight: [], elapsed: 0, simulated: true, id: 0 };

/** A stable pseudo random number in [0, 1) per case, so the simulation looks the same every time. */
function noise(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return ((h >>> 0) % 1000) / 1000;
}

/** Round robin across categories: the first case of each category, then the second, and so on. */
function interleave(cases: EvalCase[]) {
  const groups = new Map<string, EvalCase[]>();
  for (const item of cases) groups.set(item.category, [...(groups.get(item.category) ?? []), item]);
  const lists = [...groups.values()];
  const longest = Math.max(0, ...lists.map(list => list.length));
  const order: EvalCase[] = [];
  for (let i = 0; i < longest; i++) for (const list of lists) if (list[i]) order.push(list[i]);
  return order;
}

export function useEvalRun(suite: EvalSuiteData, onRun: OnRun | undefined, simulate: (item: EvalCase) => EvalCaseResult) {
  const [state, setState] = useState<RunState>(idle);
  const controller = useRef<AbortController | null>(null);
  const timers = useRef<number[]>([]);
  const counter = useRef(0);

  const clear = useCallback(() => {
    controller.current?.abort();
    controller.current = null;
    timers.current.forEach(timer => window.clearTimeout(timer));
    timers.current = [];
  }, []);

  useEffect(() => clear, [clear]);

  const start = useCallback(() => {
    clear();
    const id = ++counter.current;
    const abort = new AbortController();
    controller.current = abort;
    const t0 = performance.now();
    setState({ status: "running", results: {}, inflight: [], elapsed: 0, simulated: !onRun, id });

    const settle = (patch: (current: RunState) => RunState) => setState(current => current.id === id ? patch(current) : current);

    if (!onRun) {
      const queue = interleave(suite.cases);
      const total = queue.length;
      const target = suite.estimate?.seconds ?? 190;
      // About four seconds of real time, mapped onto the estimate.
      const realTotal = Math.max(1.6, Math.min(4.2, total * .034));
      const scale = target / realTotal;
      const perCase = (realTotal * 1000 * WORKERS) / Math.max(1, total);
      let next = 0, done = 0;
      const work = () => {
        if (abort.signal.aborted) return;
        const item = queue[next++];
        if (!item) return;
        const result = simulate(item);
        const jitter = .55 + noise(item.id) * .9;
        const duration = perCase * jitter * (result.outcome === "error" ? 1.6 : 1);
        settle(current => ({ ...current, inflight: [...current.inflight, item.id] }));
        timers.current.push(window.setTimeout(() => {
          if (abort.signal.aborted) return;
          done++;
          const finished = done === total;
          const elapsed = finished ? target : ((performance.now() - t0) / 1000) * scale;
          settle(current => ({
            ...current,
            results: { ...current.results, [item.id]: result },
            inflight: current.inflight.filter(caseId => caseId !== item.id),
            elapsed: Math.min(target, Math.max(current.elapsed, elapsed)),
            status: finished ? "done" : current.status,
          }));
          work();
        }, duration));
      };
      for (let w = 0; w < Math.min(WORKERS, total); w++) timers.current.push(window.setTimeout(work, w * 40));
      if (!total) settle(current => ({ ...current, status: "done" }));
      return;
    }

    const started = (caseId: string) => settle(current => current.inflight.includes(caseId) ? current : { ...current, inflight: [...current.inflight, caseId] });
    const apply = (result: EvalCaseResult) => settle(current => ({
      ...current,
      results: { ...current.results, [result.caseId]: result },
      inflight: current.inflight.filter(caseId => caseId !== result.caseId),
      elapsed: (performance.now() - t0) / 1000,
    }));
    (async () => {
      try {
        const output = onRun(suite, { signal: abort.signal, started });
        if (output && typeof (output as AsyncIterable<EvalCaseResult>)[Symbol.asyncIterator] === "function") {
          for await (const result of output as AsyncIterable<EvalCaseResult>) {
            if (abort.signal.aborted) return;
            apply(result);
          }
        } else {
          const list = await (output as Promise<EvalCaseResult[]>);
          if (abort.signal.aborted) return;
          list.forEach(apply);
        }
        if (!abort.signal.aborted) settle(current => ({ ...current, status: "done", inflight: [], elapsed: (performance.now() - t0) / 1000 }));
      } catch (error) {
        if (abort.signal.aborted) return;
        settle(current => ({ ...current, status: "failed", inflight: [], error: error instanceof Error ? error.message : "The run failed." }));
      }
    })();
  }, [clear, onRun, simulate, suite]);

  const stop = useCallback(() => {
    clear();
    setState(current => current.status === "running" ? { ...current, status: "stopped", inflight: [] } : current);
  }, [clear]);

  return { state, start, stop };
}
