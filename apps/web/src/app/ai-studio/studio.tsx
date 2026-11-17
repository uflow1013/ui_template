"use client";

import { Button } from "@/shared/arc/button/button";
import { CopyButton } from "@/shared/arc/copy-button/copy-button";
import { Dialog, DialogContent } from "@/shared/arc/dialog/dialog";
import { AiCommand } from "@/shared/arc/pro/ai-command/ai-command";
import { AiMascot } from "@/shared/arc/pro/ai-mascot/ai-mascot";
import { AiSpark } from "@/shared/arc/pro/ai-spark/ai-spark";
import { MorphLoader } from "@/shared/arc/pro/morph-loader/morph-loader";
import { FeedbackActions } from "@/shared/arc/pro/response-feedback/response-feedback";
import { LogoutButton, ThemeMenu } from "@/shared/layout/site-header";
import { ArrowUpRight, Command, Menu, PanelRight, Paperclip, ScanLine } from "lucide-react";
import { useReducedMotion } from "motion/react";
import { Component, Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import { Composer, type ComposerDraft, type ComposerHandle } from "./arc-blocks/ai-composer/composer";
import { sampleModels, type Effort } from "./arc-blocks/ai-composer/composer-data";
import { commandArtifacts } from "./command-artifacts";
import { commandGroups, followUpCommands, quickCommands, resolveCommand, studioCommand, type StudioCommand } from "./commands";
import { StudioHistory, STUDIO_HISTORY_DRAWER_ID } from "./studio-history";
import { StudioPanel, studioPanelId, useStudioPanelDock } from "./studio-panel";
import styles from "./studio.module.css";

interface Turn {
  id: number;
  text: string;
  files: string[];
  model: string;
  command?: StudioCommand;
  phase: "waiting" | "complete" | "stopped";
}

interface Conversation {
  id: number;
  title: string;
  turns: Turn[];
}

const panelCommands = new Set<StudioCommand[0]>([
  "research-run", "source-cards", "vector-search", "document-extract",
  "agent-run", "agent-timeline", "ai-workflow", "ai-inline-edit", "ask-your-data",
  "model-arena", "eval-suite", "prompt-studio", "training-run", "image-generation",
]);

const guide = "可以点选一个快捷指令，或从「所有指令」搜索要体验的功能。例如发送 /research-run 可以打开资料研究。";
const paletteItems = commandGroups.flatMap((group) => group.tools.map(([id, label]) => ({
  id,
  label,
  group: group.label,
  meta: "/" + id,
  keywords: [id, group.note],
})));

class ArtifactBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed
      ? <p role="alert" className={styles.unavailable}>这个示例暂时加载失败。其他指令仍可继续使用，可刷新页面后再试。</p>
      : this.props.children;
  }
}

function LoadingIndicator({ label }: { label: string }) {
  return <div className={styles.loading} role="status">
    <MorphLoader decorative size={18} />
    <span>{label}</span>
  </div>;
}

function ReplyArtifact({ command, onPrompt }: { command: StudioCommand; onPrompt: (prompt: string) => void }) {
  const Artifact = commandArtifacts[command[0]];
  return <div className={styles.artifact} aria-label={command[1]}>
    <ArtifactBoundary>
      <Suspense fallback={<LoadingIndicator label="正在加载交互示例…" />}>
        <Artifact onPrompt={onPrompt} />
      </Suspense>
    </ArtifactBoundary>
  </div>;
}

