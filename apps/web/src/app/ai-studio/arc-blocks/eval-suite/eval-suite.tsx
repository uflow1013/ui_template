"use client";

/*
 * Eval suite: one card for running an evaluation suite on a new version of an LLM feature and seeing what regressed.
 *
 * Header: the feature, the candidate and baseline versions with their models, the case count, the judge, and Run.
 * Summary: the score counts up next to the baseline with the delta in points, a sparkline of the last runs, cost and time.
 * Grid: one row per category, a small cell per case that fills live (pass, fail, error, each with its own glyph), and a
 * bar per category with a ghost tick at the baseline.
 * Cases: filter All, Failed, Regressions, Improved. A case opens in place: input, expected behavior, both outputs side
 * by side with a word diff, the judge's rubric scores and rationale, then mark as expected or open an issue.
 */

import { useCallback, useId, useMemo, useRef, useState, type CSSProperties, type MouseEvent, type PointerEvent } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowRight, Check, ChevronDown, CircleAlert } from "lucide-react";
import { motionTokens } from "@/shared/arc/lib/motion-tokens";
import { Button } from "@/shared/arc/button/button";
import { TextShimmer } from "@/shared/arc/text-shimmer/text-shimmer";
import {
  formatCost, formatDuration, outcomeLabel, percent, sampleResults, sampleRubric, sampleRuns, sampleSuite,
  type CaseFilter, type EvalCase, type EvalCaseResult, type EvalRunRecord, type EvalSuiteData, type Outcome, type TriageAction,
} from "./eval-suite-data";
import { CaseDetail, type TriageState } from "./eval-case-detail";
import { LinearMark } from "./eval-suite-marks";
import { AutoHeight, Delta, HistorySparkline, MiniCell, ModelChip, OutcomeGlyph, CountUp, RunButton, formatDollars, formatPercent0, formatPercent1, ScoreBar, Seg, cx, deltaWords, directionOf, instant } from "./eval-suite-parts";
import { useEvalRun, type OnRun } from "./use-eval-run";
import styles from "./eval-suite.module.css";

export type { CaseFilter, EvalCase, EvalCaseResult, EvalModel, EvalRunRecord, EvalSuiteData, Outcome, TriageAction } from "./eval-suite-data";
export type { OnRun, RunContext } from "./use-eval-run";

export interface EvalSuiteProps {
  /** The suite: name, candidate and baseline versions with their models, the judge, rubric and cases. Defaults to a sample support agent suite. */
  suite?: EvalSuiteData;
  /** Earlier runs, oldest first, for the history sparkline. The last 7 show, plus the current run. */
  runs?: EvalRunRecord[];
  /** Runs the suite. Yield each case result as it is scored (async iterable) or resolve every result at once; throw to show the error state. Without it, runs are simulated. */
  onRun?: OnRun;
  /** Called when a case is triaged. Return (or resolve) an issue key such as "SUP-2481" for "issue". Without it, triage is simulated. */
  onTriage?: (caseId: string, action: TriageAction) => void | string | Promise<void | string>;
  /** The filter the case list opens with. Defaults to regressions. */
  defaultFilter?: CaseFilter;
  className?: string;
}

const PAGE = 8;
const fadeIn = { duration: motionTokens.duration.fast, ease: [...motionTokens.ease.enter] as [number, number, number, number] };
const filterLabels: Record<CaseFilter, string> = { all: "All", failed: "Failed", regressions: "Regressions", improved: "Improved" };

type Change = "regression" | "improved" | null;

