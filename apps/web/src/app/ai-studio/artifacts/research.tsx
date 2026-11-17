import { ReasoningBlock } from "@/shared/arc/pro/reasoning-block/reasoning-block";
import { ReasoningTree } from "@/shared/arc/pro/reasoning-tree/reasoning-tree";
import { SourceCards, sourceCardsSamples } from "@/shared/arc/pro/source-cards/source-cards";
import { TldrToggle } from "@/shared/arc/pro/tldr-toggle/tldr-toggle";
import { ToolCallGroup } from "@/shared/arc/pro/tool-call/tool-call";
import { VectorSearch } from "@/shared/arc/pro/vector-search/vector-search";
import { AiAnswer } from "../arc-blocks/ai-answer/ai-answer";
import { DocumentExtract } from "../arc-blocks/document-extract/document-extract";
import { ResearchRun } from "../arc-blocks/research-run/research-run";

const workSteps = [
  { title: "圈定资料", text: "核对发布清单和已经确认的里程碑。" },
  { title: "整理线索", text: "区分尚未验证的风险与已经解决的问题。" },
  { title: "核对引用", text: "将每一项结论与对应的本地样例资料关联。" },
];

export const artifacts = {
  "research-run": () => <ResearchRun title="季度发布计划研究" />,
  "ai-answer": () => <AiAnswer />,
  "source-cards": () => <SourceCards sources={sourceCardsSamples} />,
  "vector-search": () => <VectorSearch />,
  "reasoning-block": () => <ReasoningBlock reasoning={workSteps} defaultOpen status="done" seconds={3} />,
  "reasoning-tree": () => <ReasoningTree />,
  "tool-call": () => <ToolCallGroup defaultOpen />,
  "document-extract": () => <DocumentExtract />,
  "tldr-toggle": () => <TldrToggle defaultMode="summary" />,
};