function ConversationTurn({ turn, send, onPrompt, onOpenResult, resultOpen, docked, busy }: {
  turn: Turn;
  send: (command: StudioCommand) => void;
  onPrompt: (prompt: string) => void;
  onOpenResult: (id: number, trigger: HTMLButtonElement) => void;
  resultOpen: boolean;
  docked: boolean;
  busy: boolean;
}) {
  const response = turn.command?.[2] ?? guide;
  const inPanel = turn.command && panelCommands.has(turn.command[0]);
  return <article aria-label={`第 ${turn.id} 轮对话`} className={styles.turn}>
    <div className={styles.userMessage}>
      {turn.text && <p>{turn.text}</p>}
      {turn.files.length > 0 && <ul aria-label="随消息附上的文件" className={styles.attachments}>
        {turn.files.map((file, index) => <li key={`${index}-${file}`}><Paperclip size={14} aria-hidden="true" />{file}</li>)}
      </ul>}
    </div>
    <div className={styles.reply}>
      <div className={styles.replyHeading}>
        <AiSpark size={18} status={turn.phase === "waiting" ? "thinking" : "idle"} twinkle={false} announce={false} />
        <span>{turn.model}</span>
      </div>
      {turn.phase === "waiting" ? <LoadingIndicator label="正在准备示例…" />
        : turn.phase === "stopped" ? <p className={styles.unavailable}>已停止本轮演示。</p>
          : <>
            <p className={styles.replyText}>{response}</p>
            {turn.command && (inPanel
              ? <div className={styles.artifactTrigger}>
                <ScanLine size={19} aria-hidden="true" />
                <div className={styles.artifactTriggerText}>
                  <strong>{turn.command[1]}</strong>
                  <span>在扩展面板中查看并操作</span>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  aria-haspopup={docked ? undefined : "dialog"}
                  aria-expanded={resultOpen}
                  aria-controls={resultOpen ? studioPanelId : undefined}
                  onClick={(event) => onOpenResult(turn.id, event.currentTarget)}
                >打开结果<ArrowUpRight size={15} aria-hidden="true" /></Button>
              </div>
              : <ReplyArtifact command={turn.command} onPrompt={onPrompt} />)}
            <FeedbackActions
              messageId={String(turn.id)}
              leading={<CopyButton iconOnly label="复制回复" value={response} variant="plain" />}
              positiveReasons={["清楚易懂", "交互好用"]}
              negativeReasons={["步骤不清楚", "示例不够贴切", "其他"]}
              privacyNote="反馈仅保留在当前对话中"
              thanksMessage="已记录此演示的反馈"
            />
            {turn.command && <div className={styles.followUps} aria-label="继续体验">
              {followUpCommands(turn.command).map((next) => <Button
                key={next[0]}
                type="button"
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={() => send(next)}
              >{next[1]}<ArrowUpRight size={14} aria-hidden="true" /></Button>)}
            </div>}
          </>}
    </div>
  </article>;
}

