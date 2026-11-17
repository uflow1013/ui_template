"use client";

/*
 * Prompt studio: one card for editing, testing and shipping a prompt template.
 *
 * Header: the prompt's name, a version chip (versions, compare, promote with undo) and a model chip (model and effort).
 * Editor: System and User tabs where {{variables}} are atomic chips, each variable in its own series color.
 * Variables: one field per variable, colored like its chips, filled from saved test cases.
 * Run: streams the reply below in fast chunks with latency, tokens and cost. Compare turns the editor into a word diff.
 */

import { useCallback, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Play, Square } from "lucide-react";
import { motionTokens } from "@/shared/arc/lib/motion-tokens";
import { Button } from "@/shared/arc/button/button";
import { useKbdPlatform } from "@/shared/arc/pro/kbd/kbd";
import {
  detectVariables, diffStats, effortThink, renderTemplate, sampleCases, sampleNow, sampleVariables, sampleVersions, simulatedReply,
  estimateTokens, studioModels, wordDiff,
  type Effort, type PromptModel, type PromptTemplate, type PromptTestCase, type PromptVersion,
} from "./prompt-studio-data";
import { PromptEditor } from "./prompt-editor";
import { AutoHeight, DiffView, ModelMenu, OutputPanel, RollingNumber, Seg, Swap, VersionMenu, type Promotion } from "./prompt-studio-parts";
import { usePromptRun, type OnRun } from "./use-prompt-run";
import styles from "./prompt-studio.module.css";

export type { Effort, PromptModel, PromptRunRequest, PromptTemplate, PromptTestCase, PromptVersion } from "./prompt-studio-data";
export type { OnRun } from "./use-prompt-run";

export interface PromptStudioProps {
  /** Name of the prompt, shown in the header. */
  name?: string;
  /** Saved versions, newest first. */
  versions?: PromptVersion[];
  /** The version open in the editor. Defaults to the newest. */
  versionId?: string;
  /** The version production serves. Defaults to the open version. */
  productionId?: string | null;
  /** The draft the editor opens with. Defaults to the open version's text. */
  template?: PromptTemplate;
  /** Variable order for colors and fields: the first four take --series-1 to --series-4. Defaults to the order they appear. */
  variables?: string[];
  /** Saved test cases. The first one is selected on load. */
  testCases?: PromptTestCase[];
  models?: PromptModel[];
  defaultModel?: string;
  /** Defaults to the model's own default effort. */
  defaultEffort?: Effort;
  /** Reference moment for relative dates. Defaults to now, or to the sample date when the sample versions are shown. */
  now?: string | number | Date;
  /** Runs the prompt. Return the whole reply or an async iterable of text deltas; throw to show the error state. Without it, runs are simulated. */
  onRun?: OnRun;
  /** Called after a promotion, and again with the ids swapped when it is undone. */
  onPromote?: (versionId: string, previousId: string | null) => void;
  /** Called with the draft after every edit. */
  onTemplateChange?: (template: PromptTemplate) => void;
  className?: string;
}

const unique = (list: string[]) => [...new Set(list)];
const fade = { duration: motionTokens.duration.fast, ease: [...motionTokens.ease.enter] as [number, number, number, number] };
const fadeOut = { duration: .1 };