export function EvalSuite({ suite: suiteProp, runs = sampleRuns, onRun, onTriage, defaultFilter = "regressions", className }: EvalSuiteProps) {
  const suite = suiteProp ?? sampleSuite;
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const reduced = useReducedMotion();
  const rubric = suite.rubric ?? sampleRubric;
  const { candidate, baseline } = suite;

  /* Run */
  const simulate = useCallback((item: EvalCase): EvalCaseResult =>
    (suiteProp ? undefined : sampleResults[item.id]) ?? { caseId: item.id, outcome: item.baseline, costUsd: .024 }, [suiteProp]);
  const { state: run, start, stop } = useEvalRun(suite, onRun, simulate);
  const running = run.status === "running";
  const finished = run.status === "done";
  const results = run.results;

  /* Derived numbers */
  const total = suite.cases.length;
  const caseById = useMemo(() => new Map(suite.cases.map(item => [item.id, item])), [suite.cases]);
  const categories = useMemo(() => suite.categories ?? [...new Set(suite.cases.map(item => item.category))], [suite]);
  const inflight = useMemo(() => new Set(run.inflight), [run.inflight]);
  const changeOf = useCallback((item: EvalCase): Change => {
    const result = results[item.id];
    if (!result) return null;
    const was = item.baseline === "pass", now = result.outcome === "pass";
    return was && !now ? "regression" : !was && now ? "improved" : null;
  }, [results]);

  const stats = useMemo(() => {
    const counts: Record<Outcome, number> = { pass: 0, fail: 0, error: 0 };
    let regressions = 0, improved = 0, cost = 0;
    for (const result of Object.values(results)) {
      counts[result.outcome]++;
      cost += result.costUsd ?? 0;
      const item = caseById.get(result.caseId);
      if (!item) continue;
      if (item.baseline === "pass" && result.outcome !== "pass") regressions++;
      if (item.baseline !== "pass" && result.outcome === "pass") improved++;
    }
    const baselinePass = suite.cases.filter(item => item.baseline === "pass").length;
    return { counts, regressions, improved, cost, completed: Object.keys(results).length, baselinePass };
  }, [results, caseById, suite.cases]);

  const hasResults = stats.completed > 0;
  const score = percent(stats.counts.pass, total);
  const baselineScore = percent(stats.baselinePass, total);
  const delta = score - baselineScore;
  const tone = directionOf(delta);

  const rows = useMemo(() => categories.map(name => {
    const items = suite.cases.filter(item => item.category === name);
    let pass = 0, fail = 0, error = 0, scored = 0;
    for (const item of items) {
      const outcome = results[item.id]?.outcome;
      if (!outcome) continue;
      scored++;
      if (outcome === "pass") pass++; else if (outcome === "fail") fail++; else error++;
    }
    const baselinePass = items.filter(item => item.baseline === "pass").length;
    return { name, items, pass, fail, error, scored, baselinePass, total: items.length };
  }), [categories, suite.cases, results]);

  /* Filters and list */
  const [filter, setFilter] = useState<CaseFilter>(defaultFilter);
  const [pageOpen, setPageOpen] = useState<CaseFilter | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const arrival = useMemo(() => new Map(Object.keys(results).map((id, i) => [id, i])), [results]);
  const matches = useCallback((item: EvalCase, which: CaseFilter) => {
    if (which === "all") return true;
    const result = results[item.id];
    if (!result) return false;
    if (which === "failed") return result.outcome !== "pass";
    return changeOf(item) === (which === "regressions" ? "regression" : "improved");
  }, [results, changeOf]);
  const listFor = useCallback((which: CaseFilter) => which === "all"
    ? suite.cases
    : suite.cases.filter(item => matches(item, which)).sort((a, b) => (arrival.get(a.id) ?? 0) - (arrival.get(b.id) ?? 0)), [suite.cases, matches, arrival]);
  const list = useMemo(() => listFor(filter), [listFor, filter]);
  const showAll = pageOpen === filter;
  const visible = showAll ? list : list.slice(0, PAGE);
  const hiddenCount = list.length - visible.length;
  const filterCounts: Record<CaseFilter, number> = { all: total, failed: stats.counts.fail + stats.counts.error, regressions: stats.regressions, improved: stats.improved };

  /* Triage */
  const [triage, setTriage] = useState<Record<string, TriageState>>({});
  const issueNumber = useRef(2481);
  const [announcement, setAnnouncement] = useState("");

  function triageCase(item: EvalCase, action: TriageAction) {
    const id = item.id;
    setTriage(current => ({ ...current, [id]: { action, status: "pending" } }));
    const fallbackKey = `SUP-${issueNumber.current++}`;
    const finish = (key?: string) => {
      const issueKey = key ?? fallbackKey;
      setTriage(current => ({ ...current, [id]: { action, status: "done", issueKey } }));
      setAnnouncement(action === "expected" ? `${item.title} marked as expected` : `Issue ${issueKey} opened in Linear for ${item.title}${onTriage ? "" : ", simulated"}`);
    };
    if (onTriage) {
      Promise.resolve(onTriage(id, action)).then(
        value => finish(typeof value === "string" ? value : undefined),
        () => {
          setTriage(current => { const next = { ...current }; delete next[id]; return next; });
          setAnnouncement(`Could not ${action === "expected" ? "mark the case as expected" : "open the issue"}. Try again.`);
        },
      );
    } else {
      window.setTimeout(() => finish(), action === "issue" ? 700 : 260);
    }
  }
  function undoTriage(item: EvalCase) {
    setTriage(current => { const next = { ...current }; delete next[item.id]; return next; });
    setAnnouncement(`${item.title} is a regression again`);
  }
  const triagedRegressions = suite.cases.filter(item => triage[item.id]?.status === "done" && changeOf(item) === "regression").length;

  /* Announcements for the run */
  const [prevStatus, setPrevStatus] = useState(run.status);
  if (prevStatus !== run.status) {
    setPrevStatus(run.status);
    const message = run.status === "running" ? `Running ${total} cases${run.simulated ? ", simulated" : ""}`
      : run.status === "done" ? `Run finished. Score ${score.toFixed(1)} percent, ${deltaWords(delta)} against ${baseline.version}. ${stats.regressions} regressions, ${stats.improved} improved.`
        : run.status === "stopped" ? `Run stopped after ${stats.completed} of ${total} cases`
          : run.status === "failed" ? `Run failed. ${run.error ?? ""}` : "";
    if (message) setAnnouncement(message);
  }

  /* Grid: hover readout and click to open */
  const [hoverId, setHoverId] = useState<string | null>(null);
  const hovered = hoverId ? caseById.get(hoverId) : undefined;
  const rowId = (id: string) => `${uid}-row-${id}`;
  function caseFromEvent(event: PointerEvent<HTMLElement> | MouseEvent<HTMLElement>) {
    const target = event.target as HTMLElement | null;
    return target?.closest<HTMLElement>("[data-case]")?.dataset.case ?? null;
  }
  function openFromGrid(id: string) {
    const item = caseById.get(id);
    if (!item?.input) return;
    const result = results[id];
    const change = changeOf(item);
    const next: CaseFilter = change === "regression" ? "regressions" : change === "improved" ? "improved" : result && result.outcome !== "pass" ? "failed" : "all";
    setFilter(next);
    setOpenId(id);
    if (listFor(next).indexOf(item) >= PAGE) setPageOpen(next);
    window.requestAnimationFrame(() => {
      const node = document.getElementById(rowId(id));
      node?.focus({ preventScroll: true });
      node?.scrollIntoView({ block: "nearest", behavior: reduced ? "auto" : "smooth" });
    });
  }

  function toggleRun() {
    if (running) { stop(); return; }
    setHoverId(null);
    start();
  }

  const scoreLabel = running ? null : run.status === "stopped" ? `Partial score, ${stats.completed} of ${total}` : run.status === "failed" ? "Run failed" : "Score";
  const listEmpty = emptyCopy(filter, run.status, hasResults, baseline.version);
  const runLabel = running ? "Stop" : run.status === "idle" ? "Run" : "Run again";

  return <div className={cx(styles.root, className)}>
    <section className={styles.card} aria-labelledby={`${uid}-title`} aria-busy={running || undefined}>
      {/* Header */}
      <header className={styles.header}>
        <h2 id={`${uid}-title`} className={styles.title}>{suite.name}</h2>
        <p className={styles.subtitle}>
          <span>{candidate.version} against {baseline.version}</span>
          <span className={styles.subDot} aria-hidden="true">·</span>
          <span>{total} test cases</span>
        </p>
        <RunButton which={running ? "stop" : run.status === "idle" ? "run" : "again"} onClick={toggleRun} label={running ? "Stop run" : `${runLabel}, ${total} cases`} />
        {/* Wide: one line of chips. Narrow: a small aligned table, version or role on the left, model on the right. */}
        <div className={styles.meta}>
          <span className={styles.metaItem}>
            <span className={styles.metaKey}>{candidate.version}</span>
            <ModelChip model={candidate.model} version={candidate.version} />
          </span>
          <span className={styles.metaAgainst}>against</span>
          <span className={styles.metaItem}>
            <span className={styles.metaKey}>{baseline.version}</span>
            <ModelChip model={baseline.model} version={baseline.version} />
          </span>
          <span className={styles.metaDivider} aria-hidden="true" />
          <span className={styles.metaItem}>
            <span className={styles.metaKey} data-keep="">Judge</span>
            <ModelChip model={suite.judge} />
          </span>
        </div>
      </header>

      {/* Summary */}
      <div className={styles.summary}>
        <div className={styles.scoreStat}>
          <div className={styles.statLabel}>
            {running
              ? <span className={styles.scoring}><TextShimmer>Scoring</TextShimmer><span className={styles.scoringCount}>{stats.completed} of {total}</span></span>
              : <span>{scoreLabel}</span>}
          </div>
          <div className={styles.scoreLine}>
            {hasResults || running
              ? <span className={styles.score} key="score"><CountUp value={score} format={formatPercent1} /><span className={styles.scoreUnit}>%</span></span>
              : <span className={styles.scoreEmpty} key="empty">Not run yet</span>}
            <span className={styles.scoreDelta} data-on={finished || undefined} aria-hidden={!finished || undefined}>
              <Delta value={delta} unit />
              <span className={styles.srOnly}>{deltaWords(delta)} against {baseline.version}</span>
            </span>
          </div>
          <div className={styles.baselineLine}>
            <span className={styles.ghostKey} aria-hidden="true" />
            <span>{baseline.version} scored {baselineScore.toFixed(1)}%</span>
          </div>
        </div>

        <HistorySparkline runs={runs} current={finished ? score : null} currentLabel={candidate.version} tone={tone} />

        <dl className={styles.costStat}>
          <div>
            <dt className={styles.statLabel}>Cost</dt>
            <dd className={styles.costValue} data-estimate={!hasResults || undefined}>
              {hasResults ? <CountUp value={stats.cost} format={formatDollars} /> : suite.estimate ? `About ${formatCost(suite.estimate.costUsd)}` : "Not run"}
            </dd>
          </div>
          <div>
            <dt className={styles.statLabel}>Time</dt>
            <dd className={styles.costValue} data-estimate={!hasResults || undefined}>
              {hasResults ? formatDuration(run.elapsed) : suite.estimate ? `About ${Math.round(suite.estimate.seconds / 60)} min` : "Not run"}
            </dd>
          </div>
        </dl>
      </div>

      <AnimatePresence initial={false}>
        {run.status === "failed" && <motion.div key="failed" className={styles.alertWrap} initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={reduced ? instant : motionTokens.spring.smooth}>
          <div className={styles.alert} role="alert">
            <CircleAlert aria-hidden="true" />
            <span className={styles.alertText}>{run.error ?? "The run failed."} {stats.completed ? `${stats.completed} of ${total} cases were scored.` : ""}</span>
            <Button variant="secondary" size="sm" onClick={start}>Try again</Button>
          </div>
        </motion.div>}
      </AnimatePresence>

      {/* Grid */}
      <div className={styles.gridSection}>
        <div className={styles.rows} data-running={running || undefined}
          onPointerOver={event => setHoverId(caseFromEvent(event))} onPointerLeave={() => setHoverId(null)}
          onClick={event => { const id = caseFromEvent(event); if (id) openFromGrid(id); }}>
          {rows.map(row => {
            const pct = percent(row.pass, row.total);
            const rowDelta = pct - percent(row.baselinePass, row.total);
            const summary = !row.scored
              ? `${row.name}: ${row.total} cases, ${running ? "waiting" : "not run"}. ${baseline.version} passed ${row.baselinePass}.`
              : `${row.name}: ${row.pass} of ${row.total} passed, ${row.fail} failed, ${row.error} ${row.error === 1 ? "error" : "errors"}${row.scored < row.total ? `, ${row.total - row.scored} not scored yet` : ""}. ${Math.round(pct)} percent${finished ? `, ${deltaWords(rowDelta)} against ${baseline.version}` : ""}.`;
            return <div key={row.name} className={styles.catRow} role="img" aria-label={summary}>
              <span className={styles.catLabel}>{row.name}</span>
              <span className={styles.cells} style={{ "--n": row.total, "--half": Math.ceil(row.total / 2) } as CSSProperties}>
                {row.items.map(item => {
                  const outcome = results[item.id]?.outcome;
                  const change = changeOf(item);
                  const dim = !running && hasResults && filter !== "all" && !matches(item, filter);
                  return <span key={item.id} className={styles.cell} data-case={item.id} data-outcome={outcome}
                    data-running={(!outcome && inflight.has(item.id)) || undefined} data-strong={change === "regression" || undefined}
                    data-dim={dim || undefined} data-selected={openId === item.id || undefined} data-hover={hoverId === item.id || undefined}
                    data-clickable={(!!item.input && !!outcome) || undefined}>
                    {outcome && <OutcomeGlyph outcome={outcome} />}
                  </span>;
                })}
              </span>
              <span className={styles.catStats}>
                <ScoreBar value={row.pass / Math.max(1, row.total)} baseline={row.baselinePass / Math.max(1, row.total)} tone={finished ? directionOf(rowDelta) : undefined} className={styles.catBar} />
                <span className={styles.catPct}>{row.scored ? <CountUp value={pct} format={formatPercent0} /> : <span className={styles.muted}>–</span>}</span>
                <span className={styles.catDelta} data-on={finished || undefined}><Delta value={rowDelta} /></span>
              </span>
            </div>;
          })}
        </div>

        {/* One line under the grid: the legend with live counts, or the hovered case. Both layers share one grid cell, so the height never changes. */}
        <div className={styles.readout} aria-hidden="true">
          <div className={styles.legend} data-hidden={hovered ? "" : undefined}>
            <span className={styles.legendItem}><MiniCell outcome="pass" />{hasResults ? `${stats.counts.pass} passed` : "Pass"}</span>
            <span className={styles.legendItem}><MiniCell outcome="fail" />{hasResults ? `${stats.counts.fail} failed` : "Fail"}</span>
            <span className={styles.legendItem}><MiniCell outcome="error" />{hasResults ? `${stats.counts.error} ${stats.counts.error === 1 ? "error" : "errors"}` : "Error"}</span>
            <span className={styles.legendItem}><MiniCell outcome="fail" strong />{hasResults ? `${stats.regressions} ${stats.regressions === 1 ? "regression" : "regressions"}` : "Regression"}</span>
            <span className={styles.legendItem}><span className={styles.ghostKey} />{baseline.version}</span>
          </div>
          <div className={styles.hoverLine} data-hidden={hovered ? undefined : ""}>
            {hovered && <>
              <span className={styles.hoverTitle}>{hovered.title}</span>
              <span className={styles.hoverOutcomes}>
                <MiniCell outcome={hovered.baseline} />{baseline.version}
                <ArrowRight className={styles.transArrow} />
                <MiniCell outcome={results[hovered.id]?.outcome} strong={changeOf(hovered) === "regression"} />{results[hovered.id] ? candidate.version : `${candidate.version} not run`}
              </span>
            </>}
          </div>
        </div>
      </div>

      {/* Cases */}
      <div className={styles.cases}>
        <div className={styles.casesBar}>
          <Seg label="Filter cases" controls={`${uid}-list`} value={filter} onChange={value => setFilter(value as CaseFilter)}
            options={(Object.keys(filterLabels) as CaseFilter[]).map(value => ({ value, label: filterLabels[value], count: value === "all" || hasResults ? filterCounts[value] : undefined }))} />
          {filter === "regressions" && finished && stats.regressions > 0 && <span className={styles.casesNote}>{triagedRegressions} of {stats.regressions} triaged</span>}
        </div>
        <AutoHeight armKey={`${filter}-${showAll}`}>
          <div id={`${uid}-list`}>
            {visible.length
              ? <ul key={filter} className={styles.list}>
                <AnimatePresence initial={false}>
                  {visible.map(item => <CaseRow key={item.id} id={rowId(item.id)} item={item} suite={suite} rubric={rubric}
                    result={results[item.id]} change={changeOf(item)} open={openId === item.id} triage={triage[item.id]} simulated={!onTriage}
                    onToggle={() => setOpenId(current => current === item.id ? null : item.id)}
                    onTriage={action => triageCase(item, action)} onUndo={() => undoTriage(item)} />)}
                </AnimatePresence>
              </ul>
              : <motion.p key={`${filter}-${run.status}`} className={styles.empty} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={reduced ? instant : fadeIn}>
                {listEmpty.done && <Check aria-hidden="true" />}
                {listEmpty.text}
              </motion.p>}
            {(hiddenCount > 0 || showAll && list.length > PAGE) && <button type="button" className={styles.more} onClick={() => setPageOpen(showAll ? null : filter)} aria-controls={`${uid}-list`}>
              {showAll ? "Show fewer" : `Show ${hiddenCount} more`}
              <ChevronDown className={styles.moreIcon} data-flip={showAll || undefined} aria-hidden="true" />
            </button>}
          </div>
        </AutoHeight>
      </div>

      <p className={styles.srOnly} role="status" aria-live="polite">{announcement}</p>
    </section>
  </div>;
}