export function AiStudio() {
  const reduced = !!useReducedMotion();
  const docked = useStudioPanelDock();
  const [conversations, setConversations] = useState<Conversation[]>([{ id: 1, title: "新对话", turns: [] }]);
  const [activeId, setActiveId] = useState(1);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [panelVisibility, setPanelVisibility] = useState<boolean | null>(null);
  const [selectedTurnId, setSelectedTurnId] = useState<number>();
  const [modelId, setModelId] = useState(sampleModels[1].id);
  const [effort, setEffort] = useState<Effort>(sampleModels[1].defaultEffort);
  const [enabledTools, setEnabledTools] = useState({ search: false, thinking: false });
  const [commandsOpen, setCommandsOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const transcript = useRef<HTMLDivElement>(null);
  const composer = useRef<ComposerHandle>(null);
  const commandButton = useRef<HTMLButtonElement>(null);
  const historyButton = useRef<HTMLButtonElement>(null);
  const panelButton = useRef<HTMLButtonElement>(null);
  const panelReturnFocus = useRef<HTMLButtonElement>(null);
  const counter = useRef(0);
  const conversationCounter = useRef(1);
  const requests = useRef(new Map<number, number>());
  const active = conversations.find((thread) => thread.id === activeId)!;
  const turns = active.turns;
  const model = sampleModels.find((entry) => entry.id === modelId) ?? sampleModels[0];
  const latest = turns.at(-1);
  const busy = latest?.phase === "waiting";
  const panelOpen = panelVisibility ?? docked;
  const selected = turns.find((turn) => turn.id === selectedTurnId);

  useEffect(() => {
    const timers = requests.current;
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      timers.clear();
    };
  }, []);

  useEffect(() => {
    const node = transcript.current;
    const latestTurn = node?.querySelector("article:last-child");
    if (!node || !latestTurn) return;
    const top = latestTurn.getBoundingClientRect().top - node.getBoundingClientRect().top;
    node.scrollTop += top - 20;
  }, [activeId, turns.length]);

  function updateTurn(conversationId: number, turnId: number, phase: Turn["phase"]) {
    setConversations((current) => current.map((thread) =>
      thread.id === conversationId
        ? { ...thread, turns: thread.turns.map((turn) => turn.id === turnId ? { ...turn, phase } : turn) }
        : thread,
    ));
  }

  function send(text: string, files: string[] = [], command = resolveCommand(text), fromShortcut = false) {
    if (busy || (!text.trim() && !files.length)) return;
    const id = ++counter.current;
    const prompt = text.trim();
    const turn: Turn = { id, text: prompt, files, command, model: model.name, phase: "waiting" };
    setConversations((current) => current.map((thread) => thread.id === activeId
      ? { ...thread, title: thread.turns.length ? thread.title : (command?.[1] ?? (prompt || files[0])).slice(0, 48), turns: [...thread.turns, turn] }
      : thread,
    ));
    if (docked && panelOpen && command && panelCommands.has(command[0])) {
      panelReturnFocus.current = panelButton.current;
      setSelectedTurnId(id);
    }
    const wait = (enabledTools.thinking ? 420 : 0) + (enabledTools.search ? 260 : 0) + 360;
    requests.current.set(id, window.setTimeout(() => {
      requests.current.delete(id);
      updateTurn(activeId, id, "complete");
      setNotice("演示回复已完成");
    }, wait));
    if (fromShortcut) composer.current?.focus();
  }

  function sendCommand(command: StudioCommand) {
    send(`/${command[0]} · ${command[1]}`, [], command, true);
  }

  function stop() {
    if (!latest || latest.phase !== "waiting") return;
    window.clearTimeout(requests.current.get(latest.id));
    requests.current.delete(latest.id);
    updateTurn(activeId, latest.id, "stopped");
    setNotice("已停止演示");
  }

  function selectConversation(id: number) {
    if (id === activeId) return;
    setActiveId(id);
    const thread = conversations.find((item) => item.id === id);
    const extendedTurn = thread?.turns.findLast((turn) => turn.command && panelCommands.has(turn.command[0]));
    setSelectedTurnId(extendedTurn?.id);
  }

  function newConversation() {
    const empty = conversations.find((thread) => thread.turns.length === 0);
    if (empty) selectConversation(empty.id);
    else {
      const id = ++conversationCounter.current;
      setConversations((current) => [{ id, title: "新对话", turns: [] }, ...current]);
      setActiveId(id);
      setSelectedTurnId(undefined);
    }
    setNotice("已开始新对话");
  }

  function openResult(id: number, trigger: HTMLButtonElement) {
    panelReturnFocus.current = trigger;
    setSelectedTurnId(id);
    setPanelVisibility(true);
  }

  const panelResult = selected?.command ? {
    title: selected.command[1],
    description: `/${selected.command[0]}`,
    content: selected.phase === "waiting" ? <LoadingIndicator label="正在准备结果…" />
      : selected.phase === "stopped" ? <p className={styles.unavailable}>已停止本轮演示。</p>
        : <ReplyArtifact key={selected.id} command={selected.command} onPrompt={send} />,
  } : undefined;

  return <section className={styles.studio} aria-labelledby="studio-title">
    <header className={styles.topbar}>
      <div className={styles.topbarStart}>
        <Button ref={historyButton} className={styles.sidebarToggle} type="button" size="sm" variant="ghost"
          aria-label="会话" aria-haspopup="dialog" aria-expanded={historyOpen}
          aria-controls={historyOpen ? STUDIO_HISTORY_DRAWER_ID : undefined} onClick={() => setHistoryOpen(true)}>
          <Menu size={19} aria-hidden="true" />
        </Button>
        <div className={styles.heading}>
          <h1 id="studio-title">AI 展示台</h1>
        </div>
      </div>
      <div className={styles.topbarActions}>
        <ThemeMenu />
        <Button ref={panelButton} type="button" size="sm" variant={panelOpen ? "secondary" : "ghost"}
          aria-label="扩展面板" title="扩展面板" aria-expanded={panelOpen}
          aria-controls={panelOpen ? studioPanelId : undefined}
          aria-haspopup={docked ? undefined : "dialog"} onClick={() => {
            if (!panelOpen) panelReturnFocus.current = panelButton.current;
            setPanelVisibility(!panelOpen);
          }}>
          <PanelRight size={17} aria-hidden="true" />
          <span className="hidden sm:inline">扩展面板</span>
        </Button>
        <LogoutButton />
      </div>
    </header>
    <div className={styles.workspace} data-dock-open={docked && panelOpen ? "" : undefined}>
      <StudioHistory conversations={conversations} activeId={activeId} onSelect={selectConversation} onNew={newConversation}
        open={historyOpen} onOpenChange={setHistoryOpen} returnFocusRef={historyButton} />
      <main className={styles.conversation} aria-label="AI 对话">
      <div className={styles.transcript} ref={transcript} tabIndex={0} aria-label="对话记录">
        {turns.length === 0 ? <div className={styles.welcome}>
          <AiMascot size={88} status="idle" label="澄序助手" />
          <h2>想体验什么？</h2>
          <p>试试调研、制定计划或分析数据。回复里的卡片可以继续操作。</p>
          <div className={styles.suggestions} aria-label="快捷指令">
            {quickCommands.map((id) => {
              const command = studioCommand(id)!;
              return <Button key={id} size="sm" type="button" variant="secondary" onClick={() => sendCommand(command)}>
                {command[1]}<ArrowUpRight size={14} aria-hidden="true" />
              </Button>;
            })}
          </div>
        </div> : <div className={styles.messages}>
          {turns.map((turn) => <ConversationTurn turn={turn} key={turn.id} send={sendCommand} onPrompt={send}
            onOpenResult={openResult} resultOpen={panelOpen && selectedTurnId === turn.id} docked={docked} busy={busy} />)}
        </div>}
      </div>
      <div className={styles.footer}>
        <div className={styles.composer}>
          <Composer
            key={activeId}
            ref={composer}
            models={sampleModels}
            model={model}
            effort={effort}
            webSearch={enabledTools.search}
            thinking={enabledTools.thinking}
            onModel={(id) => {
              setModelId(id);
              setEffort(sampleModels.find((entry) => entry.id === id)?.defaultEffort ?? "medium");
            }}
            onEffort={setEffort}
            onTool={(tool) => setEnabledTools((current) => ({ ...current, [tool]: !current[tool] }))}
            busy={busy}
            progress={busy ? null : 0}
            progressSeconds={0.3}
            run={latest?.id ?? 0}
            placeholder="输入消息或 / 指令"
            maxLength={3000}
            reduced={reduced}
            onSubmit={(draft: ComposerDraft) => send(draft.text, draft.attachments.map((attachment) => attachment.name))}
            onStop={stop}
            announce={setNotice}
          />
        </div>
        <div className={styles.footerTools}>
          <Button ref={commandButton} aria-haspopup="dialog" aria-expanded={commandsOpen} size="sm" variant="ghost" type="button"
            disabled={busy} onClick={() => setCommandsOpen(true)}>
            <Command size={15} aria-hidden="true" />所有指令
          </Button>
          <Dialog open={commandsOpen} onOpenChange={setCommandsOpen}>
            <DialogContent title="所有指令" description="搜索名称或键入指令，选择后发送到当前对话。" closeLabel="关闭指令列表"
              className={styles.commandDialog}
              onCloseAutoFocus={(event) => {
                event.preventDefault();
                if (commandButton.current?.disabled) composer.current?.focus();
                else commandButton.current?.focus();
              }}
            >
              <AiCommand
                items={paletteItems}
                height={340}
                placeholder={{ search: "搜索 AI 指令", ask: "输入示例请求" }}
                autoPlay={false}
                aria-label="AI 指令"
                onSelect={({ id }) => {
                  const command = studioCommand(id);
                  if (!command) return;
                  setCommandsOpen(false);
                  sendCommand(command);
                }}
                onAsk={async (message) => ({ text: resolveCommand(message)?.[2] ?? guide })}
              />
            </DialogContent>
          </Dialog>
          <span>示例数据 · 在当前浏览器运行</span>
        </div>
        <span className={styles.srOnly} aria-live="polite">{notice}</span>
      </div>
      </main>
      <StudioPanel open={panelOpen} onOpenChange={setPanelVisibility} onRunCommand={(command) => {
        sendCommand(command);
        if (!docked) setPanelVisibility(false);
      }}
        onBrowseCommands={() => setSelectedTurnId(undefined)} result={panelResult} busy={busy} returnFocusRef={panelReturnFocus} />
    </div>
  </section>;
}