export function PromptStudio({
  name = "Support reply",
  versions: versionsProp,
  versionId,
  productionId: productionProp,
  template,
  variables: declaredProp,
  testCases = sampleCases,
  models = studioModels,
  defaultModel = "claude-sonnet-5-5",
  defaultEffort,
  now: nowProp,
  onRun,
  onPromote,
  onTemplateChange,
  className,
}: PromptStudioProps) {
  const uid = useId();
  const reduced = useReducedMotion();
  const platform = useKbdPlatform();
  const versions = versionsProp ?? sampleVersions;
  const openId = versionId ?? versions[0]?.id ?? "";
  const openVersion = versions.find(v => v.id === openId) ?? versions[0];
  const [mountedAt] = useState(() => Date.now());
  const now = nowProp !== undefined ? new Date(nowProp).getTime() : versionsProp ? mountedAt : Date.parse(sampleNow);

  /* Draft and variables */
  const [draft, setDraft] = useState<PromptTemplate>(() => template ?? { system: openVersion?.system ?? "", user: openVersion?.user ?? "" });
  const [tab, setTab] = useState<"system" | "user">("system");
  const detected = useMemo(() => detectVariables(draft.system, draft.user), [draft]);
  const declared = useMemo(() => declaredProp ?? (versionsProp ? detectVariables(openVersion?.system ?? "", openVersion?.user ?? "") : sampleVariables), [declaredProp, versionsProp, openVersion]);
  const order = useMemo(() => unique([...declared, ...detected]), [declared, detected]);
  const toneOf = useCallback((variable: string) => {
    const index = order.indexOf(variable);
    return ((index < 0 ? order.length : index) % 4) + 1;
  }, [order]);

  const [caseId, setCaseId] = useState(testCases[0]?.id ?? "");
  const testCase = testCases.find(c => c.id === caseId) ?? testCases[0];
  const [values, setValues] = useState<Record<string, string>>(() => ({ ...testCases[0]?.values }));
  const [activeVar, setActiveVar] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ name: string; at: number } | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const flashCount = useRef(0);
  const missing = order.filter(variable => !values[variable]?.trim());
  const wide = useMemo(() => new Set(order.filter(variable => testCases.some(c => (c.values[variable] ?? "").length > 30))), [order, testCases]);

  function updateDraft(part: "system" | "user", value: string) {
    const next = { ...draft, [part]: value };
    setDraft(next);
    onTemplateChange?.(next);
  }

  function setValue(variable: string, value: string) {
    setValues(current => ({ ...current, [variable]: value }));
    setFlash({ name: variable, at: ++flashCount.current });
  }

  function chooseCase(id: string) {
    const next = testCases.find(c => c.id === id);
    if (!next) return;
    setCaseId(id);
    setValues({ ...next.values });
    setAnnouncement(`${next.label} test case loaded`);
  }

  /* Model */
  const [modelId, setModelId] = useState(() => models.find(m => m.id === defaultModel)?.id ?? models[0]?.id ?? "");
  const model = models.find(m => m.id === modelId) ?? models[0];
  const [effort, setEffort] = useState<Effort>(() => defaultEffort ?? model?.defaultEffort ?? "medium");
  function chooseModel(id: string) {
    const next = models.find(m => m.id === id);
    if (!next || id === modelId) return;
    setModelId(id);
    setEffort(next.defaultEffort);
    setAnnouncement(`${next.name} selected, ${next.defaultEffort} effort`);
  }

  /* Versions */
  const [productionId, setProductionId] = useState<string | null>(() => productionProp !== undefined ? productionProp : openId);
  const [promotion, setPromotion] = useState<Promotion | null>(null);
  const [compareId, setCompareId] = useState<string | null>(null);
  const compareVersion = versions.find(v => v.id === compareId) ?? null;
  function promote(id: string) {
    const previous = productionId;
    setProductionId(id);
    setPromotion({ from: previous, to: id });
    onPromote?.(id, previous);
    setAnnouncement(`${versions.find(v => v.id === id)?.label} promoted to production. Undo is available.`);
  }
  function undoPromotion() {
    if (!promotion) return;
    setProductionId(promotion.from);
    onPromote?.(promotion.from ?? "", promotion.to);
    setAnnouncement(`Promotion undone. Production serves ${versions.find(v => v.id === promotion.from)?.label ?? "no version"}.`);
    setPromotion(null);
  }
  function startCompare(id: string) {
    setCompareId(id);
    setAnnouncement(`Comparing ${versions.find(v => v.id === id)?.label} with ${openVersion?.label}`);
  }
  function endCompare() {
    setCompareId(null);
    setAnnouncement("Back to editing");
  }
  const diff = useMemo(() => compareVersion ? { system: wordDiff(compareVersion.system, draft.system), user: wordDiff(compareVersion.user, draft.user) } : null, [compareVersion, draft]);
  const stats = diff ? diffStats(diff[tab]) : null;
  const changed = diff ? { system: diff.system.some(op => op.type !== "same"), user: diff.user.some(op => op.type !== "same") } : null;

  /* Run */
  const { run, start, stop, running } = usePromptRun(onRun);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [lockHeight, setLockHeight] = useState<number | null>(null);
  const failed = useRef(false);

  const runNow = useCallback(() => {
    if (running || !model || !testCase) return;
    const rendered = { system: renderTemplate(draft.system, values), user: renderTemplate(draft.user, values) };
    // A rerun holds the panel at its current height until the new reply is in, so nothing collapses and regrows.
    setLockHeight(bodyRef.current?.offsetHeight ?? null);
    const fail = !onRun && testCase.id === "window" && !failed.current
      ? `${model.name} is overloaded right now (529). Nothing was billed, so it is safe to retry.`
      : undefined;
    if (fail) failed.current = true;
    start({ template: draft, rendered, values, model, effort, testCaseId: testCase.id, versionId: openId }, {
      reply: simulatedReply(testCase.id, values), fail, think: effortThink[effort], caseLabel: testCase.label,
    });
    setAnnouncement(`Running ${testCase.label} on ${model.name}${onRun ? "" : ", simulated"}`);
  }, [running, model, testCase, draft, values, onRun, start, effort, openId]);

  const [prevStatus, setPrevStatus] = useState(run?.status);
  if (run?.status !== prevStatus) {
    setPrevStatus(run?.status);
    if (run && run.status !== "thinking" && run.status !== "streaming") {
      setLockHeight(null);
      setAnnouncement(run.status === "done" ? `Reply ready${run.simulated ? ", simulated" : ""}, ${run.stats?.seconds}, ${run.stats ? run.stats.input + run.stats.output : 0} tokens, ${run.stats?.cost}`
        : run.status === "error" ? `Run failed. ${run.error}` : "Run stopped");
    }
  }

  function onCardKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.defaultPrevented) return;
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      runNow();
    } else if (event.key === "Escape" && compareId && event.currentTarget.contains(event.target as Node)) {
      event.preventDefault();
      endCompare();
    }
  }

  const tokens = estimateTokens(renderTemplate(draft[tab], values));
  const panelId = (part: string) => `${uid}-${part}`;
  const keys = platform === "pc" ? "Ctrl ↵" : "⌘↵";

  return <div className={[styles.root, className].filter(Boolean).join(" ")}>
    <section className={styles.card} aria-label={`${name} prompt`} onKeyDown={onCardKeyDown}>
      <header className={styles.header}>
        <div className={styles.titleGroup}>
          <h2 className={styles.title}>{name}</h2>
          <VersionMenu versions={versions} openId={openId} productionId={productionId} now={now} promotion={promotion}
            onCompare={startCompare} onPromote={promote} onUndo={undoPromotion} />
        </div>
        <ModelMenu models={models} modelId={modelId} effort={effort} onModel={chooseModel} onEffort={level => { setEffort(level); setAnnouncement(`${level} effort`); }} />
      </header>

      <div className={styles.editor}>
        <div className={styles.editorBar}>
          <Seg kind="tabs" label="Prompt part" value={tab} onChange={value => setTab(value as "system" | "user")} options={[
            { value: "system", id: panelId("tab-system"), panel: panelId("system"), label: <>System{changed?.system ? <><span className={styles.tabDot} aria-hidden="true" /><span className={styles.srOnly}>, changed</span></> : null}</> },
            { value: "user", id: panelId("tab-user"), panel: panelId("user"), label: <>User{changed?.user ? <><span className={styles.tabDot} aria-hidden="true" /><span className={styles.srOnly}>, changed</span></> : null}</> },
          ]} />
          <div className={styles.corner}>
            <AnimatePresence initial={false}>
              {compareVersion && stats ? <motion.div key="compare" className={styles.cornerItem} initial={{ opacity: 0 }} animate={{ opacity: 1, transition: reduced ? { duration: 0 } : fade }} exit={{ opacity: 0, transition: reduced ? { duration: 0 } : fadeOut }}>
                <span className={styles.diffStats}>
                  <span className={styles.statAdd}><span aria-hidden="true">+</span>{stats.added}<span className={styles.srOnly}> words added</span></span>
                  <span className={styles.statRemove}><span aria-hidden="true">{"−"}</span>{stats.removed}<span className={styles.srOnly}> words removed</span></span>
                </span>
                <Button variant="ghost" size="sm" className={styles.backButton} onClick={endCompare}>Back to editing</Button>
              </motion.div> : <motion.div key="tokens" className={styles.cornerItem} initial={{ opacity: 0 }} animate={{ opacity: 1, transition: reduced ? { duration: 0 } : fade }} exit={{ opacity: 0, transition: reduced ? { duration: 0 } : fadeOut }}>
                <span className={styles.tokens}><RollingNumber value={tokens} /><span>tokens</span></span>
              </motion.div>}
            </AnimatePresence>
          </div>
        </div>

        <AutoHeight armKey={compareId ?? "edit"} sticky={false}>
          <div className={styles.editorStack}>
            {(["system", "user"] as const).map(part => {
              const hidden = tab !== part || Boolean(compareVersion);
              return <div key={part} id={panelId(part)} role="tabpanel" aria-labelledby={panelId(`tab-${part}`)} className={styles.pane} data-hidden={hidden || undefined} inert={hidden}>
                <PromptEditor value={draft[part]} onChange={value => updateDraft(part, value)} variables={order} toneOf={toneOf}
                  missing={missing} activeVariable={activeVar} flash={flash} inert={hidden}
                  onChipClick={variable => document.getElementById(panelId(`field-${variable}`))?.focus()}
                  onSubmit={runNow} label={`${part === "system" ? "System" : "User"} prompt`} describedBy={panelId("hint")}
                  placeholder={part === "system" ? "Describe how the model should behave" : "Write the message, with {{variables}}"} />
              </div>;
            })}
            <AnimatePresence initial={false}>
              {compareVersion && diff && <motion.div key={`diff-${compareVersion.id}`} className={styles.diffPane} initial={{ opacity: 0 }} animate={{ opacity: 1, transition: reduced ? { duration: 0 } : fade }} exit={{ opacity: 0, transition: reduced ? { duration: 0 } : fadeOut }}
                role="region" aria-label={`Changes from ${compareVersion.label} to ${openVersion?.label}, ${tab} prompt`}>
                <DiffView ops={diff[tab]} toneOf={toneOf} />
              </motion.div>}
            </AnimatePresence>
          </div>
        </AutoHeight>

        <div className={styles.hint} id={panelId("hint")}>
          <Swap id={compareVersion ? `c-${compareVersion.id}` : "edit"} className={styles.hintSwap}>
            {compareVersion
              ? <><span className={styles.hintVersions}>{compareVersion.label} to {openVersion?.label}</span><span className={styles.legendAdd}>+ added</span><span className={styles.legendRemove}>{"−"} removed</span></>
              : <>Type <span className={styles.hintKey}>{"{{"}</span> to add a variable</>}
          </Swap>
        </div>
      </div>

      <div className={styles.vars}>
        <AutoHeight armKey={order.join(",")} sticky={false}><div className={styles.fields}>
          {order.map(variable => {
            const used = detected.includes(variable);
            return <label key={variable} className={styles.field} data-tone={toneOf(variable)} data-wide={wide.has(variable) || undefined} data-unused={!used || undefined}>
              <span className={styles.fieldLabel}><span className={styles.fieldDot} aria-hidden="true" />{variable}</span>
              <input id={panelId(`field-${variable}`)} className={styles.input} value={values[variable] ?? ""} spellCheck={false} autoComplete="off"
                placeholder={used ? "Empty" : "Not in the prompt"} aria-describedby={used ? undefined : panelId("hint")}
                onChange={event => setValue(variable, event.target.value)}
                onFocus={() => setActiveVar(variable)} onBlur={() => setActiveVar(current => current === variable ? null : current)} />
            </label>;
          })}
        </div></AutoHeight>
        <div className={styles.runRow}>
          <Seg kind="segmented" label="Test case" value={caseId} onChange={chooseCase} className={styles.cases}
            options={testCases.map(c => ({ value: c.id, label: c.label }))} />
          <button type="button" className={styles.run} onClick={running ? stop : runNow} aria-label={running ? "Stop run" : "Run prompt"} aria-keyshortcuts="Meta+Enter Control+Enter">
            <span className={styles.runIcon} aria-hidden="true">
              <Play data-on={!running || undefined} />
              <Square data-on={running || undefined} />
            </span>
            <span className={styles.runLabel} aria-hidden="true">
              <span data-on={!running || undefined}>Run</span>
              <span data-on={running || undefined}>Stop</span>
            </span>
            <span className={styles.runKeys} aria-hidden="true">{keys}</span>
          </button>
        </div>
      </div>

      <OutputPanel run={run} bodyRef={bodyRef} lockHeight={lockHeight} onRetry={runNow}
        idleHint={<span>Run <span className={styles.idleCase}>{testCase?.label}</span> to see the reply here{onRun ? "" : ". Runs are simulated"}.</span>} />
    </section>
    <div className={styles.srOnly} role="status" aria-live="polite">{announcement}</div>
  </div>;
}

export default PromptStudio;