function emptyCopy(filter: CaseFilter, status: string, hasResults: boolean, baseline: string) {
  if (!hasResults && status !== "running") return { text: `Run the suite to compare every case with ${baseline}.`, done: false };
  if (status === "running") return { text: "None so far.", done: false };
  if (status === "stopped") return { text: "None in the cases scored before the stop.", done: false };
  if (filter === "regressions") return { text: `No regressions. Every case that passed on ${baseline} still passes.`, done: true };
  if (filter === "failed") return { text: "Every case passed.", done: true };
  return { text: `No case went from failing on ${baseline} to passing.`, done: false };
}

/* ---------------------------------------------------------------------------------------------------------------
 * Case row
 * ------------------------------------------------------------------------------------------------------------- */

function CaseRow({ id, item, suite, rubric, result, change, open, triage, simulated, onToggle, onTriage, onUndo }: {
  id: string; item: EvalCase; suite: EvalSuiteData; rubric: string[]; result?: EvalCaseResult; change: Change; open: boolean;
  triage?: TriageState; simulated: boolean; onToggle: () => void; onTriage: (action: TriageAction) => void; onUndo: () => void;
}) {
  const reduced = useReducedMotion();
  const expandable = !!item.input;
  const panelId = `${id}-panel`;
  const now = result?.outcome;
  const describe = `${suite.baseline.version} ${outcomeLabel[item.baseline].toLowerCase()}, ${suite.candidate.version} ${now ? outcomeLabel[now].toLowerCase() : "not run"}${change === "regression" ? ", regression" : change === "improved" ? ", improved" : ""}`;
  const done = triage?.status === "done" ? triage : undefined;
  const content = <>
    <span className={styles.trans} aria-hidden="true">
      <MiniCell outcome={item.baseline} />
      <ArrowRight className={styles.transArrow} />
      <MiniCell outcome={now} strong={change === "regression"} />
    </span>
    <span className={styles.rowTitle}>{item.title}<span className={styles.srOnly}>. {item.category}. {describe}{done ? `. ${done.action === "expected" ? "Marked as expected" : `Issue ${done.issueKey}`}` : ""}</span></span>
    {done && <span className={styles.rowTag} aria-hidden="true">
      {done.action === "expected" ? <><Check /><span className={styles.rowTagText}>Expected</span></> : <><LinearMark title="" className={styles.linear} /><span className={styles.rowTagText}>{done.issueKey}</span></>}
    </span>}
    <span className={styles.rowCategory} aria-hidden="true">{item.category}</span>
    {expandable ? <ChevronDown className={styles.chevron} aria-hidden="true" /> : <span className={styles.chevronSpace} aria-hidden="true" />}
  </>;

  return <motion.li className={styles.item} data-open={open || undefined}
    initial={reduced ? { opacity: 0 } : { height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={reduced ? { opacity: 0 } : { height: 0, opacity: 0 }}
    transition={reduced ? instant : { height: motionTokens.spring.smooth, opacity: fadeIn }}>
    {expandable
      ? <button type="button" id={id} className={styles.rowButton} aria-expanded={open} aria-controls={panelId} onClick={onToggle}>{content}</button>
      : <div id={id} className={styles.rowStatic}>{content}</div>}
    <AnimatePresence initial={false}>
      {open && expandable && <motion.div key="detail" id={panelId} role="region" aria-labelledby={id} className={styles.detailWrap}
        initial={reduced ? { opacity: 0 } : { height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={reduced ? { opacity: 0 } : { height: 0, opacity: 0 }}
        transition={reduced ? instant : { height: motionTokens.spring.smooth, opacity: fadeIn }}>
        <CaseDetail suite={suite} item={item} result={result} rubric={rubric} triage={triage} simulated={simulated} onTriage={onTriage} onUndo={onUndo} />
      </motion.div>}
    </AnimatePresence>
  </motion.li>;
}

export default EvalSuite;
