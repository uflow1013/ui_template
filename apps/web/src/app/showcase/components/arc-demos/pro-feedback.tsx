"use client";

import { Button } from "@/shared/arc/button/button";
import { AgentStatus } from "@/shared/arc/pro/agent-status/agent-status";
import { AiMascot } from "@/shared/arc/pro/ai-mascot/ai-mascot";
import { AiSpark } from "@/shared/arc/pro/ai-spark/ai-spark";
import { CubeMascot } from "@/shared/arc/pro/cube-mascot/cube-mascot";
import { GhostMascot } from "@/shared/arc/pro/ghost-mascot/ghost-mascot";
import { MorphLoader, type MorphLoaderStatus } from "@/shared/arc/pro/morph-loader/morph-loader";
import { PixelMascot } from "@/shared/arc/pro/pixel-mascot/pixel-mascot";
import { ResponseFeedback } from "@/shared/arc/pro/response-feedback/response-feedback";
import { MorphBlock, SkeletonMorph } from "@/shared/arc/pro/skeleton-morph/skeleton-morph";
import { SocialProofToast } from "@/shared/arc/pro/social-proof-toast/social-proof-toast";
import { StretchRefresh } from "@/shared/arc/pro/stretch-refresh/stretch-refresh";
import { TrialBanner } from "@/shared/arc/pro/trial-banner/trial-banner";
import { UndoToast } from "@/shared/arc/pro/undo-toast/undo-toast";
import { UpgradePrompt } from "@/shared/arc/pro/upgrade-prompt/upgrade-prompt";
import { VoiceOrb, VoiceTranscript } from "@/shared/arc/pro/voice-orb/voice-orb";
import { useState, type ReactNode } from "react";
import { DemoColumn, DemoResult } from "./fixtures";

const mascotStates = ["idle", "thinking", "writing", "done", "error"] as const;
const mascotLabels = ["待命", "思考中", "正在撰写", "完成", "遇到错误"];

function MascotDemo({ render }: { render: (status: (typeof mascotStates)[number]) => ReactNode }) {
  const [step, setStep] = useState(0);
  return (
    <DemoColumn>
      <div className="grid min-h-28 place-items-center rounded-[var(--radius-panel)] bg-[var(--surface-muted)]">
        {render(mascotStates[step])}
      </div>
      <div className="flex items-center gap-3">
        <Button size="sm" variant="secondary" onClick={() => setStep((current) => (current + 1) % mascotStates.length)}>切换状态</Button>
        <DemoResult>{mascotLabels[step]}</DemoResult>
      </div>
    </DemoColumn>
  );
}

export function AiMascotDemo() {
  return <MascotDemo render={(status) => <AiMascot size={85} status={status} label={mascotLabels[mascotStates.indexOf(status)]} />} />;
}

export function CubeMascotDemo() {
  return <MascotDemo render={(status) => <CubeMascot size={80} status={status} label={mascotLabels[mascotStates.indexOf(status)]} />} />;
}

export function GhostMascotDemo() {
  return <MascotDemo render={(status) => <GhostMascot size={85} status={status} label={mascotLabels[mascotStates.indexOf(status)]} />} />;
}

export function PixelMascotDemo() {
  return <MascotDemo render={(status) => <PixelMascot size={3} status={status} label={mascotLabels[mascotStates.indexOf(status)]} announce={false} />} />;
}

export function AiSparkDemo() {
  return <MascotDemo render={(status) => <AiSpark variant="pill" status={status === "writing" ? "generating" : status} label={mascotLabels[mascotStates.indexOf(status)]} announce={false} />} />;
}

export function AgentStatusDemo() {
  const [running, setRunning] = useState(false);
  return (
    <DemoColumn>
      <AgentStatus
        status={running ? "working" : "idle"}
        agent={{ name: "发布助手" }}
        activity={{ label: running ? "正在核对主题" : "等待任务", progress: { value: running ? 1 : 0, total: 2 } }}
        steps={[
          { id: "layout", label: "检查页面布局", status: running ? "done" : "pending" },
          { id: "theme", label: "核对明暗主题", status: running ? "active" : "pending" },
        ]}
        onStop={() => setRunning(false)}
        align="start"
      />
      <Button size="sm" variant="secondary" onClick={() => setRunning(!running)}>{running ? "停止检查" : "开始检查"}</Button>
    </DemoColumn>
  );
}

export function MorphLoaderDemo() {
  const [status, setStatus] = useState<MorphLoaderStatus>("loading");
  return (
    <DemoColumn>
      <div className="flex items-center gap-3">
        <MorphLoader variant="dots" status={status} label="正在导入" successLabel="导入成功" errorLabel="导入失败" />
        <span className="text-sm">{status === "loading" ? "正在导入" : status === "success" ? "导入成功" : "导入失败"}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" onClick={() => setStatus("success")}>成功</Button>
        <Button size="sm" variant="secondary" onClick={() => setStatus("error")}>失败</Button>
        <Button size="sm" variant="ghost" onClick={() => setStatus("loading")}>重试</Button>
      </div>
    </DemoColumn>
  );
}

