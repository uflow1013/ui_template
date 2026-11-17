"use client";

/*
 * The regression drilldown, opened in place under a case row: the input and the expected behavior, the baseline and
 * new outputs side by side with a word diff, the judge's rubric scores (new score as the fill, baseline as the ghost
 * tick, the same language as the category bars) and its rationale, then the triage actions.
 */

import { useEffect, useMemo, useRef } from "react";
import { Check, CircleAlert, RotateCcw } from "lucide-react";
import { Button } from "@/shared/arc/button/button";
import { outcomeLabel, wordDiff, type EvalCase, type EvalCaseResult, type EvalSuiteData, type TriageAction } from "./eval-suite-data";
import { LinearMark } from "./eval-suite-marks";
import { Delta, ModelMark, OutcomeGlyph, ScoreBar, directionOf } from "./eval-suite-parts";
import styles from "./eval-suite.module.css";

/** A changed run of words, highlighted without its trailing space. */
function Changed({ kind, text }: { kind: "add" | "del"; text: string }) {
  const core = text.trimEnd(), rest = text.slice(core.length);
  return <>{kind === "add" ? <ins className={styles.diffAdd}>{core}</ins> : <del className={styles.diffDel}>{core}</del>}{rest}</>;
}

export interface TriageState { action: TriageAction; status: "pending" | "done"; issueKey?: string }

