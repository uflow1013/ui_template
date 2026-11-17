"use client";

import { AgentCursor } from "@/shared/arc/pro/agent-cursor/agent-cursor";
import { AgentHandoff } from "@/shared/arc/pro/agent-handoff/agent-handoff";
import { AgentPlan } from "@/shared/arc/pro/agent-plan/agent-plan";
import { AgentTimeline } from "@/shared/arc/pro/agent-timeline/agent-timeline";
import { AiWorkflow } from "@/shared/arc/pro/ai-workflow/ai-workflow";
import { AskYourData } from "@/shared/arc/pro/ask-your-data/ask-your-data";
import { CodeSuggestion } from "@/shared/arc/pro/code-suggestion/code-suggestion";
import { ContextWindow } from "@/shared/arc/pro/context-window/context-window";
import { EnrichColumn } from "@/shared/arc/pro/enrich-column/enrich-column";
import { GenerationStats } from "@/shared/arc/pro/generation-stats/generation-stats";
import { ImageGeneration } from "@/shared/arc/pro/image-generation/image-generation";
import { MeetingSummary } from "@/shared/arc/pro/meeting-summary/meeting-summary";
import { ModelCard } from "@/shared/arc/pro/model-card/model-card";
import { ModelTraining } from "@/shared/arc/pro/model-training/model-training";
import { PiiRedaction } from "@/shared/arc/pro/pii-redaction/pii-redaction";
import { ProviderStatus } from "@/shared/arc/pro/provider-status/provider-status";
import { ReasoningBlock } from "@/shared/arc/pro/reasoning-block/reasoning-block";
import { SourceCards } from "@/shared/arc/pro/source-cards/source-cards";
import { SpeechPlayer } from "@/shared/arc/pro/speech-player/speech-player";
import { TicketRouter } from "@/shared/arc/pro/ticket-router/ticket-router";
import { ToolCall } from "@/shared/arc/pro/tool-call/tool-call";
import { TrainingRun } from "@/shared/arc/pro/training-run/training-run";
import { VectorSearch } from "@/shared/arc/pro/vector-search/vector-search";

export function AgentCursorDemo() {
  return <AgentCursor autoPlay={false} loop={false} meta="发布简报 · 建议审阅" />;
}

export function AgentHandoffDemo() {
  return <AgentHandoff height={470} title="订单协助" subtitle="订单 #CX-218" />;
}

export function AgentPlanDemo() {
  return <AgentPlan goal="把新功能整理成可发布的更新说明" />;
}

export function AgentTimelineDemo() {
  return <AgentTimeline autoPlay={false} />;
}

export function AiWorkflowDemo() {
  return <AiWorkflow autoPlay={false} title="整理反馈" description="分类后创建团队待办" />;
}

export function AskYourDataDemo() {
  return <AskYourData autoRun={false} keepSqlOpen />;
}

export function CodeSuggestionDemo() {
  return <CodeSuggestion instruction="保留原有输出格式并整理重复逻辑" shortcuts={false} maxCodeHeight={260} />;
}

export function ContextWindowDemo() {
  return <ContextWindow threshold={0.75} />;
}

export function EnrichColumnDemo() {
  return <EnrichColumn editable autoRun={false} title="补全客户资料" />;
}

export function GenerationStatsDemo() {
  return <GenerationStats defaultExpanded />;
}

export function ImageGenerationDemo() {
  return <ImageGeneration autoGenerate={false} placeholder="描述想要生成的图片" />;
}

export function MeetingSummaryDemo() {
  return <MeetingSummary />;
}

export function ModelCardDemo() {
  return <ModelCard defaultView="compare" />;
}

export function ModelTrainingDemo() {
  return <ModelTraining controls caption label="逐阶段检查训练误差和模型预测" />;
}

export function PiiRedactionDemo() {
  return <PiiRedaction defaultShowOriginal={false} />;
}

export function ProviderStatusDemo() {
  return <ProviderStatus title="模型服务可用性" />;
}

export function ReasoningBlockDemo() {
  return <ReasoningBlock defaultOpen variant="card" />;
}

export function SourceCardsDemo() {
  return <SourceCards defaultExpanded />;
}

export function SpeechPlayerDemo() {
  return <SpeechPlayer text="欢迎来到澄序。点选任意词语可以从该处继续播放。" simulated />;
}

export function TicketRouterDemo() {
  return <TicketRouter title="将客服请求分给合适的团队" loop={false} />;
}

export function ToolCallDemo() {
  return <ToolCall
    id="catalog-search"
    tool="web"
    title="搜索组件文档"
    status="success"
    durationMs={128}
    input={{ query: "日期选择器" }}
    output={{
      type: "list",
      items: [
        { title: "日期选择器", tag: "表单" },
        { title: "日期范围选择器", tag: "表单" },
      ],
    }}
    defaultOpen
  />;
}

export function TrainingRunDemo() {
  return <TrainingRun name="support-triage-sample" />;
}

export function VectorSearchDemo() {
  return <VectorSearch query="查找与组件主题有关的说明" />;
}
