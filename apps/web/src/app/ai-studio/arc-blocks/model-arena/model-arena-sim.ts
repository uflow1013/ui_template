import { ArenaRunError, arenaPrompts, flakyOnce, scriptedAnswers, simProfiles, type ArenaModel, type ArenaRun } from "./model-arena-data";

/** Resolves after `ms` on the animation frame clock, or rejects when the signal aborts. */
function wait(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) { reject(signal.reason); return; }
    const until = performance.now() + ms;
    let frame = 0;
    const abort = () => { cancelAnimationFrame(frame); reject(signal.reason); };
    const tick = (now: number) => {
      if (now >= until) { signal.removeEventListener("abort", abort); resolve(); return; }
      frame = requestAnimationFrame(tick);
    };
    signal.addEventListener("abort", abort, { once: true });
    frame = requestAnimationFrame(tick);
  });
}

/** A little variance per run, so a rematch never finishes in exactly the same time. */
const jitter = (spread: number) => 1 + (Math.random() * 2 - 1) * spread;

export function scriptedAnswer(model: ArenaModel, prompt: string) {
  const match = arenaPrompts.find(item => item.text.trim() === prompt.trim());
  return match ? scriptedAnswers[match.id]?.[model.id] : undefined;
}

/**
 * The preview's stand-in for a real `run`: a scripted answer streamed on the frame clock. After the model's time to first
 * token, it appends a chunk of whole words every 30 to 40ms at a steady pace of about 100 words a second, catching up after
 * a slow frame, so a long answer lands in two to four seconds and both panes stream at the same visual speed. One model
 * drops its first stream partway through, to show a pane failing and recovering.
 */
export function createArenaSimulator(): ArenaRun {
  let flaked = false;
  return async function* simulate(model, prompt, signal) {
    const answer = scriptedAnswer(model, prompt);
    const profile = simProfiles[model.id] ?? { ttft: 600, cps: 520 };
    await wait(profile.ttft * jitter(.18), signal);
    if (!answer) throw new ArenaRunError("This preview has scripted answers for the sample prompts only. Pass a run function to stream real models.", { retryable: false });
    const failAt = !flaked && model.id === flakyOnce.model ? Math.floor(answer.length * flakyOnce.at) : -1;
    const cps = profile.cps * jitter(.04);
    const start = performance.now();
    let sent = 0;
    while (sent < answer.length) {
      await wait(30 + Math.random() * 10, signal);
      const due = Math.floor((performance.now() - start) / 1000 * cps);
      if (due <= sent) continue;
      let cut = Math.min(answer.length, due);
      while (cut < answer.length && !/\s/.test(answer[cut])) cut++;
      if (failAt > 0 && cut >= failAt) {
        flaked = true;
        throw new ArenaRunError(flakyOnce.message);
      }
      yield answer.slice(sent, cut);
      sent = cut;
    }
  };
}