export function CaseDetail({ suite, item, result, rubric, triage, onTriage, onUndo, simulated }: {
  suite: EvalSuiteData;
  item: EvalCase;
  result?: EvalCaseResult;
  rubric: string[];
  triage?: TriageState;
  onTriage: (action: TriageAction) => void;
  onUndo: () => void;
  simulated: boolean;
}) {
  const baselineOutput = item.baselineOutput, output = result?.output;
  const diff = useMemo(() => baselineOutput && output ? wordDiff(baselineOutput, output) : null, [baselineOutput, output]);
  const before = item.baseline, after = result?.outcome;
  const scored = !!result?.scores?.length;
  const pending = triage?.status === "pending" ? triage.action : null;

  /* When a triage action swaps the buttons out, move focus to what replaced them: Undo, the confirmation, or the buttons again. */
  const actions = useRef<HTMLDivElement>(null);
  const followFocus = useRef(false);
  const act = (run: () => void) => { followFocus.current = true; run(); };
  const settled = triage?.status ?? "none";
  useEffect(() => {
    if (settled === "pending" || !followFocus.current) return;
    followFocus.current = false;
    const root = actions.current;
    (root?.querySelector<HTMLElement>("button:not(:disabled)") ?? root?.querySelector<HTMLElement>("[tabindex='-1']"))?.focus({ preventScroll: true });
  }, [settled]);

  return <div className={styles.detail}>
    <dl className={styles.defs}>
      <div className={styles.def}>
        <dt>Input</dt>
        <dd className={styles.quote}>{item.input}</dd>
      </div>
      {item.expected && <div className={styles.def}>
        <dt>Expected</dt>
        <dd>{item.expected}</dd>
      </div>}
    </dl>

    <div className={styles.compare}>
      <section className={styles.pane} aria-label={`${suite.baseline.version} output`}>
        <header className={styles.paneHead}>
          <span className={styles.paneTitle}><ModelMark model={suite.baseline.model} />{suite.baseline.version}<span className={styles.paneModel}>{suite.baseline.model.name}</span></span>
          <span className={styles.outcomeTag} data-outcome={before}><OutcomeGlyph outcome={before} />{outcomeLabel[before]}</span>
        </header>
        <p className={styles.paneBody}>
          {diff && !diff.rewritten
            ? diff.parts.map((part, i) => part.type === "change" ? part.before && <Changed key={i} kind="del" text={part.before} /> : <span key={i}>{part.before}</span>)
            : item.baselineOutput}
        </p>
      </section>
      <section className={styles.pane} aria-label={`${suite.candidate.version} output`}>
        <header className={styles.paneHead}>
          <span className={styles.paneTitle}><ModelMark model={suite.candidate.model} />{suite.candidate.version}<span className={styles.paneModel}>{suite.candidate.model.name}</span></span>
          {after && <span className={styles.outcomeTag} data-outcome={after}><OutcomeGlyph outcome={after} />{outcomeLabel[after]}</span>}
        </header>
        {result?.error && !result.output
          ? <p className={styles.paneError}><CircleAlert aria-hidden="true" />{result.error}</p>
          : <p className={styles.paneBody}>
            {diff && !diff.rewritten
              ? diff.parts.map((part, i) => part.type === "change" ? part.after && <Changed key={i} kind="add" text={part.after} /> : <span key={i}>{part.after}</span>)
              : result?.output ?? <span className={styles.muted}>Not run yet</span>}
          </p>}
      </section>
    </div>

    <section className={styles.judge} aria-label={`Judge, ${suite.judge.name}`}>
      <div className={styles.judgeHead} aria-hidden="true">Judge</div>
      <div className={styles.judgeBody}>
        <p className={styles.judgeModel}>
          <span className={styles.judgeKey}>Judge</span>
          <ModelMark model={suite.judge} />
          <span className={styles.judgeName}>{suite.judge.name}</span>
          {scored && item.baselineScores && <span className={styles.judgeLegend} aria-hidden="true"><span className={styles.ghostKey} />{suite.baseline.version}</span>}
        </p>
        {scored ? <ul className={styles.rubric}>
          {rubric.map((criterion, i) => {
            const now = result?.scores?.[i], was = item.baselineScores?.[i];
            if (now === undefined) return null;
            const change = was === undefined ? 0 : now - was;
            return <li key={criterion} className={styles.rubricRow}>
              <span className={styles.rubricName}>{criterion}</span>
              <ScoreBar value={now / 5} baseline={was === undefined ? undefined : was / 5} tone={directionOf(change)} className={styles.rubricBar} />
              <span className={styles.rubricScore}>
                <span className={styles.srOnly}>{`${suite.candidate.version} ${now} of 5${was === undefined ? "" : `, ${suite.baseline.version} ${was}`}`}</span>
                <span aria-hidden="true">{now}<span className={styles.muted}> / 5</span></span>
              </span>
              <span className={styles.rubricDelta} aria-hidden="true">{was !== undefined && change !== 0 ? <Delta value={change} /> : <span className={styles.muted}>Same</span>}</span>
            </li>;
          })}
        </ul> : <p className={styles.rationale}>{result?.error ? "Not scored. The case errored before the judge could read a reply." : "Scores appear once the case runs."}</p>}
        {result?.rationale && <p className={styles.rationale}>{result.rationale}</p>}
      </div>
    </section>

    {/* The page's status region announces each triage; focus follows the swap so keyboard users never land on the page body. */}
    <div ref={actions} className={styles.actions}>
      {triage?.status === "done"
        ? <p className={styles.triaged} tabIndex={-1}>
          <span className={styles.triagedMain}>
            <span className={styles.triagedIcon}>{triage.action === "expected" ? <Check aria-hidden="true" /> : <LinearMark className={styles.linear} aria-hidden="true" title="" />}</span>
            <span className={styles.triagedText}>{triage.action === "expected"
              ? "Marked as expected. Later runs will not count it as a regression."
              : `${triage.issueKey ?? "Issue"} opened in Linear${simulated ? " (simulated)" : ""}`}</span>
          </span>
          {triage.action === "expected" && <Button variant="ghost" size="sm" className={styles.undo} onClick={() => act(onUndo)}><RotateCcw aria-hidden="true" />Undo</Button>}
        </p>
        : <>
          <Button variant="secondary" size="sm" loading={pending === "expected"} disabled={!!pending && pending !== "expected"} onClick={() => act(() => onTriage("expected"))}><Check aria-hidden="true" />Mark as expected</Button>
          <Button variant="secondary" size="sm" loading={pending === "issue"} disabled={!!pending && pending !== "issue"} onClick={() => act(() => onTriage("issue"))}><LinearMark className={styles.linear} aria-hidden="true" title="" />Open issue</Button>
        </>}
    </div>
  </div>;
}
