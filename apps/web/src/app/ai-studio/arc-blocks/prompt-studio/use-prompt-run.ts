"use client";

/*
 * Runs a prompt and streams the reply on a requestAnimationFrame clock. Arrival and display are decoupled: whatever has
 * arrived is revealed in chunks of three to eight whole words every 40ms (about 100 words a second), and a backlog widens
 * the chunks so the reveal catches up. Each chunk is appended once and never re-rendered.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { estimateTokens, formatCost, formatSeconds, type PromptRunRequest } from "./prompt-studio-data";
import type { RunView } from "./prompt-studio-parts";

export type OnRun = (request: PromptRunRequest, signal: AbortSignal) => Promise<string | AsyncIterable<string>> | AsyncIterable<string>;

/** Words per tick, cycled so the rhythm never feels mechanical. */
const PATTERN = [4, 5, 3, 6, 4, 3, 5];
const TICK = 40;

export interface SimulatedRun {
  reply: string;
  /** Fail with this message instead of replying. */
  fail?: string;
  /** Time to first token in milliseconds. */
  think: number;
  caseLabel: string;
}

export function usePromptRun(onRun?: OnRun) {
  const [run, setRun] = useState<RunView | null>(null);
  const live = useRef<{ abort: AbortController; frame: number; timer: number } | null>(null);
  const counter = useRef(0);
  const onRunRef = useRef(onRun);
  useLayoutEffect(() => { onRunRef.current = onRun; });

  const cancel = useCallback(() => {
    const handle = live.current;
    if (!handle) return;
    handle.abort.abort();
    cancelAnimationFrame(handle.frame);
    window.clearTimeout(handle.timer);
    live.current = null;
  }, []);
  useEffect(() => cancel, [cancel]);

  const start = useCallback((request: PromptRunRequest, sim: SimulatedRun) => {
    cancel();
    const id = ++counter.current;
    const handle = { abort: new AbortController(), frame: 0, timer: 0 };
    live.current = handle;
    const began = performance.now();
    const run = onRunRef.current;
    const source = { text: "", done: false, error: null as string | null };
    const update = (change: (current: RunView) => RunView) => setRun(current => current && current.id === id ? change(current) : current);
    setRun({ id, status: "thinking", chunks: [], caseLabel: sim.caseLabel, model: request.model, effort: request.effort, simulated: !run });

    if (run) {
      (async () => {
        try {
          const result = await run(request, handle.abort.signal);
          if (typeof result === "string") source.text = result;
          else for await (const delta of result) { if (handle.abort.signal.aborted) return; source.text += delta; }
          source.done = true;
        } catch (error) {
          if (!handle.abort.signal.aborted) source.error = error instanceof Error && error.message ? error.message : "The run failed.";
        }
      })();
    } else {
      handle.timer = window.setTimeout(() => {
        if (sim.fail) source.error = sim.fail;
        else source.text = sim.reply;
        source.done = true;
      }, sim.think);
    }

    let cursor = 0, tick = 0, last = 0;
    const loop = (now: number) => {
      if (source.error) {
        live.current = null;
        update(current => ({ ...current, status: "error", error: source.error ?? undefined }));
        return;
      }
      if (now - last >= TICK) {
        // Whole words only while more is expected; the final word lands once the stream has ended.
        const words = source.text.slice(cursor).match(source.done ? /\s*\S+(?:\s+|$)/g : /\s*\S+\s+/g);
        if (words?.length) {
          const size = Math.min(8, PATTERN[tick % PATTERN.length] + Math.floor(words.length / 30));
          const take = words.slice(0, size).join("");
          cursor += take.length;
          tick++;
          last = now;
          update(current => ({ ...current, status: "streaming", chunks: [...current.chunks, take] }));
        }
      }
      if (source.done && cursor >= source.text.trimEnd().length) {
        live.current = null;
        const ms = now - began;
        const input = estimateTokens(`${request.rendered.system}\n${request.rendered.user}`);
        const output = estimateTokens(source.text);
        const cost = formatCost((input * request.model.input + output * request.model.output) / 1_000_000);
        update(current => ({ ...current, status: "done", stats: { ms, input, output, cost, seconds: formatSeconds(ms) } }));
        return;
      }
      handle.frame = requestAnimationFrame(loop);
    };
    handle.frame = requestAnimationFrame(loop);
  }, [cancel]);

  const stop = useCallback(() => {
    if (!live.current) return;
    cancel();
    setRun(current => current && (current.status === "thinking" || current.status === "streaming") ? { ...current, status: "stopped" } : current);
  }, [cancel]);

  const running = run?.status === "thinking" || run?.status === "streaming";
  return { run, start, stop, running };
}
