import { AiTranslate } from "@/shared/arc/pro/ai-translate/ai-translate";
import { CodeSuggestion } from "@/shared/arc/pro/code-suggestion/code-suggestion";
import { GhostText } from "@/shared/arc/pro/ghost-text/ghost-text";
import { MeetingSummary } from "@/shared/arc/pro/meeting-summary/meeting-summary";
import { PiiRedaction } from "@/shared/arc/pro/pii-redaction/pii-redaction";
import { ReplyDraft } from "@/shared/arc/pro/reply-draft/reply-draft";
import { SmartFormFill } from "@/shared/arc/pro/smart-form-fill/smart-form-fill";
import { StarterPrompts } from "@/shared/arc/pro/starter-prompts/starter-prompts";
import { ToneTuner } from "@/shared/arc/pro/tone-tuner/tone-tuner";
import { AiInlineEdit } from "../arc-blocks/ai-inline-edit/ai-inline-edit";
import type { ArtifactProps } from "../command-artifacts";

const prompts = [
  { id: "summarize", category: "write", title: "总结发布资料", prompt: "/summarize 梳理季度发布计划的要点。" },
  { id: "translate", category: "write", title: "翻译更新说明", prompt: "/translate 将示例说明翻译成英语。" },
  { id: "reply", category: "write", title: "为项目组起草回信", prompt: "/reply-draft 准备简短的中文回信。" },
];

function PromptExamples({ onPrompt }: ArtifactProps) {
  return <StarterPrompts greeting="提示词示例" count={3} description="选中后可编辑，再发送到当前对话。"
    categories={[{ id: "write", label: "写作" }]} prompts={prompts} onSubmit={onPrompt} placeholder="编辑提示词" />;
}

export const artifacts = {
  "reply-draft": () => <ReplyDraft />,
  "tone-tuner": () => <ToneTuner autoPlay={false} />,
  "ai-inline-edit": () => <AiInlineEdit />,
  "ai-translate": () => <AiTranslate autoPlay={false} />,
  "meeting-summary": () => <MeetingSummary />,
  "ghost-text": () => <GhostText />,
  "code-suggestion": () => <CodeSuggestion shortcuts={false} />,
  "pii-redaction": () => <PiiRedaction autoPlay={false} />,
  "smart-form-fill": () => <SmartFormFill title="提取示例联系人" submitLabel="保存到当前演示" autoPlay={false} />,
  "starter-prompts": PromptExamples,
};
