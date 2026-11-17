"use client";

import { useState } from "react";
import { AiTranslate } from "@/shared/arc/pro/ai-translate/ai-translate";
import { AvatarUpload } from "@/shared/arc/pro/avatar-upload/avatar-upload";
import { ConnectorSetup } from "@/shared/arc/pro/connector-setup/connector-setup";
import { DateReel } from "@/shared/arc/pro/date-reel/date-reel";
import { DictationButton } from "@/shared/arc/pro/dictation-button/dictation-button";
import { EmojiPicker } from "@/shared/arc/pro/emoji-picker/emoji-picker";
import { GhostText } from "@/shared/arc/pro/ghost-text/ghost-text";
import { LlmCostCalculator } from "@/shared/arc/pro/llm-cost-calculator/llm-cost-calculator";
import { ProviderKeys } from "@/shared/arc/pro/provider-keys/provider-keys";
import { ReplyDraft } from "@/shared/arc/pro/reply-draft/reply-draft";
import { SmartFormFill } from "@/shared/arc/pro/smart-form-fill/smart-form-fill";
import { TimeDial } from "@/shared/arc/pro/time-dial/time-dial";
import { ToneTuner } from "@/shared/arc/pro/tone-tuner/tone-tuner";
import { VoiceRecorder } from "@/shared/arc/pro/voice-recorder/voice-recorder";

export function AiTranslateDemo() {
  return <AiTranslate autoPlay={false} />;
}

export function AvatarUploadDemo() {
  return <AvatarUpload name="陈小雨" label="项目头像" hint="上传一张 JPG、PNG 或 WebP 图片并裁切" onUpload={async () => {}} onRemove={() => {}} />;
}

export function ConnectorSetupDemo() {
  return <ConnectorSetup title="给工作区接入资料" autoPlay={false} />;
}

export function DateReelDemo() {
  return <DateReel mode="date" defaultValue={new Date("2026-11-17T12:00:00")} locale="zh-CN" title="选择到期日期" />;
}

export function DictationButtonDemo() {
  return <DictationButton autoPlay={false} placeholder="按麦克风试听示例听写" />;
}

export function EmojiPickerDemo() {
  const [selected, setSelected] = useState("👋");
  return (
    <div className="grid w-full min-w-0 gap-2">
      <p role="status" className="text-sm text-muted-foreground">已选择 {selected}</p>
      <EmojiPicker storageKey="chengxu.showcase.emoji" label="选择反应表情" onSelect={(item) => setSelected(item.emoji)} />
    </div>
  );
}

export function GhostTextDemo() {
  return <GhostText defaultValue="Thank you for" placeholder="输入一句话，体验补全建议" />;
}

export function LlmCostCalculatorDemo() {
  return <LlmCostCalculator title="估算模型用量成本" />;
}

export function ProviderKeysDemo() {
  return <ProviderKeys title="配置演示模型" description="此演示使用预设数据，无需填写真实密钥。" />;
}

export function ReplyDraftDemo() {
  return <ReplyDraft autoStart={false} autoPlay={false} />;
}

export function SmartFormFillDemo() {
  return <SmartFormFill autoPlay={false} title="从一段简介提取表单信息" />;
}

export function TimeDialDemo() {
  return <TimeDial
    label="跨时区会议时间"
    defaultValue={420}
    hourCycle={24}
    cities={[
      { id: "sh", name: "上海", code: "SHA", offset: 480 },
      { id: "ldn", name: "伦敦", code: "LON", offset: 0 },
      { id: "nyc", name: "纽约", code: "NYC", offset: -300 },
    ]}
  />;
}

export function ToneTunerDemo() {
  return <ToneTuner autoPlay={false} />;
}

export function VoiceRecorderDemo() {
  return <VoiceRecorder maxDuration={15} label="体验语音消息" sentMeta="刚刚" />;
}