export function ResponseFeedbackDemo() {
  const [result, setResult] = useState("");
  const reply = "发布前请确认表单校验、窄屏布局和键盘焦点都已检查。";
  return (
    <DemoColumn>
      <ResponseFeedback
        prompt="发布前还要检查什么？"
        messageId="release-check"
        copyText={reply}
        negativeReasons={["不够具体", "缺少步骤"]}
        positiveReasons={["清楚", "有帮助"]}
        commentPlaceholder="还可以改进什么？"
        thanksMessage="反馈已记录在本次演示。"
        onFeedback={(event) => setResult(event.rating === "up" ? "已标记有帮助。" : "已记录改进意见。")}
      >
        <p>{reply}</p>
      </ResponseFeedback>
      <DemoResult>{result}</DemoResult>
    </DemoColumn>
  );
}

export function SkeletonMorphDemo() {
  const [loading, setLoading] = useState(true);
  return (
    <DemoColumn>
      <SkeletonMorph loading={loading} loadingLabel="正在加载项目" className="grid min-w-0 gap-3 rounded-[var(--radius-panel)] border border-border p-4">
        <MorphBlock width="65%" height={18}><p className="font-medium">澄序工作台</p></MorphBlock>
        <MorphBlock lines={2}><p className="text-sm text-[var(--text-secondary)]">已整理本周的组件审查和发布任务。</p></MorphBlock>
      </SkeletonMorph>
      <Button variant="secondary" size="sm" onClick={() => setLoading(!loading)}>{loading ? "显示加载结果" : "重新加载"}</Button>
    </DemoColumn>
  );
}

const activity = [
  { id: "created", name: "林嘉", action: "创建了发布检查清单", time: "刚刚" },
  { id: "reviewed", name: "许知宁", action: "完成了组件评审", time: "1 分钟前" },
];

export function SocialProofToastDemo() {
  const [run, setRun] = useState(0);
  return (
    <DemoColumn>
      <SocialProofToast key={run} events={activity} prefill={1} loop={false} position="inline" label="工作区活动通知" />
      <Button size="sm" variant="secondary" onClick={() => setRun((current) => current + 1)}>重播活动</Button>
    </DemoColumn>
  );
}

const initialRows = [{ id: "summary", title: "本周发布摘要" }, { id: "review", title: "设计评审记录" }];

export function StretchRefreshDemo() {
  const [rows, setRows] = useState(initialRows);
  const [count, setCount] = useState(0);
  return (
    <DemoColumn>
      <StretchRefresh
        title="工作区动态"
        subtitle={count ? `已刷新 ${count} 次` : "可点击按钮或下拉刷新"}
        items={rows}
        getKey={(row) => row.id}
        renderItem={(row) => <p className="px-3 py-2 text-sm">{row.title}</p>}
        refreshLabel="刷新工作区动态"
        onRefresh={async () => {
          await new Promise((resolve) => window.setTimeout(resolve, 650));
          setRows([{ id: "release", title: "组件库已发布" }, ...initialRows]);
          setCount((current) => current + 1);
          return count ? "已是最新动态" : "有 1 条新动态";
        }}
      />
    </DemoColumn>
  );
}

export function TrialBannerDemo() {
  const [run, setRun] = useState(0);
  return (
    <DemoColumn>
      <TrialBanner
        key={run}
        daysLeft={3}
        plan="团队版"
        variant="pill"
        workspace="澄序工作台"
        features={[{ id: "reviews", label: "共享设计评审" }, { id: "history", label: "完整版本记录" }]}
      />
      <Button size="sm" variant="ghost" onClick={() => setRun((current) => current + 1)}>重置试用状态</Button>
    </DemoColumn>
  );
}

export function UndoToastDemo() {
  const [run, setRun] = useState(0);
  return (
    <DemoColumn>
      <UndoToast
        key={run}
        defaultItems={initialRows}
        getKey={(row) => row.id}
        actions={{ archive: { label: "归档", done: "已归档" } }}
        noun={["记录", "记录"]}
        label="可归档的记录"
        toastPlacement="container"
        renderItem={(row, { remove }) => (
          <div className="flex items-center justify-between gap-2 py-2 text-sm">
            <span>{row.title}</span>
            <Button size="sm" variant="secondary" onClick={() => remove("archive")}>归档</Button>
          </div>
        )}
      />
      <Button size="sm" variant="ghost" onClick={() => setRun((current) => current + 1)}>重置记录</Button>
    </DemoColumn>
  );
}

export function UpgradePromptDemo() {
  return (
    <DemoColumn>
      <UpgradePrompt used={48} limit={50} unit="次摘要" title="本月摘要次数即将用完" description="试用切换计费周期和升级后的状态。" />
    </DemoColumn>
  );
}

const voiceStates = ["idle", "listening", "thinking", "speaking"] as const;
const voiceLabels = ["等待开始", "正在聆听", "正在理解", "正在回复"];
export function VoiceOrbDemo() {
  const [step, setStep] = useState(0);
  return (
    <DemoColumn>
      <div className="flex items-center gap-3">
        <VoiceOrb state={voiceStates[step]} size={88} label={voiceLabels[step]} />
        <VoiceTranscript text={step === 3 ? "已为你整理了三个要点。" : voiceLabels[step]} turn={step} complete={step === 3} />
      </div>
      <Button size="sm" variant="secondary" onClick={() => setStep((current) => (current + 1) % voiceStates.length)}>推进语音状态</Button>
    </DemoColumn>
  );
}
